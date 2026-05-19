import type {
  Application,
  ApplicationDocument,
  ApplicationPacket,
  ApplicationSignature,
  ConsentEvent,
  DocumentRequirement,
  PaymentRecord,
  VisaApplicationAnswer,
} from "../../db/schema.js";
import {
  mapExternalStatusToLifecycleStatus,
  normalizeExternalStatus,
  normalizeResultStatus,
} from "./external-status.js";
import {
  normalizeLifecycleStatus,
  normalizeStatusToken,
  type InternalLifecycleStatus,
} from "./status.js";

export type ReadinessKey =
  | "payment"
  | "consent"
  | "form_answers"
  | "documents"
  | "signature"
  | "packet";

export interface ReadinessCheckResult {
  key: ReadinessKey;
  ready: boolean;
  state: string;
  blockingReason: string | null;
  missing: string[];
  references: string[];
}

export interface LifecycleReadinessSummary {
  payment: ReadinessCheckResult;
  consent: ReadinessCheckResult;
  formAnswers: ReadinessCheckResult;
  documents: ReadinessCheckResult;
  signature: ReadinessCheckResult;
  packet: ReadinessCheckResult;
  blockers: ReadinessCheckResult[];
  intakeReady: boolean;
  readyForPacket: boolean;
  readyForExternalHandoff: boolean;
  lifecycleStatus: InternalLifecycleStatus;
}

export type PaymentRecordLike = Pick<
  PaymentRecord,
  "id" | "status" | "amountCents" | "feeType" | "createdAt" | "updatedAt"
>;

export type ConsentEventLike = Pick<
  ConsentEvent,
  "id" | "consentType" | "accepted" | "createdAt"
>;

export type FormAnswerLike = Pick<
  VisaApplicationAnswer,
  "fieldName" | "valueText" | "valueJson"
>;

export type DocumentLike = Pick<
  ApplicationDocument,
  | "id"
  | "documentType"
  | "requirementKey"
  | "storagePath"
  | "status"
  | "required"
>;

export type DocumentRequirementLike = Pick<
  DocumentRequirement,
  "requirementKey" | "required"
> &
  Partial<Pick<DocumentRequirement, "labelEn" | "labelZh">>;

export type SignatureLike = Pick<
  ApplicationSignature,
  | "id"
  | "signatureType"
  | "signatureText"
  | "signedDocumentPath"
  | "signedAt"
>;

export type PacketLike = Pick<
  ApplicationPacket,
  "id" | "status" | "storagePath" | "generatedAt" | "createdAt" | "updatedAt"
>;

export type LifecycleApplicationLike = Pick<
  Application,
  | "status"
  | "submittedAt"
  | "packetStatus"
  | "packetReadyAt"
  | "packetStoragePath"
  | "externalStatus"
  | "resultStatus"
  | "resultStoragePath"
>;

export interface LifecycleReadinessInput {
  application?: Partial<LifecycleApplicationLike> | null;
  payments?: readonly PaymentRecordLike[];
  consentEvents?: readonly ConsentEventLike[];
  requiredConsentTypes?: readonly string[];
  formAnswers?: readonly FormAnswerLike[];
  requiredFormFields?: readonly string[];
  documents?: readonly DocumentLike[];
  documentRequirements?: readonly DocumentRequirementLike[];
  signatures?: readonly SignatureLike[];
  requiredSignatureTypes?: readonly string[];
  packets?: readonly PacketLike[];
}

const READY_PAYMENT_STATUSES = new Set([
  "paid",
  "succeeded",
  "success",
  "complete",
  "completed",
  "captured",
]);

const FAILED_PAYMENT_STATUSES = new Set([
  "failed",
  "canceled",
  "cancelled",
  "voided",
  "disputed",
  "chargeback",
]);

const REFUNDED_PAYMENT_STATUSES = new Set(["refunded", "partially_refunded"]);

const ACCEPTED_DOCUMENT_STATUSES = new Set([
  "accepted",
  "approved",
  "validated",
  "ready",
]);

const READY_PACKET_STATUSES = new Set([
  "ready",
  "generated",
  "packet_ready",
  "complete",
  "completed",
]);

