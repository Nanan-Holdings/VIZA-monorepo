import { test } from "node:test";
import assert from "node:assert/strict";
import { buildJpPaperLines, JP_PAPER_FIELDS } from "../field-mappings.js";
import { renderPdf } from "../../paper/simple-pdf.js";

const SAMPLE: Record<string, string> = {
  surname: "zhang",
  given_names: "edward",
  date_of_birth: "1990-04-15",
  nationality: "China",
  passport_number: "e12345678",
  email: "e@example.com",
};

test("jp.paper: renders field values with formatting (snapshot)", () => {
  const lines = buildJpPaperLines(SAMPLE).map((l) => l.text);
  assert.ok(lines.includes("Surname: ZHANG")); // uppercase format
  assert.ok(lines.includes("Given Names: EDWARD"));
  assert.ok(lines.includes("Date of Birth: 1990-04-15"));
  assert.ok(lines.includes("Passport Number: E12345678"));
  assert.ok(lines.includes("Email: e@example.com"));
});

test("jp.paper: missing answers render a blank fill-in line", () => {
  const lines = buildJpPaperLines(SAMPLE).map((l) => l.text);
  assert.ok(lines.some((l) => l.startsWith("Phone: ____")));
});

test("jp.paper: every mapped field appears in the pack", () => {
  const lines = buildJpPaperLines(SAMPLE).map((l) => l.text);
  for (const f of JP_PAPER_FIELDS) {
    assert.ok(lines.some((l) => l.startsWith(`${f.label}:`)), `${f.label} present`);
  }
});

test("jp.paper: renderPdf produces a valid PDF buffer", () => {
  const pdf = renderPdf("Japan", buildJpPaperLines(SAMPLE));
  assert.ok(pdf.length > 0);
  assert.equal(pdf.subarray(0, 5).toString("latin1"), "%PDF-");
});
