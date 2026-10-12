import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ApplicationDocument } from "../../types";
import {
  buildPhotoFileFromDownloadedDocument,
  hasDs160PhotoUpload,
  resolveDs160PhotoDocument,
  selectDs160PhotoDocument,
  selectReusableDs160ProfilePhotoDocument,
  type Ds160ProfilePhotoDocument,
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

function profileDoc(
  document_type: string,
  overrides: Partial<Ds160ProfilePhotoDocument> = {},
): Ds160ProfilePhotoDocument {
  return {
    id: `${document_type}-profile-id`,
    applicant_id: "applicant-id",
    document_type,
    storage_path: `${document_type}.jpg`,
    status: "uploaded",
    updated_at: "2026-09-01T00:00:00.000Z",
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

  it("treats every application photo row as authoritative, including rejected rows", () => {
    assert.equal(hasDs160PhotoUpload([doc("applicant_photo_cropped", { status: "rejected" })]), true);
    assert.equal(hasDs160PhotoUpload([doc("applicant_photo_cropped", { storage_path: null })]), true);
    assert.equal(hasDs160PhotoUpload([doc("passport_copy")]), false);
  });

  it("selects the newest usable profile photo for the requested applicant", () => {
    const selected = selectReusableDs160ProfilePhotoDocument([
      profileDoc("applicant_photo_cropped", { updated_at: "2026-08-01T00:00:00.000Z" }),
      profileDoc("photo", { updated_at: "2026-09-02T00:00:00.000Z" }),
      profileDoc("photo", { applicant_id: "another-applicant", updated_at: "2026-09-03T00:00:00.000Z" }),
      profileDoc("portrait_photo", { status: "rejected", updated_at: "2026-09-04T00:00:00.000Z" }),
    ], "applicant-id");

    assert.equal(selected?.document_type, "photo");
  });

  it("does not query profile documents when an application photo row exists", async () => {
    let loaderCalls = 0;
    const selected = await resolveDs160PhotoDocument({
      applicationId: "application-id",
      applicantId: "applicant-id",
      applicationDocuments: [doc("applicant_photo_cropped", { status: "rejected" })],
      loadReusableProfileDocuments: async () => {
        loaderCalls += 1;
        return [profileDoc("photo")];
      },
    });

    assert.equal(loaderCalls, 0);
    assert.equal(selected, null);
  });

  it("uses only owner-scoped profile metadata when the application has no photo row", async () => {
    let lookup: { applicationId: string; applicantId: string } | null = null;
    const selected = await resolveDs160PhotoDocument({
      applicationId: "application-id",
      applicantId: "applicant-id",
      applicationDocuments: [doc("passport_copy")],
      loadReusableProfileDocuments: async (input) => {
        lookup = input;
        return [
          profileDoc("photo", { applicant_id: "another-applicant" }),
          profileDoc("portrait_photo", { updated_at: "2026-09-02T00:00:00.000Z" }),
        ];
      },
    });

    assert.deepEqual(lookup, { applicationId: "application-id", applicantId: "applicant-id" });
    assert.equal(selected?.application_id, "application-id");
    assert.equal(selected?.document_type, "portrait_photo");
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
