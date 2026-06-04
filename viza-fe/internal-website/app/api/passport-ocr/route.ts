import { NextRequest, NextResponse } from "next/server";
import { getUserFromSupabaseSession } from "@/lib/client-session";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  extractPassportOcr,
  getPassportOcrProviderName,
  isSupportedPassportMimeType,
  PassportOcrProviderError,
} from "./provider";
import type {
  PassportOcrError,
  PassportOcrFailureResponse,
  PassportOcrFile,
  PassportOcrProposedFields,
  PassportOcrResponse,
  PassportOcrSuccessResponse,
  SupportedPassportMimeType,
} from "./types";

export const runtime = "nodejs";

const STORAGE_BUCKET = "application-documents";
const DEFAULT_MAX_FILE_BYTES = 10 * 1024 * 1024;

interface PassportOcrRequestBody {
  applicationId?: string;
  documentId?: string;
  storagePath?: string;
}

interface ApplicationRow {
  id: string;
  applicant_id: string;
}

interface DocumentRow {
  id: string;
  application_id: string;
  document_type: string;
  storage_path: string | null;
  filename: string | null;
  status: string | null;
}

interface OcrAttemptMetadata {
  sourceMimeType?: string;
  sourceBytes?: number;
  fieldKeys?: string[];
  confidence?: number;
  warnings?: string[];
  failureCode?: string;
}

