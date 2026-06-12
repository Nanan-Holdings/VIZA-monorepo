import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ApplicationDocument } from "../../types";
import {
  buildPhotoFileFromDownloadedDocument,
  selectDs160PhotoDocument,
} from "../photo-document";

function doc(
  document_type: string,
  overrides: Partial<ApplicationDocument> = {},
): ApplicationDocument {
  return {
    id: `${document_type}-id`,
    application_id: "app-id",
    document_type,
    storage_path: `${document_type}.jpg`,
    status: "uploaded",
    file_name: `${document_type}.jpg`,
    ...overrides,
  };
}

describe("DS-160 photo document selection", () => {
  it("prefers the cropped applicant photo uploaded by the frontend", () => {
    const selected = selectDs160PhotoDocument([
      doc("photo"),
      doc("applicant_photo"),
      doc("applicant_photo_cropped"),
    ]);

    assert.equal(selected?.document_type, "applicant_photo_cropped");
  });

  it("ignores rejected documents and documents missing storage", () => {
    const selected = selectDs160PhotoDocument([
      doc("applicant_photo_cropped", { status: "rejected" }),
      doc("ds160_photo", { storage_path: null }),
      doc("visa_photo", { status: "validated" }),
    ]);

    assert.equal(selected?.document_type, "visa_photo");
  });

  it("maps the selected document to the downloaded local path", () => {
    const selected = doc("ds160_photo");
    const paths = new Map([["ds160_photo", "C:\\tmp\\ds160_photo.jpg"]]);

    assert.deepEqual(buildPhotoFileFromDownloadedDocument(selected, paths), {
      kind: "path",
      path: "C:\\tmp\\ds160_photo.jpg",
    });
  });
});
