import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const EXTERNAL_STATUSES = [
  "handoff_received",
  "in_progress",
  "submitted",
  "action_required",
  "completed",
  "failed",
  "cancelled",
] as const;

const RESULT_STATUSES = [
  "pending",
  "approved",
  "issued",
  "rejected",
  "administrative_processing",
  "additional_documents_requested",
  "withdrawn",
  "not_available",
] as const;

const UPDATE_SOURCES = [
  "external_submission_owner",
  "external_submission_partner",
  "official_portal",
  "consulate",
  "staff_verified",
  "system",
] as const;

const FILE_REFERENCE_KINDS = [
  "receipt",
  "approval_letter",
  "issued_visa",
  "rejection_letter",
  "official_notice",
  "supporting_document",
] as const;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REFERENCE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/# -]{0,127}$/;
const STORAGE_PATH_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/\- ]{0,511}$/;

type ExternalStatus = (typeof EXTERNAL_STATUSES)[number];
type ResultStatus = (typeof RESULT_STATUSES)[number];
type UpdateSource = (typeof UPDATE_SOURCES)[number];
type FileReferenceKind = (typeof FILE_REFERENCE_KINDS)[number];

interface ValidationIssue {
  field: string;
  message: string;
}

interface FileReference {
  kind: FileReferenceKind;
  storagePath?: string;
  url?: string;
  label?: string;
}

interface IngestPayload {
  applicationId: string;
  externalStatus: ExternalStatus;
  resultStatus?: ResultStatus;
  reference?: string | null;
  fileReferences?: FileReference[];
  resultNotes?: string | null;
  updateSource: UpdateSource;
}

interface ApplicationRecord {
  id: string;
  applicant_id: string | null;
  external_status: string | null;
  external_reference: string | null;
  result_status: string | null;
  result_storage_path: string | null;
  result_notes: string | null;
}

type ApplicationPatch = Record<string, string | null>;

function jsonResponse(
  body: Record<string, unknown>,
  status: number,
): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function unauthorizedResponse() {
  return jsonResponse(
    {
      ok: false,
      error: {
        code: "unauthorized",
        message: "Missing or invalid external submission token",
      },
    },
    401,
  );
}

function validationResponse(issues: ValidationIssue[]) {
  return jsonResponse(
    {
      ok: false,
      error: {
        code: "validation_failed",
        message: "Invalid external submission payload",
        fields: issues,
      },
    },
    400,
  );
}

function serverErrorResponse(code: string, message: string) {
  return jsonResponse(
    {
      ok: false,
      error: {
        code,
        message,
      },
    },
    500,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function isOneOf<T extends readonly string[]>(
  value: unknown,
  allowed: T,
): value is T[number] {
  return typeof value === "string" && allowed.includes(value);
}

function trimOptionalString(
  record: Record<string, unknown>,
  key: string,
  issues: ValidationIssue[],
  options: {
    maxLength: number;
    allowNull?: boolean;
    pattern?: RegExp;
    patternMessage?: string;
  },
): string | null | undefined {
  if (!hasOwn(record, key)) return undefined;

  const value = record[key];
  if (value === null && options.allowNull) return null;

  if (typeof value !== "string") {
    issues.push({ field: key, message: "Must be a string" });
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    issues.push({ field: key, message: "Must not be empty" });
    return undefined;
  }

  if (trimmed.length > options.maxLength) {
    issues.push({
      field: key,
      message: `Must be ${options.maxLength} characters or fewer`,
    });
    return undefined;
  }

  if (options.pattern && !options.pattern.test(trimmed)) {
    issues.push({
      field: key,
      message: options.patternMessage ?? "Contains unsupported characters",
    });
    return undefined;
  }

  return trimmed;
}

function isSafeHttpsUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return (
      parsed.protocol === "https:" &&
      !parsed.username &&
      !parsed.password &&
      !parsed.search &&
      !parsed.hash &&
      value.length <= 1024
    );
  } catch {
    return false;
  }
}

function isSafeStoragePath(value: string): boolean {
  return (
    STORAGE_PATH_PATTERN.test(value) &&
    !value.includes("..") &&
    !value.includes("//") &&
    !value.includes("\\") &&
    !/^[a-z][a-z0-9+.-]*:/i.test(value)
  );
}