export function checkPaymentReadiness(
  payments: readonly PaymentRecordLike[]
): ReadinessCheckResult {
  if (payments.length === 0) {
    return createReadinessResult(
      "payment",
      false,
      "missing",
      "No captured agency payment was found."
    );
  }

  const paidPayment = payments.find((payment) =>
    READY_PAYMENT_STATUSES.has(normalizeStatusToken(payment.status))
  );
  if (paidPayment) {
    return createReadinessResult("payment", true, "paid", null, [], [
      paidPayment.id,
    ]);
  }

  const latestPayment = getLatestByTimestamp(payments);
  const latestStatus = normalizeStatusToken(latestPayment?.status ?? "pending");
  if (REFUNDED_PAYMENT_STATUSES.has(latestStatus)) {
    return createReadinessResult(
      "payment",
      false,
      "refunded",
      "The captured payment has already been refunded."
    );
  }

  if (FAILED_PAYMENT_STATUSES.has(latestStatus)) {
    return createReadinessResult(
      "payment",
      false,
      "failed",
      "The latest payment did not complete."
    );
  }

  return createReadinessResult(
    "payment",
    false,
    "pending",
    "Payment is still pending."
  );
}

export function checkConsentReadiness(
  consentEvents: readonly ConsentEventLike[],
  requiredConsentTypes?: readonly string[]
): ReadinessCheckResult {
  const requiredTypes = normalizeRequiredKeys(requiredConsentTypes);
  if (requiredConsentTypes && requiredTypes.length === 0) {
    return createReadinessResult("consent", true, "not_required", null);
  }

  const latestByType = new Map<string, ConsentEventLike>();
  for (const event of consentEvents) {
    const consentType = normalizeStatusToken(event.consentType);
    const current = latestByType.get(consentType);
    if (!current || getTimestamp(event.createdAt) >= getTimestamp(current.createdAt)) {
      latestByType.set(consentType, event);
    }
  }

  if (requiredTypes.length > 0) {
    const missing = requiredTypes.filter(
      (type) => latestByType.get(type)?.accepted !== true
    );
    return createReadinessResult(
      "consent",
      missing.length === 0,
      missing.length === 0 ? "accepted" : "missing",
      missing.length === 0 ? null : "Required consent has not been accepted.",
      missing,
      Array.from(latestByType.values())
        .filter((event) => event.accepted)
        .map((event) => event.id)
    );
  }

  const acceptedEvent =
    Array.from(latestByType.values()).find((event) => event.accepted) ?? null;
  return createReadinessResult(
    "consent",
    Boolean(acceptedEvent),
    acceptedEvent ? "accepted" : "missing",
    acceptedEvent ? null : "No accepted consent event was found.",
    [],
    acceptedEvent ? [acceptedEvent.id] : []
  );
}

export function checkFormAnswersReadiness(
  answers: readonly FormAnswerLike[],
  requiredFields?: readonly string[]
): ReadinessCheckResult {
  const required = normalizeRequiredKeys(requiredFields);
  if (requiredFields && required.length === 0) {
    return createReadinessResult("form_answers", true, "not_required", null);
  }

  const answeredFields = new Set(
    answers
      .filter(hasMeaningfulAnswer)
      .map((answer) => normalizeStatusToken(answer.fieldName))
  );

  if (required.length > 0) {
    const missing = required.filter((field) => !answeredFields.has(field));
    return createReadinessResult(
      "form_answers",
      missing.length === 0,
      missing.length === 0 ? "complete" : "missing",
      missing.length === 0
        ? null
        : "Required application answers are missing.",
      missing
    );
  }

  return createReadinessResult(
    "form_answers",
    answeredFields.size > 0,
    answeredFields.size > 0 ? "started" : "missing",
    answeredFields.size > 0 ? null : "No application answers were found."
  );
}

