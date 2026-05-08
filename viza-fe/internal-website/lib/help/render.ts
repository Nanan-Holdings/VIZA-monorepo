/**
 * Tiny markdown subset for help articles (CS-004).
 *
 * Supports: # / ## / ### headers, paragraphs, blank-line separation,
 * - / * unordered lists, [text](url) inline links, **bold**.
 *
 * Anything else is rendered as a paragraph. No HTML allowed in the
 * source; angle brackets are escaped.
 */

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inline(s: string): string {
  let out = esc(s);
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)/g,
    '<a href="$2" class="text-brand-500 hover:underline" rel="noopener noreferrer">$1</a>',
  );
  return out;
}

export function renderHelpMarkdown(md: string): string {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let listOpen = false;
  let paragraph: string[] = [];

  function flushParagraph() {
    if (paragraph.length === 0) return;
    out.push(`<p>${inline(paragraph.join(" "))}</p>`);
    paragraph = [];
  }

  function closeList() {
    if (listOpen) {
      out.push("</ul>");
      listOpen = false;
    }
  }

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line === "") {
      flushParagraph();
      closeList();
      continue;
    }
    const h1 = /^#\s+(.*)$/.exec(line);
    const h2 = /^##\s+(.*)$/.exec(line);
    const h3 = /^###\s+(.*)$/.exec(line);
    const li = /^[-*]\s+(.*)$/.exec(line);
    if (h1) {
      flushParagraph();
      closeList();
      out.push(`<h1 class="text-2xl font-semibold text-[#232323] mt-4">${inline(h1[1])}</h1>`);
      continue;
    }
    if (h2) {
      flushParagraph();
      closeList();
      out.push(`<h2 class="text-lg font-semibold text-[#232323] mt-4">${inline(h2[1])}</h2>`);
      continue;
    }
    if (h3) {
      flushParagraph();
      closeList();
      out.push(`<h3 class="text-base font-semibold text-[#232323] mt-3">${inline(h3[1])}</h3>`);
      continue;
    }
    if (li) {
      flushParagraph();
      if (!listOpen) {
        out.push('<ul class="list-disc list-outside pl-5 space-y-1">');
        listOpen = true;
      }
      out.push(`<li>${inline(li[1])}</li>`);
      continue;
    }
    paragraph.push(line);
  }
  flushParagraph();
  closeList();
  return out.join("\n");
}
