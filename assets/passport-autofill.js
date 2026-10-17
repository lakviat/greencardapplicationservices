/* Reusable on-device passport parser. The preparation workspace owns the UI. */
(() => {
  "use strict";
  const normalize = (value) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/[^A-Z ]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const cleanName = (value) =>
    normalize(value.replace(/<+/g, " ")).slice(0, 100);
  const distance = (a, b) => {
    let row = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 0; i < a.length; i += 1) {
      const next = [i + 1];
      for (let j = 0; j < b.length; j += 1)
        next.push(
          Math.min(next[j] + 1, row[j + 1] + 1, row[j] + (a[i] !== b[j])),
        );
      row = next;
    }
    return row[b.length];
  };
  const ocrLines = (blocks) =>
    blocks.flatMap((block) =>
      (block.paragraphs || []).flatMap((paragraph) => paragraph.lines || []),
    );

  const upper = (value) =>
    String(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase();
  const nameLabels = {
    lastName:
      /\b(?:SURNAME|LAST NAME|FAMILY NAME|NOM DE FAMILLE|APELLIDOS?|FAMILIENNAME)\b/g,
    firstName:
      /\b(?:GIVEN NAMES?|G[IL]?EN NAMES?|FIRST NAME|PRENOMS?|NOMBRES?|VORNAMEN?)\b/g,
    middleName: /\bMIDDLE NAMES?\b/g,
    other:
      /\b(?:PASSPORT|NATIONALITY|DATE|PLACE|COUNTRY|SEX|AUTHORITY|SIGNATURE|PERSONAL NUMBER|TYPE|ISSUING|EXPIRY)\b/g,
  };
  const labelMatches = (line) =>
    Object.entries(nameLabels)
      .flatMap(([key, pattern]) =>
        [...line.matchAll(pattern)].map((m) => ({
          key,
          start: m.index,
          end: m.index + m[0].length,
        })),
      )
      .sort((a, b) => a.start - b.start);
  const printedName = (value) => {
    const text = upper(value)
      .replace(/^[\s:/\-]+|[\s:/\-]+$/g, "")
      .trim();
    // Preserve genuine Latin spelling, hyphens and apostrophes. Do not turn
    // unrelated text, translated labels or digits into a plausible name.
    return /^[A-Z][A-Z .’'\-]{0,99}$/.test(text) &&
      !labelMatches(text).length &&
      !/[KL]{5,}/.test(text)
      ? text.replace(/\s+/g, " ")
      : "";
  };
  const canonicalName = (value) => value.replace(/[^A-Z]/g, "");

  function readNameCandidates(text, blocks = [], { printedOnly = false } = {}) {
    const lines = upper(text)
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    const candidates = { printed: {}, mrz: {} };
    const add = (source, key, value) => {
      if (key !== "other" && value)
        (candidates[source][key] ||= []).push(value);
    };
    for (let i = 0; i < lines.length; i++) {
      const found = labelMatches(lines[i]);
      for (let j = 0; j < found.length; j++) {
        const f = found[j];
        const inline = printedName(lines[i].slice(f.end, found[j + 1]?.start));
        if (inline) add("printed", f.key, inline);
        else if (new Set(found.map((f) => f.key)).size === 1) {
          // The Latin spelling may follow a local-script spelling. Stop at
          // another field, and never read a neighbouring column as this name.
          for (
            let below = i + 1;
            below <= i + 2 && below < lines.length;
            below++
          ) {
            if (labelMatches(lines[below]).length || lines[below].includes("<"))
              break;
            const value = printedName(lines[below]);
            if (value) {
              add("printed", f.key, value);
              break;
            }
            if (!/[^\x00-\x7F]/.test(lines[below])) break;
          }
        }
      }
    }
    for (const row of ocrLines(blocks)) {
      let offset = 0;
      const words = (row.words || []).map((w) => {
        const text = upper(w.text),
          start = offset;
        offset += text.length + 1;
        return { ...w, text, start, end: offset - 1 };
      });
      const found = labelMatches(words.map((w) => w.text).join(" "));
      for (let i = 0; i < found.length; i++) {
        const f = found[i];
        if (f.key === "other") continue;
        const start = words.find((w) => w.end > f.start),
          end = words.find((w) => w.end >= f.end);
        if (!start?.bbox || !end?.bbox) continue;
        const height = Math.max(12, end.bbox.y1 - start.bbox.y0);
        const next = words.find((w) => w.start >= found[i + 1]?.start);
        const right = next?.bbox.x0 || start.bbox.x0 + height * 22;
        for (const valueRow of ocrLines(blocks)
          .slice()
          .sort(
            (a, b) =>
              (a.words?.[0]?.bbox.y0 || 0) - (b.words?.[0]?.bbox.y0 || 0),
          )) {
          const region = (valueRow.words || []).filter(
            (w) =>
              w.bbox.x0 >= start.bbox.x0 - height / 2 &&
              w.bbox.x0 < right &&
              w.bbox.y0 >= end.bbox.y1 - height * 0.15 &&
              w.bbox.y0 < end.bbox.y1 + height * 2.8,
          );
          const value = region.map((w) => w.text).join(" ");
          if (labelMatches(upper(value)).some((label) => label.key !== f.key))
            break;
          const name = printedName(value);
          if (name) {
            add("printed", f.key, name);
            break;
          }
        }
      }
    }
    if (printedOnly) return candidates;
    for (const raw of lines) {
      const mrz = raw.replace(/«/g, "<<").replace(/‹/g, "<").replace(/\s/g, "");
      if (!/^P[A-Z<][A-Z<]{3}[A-Z<]+<<[A-Z<]+$/.test(mrz) || mrz.length < 25)
        continue;
      const separator = mrz.indexOf("<<", 5);
      const given = mrz
        .slice(separator + 2)
        .split(/<+/)
        .filter(Boolean);
      // Only a trailing run of filler-like tokens is removed. Preserve real
      // names such as MARK, LEE, LILLY and KLARA, and a lone K/L initial.
      let paddingStart = given.length;
      while (paddingStart > 0 && /^[KL]+$/.test(given[paddingStart - 1]))
        paddingStart--;
      if (given.slice(paddingStart).join("").length >= 3)
        given.splice(paddingStart);
      const first = cleanName(given.join(" "));
      add("mrz", "firstName", /[KL]{5,}/.test(first) ? "" : first);
      add("mrz", "lastName", cleanName(mrz.slice(5, separator)));
    }
    return candidates;
  }

  function createNameReader() {
    const evidence = { printed: {}, mrz: {} };
    const add = (text, blocks = [], options = {}) => {
      const next = readNameCandidates(text, blocks, options);
      for (const source of ["printed", "mrz"])
        for (const [key, values] of Object.entries(next[source])) {
          const stored = (evidence[source][key] ||= new Map());
          for (const value of values) stored.set(canonicalName(value), value);
        }
    };
    const result = () => {
      const values = {},
        issues = [];
      for (const [key, label] of [
        ["firstName", "first / given name"],
        ["lastName", "last / family name"],
        ["middleName", "middle name"],
      ]) {
        const printed = evidence.printed[key] || new Map(),
          mrz = evidence.mrz[key] || new Map();
        let chosen = "";
        if (printed.size === 1) chosen = [...printed.values()][0];
        else if (printed.size > 1) {
          const agreed = [...printed.keys()].filter((k) => mrz.has(k));
          if (agreed.length === 1 && mrz.size === 1)
            chosen = printed.get(agreed[0]);
        } else if (mrz.size === 1) chosen = [...mrz.values()][0];
        values[key] = chosen;
        if (!chosen && (printed.size || mrz.size))
          issues.push(
            `Different readings of the ${label} were found. Please enter it from the printed passport details.`,
          );
        else if (
          chosen &&
          mrz.size &&
          [...mrz.keys()].some((k) => k !== canonicalName(chosen))
        )
          issues.push(
            `The printed ${label} differs from the machine-readable line. The printed spelling is shown; please confirm it against the image.`,
          );
      }
      return { ...values, issues };
    };
    return {
      add,
      result,
      needsPrintedNames: () =>
        !evidence.printed.firstName?.size || !evidence.printed.lastName?.size,
    };
  }

  function parsePassport(text, countries = [], blocks = []) {
    const lines = text
      .toUpperCase()
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const names = createNameReader();
    names.add(text, blocks);
    const { firstName, lastName, middleName } = names.result();
    const aliases = new Map(
      countries.map((country) => [normalize(country), country]),
    );
    for (const [alias, country] of [
      ["KYRGYZ REPUBLIC", "Kyrgyzstan"],
      ["THE KYRGYZ REPUBLIC", "Kyrgyzstan"],
      ["TURKIYE", "Turkey"],
      ["RUSSIAN FEDERATION", "Russia"],
    ]) {
      if (countries.includes(country)) aliases.set(alias, country);
    }
    const matchCountry = (value) => {
      const normalized = normalize(value);
      const matches = new Set();
      for (const [alias, country] of aliases) {
        if (
          ` ${normalized} `.includes(` ${alias} `) ||
          normalized.replace(/ /g, "") === alias.replace(/ /g, "")
        )
          matches.add(country);
      }
      return matches.size === 1 ? [...matches][0] : "";
    };
    let country = "";
    for (let i = 0; i < lines.length; i += 1) {
      const match = lines[i].match(
        /\b(?:PLACE OF BIRTH|COUNTRY OF BIRTH|BIRTH PLACE|LIEU DE NAISSANCE|GEBURTSORT|LUGAR DE NACIMIENTO)\b\s*[:/\-]?\s*(.*)$/,
      );
      if (match)
        country = matchCountry(match[1] || lines[i + 1] || "") || country;
    }
    // Multilingual documents often place labels beside other columns. Use word
    // positions to restrict a fuzzy birth label to the value directly below it.
    const structured = ocrLines(blocks);
    const foundCountries = new Set();
    for (const line of structured) {
      const words = line.words || [];
      for (let i = 0; i + 2 < words.length; i += 1) {
        const [a, b, c] = words
          .slice(i, i + 3)
          .map((word) => normalize(word.text));
        const birthLabel =
          (a.startsWith("P") && distance(a, "PLACE") <= 3) ||
          (a.startsWith("CO") && distance(a, "COUNTRY") <= 2);
        if (b !== "OF" || !birthLabel || distance(c, "BIRTH") > 3) continue;
        const box = words[i].bbox;
        const end = words[i + 2].bbox;
        const height = Math.max(12, end.y1 - box.y0);
        for (const valueLine of structured) {
          const region = (valueLine.words || []).filter(
            (word) =>
              word.bbox.x0 >= box.x0 - height &&
              word.bbox.x0 < box.x0 + height * 13 &&
              word.bbox.y0 >= box.y0 - height * 0.15 &&
              word.bbox.y0 < end.y1 + height * 2.3,
          );
          const found = matchCountry(region.map((word) => word.text).join(" "));
          if (found) foundCountries.add(found);
        }
      }
    }
    if (!country && foundCountries.size === 1) country = [...foundCountries][0];
    return { firstName, lastName, middleName, country };
  }
  window.gcasPassport = { parsePassport, createNameReader };
})();