function validateFileReference(
  value: unknown,
  index: number,
  issues: ValidationIssue[],
): FileReference | null {
  const field = `fileReferences[${index}]`;
  if (!isRecord(value)) {
    issues.push({ field, message: "Must be an object" });
    return null;
  }

  if (!isOneOf(value.kind, FILE_REFERENCE_KINDS)) {
    issues.push({
      field: `${field}.kind`,
      message: `Must be one of: ${FILE_REFERENCE_KINDS.join(", ")}`,
    });
  }

  const storagePath = trimOptionalString(value, "storagePath", issues, {
    maxLength: 512,
    pattern: STORAGE_PATH_PATTERN,
    patternMessage: "Must be a relative Supabase Storage path",
  });
  const url = trimOptionalString(value, "url", issues, {
    maxLength: 1024,
  });
  const label = trimOptionalString(value, "label", issues, {
    maxLength: 80,
  });

  if (!storagePath && !url) {
    issues.push({
      field,
      message: "Must include storagePath or url",
    });
  }

  if (storagePath && !isSafeStoragePath(storagePath)) {
    issues.push({
      field: `${field}.storagePath`,
      message: "Must be a relative path without traversal or protocol",
    });
  }

  if (url && !isSafeHttpsUrl(url)) {
    issues.push({
      field: `${field}.url`,
      message: "Must be an HTTPS URL without credentials, query, or fragment",
    });
  }

  if (!isOneOf(value.kind, FILE_REFERENCE_KINDS) || (!storagePath && !url)) {
    return null;
  }

  return {
    kind: value.kind,
    ...(storagePath ? { storagePath } : {}),
    ...(url ? { url } : {}),
    ...(label ? { label } : {}),
  };
}

function validatePayload(body: unknown): {
  payload?: IngestPayload;
  issues: ValidationIssue[];
} {
  const issues: ValidationIssue[] = [];

  if (!isRecord(body)) {
    return {
      issues: [{ field: "$", message: "Payload must be a JSON object" }],
    };
  }

  const hasApplicationId = hasOwn(body, "applicationId");
  const applicationId = trimOptionalString(body, "applicationId", issues, {
    maxLength: 36,
    pattern: UUID_PATTERN,
    patternMessage: "Must be a valid UUID",
  });

  if (!hasApplicationId) {
    issues.push({
      field: "applicationId",
      message: "Required",
    });
  }

  if (!isOneOf(body.externalStatus, EXTERNAL_STATUSES)) {
    issues.push({
      field: "externalStatus",
      message: `Must be one of: ${EXTERNAL_STATUSES.join(", ")}`,
    });
  }

  if (hasOwn(body, "resultStatus") && !isOneOf(body.resultStatus, RESULT_STATUSES)) {
    issues.push({
      field: "resultStatus",
      message: `Must be one of: ${RESULT_STATUSES.join(", ")}`,
    });
  }

  if (!isOneOf(body.updateSource, UPDATE_SOURCES)) {
    issues.push({
      field: "updateSource",
      message: `Must be one of: ${UPDATE_SOURCES.join(", ")}`,
    });
  }

  const reference = trimOptionalString(body, "reference", issues, {
    maxLength: 128,
    allowNull: true,
    pattern: REFERENCE_PATTERN,
    patternMessage:
      "Use letters, numbers, spaces, dots, dashes, underscores, slashes, colons, or #",
  });

  const resultNotes = trimOptionalString(body, "resultNotes", issues, {
    maxLength: 2000,
    allowNull: true,
  });

  let fileReferences: FileReference[] | undefined;
  if (hasOwn(body, "fileReferences")) {
    if (!Array.isArray(body.fileReferences)) {
      issues.push({
        field: "fileReferences",
        message: "Must be an array",
      });
    } else if (body.fileReferences.length === 0 || body.fileReferences.length > 10) {
      issues.push({
        field: "fileReferences",
        message: "Must include 1 to 10 file references when provided",
      });
    } else {
      fileReferences = body.fileReferences
        .map((item, index) => validateFileReference(item, index, issues))
        .filter((item): item is FileReference => Boolean(item));
    }
  }

  if (
    issues.length > 0 ||
    !applicationId ||
    !isOneOf(body.externalStatus, EXTERNAL_STATUSES) ||
    !isOneOf(body.updateSource, UPDATE_SOURCES)
  ) {
    return { issues };
  }

  return {
    issues,
    payload: {
      applicationId,
      externalStatus: body.externalStatus,
      updateSource: body.updateSource,
      ...(hasOwn(body, "resultStatus") && isOneOf(body.resultStatus, RESULT_STATUSES)
        ? { resultStatus: body.resultStatus }
        : {}),
      ...(hasOwn(body, "reference") ? { reference } : {}),
      ...(fileReferences ? { fileReferences } : {}),
      ...(hasOwn(body, "resultNotes") ? { resultNotes } : {}),
    },
  };
}

