// Real local OCR and mocked delivery only. Never supply customer documents here.
const assert = require('node:assert/strict');
const { chromium, webkit, firefox } = require('playwright');
const engines = { chromium, webkit, firefox };
const base = new URL(process.env.MOBILE_BASE_URL || 'https://127.0.0.1:8443');
assert(['127.0.0.1','localhost'].includes(base.hostname));
(async () => {
  for (const engine of (process.env.MOBILE_ENGINES || 'chromium,webkit,firefox').split(',')) {
    const browser = await engines[engine].launch({headless:true});
    try {
      const context = await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:390,height:844}});
      const page = await context.newPage();
      const errors = [], submissions = [];
      let delivered; const delivery = new Promise(resolve => { delivered = resolve; });
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/*', route => {
        const request = route.request(), url = new URL(request.url());
        if (url.origin === base.origin) return route.continue();
        if (url.hostname === 'script.google.com' && request.method() === 'POST') {
          submissions.push(JSON.parse(request.postData())); delivered();
          return route.fulfill({status:200,body:JSON.stringify({ok:true})});
        }
        return route.abort();
      });
      await page.goto(base.href);
      await page.getByRole('button',{name:'Reject nonessential',exact:true}).click();
      // Generate a fictional document in memory; no actual passport fixture.
      const png = Buffer.from(await page.evaluate(() => {
        const canvas = document.createElement('canvas');canvas.width=1800;canvas.height=1100;
        const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,1800,1100);ctx.fillStyle='black';ctx.font='38px monospace';
        ['SYNTHETIC TEST DOCUMENT','SURNAME: EXAMPLE','GIVEN NAMES: JANE ANNA','PLACE OF BIRTH: BERLIN, GERMANY','','P<UTOEXAMPLE<<JANE<ANNA<<<<<<<<<<<<<<<<<<<<<<'].forEach((text,i)=>ctx.fillText(text,40,80+i*150));
        return canvas.toDataURL('image/png').split(',')[1];
      }), 'base64');
      const scan = async () => {
        await page.locator('[data-passport-toggle]').click();
        await page.locator('#passportUpload').setInputFiles({name:'synthetic-passport.png',mimeType:'image/png',buffer:png});
        await page.locator('[data-passport-apply]').waitFor({state:'visible',timeout:90000});
        assert.equal(await page.locator('[data-passport-field="firstName"]').inputValue(),'JANE ANNA');
        assert.equal(await page.locator('[data-passport-field="lastName"]').inputValue(),'EXAMPLE');
        assert.equal(await page.locator('[data-passport-field="country"]').inputValue(),'Germany');
      };
      const fileCount = () => page.locator('#identityDocuments').evaluate(input => input.files.length);
      await scan();
      assert.equal(await page.locator('[name="firstName"]').inputValue(),'');
      assert.equal(await fileCount(),0);
      assert.equal(submissions.length,0);
      await page.locator('[data-passport-details-only]').click();
      assert.equal(await fileCount(),0,'Details-only must not attach a passport');
      await page.locator('#identityDocuments').setInputFiles({name:'other.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4 synthetic')});
      await scan();
      await page.locator('[data-passport-apply]').click();
      assert.equal(await fileCount(),2,'Explicit attach preserves existing documents');
      assert(await page.locator('[data-passport-attachment]').isVisible());
      assert.equal(submissions.length,0,'Attaching is not permission to submit');
      await page.locator('[data-passport-remove]').click();
      assert.equal(await fileCount(),1,'Remove must preserve unrelated files');
      await scan();
      await page.locator('[data-passport-apply]').click();
      await page.locator('[name="email"]').fill('passport-regression@example.test');
      await page.locator('[name="phone"]').fill('+12025550123');
      await page.locator('[name="checkoutConsent"]').check();
      const sent = page.waitForRequest(request => request.url().includes('script.google.com') && request.method()==='POST');
      await page.locator('#applicationSubmit').click();await sent;await delivery;
      assert.equal(submissions.length,1);
      const photo = submissions[0].files.find(file => file.name==='passport-scan.jpg');
      assert(photo,'JPEG must be included in the existing Apps Script files payload');
      assert.equal(photo.mimeType,'image/jpeg');
      assert.deepEqual([...Buffer.from(photo.base64,'base64').subarray(0,3)],[255,216,255]);
      assert.deepEqual(errors,[]);
      console.log(`${engine}: real synthetic OCR, details-only, attach/remove, and consented mocked photo delivery passed.`);
    } finally { await browser.close(); }
  }
})().catch(error => {console.error(error);process.exitCode=1;});
