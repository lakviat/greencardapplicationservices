const MAX_REQUEST_LENGTH = 52 * 1024 * 1024;
const MAX_FILES = 8;
const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MAX_TOTAL_FILE_BYTES = 35 * 1024 * 1024;
const MAX_FORM_AGE_MS = 24 * 60 * 60 * 1000;
const RATE_LIMIT_SECONDS = 120;
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
];
const ALLOWED_EXTENSIONS = ["pdf", "jpg", "jpeg", "png", "heic", "heif"];
const PACKAGE_LIMITS = { single: 1, couple: 2, family: 3, premium: 3 };

// Configure these under Project Settings > Script properties:
// ROOT_FOLDER_ID: the private parent Drive folder ID
// ALLOWED_WEBSITES: greencardapplicationservices.com,www.greencardapplicationservices.com

function doGet() {
  return jsonResponse({ ok: true });
}

function doPost(e) {
  try {
    const body = parseRequestBody(e);
    const payload = validateAndNormalizeRequest(body);
    enforceRateLimit(payload);

    const rootFolderId = requiredScriptProperty("ROOT_FOLDER_ID");
    const lock = LockService.getScriptLock();
    lock.waitLock(15000);

    try {
      const rootFolder = DriveApp.getFolderById(rootFolderId);
      const folder = createSubmissionFolder(rootFolder, payload);
      createCustomerRecord(folder, payload);
      createApplicantFolders(folder, payload.applicants);
      createUploadedFiles(folder, payload.files);
    } finally {
      lock.releaseLock();
    }

    CacheService.getScriptCache().put(
      `submitted-${sha256(payload.submissionId)}`,
      "1",
      21600,
    );
    return jsonResponse({ ok: true, reference: payload.submissionId });
  } catch (error) {
    console.error(error && error.stack ? error.stack : error);
    return jsonResponse({ ok: false, error: "Request rejected." });
  }
}

function parseRequestBody(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw new Error("Missing request body.");
  }
  if (e.postData.contents.length > MAX_REQUEST_LENGTH) {
    throw new Error("Request body is too large.");
  }

  try {
    return JSON.parse(e.postData.contents);
  } catch (error) {
    throw new Error("Request body must be valid JSON.");
  }
}

function validateAndNormalizeRequest(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Invalid request body.");
  }
  if (cleanText(body.companyWebsite, 100)) {
    throw new Error("Automated submission rejected.");
  }

  const website = cleanText(body.website, 100).toLowerCase();
  const allowedWebsites = requiredScriptProperty("ALLOWED_WEBSITES")
    .split(",")
    .map(function (value) {
      return cleanText(value, 100).toLowerCase();
    })
    .filter(String);
  if (allowedWebsites.indexOf(website) === -1) {
    throw new Error("Website is not allowed.");
  }

  const submissionId = cleanText(body.submissionId, 100);
  if (!/^gcas-[a-zA-Z0-9-]{10,95}$/.test(submissionId)) {
    throw new Error("Submission ID is invalid.");
  }
  if (CacheService.getScriptCache().get(`submitted-${sha256(submissionId)}`)) {
    throw new Error("Duplicate submission.");
  }

  const submittedAt = validRecentDate(body.submittedAt, "Submission time");
  const formStartedAt = validRecentDate(body.formStartedAt, "Form start time");
  const formAge = new Date(submittedAt).getTime() - new Date(formStartedAt).getTime();
  if (formAge < 1000 || formAge > MAX_FORM_AGE_MS) {
    throw new Error("Form timing is invalid.");
  }
  if (body.consent !== true) {
    throw new Error("Consent is required.");
  }

  const packageName = cleanText(body.package, 20).toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(PACKAGE_LIMITS, packageName)) {
    throw new Error("Package is invalid.");
  }
  const applicantCount = Number(body.applicantCount);
  if (
    !Number.isInteger(applicantCount) ||
    applicantCount < 1 ||
    applicantCount > PACKAGE_LIMITS[packageName]
  ) {
    throw new Error("Applicant count is invalid.");
  }

  const applicants = normalizeApplicants(body.applicants, applicantCount);
  const primary = applicants[0];
  const files = normalizeFiles(body.files);

  return {
    submissionId: submissionId,
    submittedAt: submittedAt,
    website: website,
    package: packageName,
    packageLabel: cleanText(body.packageLabel, 40),
    applicantCount: applicantCount,
    firstName: primary.firstName,
    middleName: primary.middleName,
    lastName: primary.lastName,
    email: primary.email,
    phone: primary.phone,
    countryOfBirth: primary.countryOfBirth,
    applicants: applicants,
    paymentStatus: `Unverified browser status: ${cleanText(body.paymentStatus, 40) || "pending"}`,
    files: files,
  };
}