function jsonFailure(error: PassportOcrError, status: number) {
  const body: PassportOcrFailureResponse = { success: false, error };
  return NextResponse.json(body, { status });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseBody(value: unknown): PassportOcrRequestBody | null {
  if (!isRecord(value)) return null;

  return {
    applicationId: typeof value.applicationId === "string" ? value.applicationId.trim() : undefined,
    documentId: typeof value.documentId === "string" ? value.documentId.trim() : undefined,
    storagePath: typeof value.storagePath === "string" ? value.storagePath.trim() : undefined,
  };
}

function maxFileBytes(): number {
  const configured = Number(process.env.PASSPORT_OCR_MAX_FILE_BYTES);
  if (Number.isFinite(configured) && configured > 0) return configured;
  return DEFAULT_MAX_FILE_BYTES;
}

function inferMimeType(blobType: string, filename: string, storagePath: string): string {
  if (blobType && blobType !== "application/octet-stream") return blobType.toLowerCase();

  const source = `${filename} ${storagePath}`.toLowerCase();
  if (source.endsWith(".pdf")) return "application/pdf";
  if (source.endsWith(".png")) return "image/png";
  if (source.endsWith(".webp")) return "image/webp";
  if (source.endsWith(".jpg") || source.endsWith(".jpeg")) return "image/jpeg";
  return blobType.toLowerCase();
}

function isPassportDocumentType(documentType: string): boolean {
  return ["passport_copy", "passport", "passport_bio_page", "passport_scan"].includes(documentType);
}

function safeExtractedFieldMetadata(
  status: "processing" | "succeeded" | "failed",
  metadata: OcrAttemptMetadata = {},
) {
  return {
    status,
    source_mime_type: metadata.sourceMimeType,
    source_bytes: metadata.sourceBytes,
    proposed_field_keys: metadata.fieldKeys,
    confidence: metadata.confidence,
    warnings: metadata.warnings,
    failure_code: metadata.failureCode,
  };
}

function serializeProposedFields(fields: PassportOcrProposedFields) {
  return {
    full_name: fields.fullName,
    given_names: fields.givenNames,
    surname: fields.surname,
    passport_number: fields.passportNumber,
    date_of_birth: fields.dateOfBirth,
    place_of_birth: fields.placeOfBirth,
    nationality: fields.nationality,
    passport_issuing_country: fields.issuingCountry,
    issuing_country: fields.issuingCountry,
    passport_issue_date: fields.issueDate,
    issue_date: fields.issueDate,
    passport_expiry_date: fields.expiryDate,
    expiry_date: fields.expiryDate,
    gender: fields.gender,
    proposed_fields: fields,
  };
}

async function createOcrAttempt(params: {
  adminClient: ReturnType<typeof createAdminClient>;
  applicationId: string;
  applicantId: string;
  documentId: string;
  provider: string;
}) {
  const { data } = await params.adminClient
    .from("ocr_extractions")
    .insert({
      application_id: params.applicationId,
      applicant_id: params.applicantId,
      document_id: params.documentId,
      provider: params.provider,
      status: "processing",
      extracted_fields: safeExtractedFieldMetadata("processing"),
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .maybeSingle();

  return typeof data?.id === "string" ? data.id : null;
}

async function updateOcrAttempt(params: {
  adminClient: ReturnType<typeof createAdminClient>;
  extractionId: string | null;
  status: "succeeded" | "failed";
  metadata: OcrAttemptMetadata;
  fields?: PassportOcrProposedFields;
  errorMessage?: string;
}) {
  if (!params.extractionId) return;

  const metadata = safeExtractedFieldMetadata(params.status, params.metadata);
  await params.adminClient
    .from("ocr_extractions")
    .update({
      status: params.status,
      extracted_fields: params.fields ? { ...metadata, ...serializeProposedFields(params.fields) } : metadata,
      error_message: params.errorMessage ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.extractionId);
}

async function loadOwnedApplication(params: {
  adminClient: ReturnType<typeof createAdminClient>;
  applicationId: string;
  applicantId: string;
}): Promise<ApplicationRow | null> {
  const { data } = await params.adminClient
    .from("applications")
    .select("id, applicant_id")
    .eq("id", params.applicationId)
    .eq("applicant_id", params.applicantId)
    .maybeSingle();

  return data as ApplicationRow | null;
}

async function loadOwnedDocument(params: {
  adminClient: ReturnType<typeof createAdminClient>;
  applicationId: string;
  documentId?: string;
  storagePath?: string;
}): Promise<DocumentRow | null> {
  let query = params.adminClient
    .from("application_documents")
    .select("id, application_id, document_type, storage_path, filename, status")
    .eq("application_id", params.applicationId)
    .limit(1);

  if (params.documentId) {
    query = query.eq("id", params.documentId);
  } else if (params.storagePath) {
    query = query.eq("storage_path", params.storagePath);
  } else {
    return null;
  }

  const { data } = await query.maybeSingle();
  return data as DocumentRow | null;
}

async function downloadPassportFile(params: {
  adminClient: ReturnType<typeof createAdminClient>;
  document: DocumentRow;
}): Promise<{ file?: PassportOcrFile; failure?: { error: PassportOcrError; status: number } }> {
  const storagePath = params.document.storage_path;
  if (!storagePath) {
    return {
      failure: {
        status: 404,
        error: {
          code: "missing_file",
          message: "This passport document does not have an uploaded file.",
        },
      },
    };
  }

  const { data, error } = await params.adminClient.storage.from(STORAGE_BUCKET).download(storagePath);
  if (error || !data) {
    return {
      failure: {
        status: 404,
        error: {
          code: "missing_file",
          message: "The uploaded passport file could not be found.",
        },
      },
    };
  }

  const bytes = Buffer.from(await data.arrayBuffer());
  if (bytes.length === 0) {
    return {
      failure: {
        status: 422,
        error: {
          code: "unreadable",
          message: "The uploaded passport file is empty.",
        },
      },
    };
  }

  if (bytes.length > maxFileBytes()) {
    return {
      failure: {
        status: 413,
        error: {
          code: "unsupported_file",
          message: "The uploaded passport file is too large for OCR.",
        },
      },
    };
  }

  const filename = params.document.filename ?? storagePath.split("/").at(-1) ?? "passport";
  const mimeType = inferMimeType(data.type, filename, storagePath);
  if (!isSupportedPassportMimeType(mimeType)) {
    return {
      failure: {
        status: 415,
        error: {
          code: "unsupported_file",
          message: "Passport OCR supports PDF, JPG, PNG, and WebP files.",
        },
      },
    };
  }

  return {
    file: {
      bytes,
      filename,
      mimeType: mimeType as SupportedPassportMimeType,
    },
  };
}

function populatedFieldKeys(fields: PassportOcrSuccessResponse["proposedFields"]): string[] {
  return Object.entries(fields)
    .filter(([, field]) => Boolean(field.value))
    .map(([key]) => key);
}

export async function POST(request: NextRequest): Promise<NextResponse<PassportOcrResponse>> {
  const session = await getUserFromSupabaseSession();
  if (!session) {
    return jsonFailure(
      {
        code: "unauthorized",
        message: "Sign in before running passport OCR.",
      },
      401,
    );
  }

  let parsedBody: PassportOcrRequestBody | null = null;
  try {
    parsedBody = parseBody(await request.json());
  } catch {
    return jsonFailure(
      {
        code: "invalid_request",
        message: "Request body must be valid JSON.",
      },
      400,
    );
  }

  if (!parsedBody?.applicationId) {
    return jsonFailure(
      {
        code: "invalid_request",
        message: "applicationId is required.",
      },
      400,
    );
  }

  if (!parsedBody.documentId && !parsedBody.storagePath) {
    return jsonFailure(
      {
        code: "missing_file",
        message: "Provide a passport documentId or storagePath to OCR.",
      },
      400,
    );
  }

  const adminClient = createAdminClient();
  const application = await loadOwnedApplication({
    adminClient,
    applicationId: parsedBody.applicationId,
    applicantId: session.userId,
  });

  if (!application) {
    return jsonFailure(
      {
        code: "application_not_found",
        message: "Application was not found for the signed-in user.",
      },
      404,
    );
  }

  const document = await loadOwnedDocument({
    adminClient,
    applicationId: application.id,
    documentId: parsedBody.documentId,
    storagePath: parsedBody.storagePath,
  });

  if (!document) {
    return jsonFailure(
      {
        code: "document_not_found",
        message: "Passport document was not found for this application.",
      },
      404,
    );
  }

  if (!isPassportDocumentType(document.document_type)) {
    return jsonFailure(
      {
        code: "unsupported_file",
        message: "Only passport documents can be processed by this OCR route.",
      },
      415,
    );
  }

  const downloaded = await downloadPassportFile({ adminClient, document });
  if (downloaded.failure) {
    return jsonFailure(downloaded.failure.error, downloaded.failure.status);
  }

  const file = downloaded.file;
  if (!file) {
    return jsonFailure(
      {
        code: "missing_file",
        message: "The uploaded passport file could not be loaded.",
      },
      404,
    );
  }

  const provider = getPassportOcrProviderName();
  const extractionId = await createOcrAttempt({
    adminClient,
    applicationId: application.id,
    applicantId: session.userId,
    documentId: document.id,
    provider,
  });

  try {
    const result = await extractPassportOcr(file);
    const metadata: OcrAttemptMetadata = {
      sourceMimeType: file.mimeType,
      sourceBytes: file.bytes.length,
      fieldKeys: populatedFieldKeys(result.fields),
      confidence: result.confidence,
      warnings: result.warnings,
    };

    if (!result.isReadable) {
      await updateOcrAttempt({
        adminClient,
        extractionId,
        status: "failed",
        metadata: { ...metadata, failureCode: "unreadable" },
        errorMessage: "Document unreadable",
      });

      return jsonFailure(
        {
          code: "unreadable",
          message: "We could not read passport fields from this file. Please upload a clearer passport bio page.",
        },
        422,
      );
    }

    await updateOcrAttempt({
      adminClient,
      extractionId,
      status: "succeeded",
      metadata,
      fields: result.fields,
    });

    const body: PassportOcrSuccessResponse = {
      success: true,
      extractionId,
      applicationId: application.id,
      documentId: document.id,
      provider: result.provider,
      confidence: result.confidence,
      proposedFields: result.fields,
      needsConfirmation: true,
      warnings: result.warnings,
    };

    return NextResponse.json(body);
  } catch (error) {
    const providerError =
      error instanceof PassportOcrProviderError
        ? error
        : new PassportOcrProviderError("provider_failed", "Passport OCR failed.", true);

    await updateOcrAttempt({
      adminClient,
      extractionId,
      status: "failed",
      metadata: {
        sourceMimeType: file.mimeType,
        sourceBytes: file.bytes.length,
        failureCode: providerError.code,
      },
      errorMessage: providerError.message,
    });

    return jsonFailure(
      {
        code: providerError.code,
        message: providerError.message,
        retryable: providerError.retryable,
      },
      providerError.code === "provider_unavailable" ? 503 : 502,
    );
  }
}
