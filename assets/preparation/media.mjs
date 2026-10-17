import {
  parseMRZ,
  mergeMRZ,
  scanSuggestions,
} from "./mrz.mjs?v=20261017-workspace-v28";
import { parsePrintedPassport } from "./passport-fields.mjs?v=20261017-workspace-v28";
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
        let detected = {},
          checked = parseMRZ("");
        const names = window.gcasPassport.createNameReader();
        const collect = (data, { printedOnly = false } = {}) => {
          names.add(data.text, data.blocks || [], { printedOnly });
          const legacy = window.gcasPassport.parsePassport(
            data.text,
            countries,
            data.blocks || [],
          );
          const printed = parsePrintedPassport(data.text, data.blocks || []);
          for (const [key, value] of Object.entries({
            ...legacy,
            ...printed,
          })) {
            if (["firstName", "lastName", "middleName"].includes(key)) continue;
            if (key === "issues")
              detected.issues = [
                ...new Set([...(detected.issues || []), ...value]),
              ];
            else if (value && !detected[key]) detected[key] = value;
          }
          if (!printedOnly) checked = mergeMRZ(checked, parseMRZ(data.text));
        };
        const suggestions = () => {
          const nameResult = names.result();
          return scanSuggestions(
            {
              ...detected,
              ...nameResult,
              issues: [...(detected.issues || []), ...nameResult.issues],
            },
            checked,
          );
        };
        const enough = () => {
          const v = suggestions();
          return (
            v.firstName &&
            v.lastName &&
            v.number &&
            v.birthDate &&
            v.expiry &&
            v.issuer
          );
        };
        // Keep the original sampling for clear images: enlarging already sharp
        // MRZ glyphs can turn chevrons into K/L and lose part of a given name.
        const nativeScale = Math.min(
          1,
          2600 / Math.max(source.width, source.height),
        );
        const native = document.createElement("canvas");
        native.width = Math.round(source.width * nativeScale);
        native.height = Math.round(source.height * nativeScale);
        native
          .getContext("2d")
          .drawImage(source.image, 0, 0, native.width, native.height);
        collect(
          (await worker.recognize(native, {}, { text: true, blocks: true }))
            .data,
        );
        // A name's MRZ row has no checksum. Read the printed labels separately
        // before accepting it, even when the document number/dates passed.
        if (names.needsPrintedNames()) {
          await worker.setParameters({
            tessedit_pageseg_mode: "11",
            tessedit_char_whitelist: "",
          });
          collect(
            (await worker.recognize(native, {}, { text: true, blocks: true }))
              .data,
            { printedOnly: true },
          );
        }
        if (!enough()) {
          await worker.setParameters({
            tessedit_pageseg_mode: "6",
            tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<",
          });
          const strip = document.createElement("canvas");
          strip.width = native.width;
          strip.height = Math.round(native.height * 0.28);
          strip
            .getContext("2d")
            .drawImage(
              native,
              0,
              native.height - strip.height,
              native.width,
              strip.height,
              0,
              0,
              strip.width,
              strip.height,
            );
          collect((await worker.recognize(strip)).data);
          strip.width = strip.height = 0;
        }
        native.width = native.height = 0;
        if (enough()) return suggestions();
        // Work at useful OCR resolution without retaining multiple large images.
        const scale = Math.min(2, 2600 / Math.max(source.width, source.height));
        for (const degrees of [0, 180, 90, 270]) {
          if (signal?.aborted) throw new Error("Scan cancelled.");
          const full = document.createElement("canvas");
          const rotated = degrees % 180 !== 0;
          full.width = Math.round(
            (rotated ? source.height : source.width) * scale,
          );
          full.height = Math.round(
            (rotated ? source.width : source.height) * scale,
          );
          const ctx = full.getContext("2d");
          ctx.fillStyle = "white";
          ctx.fillRect(0, 0, full.width, full.height);
          ctx.translate(full.width / 2, full.height / 2);
          ctx.rotate((degrees * Math.PI) / 180);
          ctx.drawImage(
            source.image,
            (-source.width * scale) / 2,
            (-source.height * scale) / 2,
            source.width * scale,
            source.height * scale,
          );
          await worker.setParameters({
            tessedit_pageseg_mode: "3",
            tessedit_char_whitelist: "",
          });
          const result = await worker.recognize(
            full,
            { rotateAuto: true },
            { text: true, blocks: true },
          );
          collect(result.data);
          if (checked.status !== "checked") {
            await worker.setParameters({
              tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<",
              tessedit_pageseg_mode: "6",
            });
            const strip = document.createElement("canvas");
            strip.width = full.width;
            strip.height = Math.round(full.height * 0.38);
            const sc = strip.getContext("2d", { willReadFrequently: true });
            sc.drawImage(
              full,
              0,
              full.height - strip.height,
              full.width,
              strip.height,
              0,
              0,
              strip.width,
              strip.height,
            );
            const pixels = sc.getImageData(0, 0, strip.width, strip.height);
            const histogram = new Uint32Array(256);
            for (let i = 0; i < pixels.data.length; i += 4)
              histogram[
                Math.round(
                  0.299 * pixels.data[i] +
                    0.587 * pixels.data[i + 1] +
                    0.114 * pixels.data[i + 2],
                )
              ]++;
            const total = strip.width * strip.height;
            let low = 0,
              high = 255,
              count = 0;
            while (low < 254 && (count += histogram[low]) < total * 0.01) low++;
            count = 0;
            while (high > low + 1 && (count += histogram[high]) < total * 0.01)
              high--;
            for (let i = 0; i < pixels.data.length; i += 4) {
              const gray =
                0.299 * pixels.data[i] +
                0.587 * pixels.data[i + 1] +
                0.114 * pixels.data[i + 2];
              const value = Math.max(
                0,
                Math.min(255, ((gray - low) * 255) / Math.max(1, high - low)),
              );
              pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = value;
            }
            sc.putImageData(pixels, 0, 0);
            const mrz = await worker.recognize(strip, { rotateAuto: true });
            collect(mrz.data);
            strip.width = strip.height = 0;
          }
          // If the page is upright but labels were missed, a sparse-text pass
          // recovers small separate fields without guessing from nationality.
          if (!enough() && suggestions().firstName && suggestions().lastName) {
            await worker.setParameters({
              tessedit_pageseg_mode: "11",
              tessedit_char_whitelist: "",
            });
            collect(
              (
                await worker.recognize(
                  full,
                  { rotateAuto: true },
                  { text: true, blocks: true },
                )
              ).data,
              { printedOnly: true },
            );
          }
          full.width = full.height = 0;
          if (
            enough() ||
            checked.status === "checked" ||
            (suggestions().firstName && suggestions().lastName)
          )
            break;
        }
        return suggestions();
      })(),
    ]);
  } finally {
    signal?.removeEventListener("abort", abort);
    await worker.terminate();
  }
}
