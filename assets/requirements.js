const startButton = document.querySelector("#startSelfie");
const captureButton = document.querySelector("#captureSelfie");
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
retakeButton?.addEventListener("click", startCamera);
uploadInput?.addEventListener("change", handleUpload);
window.addEventListener("pagehide", stopCamera);
