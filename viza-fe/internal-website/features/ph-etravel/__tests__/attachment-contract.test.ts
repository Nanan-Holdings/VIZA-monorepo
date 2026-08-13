import { describe, expect, test } from "vitest";

import {
  createPhEtravelAttachmentPresentation,
  PH_ETRAVEL_ATTACHMENT_MAX_FILE_BYTES,
  validatePhEtravelAttachmentClientHint,
} from "../attachment-contract";

describe("Philippines eTravel attachment presentation contract", () => {
  test("exposes only the E14 conditional multi-file client hint", () => {
    const attachment = createPhEtravelAttachmentPresentation({
      transportType: "SEA",
      seaFlow: "electronic_customs",
      customsDeclaration: "yes",
    });

    expect(attachment).toMatchObject({
      visible: true,
      stateKey: "attachments",
      control: "multi_file",
      multiple: true,
      acceptedMimeTypes: ["image/png", "image/jpg", "image/jpeg"],
      maxFileBytes: 5_242_880,
      countRule: "unknown",
      aggregateSizeRule: "unknown",
      liveRequiredness: "unknown",
      serverRules: "official_review_required",
      applicantFieldMode: "official_boundary_notice",
    });
  });

  test("keeps attachment client hints out of manual, Customs No, and unknown paths", () => {
    expect(
      createPhEtravelAttachmentPresentation({
        transportType: "SEA",
        seaFlow: "manual_forms",
        customsDeclaration: "yes",
      }).visible
    ).toBe(false);
    expect(
      createPhEtravelAttachmentPresentation({
        transportType: "SEA",
        seaFlow: "electronic_customs",
        customsDeclaration: "no",
      }).visible
    ).toBe(false);
    expect(
      createPhEtravelAttachmentPresentation({
        transportType: "SEA",
        customsDeclaration: "yes",
      }).visible
    ).toBe(false);
  });

  test("enforces only MIME and per-file client-size hints", () => {
    expect(
      validatePhEtravelAttachmentClientHint({
        mimeType: "image/jpeg",
        sizeBytes: PH_ETRAVEL_ATTACHMENT_MAX_FILE_BYTES,
      })
    ).toEqual({ accepted: true, code: "accepted" });
    expect(
      validatePhEtravelAttachmentClientHint({
        mimeType: "image/jpeg",
        sizeBytes: PH_ETRAVEL_ATTACHMENT_MAX_FILE_BYTES + 1,
      })
    ).toEqual({ accepted: false, code: "file_too_large" });
    expect(
      validatePhEtravelAttachmentClientHint({
        mimeType: "application/pdf",
        sizeBytes: 1,
      })
    ).toEqual({ accepted: false, code: "unsupported_mime_type" });
  });
});
