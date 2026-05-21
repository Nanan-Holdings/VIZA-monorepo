/* eslint-disable */
// Throwaway inspect script for MOFA Form A. Dumps every AcroForm field with
// type, name, page, position rectangle, and (for RadioGroup/Dropdown) the
// available option labels. Then sample-fills every field with its own short
// name and writes /tmp/mofa-form-a-filled.pdf for visual mapping.
import { PDFDocument } from "pdf-lib";
import fs from "fs";

const bytes = fs.readFileSync("./assets/mofa-form-a.pdf");
const pdf = await PDFDocument.load(bytes);
console.log("Pages:", pdf.getPageCount());
const pages = pdf.getPages();
for (let i = 0; i < pages.length; i++) {
  const { width, height } = pages[i].getSize();
  console.log(`Page ${i + 1}: ${width.toFixed(1)} x ${height.toFixed(1)} pts`);
}

const form = pdf.getForm();
const fields = form.getFields();
console.log(`Total form fields: ${fields.length}\n`);

for (const f of fields) {
  const name = f.getName();
  const type = f.constructor.name;
  const widgets = f.acroField.getWidgets();
  const positions = widgets.map((w) => {
    const rect = w.getRectangle();
    let pageIdx = -1;
    for (let i = 0; i < pages.length; i++) {
      const pageRef = pages[i].ref;
      const wPageRef = w.P();
      if (wPageRef && wPageRef.toString() === pageRef.toString()) {
        pageIdx = i;
        break;
      }
    }
    return { page: pageIdx + 1, x: rect.x.toFixed(1), y: rect.y.toFixed(1), w: rect.width.toFixed(1), h: rect.height.toFixed(1) };
  });

  let extra = "";
  if (type === "PDFRadioGroup" || type === "PDFDropdown" || type === "PDFCheckBox") {
    try {
      const opts = f.getOptions ? f.getOptions() : [];
      extra = ` opts=[${opts.join("|")}]`;
    } catch {}
  }

  for (const p of positions) {
    console.log(
      `${type.padEnd(15)} | ${name.padEnd(60)} | p${p.page} x=${p.x.padStart(6)} y=${p.y.padStart(6)} w=${p.w.padStart(5)} h=${p.h.padStart(5)}${extra}`,
    );
  }
}

// Sample-fill every text field with its own short name + every radio with
// first option, save /tmp/mofa-form-a-filled.pdf for visual inspection.
for (const f of fields) {
  const type = f.constructor.name;
  const name = f.getName();
  const short = name.replace(/^topmostSubform\[0\]\./, "").replace(/\[0\]/g, "");
  try {
    if (type === "PDFTextField") f.setText(short);
    else if (type === "PDFRadioGroup") {
      const opts = f.getOptions();
      if (opts.length) f.select(opts[0]);
    } else if (type === "PDFDropdown") {
      const opts = f.getOptions();
      if (opts.length) f.select(opts[0]);
    } else if (type === "PDFCheckBox") {
      f.check();
    }
  } catch (e) {
    console.error(`Failed to fill ${name}: ${e.message}`);
  }
}
form.flatten();
const out = await pdf.save();
fs.writeFileSync("/tmp/mofa-form-a-filled.pdf", out);
console.log(`\nSample-filled PDF saved: /tmp/mofa-form-a-filled.pdf (${out.length} bytes)`);
