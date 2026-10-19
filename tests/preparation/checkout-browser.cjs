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
        locale: "en-US",
        timezoneId: "America/New_York",
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
        ".c2ln";
      let revision = 0;
      let challenge,
        paid = false,
        saved = false,
        pdfCalls = 0,
        checkoutBodies = [];
      let saveMode = "success",
        releaseSave,
        saveCalls = 0,
        lastSavedName;
      let lastSavedAt;
      let expectedEmail = "applicant@example.test",
        expectedPackage = "single";
      const saveIds = new Set();
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
        if (url.pathname.endsWith("/health"))
          return json({
            accounts: true,
            cloudSave: true,
            checkout: true,
            pdfDownload: true,
          });
        if (url.pathname.endsWith("/settings"))
          return json({ external: { google: true } });
        if (url.pathname.endsWith("/draft"))
          return json({
            preparation: {
              revision: 0,
              state: "unpaid",
              package: expectedPackage,
            },
          });
        if (url.pathname.endsWith("/checkout")) {
          assert(saved, "Save completes before checkout");
          const body = request.postDataJSON();
          assert.deepEqual(Object.keys(body).sort(), [
            "contactEmail",
            "id",
            "package",
          ]);
          assert.equal(
            body.contactEmail,
            expectedEmail?.includes("@") ? expectedEmail : user.email,
          );
          assert.equal(body.package, expectedPackage);
          checkoutBodies.push(body);
          const links = {
            couple: "https://buy.stripe.com/28E28t5JI4SH1dt1ic0Ny06",
            family: "https://buy.stripe.com/eVqbJ34FE98X6xN6Cw0Ny07",
          };
          return json({
            url: links[expectedPackage]
              ? links[expectedPackage] +
                "?client_reference_id=" +
                randomUUID() +
                "&prefilled_email=" +
                encodeURIComponent(body.contactEmail)
              : "https://checkout.stripe.com/c/pay/synthetic-local-only",
          });
        }
        if (url.pathname.endsWith("/get"))
          return json({
            preparation: { state: paid ? "paid" : "unpaid", revision },
          });
        if (url.pathname.endsWith("/save")) {
          saveCalls++;
          saveIds.add(request.postDataJSON().id);
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

          assert.equal(
            request.postDataJSON().payload.documents[0].answers[
              "contact.email"
            ],
            expectedEmail,
          );
          saved = true;
          lastSavedAt = new Date(
            Date.UTC(2026, 9, 17, 18, 0, saveCalls),
          ).toISOString();
          return json({
            preparation: {
              revision: ++revision,
              state: paid ? "paid" : "unpaid",
              package: expectedPackage,
              updated_at: lastSavedAt,
            },
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
      await context.route("https://buy.stripe.com/**", (route) =>
        route.fulfill({
          contentType: "text/html",
          body: "<h1>Synthetic existing payment link — no payment</h1>",
        }),
      );
      await context.route(base + "/checkout-test*", (route) =>
        route.fulfill({
          contentType: "text/html",
          body: `<!doctype html><html><head><link rel="stylesheet" href="/assets/preparation/workspace.css?v=20261019-workspace-v38"></head><body><main></main><section id="dialog"></section><p id="status"></p><script type="module">
        import {cloudWorkspace} from '/assets/preparation/cloud.mjs?v=20261019-workspace-v38';
        import {CAPABILITIES, PROVIDERS} from '/assets/preparation/backend.mjs?v=20261019-workspace-v38';
        import {initialDraft} from '/assets/preparation/schema.mjs?v=20261019-workspace-v38';
        import {saveIndicator} from '/assets/preparation/save-feedback.mjs?v=20261019-workspace-v38';
        const indicator=saveIndicator(); document.body.append(indicator.node);
        Object.assign(CAPABILITIES,{accounts:true,checkout:true,cloudSave:true,pdfDownload:true}); PROVIDERS.google=true;
        const scenario=new URLSearchParams(location.search);
        const d=initialDraft(); d.package=scenario.get('package') || 'single'; d.answers={'contact.email':scenario.has('email') ? scenario.get('email') : 'applicant@example.test','entrant.firstName':'SYNTHETIC'};
        if(scenario.has('image')) d.assets['passport.bio']={blob:new Blob(['not an image'],{type:'image/jpeg'}),confirmed:true};
        let cleanup;
        const close=()=>{const fn=cleanup;cleanup=null;fn?.();document.querySelector('#dialog').replaceChildren();};
        const cloud=cloudWorkspace({related:()=>null,saveState:(_records,state)=>indicator.update(state),dialog:(title,node,onClose)=>{close();cleanup=onClose;const heading=document.createElement('h2');heading.textContent=title;document.querySelector('#dialog').replaceChildren(heading,node);},close,status:text=>document.querySelector('#status').textContent=text,saved:()=>{},pdfReady:()=>{document.querySelector('#status').textContent='PDF unlocked';}});
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
      saveMode = "fail";
      await page
        .getByRole("button", { name: "Save progress", exact: true })
        .click();
      await page.getByRole("button", { name: "Continue with Google" }).click();
      await page
        .getByText("Synthetic save failure. Please retry.", { exact: true })
        .waitFor();
      assert.equal(
        saved,
        false,
        "A failed first save is never reported as saved",
      );
      assert.equal(checkoutBodies.length, 0);
      await page
        .getByRole("button", { name: "Close checkout", exact: true })
        .click();
      saveMode = "success";
      await page
        .getByRole("button", { name: "Save progress", exact: true })
        .click();
      await page
        .getByRole("heading", { name: "Progress saved", exact: true })
        .waitFor();
      assert.equal(
        checkoutBodies.length,
        0,
        "Saving does not automatically start a payment",
      );
      assert.equal(saved, true);
      assert(
        await page
          .getByRole("button", { name: "Pay now · $9.99", exact: true })
          .isEnabled(),
      );
      await page
        .getByRole("button", { name: "Continue and pay later", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Save progress", exact: true })
        .click();
      await page
        .getByRole("heading", { name: "Progress saved", exact: true })
        .waitFor();
      await page
        .getByRole("button", { name: "Pay now · $9.99", exact: true })
        .click();
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
      assert.equal(saved, true);
      await page
        .getByRole("button", { name: "Check payment", exact: true })
        .click();
      await page.getByText(/Payment has not been confirmed/).waitFor();
      assert.equal(saved, true);
      assert.equal(pdfCalls, 0);
      await page
        .getByRole("button", { name: "Close checkout", exact: true })
        .click();
      // Incomplete signed-in worksheets get a brief notice, never a validation gate.
      await page
        .getByRole("button", { name: "Save & receive PDF", exact: true })
        .click();
      await page.locator(".checkout-incomplete").waitFor();
      assert.equal(
        checkoutBodies.length,
        1,
        "Notice precedes checkout for unfinished fields",
      );
      assert.equal(
        await page
          .getByRole("button", { name: "Check payment", exact: true })
          .isVisible(),
        false,
      );
      await page
        .getByRole("button", { name: "Continue to Stripe · $9.99" })
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
        .getByRole("button", { name: "Check payment", exact: true })
        .click();
      await page.getByText("PDF unlocked", { exact: true }).waitFor();
      assert(saved);
      await page.getByRole("button", { name: "Try PDF", exact: true }).click();
      await page
        .getByText("%PDF-synthetic-local-test", { exact: true })
        .waitFor();
      assert.equal(pdfCalls, 1);
      await page.getByRole("button", { name: "Try PDF", exact: true }).click();
      await page.waitForFunction(
        () =>
          document.querySelector("#status").textContent ===
          "%PDF-synthetic-local-test",
      );
      assert.equal(pdfCalls, 2, "Paid preparations support repeat downloads");
      assert.equal(
        checkoutBodies.length,
        2,
        "Repeat downloads never start another payment",
      );
      // A manual save acknowledges the server response, including edits made
      // while the preceding request was still in flight. It never reauthenticates.
      await page
        .getByRole("button", { name: "Close checkout", exact: true })
        .click();
      // Autosave and a repeated manual click share one in-flight request.
      saveMode = "hold";
      const callsBeforeAuto = saveCalls;
      await page
        .getByRole("button", { name: "Edit answers", exact: true })
        .click();
      await page.getByText("Saving…", { exact: true }).waitFor();
      await page.locator('.save-feedback [role="progressbar"]').waitFor();
      for (let n = 0; !releaseSave && n < 200; n++)
        await new Promise((r) => setTimeout(r, 20));
      assert(releaseSave);
      await page
        .getByRole("button", { name: "Save progress", exact: true })
        .evaluate((button) => {
          button.click();
          const bar = document.querySelector('#dialog [role="progressbar"]');
          button.click();
          window.sameSavingBar =
            bar === document.querySelector('#dialog [role="progressbar"]');
        });
      await page
        .getByRole("heading", { name: "Saving progress", exact: true })
        .waitFor();
      assert.equal(saveCalls, callsBeforeAuto + 1);
      assert.equal(
        await page.evaluate(() => window.sameSavingBar),
        true,
        "Repeated clicks keep one continuous indicator",
      );
      assert.equal(
        await page
          .locator('#dialog [role="progressbar"]')
          .getAttribute("aria-valuenow"),
        null,
      );
      const previousTime = await page
        .locator(".save-feedback time")
        .getAttribute("datetime");
      assert.equal(
        previousTime,
        lastSavedAt,
        "Pending requests retain the last confirmed timestamp",
      );
      saveMode = "success";
      releaseSave();
      releaseSave = null;
      await page
        .getByRole("heading", { name: "Progress saved", exact: true })
        .waitFor();
      assert.equal(
        saveCalls,
        callsBeforeAuto + 1,
        "Manual save joins autosave without a second write",
      );
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
      assert.equal(
        await page.locator(".save-feedback time").getAttribute("datetime"),
        lastSavedAt,
      );
      assert.match(
        await page.locator(".save-feedback time").innerText(),
        /Oct 17, 2026(?:,| at) 2:00:\d{2} PM/,
      );
      assert.equal(
        await page.locator('.save-feedback [role="progressbar"]').isVisible(),
        false,
      );
      assert.equal(
        saveIds.size,
        1,
        "Saves update the same preparation rather than creating dated copies",
      );
      assert.match(
        await page.locator("#dialog").innerText(),
        /saved to account@example.test/,
      );
      await page
        .getByRole("button", { name: "Close checkout", exact: true })
        .click();
      const lastSuccess = lastSavedAt;
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
      assert.equal(
        await page.locator(".save-feedback time").getAttribute("datetime"),
        lastSuccess,
      );
      assert.equal(
        await page.locator('.save-feedback [role="progressbar"]').isVisible(),
        false,
      );
      assert.deepEqual(errors, []);
      // Empty/partial contact fields and failed image conversion cannot block payment.
      for (const [plan, amount, email] of [
        ["couple", "$19.99", "partial"],
        ["family", "$29.99", ""],
      ]) {
        saveMode = "success";
        expectedPackage = plan;
        expectedEmail = email;
        paid = false;
        const partial = await context.newPage();
        partial.on("pageerror", (e) => errors.push(e.message));
        await partial.goto(
          base +
            "/checkout-test?package=" +
            plan +
            "&email=" +
            email +
            "&image=1",
        );
        await partial
          .getByRole("button", { name: "Save progress", exact: true })
          .click();
        await partial
          .getByRole("heading", {
            name: "Answers saved — images need attention",
            exact: true,
          })
          .waitFor();
        await partial
          .getByRole("button", { name: "Pay now · " + amount, exact: true })
          .click();
        await partial.locator(".checkout-incomplete").waitFor();
        await partial
          .getByText(
            "Some photos still need saving. Your answers are saved; you can pay now and retry the photos later.",
            { exact: true },
          )
          .waitFor();
        await partial
          .getByText("Receipt email: " + user.email + ".", { exact: true })
          .waitFor();
        const count = checkoutBodies.length;
        await partial
          .getByRole("button", {
            name: "Continue to Stripe · " + amount,
            exact: true,
          })
          .click();
        await partial.getByText(/Complete payment in the Stripe tab/).waitFor();
        assert.equal(checkoutBodies.length, count + 1);
        await partial.close();
      }
      expectedPackage = "single";
      expectedEmail = undefined;
      paid = false;
      const review = await context.newPage();
      review.on("pageerror", (e) => errors.push(e.message));
      await review.goto(base + "/prepare.html#review");
      await review
        .getByRole("button", { name: "Pay now · $9.99", exact: true })
        .click();
      await review.locator(".checkout-incomplete").waitFor();
      const count = checkoutBodies.length;
      await review.screenshot({
        path: "/tmp/gcas-v35-incomplete-checkout-" + engine + ".png",
      });
      await review
        .getByRole("button", {
          name: "Continue to Stripe · $9.99",
          exact: true,
        })
        .click();
      await review.getByText(/Complete payment in the Stripe tab/).waitFor();
      assert.equal(
        checkoutBodies.length,
        count + 1,
        "Real review screen allows incomplete checkout",
      );
      paid = true;
      await review
        .getByRole("button", { name: "Check payment", exact: true })
        .click();
      await review
        .getByRole("heading", { name: "Payment confirmed", exact: true })
        .waitFor();
      assert.equal(
        new URL(review.url()).hash,
        "#document",
        "Early payment returns to editing, not an incomplete PDF error",
      );
      await review
        .getByRole("button", { name: "Continue preparation", exact: true })
        .click();
      await review.close();
      assert.deepEqual(errors, []);
      console.log(
        engine +
          ": free save before optional checkout, pay later, form-email prefill, cancellation recovery, paid-only PDF and verified-payment delivery passed (synthetic provider).",
      );
    } finally {
      await browser.close();
    }
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