function getCredential(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length).trim();
  }

  const headerToken = request.headers.get("x-external-submission-token");
  return headerToken?.trim() || null;
}

function tokenMatches(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(actualBuffer, expectedBuffer);
}

function authenticate(request: Request):
  | { ok: true }
  | { ok: false; response: NextResponse } {
  const credential = getCredential(request);
  if (!credential) {
    return { ok: false, response: unauthorizedResponse() };
  }

  const expectedToken = process.env.EXTERNAL_SUBMISSION_TOKEN;
  if (!expectedToken) {
    return {
      ok: false,
      response: jsonResponse(
        {
          ok: false,
          error: {
            code: "service_unconfigured",
            message: "External submission ingest token is not configured",
          },
        },
        503,
      ),
    };
  }

  if (!tokenMatches(credential, expectedToken)) {
    return { ok: false, response: unauthorizedResponse() };
  }

  return { ok: true };
}

function getPrimaryResultReference(fileReferences: FileReference[] | undefined) {
  if (!fileReferences?.length) return undefined;

  const priority: FileReferenceKind[] = [
    "issued_visa",
    "approval_letter",
    "rejection_letter",
    "official_notice",
    "receipt",
    "supporting_document",
  ];

  const primary =
    priority
      .map((kind) => fileReferences.find((reference) => reference.kind === kind))
      .find(Boolean) ?? fileReferences[0];

  return primary.storagePath ?? primary.url;
}

function buildNotificationTemplate(payload: IngestPayload): string {
  if (payload.resultStatus) return "external_submission_result_updated";
  if (payload.externalStatus === "action_required") {
    return "external_submission_action_required";
  }
  if (payload.externalStatus === "failed") return "external_submission_failed";
  return "external_submission_status_updated";
}

