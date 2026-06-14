const ROOT_FOLDER_ID = "1_y9GM6OtGX8mKrE4ROTCqtjunP-o9KEC";
const NOTIFICATIONS_FOLDER_NAME = "notifications";
const SHARED_SECRET = "CHANGE_THIS_TO_A_LONG_RANDOM_SECRET";

function doGet() {
  return jsonResponse({
    ok: true,
    service: "greencardapplicationservices-notifications",
    message: "Notification collector is running.",
  });
}

function doPost(e) {
  try {
    const body = parseRequestBody(e);
    validateRequest(body);

    const rootFolder = DriveApp.getFolderById(ROOT_FOLDER_ID);
    const notificationsFolder = getOrCreateFolder(
      rootFolder,
      NOTIFICATIONS_FOLDER_NAME,
    );

    const submittedAt = body.submittedAt || new Date().toISOString();
    const contactKey = cleanText(body.email || body.phone || "unknown-contact");
    const safeContactKey = safeFilePart(contactKey);
    const timestamp = Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone(),
      "yyyyMMdd-HHmmss",
    );
    const id = safeFilePart(body.notificationId || Utilities.getUuid());
    const fileName = `${safeContactKey}_${timestamp}_${id}.json`;

    const payload = {
      receivedAt: new Date().toISOString(),
      submittedAt,
      notificationId: body.notificationId || id,
      website: cleanText(body.website || ""),
      sourcePage: cleanText(body.sourcePage || ""),
      email: cleanText(body.email || ""),
      phone: cleanText(body.phone || ""),
      consent: cleanText(body.consent || ""),
      raw: body,
    };

    const file = notificationsFolder.createFile(
      fileName,
      JSON.stringify(payload, null, 2),
      "application/json",
    );

    return jsonResponse({
      ok: true,
      fileId: file.getId(),
      fileName,
      folderId: notificationsFolder.getId(),
    });
  } catch (error) {
    return jsonResponse({
      ok: false,
      error: error.message || String(error),
    });
  }
}

function parseRequestBody(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw new Error("Missing request body.");
  }

  try {
    return JSON.parse(e.postData.contents);
  } catch (error) {
    throw new Error("Request body must be valid JSON.");
  }
}

function validateRequest(body) {
  if (!body || typeof body !== "object") {
    throw new Error("Invalid request body.");
  }

  if (SHARED_SECRET && body.secret !== SHARED_SECRET) {
    throw new Error("Unauthorized request.");
  }

  const email = cleanText(body.email || "");
  const phone = cleanText(body.phone || "");

  if (!email && !phone) {
    throw new Error("Email or phone is required.");
  }
}

function getOrCreateFolder(parentFolder, folderName) {
  const existingFolders = parentFolder.getFoldersByName(folderName);

  if (existingFolders.hasNext()) {
    return existingFolders.next();
  }

  return parentFolder.createFolder(folderName);
}

function cleanText(value) {
  return String(value || "").trim();
}

function safeFilePart(value) {
  const cleaned = cleanText(value)
    .replace(/[^a-zA-Z0-9@._+-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

  return cleaned || "unknown";
}

function jsonResponse(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
