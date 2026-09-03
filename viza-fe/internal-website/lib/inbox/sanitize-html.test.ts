import { describe, expect, it } from "vitest";
import { escapeText, sanitiseInboundHtml } from "./sanitize-html";

describe("sanitiseInboundHtml", () => {
  it("keeps safe formatting tags and their text", () => {
    const out = sanitiseInboundHtml(
      "<p>Hello <strong>there</strong> <em>friend</em></p>",
    );
    expect(out).toContain("<p>");
    expect(out).toContain("<strong>there</strong>");
    expect(out).toContain("<em>friend</em>");
  });

  it("strips a quoted on* event handler", () => {
    const out = sanitiseInboundHtml('<a href="https://x.test" onclick="alert(1)">x</a>');
    expect(out).not.toMatch(/onclick/i);
    expect(out).not.toContain("alert(1)");
    expect(out).toContain("https://x.test");
  });

  it("strips an UNQUOTED on* event handler (the regex-sanitiser bypass)", () => {
    const out = sanitiseInboundHtml("<a href=https://x.test onclick=alert(1)>x</a>");
    expect(out).not.toMatch(/onclick/i);
    expect(out).not.toContain("alert(1)");
  });

  it("drops <svg onload=…> attribute-injection payloads", () => {
    const out = sanitiseInboundHtml('<svg onload="alert(1)"></svg>');
    expect(out).not.toMatch(/onload/i);
    expect(out.toLowerCase()).not.toContain("<svg");
    expect(out).not.toContain("alert(1)");
  });

  it("removes javascript: hrefs", () => {
    const out = sanitiseInboundHtml('<a href="javascript:alert(1)">click</a>');
    expect(out).not.toMatch(/javascript:/i);
    expect(out).not.toContain("alert(1)");
    // the anchor text is preserved even though the href is stripped
    expect(out).toContain("click");
  });

  it("removes data: hrefs", () => {
    const out = sanitiseInboundHtml('<a href="data:text/html,<script>alert(1)</script>">x</a>');
    expect(out).not.toMatch(/data:text\/html/i);
    expect(out).not.toMatch(/<script/i);
  });

  it("drops <script> tags and their content", () => {
    const out = sanitiseInboundHtml('<div>ok<script>alert(1)</script></div>');
    expect(out).not.toMatch(/<script/i);
    expect(out).not.toContain("alert(1)");
    expect(out).toContain("ok");
  });

  it("drops <iframe>, <object>, <embed>, <form>, <input>, <button>", () => {
    const out = sanitiseInboundHtml(
      '<iframe src="https://evil.test"></iframe>' +
        '<object data="x"></object><embed src="x">' +
        '<form><input name="a"><button>go</button></form>',
    );
    expect(out).not.toMatch(/<iframe|<object|<embed|<form|<input|<button/i);
  });

  it("drops every <img> (no remote tracking pixels)", () => {
    const out = sanitiseInboundHtml('<p>hi</p><img src="https://track.test/p.gif">');
    expect(out).not.toMatch(/<img/i);
    expect(out).toContain("hi");
  });

  it("strips inline style attributes", () => {
    const out = sanitiseInboundHtml('<p style="background:url(javascript:alert(1))">x</p>');
    expect(out).not.toMatch(/style=/i);
    expect(out).not.toContain("alert(1)");
  });

  it("handles empty / nullish input", () => {
    expect(sanitiseInboundHtml("")).toBe("");
    expect(sanitiseInboundHtml(null as unknown as string)).toBe("");
  });
});

describe("escapeText", () => {
  it("escapes HTML metacharacters", () => {
    expect(escapeText('<b>&"')).toBe("&lt;b&gt;&amp;\"");
  });

  it("handles nullish input", () => {
    expect(escapeText(null as unknown as string)).toBe("");
  });
});
