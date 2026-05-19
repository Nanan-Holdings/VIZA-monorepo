import type {
  ApplicantProfile,
  Application,
  ApplicationDocument,
  ApplicationPacket,
  ApplicationSignature,
  VisaApplicationAnswer,
} from "../../db/schema.js";
import type { LifecycleReadinessSummary } from "./lifecycle.js";
import {
  normalizeLifecycleStatus,
  type InternalLifecycleStatus,
} from "./status.js";

type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type PacketApplicationLike = Pick<
  Application,
  | "id"
  | "applicantId"
  | "country"
  | "visaType"
  | "status"
  | "arrivalDate"
  | "departureDate"
  | "portOfEntry"
  | "purpose"
  | "accommodationName"
  | "accommodationAddress"
  | "confirmationNumber"
  | "submittedAt"
  | "visaPackageId"
  | "packetStatus"
  | "packetReadyAt"
  | "externalStatus"
  | "externalReference"
  | "resultStatus"
>;

export type PacketApplicantLike = Pick<
  ApplicantProfile,
  | "id"
  | "fullName"
  | "email"
  | "phone"
  | "wechat"
  | "languagePref"
  | "nationality"
>;

export type PacketAnswerLike = Pick<
  VisaApplicationAnswer,
  "fieldName" | "valueText" | "valueJson" | "updatedAt"
>;

export type PacketDocumentLike = Pick<
  ApplicationDocument,
  | "id"
  | "documentType"
  | "requirementKey"
  | "storagePath"
  | "filename"
  | "status"
  | "required"
  | "reviewedAt"
  | "createdAt"
>;

export type PacketSignatureLike = Pick<
  ApplicationSignature,
  | "id"
  | "signatureType"
  | "signerName"
  | "signedDocumentPath"
  | "documentHash"
  | "signedAt"
>;

export type PacketRecordLike = Pick<
  ApplicationPacket,
  "id" | "status" | "manifest" | "storagePath" | "generatedAt"
>;

export interface BuildPacketHandoffPayloadInput {
  application: PacketApplicationLike;
  applicant: PacketApplicantLike | null;
  answers: readonly PacketAnswerLike[];
  documents: readonly PacketDocumentLike[];
  signatures: readonly PacketSignatureLike[];
  packet?: PacketRecordLike | null;
  readiness?: LifecycleReadinessSummary | null;
}

export interface PacketHandoffPayload {
  schemaVersion: "viza.packet_handoff.v1";
  application: {
    id: string;
    applicantId: string;
    country: string;
    visaType: string;
    lifecycleStatus: InternalLifecycleStatus;
    rawStatus: string;
    arrivalDate: string | null;
    departureDate: string | null;
    portOfEntry: string | null;
    purpose: string | null;
    accommodationName: string | null;
    accommodationAddress: string | null;
    confirmationNumber: string | null;
    submittedAt: string | null;
    visaPackageId: string | null;
    packetStatus: string | null;
    packetReadyAt: string | null;
    externalStatus: string | null;
    externalReference: string | null;
    resultStatus: string | null;
  };
  customer: {
    applicantId: string | null;
    fullName: string | null;
    email: string | null;
    phone: string | null;
    wechat: string | null;
    languagePref: string;
    nationality: string | null;
  };
  answers: Array<{
    fieldName: string;
    value: JsonValue;
    updatedAt: string | null;
  }>;
  documents: Array<{
    id: string;
    documentType: string;
    requirementKey: string | null;
    storageReference: string | null;
    filename: string | null;
    status: string;
    required: boolean;
    reviewedAt: string | null;
    createdAt: string | null;
  }>;
  signatures: Array<{
    id: string;
    signatureType: string;
    signerName: string;
    signedDocumentReference: string | null;
    documentHash: string | null;
    signedAt: string | null;
  }>;
  packet: {
    id: string;
    status: string;
    manifest: JsonValue;
    storageReference: string | null;
    generatedAt: string | null;
  } | null;
  readiness: {
    lifecycleStatus: InternalLifecycleStatus;
    readyForExternalHandoff: boolean;
    blockers: string[];
  } | null;
}

