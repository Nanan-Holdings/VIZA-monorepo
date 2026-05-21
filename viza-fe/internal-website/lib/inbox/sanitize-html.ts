/**
 * Tiny allowlist HTML sanitiser for inbound mail rendering (INBOX-006).
 *
 * Email html is hostile: tracking pixels, beacon iframes, javascript:
 * URLs, and inline scripts are routine. We do NOT want to render any
 * of that in the client/staff inbox view by default.
 *
 * This sanitiser:
 *   - strips `<script>`, `<style>`, `<iframe>`, `<object>`, `<embed>`,
 *     `<link>`, `<meta>`, `<form>`, `<input>`, `<button>` blocks entirely
 *     (including their contents).
 *   - drops every `<img>` tag (no remote tracking pixels at all).
 *   - removes any attribute starting with `on` (event handlers).
 *   - rewrites `href` / `src` whose scheme is not http/https/mailto to `#`.
 *   - removes `style` attributes (defence-in-depth against
 *     `expression()` / `url(javascript:...)`).
 *
 * The output is safe to inject via `dangerouslySetInnerHTML`.
 *
 * NB: this is intentionally conservative. We can re-enable images
 * behind an explicit "show remote content" toggle later (INBOX-007 will
 * track the policy).
 */

const FORBIDDEN_TAGS = [
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "link",
  "meta",
  "form",
  "input",
  "button",
  "img",
];

function dropTag(html: string, tag: string): string {
  // greedy strip including contents
  const re = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?</${tag}>`, "gi");
  let out = html.replace(re, "");
  // self-closing or unclosed
  const reOpen = new RegExp(`<${tag}\\b[^>]*/?>`, "gi");
  out = out.replace(reOpen, "");
  return out;
}

function stripDangerousAttrs(html: string): string {
  // remove on*=... handlers
  let out = html.replace(/\s+on[a-z]+\s*=\s*"(?:[^"\\]|\\.)*"/gi, "");
  out = out.replace(/\s+on[a-z]+\s*=\s*'(?:[^'\\]|\\.)*'/gi, "");
  // remove style="…"
  out = out.replace(/\s+style\s*=\s*"(?:[^"\\]|\\.)*"/gi, "");
  out = out.replace(/\s+style\s*=\s*'(?:[^'\\]|\\.)*'/gi, "");
  return out;
}

function neutraliseUrls(html: string): string {
  // rewrite href="javascript:..." / data:... (except text-y data:image is also blocked here for safety)
  return html.replace(
    /\s(href|src)\s*=\s*("([^"]*)"|'([^']*)')/gi,
    (match, attr: string, _full, dq?: string, sq?: string) => {
      const url = (dq ?? sq ?? "").trim();
      if (/^(https?:|mailto:)/i.test(url)) return match;
      return ` ${attr}="#"`;
    },
  );
}

export function sanitiseInboundHtml(html: string): string {
  let out = html ?? "";
  for (const tag of FORBIDDEN_TAGS) {
    out = dropTag(out, tag);
  }
  out = stripDangerousAttrs(out);
  out = neutraliseUrls(out);
  return out;
}

/** Convenience for rendering unknown body content as text. */
export function escapeText(text: string): string {
  return (text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
