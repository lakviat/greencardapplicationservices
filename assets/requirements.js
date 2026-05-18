const startButton = document.querySelector("#startSelfie");
const captureButton = document.querySelector("#captureSelfie");
const validateButton = document.querySelector("#validateSelfie");
const retakeButton = document.querySelector("#retakeSelfie");
const downloadLink = document.querySelector("#downloadSelfie");
const uploadInput = document.querySelector("#photoUpload");
const video = document.querySelector("#selfieVideo");
const canvas = document.querySelector("#selfieCanvas");
const resultImage = document.querySelector("#selfieResult");
const statusMessage = document.querySelector("#selfieStatus");
const cameraPanel = document.querySelector("#cameraPanel");

let activeStream;
let latestBlob;

function setStatus(message, isError = false) {
  if (!statusMessage) return;
  statusMessage.textContent = message;
  statusMessage.style.color = isError ? "#c5221f" : "#174ea6";
}

function showCameraPanel() {
  cameraPanel?.removeAttribute("hidden");
}

function setCameraActive(isActive) {
  document.body.classList.toggle("camera-active", isActive);
  document.body.classList.toggle("capture-ready", false);
}

function stopCamera() {
  if (!activeStream) return;
  activeStream.getTracks().forEach((track) => track.stop());
  activeStream = null;
  setCameraActive(false);
}

function waitForVideoMetadata(targetVideo) {
  if (targetVideo.readyState >= 1 && targetVideo.videoWidth && targetVideo.videoHeight) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    targetVideo.addEventListener("loadedmetadata", resolve, { once: true });
  });
}

function blobFromCanvas(targetCanvas, quality) {
  return new Promise((resolve) => {
    targetCanvas.toBlob(resolve, "image/jpeg", quality);
  });
}

async function compressedJpeg(targetCanvas) {
  let quality = 0.92;
  let blob = await blobFromCanvas(targetCanvas, quality);

  while (blob && blob.size > 200 * 1024 && quality > 0.35) {
    quality -= 0.06;
    blob = await blobFromCanvas(targetCanvas, quality);
  }

  return blob;
}

async function renderImageToDvCanvas(source) {
  const context = canvas.getContext("2d", { alpha: false });
  const sourceWidth = source.videoWidth || source.naturalWidth || source.width;
  const sourceHeight = source.videoHeight || source.naturalHeight || source.height;
  const cropSize = Math.min(sourceWidth, sourceHeight);
  const sourceX = Math.floor((sourceWidth - cropSize) / 2);
  const sourceY = Math.floor((sourceHeight - cropSize) / 2);

  canvas.width = 600;
  canvas.height = 600;
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, 600, 600);
  context.drawImage(source, sourceX, sourceY, cropSize, cropSize, 0, 0, 600, 600);

  latestBlob = await compressedJpeg(canvas);
  const url = URL.createObjectURL(latestBlob);
  resultImage.src = url;
  resultImage.hidden = false;
  downloadLink.href = url;
  downloadLink.download = "dv-photo-600x600.jpg";
  downloadLink.removeAttribute("hidden");
  retakeButton.removeAttribute("hidden");
  validateButton?.removeAttribute("disabled");
  const sizeKb = Math.round(latestBlob.size / 1024);
  if (sizeKb > 200) {
    setStatus(
      `Photo captured at 600 x 600, but it is ${sizeKb} KB. Please retake with better lighting and a plain background so we can keep it under 200 KB.`,
      true
    );
    return;
  }
  setStatus(`Photo captured: 600 x 600 JPEG, ${sizeKb} KB.`);
}

function getAverageColor(context, x, y, width, height) {
  const data = context.getImageData(x, y, width, height).data;
  let red = 0;
  let green = 0;
  let blue = 0;
  const pixels = data.length / 4;

  for (let index = 0; index < data.length; index += 4) {
    red += data[index];
    green += data[index + 1];
    blue += data[index + 2];
  }

  return {
    red: red / pixels,
    green: green / pixels,
    blue: blue / pixels
  };
}

