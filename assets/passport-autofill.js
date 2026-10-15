/* Passport OCR stays on this device. No image, OCR text or extracted values
 * are sent to a server, analytics, localStorage or sessionStorage. */
(() => {
  "use strict";
  const normalize = (value) => value.toUpperCase().replace(/[^A-Z ]/g, " ").replace(/\s+/g, " ").trim();
  const cleanName = (value) => value.replace(/<+/g, " ").replace(/[^A-Za-z '\-]/g, " ").replace(/\s+/g, " ").trim().slice(0, 100);

  function parsePassport(text, countries = []) {
    const lines = text.toUpperCase().split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    let firstName = "", lastName = "", middleName = "";
    // TD3 names: issuing country and nationality are deliberately ignored.
    const mrz = lines.map((line) => line.replace(/\s/g, "")).find((line) => /^P[A-Z<][A-Z<]{3}[A-Z<]+<<[A-Z<]+$/.test(line) && line.length >= 25);
    if (mrz) {
      const [surname, ...given] = mrz.slice(5).split("<<");
      lastName = cleanName(surname);
      // MRZ does not distinguish first and middle names. Keep all given names
      // together for review instead of guessing a split.
      firstName = cleanName(given.join(" "));
    }
    {
      // Explicit printed names take precedence when MRZ filler is misread.
      const readLabel = (pattern) => {
        for (let i = 0; i < lines.length; i += 1) {
          const match = lines[i].match(pattern);
          if (!match) continue;
          const value = (match[1] || "").replace(/^\s*[:/\-]\s*/, "").trim();
          const candidate = value || lines[i + 1] || "";
          if (candidate && !/PASSPORT|NATIONALITY|BIRTH|DATE|SEX|GIVEN|SURNAME|NAME|AUTHORITY|EXPIR/.test(candidate)) return cleanName(candidate);
        }
        return "";
      };
      lastName = readLabel(/^(?:SURNAME|LAST NAME|FAMILY NAME)\b\s*[:/\-]?\s*(.*)$/) || lastName;
      firstName = readLabel(/^(?:GIVEN NAMES?|FIRST NAME)\b\s*[:/\-]?\s*(.*)$/) || firstName;
      middleName = readLabel(/^MIDDLE NAME\b\s*[:/\-]?\s*(.*)$/);
    }
    const aliases = new Map(countries.map((country) => [normalize(country), country]));
    if (countries.includes("Kyrgyzstan")) aliases.set("KYRGYZ REPUBLIC", "Kyrgyzstan");
    if (countries.includes("Turkey")) aliases.set("TURKIYE", "Turkey");
    if (countries.includes("Russia")) aliases.set("RUSSIAN FEDERATION", "Russia");
    let country = "";
    for (let i = 0; i < lines.length; i += 1) {
      const match = lines[i].match(/^(?:PLACE OF BIRTH|COUNTRY OF BIRTH|BIRTH PLACE)\b\s*[:/\-]?\s*(.*)$/);
      if (!match) continue;
      const value = match[1] || lines[i + 1] || "";
      // Only an explicitly labeled birth-country segment can fill this field.
      // A city by itself, a passport code, or nationality is not enough.
      for (const part of [value, ...value.split(/[,;/]/)]) {
        const found = aliases.get(normalize(part));
        if (found) country = found;
      }
    }
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
  let libraryPromise;
  let operation = 0;
  const setStatus = (message) => { status.textContent = message; };
  const resetReview = () => {
    review.hidden = true;
    Object.values(fields).forEach((field) => { field.value = ""; });
  };
  const stop = () => {
    operation += 1;
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
  const readImage = async (file) => {
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      const scale = Math.min(1, 2400 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.naturalWidth * scale);
      canvas.height = Math.round(image.naturalHeight * scale);
      const context = canvas.getContext("2d");
      context.fillStyle = "white";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      return canvas;
    } finally { URL.revokeObjectURL(url); }
  };
  inputs.forEach((input) => input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file || busy) return;
    resetReview();
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 15 * 1024 * 1024) {
      setStatus("Choose a JPG, PNG or WebP photo under 15 MB. You can also enter your details manually.");
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
      const result = await scanner.recognize(canvas);
      if (current !== operation) return;
      let detected = parsePassport(result.data.text, countries);
      if ((!detected.firstName || !detected.lastName) && canvas.height > 200) {
        const crop = await scanner.recognize(canvas, { rectangle: { top: Math.round(canvas.height * 0.55), left: 0, width: canvas.width, height: Math.floor(canvas.height * 0.45) } });
        if (current !== operation) return;
        const mrz = parsePassport(crop.data.text, countries);
        if (mrz.firstName && mrz.lastName) detected = { ...mrz, country: detected.country };
      }
      if (!detected.firstName || !detected.lastName) {
        setStatus("We could not read the names clearly. Photograph the full passport photo page, including the two lines at the bottom, or enter your details manually.");
        return;
      }
      Object.entries(detected).forEach(([key, value]) => { fields[key].value = value; });
      review.hidden = false;
      setStatus("Review the detected names. Separate any middle names yourself. Confirm country of birth manually if it was not read.");
      fields.firstName.focus();
    } catch {
      if (current === operation) setStatus("We could not read this photo. Try a clear JPG or PNG, or enter your details manually.");
    } finally {
      window.clearTimeout(timeout);
      if (canvas) { canvas.width = 0; canvas.height = 0; }
      if (current === operation) stop();
    }
  }));
  root.querySelector("[data-passport-apply]").addEventListener("click", () => {
    if (review.hidden || busy) return;
    if (!fields.firstName.value.trim() || !fields.lastName.value.trim()) {
      setStatus("Check the first and last names before using these details."); return;
    }
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
    setStatus("Passport names applied. Please check all details and country of birth before continuing.");
    form.querySelector('[name="firstName"]').focus();
  });
  window.addEventListener("pagehide", () => { stop(); resetReview(); });
})();
