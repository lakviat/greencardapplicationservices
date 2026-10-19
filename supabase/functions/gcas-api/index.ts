import { createClient } from "@supabase/supabase-js";
import jpeg from "jpeg-js";
import {
  FORM_VERSION,
  fields,
  initialDraft,
} from "../../../assets/preparation/schema.mjs";
import {
  HttpError,
  assert,
  uuid,
  plan,
  checkoutEmail,
  sanitizePayload,
  requireComplete,
  verifyStripeSignature,
} from "./core.mjs";
import { makePdf } from "./pdf.mjs";
import { emailReady, sendReadyEmail } from "./email.mjs";
import { PAYMENT_LINKS } from "../../../assets/preparation/payment-links.mjs";
import { entryProgress } from "../../../assets/preparation/entry-progress.mjs";
const env = (name: string) => Deno.env.get(name) || "";
const origin =
  env("PUBLIC_APP_ORIGIN") || "https://greencardapplicationservices.com";
const origins = new Set([
  origin,
  ...env("GCAS_EXTRA_ORIGINS").split(",").filter(Boolean),
]);
const admin = createClient(
  env("SUPABASE_URL"),
  env("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const bucket = admin.storage.from("gcas-private");
const stripeKey = () => env("STRIPE_SECRET_KEY").trim();
const ready = () => env("GCAS_AUTH_READY") === "true";
const checkoutReady = () =>
  ready() &&
  env("GCAS_CHECKOUT_ENABLED") === "true" &&
  /^(sk|rk)_(live|test)_[A-Za-z0-9]{20,}$/.test(stripeKey()) &&
  !!env("STRIPE_WEBHOOK_SECRET");
function check(result: any) {
  if (result.error)
    throw new HttpError(
      503,
      "The service could not complete this request. Please retry.",
    );
  return result.data;
}
async function stripe(
  path: string,
  body?: URLSearchParams,
  idempotency?: string,
) {
  assert(stripeKey(), 503, "Checkout is not configured yet.");
  const res = await fetch("https://api.stripe.com/v1/" + path, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${stripeKey()}`,
      ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      ...(idempotency ? { "Idempotency-Key": idempotency } : {}),
    },
    body,
  });
  const data = await res.json();
  if (!res.ok) {
    // Keep credentials, receipt emails, card data and provider messages out of
    // logs. Safe identifiers let the owner find the failed call in Workbench.
    const safe = (value: unknown) =>
      typeof value === "string" && /^[A-Za-z0-9_]{1,80}$/.test(value)
        ? value
        : undefined;
    console.error("stripe_request_failed", {
      status: res.status,
      type: safe(data.error?.type),
      code: safe(data.error?.code),
      request: safe(res.headers.get("request-id")),
    });
  }
  assert(
    res.ok,
    503,
    "Payment service unavailable. Your saved preparation is still in your account.",
  );
  return data;
}
async function owned(id: string, userId: string, paid = false) {
  assert(uuid(id), 400, "Invalid preparation.");
  const p = check(
    await admin
      .from("gcas_preparations")
      .select("*")
      .eq("id", id)
      .eq("owner_id", userId)
      .neq("state", "deleted")
      .maybeSingle(),
  );
  assert(
    p && new Date(p.expires_at).getTime() > Date.now(),
    404,
    "Preparation not found or expired.",
  );
  if (paid) assert(p.state === "paid", 402, "Verified payment is required.");
  return p;
}
async function limited(key: string, limit = 60, seconds = 60) {
  assert(
    check(
      await admin.rpc("gcas_limit", {
        p_key: key,
        p_limit: limit,
        p_seconds: seconds,
      }),
    ),
    429,
    "Please wait before trying again.",
  );
}
async function bodyJson(req: Request, max = 524288) {
  const raw = await bounded(req, max);
  try {
    return JSON.parse(new TextDecoder().decode(raw));
  } catch {
    throw new HttpError(400, "Invalid request.");
  }
}
async function bounded(req: Request, max: number) {
  assert(
    Number(req.headers.get("content-length") || 0) <= max,
    413,
    "File or request is too large.",
  );
  const reader = req.body?.getReader();
  assert(reader, 400, "Request body required.");
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader!.read();
    if (done) break;
    size += value.length;
    if (size > max) {
      await reader!.cancel();
      throw new HttpError(413, "File or request is too large.");
    }
    chunks.push(value);
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    result.set(c, offset);
    offset += c.length;
  }
  return result;
}
async function flushCleanup() {
  const rows = check(
    await admin.from("gcas_storage_cleanup").select("object_path").limit(100),
  );
  if (rows.length) {
    check(await bucket.remove(rows.map((r: any) => r.object_path)));
    check(
      await admin
        .from("gcas_storage_cleanup")
        .delete()
        .in(
          "object_path",
          rows.map((r: any) => r.object_path),
        ),
    );
  }
}
async function webhook(req: Request) {
  const raw = new TextDecoder().decode(await bounded(req, 262144));
  const event = await verifyStripeSignature(
    raw,
    req.headers.get("stripe-signature"),
    env("STRIPE_WEBHOOK_SECRET"),
  );
  if (
    [
      "checkout.session.completed",
      "checkout.session.async_payment_succeeded",
    ].includes(event.type)
  ) {
    const session = await stripe(
      `checkout/sessions/${encodeURIComponent(event.data.object.id)}?expand[]=payment_intent.latest_charge`,
    );
    const orderId = session.metadata?.gcas_order || session.client_reference_id;
    if (!uuid(orderId)) return { received: true, ignored: true };
    const order = check(
      await admin
        .from("gcas_orders")
        .select("*")
        .eq("id", orderId)
        .maybeSingle(),
    );
    if (!order) return { received: true, ignored: true };
    const link = Object.entries(PAYMENT_LINKS).find(
      ([key]) => plan(key).cents === order.amount,
    )?.[1];
    const linkedPayment =
      session.payment_link === link?.id &&
      session.client_reference_id === order.id;
    const legacyPayment =
      !session.payment_link &&
      session.metadata?.gcas_order === order.id &&
      session.client_reference_id === order.preparation_id;
    const tax = session.total_details?.amount_tax || 0;
    const total = linkedPayment ? order.amount + tax : order.amount;
    assert(
      session.mode === "payment" &&
        session.currency === "usd" &&
        (linkedPayment || legacyPayment) &&
        (!linkedPayment ||
          (session.amount_subtotal === order.amount &&
            Number.isSafeInteger(tax) &&
            tax >= 0 &&
            !session.total_details?.amount_discount &&
            !session.total_details?.amount_shipping)) &&
        session.amount_total === total &&
        session.livemode === /^(sk|rk)_live_/.test(stripeKey()),
      400,
      "Payment details do not match.",
    );
    if (session.payment_status !== "paid")
      return { received: true, pending: true };
    const pi = session.payment_intent;
    assert(
      pi?.id && pi.status === "succeeded" && pi.amount_received === total,
      400,
      "Payment is not complete.",
    );
    check(
      await admin.rpc("gcas_payment", {
        p_event: event.id,
        p_type: event.type,
        p_order: order.id,
        p_session: session.id,
        p_payment: pi.id,
        p_amount: order.amount,
        p_paid: !(
          pi.latest_charge?.refunded ||
          pi.latest_charge?.disputed ||
          pi.latest_charge?.amount_refunded > 0
        ),
      }),
    );
  } else if (
    ["charge.refunded", "charge.dispute.created"].includes(event.type)
  ) {
    const object = event.data.object;
    const charge =
      event.type === "charge.dispute.created"
        ? await stripe(`charges/${encodeURIComponent(object.charge)}`)
        : await stripe(`charges/${encodeURIComponent(object.id)}`);
    const order = check(
      await admin
        .from("gcas_orders")
        .select("*")
        .eq("payment_id", charge.payment_intent)
        .maybeSingle(),
    );
    if (order)
      check(
        await admin.rpc("gcas_payment", {
          p_event: event.id,
          p_type: event.type,
          p_order: order.id,
          p_session: order.session_id,
          p_payment: order.payment_id,
          p_amount: order.amount,
          p_paid: false,
        }),
      );
  }
  return { received: true };
}
async function handle(req: Request, url: URL) {
  const route = url.pathname.split("/").filter(Boolean).at(-1);
  if (route === "webhook") {
    assert(req.method === "POST", 405, "Use POST.");
    return webhook(req);
  }
  if (route === "health")
    return {
      version: 1,
      accounts: ready(),
      cloudSave: ready(),
      checkout: checkoutReady(),
      pdfDownload: ready(),
      emailDelivery: ready() && emailReady(env),
      premium: false,
    };
  assert(req.method === "POST", 405, "Use POST.");
  const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
  assert(token, 401, "Sign in to continue.");
  const { data, error } = await admin.auth.getUser(token);
  assert(!error && data.user?.email_confirmed_at, 401, "Please sign in again.");
  const user = data.user!;
  await limited(`${user.id}:all`);
  if (route === "list") {
    const rows = check(
      await admin
        .from("gcas_preparations")
        .select(
          "id,package,version,year,revision,state,updated_at,expires_at,payload,submission_reported_at",
        )
        .eq("owner_id", user.id)
        .neq("state", "deleted")
        .or("revision.gt.0,state.eq.paid")
        .gt("expires_at", new Date().toISOString())
        .order("updated_at", { ascending: false }),
    );
    return {
      preparations: rows.map(
        ({ payload, submission_reported_at, ...row }: any) => ({
          ...row,
          entry: entryProgress({ ...row, payload, submission_reported_at }),
        }),
      ),
    };
  }
  if (route === "upload") {
    await limited(`${user.id}:upload`, 20);
    const id = url.searchParams.get("id") || "",
      documentId = url.searchParams.get("document") || "",
      field = url.searchParams.get("field") || "";
    await owned(id, user.id);
    assert(
      uuid(documentId) &&
        /^(entrant|spouse|passport|child\.[0-9a-f-]{36})\.[a-zA-Z]+$/.test(
          field,
        ),
      400,
      "Invalid file destination.",
    );
    const photo = field.endsWith(".photo");
    assert(
      photo || ["passport.bio", "passport.signature"].includes(field),
      400,
      "Unsupported file field.",
    );
    assert(
      req.headers.get("content-type") === "image/jpeg",
      400,
      "Use a JPEG image.",
    );
    const bytes = await bounded(req, photo ? 245760 : 5242880);
    assert(
      bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255,
      400,
      "Invalid JPEG.",
    );
    let decoded;
    try {
      decoded = jpeg.decode(bytes, {
        useTArray: true,
        maxResolutionInMP: 20,
        maxMemoryUsageInMB: 128,
      });
    } catch {
      throw new HttpError(400, "This image could not be decoded safely.");
    }
    assert(
      photo
        ? decoded.width === 600 && decoded.height === 600
        : decoded.width >= 100 &&
            decoded.height >= 100 &&
            decoded.width <= 5000 &&
            decoded.height <= 5000,
      400,
      "Image dimensions do not meet the requirements.",
    );
    // Decode/re-encode removes EXIF and other source metadata; images are never executable files.
    const clean = jpeg.encode(decoded, photo ? 85 : 90).data;
    assert(
      clean.length <= (photo ? 245760 : 5242880),
      413,
      "Prepared image is too large.",
    );
    const assetId = crypto.randomUUID(),
      path = `${user.id}/${id}/${assetId}.jpg`;
    check(
      await bucket.upload(path, clean, {
        contentType: "image/jpeg",
        upsert: false,
        cacheControl: "0",
      }),
    );
    const inserted = await admin.from("gcas_assets").insert({
      id: assetId,
      preparation_id: id,
      document_id: documentId,
      field_id: field,
      object_path: path,
      bytes: clean.length,
      width: decoded.width,
      height: decoded.height,
    });
    if (inserted.error) {
      await bucket.remove([path]);
      throw new HttpError(
        409,
        "Preparation changed. Please reload before uploading.",
      );
    }
    return {
      id: assetId,
      width: decoded.width,
      height: decoded.height,
      size: clean.length,
    };
  }
  const body = await bodyJson(req);
  if (route === "draft") {
    await limited(`${user.id}:draft`, 30, 3600);
    assert(uuid(body.id), 400, "Invalid preparation ID.");
    plan(body.package);
    const result = await admin.rpc("gcas_draft", {
      p_id: body.id,
      p_owner: user.id,
      p_package: body.package,
      p_version: FORM_VERSION.id,
      p_year: FORM_VERSION.year,
    });
    if (result.error?.code === "42501")
      throw new HttpError(404, "Preparation not found or expired.");
    if (result.error?.code === "54000")
      throw new HttpError(
        409,
        "Your account has 50 active preparations. Delete an unused draft before starting another.",
      );
    const p = check(result);
    return {
      preparation: {
        id: p.id,
        revision: p.revision,
        state: p.state,
        package: p.package,
      },
    };
  }
  if (route === "checkout") {
    assert(
      checkoutReady(),
      503,
      "Checkout is awaiting activation. No payment was taken.",
    );
    assert(uuid(body.id), 400, "Invalid preparation ID.");
    const selected = plan(body.package);
    const contactEmail = checkoutEmail(body.contactEmail, user.email!);
    let p = check(
      await admin
        .from("gcas_preparations")
        .select("*")
        .eq("id", body.id)
        .maybeSingle(),
    );
    if (!p) {
      check(
        await admin.from("gcas_preparations").insert({
          id: body.id,
          owner_id: user.id,
          package: body.package,
          version: FORM_VERSION.id,
          year: FORM_VERSION.year,
        }),
      );
      p = await owned(body.id, user.id);
    }
    assert(
      p.owner_id === user.id &&
        p.package === body.package &&
        p.state !== "deleted",
      409,
      "This preparation has a different owner or package.",
    );
    if (p.state === "paid") return { paid: true };
    assert(
      p.state === "unpaid",
      409,
      "Contact support about this preparation.",
    );
    let order = check(
      await admin
        .from("gcas_orders")
        .select("*")
        .eq("preparation_id", p.id)
        .eq("state", "pending")
        .maybeSingle(),
    );
    if (order?.session_id) {
      const session = await stripe(
        `checkout/sessions/${encodeURIComponent(order.session_id)}`,
      );
      if (session.status === "open") return { url: session.url };
      assert(
        session.status === "expired",
        409,
        "Payment is being verified. Check again shortly.",
      );
      check(
        await admin
          .from("gcas_orders")
          .update({ state: "expired" })
          .eq("id", order.id),
      );
      order = null;
    }
    if (!order) {
      await limited(`${user.id}:checkout`, 5, 3600);
      const insert = await admin
        .from("gcas_orders")
        .insert({ preparation_id: p.id, amount: selected.cents })
        .select()
        .single();
      if (insert.error?.code === "23505")
        order = check(
          await admin
            .from("gcas_orders")
            .select("*")
            .eq("preparation_id", p.id)
            .eq("state", "pending")
            .single(),
        );
      else order = check(insert);
    }
    const link = PAYMENT_LINKS[body.package];
    const query = new URLSearchParams({
      payment_link: link.id,
      limit: "100",
      "created[gte]": String(Math.floor(Date.parse(order.created_at) / 1000)),
    });
    // Payment Links create a hosted session when opened. Find a previous visit
    // before returning the link again, so cancel/back/retry reuses that session.
    let more = true;
    while (more) {
      const page = await stripe("checkout/sessions?" + query);
      const session = page.data.find(
        (s: any) =>
          s.client_reference_id === order.id && s.status !== "expired",
      );
      if (session) {
        assert(
          session.status === "open",
          409,
          "Payment is being verified. Check again shortly.",
        );
        return { url: session.url };
      }
      more = page.has_more && page.data.length > 0;
      if (more) query.set("starting_after", page.data.at(-1).id);
    }
    const url = new URL(link.url);
    url.searchParams.set("client_reference_id", order.id);
    url.searchParams.set("prefilled_email", contactEmail);
    return { url: url.href };
  }
  const p = await owned(body.id, user.id, ["pdf", "email"].includes(route!));
  if (route === "get") return { preparation: p };
  if (route === "submission") {
    assert(
      typeof body.submitted === "boolean",
      400,
      "Choose a submission status.",
    );
    const updated = check(
      await admin
        .from("gcas_preparations")
        .update({
          submission_reported_at: body.submitted
            ? p.submission_reported_at || new Date().toISOString()
            : null,
        })
        .eq("id", p.id)
        .eq("owner_id", user.id)
        .neq("state", "deleted")
        .gt("expires_at", new Date().toISOString())
        .select()
        .maybeSingle(),
    );
    assert(updated, 404, "Preparation not found or expired.");
    return { entry: entryProgress(updated) };
  }
  if (route === "save") {
    const assets = check(
      await admin.from("gcas_assets").select("*").eq("preparation_id", p.id),
    );
    const selectedPackage = body.package ?? p.package;
    const payload = sanitizePayload(body.payload, selectedPackage, assets);
    assert(
      Number.isInteger(body.revision) && body.revision >= 0,
      400,
      "Invalid revision.",
    );
    const result = await admin.rpc("gcas_save", {
      p_id: p.id,
      p_owner: user.id,
      p_revision: body.revision,
      p_payload: payload,
      p_package: selectedPackage,
    });
    if (result.error?.code === "55000")
      throw new HttpError(
        409,
        "This package is locked by a purchase or open checkout. Reopen the preparation to use its saved package.",
      );
    if (result.error?.code === "40001")
      throw new HttpError(
        409,
        "A newer version was saved elsewhere. Reopen it before editing; your current work stays in this tab.",
      );
    return { preparation: check(result) };
  }
  if (route === "asset") {
    const a = check(
      await admin
        .from("gcas_assets")
        .select("*")
        .eq("id", body.asset)
        .eq("preparation_id", p.id)
        .maybeSingle(),
    );
    assert(a, 404, "Image not found.");
    const blob = check(await bucket.download(a.object_path));
    return new Response(blob, {
      headers: { "Content-Type": "image/jpeg", "Cache-Control": "no-store" },
    });
  }
  if (route === "delete") {
    check(await admin.rpc("gcas_delete", { p_id: p.id, p_owner: user.id }));
    let filesPending = false;
    try {
      await flushCleanup();
    } catch {
      filesPending = true;
    }
    return { deleted: true, filesPending };
  }
  if (["pdf", "email"].includes(route!)) {
    assert(
      p.payload.documents.length > 0,
      422,
      "Save your completed worksheet first.",
    );
    p.payload.documents.forEach(requireComplete);
    if (route === "pdf") {
      await limited(`${user.id}:pdf`, 10);
      let bytes;
      try {
        bytes = await makePdf(p.payload.documents, p.package);
      } catch {
        throw new HttpError(
          422,
          "PDF generation could not preserve these characters. Contact support; your saved answers have not changed.",
        );
      }
      return new Response(bytes, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="DV-${p.year}-preparation.pdf"`,
          "Cache-Control": "no-store",
        },
      });
    }
    assert(emailReady(env), 503, "Email delivery is not configured yet.");
    await limited(`${user.id}:email`, 3, 3600);
    const job = check(
      await admin
        .from("gcas_deliveries")
        .insert({ preparation_id: p.id, revision: p.revision })
        .select("id")
        .single(),
    );
    let accepted = false;
    try {
      accepted = await sendReadyEmail(env, user.email, origin);
    } catch {
      // Never return SMTP diagnostics, credentials or recipient details to clients/logs.
    }
    check(
      await admin
        .from("gcas_deliveries")
        .update({
          state: accepted ? "sent" : "failed",
          sent_at: accepted ? new Date().toISOString() : null,
        })
        .eq("id", job.id),
    );
    assert(accepted, 503, "Email was not accepted. Please try again later.");
    return { accepted: true };
  }
  throw new HttpError(404, "Unknown operation.");
}
Deno.serve(async (req: Request) => {
  const url = new URL(req.url),
    requestOrigin = req.headers.get("origin"),
    isWebhook = url.pathname.endsWith("/webhook");
  const headers = {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    Vary: "Origin",
    ...(requestOrigin && origins.has(requestOrigin)
      ? {
          "Access-Control-Allow-Origin": requestOrigin,
          "Access-Control-Allow-Headers":
            "authorization, apikey, content-type, x-client-info",
          "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
          // Reuse only the browser's permission check; all private responses
          // remain no-store and every operation still authenticates the user.
          "Access-Control-Max-Age": "3600",
        }
      : {}),
  };
  if (requestOrigin && !origins.has(requestOrigin) && !isWebhook)
    return new Response("Origin not allowed", { status: 403, headers });
  if (req.method === "OPTIONS")
    return new Response(null, { status: 204, headers });
  try {
    const result = await handle(req, url);
    if (result instanceof Response) {
      Object.entries(headers).forEach(([k, v]) => result.headers.set(k, v));
      return result;
    }
    return Response.json(result, { headers });
  } catch (e) {
    const known = e instanceof HttpError;
    return Response.json(
      {
        error: known
          ? e.message
          : "The service could not complete this request. Please retry.",
      },
      { status: known ? e.status : 500, headers },
    );
  }
});
