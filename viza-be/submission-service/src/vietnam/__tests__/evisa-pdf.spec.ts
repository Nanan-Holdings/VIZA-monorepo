import assert from "node:assert/strict";
import { test } from "node:test";
import {
  shouldPersistVietnamEvisaVersion,
  validateVietnamEvisaPdf,
} from "../evisa-pdf.js";

test("vn.evisa-pdf: validates magic bytes and returns stable SHA-256", () => {
  const pdf = Buffer.alloc(2_048, 0x20);
  pdf.write("%PDF-1.7", 0, "ascii");
  const first = validateVietnamEvisaPdf(pdf);
  const second = validateVietnamEvisaPdf(pdf);
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.equal(first, second);
});

test("vn.evisa-pdf: rejects HTML and empty portal responses", () => {
  assert.throws(
    () => validateVietnamEvisaPdf(Buffer.from("<html>portal error</html>")),
    /valid official PDF/,
  );
  assert.throws(
    () => validateVietnamEvisaPdf(Buffer.from("%PDF-")),
    /valid official PDF/,
  );
});

test("vn.evisa-pdf: deduplicates equal hashes and versions changed bytes", () => {
  assert.equal(
    shouldPersistVietnamEvisaVersion("same", "same", "user/app/VN/visa.pdf"),
    false,
  );
  assert.equal(
    shouldPersistVietnamEvisaVersion("new", "old", "user/app/VN/visa.pdf"),
    true,
  );
  assert.equal(shouldPersistVietnamEvisaVersion("same", "same", null), true);
});
