import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const state = {
    session: {
      userId: "applicant-1",
      email: "applicant@example.test",
      authUserId: "auth-1",
    } as { userId: string; email: string; authUserId: string } | null,
    application: {
      id: "application-1",
      country: "united_states",
      visa_type: "B1_B2",
      status: "draft",
      created_at: null,
      updated_at: null,
      submitted_at: null,
      visa_package_id: null,
    } as {
      id: string;
      country: string;
      visa_type: string;
      status: string;
      created_at: string | null;
      updated_at: string | null;
      submitted_at: string | null;
      visa_package_id: string | null;
    } | null,
    profileDocument: {
      storage_path: "applicant-1/universal-profile/photo/old-photo.jpg",
      filename: "old-photo.jpg",
      document_type: "photo",
      status: "uploaded",
    } as {
      storage_path: string;
      filename: string;
      document_type: string;
      status: string;
    } | null,
    downloadedBytes: new Uint8Array(),
    storageObjectExists: true,
  };

  const applicationDocumentsUpsert = vi.fn(async () => ({ error: null }));
  const storageUpload = vi.fn(async () => ({ error: null }));
  const storageDownload = vi.fn(async () => ({
    data: {
      size: state.downloadedBytes.byteLength,
      arrayBuffer: async () => toArrayBuffer(state.downloadedBytes),
    },
    error: null,
  }));
  const storageExists = vi.fn(async () => ({ data: state.storageObjectExists, error: null }));
  const storageBucket = {
    upload: storageUpload,
    download: storageDownload,
    exists: storageExists,
    remove: vi.fn(async () => ({ data: null, error: null })),
  };

  const createQuery = (table: string) => {
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn(() => query),
      in: vi.fn(() => query),
      order: vi.fn(() => query),
      limit: vi.fn(() => query),
      update: vi.fn(() => query),
      delete: vi.fn(() => query),
      insert: vi.fn(() => query),
      upsert: table === "application_documents"
        ? applicationDocumentsUpsert
        : vi.fn(async () => ({ error: null })),
      maybeSingle: vi.fn(async () => {
        if (table === "applicant_profiles") {
          return {
            data: state.session
              ? { id: state.session.userId, auth_user_id: state.session.authUserId, email: state.session.email }
              : null,
            error: null,
          };
        }
        if (table === "applications") {
          return { data: state.application, error: null };
        }
        if (table === "universal_profile_documents") {
          return { data: state.profileDocument, error: null };
        }
        return { data: null, error: null };
      }),
      single: vi.fn(async () => ({ data: null, error: null })),
    };
    return query;
  };

  const adminClient = {
    from: vi.fn((table: string) => createQuery(table)),
    storage: {
      getBucket: vi.fn(async () => ({ data: { id: "application-documents" }, error: null })),
      createBucket: vi.fn(async () => ({ data: null, error: null })),
      from: vi.fn(() => storageBucket),
    },
  };

  return {
    state,
    adminClient,
    createAdminClient: vi.fn(() => adminClient),
    getClientSessionWithFallback: vi.fn(async () => state.session),
    getImpersonationSession: vi.fn(async () => null),
    applicationDocumentsUpsert,
    storageUpload,
    storageDownload,
    storageExists,
  };
});

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/client-session", () => ({ getClientSessionWithFallback: mocks.getClientSessionWithFallback }));
vi.mock("@/lib/impersonation-session", () => ({ getImpersonationSession: mocks.getImpersonationSession }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/app/api/passport-ocr/provider", () => ({
  PassportOcrProviderError: class PassportOcrProviderError extends Error {},
  extractPassportOcr: vi.fn(),
}));

import {
  reuseUniversalProfileDocument,
  uploadApplicationDocument,
} from "../actions";
import { DS160_PHOTO_MAX_BYTES } from "@/lib/ds160-photo-contract";

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(new ArrayBuffer(bytes.byteLength));
  copy.set(bytes);
  return copy.buffer;
}

function buildValidJpegBytes(width = 600, height = 600): Uint8Array<ArrayBuffer> {
  const sofPayload = [
    8,
    height >> 8,
    height & 0xff,
    width >> 8,
    width & 0xff,
    3,
    1,
    0x11,
    0,
    2,
    0x11,
    0,
    3,
    0x11,
    0,
  ];
  const sosPayload = [3, 1, 0, 2, 0, 3, 0, 0, 0x3f, 0];
  const result = [
    0xff,
    0xd8,
    0xff,
    0xc0,
    0,
    sofPayload.length + 2,
    ...sofPayload,
    0xff,
    0xda,
    0,
    sosPayload.length + 2,
    ...sosPayload,
    0,
    0xff,
    0,
    1,
    0xff,
    0xd9,
  ];
  const bytes = new Uint8Array(new ArrayBuffer(result.length));
  bytes.set(result);
  return bytes;
}

