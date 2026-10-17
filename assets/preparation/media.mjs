import { parseMRZ, scanSuggestions } from "./mrz.mjs?v=20261017-workspace-v23";
// Sensitive image data and object URLs live only in memory. Nothing is uploaded here.
export const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
export async function imageType(file) {
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "jpeg";
  if (bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71)
    return "png";
  if (
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  )
    return "webp";
  if (
    String.fromCharCode(...bytes.slice(4, 8)) === "ftyp" &&
    /heic|heix|hevc|hevx|mif1/.test(String.fromCharCode(...bytes.slice(8, 12)))
  )
    return "heic";
  return "";
}
async function decodeHeic(blob) {
  const worker = new Worker("/vendor/heic/worker.js");
  try {
    return await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("HEIC conversion timed out. Try a JPEG.")),
        25000,
      );
      worker.onmessage = ({ data }) => {
        clearTimeout(timer);
        if (data.error)
          reject(new Error("This HEIC image could not be read. Try a JPEG."));
        else if (data.imageData) {
          const c = document.createElement("canvas");
          c.width = data.imageData.width;
          c.height = data.imageData.height;
          c.getContext("2d").putImageData(data.imageData, 0, 0);
          resolve(c);
        } else
          reject(new Error("This HEIC image could not be read. Try a JPEG."));
      };
      worker.onerror = () => {
        clearTimeout(timer);
        reject(new Error("HEIC is unavailable. Try a JPEG."));
      };
      blob
        .arrayBuffer()
        .then((buffer) => worker.postMessage({ id: 1, buffer }, [buffer]));
    });
  } finally {
    worker.terminate();
  }
}
export async function readImage(file) {
  if (!file.size || file.size > MAX_SOURCE_BYTES)
    throw new Error("Choose an image smaller than 20 MB.");
  const type = await imageType(file);
  if (!type)
    throw new Error(
      "Choose a JPEG, PNG, WebP, or HEIC image. PDF files are not supported.",
    );
  let image;
  if (type === "heic") image = await decodeHeic(file);
  else {
    const url = URL.createObjectURL(file);
    try {
      image = await new Promise((resolve, reject) => {
        const im = new Image();
        im.onload = () => resolve(im);
        im.onerror = () =>
          reject(new Error("This image could not be decoded."));
        im.src = url;
      });
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  const width = image.naturalWidth || image.width,
    height = image.naturalHeight || image.height;
  if (width < 100 || height < 100 || width * height > 60000000)
    throw new Error(
      "Choose a clear image between 100 pixels and 60 megapixels.",
    );
  return { image, width, height, type };
}
const jpeg = (canvas, q) =>
  new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error("The image could not be prepared.")),
      "image/jpeg",
      q,
    ),
  );
export async function passportCopy(file) {
  const source = await readImage(file);
  const scale = Math.min(1, 4200 / Math.max(source.width, source.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(source.width * scale);
  canvas.height = Math.round(source.height * scale);
  canvas
    .getContext("2d")
    .drawImage(source.image, 0, 0, canvas.width, canvas.height);
  let blob = await jpeg(canvas, 0.92);
  if (blob.size > 5 * 1024 * 1024) blob = await jpeg(canvas, 0.8);
  if (blob.size > 5 * 1024 * 1024)
    throw new Error("The JPEG copy exceeds 5 MB. Use a smaller clear image.");
  return {
    blob,
    width: canvas.width,
    height: canvas.height,
    status: "valid",
    confirmed: true,
  };
}
export function drawCrop(canvas, source, zoom = 1, x = 50, y = 50) {
  const side = Math.min(source.width, source.height) / zoom;
  const sx = ((source.width - side) * x) / 100,
    sy = ((source.height - side) * y) / 100;
  canvas.width = 600;
  canvas.height = 600;
  const context = canvas.getContext("2d", { alpha: false });
  context.fillStyle = "#fff";
  context.fillRect(0, 0, 600, 600);
  context.drawImage(source.image, sx, sy, side, side, 0, 0, 600, 600);
  return side;
}
export async function photoCopy(canvas) {
  let blob;
  for (const quality of [0.92, 0.85, 0.75, 0.65]) {
    blob = await jpeg(canvas, quality);
    if (blob.size <= 240 * 1024) break;
  }
  if (blob.size > 240 * 1024)
    throw new Error("The photo still exceeds 240 KB. Choose another image.");
  return { blob, width: 600, height: 600, status: "valid", confirmed: false };
}
let libraryPromise;
async function ocrLibrary() {
  if (window.Tesseract) return window.Tesseract;
  if (!libraryPromise)
    libraryPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "/vendor/passport-ocr/tesseract.min.js";
      s.onload = () => resolve(window.Tesseract);
      s.onerror = () => {
        libraryPromise = null;
        s.remove();
        reject(
          new Error("The scanner could not load. Enter the details manually."),
        );
      };
      document.head.append(s);
    });
  return libraryPromise;
}
export async function scanPassport(blob, countries, onProgress, signal) {
  const lib = await ocrLibrary();
  if (signal?.aborted) throw new Error("Scan cancelled.");
  const worker = await lib.createWorker("eng", 1, {
    workerPath: "/vendor/passport-ocr/worker.min.js",
    corePath: "/vendor/passport-ocr/core",
    langPath: "/vendor/passport-ocr/lang/",
    workerBlobURL: false,
    gzip: true,
    cacheMethod: "none",
    logger: (m) => {
      if (m.status === "recognizing text")
        onProgress(Math.round(m.progress * 100));
    },
  });
  let cancel;
  const cancelled = new Promise((_, reject) => {
    cancel = reject;
  });
  const abort = () => cancel(new Error("Scan cancelled."));
  signal?.addEventListener("abort", abort, { once: true });
  try {
    if (signal?.aborted) throw new Error("Scan cancelled.");
    return await Promise.race([
      cancelled,
      (async () => {
        const source = await readImage(blob);
        // Image loaders release their temporary URL. Tesseract must receive pixels,
        // not try to fetch that already-revoked URL again.
        const full = document.createElement("canvas");
        full.width = source.width;
        full.height = source.height;
        full.getContext("2d").drawImage(source.image, 0, 0);
        const result = await worker.recognize(
          full,
          {},
          { text: true, blocks: true },
        );
        let detected = window.gcasPassport.parsePassport(
          result.data.text,
          countries,
          result.data.blocks || [],
        );
        let checked = parseMRZ(result.data.text);
        if (
          checked.status !== "checked" ||
          !detected.firstName ||
          !detected.lastName
        ) {
          await worker.setParameters({
            tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<",
            tessedit_pageseg_mode: "6",
          });
          const canvas = document.createElement("canvas");
          canvas.width = source.width;
          canvas.height = Math.round(source.height * 0.28);
          canvas
            .getContext("2d")
            .drawImage(
              source.image,
              0,
              source.height - canvas.height,
              source.width,
              canvas.height,
              0,
              0,
              source.width,
              canvas.height,
            );
          const mrz = await worker.recognize(canvas);
          const fallback = window.gcasPassport.parsePassport(
            mrz.data.text,
            countries,
          );
          const retry = parseMRZ(mrz.data.text);
          if (retry.status === "checked" || checked.status === "unreadable")
            checked = retry;
          detected = {
            ...detected,
            firstName: detected.firstName || fallback.firstName,
            lastName: detected.lastName || fallback.lastName,
          };
        }
        return scanSuggestions(detected, checked);
      })(),
    ]);
  } finally {
    signal?.removeEventListener("abort", abort);
    await worker.terminate();
  }
}
