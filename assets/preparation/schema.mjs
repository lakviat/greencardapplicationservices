// Versioned preparation data. Rules describe completeness, never legal eligibility.
export const FORM_VERSION = Object.freeze({
  id: "dv2027-preparation-2026-10-16",
  year: 2027,
  status: "provisional",
  verified: "2026-10-16",
  notice:
    "DV-2027 registration dates are awaiting official confirmation. This worksheet uses the archived DS-5501 structure, DV-2026 instructions, and the March 2026 passport rule. Recheck the final DV-2027 instructions before submitting an official entry.",
  sources: [
    [
      "Archived six-page DS-5501 reference",
      "https://travel.state.gov/content/dam/visas/Sample%20E-DV%202017%20Lottery.pdf",
    ],
    [
      "Official DV instructions",
      "https://travel.state.gov/content/travel/en/us-visas/immigrate/diversity-visa-program-entry/diversity-visa-instructions.html",
    ],
    [
      "March 2026 passport rule",
      "https://www.govinfo.gov/content/pkg/FR-2026-03-11/html/2026-04737.htm",
    ],
    [
      "Registration announcement",
      "https://travel.state.gov/content/travel/en/News/visas-news/changes-to-2027-dv-program-entry-period.html",
    ],
  ],
});
export const PACKAGES = Object.freeze({
  single: {
    label: "Single",
    cents: 999,
    description:
      "One principal worksheet, including every required spouse and child. Planned: secure saving, corrections, and PDF delivery.",
  },
  couple: {
    label: "Couple",
    cents: 1999,
    description:
      "Two independently eligible principal worksheets, with confirmed household-detail reuse. Planned bundled organization, saving, and PDFs.",
  },
  family: {
    label: "Family",
    cents: 2999,
    description:
      "Two principal worksheets plus a household document index and family completeness summary. All required derivatives are included on every plan.",
  },
  premium: {
    label: "Premium",
    cents: 3999,
    description: "Benefits are under owner review. Purchase is unavailable.",
    disabled: true,
  },
});
export const price = (key) => `$${(PACKAGES[key].cents / 100).toFixed(2)}`;
export const initialDraft = () => ({
  version: FORM_VERSION.id,
  year: FORM_VERSION.year,
  package: "single",
  answers: {},
  childIds: [],
  assets: {},
  reviewed: false,
  secondEntry: false,
});
export const hasSpouse = (d) => d.answers["entrant.marital"] === "married";
export const hasPassport = (d) => d.answers["passport.path"] === "passport";
export function recommendPackage(d) {
  return d.childIds.length ? "family" : d.secondEntry ? "couple" : "single";
}
const f = (id, label, type = "text", extra = {}) => ({
  id,
  label,
  type,
  required: true,
  maxLength: 100,
  help: "",
  order: 0,
  reference: "Preparation",
  pdfKey: id,
  effectiveYear: FORM_VERSION.year,
  ...extra,
});
const opts = (...labels) => labels.map((label) => ({ value: label, label }));
export const EDUCATION = [
  "Primary school only",
  "High school, no degree",
  "High school degree",
  "Vocational school",
  "Some university courses",
  "University degree",
  "Some graduate-level courses",
  "Master’s degree",
  "Some doctoral-level courses",
  "Doctorate degree",
];
export const MARITAL = [
  { value: "unmarried", label: "Unmarried" },
  {
    value: "married",
    label: "Married — spouse is not a U.S. citizen or permanent resident",
  },
  {
    value: "married-us",
    label: "Married — spouse is a U.S. citizen or permanent resident",
  },
  { value: "divorced", label: "Divorced" },
  { value: "widowed", label: "Widowed" },
  { value: "separated", label: "Legally separated by court order" },
];
function person(prefix, ref, photo = true) {
  const fields = [
    f(`${prefix}.lastName`, "Last / family name", "name", {
      reference: `${ref}a`,
      exception: `${prefix}.noLastName`,
      exceptionLabel: "No last / family name",
      help: "Use the Roman-alphabet spelling on your passport. If you have only one name, check the current official instructions.",
    }),
    f(`${prefix}.firstName`, "First / given name", "name", {
      reference: `${ref}b`,
      exception: `${prefix}.noFirstName`,
      exceptionLabel: "No first name",
    }),
    f(`${prefix}.middleName`, "Middle name", "name", {
      reference: `${ref}c`,
      exception: `${prefix}.noMiddleName`,
      exceptionLabel: "No middle name",
      help: "Include all middle names shown on your document, or confirm you have none.",
    }),
    f(`${prefix}.sex`, "Sex", "select", {
      reference: prefix === "entrant" ? "2" : `${ref}e`,
      options: opts("Male", "Female"),
      help: "Use the categories required by the active official form. Verify the final instructions.",
    }),
    f(`${prefix}.birthDate`, "Date of birth", "date", {
      reference: prefix === "entrant" ? "3" : `${ref}d`,
      help: "Enter the date on your birth or identity document. Month / day / year.",
    }),
    f(`${prefix}.birthCity`, "City where you were born", "text", {
      reference: prefix === "entrant" ? "4" : `${ref}f`,
      exception: `${prefix}.birthCityUnknown`,
      exceptionLabel: "Birth city unknown",
      help: "City or town only; do not substitute a province or district.",
    }),
    f(`${prefix}.birthCountry`, "Country where you were born", "country", {
      reference: prefix === "entrant" ? "5" : `${ref}g`,
      help: "Choose your country of birth, which may differ from your nationality or residence.",
    }),
  ];
  if (prefix !== "entrant") [fields[3], fields[4]] = [fields[4], fields[3]];
  if (photo)
    fields.push(
      f(`${prefix}.photo`, "Photograph", "photo", {
        reference: `${ref}h`,
        help: "Use a recent color photograph of this person. Technical checks do not guarantee acceptance.",
      }),
    );
  return fields;
}
export function sections(d) {
  const principal = person("entrant", "1", false);
  const result = [
    {
      id: "identity",
      page: 1,
      part: "Part One — Entrant Information",
      title: "1–5. Name, sex & birth information",
      fields: principal,
    },
    {
      id: "eligibility",
      page: 1,
      part: "Part One — Entrant Information",
      title: "6. Country of eligibility",
      fields: [
        f(
          "eligibility.basis",
          "How will you determine your country of eligibility?",
          "select",
          {
            reference: "6",
            options: [
              { value: "birth", label: "Country of birth" },
              {
                value: "spouse",
                label: "Spouse’s country of birth — requires confirmation",
              },
              {
                value: "parents",
                label: "Parent’s country of birth — requires confirmation",
              },
            ],
            help: "Eligibility usually follows birth, not citizenship. Spouse and parent exceptions have specific legal conditions; do not guess.",
          },
        ),
        f(
          "eligibility.country",
          "Country of eligibility / chargeability",
          "country",
          {
            reference: "6a",
            help: "Choose deliberately. We do not infer eligibility or block countries using last year’s list.",
          },
        ),
        f(
          "eligibility.explanation",
          "Explain the basis for alternative chargeability",
          "textarea",
          {
            reference: "6b",
            visible: (x) =>
              ["spouse", "parents"].includes(x.answers["eligibility.basis"]),
            maxLength: 1500,
            help: "Record the facts you will verify against the official instructions. This is a private preparation note.",
          },
        ),
        f(
          "eligibility.confirm",
          "I will verify my country and any alternative chargeability against the final DV-2027 instructions.",
          "checkbox",
          { reference: "6 review" },
        ),
      ],
    },
    {
      id: "photo",
      page: 2,
      part: "Part One — Entrant Information",
      title: "7. Entrant photograph",
      fields: [
        f("entrant.photo", "Entrant photograph", "photo", {
          reference: "7",
          help: "Prepare a square JPEG. Current baseline: 600 × 600 pixels, no more than 240 KB. Final DV-2027 technical details still require verification.",
        }),
      ],
    },
    {
      id: "address",
      page: 2,
      part: "Part One — Entrant Information",
      title: "8. Mailing address",
      fields: [
        f("address.careOf", "In care of", "text", {
          reference: "8a",
          required: false,
        }),
        f("address.line1", "Address line 1", "text", {
          reference: "8b",
          maxLength: 160,
        }),
        f("address.line2", "Address line 2", "text", {
          reference: "8c",
          required: false,
          maxLength: 160,
        }),
        f("address.city", "City / town", "text", { reference: "8d" }),
        f("address.region", "District / county / province / state", "text", {
          reference: "8e",
        }),
        f("address.postal", "Postal / ZIP code", "text", {
          reference: "8f",
          exception: "address.noPostal",
          exceptionLabel: "No postal / ZIP code",
          maxLength: 20,
        }),
        f("address.country", "Country", "country", { reference: "8g" }),
      ],
    },
    {
      id: "contact",
      page: 3,
      part: "Part One — Entrant Information",
      title: "9–11. Residence & contact",
      fields: [
        f("contact.country", "Country where you live today", "country", {
          reference: "9",
        }),
        f("contact.phone", "Phone number", "tel", {
          reference: "10",
          required: false,
          maxLength: 40,
        }),
        f("contact.email", "Email address", "email", {
          reference: "11a",
          maxLength: 254,
        }),
        f("contact.emailConfirm", "Confirm email address", "email", {
          reference: "11b",
          maxLength: 254,
          help: "Use an email account you can access. This does not create an account or subscribe you to marketing.",
        }),
      ],
    },
    {
      id: "education",
      page: 3,
      part: "Part One — Entrant Information",
      title: "12. Education",
      fields: [
        f(
          "entrant.education",
          "Highest level of education achieved",
          "select",
          {
            reference: "12",
            options: opts(...EDUCATION),
            help: "Selecting a level does not establish eligibility. High-school equivalency certificates alone are not necessarily qualifying; work-experience eligibility has separate criteria.",
          },
        ),
        f(
          "education.confirm",
          "I will verify that I meet the education or qualifying work-experience requirement.",
          "checkbox",
          { reference: "12 review" },
        ),
      ],
    },
    {
      id: "family",
      page: 3,
      part: "Part One — Entrant Information",
      title: "13–14. Marital status & children",
      fields: [
        f("entrant.marital", "Current marital status", "select", {
          reference: "13",
          options: MARITAL,
          help: "A spouse must generally be listed even if living apart or not immigrating. “Legally separated” requires a court order. Do not list a spouse who is already a U.S. citizen or permanent resident.",
        }),
        f(
          "family.confirm",
          "I have checked which living, unmarried children under 21 must be listed, including biological, adopted, and stepchildren.",
          "checkbox",
          {
            reference: "14 review",
            help: "Include required children even if they live elsewhere or will not immigrate. Check exceptions for U.S. citizen or permanent-resident children. Age is determined at official entry.",
          },
        ),
      ],
    },
    {
      id: "passport",
      page: 4,
      part: "Current requirements addendum",
      title: "Passport information & scans",
      fields: [
        f("passport.path", "Passport requirement", "select", {
          reference: "2026 rule",
          options: [
            { value: "passport", label: "I have a valid, unexpired passport" },
            {
              value: "stateless",
              label: "I am stateless — exemption needs verification",
            },
            {
              value: "communist",
              label:
                "Unable to obtain a passport from a Communist-controlled country of nationality — exemption needs verification",
            },
            {
              value: "waiver",
              label:
                "Individual waiver approved or expected under the rule — needs verification",
            },
          ],
          help: "Cost, difficulty, or conflict alone does not establish an exemption. The final form’s exact exemption process is still pending.",
        }),
        f("passport.name", "Full name on passport", "name", {
          visible: hasPassport,
        }),
        f("passport.number", "Passport number", "passport", {
          visible: hasPassport,
          maxLength: 30,
        }),
        f("passport.issuer", "Country or authority of issuance", "text", {
          visible: hasPassport,
        }),
        f("passport.expiry", "Passport expiration date", "futureDate", {
          visible: hasPassport,
        }),
        f("passport.bio", "Passport biographic page", "passportPhoto", {
          visible: hasPassport,
          help: "JPEG only, up to 5 MB. Keep every edge and all printed information visible. Kept in this tab until you save; paid saving includes the image in private account storage.",
        }),
        f(
          "passport.samePage",
          "The signature is on the biographic page I uploaded.",
          "checkbox",
          { visible: hasPassport, required: false },
        ),
        f("passport.signature", "Passport signature page", "passportPhoto", {
          visible: (x) => hasPassport(x) && !x.answers["passport.samePage"],
          help: "Upload a separate JPEG when the signature is on a different page.",
        }),
        f("passport.explanation", "Exemption facts to verify", "textarea", {
          visible: (x) => !!x.answers["passport.path"] && !hasPassport(x),
          maxLength: 1500,
          help: "This records your stated basis only. The government decides whether an exemption applies.",
        }),
        f(
          "passport.confirm",
          "I will verify my passport or exemption and the final upload requirements before official entry.",
          "checkbox",
        ),
        f(
          "contact.consulate",
          "Consular office nearest your residence",
          "text",
          {
            help: "The March 2026 rule includes this information. If living in the U.S., use the office nearest your last foreign residence; verify the final form.",
          },
        ),
      ],
    },
  ];
  if (hasSpouse(d))
    result.push({
      id: "spouse",
      page: 5,
      part: "Part Two — Derivatives",
      title: "13. Spouse information",
      fields: person("spouse", "13"),
    });
  d.childIds.forEach((id, i) =>
    result.push({
      id: `child-${id}`,
      page: 6 + i,
      part: "Part Two — Derivatives",
      title: `14. Child ${i + 1}`,
      childId: id,
      fields: person(`child.${id}`, "14"),
    }),
  );
  result.push({
    id: "consent",
    page: 6 + d.childIds.length,
    part: "Private preparation checklist",
    title: "Permission & personal information",
    fields: [
      f(
        "preparation.consent",
        "I am entering my own information or have permission to prepare this person’s information, including authority for any children listed.",
        "checkbox",
        {
          reference: "Service consent",
          help: "I authorize processing and, when I choose paid saving, private storage of these answers, photos, passport copies, and authorized family information. Saved files expire after 365 days without a save. I can delete my preparation earlier. Read the privacy notice.",
        },
      ),
    ],
  });
  return result.map((s) => ({
    ...s,
    fields: s.fields
      .filter((field) => !field.visible || field.visible(d))
      .map((field, order) => ({
        ...field,
        section: s.id,
        order,
        pdfKey: field.id,
      })),
  }));
}
export const fields = (d) => sections(d).flatMap((s) => s.fields);
export function validate(field, d, now = new Date()) {
  const value = d.answers[field.id];
  if (
    field.id.endsWith(".lastName") &&
    d.answers[field.id.replace(".lastName", ".noLastName")] &&
    d.answers[field.id.replace(".lastName", ".noFirstName")]
  )
    return "At least one name must be provided. Check the official single-name instructions.";
  if (
    field.id === "eligibility.country" &&
    d.answers["eligibility.basis"] === "birth" &&
    value &&
    value !== d.answers["entrant.birthCountry"]
  )
    return "For birth-based eligibility, use your country of birth or review the alternative chargeability rules.";
  if (field.exception && d.answers[field.exception]) return "";
  if (field.type === "photo" || field.type === "passportPhoto") {
    const asset = d.assets[field.id];
    if (!asset) return field.required ? "Upload this document." : "";
    if (asset.status !== "valid")
      return "Review the technical file requirements.";
    if (field.type === "photo" && !asset.confirmed)
      return "Confirm the photo’s recency and visual requirements.";
    return "";
  }
  if (field.type === "checkbox")
    return field.required && !value ? "Confirm this item." : "";
  if (value === undefined || String(value).trim() === "")
    return field.required ? "Complete this field." : "";
  const text = String(value).trim();
  if (text.length > field.maxLength)
    return `Use ${field.maxLength} characters or fewer.`;
  if (field.type === "name" && !/^[A-Za-z][A-Za-z .'-]*$/.test(text))
    return "Use Roman-alphabet letters as shown on your document.";
  if (field.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text))
    return "Enter a valid email address.";
  if (
    field.id === "contact.emailConfirm" &&
    text.toLowerCase() !==
      String(d.answers["contact.email"] || "")
        .trim()
        .toLowerCase()
  )
    return "Email addresses must match.";
  if (field.type === "select" && !field.options.some((o) => o.value === text))
    return "Choose an available option.";
  if (["date", "futureDate"].includes(field.type)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return "Enter a complete date.";
    const date = new Date(`${text}T12:00:00Z`);
    if (
      !Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0, 10) !== text
    )
      return "Enter a real calendar date.";
    const today = now.toISOString().slice(0, 10);
    if (
      field.type === "date" &&
      (text > today || Number(text.slice(0, 4)) < now.getUTCFullYear() - 120)
    )
      return "Check this birth date.";
    if (field.type === "futureDate" && text <= today)
      return "Use a valid, unexpired passport.";
  }
  if (field.type === "passport" && !/^[A-Za-z0-9 -]+$/.test(text))
    return "Check the passport number.";
  return "";
}
export function progress(d, countries = []) {
  const active = fields(d).filter((f) => f.required);
  const remaining = active
    .map((field) => ({
      field,
      error:
        field.type === "country" &&
        d.answers[field.id] &&
        !countries.includes(d.answers[field.id])
          ? "Choose a country from the list."
          : validate(field, d),
    }))
    .filter((x) => x.error);
  return {
    total: active.length,
    complete: active.length - remaining.length,
    percent: active.length
      ? Math.floor(((active.length - remaining.length) / active.length) * 100)
      : 0,
    remaining,
  };
}
export function warnings(d) {
  const out = [FORM_VERSION.notice];
  if (["spouse", "parents"].includes(d.answers["eligibility.basis"]))
    out.push(
      "Alternative chargeability needs careful verification. No eligibility determination has been made.",
    );
  if (d.answers["passport.path"] && !hasPassport(d))
    out.push(
      "Your passport exemption is a stated claim, not an approved exemption.",
    );
  if (d.answers["entrant.marital"] === "separated")
    out.push(
      "Check that your legal separation meets the official instructions. Living apart alone does not qualify.",
    );
  for (const id of d.childIds) {
    const dob = d.answers[`child.${id}.birthDate`];
    if (dob) {
      const date = new Date(dob + "T12:00:00Z"),
        today = new Date();
      let age = today.getUTCFullYear() - date.getUTCFullYear();
      if (
        today.getUTCMonth() < date.getUTCMonth() ||
        (today.getUTCMonth() === date.getUTCMonth() &&
          today.getUTCDate() < date.getUTCDate())
      )
        age--;
      if (age >= 21)
        out.push(
          "A child’s date of birth appears to be age 21 or older. Verify whether this person belongs on the entry.",
        );
    }
  }
  return out;
}
export function worksheetRows(d) {
  return sections(d).map((s) => ({
    ...s,
    fields: s.fields.map((field) => ({
      ...field,
      value:
        field.type === "photo" || field.type === "passportPhoto"
          ? d.assets[field.id]
            ? field.type === "passportPhoto"
              ? "JPEG prepared; verify legibility and all page details"
              : d.assets[field.id].confirmed
                ? "Uploaded; user reviewed"
                : "Uploaded; review needed"
            : "Not uploaded"
          : field.exception && d.answers[field.exception]
            ? field.exceptionLabel
            : field.type === "checkbox"
              ? d.answers[field.id]
                ? "Confirmed"
                : "Not confirmed"
              : field.type === "select" && d.answers[field.id]
                ? field.options.find((o) => o.value === d.answers[field.id])
                    ?.label || "Not provided"
                : String(d.answers[field.id] || "Not provided"),
    })),
  }));
}
