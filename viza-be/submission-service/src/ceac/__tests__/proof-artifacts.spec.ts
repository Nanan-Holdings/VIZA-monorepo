import assert from "node:assert/strict";
import { test } from "node:test";
import { mergeUsProofStoragePaths } from "../proof-artifacts";

test("mergeUsProofStoragePaths preserves submitted DS-160 result fields", () => {
  const merged = mergeUsProofStoragePaths(
    {
      country: "US",
      status: "submitted",
      applicationId: "AA00FLSF69",
      confirmationNumber: "AA00FLSF69",
      surnameFirst5: "CHEN",
      yearOfBirth: 2006,
      securityQuestion: "Question",
      securityAnswer: "DO_NOT_KNOW",
      embassyOrConsulate: "NSS",
      retrievalUrl: "https://ceac.state.gov/GenNIV/Default.aspx?ApplicationID=AA00FLSF69",
      confirmationPdfStoragePath: "existing/confirmation.pdf",
    },
    {
      applicationPdfStoragePath: "new/application.pdf",
      emailConfirmationPdfStoragePath: "new/email.pdf",
    },
  );

  assert.equal(merged.applicationId, "AA00FLSF69");
  assert.equal(merged.securityAnswer, "DO_NOT_KNOW");
  assert.equal(merged.confirmationPdfStoragePath, "existing/confirmation.pdf");
  assert.equal(merged.applicationPdfStoragePath, "new/application.pdf");
  assert.equal(merged.emailConfirmationPdfStoragePath, "new/email.pdf");
});

test("mergeUsProofStoragePaths rejects non-submitted DS-160 results", () => {
  assert.throws(
    () => mergeUsProofStoragePaths({ country: "US", status: "stopped_at_sign" }, {}),
    /submitted US DS-160 result/,
  );
});
