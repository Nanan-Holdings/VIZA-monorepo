import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { persistDs160InputSnapshot, persistDs160RunEvidence } from "../audit-artifacts";

test("audit evidence retains original, normalized and official values through encryption only", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "ds160-audit-test-"));
  const plaintexts: string[] = [];
  const writes: Array<{ name: string; ciphertext: string }> = [];
  const store = {
    encrypt: (plain: string) => { plaintexts.push(plain); return `encrypted-${plaintexts.length}`; },
    write: async (name: string, ciphertext: string) => { writes.push({ name, ciphertext }); },
  };
  try {
    await persistDs160InputSnapshot(store, {
      branchAnswers: { salary: "DOES_NOT_APPLY", city: "纽约", city_en: "NEW YORK" },
      answers: { salary_na: "Y", city: "NEW YORK" },
    });
    await fs.writeFile(path.join(directory, "review-0.json"), '{"city":"NEW YORK"}');
    await fs.writeFile(path.join(directory, "official-review-expectations.json"), "[]");
    await fs.writeFile(path.join(directory, "ceac-unknown-2026-09-28.png"), Buffer.from([1, 2, 3]));
    await fs.writeFile(path.join(directory, "Photo.jpg"), "exclude applicant upload");
    await fs.writeFile(path.join(directory, "unrelated.env"), "exclude secrets");
    assert.equal(await persistDs160RunEvidence(store, directory), 3);
    assert.deepEqual(writes, [
      { name: "input-snapshot.enc", ciphertext: "encrypted-1" },
      { name: "official-evidence.enc", ciphertext: "encrypted-2" },
    ]);
    const input = JSON.parse(plaintexts[0]);
    assert.equal(input.branchAnswers.city, "纽约");
    assert.equal(input.answers.salary_na, "Y");
    const bundle = JSON.parse(plaintexts[1]);
    assert.deepEqual(bundle.files.map((file: { name: string }) => file.name), [
      "ceac-unknown-2026-09-28.png", "official-review-expectations.json", "review-0.json",
    ]);
    assert.equal(Buffer.from(bundle.files[2].contentBase64, "base64").toString(), '{"city":"NEW YORK"}');
    assert.equal(bundle.evidenceKind, "official_review_and_run_diagnostics");
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("unavailable protected storage fails explicitly instead of claiming evidence was retained", async () => {
  await assert.rejects(persistDs160InputSnapshot({
    encrypt: () => "encrypted",
    write: async () => { throw new Error("private storage unavailable"); },
  }, {}), /private storage unavailable/);
});

test("pre-sign evidence cannot pass with missing review files", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "ds160-audit-test-"));
  let writes = 0;
  try {
    await assert.rejects(persistDs160RunEvidence({
      encrypt: () => "encrypted", write: async () => { writes += 1; },
    }, directory, "pre-sign-review.enc"), /review artifacts are missing/);
    assert.equal(writes, 0);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
