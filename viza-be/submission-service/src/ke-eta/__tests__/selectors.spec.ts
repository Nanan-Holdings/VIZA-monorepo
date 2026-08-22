import assert from "node:assert/strict";
import test from "node:test";
import { extractKeEtaReference, hasOfficialKeEtaReferenceEvidence, isOfficialKeEtaUrl, isPdfBytes } from "../selectors";

test("Kenya eTA success requires official reference evidence", () => {
  assert.equal(isOfficialKeEtaUrl("https://etakenya.go.ke/apply"), true);
  assert.equal(isOfficialKeEtaUrl("https://example.com/eta"), false);
  assert.equal(extractKeEtaReference("Application reference: KE-ABC12345"), "KE-ABC12345");
  assert.equal(hasOfficialKeEtaReferenceEvidence({
    portalUrl: "https://etakenya.go.ke/status",
    bodyText: "eTA application approved",
    reference: "KE-ABC12345",
  }), true);
  assert.equal(isPdfBytes(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])), true);
  assert.equal(isPdfBytes(new Uint8Array([0x89, 0x50, 0x4e, 0x47])), false);
});
