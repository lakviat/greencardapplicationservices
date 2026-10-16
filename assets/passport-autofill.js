/* Reusable on-device passport parser. The preparation workspace owns the UI. */
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
      // Some engines separate every misread chevron into its own K/L token.
      // Keep genuine single initials; reject a run of three or more at the end.
      let paddingStart = given.length;
      while (paddingStart > 0 && /^[KL]$/.test(given[paddingStart - 1])) paddingStart -= 1;
      if (given.length - paddingStart >= 3) given.splice(paddingStart);
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

})();
