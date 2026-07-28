import { Buffer } from "node:buffer";

/**
 * Minimal PDF 1.4 generator for PAY-005 receipts + invoices.
 *
 * Single page, plain text, Helvetica (PDF built-in font — no font
 * files shipped). Just enough structure to be a valid PDF that Acrobat
 * / Preview / browsers all open. Avoids dragging a PDF library in for
 * one call site.
 *
 * Layout: page is 612 × 792 pt (US letter). Origin (0,0) is bottom-left.
 * The renderer writes each line at the supplied y-coordinate with a
 * left margin of 72 pt.
 */

const PAGE_W = 612;
const PAGE_H = 792;
const LEFT_MARGIN = 72;
const TOP_MARGIN = 720;
const LINE_HEIGHT = 14;

export interface PdfLine {
  /** Text to render. Special characters '(' ')' '\\' are escaped. */
  text: string;
  /** Helvetica font size in points. Default 11. */
  size?: number;
  /** Bold (Helvetica-Bold). Default false. */
  bold?: boolean;
}

function escapePdfString(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

export function renderPdf(title: string, lines: PdfLine[]): Buffer {
  // Build the content stream. Each line emits a Tf (font), Td
  // (position), and Tj (show string).
  const streamLines: string[] = ["BT"];
  let y = TOP_MARGIN;
  let firstPositioned = false;
  for (const line of lines) {
    const size = line.size ?? 11;
    const font = line.bold ? "/F2" : "/F1";
    streamLines.push(`${font} ${size} Tf`);
    if (!firstPositioned) {
      streamLines.push(`${LEFT_MARGIN} ${y} Td`);
      firstPositioned = true;
    } else {
      streamLines.push(`0 -${LINE_HEIGHT} Td`);
      y -= LINE_HEIGHT;
    }
    streamLines.push(`(${escapePdfString(line.text)}) Tj`);
  }
  streamLines.push("ET");
  const stream = streamLines.join("\n");

  const objects: string[] = [];
  // 1: Catalog
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  // 2: Pages
  objects.push("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  // 3: Page
  objects.push(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>`,
  );
  // 4: Page contents
  objects.push(
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  );
  // 5: Font (Helvetica)
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  // 6: Font (Helvetica-Bold)
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

  const header = `%PDF-1.4\n%\xE2\xE3\xCF\xD3\n`;
  let body = "";
  const offsets: number[] = [];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(header + body, "binary"));
    body += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(header + body, "binary");
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) {
    xref += `${off.toString().padStart(10, "0")} 00000 n \n`;
  }
  const trailer =
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info << /Title (${escapePdfString(title)}) >> >>\n` +
    `startxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(header + body + xref + trailer, "binary");
}