export function buildPacketHandoffPayload(
  input: BuildPacketHandoffPayloadInput
): PacketHandoffPayload {
  const lifecycleStatus =
    input.readiness?.lifecycleStatus ??
    normalizeLifecycleStatus(input.application.status) ??
    "draft";

  return {
    schemaVersion: "viza.packet_handoff.v1",
    application: {
      id: input.application.id,
      applicantId: input.application.applicantId,
      country: input.application.country,
      visaType: input.application.visaType,
      lifecycleStatus,
      rawStatus: input.application.status,
      arrivalDate: dateToString(input.application.arrivalDate),
      departureDate: dateToString(input.application.departureDate),
      portOfEntry: input.application.portOfEntry,
      purpose: input.application.purpose,
      accommodationName: input.application.accommodationName,
      accommodationAddress: input.application.accommodationAddress,
      confirmationNumber: input.application.confirmationNumber,
      submittedAt: toIsoString(input.application.submittedAt),
      visaPackageId: input.application.visaPackageId,
      packetStatus: input.application.packetStatus,
      packetReadyAt: toIsoString(input.application.packetReadyAt),
      externalStatus: input.application.externalStatus,
      externalReference: input.application.externalReference,
      resultStatus: input.application.resultStatus,
    },
    customer: {
      applicantId: input.applicant?.id ?? null,
      fullName: input.applicant?.fullName ?? null,
      email: input.applicant?.email ?? null,
      phone: input.applicant?.phone ?? null,
      wechat: input.applicant?.wechat ?? null,
      languagePref: input.applicant?.languagePref ?? "en",
      nationality: input.applicant?.nationality ?? null,
    },
    answers: input.answers
      .filter((answer) => !isSecretKey(answer.fieldName))
      .map((answer) => ({
        fieldName: answer.fieldName,
        value: toJsonValue(answer.valueJson ?? answer.valueText ?? null),
        updatedAt: toIsoString(answer.updatedAt),
      })),
    documents: input.documents.map((document) => ({
      id: document.id,
      documentType: document.documentType,
      requirementKey: document.requirementKey,
      storageReference: sanitizeReference(document.storagePath),
      filename: document.filename,
      status: document.status,
      required: document.required !== false,
      reviewedAt: toIsoString(document.reviewedAt),
      createdAt: toIsoString(document.createdAt),
    })),
    signatures: input.signatures.map((signature) => ({
      id: signature.id,
      signatureType: signature.signatureType,
      signerName: signature.signerName,
      signedDocumentReference: sanitizeReference(signature.signedDocumentPath),
      documentHash: signature.documentHash,
      signedAt: toIsoString(signature.signedAt),
    })),
    packet: input.packet
      ? {
          id: input.packet.id,
          status: input.packet.status,
          manifest: toJsonValue(input.packet.manifest),
          storageReference: sanitizeReference(input.packet.storagePath),
          generatedAt: toIsoString(input.packet.generatedAt),
        }
      : null,
    readiness: input.readiness
      ? {
          lifecycleStatus: input.readiness.lifecycleStatus,
          readyForExternalHandoff: input.readiness.readyForExternalHandoff,
          blockers: input.readiness.blockers.map((blocker) => blocker.key),
        }
      : null,
  };
}

function toJsonValue(value: unknown): JsonValue {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(toJsonValue);
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !isSecretKey(key))
        .map(([key, nestedValue]) => [key, toJsonValue(nestedValue)])
    );
  }
  return null;
}

function isSecretKey(key: string): boolean {
  return /(?:password|secret|token|api[_-]?key|authorization|cookie|client[_-]?secret|payment[_-]?intent|provider[_-]?(?:session|payment|customer)|handoff[_-]?token|card[_-]?(?:number|cvc|cvv))/i.test(
    key
  );
}

function sanitizeReference(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return trimmed;
  }
}

function toIsoString(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function dateToString(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value;
}

