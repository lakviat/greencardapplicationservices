// Local-only synthetic OAuth + Stripe responses. No payment or applicant data
// leaves this test. Real paid-PDF authorization is exercised by backend tests.
const { chromium, webkit, firefox } = require("playwright");
const { randomUUID, createHash } = require("node:crypto");
const assert = require("node:assert/strict");
const base = process.env.PREP_BASE_URL || "https://127.0.0.1:8444";
assert.equal(new URL(base).hostname, "127.0.0.1");
const project = "https://wofazcvfvazfkvujwwcw.supabase.co";
(async () => {
  for (const engine of (
    process.env.PREP_ENGINES || "chromium,webkit,firefox"
  ).split(",")) {
    const browser = await { chromium, webkit, firefox }[engine].launch();
    try {
      const context = await browser.newContext({
        ignoreHTTPSErrors: true,
        viewport: { width: 390, height: 844 },
      });
      const user = {
        id: randomUUID(),
        email: "account@example.test",
        email_confirmed_at: new Date().toISOString(),
        app_metadata: { provider: "google" },
        user_metadata: {},
      };
      const token =
        "e30." +
        Buffer.from(
          JSON.stringify({
            sub: user.id,
            exp: Math.floor(Date.now() / 1000) + 3600,
          }),
        ).toString("base64url") +
        ".synthetic";
      let challenge,
        paid = false,
        saved = false,
        pdfCalls = 0,
        checkoutBodies = [];
      let saveMode = "success",
        releaseSave,
        saveCalls = 0,
        lastSavedName;
      await context.route(`${project}/**`, async (route) => {
        const request = route.request(),
          url = new URL(request.url());
        const json = (value) => route.fulfill({ json: value });
        if (url.pathname.endsWith("/authorize")) {
          challenge = url.searchParams.get("code_challenge");
          const redirect = new URL(url.searchParams.get("redirect_to"));
          redirect.searchParams.set("code", "test-code");
          return route.fulfill({
            contentType: "text/html",
            body:
              "<script>location.replace(" +
              JSON.stringify(redirect.href) +
              ")</script>",
          });
        }
        if (url.pathname.endsWith("/token")) {
          assert.equal(
            createHash("sha256")
              .update(request.postDataJSON().code_verifier)
              .digest("base64url"),
            challenge,
          );
          return json({
            access_token: token,
            refresh_token: "synthetic",
            expires_in: 3600,
            token_type: "bearer",
            user,
          });
        }
        if (url.pathname.endsWith("/user")) return json(user);
        if (url.pathname.endsWith("/checkout")) {
          const body = request.postDataJSON();
          assert.deepEqual(Object.keys(body).sort(), [
            "contactEmail",
            "id",
            "package",
          ]);
          assert.equal(body.contactEmail, "applicant@example.test");
          assert.equal(body.package, "single");
          checkoutBodies.push(body);
          return json({
            url: "https://checkout.stripe.com/c/pay/synthetic-local-only",
          });
        }
        if (url.pathname.endsWith("/get"))
          return json({
            preparation: { state: paid ? "paid" : "unpaid", revision: 0 },
          });
        if (url.pathname.endsWith("/save")) {
          saveCalls++;
          lastSavedName =
            request.postDataJSON().payload.documents[0].answers[
              "entrant.firstName"
            ];
          if (saveMode === "hold")
            await new Promise((resolve) => {
              releaseSave = resolve;
            });
          if (saveMode === "fail")
            return route.fulfill({
              status: 500,
              json: { error: "Synthetic save failure. Please retry." },
            });
          assert(paid, "No answers uploaded before verified payment");
          assert.equal(
            request.postDataJSON().payload.documents[0].answers[
              "contact.email"
            ],
            "applicant@example.test",
          );
          saved = true;
          return json({
            preparation: { revision: 1, updated_at: new Date().toISOString() },
          });
        }
        if (url.pathname.endsWith("/pdf")) {
          assert(paid && saved);
          pdfCalls++;
          return route.fulfill({
            contentType: "application/pdf",
            body: Buffer.from("%PDF-synthetic-local-test"),
          });
        }
        throw new Error("Unexpected remote request: " + url.pathname);
      });
      await context.route("https://checkout.stripe.com/**", (route) =>
        route.fulfill({
          contentType: "text/html",
          body: "<h1>Synthetic checkout — no payment</h1>",
        }),
      );
      await context.route(base + "/checkout-test", (route) =>
        route.fulfill({
          contentType: "text/html",
          body: `<!doctype html><html><body><main></main><section id="dialog"></section><p id="status"></p><script type="module">
        import {cloudWorkspace} from '/assets/preparation/cloud.mjs?v=20261017-workspace-v25';
        import {CAPABILITIES, PROVIDERS} from '/assets/preparation/backend.mjs?v=20261017-workspace-v25';
        import {initialDraft} from '/assets/preparation/schema.mjs?v=20261017-workspace-v25';
        Object.assign(CAPABILITIES,{accounts:true,checkout:true,cloudSave:true,pdfDownload:true}); PROVIDERS.google=true;
        const d=initialDraft(); d.answers={'preparation.consent':true,'contact.email':'applicant@example.test','entrant.firstName':'SYNTHETIC'};
        let cleanup;
        const close=()=>{const fn=cleanup;cleanup=null;fn?.();document.querySelector('#dialog').replaceChildren();};
        const cloud=cloudWorkspace({related:()=>null,dialog:(title,node,onClose)=>{close();cleanup=onClose;const heading=document.createElement('h2');heading.textContent=title;document.querySelector('#dialog').replaceChildren(heading,node);},close,status:text=>document.querySelector('#status').textContent=text,saved:()=>{},pdfReady:()=>{document.querySelector('#status').textContent='PDF unlocked';}});
        const add=(label,action)=>{const b=document.createElement('button');b.textContent=label;b.onclick=action;document.querySelector('main').append(b);};
        add('Save & receive PDF',()=>cloud.receivePdf(d));
        add('Try PDF',async()=>{try{const blob=await cloud.pdf(d);document.querySelector('#status').textContent=await blob.text();}catch(e){document.querySelector('#status').textContent=e.message;}});
        add('Close checkout',close);
        add('Save progress',()=>cloud.save(d));
        add('Edit answers',()=>{ d.answers['entrant.firstName']='UPDATED'; cloud.changed(d); });
      </script></body></html>`,
        }),
      );
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(base + "/checkout-test");
      await page.getByRole("button", { name: "Try PDF", exact: true }).click();
      await page
        .getByText("Purchase this preparation to unlock the complete PDF.", {
          exact: true,
        })
        .waitFor();
      assert.equal(pdfCalls, 0);
      await page
        .getByRole("button", { name: "Save & receive PDF", exact: true })
        .click();
      await page.getByRole("button", { name: "Continue with Google" }).click();
      // Popup policies after OAuth vary: the visible retry remains usable.
      await page
        .getByRole("button", { name: "Continue to Stripe · $9.99" })
        .waitFor();
      await page.waitForTimeout(250);
      if (!checkoutBodies.length)
        await page
          .getByRole("button", { name: "Continue to Stripe · $9.99" })
          .click();
      await page.getByText(/Complete payment in the Stripe tab/).waitFor();
      assert.equal(checkoutBodies.length, 1);
      assert.equal(saved, false);
      await page
        .getByRole("button", { name: "Check payment & save", exact: true })
        .click();
      await page.getByText(/Payment has not been confirmed/).waitFor();
      assert.equal(saved, false);
      assert.equal(pdfCalls, 0);
      await page
        .getByRole("button", { name: "Close checkout", exact: true })
        .click();
      // Now signed in: one click opens checkout without another confirmation.
      await page
        .getByRole("button", { name: "Save & receive PDF", exact: true })
        .click();
      await page.getByText(/Complete payment in the Stripe tab/).waitFor();
      assert.equal(checkoutBodies.length, 2);
      assert.equal(
        checkoutBodies[0].id,
        checkoutBodies[1].id,
        "Cancelled checkout reuses its preparation",
      );
      paid = true; // Test-only server fixture, never a browser success URL.
      await page
        .getByRole("button", { name: "Check payment & save", exact: true })
        .click();
      await page.getByText("PDF unlocked", { exact: true }).waitFor();
      assert(saved);
      await page.getByRole("button", { name: "Try PDF", exact: true }).click();
      await page
        .getByText("%PDF-synthetic-local-test", { exact: true })
        .waitFor();
      assert.equal(pdfCalls, 1);
      // A manual save acknowledges the server response, including edits made
      // while the preceding request was still in flight. It never reauthenticates.
      await page
        .getByRole("button", { name: "Close checkout", exact: true })
        .click();
      saveMode = "hold";
      await page
        .getByRole("button", { name: "Save progress", exact: true })
        .click();
      await page.getByText("Saving…", { exact: true }).waitFor();
      assert.equal(
        await page
          .getByRole("heading", { name: "Progress saved", exact: true })
          .count(),
        0,
      );
      await page
        .getByRole("button", { name: "Edit answers", exact: true })
        .click();
      for (let n = 0; !releaseSave && n < 200; n++)
        await new Promise((r) => setTimeout(r, 20));
      assert(releaseSave);
      saveMode = "success";
      releaseSave();
      await page
        .getByRole("heading", { name: "Progress saved", exact: true })
        .waitFor();
      assert.equal(lastSavedName, "UPDATED");
      assert.match(
        await page.locator("#dialog").innerText(),
        /saved to account@example.test/,
      );
      await page
        .getByRole("button", { name: "Close checkout", exact: true })
        .click();
      saveMode = "fail";
      await page
        .getByRole("button", { name: "Save progress", exact: true })
        .click();
      await page
        .getByText("Synthetic save failure. Please retry.", { exact: true })
        .waitFor();
      assert.equal(
        await page
          .getByRole("heading", { name: "Progress saved", exact: true })
          .count(),
        0,
      );
      assert.match(await page.locator("#status").innerText(), /^Not saved:/);
      assert.deepEqual(errors, []);
      console.log(
        engine +
          ": direct checkout, form-email prefill, cancellation recovery, no prepayment uploads/PDF and verified-payment delivery passed (synthetic provider).",
      );
    } finally {
      await browser.close();
    }
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