export function checkDocumentReadiness(
  documents: readonly DocumentLike[],
  requirements?: readonly DocumentRequirementLike[]
): ReadinessCheckResult {
  if (requirements) {
    const requiredRequirements = requirements.filter(
      (requirement) => requirement.required !== false
    );
    if (requiredRequirements.length === 0) {
      return createReadinessResult("documents", true, "not_required", null);
    }

    const blockers = requiredRequirements
      .filter(
        (requirement) =>
          !documents.some((document) =>
            documentSatisfiesRequirement(document, requirement)
          )
      )
      .map((requirement) => requirement.requirementKey);

    return createReadinessResult(
      "documents",
      blockers.length === 0,
      blockers.length === 0 ? "accepted" : "blocked",
      blockers.length === 0
        ? null
        : "Required documents are missing or need replacement.",
      blockers,
      documents
        .filter((document) =>
          ACCEPTED_DOCUMENT_STATUSES.has(normalizeStatusToken(document.status))
        )
        .map((document) => document.id)
    );
  }

  const requiredDocuments = documents.filter(
    (document) => document.required !== false
  );
  if (requiredDocuments.length === 0) {
    return createReadinessResult(
      "documents",
      false,
      "missing",
      "No required document records were found."
    );
  }

  const blockers = requiredDocuments
    .filter(
      (document) =>
        !ACCEPTED_DOCUMENT_STATUSES.has(normalizeStatusToken(document.status))
    )
    .map((document) => document.requirementKey ?? document.documentType);

  return createReadinessResult(
    "documents",
    blockers.length === 0,
    blockers.length === 0 ? "accepted" : "blocked",
    blockers.length === 0
      ? null
      : "Required documents are missing or need replacement.",
    blockers,
    requiredDocuments
      .filter((document) =>
        ACCEPTED_DOCUMENT_STATUSES.has(normalizeStatusToken(document.status))
      )
      .map((document) => document.id)
  );
}

export function checkSignatureReadiness(
  signatures: readonly SignatureLike[],
  requiredSignatureTypes?: readonly string[]
): ReadinessCheckResult {
  const requiredTypes = normalizeRequiredKeys(requiredSignatureTypes);
  if (requiredSignatureTypes && requiredTypes.length === 0) {
    return createReadinessResult("signature", true, "not_required", null);
  }

  const completedSignatures = signatures.filter(hasCompletedSignature);
  if (requiredTypes.length > 0) {
    const completedByType = new Set(
      completedSignatures.map((signature) =>
        normalizeStatusToken(signature.signatureType)
      )
    );
    const missing = requiredTypes.filter((type) => !completedByType.has(type));
    return createReadinessResult(
      "signature",
      missing.length === 0,
      missing.length === 0 ? "signed" : "missing",
      missing.length === 0 ? null : "Required signature is missing.",
      missing,
      completedSignatures.map((signature) => signature.id)
    );
  }

  const completedSignature = completedSignatures[0] ?? null;
  return createReadinessResult(
    "signature",
    Boolean(completedSignature),
    completedSignature ? "signed" : "missing",
    completedSignature ? null : "No completed signature was found.",
    [],
    completedSignature ? [completedSignature.id] : []
  );
}

export function checkPacketReadiness(
  packets: readonly PacketLike[],
  application?: Partial<LifecycleApplicationLike> | null
): ReadinessCheckResult {
  const readyPacket = packets.find((packet) =>
    READY_PACKET_STATUSES.has(normalizeStatusToken(packet.status))
  );
  if (readyPacket) {
    return createReadinessResult("packet", true, "ready", null, [], [
      readyPacket.id,
    ]);
  }

  const applicationPacketStatus = normalizeStatusToken(
    application?.packetStatus ?? ""
  );
  if (
    READY_PACKET_STATUSES.has(applicationPacketStatus) ||
    Boolean(application?.packetReadyAt || application?.packetStoragePath)
  ) {
    return createReadinessResult("packet", true, "ready", null);
  }

  return createReadinessResult(
    "packet",
    false,
    packets.length > 0 ? "pending" : "missing",
    "Packet has not been generated yet."
  );
}

export function evaluateLifecycleReadiness(
  input: LifecycleReadinessInput
): LifecycleReadinessSummary {
  const payment = checkPaymentReadiness(input.payments ?? []);
  const consent = checkConsentReadiness(
    input.consentEvents ?? [],
    input.requiredConsentTypes
  );
  const formAnswers = checkFormAnswersReadiness(
    input.formAnswers ?? [],
    input.requiredFormFields
  );
  const documents = checkDocumentReadiness(
    input.documents ?? [],
    input.documentRequirements
  );
  const signature = checkSignatureReadiness(
    input.signatures ?? [],
    input.requiredSignatureTypes
  );
  const packet = checkPacketReadiness(input.packets ?? [], input.application);

  const intakeChecks = [payment, consent, formAnswers, documents, signature];
  const blockers = [...intakeChecks, packet].filter((check) => !check.ready);
  const intakeReady = intakeChecks.every((check) => check.ready);
  const readyForPacket = intakeReady;
  const readyForExternalHandoff = intakeReady && packet.ready;
  const lifecycleStatus = deriveLifecycleStatusFromReadiness(input.application, {
    payment,
    consent,
    formAnswers,
    documents,
    signature,
    packet,
    intakeReady,
  });

  return {
    payment,
    consent,
    formAnswers,
    documents,
    signature,
    packet,
    blockers,
    intakeReady,
    readyForPacket,
    readyForExternalHandoff,
    lifecycleStatus,
  };
}