function normalizeApplicants(value, expectedCount) {
  if (!Array.isArray(value) || value.length !== expectedCount) {
    throw new Error("Applicants are invalid.");
  }

  return value.map(function (applicant, index) {
    const normalized = {
      applicantNumber: index + 1,
      role: index === 0 ? "Primary" : "Additional",
      firstName: cleanText(applicant.firstName, 100),
      middleName: cleanText(applicant.middleName, 100),
      lastName: cleanText(applicant.lastName, 100),
      relation: cleanText(applicant.relation, 40),
      email: cleanText(applicant.email, 254).toLowerCase(),
      phone: cleanText(applicant.phone, 32),
      countryOfBirth: cleanText(applicant.countryOfBirth, 100),
    };

    if (!normalized.firstName || !normalized.lastName) {
      throw new Error("Applicant legal names are required.");
    }
    if (index === 0 && (!normalized.email || !normalized.phone || !normalized.countryOfBirth)) {
      throw new Error("Primary contact and country are required.");
    }
    if (normalized.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized.email)) {
      throw new Error("Applicant email is invalid.");
    }
    if (normalized.phone && !/^[0-9+().\-\s]{6,32}$/.test(normalized.phone)) {
      throw new Error("Applicant phone is invalid.");
    }
    return normalized;
  });
}

function normalizeFiles(value) {
  const files = Array.isArray(value) ? value : [];
  if (files.length > MAX_FILES) throw new Error("Too many files.");

  let totalBytes = 0;
  return files.map(function (file) {
    const name = cleanText(file.name, 160);
    const mimeType = cleanText(file.mimeType, 80).toLowerCase();
    const extension = name.split(".").pop().toLowerCase();
    if (
      ALLOWED_MIME_TYPES.indexOf(mimeType) === -1 ||
      ALLOWED_EXTENSIONS.indexOf(extension) === -1 ||
      !/^[A-Za-z0-9+/=\r\n]+$/.test(String(file.base64 || ""))
    ) {
      throw new Error("File type is not allowed.");
    }

    const bytes = Utilities.base64Decode(String(file.base64));
    if (!bytes.length || bytes.length > MAX_FILE_BYTES) {
      throw new Error("File size is invalid.");
    }
    totalBytes += bytes.length;
    if (totalBytes > MAX_TOTAL_FILE_BYTES) {
      throw new Error("Total upload size is too large.");
    }

    return { name: name, mimeType: mimeType, bytes: bytes };
  });
}

function enforceRateLimit(payload) {
  const cache = CacheService.getScriptCache();
  const contactKey = sha256(payload.email || payload.phone);
  const rateKey = `intake-${contactKey}`;
  if (cache.get(rateKey)) throw new Error("Duplicate request.");
  cache.put(rateKey, "1", RATE_LIMIT_SECONDS);
}

function createSubmissionFolder(rootFolder, payload) {
  const timestamp = Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    "yyyyMMdd-HHmmss",
  );
  const shortId = safeFilePart(payload.submissionId).slice(-12);
  return rootFolder.createFolder(
    `${safeFilePart(payload.firstName)}-${safeFilePart(payload.lastName)}_${timestamp}_${shortId}`,
  );
}

function createCustomerRecord(folder, payload) {
  const record = {
    receivedAt: new Date().toISOString(),
    submissionId: payload.submissionId,
    submittedAt: payload.submittedAt,
    website: payload.website,
    package: payload.package,
    packageLabel: payload.packageLabel,
    applicantCount: payload.applicantCount,
    paymentStatus: payload.paymentStatus,
    applicants: payload.applicants,
  };
  folder.createFile(
    "customer-information.json",
    JSON.stringify(record, null, 2),
    "application/json",
  );
}

function createApplicantFolders(folder, applicants) {
  applicants.slice(1).forEach(function (applicant) {
    const applicantFolder = folder.createFolder(
      `Applicant-${applicant.applicantNumber}_${safeFilePart(applicant.firstName)}-${safeFilePart(applicant.lastName)}`,
    );
    applicantFolder.createFile(
      "applicant-information.json",
      JSON.stringify(applicant, null, 2),
      "application/json",
    );
  });
}

function createUploadedFiles(folder, files) {
  if (!files.length) return;
  const documentsFolder = folder.createFolder("Documents");
  files.forEach(function (file, index) {
    const safeName = safeFilePart(file.name) || `document-${index + 1}`;
    documentsFolder.createFile(
      Utilities.newBlob(file.bytes, file.mimeType, safeName),
    );
  });
}

function validRecentDate(value, label) {
  const cleaned = cleanText(value, 40);
  const parsed = new Date(cleaned);
  const now = Date.now();
  if (
    !cleaned ||
    Number.isNaN(parsed.getTime()) ||
    parsed.getTime() > now + 5 * 60 * 1000 ||
    parsed.getTime() < now - MAX_FORM_AGE_MS
  ) {
    throw new Error(`${label} is invalid.`);
  }
  return parsed.toISOString();
}

function requiredScriptProperty(name) {
  const value = PropertiesService.getScriptProperties().getProperty(name);
  if (!value) throw new Error(`Missing script property: ${name}`);
  return value;
}

function cleanText(value, maxLength) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength || 200);
}

function safeFilePart(value) {
  return cleanText(value, 160)
    .replace(/[^a-zA-Z0-9@._+-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
}

function sha256(value) {
  return Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(value),
    Utilities.Charset.UTF_8,
  )
    .map(function (byte) {
      return (byte + 256).toString(16).slice(-2);
    })
    .join("");
}

function jsonResponse(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
