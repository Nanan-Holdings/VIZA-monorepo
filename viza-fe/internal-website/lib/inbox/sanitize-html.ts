/**
 * Allowlist HTML sanitiser for inbound mail rendering (INBOX-006).
 *
 * Email html is hostile: tracking pixels, beacon iframes, javascript:
 * URLs, inline scripts, and `<svg onload=…>` style handler payloads are all
 * routine. The previous implementation was a hand-rolled regex pass that only
 * stripped *quoted* `on…=` handlers, so an unquoted event handler
 * (`<a onclick=alert(1)>`) or an attribute-injected `<svg onload=alert(1)>`
 * sailed straight through into `dangerouslySetInnerHTML` — a stored-XSS in the
 * authenticated inbox view. (SEC-INBOX-XSS-01)
 *
 * This now delegates to DOMPurify, which parses the markup into a real DOM and
 * removes anything not on the allowlist regardless of quoting or nesting. The
 * policy is deliberately conservative and preserves the prior behaviour:
 *   - only safe formatting tags survive; `<script>`, `<style>`, `<iframe>`,
 *     `<object>`, `<embed>`, `<link>`, `<meta>`, `<form>`, `<input>`,
 *     `<button>`, `<svg>`, `<math>` and their dangerous content are dropped.
 *   - every `<img>` is dropped (no remote tracking pixels at all; INBOX-007
 *     will track an explicit "show remote content" toggle).
 *   - all `on*` event-handler and `style` attributes are stripped.
 *   - `href` is limited to http/https/mailto; other schemes (javascript:,
 *     data:, …) are removed.
 *
 * The output is safe to inject via `dangerouslySetInnerHTML`.
 *
 * Isomorphic: the same module is imported by a server component (the staff
 * inbox page) and a client component (`/client/settings/inbox`). In the browser
 * DOMPurify uses the real `window`; on the server it builds a jsdom window. The
 * jsdom dependency is loaded through a runtime-resolved require so the bundler
 * never ships it to the browser.
 */

import createDOMPurify, { type Config, type WindowLike } from "dompurify";

const ALLOWED_TAGS = [
  "a", "b", "strong", "i", "em", "u", "s", "strike", "del", "ins",
  "p", "br", "hr", "span", "div", "blockquote", "pre", "code",
  "ul", "ol", "li", "dl", "dt", "dd",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "table", "thead", "tbody", "tfoot", "tr", "td", "th", "caption", "col", "colgroup",
  "figure", "figcaption", "small", "sub", "sup", "abbr", "cite", "q", "wbr",
];

const SANITIZE_CONFIG: Config = {
  ALLOWED_TAGS,
  ALLOWED_ATTR: ["href", "title", "target", "rel", "align", "colspan", "rowspan"],
  // href/src limited to http(s)/mailto; javascript:, data:, tel:, … are stripped.
  ALLOWED_URI_REGEXP: /^(?:https?:|mailto:)/i,
  FORBID_TAGS: [
    "script", "style", "iframe", "object", "embed", "link", "meta",
    "form", "input", "button", "img", "svg", "math",
  ],
  FORBID_ATTR: ["style"],
  ALLOW_DATA_ATTR: false,
  ALLOW_ARIA_ATTR: false,
  KEEP_CONTENT: true,
  RETURN_TRUSTED_TYPE: false,
};

// Minimal shape of the jsdom module — declared locally because @types/jsdom is
// not installed and jsdom ships no types of its own; this keeps the import free
// of an implicit `any` without pulling in the dependency's type surface.
type JsdomModule = { JSDOM: new (html?: string) => { window: unknown } };

function createServerWindow(): WindowLike {
  // The server (Node) runtime has no DOM, so build one with jsdom. This branch
  // only runs when `window` is absent, and the require is resolved at runtime
  // via `eval` so the client bundler cannot see (and therefore never ships)
  // jsdom to the browser.
  const nodeRequire = eval("require") as NodeRequire;
  const { JSDOM } = nodeRequire("jsdom") as JsdomModule;
  return new JSDOM("").window as unknown as WindowLike;
}

let purifier: ReturnType<typeof createDOMPurify> | null = null;

function getPurifier(): ReturnType<typeof createDOMPurify> {
  if (purifier) return purifier;
  const domWindow: WindowLike =
    typeof window !== "undefined"
      ? (window as unknown as WindowLike)
      : createServerWindow();
  purifier = createDOMPurify(domWindow);
  return purifier;
}

export function sanitiseInboundHtml(html: string): string {
  const input = html ?? "";
  if (!input) return "";
  return getPurifier().sanitize(input, SANITIZE_CONFIG);
}

/** Convenience for rendering unknown body content as text. */
export function escapeText(text: string): string {
  return (text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
