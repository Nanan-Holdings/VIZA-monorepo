import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { test } from "node:test";
import { basename, dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import {
  assertDs160PhotoFile,
  Ds160PhotoPreflightError,
  validateDs160PhotoBytes,
} from "../photo-preflight";
import { buildPhotoFileFromDownloadedDocument, resolveDs160PhotoDocument } from "../photo-document";
import { classifyDs160RetryFailure } from "../submission-retry";

function jpegFixture(options: { width?: number; height?: number } = {}): Uint8Array {
  const width = options.width ?? 600;
  const height = options.height ?? 600;
  const precision = 8;
  const components = 3;
  const sofPayload = [
    precision,
    height >> 8,
    height & 0xff,
    width >> 8,
    width & 0xff,
    components,
    1, 0x11, 0,
    2, 0x11, 0,
    3, 0x11, 0,
  ];
  const sosPayload = [components, 1, 0, 2, 0, 3, 0, 0, 0x3f, 0];
  return Uint8Array.from([
    0xff, 0xd8,
    0xff, 0xe0, 0, 2,
    0xff, 0xc0, 0, sofPayload.length + 2, ...sofPayload,
    0xff, 0xda, 0, sosPayload.length + 2, ...sosPayload,
    0, 0xff, 0, 1, 0xff, 0xd9,
  ]);
}

function cleanupTempOutput(outputDir: string, prefix: string): void {
  const tempRoot = resolve(tmpdir()).toLowerCase();
  const resolvedOutput = resolve(outputDir);
  if (
    dirname(resolvedOutput).toLowerCase() !== tempRoot ||
    !basename(resolvedOutput).startsWith(prefix)
  ) {
    throw new Error(`Refusing to remove unexpected test output path: ${resolvedOutput}`);
  }
  rmSync(resolvedOutput, { recursive: true, force: true });
}

test("rejects a non-square legacy profile photo before CEAC starts", async () => {
  const outputDir = mkdtempSync(join(tmpdir(), "ceac-photo-preflight-"));
  const photoPath = join(outputDir, "legacy-profile-photo.jpg");
  writeFileSync(photoPath, jpegFixture({ width: 643, height: 849 }));
  try {
    const selected = await resolveDs160PhotoDocument({
      applicationId: "application-id",
      applicantId: "applicant-id",
      applicationDocuments: [{
        id: "passport-id",
        application_id: "application-id",
        document_type: "passport_copy",
        storage_path: "passport-copy.pdf",
        status: "uploaded",
        file_name: "passport-copy.pdf",
      }],
      loadReusableProfileDocuments: async () => [{
        id: "profile-photo-id",
        applicant_id: "applicant-id",
        document_type: "photo",
        storage_path: "legacy-profile-photo.jpg",
        status: "uploaded",
      }],
    });
    assert.equal(selected?.document_type, "photo");
    assert.deepEqual(
      buildPhotoFileFromDownloadedDocument(selected, new Map([["photo", photoPath]])),
      { kind: "path", path: photoPath },
    );
    assert.equal(validateDs160PhotoBytes(jpegFixture({ width: 643, height: 849 })), "not_square");
    await assert.rejects(
      assertDs160PhotoFile(photoPath),
      (error: unknown) => {
        assert.ok(error instanceof Ds160PhotoPreflightError);
        assert.equal(error.code, "DS160_PHOTO_INVALID");
        assert.equal(error.reason, "not_square");
        assert.equal(error.message, "DS160_PHOTO_INVALID:not_square");
        assert.doesNotMatch(error.message, /legacy-profile-photo|ceac-photo-preflight/);
        assert.equal(classifyDs160RetryFailure(error, 0, 3), "blocked");
        return true;
      },
    );
  } finally {
    cleanupTempOutput(outputDir, "ceac-photo-preflight-");
  }
});

test("accepts a valid 600 by 600 three-channel JPEG", async () => {
  const outputDir = mkdtempSync(join(tmpdir(), "ceac-photo-preflight-"));
  const photoPath = join(outputDir, "profile-photo.jpg");
  writeFileSync(photoPath, jpegFixture());
  try {
    assert.equal(validateDs160PhotoBytes(jpegFixture()), null);
    await assert.doesNotReject(assertDs160PhotoFile(photoPath));
  } finally {
    cleanupTempOutput(outputDir, "ceac-photo-preflight-");
  }
});