function isPlainLightBackground() {
  const context = canvas.getContext("2d", { alpha: false });
  const regions = [
    [10, 10, 90, 90],
    [500, 10, 90, 90],
    [10, 250, 60, 120],
    [530, 250, 60, 120],
    [10, 500, 70, 70],
    [520, 500, 70, 70]
  ];

  const colors = regions.map(([x, y, width, height]) => getAverageColor(context, x, y, width, height));
  const averageBrightness =
    colors.reduce((sum, color) => sum + (color.red + color.green + color.blue) / 3, 0) / colors.length;
  const maxChannelSpread = Math.max(
    ...colors.map((color) => Math.max(color.red, color.green, color.blue) - Math.min(color.red, color.green, color.blue))
  );

  return averageBrightness >= 185 && maxChannelSpread <= 48;
}

function validatePhoto() {
  if (!latestBlob) {
    setStatus("FAIL: take or upload a photo first.", true);
    return;
  }

  const failures = [];
  const warnings = [];
  const sizeKb = Math.round(latestBlob.size / 1024);

  if (canvas.width !== 600 || canvas.height !== 600) {
    failures.push("image is not 600 x 600 pixels");
  }

  if (latestBlob.type !== "image/jpeg") {
    failures.push("file is not JPEG");
  }

  if (latestBlob.size > 200 * 1024) {
    failures.push(`file is ${sizeKb} KB; target is 200 KB or less`);
  }

  if (!isPlainLightBackground()) {
    failures.push("background may not be plain white/off-white");
  }

  warnings.push("manual review still required for glasses, hats, expression, shadows, blur, and head position");

  if (failures.length) {
    setStatus(`FAIL: ${failures.join("; ")}. ${warnings.join("; ")}.`, true);
    return;
  }

  setStatus(`PASS: 600 x 600 JPEG, ${sizeKb} KB, background appears light/plain. ${warnings.join("; ")}.`);
}

async function startCamera() {
  showCameraPanel();
  setCameraActive(true);
  document.querySelector(".selfie-camera-widget")?.scrollIntoView({
    behavior: "smooth",
    block: "center"
  });
  resultImage.hidden = true;
  downloadLink.hidden = true;
  retakeButton.hidden = true;
  validateButton?.setAttribute("disabled", "");
  captureButton.setAttribute("disabled", "");

  if (!navigator.mediaDevices?.getUserMedia) {
    setStatus("Camera is not available in this browser. Please upload a photo instead.", true);
    setCameraActive(false);
    return;
  }

  try {
    stopCamera();
    activeStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: "user",
        width: { ideal: 1200 },
        height: { ideal: 1200 }
      }
    });
    video.srcObject = activeStream;
    await waitForVideoMetadata(video);
    await video.play();
    captureButton.removeAttribute("disabled");
    document.body.classList.add("capture-ready");
    setStatus("Camera ready. Align your face inside the guide and use a real white or off-white background.");
  } catch (error) {
    setStatus("Camera access was blocked or unavailable. You can upload a photo file instead.", true);
    setCameraActive(false);
  }
}

async function captureSelfie() {
  if (!video.srcObject) {
    setStatus("Start the camera first, or upload a photo instead.", true);
    return;
  }
  document.body.classList.remove("capture-ready");
  await renderImageToDvCanvas(video);
  stopCamera();
}

async function handleUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    setStatus("Please upload an image file.", true);
    return;
  }

  const image = new Image();
  image.onload = async () => {
    showCameraPanel();
    await renderImageToDvCanvas(image);
    URL.revokeObjectURL(image.src);
  };
  image.onerror = () => setStatus("We could not read that image. Please try another photo.", true);
  image.src = URL.createObjectURL(file);
}

startButton?.addEventListener("click", startCamera);
captureButton?.addEventListener("click", captureSelfie);
validateButton?.addEventListener("click", validatePhoto);
retakeButton?.addEventListener("click", startCamera);
uploadInput?.addEventListener("change", handleUpload);
window.addEventListener("pagehide", stopCamera);