export function normalizeApplicationLifecycleState(
  input: LifecycleReadinessInput
): LifecycleReadinessSummary {
  return evaluateLifecycleReadiness(input);
}

function deriveLifecycleStatusFromReadiness(
  application: Partial<LifecycleApplicationLike> | null | undefined,
  checks: Pick<
    LifecycleReadinessSummary,
    | "payment"
    | "consent"
    | "formAnswers"
    | "documents"
    | "signature"
    | "packet"
    | "intakeReady"
  >
): InternalLifecycleStatus {
  const resultStatus = normalizeResultStatus(application?.resultStatus);
  if (resultStatus) return resultStatus;

  const externalStatus = normalizeExternalStatus(application?.externalStatus);
  if (externalStatus) {
    return mapExternalStatusToLifecycleStatus(externalStatus);
  }

  const rawLifecycleStatus = normalizeLifecycleStatus(application?.status);
  if (rawLifecycleStatus === "approved" || rawLifecycleStatus === "rejected") {
    return rawLifecycleStatus;
  }

  if (rawLifecycleStatus === "submitted" || application?.submittedAt) {
    return "submitted";
  }

  if (rawLifecycleStatus === "external_submission_in_progress") {
    return "external_submission_in_progress";
  }

  if (checks.packet.ready || rawLifecycleStatus === "packet_ready") {
    return "packet_ready";
  }

  if (checks.intakeReady || rawLifecycleStatus === "ready_for_packet") {
    return "ready_for_packet";
  }

  if (
    rawLifecycleStatus === "draft" &&
    !checks.payment.ready &&
    checks.consent.state === "missing" &&
    checks.formAnswers.state === "missing" &&
    checks.documents.state === "missing" &&
    checks.signature.state === "missing"
  ) {
    return "draft";
  }

  if (!checks.payment.ready) return "awaiting_payment";
  if (!checks.consent.ready) return "awaiting_consent";
  if (!checks.formAnswers.ready || !checks.documents.ready || !checks.signature.ready) {
    return "awaiting_documents";
  }

  return rawLifecycleStatus ?? "draft";
}

function createReadinessResult(
  key: ReadinessKey,
  ready: boolean,
  state: string,
  blockingReason: string | null,
  missing: readonly string[] = [],
  references: readonly string[] = []
): ReadinessCheckResult {
  return {
    key,
    ready,
    state,
    blockingReason,
    missing: [...missing],
    references: [...references],
  };
}

function getLatestByTimestamp<T extends { createdAt?: Date | null; updatedAt?: Date | null }>(
  values: readonly T[]
): T | null {
  return [...values].sort((first, second) => {
    const firstTime = getTimestamp(first.updatedAt ?? first.createdAt);
    const secondTime = getTimestamp(second.updatedAt ?? second.createdAt);
    return secondTime - firstTime;
  })[0] ?? null;
}

function getTimestamp(value: Date | null | undefined): number {
  return value?.getTime() ?? 0;
}

function normalizeRequiredKeys(values: readonly string[] | undefined): string[] {
  return [...new Set((values ?? []).map(normalizeStatusToken).filter(Boolean))];
}

function hasMeaningfulAnswer(answer: FormAnswerLike): boolean {
  if (hasMeaningfulUnknownValue(answer.valueJson)) return true;
  return Boolean(answer.valueText?.trim());
}

function hasMeaningfulUnknownValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "boolean") return true;
  if (Array.isArray(value)) return value.some(hasMeaningfulUnknownValue);
  if (typeof value === "object") return Object.keys(value).length > 0;
  return false;
}

function documentSatisfiesRequirement(
  document: DocumentLike,
  requirement: DocumentRequirementLike
): boolean {
  const requirementKey = normalizeStatusToken(requirement.requirementKey);
  const documentKeys = [
    document.requirementKey,
    document.documentType,
  ].flatMap((value) => (value ? [normalizeStatusToken(value)] : []));

  return (
    documentKeys.includes(requirementKey) &&
    ACCEPTED_DOCUMENT_STATUSES.has(normalizeStatusToken(document.status))
  );
}

function hasCompletedSignature(signature: SignatureLike): boolean {
  return Boolean(
    signature.signedAt ||
      signature.signedDocumentPath?.trim() ||
      signature.signatureText?.trim()
  );
}
