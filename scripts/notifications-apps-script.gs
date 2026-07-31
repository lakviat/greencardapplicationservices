const NOTIFICATIONS_FOLDER_NAME = "notifications";
const MAX_REQUEST_LENGTH = 12 * 1024;
const MIN_FORM_AGE_MS = 1000;
const MAX_FORM_AGE_MS = 24 * 60 * 60 * 1000;
const RATE_LIMIT_SECONDS = 60;

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
    lock.waitLock(10000);

    try {
      const rootFolder = DriveApp.getFolderById(rootFolderId);
      const notificationsFolder = getOrCreateFolder(
        rootFolder,
        NOTIFICATIONS_FOLDER_NAME,
      );
      const timestamp = Utilities.formatDate(
        new Date(),
        Session.getScriptTimeZone(),
        "yyyyMMdd-HHmmss",
      );
      const fileName = `${safeFilePart(payload.email || payload.phone)}_${timestamp}_${safeFilePart(payload.notificationId)}.json`;

      notificationsFolder.createFile(
        fileName,
        JSON.stringify(
          {
            receivedAt: new Date().toISOString(),
            submittedAt: payload.submittedAt,
            notificationId: payload.notificationId,
            website: payload.website,
            sourcePage: payload.sourcePage,
            email: payload.email,
            phone: payload.phone,
            consent: payload.consent,
          },
          null,
          2,
        ),
        "application/json",
      );
    } finally {
      lock.releaseLock();
    }

    return jsonResponse({ ok: true });
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

  if (cleanText(body.notifyCompanyWebsite, 100)) {
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

  const email = cleanText(body.email, 254).toLowerCase();
  const phone = cleanText(body.phone, 32);

  if (!email && !phone) {
    throw new Error("Email or phone is required.");
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Email is invalid.");
  }

  if (phone && !/^[0-9+().\-\s]{6,32}$/.test(phone)) {
    throw new Error("Phone is invalid.");
  }

  const submittedAt = validRecentDate(body.submittedAt, "Submission time");
  const formStartedAt = validRecentDate(body.formStartedAt, "Form start time");
  const formAge = new Date(submittedAt).getTime() - new Date(formStartedAt).getTime();

  if (formAge < MIN_FORM_AGE_MS || formAge > MAX_FORM_AGE_MS) {
    throw new Error("Form timing is invalid.");
  }

  const consent = cleanText(body.consent, 240);
  if (!consent) {
    throw new Error("Consent is required.");
  }

  return {
    notificationId: cleanText(body.notificationId || Utilities.getUuid(), 100),
    submittedAt: submittedAt,
    website: website,
    sourcePage: cleanPath(body.sourcePage),
    email: email,
    phone: phone,
    consent: consent,
  };
}

function enforceRateLimit(payload) {
  const cache = CacheService.getScriptCache();
  const rateKey = `notify-${sha256(payload.email || payload.phone)}`;

  if (cache.get(rateKey)) {
    throw new Error("Duplicate request.");
  }

  cache.put(rateKey, "1", RATE_LIMIT_SECONDS);
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

function getOrCreateFolder(parentFolder, folderName) {
  const existingFolders = parentFolder.getFoldersByName(folderName);
  return existingFolders.hasNext()
    ? existingFolders.next()
    : parentFolder.createFolder(folderName);
}

function cleanText(value, maxLength) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength || 200);
}

function cleanPath(value) {
  const path = cleanText(value, 200);
  return path.charAt(0) === "/" ? path : "/";
}

function safeFilePart(value) {
  const cleaned = cleanText(value, 100)
    .replace(/[^a-zA-Z0-9@._+-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return cleaned || "unknown";
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
