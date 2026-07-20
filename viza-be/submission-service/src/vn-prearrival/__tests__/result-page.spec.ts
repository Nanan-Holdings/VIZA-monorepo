import assert from "node:assert/strict";
import test from "node:test";
import {
  extractVietnamPrearrivalConfirmationNumber,
  hasVietnamPrearrivalSuccessEvidence,
  isVietnamPrearrivalSuccessPage,
} from "../result-page";

test("does not treat the official Finalizing page as a completed submission", () => {
  assert.equal(
    isVietnamPrearrivalSuccessPage(
      "Pre-arrival Submission Processing Progress Finalizing. This acknowledgement message will also be sent by email.",
    ),
    false,
  );
});

test("recognizes the official final success heading", () => {
  assert.equal(isVietnamPrearrivalSuccessPage("Your submission is successful!"), true);
});

test("requires a visible success heading and an official result artifact", () => {
  assert.equal(
    hasVietnamPrearrivalSuccessEvidence({
      successHeadingVisible: false,
      confirmationNumber: null,
      qrCaptured: true,
      pdfCaptured: false,
    }),
    false,
  );
  assert.equal(
    hasVietnamPrearrivalSuccessEvidence({
      successHeadingVisible: true,
      confirmationNumber: null,
      qrCaptured: false,
      pdfCaptured: false,
    }),
    false,
  );
  assert.equal(
    hasVietnamPrearrivalSuccessEvidence({
      successHeadingVisible: true,
      confirmationNumber: null,
      qrCaptured: true,
      pdfCaptured: false,
    }),
    true,
  );
});

test("extracts a DE confirmation number without accepting page branding", () => {
  assert.equal(
    extractVietnamPrearrivalConfirmationNumber("IMMIGRATION DE123456789"),
    "DE123456789",
  );
  assert.equal(extractVietnamPrearrivalConfirmationNumber("IMMIGRATION DEPARTMENT"), null);
});
