/* OCR runs on-device. A photo is attached only through the explicit review
 * action, then sent with the normal application submission. No OCR text is sent. */
(() => {
  "use strict";
  const normalize = (value) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z ]/g, " ").replace(/\s+/g, " ").trim();
  const cleanName = (value) => normalize(value.replace(/<+/g, " ")).slice(0, 100);
  const distance = (a, b) => {
    let row = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 0; i < a.length; i += 1) {
      const next = [i + 1];
      for (let j = 0; j < b.length; j += 1) next.push(Math.min(next[j] + 1, row[j + 1] + 1, row[j] + (a[i] !== b[j])));
      row = next;
    }
    return row[b.length];
  };
  const ocrLines = (blocks) => blocks.flatMap((block) => (block.paragraphs || []).flatMap((paragraph) => paragraph.lines || []));

  function parsePassport(text, countries = [], blocks = []) {
    const lines = text.toUpperCase().split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    let firstName = "", lastName = "", middleName = "";
    // The TD3 first row contains names, not country of birth. Ignore issuer and
    // nationality codes. Never expose document numbers or the second MRZ row.
    const mrz = lines.map((line) => line.replace(/[«]/g, "<<").replace(/[‹]/g, "<").replace(/\s/g, "")).find((line) => /^P[A-Z<][A-Z<]{3}[A-Z<]+<<[A-Z<]+$/.test(line) && line.length >= 25);
    if (mrz) {
      const separator = mrz.indexOf("<<", 5);
      const given = mrz.slice(separator + 2).split(/<+/).filter(Boolean);
      const noise = given.findIndex((part) => /^[KL]{4,}$/.test(part));
      if (noise >= 0) {
        given.splice(noise);
        // Isolated K/L between padding delimiters are common misread chevrons.
        while (given.length > 1 && /^[KL]$/.test(given.at(-1))) given.pop();
      }
      lastName = cleanName(mrz.slice(5, separator));
      firstName = cleanName(given.join(" "));
      // Do not guess where unseparated garbage ends and a real name begins.
      if (/[KL]{5,}/.test(firstName)) firstName = "";
    }
    const readLabel = (pattern) => {
      for (let i = 0; i < lines.length; i += 1) {
        const match = lines[i].match(pattern);
        if (!match) continue;
        const inline = match[1].replace(/^[\s:/'"“”\-]+|[\s:/'"“”\-]+$/g, "");
        const candidate = inline || lines[i + 1] || "";
        if (/\d|PASSPORT|NATIONALITY|BIRTH|DATE|SEX|GIVEN|SURNAME|AUTHORITY|EXPIR/.test(candidate)) continue;
        const value = cleanName(candidate);
        if (value.length >= 2 && !/[KL]{5,}/.test(value)) return value;
      }
      return "";
    };
    const printedLast = readLabel(/\b(?:SURNAME|LAST NAME|FAMILY NAME|NOM DE FAMILLE|APELLIDOS?)\b\s*[:/\-]?\s*(.*)$/);
    const printedFirst = readLabel(/\b(?:GIVEN NAMES?|G[IL]?EN NAMES?|FIRST NAME|PRENOMS?|NOMBRES?)\b\s*[:/\-]?\s*(.*)$/);
    // Machine-readable spelling wins when available. Clear printed labels fill
    // gaps and can correct one extra trailing filler letter in the MRZ.
    if (!lastName) lastName = printedLast;
    if (!firstName || (printedFirst && firstName.length === printedFirst.length + 1 && /^[KL]$/.test(firstName.at(-1)) && firstName.startsWith(printedFirst))) firstName = printedFirst;
    middleName = readLabel(/\bMIDDLE NAME\b\s*[:/\-]?\s*(.*)$/);
    const aliases = new Map(countries.map((country) => [normalize(country), country]));
    for (const [alias, country] of [["KYRGYZ REPUBLIC", "Kyrgyzstan"], ["THE KYRGYZ REPUBLIC", "Kyrgyzstan"], ["TURKIYE", "Turkey"], ["RUSSIAN FEDERATION", "Russia"]]) {
      if (countries.includes(country)) aliases.set(alias, country);
    }
    const matchCountry = (value) => {
      const normalized = normalize(value);
      const matches = new Set();
      for (const [alias, country] of aliases) {
        if (` ${normalized} `.includes(` ${alias} `) || normalized.replace(/ /g, "") === alias.replace(/ /g, "")) matches.add(country);
      }
      return matches.size === 1 ? [...matches][0] : "";
    };
    let country = "";
    for (let i = 0; i < lines.length; i += 1) {
      const match = lines[i].match(/\b(?:PLACE OF BIRTH|COUNTRY OF BIRTH|BIRTH PLACE|LIEU DE NAISSANCE|GEBURTSORT|LUGAR DE NACIMIENTO)\b\s*[:/\-]?\s*(.*)$/);
      if (match) country = matchCountry(match[1] || lines[i + 1] || "") || country;
    }
    // Multilingual documents often place labels beside other columns. Use word
    // positions to restrict a fuzzy birth label to the value directly below it.
    const structured = ocrLines(blocks);
    const foundCountries = new Set();
    for (const line of structured) {
      const words = line.words || [];
      for (let i = 0; i + 2 < words.length; i += 1) {
        const [a, b, c] = words.slice(i, i + 3).map((word) => normalize(word.text));
        const birthLabel = (a.startsWith("P") && distance(a, "PLACE") <= 3) || (a.startsWith("CO") && distance(a, "COUNTRY") <= 2);
        if (b !== "OF" || !birthLabel || distance(c, "BIRTH") > 3) continue;
        const box = words[i].bbox;
        const end = words[i + 2].bbox;
        const height = Math.max(12, end.y1 - box.y0);
        for (const valueLine of structured) {
          const region = (valueLine.words || []).filter((word) => word.bbox.x0 >= box.x0 - height && word.bbox.x0 < box.x0 + height * 13 && word.bbox.y0 >= box.y0 - height * 0.15 && word.bbox.y0 < end.y1 + height * 2.3);
          const found = matchCountry(region.map((word) => word.text).join(" "));
          if (found) foundCountries.add(found);
        }
      }
    }
    if (!country && foundCountries.size === 1) country = [...foundCountries][0];
    return { firstName, lastName, middleName, country };
  }
  window.gcasPassport = { parsePassport };
  const root = document.querySelector("[data-passport-autofill]");
  if (!root) return;
  const form = document.querySelector("#intakeForm");
  const toggle = root.querySelector("[data-passport-toggle]");
  const panel = root.querySelector("[data-passport-panel]");
  const status = root.querySelector("[data-passport-status]");
  const review = root.querySelector("[data-passport-review]");
  const countrySelect = form.querySelector('select[name="country"]');
  const countries = Array.from(countrySelect.options).map((option) => option.value).filter(Boolean);
  const fields = Object.fromEntries(["firstName", "lastName", "middleName", "country"].map((key) => [key, root.querySelector(`[data-passport-field="${key}"]`)]));
  for (const country of countries) fields.country.add(new Option(country, country));
  const inputs = root.querySelectorAll('input[type="file"]');
  let busy = false;
  let worker = null;
  let imageDecoder = null;
  let decoderReject = null;
  let pendingPhoto = null;
  let attachedPhoto = null;
  let libraryPromise;
  let operation = 0;
  const setStatus = (message) => { status.textContent = message; };
  const resetReview = () => {
    review.hidden = true;
    pendingPhoto = null;
    Object.values(fields).forEach((field) => { field.value = ""; });
  };
  const stop = () => {
    operation += 1;
    if (decoderReject) decoderReject(new Error("cancelled"));
    if (imageDecoder) { imageDecoder.terminate(); imageDecoder = null; decoderReject = null; }
    if (worker) { worker.terminate().catch(() => {}); worker = null; }
    busy = false;
    root.querySelectorAll("[data-passport-pick]").forEach((button) => { button.disabled = false; });
    inputs.forEach((input) => { input.value = ""; });
  };
  const loadLibrary = () => {
    if (window.Tesseract) return Promise.resolve(window.Tesseract);
    if (!libraryPromise) libraryPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "vendor/passport-ocr/tesseract.min.js";
      script.onload = () => resolve(window.Tesseract);
      script.onerror = () => { script.remove(); libraryPromise = null; reject(new Error("load")); };
      document.head.append(script);
    });
    return libraryPromise;
  };
  toggle.addEventListener("click", () => {
    panel.hidden = !panel.hidden;
    toggle.setAttribute("aria-expanded", String(!panel.hidden));
    if (panel.hidden) { stop(); resetReview(); setStatus(""); }
  });
  root.querySelector("[data-passport-cancel]").addEventListener("click", () => {
    stop(); resetReview(); setStatus(""); panel.hidden = true;
    toggle.setAttribute("aria-expanded", "false"); toggle.focus();
  });
  root.querySelectorAll("[data-passport-pick]").forEach((button) => {
    button.addEventListener("click", () => root.querySelector(`#${button.dataset.passportPick}`).click());
  });
  panel.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && event.target.matches("input, select")) event.preventDefault();
  });
  const decodeHeic = async (file) => {
    const decoder = new Worker(new URL("vendor/heic/worker.js", window.location.href));
    imageDecoder = decoder;
    const token = operation;
    try {
      const buffer = await file.arrayBuffer();
      if (token !== operation) throw new Error("cancelled");
      return await new Promise((resolve, reject) => {
        decoderReject = reject;
        decoder.onmessage = ({ data }) => data.error ? reject(new Error("decode")) : resolve(data.imageData);
        decoder.onerror = () => reject(new Error("decode"));
        decoder.postMessage({ id: "passport", buffer }, [buffer]);
      });
    } finally {
      decoder.terminate();
      if (imageDecoder === decoder) { imageDecoder = null; decoderReject = null; }
    }
  };
  const readImage = async (file) => {
    const url = URL.createObjectURL(file);
    let source;
    try {
      const image = new Image();
      image.src = url;
      try {
        // Normalize HEIC consistently: native browser decoders can produce
        // different color/orientation results and change small-label OCR.
        if (/\.hei[cf]$/i.test(file.name) || /image\/hei[cf]/.test(file.type)) throw new Error("heic");
        await image.decode(); source = image;
      }
      catch {
        if (!/\.hei[cf]$/i.test(file.name) && !/image\/hei[cf]/.test(file.type)) throw new Error("decode");
        setStatus("Preparing your iPhone photo on this device…");
        const data = await decodeHeic(file);
        source = document.createElement("canvas");
        source.width = data.width; source.height = data.height;
        source.getContext("2d").putImageData(data, 0, 0);
      }
      const width = source.naturalWidth || source.width;
      const height = source.naturalHeight || source.height;
      if (!width || !height || width * height > 60000000) throw new Error("image size");
      const scale = Math.min(1, 4200 / Math.max(width, height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(width * scale); canvas.height = Math.round(height * scale);
      const context = canvas.getContext("2d");
      context.fillStyle = "white"; context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(source, 0, 0, canvas.width, canvas.height);
      if (source instanceof HTMLCanvasElement) { source.width = 0; source.height = 0; }
      return canvas;
    } finally { URL.revokeObjectURL(url); }
  };
  inputs.forEach((input) => input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file || busy) return;
    resetReview();
    if ((!/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type) && !/\.(jpe?g|png|webp|hei[cf])$/i.test(file.name)) || file.size > 15 * 1024 * 1024) {
      setStatus("Choose a JPG, PNG, WebP or HEIC photo under 15 MB. You can also enter your details manually.");
      input.value = ""; return;
    }
    busy = true;
    const current = ++operation;
    root.querySelectorAll("[data-passport-pick]").forEach((button) => { button.disabled = true; });
    setStatus("Loading the private scanner… The first scan may take a moment.");
    const timeout = window.setTimeout(() => {
      if (current !== operation) return;
      stop(); setStatus("The scan took too long. Try a clearer photo or enter your details manually.");
    }, 90000);
    let canvas;
    try {
      const Tesseract = await loadLibrary();
      if (current !== operation) return;
      canvas = await readImage(file);
      if (current !== operation) return;
      const scanner = await Tesseract.createWorker("eng", 1, {
        workerPath: new URL("vendor/passport-ocr/worker.min.js", window.location.href).href,
        corePath: new URL("vendor/passport-ocr/core/", window.location.href).href,
        langPath: new URL("vendor/passport-ocr/lang/", window.location.href).href,
        workerBlobURL: false, cacheMethod: "none",
        logger: ({ status: stage, progress }) => {
          if (current === operation && stage === "recognizing text") setStatus(`Reading passport on your device… ${Math.round(progress * 100)}%`);
        },
        errorHandler: () => {},
      });
      if (current !== operation) { await scanner.terminate(); return; }
      worker = scanner;
      const result = await scanner.recognize(canvas, {}, { text: true, blocks: true });
      if (current !== operation) return;
      let detected = parsePassport(result.data.text, countries, result.data.blocks || []);
      const mrzLine = ocrLines(result.data.blocks || []).find((line) => /^P[<A-Z]/.test(line.text.trim()) && line.text.includes("<<"));
      if (mrzLine) {
        const box = mrzLine.bbox;
        const left = Math.max(0, box.x0 - 15), top = Math.max(0, box.y0 - 12);
        await scanner.setParameters({ tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ<", tessedit_pageseg_mode: "7" });
        const focused = await scanner.recognize(canvas, { rectangle: { left, top, width: Math.min(canvas.width - left, box.x1 - left + 15), height: Math.min(canvas.height - top, box.y1 - top + 12) } });
        if (current !== operation) return;
        const precise = parsePassport(focused.data.text, countries);
        if (precise.firstName && precise.lastName) detected = { ...detected, firstName: precise.firstName, lastName: precise.lastName };
      }
      if (!detected.country && mrzLine) {
        // A sparse-text pass of the biographic page helps small multilingual
        // birth labels without inventing a country from passport nationality.
        const box = mrzLine.bbox;
        const height = Math.max(20, box.y1 - box.y0);
        const top = Math.max(0, box.y0 - height * 15);
        await scanner.setParameters({ tessedit_char_whitelist: "", tessedit_pageseg_mode: "11" });
        const biography = await scanner.recognize(canvas, { rectangle: { top, left: 0, width: canvas.width, height: Math.min(canvas.height - top, box.y1 - top + height * 2) } }, { text: true, blocks: true });
        if (current !== operation) return;
        detected.country = parsePassport(biography.data.text, countries, biography.data.blocks || []).country;
      }
      if ((!detected.firstName || !detected.lastName) && canvas.height > 200) {
        await scanner.setParameters({ tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ<", tessedit_pageseg_mode: "6" });
        const crop = await scanner.recognize(canvas, { rectangle: { top: Math.round(canvas.height * 0.55), left: 0, width: canvas.width, height: Math.floor(canvas.height * 0.45) } });
        if (current !== operation) return;
        const mrz = parsePassport(crop.data.text, countries);
        if (mrz.firstName && mrz.lastName) detected = { ...mrz, country: detected.country };
      }
      if (!detected.firstName || !detected.lastName) {
        setStatus("We could not read the names clearly. Photograph the full passport photo page, including the two lines at the bottom, or enter your details manually.");
        return;
      }
      const photo = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
      if (current !== operation) return;
      if (photo) pendingPhoto = new File([photo], "passport-scan.jpg", { type: "image/jpeg" });
      Object.entries(detected).forEach(([key, value]) => { fields[key].value = value; });
      review.hidden = false;
      setStatus("Review the detected names. Separate any middle names yourself. Confirm country of birth manually if it was not read.");
      fields.firstName.focus();
    } catch {
      if (current === operation) setStatus("We could not read this photo. Try a clear JPG or PNG, or enter your details manually.");
    } finally {
      window.clearTimeout(timeout);
      if (review.hidden) pendingPhoto = null;
      if (canvas) { canvas.width = 0; canvas.height = 0; }
      if (current === operation) stop();
    }
  }));
  const sameAttachment = (file) => attachedPhoto && file.name === attachedPhoto.name && file.lastModified === attachedPhoto.lastModified && file.size === attachedPhoto.size;
  const attachmentNotice = root.querySelector("[data-passport-attachment]");
  const removeAttachment = root.querySelector("[data-passport-remove]");
  const documents = form.querySelector("#identityDocuments");
  const updateAttachmentNotice = () => {
    if (attachedPhoto && !Array.from(documents.files).some(sameAttachment)) attachedPhoto = null;
    attachmentNotice.hidden = !attachedPhoto; removeAttachment.hidden = !attachedPhoto;
  };
  const setAttachment = (photo) => {
    const files = Array.from(documents.files).filter((file) => !sameAttachment(file));
    if (photo) files.push(photo);
    if (files.length > 8 || files.reduce((sum, file) => sum + file.size, 0) > 35 * 1024 * 1024) throw new Error("attachment limit");
    const selection = new DataTransfer();
    files.forEach((file) => selection.items.add(file));
    documents.files = selection.files;
    attachedPhoto = photo;
    documents.dispatchEvent(new Event("change", { bubbles: true }));
    updateAttachmentNotice();
  };
  documents.addEventListener("change", updateAttachmentNotice);
  removeAttachment.addEventListener("click", () => {
    try { setAttachment(null); setStatus("Passport photo removed. Your entered details are unchanged."); }
    catch { setStatus("Use the document upload field to replace or remove the selected files."); }
  });
  const applyDetails = (includePhoto) => {
    if (review.hidden || busy) return;
    if (!fields.firstName.value.trim() || !fields.lastName.value.trim()) {
      setStatus("Check the first and last names before using these details."); return;
    }
    if (includePhoto && !pendingPhoto) { setStatus("Photo attachment is unavailable. Choose Use details only, or scan again."); return; }
    try { if (includePhoto || attachedPhoto) setAttachment(includePhoto ? pendingPhoto : null); }
    catch { setStatus("The photo could not be attached. Keep at most 8 files and 35 MB total, or choose Use details only."); return; }
    for (const key of ["firstName", "lastName", "middleName"]) {
      const target = form.querySelector(`[name="${key}"]`);
      target.value = fields[key].value.trim().slice(0, 100);
      target.dispatchEvent(new Event("input", { bubbles: true }));
    }
    if (fields.country.value) {
      countrySelect.value = fields.country.value;
      const search = form.querySelector("#countrySearch");
      if (search) { search.value = fields.country.value; search.setCustomValidity(""); }
      countrySelect.dispatchEvent(new Event("change", { bubbles: true }));
    }
    resetReview(); panel.hidden = true; toggle.setAttribute("aria-expanded", "false");
    setStatus(includePhoto ? "Details applied and passport photo attached. It will be sent only when you submit your preparation request." : "Details applied without attaching the passport photo. Check all details before continuing.");
    form.querySelector('[name="firstName"]').focus();
  };
  root.querySelector("[data-passport-apply]").addEventListener("click", () => applyDetails(true));
  root.querySelector("[data-passport-details-only]").addEventListener("click", () => applyDetails(false));
  window.addEventListener("pagehide", () => { stop(); resetReview(); });
})();
