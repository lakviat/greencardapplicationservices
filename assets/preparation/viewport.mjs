// Visual viewport geometry is independent of phone model, keyboard height and zoom.
export function viewportGeometry({
  height,
  top = 0,
  layoutHeight,
  scale = 1,
  editing,
}) {
  const occluded = Math.max(0, layoutHeight - top - height);
  return {
    bottom: occluded,
    height,
    top,
    typing: !!editing && scale < 1.15 && occluded > layoutHeight * 0.18,
  };
}
export function attachViewport(toolbar) {
  const root = document.documentElement;
  let frame, ensureTimer;
  const editable = () =>
    document.activeElement?.matches(
      'input:not([type="checkbox"]):not([type="radio"]):not([type="file"]), textarea, select',
    );
  function ensureVisible() {
    const field = document.activeElement;
    if (!editable() || field.closest("dialog")) return;
    const vv = window.visualViewport;
    const top =
      (vv?.offsetTop || 0) +
      (document.body.classList.contains("keyboard-open")
        ? 8
        : document.querySelector(".workspace-header").getBoundingClientRect()
            .height + 12);
    const bottom =
      Math.min(
        (vv?.offsetTop || 0) + (vv?.height || innerHeight),
        toolbar.getBoundingClientRect().top,
      ) - 12;
    const rect = field.getBoundingClientRect();
    if (rect.bottom > bottom)
      window.scrollBy({ top: rect.bottom - bottom, behavior: "instant" });
    else if (rect.top < top)
      window.scrollBy({ top: rect.top - top, behavior: "instant" });
  }
  function update(event) {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const vv = window.visualViewport;
      const g = viewportGeometry({
        height: vv?.height || innerHeight,
        top: vv?.offsetTop || 0,
        layoutHeight: innerHeight,
        scale: vv?.scale || 1,
        editing: editable(),
      });
      root.style.setProperty("--viewport-bottom", `${g.bottom}px`);
      root.style.setProperty("--viewport-height", `${g.height}px`);
      root.style.setProperty("--viewport-top", `${g.top}px`);
      document.body.classList.toggle("keyboard-open", g.typing);
      clearTimeout(ensureTimer);
      if (event?.type !== "scroll")
        ensureTimer = setTimeout(ensureVisible, 120);
    });
  }
  window.visualViewport?.addEventListener("resize", update);
  window.visualViewport?.addEventListener("scroll", update);
  window.addEventListener("resize", update);
  document.addEventListener("focusin", update);
  document.addEventListener("focusout", update);
  new ResizeObserver(() =>
    root.style.setProperty(
      "--toolbar-height",
      `${toolbar.getBoundingClientRect().height}px`,
    ),
  ).observe(toolbar);
  update();
  return { ensureVisible };
}
