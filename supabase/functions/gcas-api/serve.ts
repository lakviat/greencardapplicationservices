// supabase/functions/gcas-api/index.ts
import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import jpeg from "npm:jpeg-js@0.4.4";

// assets/preparation/schema.mjs
var FORM_VERSION = Object.freeze({
  id: "dv2027-preparation-2026-10-16",
  year: 2027,
  status: "provisional",
  verified: "2026-10-16",
  notice: "DV-2027 registration dates are awaiting official confirmation. This worksheet uses the archived DS-5501 structure, DV-2026 instructions, and the March 2026 passport rule. Recheck the final DV-2027 instructions before submitting an official entry.",
  sources: [
    [
      "Archived six-page DS-5501 reference",
      "https://travel.state.gov/content/dam/visas/Sample%20E-DV%202017%20Lottery.pdf"
    ],
    [
      "Official DV instructions",
      "https://travel.state.gov/content/travel/en/us-visas/immigrate/diversity-visa-program-entry/diversity-visa-instructions.html"
    ],
    [
      "March 2026 passport rule",
      "https://www.govinfo.gov/content/pkg/FR-2026-03-11/html/2026-04737.htm"
    ],
    [
      "Registration announcement",
      "https://travel.state.gov/content/travel/en/News/visas-news/changes-to-2027-dv-program-entry-period.html"
    ]
  ]
});
var PACKAGES = Object.freeze({
  single: {
    label: "Single",
    cents: 999,
    description: "One principal worksheet, including every required spouse and child. Free saving and editing; one-time payment for PDF downloads."
  },
  couple: {
    label: "Couple",
    cents: 1999,
    description: "Two independently eligible principal worksheets, with confirmed household-detail reuse. Free saving and editing; one-time payment for both PDFs."
  },
  family: {
    label: "Family",
    cents: 2999,
    description: "Two principal worksheets plus a household document index and family completeness summary. All required derivatives are included on every plan."
  },
  premium: {
    label: "Premium",
    cents: 3999,
    description: "Benefits are under owner review. Purchase is unavailable.",
    disabled: true
  }
});
function checkoutEmail(value, verifiedEmail) {
  const email = typeof value === "string" ? value.trim() : "";
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !/[\r\n\x00-\x1f\x7f]/.test(value) ? email : verifiedEmail;
}
var initialDraft = () => ({
  version: FORM_VERSION.id,
  year: FORM_VERSION.year,
  package: "single",
  answers: {},
  childIds: [],
  assets: {},
  reviewed: false,
  secondEntry: false
});
var hasSpouse = (d) => d.answers["entrant.marital"] === "married";
var hasPassport = (d) => d.answers["passport.path"] === "passport";
var f = (id, label, type = "text", extra = {}) => ({
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
  ...extra
});
var opts = (...labels) => labels.map((label) => ({ value: label, label }));
var EDUCATION = [
  "Primary school only",
  "High school, no degree",
  "High school degree",
  "Vocational school",
  "Some university courses",
  "University degree",
  "Some graduate-level courses",
  "Master\u2019s degree",
  "Some doctoral-level courses",
  "Doctorate degree"
];
var MARITAL = [
  { value: "unmarried", label: "Unmarried" },
  {
    value: "married",
    label: "Married \u2014 spouse is not a U.S. citizen or permanent resident"
  },
  {
    value: "married-us",
    label: "Married \u2014 spouse is a U.S. citizen or permanent resident"
  },
  { value: "divorced", label: "Divorced" },
  { value: "widowed", label: "Widowed" },
  { value: "separated", label: "Legally separated by court order" }
];
function person(prefix, ref, photo = true) {
  const fields3 = [
    f(`${prefix}.lastName`, "Last / family name", "name", {
      reference: `${ref}a`,
      exception: `${prefix}.noLastName`,
      exceptionLabel: "No last / family name",
      help: "Use the Roman-alphabet spelling on your passport. If you have only one name, check the current official instructions."
    }),
    f(`${prefix}.firstName`, "First / given name", "name", {
      reference: `${ref}b`,
      exception: `${prefix}.noFirstName`,
      exceptionLabel: "No first name"
    }),
    f(`${prefix}.middleName`, "Middle name", "name", {
      reference: `${ref}c`,
      exception: `${prefix}.noMiddleName`,
      exceptionLabel: "No middle name",
      help: "Include all middle names shown on your document, or confirm you have none."
    }),
    f(`${prefix}.sex`, "Sex", "select", {
      reference: prefix === "entrant" ? "2" : `${ref}e`,
      options: opts("Male", "Female"),
      help: "Use the categories required by the active official form. Verify the final instructions."
    }),
    f(`${prefix}.birthDate`, "Date of birth", "date", {
      reference: prefix === "entrant" ? "3" : `${ref}d`,
      help: "Enter the date on your birth or identity document. Month / day / year."
    }),
    f(`${prefix}.birthCity`, "City where you were born", "text", {
      reference: prefix === "entrant" ? "4" : `${ref}f`,
      exception: `${prefix}.birthCityUnknown`,
      exceptionLabel: "Birth city unknown",
      help: "City or town only; do not substitute a province or district."
    }),
    f(`${prefix}.birthCountry`, "Country where you were born", "country", {
      reference: prefix === "entrant" ? "5" : `${ref}g`,
      help: "Choose your country of birth, which may differ from your nationality or residence."
    })
  ];
  if (prefix !== "entrant") [fields3[3], fields3[4]] = [fields3[4], fields3[3]];
  if (photo)
    fields3.push(
      f(`${prefix}.photo`, "Photograph", "photo", {
        reference: `${ref}h`,
        help: "Use a recent color photograph of this person. Technical checks do not guarantee acceptance."
      })
    );
  return fields3;
}
function sections(d) {
  const principal = person("entrant", "1", false);
  const result = [
    {
      id: "identity",
      page: 1,
      part: "Part One \u2014 Entrant Information",
      title: "1\u20135. Name, sex & birth information",
      fields: principal
    },
    {
      id: "eligibility",
      page: 1,
      part: "Part One \u2014 Entrant Information",
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
                label: "Spouse\u2019s country of birth \u2014 requires confirmation"
              },
              {
                value: "parents",
                label: "Parent\u2019s country of birth \u2014 requires confirmation"
              }
            ],
            help: "Eligibility usually follows birth, not citizenship. Spouse and parent exceptions have specific legal conditions; do not guess."
          }
        ),
        f(
          "eligibility.country",
          "Country of eligibility / chargeability",
          "country",
          {
            reference: "6a",
            help: "Choose deliberately. We do not infer eligibility or block countries using last year\u2019s list."
          }
        ),
        f(
          "eligibility.explanation",
          "Explain the basis for alternative chargeability",
          "textarea",
          {
            reference: "6b",
            visible: (x) => ["spouse", "parents"].includes(x.answers["eligibility.basis"]),
            maxLength: 1500,
            help: "Record the facts you will verify against the official instructions. This is a private preparation note."
          }
        ),
        f(
          "eligibility.confirm",
          "I will verify my country and any alternative chargeability against the final DV-2027 instructions.",
          "checkbox",
          { reference: "6 review" }
        )
      ]
    },
    {
      id: "photo",
      page: 2,
      part: "Part One \u2014 Entrant Information",
      title: "7. Entrant photograph",
      fields: [
        f("entrant.photo", "Entrant photograph", "photo", {
          reference: "7",
          help: "Prepare a square JPEG. Current baseline: 600 \xD7 600 pixels, no more than 240 KB. Final DV-2027 technical details still require verification."
        })
      ]
    },
    {
      id: "address",
      page: 2,
      part: "Part One \u2014 Entrant Information",
      title: "8. Mailing address",
      fields: [
        f("address.careOf", "In care of", "text", {
          reference: "8a",
          required: false
        }),
        f("address.line1", "Address line 1", "text", {
          reference: "8b",
          maxLength: 160
        }),
        f("address.line2", "Address line 2", "text", {
          reference: "8c",
          required: false,
          maxLength: 160
        }),
        f("address.city", "City / town", "text", { reference: "8d" }),
        f("address.region", "District / county / province / state", "text", {
          reference: "8e"
        }),
        f("address.postal", "Postal / ZIP code", "text", {
          reference: "8f",
          exception: "address.noPostal",
          exceptionLabel: "No postal / ZIP code",
          maxLength: 20
        }),
        f("address.country", "Country", "country", { reference: "8g" })
      ]
    },
    {
      id: "contact",
      page: 3,
      part: "Part One \u2014 Entrant Information",
      title: "9\u201311. Residence & contact",
      fields: [
        f("contact.country", "Country where you live today", "country", {
          reference: "9"
        }),
        f("contact.phone", "Phone number", "tel", {
          reference: "10",
          required: false,
          maxLength: 40
        }),
        f("contact.email", "Email address", "email", {
          reference: "11a",
          maxLength: 254
        }),
        f("contact.emailConfirm", "Confirm email address", "email", {
          reference: "11b",
          maxLength: 254,
          help: "Use an email account you can access. This does not create an account or subscribe you to marketing."
        })
      ]
    },
    {
      id: "education",
      page: 3,
      part: "Part One \u2014 Entrant Information",
      title: "12. Education",
      fields: [
        f(
          "entrant.education",
          "Highest level of education achieved",
          "select",
          {
            reference: "12",
            options: opts(...EDUCATION),
            help: "Selecting a level does not establish eligibility. High-school equivalency certificates alone are not necessarily qualifying; work-experience eligibility has separate criteria."
          }
        ),
        f(
          "education.confirm",
          "I will verify that I meet the education or qualifying work-experience requirement.",
          "checkbox",
          { reference: "12 review" }
        )
      ]
    },
    {
      id: "family",
      page: 3,
      part: "Part One \u2014 Entrant Information",
      title: "13\u201314. Marital status & children",
      fields: [
        f("entrant.marital", "Current marital status", "select", {
          reference: "13",
          options: MARITAL,
          help: "A spouse must generally be listed even if living apart or not immigrating. \u201CLegally separated\u201D requires a court order. Do not list a spouse who is already a U.S. citizen or permanent resident."
        }),
        f(
          "family.confirm",
          "I have checked which living, unmarried children under 21 must be listed, including biological, adopted, and stepchildren.",
          "checkbox",
          {
            reference: "14 review",
            help: "Include required children even if they live elsewhere or will not immigrate. Check exceptions for U.S. citizen or permanent-resident children. Age is determined at official entry."
          }
        )
      ]
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
              label: "I am stateless \u2014 exemption needs verification"
            },
            {
              value: "communist",
              label: "Unable to obtain a passport from a Communist-controlled country of nationality \u2014 exemption needs verification"
            },
            {
              value: "waiver",
              label: "Individual waiver approved or expected under the rule \u2014 needs verification"
            }
          ],
          help: "Cost, difficulty, or conflict alone does not establish an exemption. The final form\u2019s exact exemption process is still pending."
        }),
        f("passport.name", "Full name on passport", "name", {
          visible: hasPassport
        }),
        f("passport.number", "Passport number", "passport", {
          visible: hasPassport,
          maxLength: 30
        }),
        f("passport.issuer", "Country or authority of issuance", "text", {
          visible: hasPassport
        }),
        f("passport.expiry", "Passport expiration date", "futureDate", {
          visible: hasPassport
        }),
        f("passport.bio", "Passport biographic page", "passportPhoto", {
          visible: hasPassport,
          help: "JPEG only, up to 5 MB. Keep every edge and all printed information visible. Kept in this tab until you save; free saving includes the image in private account storage."
        }),
        f(
          "passport.samePage",
          "The signature is on the biographic page I uploaded.",
          "checkbox",
          { visible: hasPassport, required: false }
        ),
        f("passport.signature", "Passport signature page", "passportPhoto", {
          visible: (x) => hasPassport(x) && !x.answers["passport.samePage"],
          help: "Upload a separate JPEG when the signature is on a different page."
        }),
        f("passport.explanation", "Exemption facts to verify", "textarea", {
          visible: (x) => !!x.answers["passport.path"] && !hasPassport(x),
          maxLength: 1500,
          help: "This records your stated basis only. The government decides whether an exemption applies."
        }),
        f(
          "passport.confirm",
          "I will verify my passport or exemption and the final upload requirements before official entry.",
          "checkbox"
        ),
        f(
          "contact.consulate",
          "Consular office nearest your residence",
          "text",
          {
            help: "The March 2026 rule includes this information. If living in the U.S., use the office nearest your last foreign residence; verify the final form."
          }
        )
      ]
    }
  ];
  if (hasSpouse(d))
    result.push({
      id: "spouse",
      page: 5,
      part: "Part Two \u2014 Derivatives",
      title: "13. Spouse information",
      fields: person("spouse", "13")
    });
  d.childIds.forEach(
    (id, i) => result.push({
      id: `child-${id}`,
      page: 6 + i,
      part: "Part Two \u2014 Derivatives",
      title: `14. Child ${i + 1}`,
      childId: id,
      fields: person(`child.${id}`, "14")
    })
  );
  const pages = [...new Set(result.map((s) => s.page))];
  return result.map((s) => ({
    ...s,
    page: pages.indexOf(s.page) + 1,
    fields: s.fields.filter((field) => !field.visible || field.visible(d)).map((field, order) => ({
      ...field,
      section: s.id,
      order,
      pdfKey: field.id
    }))
  }));
}
var fields = (d) => sections(d).flatMap((s) => s.fields);
function storedFields(d) {
  const expanded = {
    ...d,
    answers: {
      ...d.answers,
      "entrant.marital": "married",
      "passport.path": "passport",
      "passport.samePage": false,
      "eligibility.basis": "parents"
    }
  };
  const exemption = {
    ...expanded,
    answers: { ...expanded.answers, "passport.path": "stateless" }
  };
  return [
    ...new Map(
      [...fields(d), ...fields(expanded), ...fields(exemption)].map((f2) => [
        f2.id,
        f2
      ])
    ).values()
  ];
}
function validate(field, d, now = /* @__PURE__ */ new Date()) {
  const value = d.answers[field.id];
  if (field.id.endsWith(".lastName") && d.answers[field.id.replace(".lastName", ".noLastName")] && d.answers[field.id.replace(".lastName", ".noFirstName")])
    return "At least one name must be provided. Check the official single-name instructions.";
  if (field.id === "eligibility.country" && d.answers["eligibility.basis"] === "birth" && value && value !== d.answers["entrant.birthCountry"])
    return "For birth-based eligibility, use your country of birth or review the alternative chargeability rules.";
  if (field.exception && d.answers[field.exception]) return "";
  if (field.type === "photo" || field.type === "passportPhoto") {
    const asset = d.assets[field.id];
    if (!asset) return field.required ? "Upload this document." : "";
    if (asset.status !== "valid")
      return "Review the technical file requirements.";
    if (field.type === "photo" && !asset.confirmed)
      return "Confirm the photo\u2019s recency and visual requirements.";
    return "";
  }
  if (field.type === "checkbox")
    return field.required && !value ? "Confirm this item." : "";
  if (value === void 0 || String(value).trim() === "")
    return field.required ? "Complete this field." : "";
  const text = String(value).trim();
  if (text.length > field.maxLength)
    return `Use ${field.maxLength} characters or fewer.`;
  if (field.type === "name" && !/^[A-Za-z][A-Za-z .'-]*$/.test(text))
    return "Use Roman-alphabet letters as shown on your document.";
  if (field.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text))
    return "Enter a valid email address.";
  if (field.id === "contact.emailConfirm" && text.toLowerCase() !== String(d.answers["contact.email"] || "").trim().toLowerCase())
    return "Email addresses must match.";
  if (field.type === "select" && !field.options.some((o) => o.value === text))
    return "Choose an available option.";
  if (["date", "futureDate"].includes(field.type)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return "Enter a complete date.";
    const date = /* @__PURE__ */ new Date(`${text}T12:00:00Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== text)
      return "Enter a real calendar date.";
    const today = now.toISOString().slice(0, 10);
    if (field.type === "date" && (text > today || Number(text.slice(0, 4)) < now.getUTCFullYear() - 120))
      return "Check this birth date.";
    if (field.type === "futureDate" && text <= today)
      return "Use a valid, unexpired passport.";
  }
  if (field.type === "passport" && !/^[A-Za-z0-9 -]+$/.test(text))
    return "Check the passport number.";
  return "";
}
function progress(d, countries = []) {
  const active = fields(d).filter((f2) => f2.required);
  const remaining = active.map((field) => ({
    field,
    error: field.type === "country" && d.answers[field.id] && !countries.includes(d.answers[field.id]) ? "Choose a country from the list." : validate(field, d)
  })).filter((x) => x.error);
  return {
    total: active.length,
    complete: active.length - remaining.length,
    percent: active.length ? Math.floor((active.length - remaining.length) / active.length * 100) : 0,
    remaining
  };
}
function warnings(d) {
  const out = [FORM_VERSION.notice];
  if (["spouse", "parents"].includes(d.answers["eligibility.basis"]))
    out.push(
      "Alternative chargeability needs careful verification. No eligibility determination has been made."
    );
  if (d.answers["passport.path"] && !hasPassport(d))
    out.push(
      "Your passport exemption is a stated claim, not an approved exemption."
    );
  if (d.answers["entrant.marital"] === "separated")
    out.push(
      "Check that your legal separation meets the official instructions. Living apart alone does not qualify."
    );
  for (const id of d.childIds) {
    const dob = d.answers[`child.${id}.birthDate`];
    if (dob) {
      const date = /* @__PURE__ */ new Date(dob + "T12:00:00Z"), today = /* @__PURE__ */ new Date();
      let age = today.getUTCFullYear() - date.getUTCFullYear();
      if (today.getUTCMonth() < date.getUTCMonth() || today.getUTCMonth() === date.getUTCMonth() && today.getUTCDate() < date.getUTCDate())
        age--;
      if (age >= 21)
        out.push(
          "A child\u2019s date of birth appears to be age 21 or older. Verify whether this person belongs on the entry."
        );
    }
  }
  return out;
}
function worksheetRows(d) {
  return sections(d).map((s) => ({
    ...s,
    fields: s.fields.map((field) => ({
      ...field,
      value: field.type === "photo" || field.type === "passportPhoto" ? d.assets[field.id] ? field.type === "passportPhoto" ? "JPEG prepared; verify legibility and all page details" : d.assets[field.id].confirmed ? "Uploaded; user reviewed" : "Uploaded; review needed" : "Not uploaded" : field.exception && d.answers[field.exception] ? field.exceptionLabel : field.type === "checkbox" ? d.answers[field.id] ? "Confirmed" : "Not confirmed" : field.type === "select" && d.answers[field.id] ? field.options.find((o) => o.value === d.answers[field.id])?.label || "Not provided" : String(d.answers[field.id] || "Not provided")
    }))
  }));
}

// assets/preparation/countries.mjs
var COUNTRIES = [
  {
    code: "AF",
    name: "Afghanistan"
  },
  {
    code: "AL",
    name: "Albania"
  },
  {
    code: "DZ",
    name: "Algeria"
  },
  {
    code: "AS",
    name: "American Samoa"
  },
  {
    code: "AD",
    name: "Andorra"
  },
  {
    code: "AO",
    name: "Angola"
  },
  {
    code: "AI",
    name: "Anguilla"
  },
  {
    code: "AQ",
    name: "Antarctica"
  },
  {
    code: "AG",
    name: "Antigua & Barbuda"
  },
  {
    code: "AR",
    name: "Argentina"
  },
  {
    code: "AM",
    name: "Armenia"
  },
  {
    code: "AW",
    name: "Aruba"
  },
  {
    code: "AU",
    name: "Australia"
  },
  {
    code: "AT",
    name: "Austria"
  },
  {
    code: "AZ",
    name: "Azerbaijan"
  },
  {
    code: "BS",
    name: "Bahamas"
  },
  {
    code: "BH",
    name: "Bahrain"
  },
  {
    code: "BD",
    name: "Bangladesh"
  },
  {
    code: "BB",
    name: "Barbados"
  },
  {
    code: "BY",
    name: "Belarus"
  },
  {
    code: "BE",
    name: "Belgium"
  },
  {
    code: "BZ",
    name: "Belize"
  },
  {
    code: "BJ",
    name: "Benin"
  },
  {
    code: "BM",
    name: "Bermuda"
  },
  {
    code: "BT",
    name: "Bhutan"
  },
  {
    code: "BO",
    name: "Bolivia"
  },
  {
    code: "BA",
    name: "Bosnia & Herzegovina"
  },
  {
    code: "BW",
    name: "Botswana"
  },
  {
    code: "BV",
    name: "Bouvet Island"
  },
  {
    code: "BR",
    name: "Brazil"
  },
  {
    code: "IO",
    name: "British Indian Ocean Territory"
  },
  {
    code: "VG",
    name: "British Virgin Islands"
  },
  {
    code: "BN",
    name: "Brunei"
  },
  {
    code: "BG",
    name: "Bulgaria"
  },
  {
    code: "BF",
    name: "Burkina Faso"
  },
  {
    code: "BI",
    name: "Burundi"
  },
  {
    code: "KH",
    name: "Cambodia"
  },
  {
    code: "CM",
    name: "Cameroon"
  },
  {
    code: "CA",
    name: "Canada"
  },
  {
    code: "CV",
    name: "Cape Verde"
  },
  {
    code: "BQ",
    name: "Caribbean Netherlands"
  },
  {
    code: "KY",
    name: "Cayman Islands"
  },
  {
    code: "CF",
    name: "Central African Republic"
  },
  {
    code: "TD",
    name: "Chad"
  },
  {
    code: "CL",
    name: "Chile"
  },
  {
    code: "CN",
    name: "China"
  },
  {
    code: "CX",
    name: "Christmas Island"
  },
  {
    code: "CC",
    name: "Cocos (Keeling) Islands"
  },
  {
    code: "CO",
    name: "Colombia"
  },
  {
    code: "KM",
    name: "Comoros"
  },
  {
    code: "CG",
    name: "Congo - Brazzaville"
  },
  {
    code: "CD",
    name: "Congo - Kinshasa"
  },
  {
    code: "CK",
    name: "Cook Islands"
  },
  {
    code: "CR",
    name: "Costa Rica"
  },
  {
    code: "HR",
    name: "Croatia"
  },
  {
    code: "CU",
    name: "Cuba"
  },
  {
    code: "CW",
    name: "Cura\xE7ao"
  },
  {
    code: "CY",
    name: "Cyprus"
  },
  {
    code: "CZ",
    name: "Czechia"
  },
  {
    code: "DK",
    name: "Denmark"
  },
  {
    code: "DJ",
    name: "Djibouti"
  },
  {
    code: "DM",
    name: "Dominica"
  },
  {
    code: "DO",
    name: "Dominican Republic"
  },
  {
    code: "EC",
    name: "Ecuador"
  },
  {
    code: "EG",
    name: "Egypt"
  },
  {
    code: "SV",
    name: "El Salvador"
  },
  {
    code: "GQ",
    name: "Equatorial Guinea"
  },
  {
    code: "ER",
    name: "Eritrea"
  },
  {
    code: "EE",
    name: "Estonia"
  },
  {
    code: "SZ",
    name: "Eswatini"
  },
  {
    code: "ET",
    name: "Ethiopia"
  },
  {
    code: "FK",
    name: "Falkland Islands"
  },
  {
    code: "FO",
    name: "Faroe Islands"
  },
  {
    code: "FJ",
    name: "Fiji"
  },
  {
    code: "FI",
    name: "Finland"
  },
  {
    code: "FR",
    name: "France"
  },
  {
    code: "GF",
    name: "French Guiana"
  },
  {
    code: "PF",
    name: "French Polynesia"
  },
  {
    code: "TF",
    name: "French Southern Territories"
  },
  {
    code: "GA",
    name: "Gabon"
  },
  {
    code: "GM",
    name: "Gambia"
  },
  {
    code: "GE",
    name: "Georgia"
  },
  {
    code: "DE",
    name: "Germany"
  },
  {
    code: "GH",
    name: "Ghana"
  },
  {
    code: "GI",
    name: "Gibraltar"
  },
  {
    code: "GR",
    name: "Greece"
  },
  {
    code: "GL",
    name: "Greenland"
  },
  {
    code: "GD",
    name: "Grenada"
  },
  {
    code: "GP",
    name: "Guadeloupe"
  },
  {
    code: "GU",
    name: "Guam"
  },
  {
    code: "GT",
    name: "Guatemala"
  },
  {
    code: "GG",
    name: "Guernsey"
  },
  {
    code: "GN",
    name: "Guinea"
  },
  {
    code: "GW",
    name: "Guinea-Bissau"
  },
  {
    code: "GY",
    name: "Guyana"
  },
  {
    code: "HT",
    name: "Haiti"
  },
  {
    code: "HM",
    name: "Heard & McDonald Islands"
  },
  {
    code: "HN",
    name: "Honduras"
  },
  {
    code: "HK",
    name: "Hong Kong SAR China"
  },
  {
    code: "HU",
    name: "Hungary"
  },
  {
    code: "IS",
    name: "Iceland"
  },
  {
    code: "IN",
    name: "India"
  },
  {
    code: "ID",
    name: "Indonesia"
  },
  {
    code: "IR",
    name: "Iran"
  },
  {
    code: "IQ",
    name: "Iraq"
  },
  {
    code: "IE",
    name: "Ireland"
  },
  {
    code: "IM",
    name: "Isle of Man"
  },
  {
    code: "IL",
    name: "Israel"
  },
  {
    code: "IT",
    name: "Italy"
  },
  {
    code: "JM",
    name: "Jamaica"
  },
  {
    code: "JP",
    name: "Japan"
  },
  {
    code: "JE",
    name: "Jersey"
  },
  {
    code: "JO",
    name: "Jordan"
  },
  {
    code: "KZ",
    name: "Kazakhstan"
  },
  {
    code: "KE",
    name: "Kenya"
  },
  {
    code: "KI",
    name: "Kiribati"
  },
  {
    code: "XK",
    name: "Kosovo"
  },
  {
    code: "KW",
    name: "Kuwait"
  },
  {
    code: "KG",
    name: "Kyrgyzstan"
  },
  {
    code: "LA",
    name: "Laos"
  },
  {
    code: "LV",
    name: "Latvia"
  },
  {
    code: "LB",
    name: "Lebanon"
  },
  {
    code: "LS",
    name: "Lesotho"
  },
  {
    code: "LR",
    name: "Liberia"
  },
  {
    code: "LY",
    name: "Libya"
  },
  {
    code: "LI",
    name: "Liechtenstein"
  },
  {
    code: "LT",
    name: "Lithuania"
  },
  {
    code: "LU",
    name: "Luxembourg"
  },
  {
    code: "MO",
    name: "Macao SAR China"
  },
  {
    code: "MG",
    name: "Madagascar"
  },
  {
    code: "MW",
    name: "Malawi"
  },
  {
    code: "MY",
    name: "Malaysia"
  },
  {
    code: "MV",
    name: "Maldives"
  },
  {
    code: "ML",
    name: "Mali"
  },
  {
    code: "MT",
    name: "Malta"
  },
  {
    code: "MH",
    name: "Marshall Islands"
  },
  {
    code: "MQ",
    name: "Martinique"
  },
  {
    code: "MR",
    name: "Mauritania"
  },
  {
    code: "MU",
    name: "Mauritius"
  },
  {
    code: "YT",
    name: "Mayotte"
  },
  {
    code: "MX",
    name: "Mexico"
  },
  {
    code: "FM",
    name: "Micronesia"
  },
  {
    code: "MD",
    name: "Moldova"
  },
  {
    code: "MC",
    name: "Monaco"
  },
  {
    code: "MN",
    name: "Mongolia"
  },
  {
    code: "ME",
    name: "Montenegro"
  },
  {
    code: "MS",
    name: "Montserrat"
  },
  {
    code: "MA",
    name: "Morocco"
  },
  {
    code: "MZ",
    name: "Mozambique"
  },
  {
    code: "MM",
    name: "Myanmar (Burma)"
  },
  {
    code: "NA",
    name: "Namibia"
  },
  {
    code: "NR",
    name: "Nauru"
  },
  {
    code: "NP",
    name: "Nepal"
  },
  {
    code: "NL",
    name: "Netherlands"
  },
  {
    code: "NC",
    name: "New Caledonia"
  },
  {
    code: "NZ",
    name: "New Zealand"
  },
  {
    code: "NI",
    name: "Nicaragua"
  },
  {
    code: "NE",
    name: "Niger"
  },
  {
    code: "NG",
    name: "Nigeria"
  },
  {
    code: "NU",
    name: "Niue"
  },
  {
    code: "NF",
    name: "Norfolk Island"
  },
  {
    code: "KP",
    name: "North Korea"
  },
  {
    code: "MK",
    name: "North Macedonia"
  },
  {
    code: "XI",
    name: "Northern Ireland"
  },
  {
    code: "MP",
    name: "Northern Mariana Islands"
  },
  {
    code: "NO",
    name: "Norway"
  },
  {
    code: "OM",
    name: "Oman"
  },
  {
    code: "PK",
    name: "Pakistan"
  },
  {
    code: "PW",
    name: "Palau"
  },
  {
    code: "PS",
    name: "Palestinian Territories"
  },
  {
    code: "PA",
    name: "Panama"
  },
  {
    code: "PG",
    name: "Papua New Guinea"
  },
  {
    code: "PY",
    name: "Paraguay"
  },
  {
    code: "PE",
    name: "Peru"
  },
  {
    code: "PH",
    name: "Philippines"
  },
  {
    code: "PN",
    name: "Pitcairn Islands"
  },
  {
    code: "PL",
    name: "Poland"
  },
  {
    code: "PT",
    name: "Portugal"
  },
  {
    code: "PR",
    name: "Puerto Rico"
  },
  {
    code: "QA",
    name: "Qatar"
  },
  {
    code: "RE",
    name: "R\xE9union"
  },
  {
    code: "RO",
    name: "Romania"
  },
  {
    code: "RU",
    name: "Russia"
  },
  {
    code: "RW",
    name: "Rwanda"
  },
  {
    code: "WS",
    name: "Samoa"
  },
  {
    code: "SM",
    name: "San Marino"
  },
  {
    code: "ST",
    name: "S\xE3o Tom\xE9 & Pr\xEDncipe"
  },
  {
    code: "SA",
    name: "Saudi Arabia"
  },
  {
    code: "SN",
    name: "Senegal"
  },
  {
    code: "RS",
    name: "Serbia"
  },
  {
    code: "SC",
    name: "Seychelles"
  },
  {
    code: "SL",
    name: "Sierra Leone"
  },
  {
    code: "SG",
    name: "Singapore"
  },
  {
    code: "SX",
    name: "Sint Maarten"
  },
  {
    code: "SK",
    name: "Slovakia"
  },
  {
    code: "SI",
    name: "Slovenia"
  },
  {
    code: "SB",
    name: "Solomon Islands"
  },
  {
    code: "SO",
    name: "Somalia"
  },
  {
    code: "ZA",
    name: "South Africa"
  },
  {
    code: "GS",
    name: "South Georgia & South Sandwich Islands"
  },
  {
    code: "KR",
    name: "South Korea"
  },
  {
    code: "SS",
    name: "South Sudan"
  },
  {
    code: "ES",
    name: "Spain"
  },
  {
    code: "LK",
    name: "Sri Lanka"
  },
  {
    code: "BL",
    name: "St. Barth\xE9lemy"
  },
  {
    code: "SH",
    name: "St. Helena"
  },
  {
    code: "KN",
    name: "St. Kitts & Nevis"
  },
  {
    code: "LC",
    name: "St. Lucia"
  },
  {
    code: "MF",
    name: "St. Martin"
  },
  {
    code: "PM",
    name: "St. Pierre & Miquelon"
  },
  {
    code: "VC",
    name: "St. Vincent & Grenadines"
  },
  {
    code: "SD",
    name: "Sudan"
  },
  {
    code: "SR",
    name: "Suriname"
  },
  {
    code: "SJ",
    name: "Svalbard & Jan Mayen"
  },
  {
    code: "SE",
    name: "Sweden"
  },
  {
    code: "CH",
    name: "Switzerland"
  },
  {
    code: "SY",
    name: "Syria"
  },
  {
    code: "TW",
    name: "Taiwan"
  },
  {
    code: "TJ",
    name: "Tajikistan"
  },
  {
    code: "TZ",
    name: "Tanzania"
  },
  {
    code: "TH",
    name: "Thailand"
  },
  {
    code: "TL",
    name: "Timor-Leste"
  },
  {
    code: "TG",
    name: "Togo"
  },
  {
    code: "TK",
    name: "Tokelau"
  },
  {
    code: "TO",
    name: "Tonga"
  },
  {
    code: "TT",
    name: "Trinidad & Tobago"
  },
  {
    code: "TN",
    name: "Tunisia"
  },
  {
    code: "TR",
    name: "T\xFCrkiye"
  },
  {
    code: "TM",
    name: "Turkmenistan"
  },
  {
    code: "TC",
    name: "Turks & Caicos Islands"
  },
  {
    code: "TV",
    name: "Tuvalu"
  },
  {
    code: "UM",
    name: "U.S. Outlying Islands"
  },
  {
    code: "VI",
    name: "U.S. Virgin Islands"
  },
  {
    code: "UG",
    name: "Uganda"
  },
  {
    code: "UA",
    name: "Ukraine"
  },
  {
    code: "AE",
    name: "United Arab Emirates"
  },
  {
    code: "GB",
    name: "United Kingdom"
  },
  {
    code: "US",
    name: "United States"
  },
  {
    code: "UY",
    name: "Uruguay"
  },
  {
    code: "UZ",
    name: "Uzbekistan"
  },
  {
    code: "VU",
    name: "Vanuatu"
  },
  {
    code: "VA",
    name: "Vatican City"
  },
  {
    code: "VE",
    name: "Venezuela"
  },
  {
    code: "VN",
    name: "Vietnam"
  },
  {
    code: "WF",
    name: "Wallis & Futuna"
  },
  {
    code: "EH",
    name: "Western Sahara"
  },
  {
    code: "YE",
    name: "Yemen"
  },
  {
    code: "ZM",
    name: "Zambia"
  },
  {
    code: "ZW",
    name: "Zimbabwe"
  }
];

// supabase/functions/gcas-api/core.mjs
var HttpError = class extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
};
var assert = (ok, status, message) => {
  if (!ok) throw new HttpError(status, message);
};
var uuid = (value) => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
  value
);
function plan(key) {
  assert(
    Object.hasOwn(PACKAGES, key) && !PACKAGES[key].disabled,
    400,
    "Choose Single, Couple, or Family."
  );
  return PACKAGES[key];
}
function checkoutEmail2(value, verifiedEmail) {
  return checkoutEmail(value, verifiedEmail);
}
function sanitizePayload(input, pack, storedAssets = []) {
  plan(pack);
  assert(
    input && Array.isArray(input.documents) && input.documents.length > 0 && input.documents.length <= (pack === "single" ? 1 : 2),
    400,
    "This package supports a different number of principal worksheets."
  );
  const ids = /* @__PURE__ */ new Set();
  return {
    documents: input.documents.map((raw) => {
      assert(
        uuid(raw.id) && !ids.has(raw.id),
        400,
        "Invalid or duplicate worksheet ID."
      );
      ids.add(raw.id);
      assert(
        raw.version === FORM_VERSION.id && raw.year === FORM_VERSION.year,
        409,
        "This worksheet version needs review."
      );
      assert(
        Array.isArray(raw.childIds) && raw.childIds.length <= 100 && raw.childIds.every(uuid) && new Set(raw.childIds).size === raw.childIds.length,
        400,
        "Invalid child records."
      );
      assert(
        raw.answers && typeof raw.answers === "object" && !Array.isArray(raw.answers),
        400,
        "Invalid answers."
      );
      const d = {
        ...initialDraft(),
        id: raw.id,
        package: pack,
        childIds: [...raw.childIds],
        secondEntry: !!raw.secondEntry
      };
      const answers = Object.entries(raw.answers);
      assert(answers.length <= 2e3, 413, "Too many fields.");
      for (const [key, value] of answers) {
        assert(
          /^[a-zA-Z0-9.-]{1,120}$/.test(key) && !["__proto__", "constructor", "prototype"].includes(key),
          400,
          "Invalid field."
        );
        assert(
          typeof value === "boolean" || typeof value === "string" && value.length <= 1500,
          400,
          "Invalid answer value."
        );
        d.answers[key] = value;
      }
      const allowed = new Set(
        storedFields(d).flatMap((f2) => [f2.id, f2.exception].filter(Boolean))
      );
      for (const key of Object.keys(d.answers))
        if (!allowed.has(key)) delete d.answers[key];
      for (const f2 of storedFields(d)) {
        const value = d.answers[f2.id];
        if (f2.exception && d.answers[f2.exception] !== void 0)
          assert(
            typeof d.answers[f2.exception] === "boolean",
            400,
            "Invalid name exception."
          );
        if (value !== void 0)
          assert(
            f2.type === "checkbox" ? typeof value === "boolean" : typeof value === "string",
            400,
            "Invalid field type."
          );
        if (typeof value === "string")
          assert(
            value.length <= (f2.maxLength || 1e3),
            400,
            `Field exceeds its length limit: ${f2.label}`
          );
        if (["photo", "passportPhoto"].includes(f2.type) && raw.assets?.[f2.id]) {
          const asset = raw.assets[f2.id];
          const a = storedAssets.find(
            (a2) => a2.id === asset.id && a2.document_id === raw.id && a2.field_id === f2.id
          );
          assert(a, 400, "An uploaded file does not belong to this worksheet.");
          d.assets[f2.id] = {
            id: a.id,
            status: "valid",
            confirmed: asset.confirmed === true,
            width: a.width,
            height: a.height,
            size: a.bytes
          };
        }
      }
      return d;
    })
  };
}
function requireComplete(d) {
  assert(
    progress(
      d,
      COUNTRIES.map((c) => c.name)
    ).remaining.length === 0,
    422,
    "Complete and review every required item before downloading or emailing."
  );
}
async function verifyStripeSignature(raw, header, secret, now = Date.now()) {
  assert(secret && header, 400, "Missing webhook signature.");
  const entries = header.split(",").map((v) => v.trim().split("="));
  const stamp = entries.find((v) => v[0] === "t")?.[1];
  assert(
    /^\d+$/.test(stamp || "") && Math.abs(now / 1e3 - Number(stamp)) <= 300,
    400,
    "Expired webhook signature."
  );
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signed = new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(`${stamp}.${raw}`)
    )
  );
  const expected = Array.from(
    signed,
    (x) => x.toString(16).padStart(2, "0")
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
    "Invalid webhook signature."
  );
  return JSON.parse(raw);
}

// supabase/functions/gcas-api/pdf.mjs
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";

// assets/preparation/presentation.mjs
function questionGroups(section) {
  if (section.id !== "identity")
    return [{ title: section.title, fields: section.fields }];
  return [
    ["1. Name", section.fields.slice(0, 3)],
    ["2. Sex", section.fields.filter((f2) => f2.id.endsWith(".sex"))],
    [
      "3. Birth date",
      section.fields.filter((f2) => f2.id.endsWith(".birthDate"))
    ],
    [
      "4. City where you were born",
      section.fields.filter((f2) => f2.id.endsWith(".birthCity"))
    ],
    [
      "5. Country where you were born",
      section.fields.filter((f2) => f2.id.endsWith(".birthCountry"))
    ]
  ].map(([title, fields3]) => ({ title, fields: fields3 }));
}
function fieldRows(group) {
  const rows = [];
  for (let i = 0; i < group.fields.length; ) {
    const next = group.fields.slice(i, i + 3);
    if (next.length === 3 && next.every((f2) => f2.type === "name")) {
      rows.push(next);
      i += 3;
    } else {
      rows.push([group.fields[i]]);
      i++;
    }
  }
  return rows;
}
function preparedDate(now = /* @__PURE__ */ new Date()) {
  return now.toISOString().slice(0, 10);
}

// supabase/functions/gcas-api/pdf.mjs
async function makePdf(documents, pack, now = /* @__PURE__ */ new Date()) {
  const pdf = await PDFDocument.create();
  const normal = await pdf.embedFont(StandardFonts.Helvetica), bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page, y, documentIndex = 0, year = 2027, part = "";
  const ink = rgb(0.08, 0.17, 0.26), muted = rgb(0.3, 0.38, 0.46), line = rgb(0.76, 0.8, 0.84), yellow = rgb(0.98, 0.88, 0.55);
  function wrap(value, font = normal, size = 10, width = 495) {
    const result = [];
    let current = "";
    for (const word of String(value).replace(/[\r\n\t]/g, " ").split(/\s+/)) {
      if (current && font.widthOfTextAtSize(current + " " + word, size) > width) {
        result.push(current);
        current = "";
      }
      if (font.widthOfTextAtSize(word, size) > width) {
        for (const ch of word) {
          if (font.widthOfTextAtSize(current + ch, size) > width) {
            result.push(current);
            current = "";
          }
          current += ch;
        }
      } else current += (current ? " " : "") + word;
    }
    if (current) result.push(current);
    return result.length ? result : [""];
  }
  function newPage(continued = false) {
    page = pdf.addPage([595, 842]);
    y = 804;
    page.drawText("GREEN CARD APPLICATION SERVICES", {
      x: 40,
      y,
      size: 11,
      font: bold,
      color: ink
    });
    y -= 16;
    page.drawText("Unofficial Preparation Worksheet", {
      x: 40,
      y,
      size: 9,
      font: normal,
      color: muted
    });
    y -= 18;
    page.drawLine({
      start: { x: 40, y },
      end: { x: 555, y },
      thickness: 1,
      color: ink
    });
    y -= 17;
    page.drawText(
      `DV-${year} \xB7 Principal ${documentIndex + 1} \xB7 Prepared ${preparedDate(now)}`,
      { x: 40, y, size: 8, font: normal, color: muted }
    );
    y -= 18;
    page.drawText(part + (continued ? " (continued)" : ""), {
      x: 40,
      y,
      size: 10,
      font: bold,
      color: ink
    });
    y -= 24;
  }
  function heading(title) {
    const lines = wrap(title, bold, 10, 495), h = lines.length * 12 + 10;
    if (y - h < 90) newPage(true);
    page.drawRectangle({
      x: 40,
      y: y - h,
      width: 515,
      height: h,
      color: yellow,
      borderWidth: 0.5,
      borderColor: line
    });
    lines.forEach(
      (s, i) => page.drawText(s, {
        x: 50,
        y: y - 14 - i * 12,
        size: 10,
        font: bold,
        color: ink
      })
    );
    y -= h + 6;
  }
  function row(fields3) {
    const width = 515 / fields3.length;
    const cells = fields3.map((f2) => ({
      label: wrap(`${f2.reference} \xB7 ${f2.label}`, bold, 8, width - 16),
      value: wrap(f2.value, normal, 10, width - 16),
      photo: ["photo", "passportPhoto"].includes(f2.type)
    }));
    const labelLines = Math.max(...cells.map((c) => c.label.length));
    let offset = 0;
    while (offset < Math.max(...cells.map((c) => c.value.length))) {
      if (y < 65 + labelLines * 12 + 28) newPage(true);
      const available = Math.floor((y - 65 - labelLines * 12 - 14) / 14);
      const take = Math.max(
        1,
        Math.min(
          available,
          Math.max(...cells.map((c) => c.value.length - offset))
        )
      );
      const height = labelLines * 12 + take * 14 + 14;
      cells.forEach((cell, i) => {
        const x = 40 + i * width;
        page.drawRectangle({
          x,
          y: y - height,
          width,
          height,
          borderColor: line,
          borderWidth: 0.5
        });
        cell.label.forEach(
          (s, j) => page.drawText(s, {
            x: x + 8,
            y: y - 13 - j * 12,
            size: 8,
            font: bold,
            color: muted
          })
        );
        cell.value.slice(offset, offset + take).forEach(
          (s, j) => page.drawText(s, {
            x: x + 8,
            y: y - 16 - labelLines * 12 - j * 14,
            size: 10,
            font: normal,
            color: ink
          })
        );
      });
      y -= height + 4;
      offset += take;
      if (offset < Math.max(...cells.map((c) => c.value.length))) newPage(true);
    }
    fields3.filter((f2) => ["photo", "passportPhoto"].includes(f2.type)).forEach(
      (f2) => text(
        `Private attachment: ${f2.label}. View the image in this worksheet in My Preparations.`,
        8
      )
    );
  }
  function text(value, size = 9) {
    for (const s of wrap(value, normal, size, 515)) {
      if (y < 65) newPage(true);
      page.drawText(s, { x: 40, y, size, font: normal, color: muted });
      y -= size + 5;
    }
    y -= 5;
  }
  for (const [i, d] of documents.entries()) {
    documentIndex = i;
    year = d.year;
    let logicalPage;
    for (const section of worksheetRows(d)) {
      part = section.part;
      if (section.page !== logicalPage) {
        logicalPage = section.page;
        newPage();
      }
      for (const group of questionGroups(section)) {
        heading(group.title);
        for (const fields3 of fieldRows(group)) row(fields3);
        y -= 6;
      }
    }
    heading("Before official entry");
    text(
      "Independent preparation only. No government entry has been submitted or confirmed."
    );
    warnings(d).forEach((w) => text(w));
    text(
      "Submit your official entry separately at https://dvprogram.state.gov. Verify final instructions at https://travel.state.gov. Do not submit duplicate entries for the same principal."
    );
    text(`Requirements version: ${FORM_VERSION.id}`, 8);
  }
  if (pack === "family") {
    part = "Household document index";
    newPage();
    documents.forEach((d, i) => {
      heading(`Principal ${i + 1} \xB7 ${d.childIds.length} children`);
      worksheetRows(d).forEach(
        (s) => s.fields.filter((f2) => ["photo", "passportPhoto"].includes(f2.type)).forEach((f2) => text(`${s.title} \xB7 ${f2.label}: ${f2.value}`))
      );
    });
  }
  const count = pdf.getPageCount();
  pdf.getPages().forEach(
    (p, i) => p.drawText(
      `Unofficial Preparation Worksheet \xB7 Page ${i + 1} of ${count}`,
      { x: 40, y: 28, size: 8, font: normal, color: muted }
    )
  );
  return pdf.save();
}

// supabase/functions/gcas-api/email.mjs
import nodemailer from "npm:nodemailer@10.1.2";
function emailReady(env2) {
  return !!env2("EMAIL_FROM") && (env2("SMTP_HOST") ? !!(env2("SMTP_USER") && env2("SMTP_PASSWORD")) : !!env2("SENDGRID_API_KEY"));
}
async function sendReadyEmail(env2, recipient, origin2) {
  const subject = "Your DV Lottery Preparation Worksheet Is Ready";
  const text = `Your preparation worksheet is available. Sign in with this email address to download it securely:

${origin2}/prepare.html#dashboard

You can correct and download your purchased preparation again without another charge. Submit the government entry separately at https://dvprogram.state.gov. We are an independent preparation service, not a government agency. Support: info@greencardapplicationservices.com`;
  const from = {
    address: env2("EMAIL_FROM"),
    name: "Green Card Application Services"
  };
  if (env2("SMTP_HOST")) {
    const transport = nodemailer.createTransport({
      host: env2("SMTP_HOST"),
      port: Number(env2("SMTP_PORT") || 465),
      secure: true,
      auth: { user: env2("SMTP_USER"), pass: env2("SMTP_PASSWORD") },
      tls: { minVersion: "TLSv1.2" },
      connectionTimeout: 15e3,
      greetingTimeout: 1e4,
      socketTimeout: 2e4,
      disableFileAccess: true,
      disableUrlAccess: true,
      logger: false,
      debug: false
    });
    try {
      const result = await transport.sendMail({
        from,
        to: { address: recipient },
        subject,
        text
      });
      return result.accepted?.some(
        (address) => String(address).toLowerCase() === recipient.toLowerCase()
      ) === true;
    } finally {
      transport.close();
    }
  }
  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    signal: AbortSignal.timeout(2e4),
    headers: {
      Authorization: `Bearer ${env2("SENDGRID_API_KEY")}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: recipient }] }],
      from: { email: from.address, name: from.name },
      subject,
      content: [{ type: "text/plain", value: text }],
      tracking_settings: {
        click_tracking: { enable: false, enable_text: false },
        open_tracking: { enable: false }
      }
    })
  });
  return response.ok;
}

// supabase/functions/gcas-api/index.ts
var env = (name) => Deno.env.get(name) || "";
var origin = env("PUBLIC_APP_ORIGIN") || "https://greencardapplicationservices.com";
var origins = /* @__PURE__ */ new Set([
  origin,
  ...env("GCAS_EXTRA_ORIGINS").split(",").filter(Boolean)
]);
var admin = createClient(
  env("SUPABASE_URL"),
  env("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { persistSession: false, autoRefreshToken: false } }
);
var bucket = admin.storage.from("gcas-private");
var stripeKey = () => env("STRIPE_SECRET_KEY").trim();
var ready = () => env("GCAS_AUTH_READY") === "true";
var checkoutReady = () => ready() && env("GCAS_CHECKOUT_ENABLED") === "true" && /^(sk|rk)_(live|test)_[A-Za-z0-9]{20,}$/.test(stripeKey()) && !!env("STRIPE_WEBHOOK_SECRET");
function check(result) {
  if (result.error)
    throw new HttpError(
      503,
      "The service could not complete this request. Please retry."
    );
  return result.data;
}
async function stripe(path, body, idempotency) {
  assert(stripeKey(), 503, "Checkout is not configured yet.");
  const res = await fetch("https://api.stripe.com/v1/" + path, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${stripeKey()}`,
      ...body ? { "Content-Type": "application/x-www-form-urlencoded" } : {},
      ...idempotency ? { "Idempotency-Key": idempotency } : {}
    },
    body
  });
  const data = await res.json();
  if (!res.ok) {
    const safe = (value) => typeof value === "string" && /^[A-Za-z0-9_]{1,80}$/.test(value) ? value : void 0;
    console.error("stripe_request_failed", {
      status: res.status,
      type: safe(data.error?.type),
      code: safe(data.error?.code),
      request: safe(res.headers.get("request-id"))
    });
  }
  assert(
    res.ok,
    503,
    "Payment service unavailable. Your saved preparation is still in your account."
  );
  return data;
}
async function owned(id, userId, paid = false) {
  assert(uuid(id), 400, "Invalid preparation.");
  const p = check(
    await admin.from("gcas_preparations").select("*").eq("id", id).eq("owner_id", userId).neq("state", "deleted").maybeSingle()
  );
  assert(
    p && new Date(p.expires_at).getTime() > Date.now(),
    404,
    "Preparation not found or expired."
  );
  if (paid) assert(p.state === "paid", 402, "Verified payment is required.");
  return p;
}
async function limited(key, limit = 60, seconds = 60) {
  assert(
    check(
      await admin.rpc("gcas_limit", {
        p_key: key,
        p_limit: limit,
        p_seconds: seconds
      })
    ),
    429,
    "Please wait before trying again."
  );
}
async function bodyJson(req, max = 524288) {
  const raw = await bounded(req, max);
  try {
    return JSON.parse(new TextDecoder().decode(raw));
  } catch {
    throw new HttpError(400, "Invalid request.");
  }
}
async function bounded(req, max) {
  assert(
    Number(req.headers.get("content-length") || 0) <= max,
    413,
    "File or request is too large."
  );
  const reader = req.body?.getReader();
  assert(reader, 400, "Request body required.");
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > max) {
      await reader.cancel();
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
    await admin.from("gcas_storage_cleanup").select("object_path").limit(100)
  );
  if (rows.length) {
    check(await bucket.remove(rows.map((r) => r.object_path)));
    check(
      await admin.from("gcas_storage_cleanup").delete().in(
        "object_path",
        rows.map((r) => r.object_path)
      )
    );
  }
}
async function webhook(req) {
  const raw = new TextDecoder().decode(await bounded(req, 262144));
  const event = await verifyStripeSignature(
    raw,
    req.headers.get("stripe-signature"),
    env("STRIPE_WEBHOOK_SECRET")
  );
  if ([
    "checkout.session.completed",
    "checkout.session.async_payment_succeeded"
  ].includes(event.type)) {
    const session = await stripe(
      `checkout/sessions/${encodeURIComponent(event.data.object.id)}?expand[]=payment_intent.latest_charge`
    );
    const orderId = session.metadata?.gcas_order;
    if (!uuid(orderId)) return { received: true, ignored: true };
    const order = check(
      await admin.from("gcas_orders").select("*").eq("id", orderId).single()
    );
    assert(
      session.mode === "payment" && session.currency === "usd" && session.amount_total === order.amount && session.client_reference_id === order.preparation_id && session.livemode === /^(sk|rk)_live_/.test(stripeKey()),
      400,
      "Payment details do not match."
    );
    if (session.payment_status !== "paid")
      return { received: true, pending: true };
    const pi = session.payment_intent;
    assert(
      pi?.id && pi.status === "succeeded" && pi.amount_received === order.amount,
      400,
      "Payment is not complete."
    );
    check(
      await admin.rpc("gcas_payment", {
        p_event: event.id,
        p_type: event.type,
        p_order: order.id,
        p_session: session.id,
        p_payment: pi.id,
        p_amount: order.amount,
        p_paid: !(pi.latest_charge?.refunded || pi.latest_charge?.disputed || pi.latest_charge?.amount_refunded > 0)
      })
    );
  } else if (["charge.refunded", "charge.dispute.created"].includes(event.type)) {
    const object = event.data.object;
    const charge = event.type === "charge.dispute.created" ? await stripe(`charges/${encodeURIComponent(object.charge)}`) : await stripe(`charges/${encodeURIComponent(object.id)}`);
    const order = check(
      await admin.from("gcas_orders").select("*").eq("payment_id", charge.payment_intent).maybeSingle()
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
          p_paid: false
        })
      );
  }
  return { received: true };
}
async function handle(req, url) {
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
      premium: false
    };
  assert(req.method === "POST", 405, "Use POST.");
  const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
  assert(token, 401, "Sign in to continue.");
  const { data, error } = await admin.auth.getUser(token);
  assert(!error && data.user?.email_confirmed_at, 401, "Please sign in again.");
  const user = data.user;
  await limited(`${user.id}:all`);
  if (route === "list")
    return {
      preparations: check(
        await admin.from("gcas_preparations").select(
          "id,package,version,year,revision,state,updated_at,expires_at"
        ).eq("owner_id", user.id).neq("state", "deleted").or("revision.gt.0,state.eq.paid").gt("expires_at", (/* @__PURE__ */ new Date()).toISOString()).order("updated_at", { ascending: false })
      )
    };
  if (route === "upload") {
    await limited(`${user.id}:upload`, 20);
    const id = url.searchParams.get("id") || "", documentId = url.searchParams.get("document") || "", field = url.searchParams.get("field") || "";
    await owned(id, user.id);
    assert(
      uuid(documentId) && /^(entrant|spouse|passport|child\.[0-9a-f-]{36})\.[a-zA-Z]+$/.test(
        field
      ),
      400,
      "Invalid file destination."
    );
    const photo = field.endsWith(".photo");
    assert(
      photo || ["passport.bio", "passport.signature"].includes(field),
      400,
      "Unsupported file field."
    );
    assert(
      req.headers.get("content-type") === "image/jpeg",
      400,
      "Use a JPEG image."
    );
    const bytes = await bounded(req, photo ? 245760 : 5242880);
    assert(
      bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255,
      400,
      "Invalid JPEG."
    );
    let decoded;
    try {
      decoded = jpeg.decode(bytes, {
        useTArray: true,
        maxResolutionInMP: 20,
        maxMemoryUsageInMB: 128
      });
    } catch {
      throw new HttpError(400, "This image could not be decoded safely.");
    }
    assert(
      photo ? decoded.width === 600 && decoded.height === 600 : decoded.width >= 100 && decoded.height >= 100 && decoded.width <= 5e3 && decoded.height <= 5e3,
      400,
      "Image dimensions do not meet the requirements."
    );
    const clean = jpeg.encode(decoded, photo ? 85 : 90).data;
    assert(
      clean.length <= (photo ? 245760 : 5242880),
      413,
      "Prepared image is too large."
    );
    const assetId = crypto.randomUUID(), path = `${user.id}/${id}/${assetId}.jpg`;
    check(
      await bucket.upload(path, clean, {
        contentType: "image/jpeg",
        upsert: false,
        cacheControl: "0"
      })
    );
    const inserted = await admin.from("gcas_assets").insert({
      id: assetId,
      preparation_id: id,
      document_id: documentId,
      field_id: field,
      object_path: path,
      bytes: clean.length,
      width: decoded.width,
      height: decoded.height
    });
    if (inserted.error) {
      await bucket.remove([path]);
      throw new HttpError(
        409,
        "Preparation changed. Please reload before uploading."
      );
    }
    return {
      id: assetId,
      width: decoded.width,
      height: decoded.height,
      size: clean.length
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
      p_year: FORM_VERSION.year
    });
    if (result.error?.code === "42501")
      throw new HttpError(404, "Preparation not found or expired.");
    if (result.error?.code === "54000")
      throw new HttpError(
        409,
        "Your account has 50 active preparations. Delete an unused draft before starting another."
      );
    const p2 = check(result);
    return {
      preparation: {
        id: p2.id,
        revision: p2.revision,
        state: p2.state,
        package: p2.package
      }
    };
  }
  if (route === "checkout") {
    assert(
      checkoutReady(),
      503,
      "Checkout is awaiting activation. No payment was taken."
    );
    assert(uuid(body.id), 400, "Invalid preparation ID.");
    const selected = plan(body.package);
    const contactEmail = checkoutEmail2(body.contactEmail, user.email);
    let p2 = check(
      await admin.from("gcas_preparations").select("*").eq("id", body.id).maybeSingle()
    );
    if (!p2) {
      check(
        await admin.from("gcas_preparations").insert({
          id: body.id,
          owner_id: user.id,
          package: body.package,
          version: FORM_VERSION.id,
          year: FORM_VERSION.year
        })
      );
      p2 = await owned(body.id, user.id);
    }
    assert(
      p2.owner_id === user.id && p2.package === body.package && p2.state !== "deleted",
      409,
      "This preparation has a different owner or package."
    );
    if (p2.state === "paid") return { paid: true };
    assert(
      p2.state === "unpaid",
      409,
      "Contact support about this preparation."
    );
    let order = check(
      await admin.from("gcas_orders").select("*").eq("preparation_id", p2.id).eq("state", "pending").maybeSingle()
    );
    if (order?.session_id) {
      const session2 = await stripe(
        `checkout/sessions/${encodeURIComponent(order.session_id)}`
      );
      if (session2.status === "open") return { url: session2.url };
      assert(
        session2.status === "expired",
        409,
        "Payment is being verified. Check again shortly."
      );
      check(
        await admin.from("gcas_orders").update({ state: "expired" }).eq("id", order.id)
      );
      order = null;
    }
    if (order && !order.session_id && Date.parse(order.created_at) + 828e5 <= Date.now()) {
      check(
        await admin.from("gcas_orders").update({ state: "expired" }).eq("id", order.id).eq("state", "pending")
      );
      order = null;
    }
    await limited(`${user.id}:checkout`, 5, 3600);
    if (!order) {
      const insert = await admin.from("gcas_orders").insert({ preparation_id: p2.id, amount: selected.cents }).select().single();
      if (insert.error?.code === "23505")
        order = check(
          await admin.from("gcas_orders").select("*").eq("preparation_id", p2.id).eq("state", "pending").single()
        );
      else order = check(insert);
    }
    const params = new URLSearchParams({
      mode: "payment",
      "payment_method_types[0]": "card",
      expires_at: String(
        Math.floor(Date.parse(order.created_at) / 1e3) + 82800
      ),
      client_reference_id: p2.id,
      customer_email: contactEmail,
      "line_items[0][price_data][currency]": "usd",
      "line_items[0][price_data][unit_amount]": String(selected.cents),
      "line_items[0][price_data][product_data][name]": `${selected.label} DV-${FORM_VERSION.year} preparation \u2014 unofficial`,
      "line_items[0][quantity]": "1",
      "metadata[gcas_order]": order.id,
      "payment_intent_data[metadata][gcas_order]": order.id,
      success_url: `${origin}/payment-return.html?result=success`,
      cancel_url: `${origin}/payment-return.html?result=canceled`
    });
    const session = await stripe(
      "checkout/sessions",
      params,
      `gcas-${order.id}`
    );
    check(
      await admin.from("gcas_orders").update({ session_id: session.id, checkout_url: session.url }).eq("id", order.id)
    );
    return { url: session.url };
  }
  const p = await owned(body.id, user.id, ["pdf", "email"].includes(route));
  if (route === "get") return { preparation: p };
  if (route === "save") {
    const assets = check(
      await admin.from("gcas_assets").select("*").eq("preparation_id", p.id)
    );
    const selectedPackage = body.package ?? p.package;
    const payload = sanitizePayload(body.payload, selectedPackage, assets);
    assert(
      Number.isInteger(body.revision) && body.revision >= 0,
      400,
      "Invalid revision."
    );
    const result = await admin.rpc("gcas_save", {
      p_id: p.id,
      p_owner: user.id,
      p_revision: body.revision,
      p_payload: payload,
      p_package: selectedPackage
    });
    if (result.error?.code === "55000")
      throw new HttpError(
        409,
        "This package is locked by a purchase or open checkout. Reopen the preparation to use its saved package."
      );
    if (result.error?.code === "40001")
      throw new HttpError(
        409,
        "A newer version was saved elsewhere. Reopen it before editing; your current work stays in this tab."
      );
    return { preparation: check(result) };
  }
  if (route === "asset") {
    const a = check(
      await admin.from("gcas_assets").select("*").eq("id", body.asset).eq("preparation_id", p.id).maybeSingle()
    );
    assert(a, 404, "Image not found.");
    const blob = check(await bucket.download(a.object_path));
    return new Response(blob, {
      headers: { "Content-Type": "image/jpeg", "Cache-Control": "no-store" }
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
  if (["pdf", "email"].includes(route)) {
    assert(
      p.payload.documents.length > 0,
      422,
      "Save your completed worksheet first."
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
          "PDF generation could not preserve these characters. Contact support; your saved answers have not changed."
        );
      }
      return new Response(bytes, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="DV-${p.year}-preparation.pdf"`,
          "Cache-Control": "no-store"
        }
      });
    }
    assert(emailReady(env), 503, "Email delivery is not configured yet.");
    await limited(`${user.id}:email`, 3, 3600);
    const job = check(
      await admin.from("gcas_deliveries").insert({ preparation_id: p.id, revision: p.revision }).select("id").single()
    );
    let accepted = false;
    try {
      accepted = await sendReadyEmail(env, user.email, origin);
    } catch {
    }
    check(
      await admin.from("gcas_deliveries").update({
        state: accepted ? "sent" : "failed",
        sent_at: accepted ? (/* @__PURE__ */ new Date()).toISOString() : null
      }).eq("id", job.id)
    );
    assert(accepted, 503, "Email was not accepted. Please try again later.");
    return { accepted: true };
  }
  throw new HttpError(404, "Unknown operation.");
}
Deno.serve(async (req) => {
  const url = new URL(req.url), requestOrigin = req.headers.get("origin"), isWebhook = url.pathname.endsWith("/webhook");
  const headers = {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    Vary: "Origin",
    ...requestOrigin && origins.has(requestOrigin) ? {
      "Access-Control-Allow-Origin": requestOrigin,
      "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS"
    } : {}
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
        error: known ? e.message : "The service could not complete this request. Please retry."
      },
      { status: known ? e.status : 500, headers }
    );
  }
});
