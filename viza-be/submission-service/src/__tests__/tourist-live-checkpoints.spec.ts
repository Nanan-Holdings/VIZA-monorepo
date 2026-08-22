import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { TOURIST_LIVE_CHECKPOINTS } from "../tourist-live-checkpoints.js";
import { reusableDocumentAliases } from "../documents/reusable-document-aliases.js";

const DOCUMENT_RESOLVER_SOURCE = readFileSync(
  path.join(process.cwd(), "src/documents/resolve-application-documents.ts"),
  "utf8",
);
const SA_RUNNER_SOURCE = readFileSync(path.join(process.cwd(), "src/sa/runner.ts"), "utf8");
const AE_RUNNER_SOURCE = readFileSync(path.join(process.cwd(), "src/ae/runner.ts"), "utf8");
const TAIWAN_RUNNER_SOURCE = readFileSync(
  path.join(process.cwd(), "src/queue/halt-runners.ts"),
  "utf8",
);

test("tourist live checkpoints use the exact verified product entry points", () => {
  assert.equal(
    TOURIST_LIVE_CHECKPOINTS.canada.url,
    "https://portal-portail.apps.cic.gc.ca/signin?lang=en",
  );
  assert.equal(TOURIST_LIVE_CHECKPOINTS.turkey.url, "https://evisa.gov.tr/en/apply/");
  assert.equal(
    TOURIST_LIVE_CHECKPOINTS.india.applicationUrl,
    "https://indianvisaonline.gov.in/evisa/Registration",
  );
  assert.equal(
    TOURIST_LIVE_CHECKPOINTS.saudi_arabia.url,
    "https://visa.visitsaudi.com/Registration/Verify?lang=en",
  );
  assert.match(
    TOURIST_LIVE_CHECKPOINTS.united_arab_emirates.url,
    /#\/issueVisa\/request\/783$/,
  );
});

test("every public form checkpoint has explicit selectors or product text", () => {
  for (const checkpoint of Object.values(TOURIST_LIVE_CHECKPOINTS)) {
    const selectorCount = "requiredSelectors" in checkpoint
      ? checkpoint.requiredSelectors.length
      : 0;
    const requiredText = "requiredText" in checkpoint
      ? checkpoint.requiredText
      : "";
    assert.ok(selectorCount > 0 || requiredText.length > 0, checkpoint.product);
    assert.notEqual(checkpoint.expectedBoundary, "payment_required");
  }
});

test("reusable profile documents map to every country requirement alias", () => {
  assert.deepEqual(reusableDocumentAliases("passport_bio_page"), [
    "passport_bio_page",
    "passport_copy",
  ]);
  assert.deepEqual(reusableDocumentAliases("photo"), [
    "photo",
    "personal_photo",
    "applicant_photo",
  ]);
  assert.ok(reusableDocumentAliases("bank_statement").includes("six_month_bank_statement"));
  assert.ok(reusableDocumentAliases("travel_insurance").includes("uae_health_coverage_evidence"));
  assert.ok(reusableDocumentAliases("uae_health_coverage_evidence").includes("travel_insurance"));
});

test("document inventory and downloads accept only explicit reusable statuses", async () => {
  process.env.SUPABASE_URL ||= "http://127.0.0.1:54321";
  process.env.SUPABASE_SERVICE_ROLE_KEY ||= "test-only-service-role-key";
  const { isUsableApplicationDocument } = await import(
    "../documents/resolve-application-documents.js"
  );
  for (const status of ["uploaded", "validated", "accepted", "approved"]) {
    assert.equal(isUsableApplicationDocument({ storage_path: "owned/file.pdf", status }), true);
  }
  for (const status of [null, "", "unknown", "rejected", "failed", "deleted", "missing"]) {
    assert.equal(isUsableApplicationDocument({ storage_path: "owned/file.pdf", status }), false);
  }
  assert.equal(isUsableApplicationDocument({ storage_path: null, status: "validated" }), false);
  assert.doesNotMatch(DOCUMENT_RESOLVER_SOURCE, /\.neq\("status", "missing"\)/);
  assert.match(DOCUMENT_RESOLVER_SOURCE, /\.in\("status", \[\.\.\.USABLE_APPLICATION_DOCUMENT_STATUSES\]\)/);
  assert.match(DOCUMENT_RESOLVER_SOURCE, /document\.requirement_key \?\? document\.document_type/);
  assert.match(DOCUMENT_RESOLVER_SOURCE, /reusableDocumentAliases\(document\.document_type\)/);
});

test("Saudi and UAE preflight use metadata inventory without plaintext downloads", () => {
  assert.match(SA_RUNNER_SOURCE, /resolveApplicationDocumentInventory/);
  assert.doesNotMatch(SA_RUNNER_SOURCE, /resolveApplicationDocumentPaths/);
  assert.match(AE_RUNNER_SOURCE, /resolveApplicationDocumentInventory/);
  assert.doesNotMatch(AE_RUNNER_SOURCE, /resolveApplicationDocumentPaths/);
  const inventoryBody = DOCUMENT_RESOLVER_SOURCE.slice(
    DOCUMENT_RESOLVER_SOURCE.indexOf("export async function resolveApplicationDocumentInventory"),
    DOCUMENT_RESOLVER_SOURCE.indexOf("export function createApplicationDocumentPathLease"),
  );
  assert.doesNotMatch(inventoryBody, /\.download\(|mkdtemp/);
});

test("plaintext document leases are disposable and Taiwan owns cleanup", async () => {
  process.env.SUPABASE_URL ||= "http://127.0.0.1:54321";
  process.env.SUPABASE_SERVICE_ROLE_KEY ||= "test-only-service-role-key";
  const { createApplicationDocumentPathLease } = await import(
    "../documents/resolve-application-documents.js"
  );
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "viza-docs-test-"));
  const filePath = path.join(tempDir, "passport.pdf");
  writeFileSync(filePath, "test-only");
  const paths = new Map([["passport_bio_page", filePath]]);
  const lease = createApplicationDocumentPathLease(tempDir, paths);
  await lease.cleanup();
  await lease.cleanup();
  assert.equal(paths.size, 0);
  assert.equal(existsSync(tempDir), false);
  assert.match(TAIWAN_RUNNER_SOURCE, /catch \(error\) \{\s*await documentLease\.cleanup\(\)/);
  assert.match(TAIWAN_RUNNER_SOURCE, /finally \{\s*await prepared\.cleanupDocuments\(\)/);
});