export async function POST(request: Request) {
  const auth = authenticate(request);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return validationResponse([
      { field: "$", message: "Request body must be valid JSON" },
    ]);
  }

  const { payload, issues } = validatePayload(body);
  if (!payload) return validationResponse(issues);

  const adminClient = createAdminClient();
  const { data: applicationData, error: applicationError } = await adminClient
    .from("applications")
    .select(
      "id, applicant_id, external_status, external_reference, result_status, result_storage_path, result_notes",
    )
    .eq("id", payload.applicationId)
    .maybeSingle();

  if (applicationError) {
    console.error(
      "[external-submission] Failed to load application:",
      applicationError.message,
    );
    return serverErrorResponse(
      "application_lookup_failed",
      "Failed to load application",
    );
  }

  const application = applicationData as ApplicationRecord | null;
  if (!application) {
    return jsonResponse(
      {
        ok: false,
        error: {
          code: "application_not_found",
          message: "Application not found",
        },
      },
      404,
    );
  }

  const now = new Date().toISOString();
  const primaryResultReference = getPrimaryResultReference(
    payload.fileReferences,
  );
  const applicationPatch: ApplicationPatch = {
    external_status: payload.externalStatus,
    external_status_updated_at: now,
    updated_at: now,
  };

  if (payload.reference !== undefined) {
    applicationPatch.external_reference = payload.reference;
  }

  if (payload.resultStatus !== undefined) {
    applicationPatch.result_status = payload.resultStatus;
  }

  if (primaryResultReference !== undefined) {
    applicationPatch.result_storage_path = primaryResultReference;
  }

  if (payload.resultNotes !== undefined) {
    applicationPatch.result_notes = payload.resultNotes;
  }

  const { error: updateError } = await adminClient
    .from("applications")
    .update(applicationPatch)
    .eq("id", payload.applicationId);

  if (updateError) {
    console.error(
      "[external-submission] Failed to update application:",
      updateError.message,
    );
    return serverErrorResponse(
      "application_update_failed",
      "Failed to update application status",
    );
  }

  const eventMetadata = {
    externalStatus: payload.externalStatus,
    previousExternalStatus: application.external_status,
    resultStatus: payload.resultStatus ?? null,
    previousResultStatus: application.result_status,
    externalReference:
      payload.reference === undefined
        ? application.external_reference
        : payload.reference,
    previousExternalReference: application.external_reference,
    resultStoragePath:
      primaryResultReference === undefined
        ? application.result_storage_path
        : primaryResultReference,
    fileReferences: payload.fileReferences ?? [],
    resultNotes:
      payload.resultNotes === undefined
        ? application.result_notes
        : payload.resultNotes,
    updateSource: payload.updateSource,
    receivedAt: now,
  };

  const { error: eventError } = await adminClient
    .from("application_events")
    .insert({
      application_id: payload.applicationId,
      applicant_id: application.applicant_id,
      event_type: payload.resultStatus
        ? "external_submission_result_updated"
        : "external_submission_status_updated",
      actor_type: "external_submission",
      message: payload.resultStatus
        ? `External submission result updated to ${payload.resultStatus}`
        : `External submission status updated to ${payload.externalStatus}`,
      metadata: eventMetadata,
    });

  if (eventError) {
    console.error(
      "[external-submission] Failed to insert application event:",
      eventError.message,
    );
    return serverErrorResponse(
      "application_event_insert_failed",
      "Application was updated but audit event insertion failed",
    );
  }

  let recipient: string | null = null;
  if (application.applicant_id) {
    const { data: profileData, error: profileError } = await adminClient
      .from("applicant_profiles")
      .select("email")
      .eq("id", application.applicant_id)
      .maybeSingle();

    if (profileError) {
      console.warn(
        "[external-submission] Failed to load applicant notification recipient:",
        profileError.message,
      );
    } else if (
      isRecord(profileData) &&
      typeof profileData.email === "string" &&
      profileData.email.trim()
    ) {
      recipient = profileData.email.trim();
    }
  }

  const notificationPayload = {
    applicationId: payload.applicationId,
    externalStatus: payload.externalStatus,
    resultStatus: payload.resultStatus ?? null,
    externalReference:
      payload.reference === undefined
        ? application.external_reference
        : payload.reference,
    resultStoragePath:
      primaryResultReference === undefined
        ? application.result_storage_path
        : primaryResultReference,
    fileReferences: payload.fileReferences ?? [],
    updateSource: payload.updateSource,
    receivedAt: now,
  };

  const { error: notificationError } = await adminClient
    .from("notification_events")
    .insert({
      application_id: payload.applicationId,
      applicant_id: application.applicant_id,
      channel: "email",
      template_key: buildNotificationTemplate(payload),
      recipient,
      status: "queued",
      payload: notificationPayload,
      updated_at: now,
    });

  if (notificationError) {
    console.error(
      "[external-submission] Failed to queue notification event:",
      notificationError.message,
    );
    return serverErrorResponse(
      "notification_event_insert_failed",
      "Application was updated but notification queue insertion failed",
    );
  }

  return jsonResponse(
    {
      ok: true,
      applicationId: payload.applicationId,
      updatedFields: {
        externalStatus: payload.externalStatus,
        externalReference:
          payload.reference === undefined
            ? application.external_reference
            : payload.reference,
        resultStatus:
          payload.resultStatus === undefined
            ? application.result_status
            : payload.resultStatus,
        resultStoragePath:
          primaryResultReference === undefined
            ? application.result_storage_path
            : primaryResultReference,
        resultNotes:
          payload.resultNotes === undefined
            ? application.result_notes
            : payload.resultNotes,
      },
      auditEventQueued: true,
      notificationQueued: true,
    },
    200,
  );
}

export function GET() {
  return jsonResponse(
    {
      ok: false,
      error: {
        code: "method_not_allowed",
        message: "Use POST for external submission status ingest",
      },
    },
    405,
  );
}
