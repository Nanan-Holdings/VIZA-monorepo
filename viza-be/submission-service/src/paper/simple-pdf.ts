import { Buffer } from "node:buffer";

/**
 * Minimal PDF 1.4 generator (mirrors viza-fe/.../lib/pdf/simple-pdf.ts).
 *
 * Single page, plain text, Helvetica + Helvetica-Bold built-ins. Used
 * by the paper-channel renderer (DOC-004); also avoids pulling
 * pdf-lib into the runner image.
 */

const PAGE_W = 612;
const PAGE_H = 792;
const LEFT_MARGIN = 72;
const TOP_MARGIN = 720;
const LINE_HEIGHT = 14;

export interface PdfLine {
  text: string;
  size?: number;
  bold?: boolean;
}

function escapePdfString(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

export function renderPdf(title: string, lines: PdfLine[]): Buffer {
  const stream: string[] = ["BT"];
  let firstPositioned = false;
  for (const line of lines) {
    const size = line.size ?? 11;
    const font = line.bold ? "/F2" : "/F1";
    stream.push(`${font} ${size} Tf`);
    if (!firstPositioned) {
      stream.push(`${LEFT_MARGIN} ${TOP_MARGIN} Td`);
      firstPositioned = true;
    } else {
      stream.push(`0 -${LINE_HEIGHT} Td`);
    }
    stream.push(`(${escapePdfString(line.text)}) Tj`);
  }
  stream.push("ET");
  const content = stream.join("\n");
  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>`,
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
  ];
  const header = `%PDF-1.4\n%\xE2\xE3\xCF\xD3\n`;
  let body = "";
  const offsets: number[] = [];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(header + body, "binary"));
    body += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(header + body, "binary");
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) {
    xref += `${o.toString().padStart(10, "0")} 00000 n \n`;
  }
  const trailer =
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info << /Title (${escapePdfString(title)}) >> >>\n` +
    `startxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(header + body + xref + trailer, "binary");
}
