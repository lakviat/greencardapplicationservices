import { el, button } from "./dom.mjs?v=20261017-workspace-v36";
// Render the authorized PDF bytes locally. No third-party viewer or document URL.
// One canvas keeps large family worksheets within mobile memory limits.
export function pdfViewer(blob, root) {
  let stopped = false,
    loading,
    pdf,
    rendering,
    pageNumber = 1;
  const canvas = el("canvas", {
    role: "img",
    "aria-label": "Prepared worksheet PDF page",
  });
  const pageText = el("div", { class: "sr-only" });
  const status = el(
    "span",
    { role: "status", "aria-live": "polite" },
    "Loading PDF…",
  );
  const previous = button("← Previous page", () => show(pageNumber - 1), {
    class: "button",
    disabled: true,
  });
  const next = button("Next page →", () => show(pageNumber + 1), {
    class: "button",
    disabled: true,
  });
  root.append(
    el("div", { class: "pdf-paging" }, previous, status, next),
    el("div", { class: "pdf-page-surface" }, canvas),
    pageText,
  );
  async function show(number) {
    if (stopped || rendering || !pdf || number < 1 || number > pdf.numPages)
      return;
    previous.disabled = next.disabled = true;
    pageNumber = number;
    status.textContent = `Page ${number} of ${pdf.numPages}`;
    try {
      const page = await pdf.getPage(number);
      if (stopped) return;
      const original = page.getViewport({ scale: 1 });
      const width = Math.min(
        1400,
        Math.max(700, root.clientWidth * Math.min(devicePixelRatio || 1, 2)),
      );
      const viewport = page.getViewport({ scale: width / original.width });
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      rendering = page.render({
        canvasContext: canvas.getContext("2d"),
        viewport,
      });
      await rendering.promise;
      if (stopped) return;
      canvas.setAttribute(
        "aria-label",
        `Completed preparation PDF, page ${number} of ${pdf.numPages}`,
      );
      canvas.dataset.rendered = String(number);
      const text = await page.getTextContent();
      if (!stopped)
        pageText.textContent = text.items
          .map((item) => item.str || "")
          .join(" ");
      page.cleanup();
    } catch (error) {
      if (!stopped)
        status.textContent =
          "The viewer could not display this page. Use Open PDF or Download PDF.";
    } finally {
      rendering = null;
      if (!stopped) {
        previous.disabled = number === 1;
        next.disabled = number === pdf.numPages;
      }
    }
  }
  (async () => {
    const { getDocument, GlobalWorkerOptions } =
      await import("../vendor/pdf.min.mjs?v=6.4.299");
    if (stopped) return;
    GlobalWorkerOptions.workerSrc = new URL(
      "../vendor/pdf.worker.min.mjs?v=6.4.299",
      import.meta.url,
    ).href;
    loading = getDocument({
      data: new Uint8Array(await blob.arrayBuffer()),
      isEvalSupported: false,
      enableXfa: false,
      useSystemFonts: false,
      disableFontFace: true,
      standardFontDataUrl: new URL("../vendor/pdf-fonts/", import.meta.url)
        .href,
    });
    if (stopped) {
      await loading.destroy();
      return;
    }
    pdf = await loading.promise;
    await show(1);
  })().catch(() => {
    if (!stopped)
      status.textContent =
        "The viewer is unavailable. Use Open PDF or Download PDF.";
  });
  return () => {
    stopped = true;
    rendering?.cancel();
    loading?.destroy().catch(() => {});
    canvas.width = canvas.height = 0;
    pageText.textContent = "";
  };
}
