export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === "class") node.className = value;
    else if (key.startsWith("on") && typeof value === "function")
      node.addEventListener(key.slice(2), value);
    else if (key === "text") node.textContent = value;
    else if (key === "checked" || key === "disabled" || key === "hidden")
      node[key] = !!value;
    else node.setAttribute(key, value === true ? "" : String(value));
  }
  for (const child of children.flat(Infinity)) {
    if (child !== null && child !== undefined && child !== false)
      node.append(
        child instanceof Node ? child : document.createTextNode(String(child)),
      );
  }
  return node;
}
export function button(text, action, attrs = {}) {
  return el("button", { type: "button", onclick: action, ...attrs }, text);
}
export function link(text, href, attrs = {}) {
  return el("a", { href, ...attrs }, text);
}
