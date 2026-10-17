import {
  FORM_VERSION,
  PACKAGES,
  fields,
  storedFields,
  initialDraft,
  progress,
  checkoutEmail as receiptEmail,
} from "../../../assets/preparation/schema.mjs";
import { COUNTRIES } from "../../../assets/preparation/countries.mjs";
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export const assert = (ok, status, message) => {
  if (!ok) throw new HttpError(status, message);
};
export const uuid = (value) =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
export function plan(key) {
  assert(
    Object.hasOwn(PACKAGES, key) && !PACKAGES[key].disabled,
    400,
    "Choose Single, Couple, or Family.",
  );
  return PACKAGES[key];
}
// Checkout contact information never grants access to a preparation. Ownership
// and all delivery links remain tied to the authenticated, verified account.
export function checkoutEmail(value, verifiedEmail) {
  return receiptEmail(value, verifiedEmail);
}
export function sanitizePayload(input, pack, storedAssets = []) {
  plan(pack);
  assert(
    input &&
      Array.isArray(input.documents) &&
      input.documents.length > 0 &&
      input.documents.length <= (pack === "single" ? 1 : 2),
    400,
    "This package supports a different number of principal worksheets.",
  );
  const ids = new Set();
  return {
    documents: input.documents.map((raw) => {
      assert(
        uuid(raw.id) && !ids.has(raw.id),
        400,
        "Invalid or duplicate worksheet ID.",
      );
      ids.add(raw.id);
      assert(
        raw.version === FORM_VERSION.id && raw.year === FORM_VERSION.year,
        409,
        "This worksheet version needs review.",
      );
      assert(
        Array.isArray(raw.childIds) &&
          raw.childIds.length <= 100 &&
          raw.childIds.every(uuid) &&
          new Set(raw.childIds).size === raw.childIds.length,
        400,
        "Invalid child records.",
      );
      assert(
        raw.answers &&
          typeof raw.answers === "object" &&
          !Array.isArray(raw.answers),
        400,
        "Invalid answers.",
      );
      const d = {
        ...initialDraft(),
        id: raw.id,
        package: pack,
        childIds: [...raw.childIds],
        secondEntry: !!raw.secondEntry,
      };
      const answers = Object.entries(raw.answers);
      assert(answers.length <= 2000, 413, "Too many fields.");
      for (const [key, value] of answers) {
        assert(
          /^[a-zA-Z0-9.-]{1,120}$/.test(key) &&
            !["__proto__", "constructor", "prototype"].includes(key),
          400,
          "Invalid field.",
        );
        assert(
          typeof value === "boolean" ||
            (typeof value === "string" && value.length <= 1500),
          400,
          "Invalid answer value.",
        );
        d.answers[key] = value;
      }
      // Build conditional fields from answers, then retain only schema-defined values.
      const allowed = new Set(
        storedFields(d).flatMap((f) => [f.id, f.exception].filter(Boolean)),
      );
      for (const key of Object.keys(d.answers))
        if (!allowed.has(key)) delete d.answers[key];
      for (const f of storedFields(d)) {
        const value = d.answers[f.id];
        if (f.exception && d.answers[f.exception] !== undefined)
          assert(
            typeof d.answers[f.exception] === "boolean",
            400,
            "Invalid name exception.",
          );
        if (value !== undefined)
          assert(
            f.type === "checkbox"
              ? typeof value === "boolean"
              : typeof value === "string",
            400,
            "Invalid field type.",
          );
        if (typeof value === "string")
          assert(
            value.length <= (f.maxLength || 1000),
            400,
            `Field exceeds its length limit: ${f.label}`,
          );
        if (["photo", "passportPhoto"].includes(f.type) && raw.assets?.[f.id]) {
          const asset = raw.assets[f.id];
          const a = storedAssets.find(
            (a) =>
              a.id === asset.id &&
              a.document_id === raw.id &&
              a.field_id === f.id,
          );
          assert(a, 400, "An uploaded file does not belong to this worksheet.");
          d.assets[f.id] = {
            id: a.id,
            status: "valid",
            confirmed: asset.confirmed === true,
            width: a.width,
            height: a.height,
            size: a.bytes,
          };
        }
      }
      return d;
    }),
  };
}
export function requireComplete(d) {
  assert(
    progress(
      d,
      COUNTRIES.map((c) => c.name),
    ).remaining.length === 0,
    422,
    "Complete and review every required item before downloading or emailing.",
  );
}
export async function verifyStripeSignature(
  raw,
  header,
  secret,
  now = Date.now(),
) {
  assert(secret && header, 400, "Missing webhook signature.");
  const entries = header.split(",").map((v) => v.trim().split("="));
  const stamp = entries.find((v) => v[0] === "t")?.[1];
  assert(
    /^\d+$/.test(stamp || "") && Math.abs(now / 1000 - Number(stamp)) <= 300,
    400,
    "Expired webhook signature.",
  );
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(`${stamp}.${raw}`),
    ),
  );
  const expected = Array.from(signed, (x) =>
    x.toString(16).padStart(2, "0"),
  ).join("");
  assert(
    entries.some(([k, v]) => {
      if (k !== "v1" || v?.length !== 64) return false;
      let diff = 0;
      for (let i = 0; i < 64; i++)
        diff |= expected.charCodeAt(i) ^ v.charCodeAt(i);
      return diff === 0;
    }),
    400,
    "Invalid webhook signature.",
  );
  return JSON.parse(raw);
}