function uploadForm(file: File, values: { applicationId?: string; locale?: string } = {}): FormData {
  const formData = new FormData();
  formData.set("applicationId", values.applicationId ?? "application-1");
  formData.set("documentType", "photo");
  formData.set("requirementKey", "portrait_photo");
  formData.set("filename", "photo.jpg");
  formData.set("required", "true");
  if (values.locale) formData.set("locale", values.locale);
  formData.set("file", file);
  return formData;
}

function photoFile(bytes: Uint8Array, name = "photo.jpg"): File {
  const file = new File([toArrayBuffer(bytes)], name, { type: "image/jpeg" });
  Object.defineProperty(file, "arrayBuffer", {
    configurable: true,
    value: async () => toArrayBuffer(bytes),
  });
  return file;
}

describe("DS-160 photo document actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.state.session = {
      userId: "applicant-1",
      email: "applicant@example.test",
      authUserId: "auth-1",
    };
    mocks.state.application = {
      id: "application-1",
      country: "united_states",
      visa_type: "B1_B2",
      status: "draft",
      created_at: null,
      updated_at: null,
      submitted_at: null,
      visa_package_id: null,
    };
    mocks.state.profileDocument = {
      storage_path: "applicant-1/universal-profile/photo/old-photo.jpg",
      filename: "old-photo.jpg",
      document_type: "photo",
      status: "uploaded",
    };
    mocks.state.downloadedBytes = buildValidJpegBytes();
    mocks.state.storageObjectExists = true;
  });

  it("rejects invalid photo bytes before Storage upload or record upsert", async () => {
    const result = await uploadApplicationDocument(uploadForm(photoFile(Uint8Array.from([1, 2, 3]))));

    expect(result).toMatchObject({ ok: false, code: "invalid_request" });
    expect(mocks.storageUpload).not.toHaveBeenCalled();
    expect(mocks.applicationDocumentsUpsert).not.toHaveBeenCalled();
  });

  it("rejects an oversized photo before Storage upload", async () => {
    const oversized = new Uint8Array(DS160_PHOTO_MAX_BYTES + 1);
    oversized.set(buildValidJpegBytes());
    const result = await uploadApplicationDocument(uploadForm(photoFile(oversized)));

    expect(result).toMatchObject({ ok: false, code: "invalid_request" });
    expect(mocks.storageUpload).not.toHaveBeenCalled();
    expect(mocks.applicationDocumentsUpsert).not.toHaveBeenCalled();
  });

  it("uploads a valid DS-160 photo and records it after validation", async () => {
    const result = await uploadApplicationDocument(uploadForm(photoFile(buildValidJpegBytes())));

    expect(result).toMatchObject({ ok: true, filename: "photo.jpg" });
    expect(mocks.storageUpload).toHaveBeenCalledTimes(1);
    expect(mocks.applicationDocumentsUpsert).toHaveBeenCalledTimes(1);
  });

  it("validates the downloaded bytes before reusing a profile photo", async () => {
    mocks.state.downloadedBytes = Uint8Array.from([1, 2, 3]);
    const result = await reuseUniversalProfileDocument({
      applicationId: "application-1",
      documentType: "photo",
      requirementKey: "portrait_photo",
      required: true,
    });

    expect(result).toMatchObject({ ok: false, code: "invalid_request" });
    expect(mocks.storageDownload).toHaveBeenCalledTimes(1);
    expect(mocks.applicationDocumentsUpsert).not.toHaveBeenCalled();
  });

  it("reuses a valid profile photo only after the byte check", async () => {
    const result = await reuseUniversalProfileDocument({
      applicationId: "application-1",
      documentType: "photo",
      requirementKey: "portrait_photo",
      required: true,
    });

    expect(result).toEqual({ ok: true });
    expect(mocks.storageDownload).toHaveBeenCalledTimes(1);
    expect(mocks.applicationDocumentsUpsert).toHaveBeenCalledTimes(1);
  });

  it("keeps application ownership checks before Storage access", async () => {
    mocks.state.application = null;
    const result = await uploadApplicationDocument(uploadForm(photoFile(buildValidJpegBytes())));

    expect(result).toEqual({ ok: false, code: "not_found", error: "Application not found" });
    expect(mocks.storageUpload).not.toHaveBeenCalled();
    expect(mocks.applicationDocumentsUpsert).not.toHaveBeenCalled();
  });
});
