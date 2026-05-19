import { getSupabaseClient } from "../../db/supabase-client.js";
import type { ExternalStatusUpdateInput } from "./validation.js";

type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

type JsonObject = Record<string, JsonValue>;

type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; code: string; message: string };

interface ApplicationRow {
  id: string;
  applicant_id: string;
  country: string;
  visa_type: string;
  status: string;
  arrival_date: string | null;
  departure_date: string | null;
  port_of_entry: string | null;
  purpose: string | null;
  accommodation_name: string | null;
  accommodation_address: string | null;
  confirmation_number: string | null;
  submitted_at: string | null;
  estimated_processing_days: number | null;
  receipt_url: string | null;
  visa_package_id: string | null;
  packet_status: string | null;
  packet_manifest: JsonValue | null;
  packet_storage_path: string | null;
  packet_ready_at: string | null;
  external_status: string | null;
  external_reference: string | null;
  external_status_updated_at: string | null;
  result_status: string | null;
  result_storage_path: string | null;
  result_notes: string | null;
  government_fee_cents: number | null;
  government_fee_currency: string | null;
  government_fee_mode: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface ApplicantProfileRow {
  id: string;
  full_name: string | null;
  date_of_birth: string | null;
  place_of_birth: string | null;
  gender: string | null;
  nationality: string | null;
  occupation: string | null;
  address: string | null;
  passport_number: string | null;
  passport_issue_date: string | null;
  passport_expiry_date: string | null;
  passport_issuing_country: string | null;
  passport_issuing_authority: string | null;
  email: string | null;
  phone: string | null;
  wechat: string | null;
  language_pref: string;
}

interface AnswerRow {
  field_name: string;
  value_text: string | null;
  value_json: JsonValue | null;
}

interface DocumentRow {
  id: string;
  document_type: string;
  requirement_key: string | null;
  storage_path: string | null;
  filename: string | null;
  status: string;
  rejection_reason: string | null;
  required: boolean | null;
  review_notes: string | null;
  reviewed_at: string | null;
  updated_at: string | null;
}

interface SignatureRow {
  id: string;
  signature_type: string;
  signer_name: string;
  signed_document_path: string | null;
  document_hash: string | null;
  signed_at: string | null;
}

interface PacketRow {
  id: string;
  status: string;
  manifest: JsonValue;
  storage_path: string | null;
  generated_at: string | null;
  updated_at: string | null;
}

interface PaymentRecordRow {
  id: string;
  status: string;
  amount_cents: number;
  currency: string;
  fee_type: string;
  receipt_url: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface ConsentRow {
  consent_type: string;
  version: string;
  accepted: boolean;
  created_at: string | null;
}

interface EventRow {
  event_type: string;
  actor_type: string;
  message: string | null;
  metadata: JsonValue | null;
  created_at: string | null;
}

interface ReadinessSummary {
  payment: boolean;
  consent: boolean;
  signature: boolean;
  formAnswers: boolean;
  documents: boolean;
  packet: boolean;
}

interface DocumentCounts {
  total: number;
  required: number;
  uploaded: number;
  validated: number;
  missing: number;
  rejected: number;
  pendingReview: number;
}

export interface StatusSummary {
  applicationId: string;
  lifecycleStatus:
    | "draft"
    | "awaiting_payment"
    | "awaiting_consent"
    | "awaiting_documents"
    | "ready_for_packet"
    | "packet_ready"
    | "external_submission_in_progress"
    | "needs_attention"
    | "submitted"
    | "approved"
    | "rejected";
  readiness: ReadinessSummary;
  nextActions: string[];
  application: {
    country: string;
    visaType: string;
    rawStatus: string;
    packageId: string | null;
    submittedAt: string | null;
    updatedAt: string | null;
  };
  payment: {
    latestStatus: string | null;
    paidAt: string | null;
    amountCents: number | null;
    currency: string | null;
    receiptUrl: string | null;
  };
  consent: {
    accepted: boolean;
    latestAcceptedAt: string | null;
    consentTypes: string[];
  };
  documents: {
    counts: DocumentCounts;
    items: Array<{
      id: string;
      documentType: string;
      requirementKey: string | null;
      status: string;
      required: boolean;
      reviewedAt: string | null;
      updatedAt: string | null;
    }>;
  };
  formAnswers: {
    count: number;
  };
  signature: {
    complete: boolean;
    signedAt: string | null;
  };
  packet: {
    status: string | null;
    storagePath: string | null;
    readyAt: string | null;
    generatedAt: string | null;
  };
  external: {
    status: string | null;
    reference: string | null;
    updatedAt: string | null;
  };
  result: {
    status: string | null;
    storagePath: string | null;
    notes: string | null;
  };
  events?: EventRow[];
}

export interface PacketHandoffPayload {
  generatedAt: string;
  application: {
    id: string;
    applicantId: string;
    country: string;
    visaType: string;
    status: string;
    packageId: string | null;
    arrivalDate: string | null;
    departureDate: string | null;
    portOfEntry: string | null;
    purpose: string | null;
    accommodationName: string | null;
    accommodationAddress: string | null;
    confirmationNumber: string | null;
    submittedAt: string | null;
    estimatedProcessingDays: number | null;
    governmentFee: {
      amountCents: number | null;
      currency: string | null;
      mode: string | null;
    };
  };
  applicant: {
    id: string;
    fullName: string | null;
    dateOfBirth: string | null;
    placeOfBirth: string | null;
    gender: string | null;
    nationality: string | null;
    occupation: string | null;
    address: string | null;
    email: string | null;
    phone: string | null;
    wechat: string | null;
    languagePref: string;
    passport: {
      number: string | null;
      issueDate: string | null;
      expiryDate: string | null;
      issuingCountry: string | null;
      issuingAuthority: string | null;
    };
  } | null;
  answers: Record<string, JsonValue>;
  documents: Array<{
    id: string;
    documentType: string;
    requirementKey: string | null;
    storagePath: string | null;
    filename: string | null;
    status: string;
    required: boolean;
    reviewedAt: string | null;
  }>;
  signatures: Array<{
    id: string;
    signatureType: string;
    signerName: string;
    signedDocumentPath: string | null;
    documentHash: string | null;
    signedAt: string | null;
  }>;
  packet: {
    id: string | null;
    status: string | null;
    manifest: JsonValue | null;
    storagePath: string | null;
    generatedAt: string | null;
    updatedAt: string | null;
  };
}

export interface ExternalStatusIngestResponse {
  applicationId: string;
  externalStatus: string;
  externalReference: string | null;
  resultStatus: string | null;
  updatedAt: string;
  notificationQueued: boolean;
}

function hasPaidStatus(payment: PaymentRecordRow | null): boolean {
  return Boolean(payment && ["paid", "succeeded", "completed"].includes(payment.status));
}

function isPacketReady(application: ApplicationRow, packet: PacketRow | null): boolean {
  return Boolean(
    application.packet_storage_path ||
      ["ready", "packet_ready", "generated"].includes(application.packet_status ?? "") ||
      (packet && ["ready", "packet_ready", "generated"].includes(packet.status)),
  );
}

function buildDocumentCounts(documents: DocumentRow[]): DocumentCounts {
  return documents.reduce<DocumentCounts>(
    (counts, document) => {
      const required = document.required !== false;
      counts.total += 1;
      if (required) counts.required += 1;

      if (document.status === "validated") counts.validated += 1;
      else if (document.status === "missing") counts.missing += 1;
      else if (document.status === "rejected") counts.rejected += 1;
      else if (document.status === "uploaded") counts.uploaded += 1;
      else counts.pendingReview += 1;

      return counts;
    },
    {
      total: 0,
      required: 0,
      uploaded: 0,
      validated: 0,
      missing: 0,
      rejected: 0,
      pendingReview: 0,
    },
  );
}

function areDocumentsReady(documents: DocumentRow[], counts: DocumentCounts): boolean {
  if (counts.required === 0) return false;

  const requiredDocuments = documents.filter((document) => document.required !== false);
  return requiredDocuments.every((document) =>
    ["uploaded", "validated"].includes(document.status),
  );
}

function buildReadiness(params: {
  latestPayment: PaymentRecordRow | null;
  consents: ConsentRow[];
  signatures: SignatureRow[];
  answerCount: number;
  documents: DocumentRow[];
  documentCounts: DocumentCounts;
  application: ApplicationRow;
  packet: PacketRow | null;
}): ReadinessSummary {
  return {
    payment: hasPaidStatus(params.latestPayment),
    consent: params.consents.some((consent) => consent.accepted),
    signature: params.signatures.length > 0,
    formAnswers: params.answerCount > 0,
    documents: areDocumentsReady(params.documents, params.documentCounts),
    packet: isPacketReady(params.application, params.packet),
  };
}

function determineLifecycleStatus(
  application: ApplicationRow,
  readiness: ReadinessSummary,
): StatusSummary["lifecycleStatus"] {
  if (
    application.result_status === "approved" ||
    application.result_status === "issued" ||
    application.external_status === "approved" ||
    application.status === "approved"
  ) {
    return "approved";
  }

  if (
    application.result_status === "rejected" ||
    application.result_status === "refused" ||
    application.external_status === "rejected" ||
    application.status === "rejected"
  ) {
    return "rejected";
  }

  if (
    application.external_status === "additional_information_required" ||
    application.external_status === "failed"
  ) {
    return "needs_attention";
  }

  if (application.external_status === "submitted" || application.status === "submitted") {
    return "submitted";
  }

  if (["queued", "received", "in_progress"].includes(application.external_status ?? "")) {
    return "external_submission_in_progress";
  }

  if (readiness.packet || application.external_status === "handoff_ready") {
    return "packet_ready";
  }

  if (
    readiness.payment &&
    readiness.consent &&
    readiness.signature &&
    readiness.formAnswers &&
    readiness.documents
  ) {
    return "ready_for_packet";
  }

  if (!readiness.formAnswers) return "draft";
  if (!readiness.payment) return "awaiting_payment";
  if (!readiness.consent || !readiness.signature) return "awaiting_consent";
  return "awaiting_documents";
}

function getNextActions(status: StatusSummary["lifecycleStatus"]): string[] {
  const actionsByStatus: Record<StatusSummary["lifecycleStatus"], string[]> = {
    draft: ["complete_application_form"],
    awaiting_payment: ["complete_payment"],
    awaiting_consent: ["accept_consent", "provide_signature"],
    awaiting_documents: ["upload_required_documents"],
    ready_for_packet: ["generate_packet"],
    packet_ready: ["handoff_to_external_submission_owner"],
    external_submission_in_progress: ["wait_for_external_status"],
    needs_attention: ["review_external_status"],
    submitted: ["wait_for_result"],
    approved: ["view_result"],
    rejected: ["review_result"],
  };

  return actionsByStatus[status];
}

function getLatestPayment(payments: PaymentRecordRow[]): PaymentRecordRow | null {
  return payments[0] ?? null;
}

function getLatestAcceptedConsent(consents: ConsentRow[]): ConsentRow | null {
  return consents.find((consent) => consent.accepted) ?? null;
}

function getLatestSignature(signatures: SignatureRow[]): SignatureRow | null {
  return signatures[0] ?? null;
}

async function loadApplication(applicationId: string): Promise<ApplicationRow | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("applications")
    .select(
      [
        "id",
        "applicant_id",
        "country",
        "visa_type",
        "status",
        "arrival_date",
        "departure_date",
        "port_of_entry",
        "purpose",
        "accommodation_name",
        "accommodation_address",
        "confirmation_number",
        "submitted_at",
        "estimated_processing_days",
        "receipt_url",
        "visa_package_id",
        "packet_status",
        "packet_manifest",
        "packet_storage_path",
        "packet_ready_at",
        "external_status",
        "external_reference",
        "external_status_updated_at",
        "result_status",
        "result_storage_path",
        "result_notes",
        "government_fee_cents",
        "government_fee_currency",
        "government_fee_mode",
        "created_at",
        "updated_at",
      ].join(", "),
    )
    .eq("id", applicationId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data ?? null) as ApplicationRow | null;
}

async function loadLatestPacket(applicationId: string): Promise<PacketRow | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("application_packets")
    .select("id, status, manifest, storage_path, generated_at, updated_at")
    .eq("application_id", applicationId)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data ?? null) as PacketRow | null;
}

async function countAnswers(applicationId: string): Promise<number> {
  const supabase = getSupabaseClient();
  const { count, error } = await supabase
    .from("visa_application_answers")
    .select("id", { count: "exact", head: true })
    .eq("application_id", applicationId);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function loadDocuments(applicationId: string): Promise<DocumentRow[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("application_documents")
    .select(
      [
        "id",
        "document_type",
        "requirement_key",
        "storage_path",
        "filename",
        "status",
        "rejection_reason",
        "required",
        "review_notes",
        "reviewed_at",
        "updated_at",
      ].join(", "),
    )
    .eq("application_id", applicationId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as DocumentRow[];
}

async function loadSignatures(applicationId: string): Promise<SignatureRow[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("application_signatures")
    .select("id, signature_type, signer_name, signed_document_path, document_hash, signed_at")
    .eq("application_id", applicationId)
    .order("signed_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as SignatureRow[];
}

async function loadPayments(applicationId: string): Promise<PaymentRecordRow[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("payment_records")
    .select("id, status, amount_cents, currency, fee_type, receipt_url, created_at, updated_at")
    .eq("application_id", applicationId)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as PaymentRecordRow[];
}

async function loadConsents(applicationId: string): Promise<ConsentRow[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("consent_events")
    .select("consent_type, version, accepted, created_at")
    .eq("application_id", applicationId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as ConsentRow[];
}

async function loadEvents(applicationId: string, limit: number): Promise<EventRow[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("application_events")
    .select("event_type, actor_type, message, metadata, created_at")
    .eq("application_id", applicationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as EventRow[];
}

async function loadApplicantProfile(applicantId: string): Promise<ApplicantProfileRow | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("applicant_profiles")
    .select(
      [
        "id",
        "full_name",
        "date_of_birth",
        "place_of_birth",
        "gender",
        "nationality",
        "occupation",
        "address",
        "passport_number",
        "passport_issue_date",
        "passport_expiry_date",
        "passport_issuing_country",
        "passport_issuing_authority",
        "email",
        "phone",
        "wechat",
        "language_pref",
      ].join(", "),
    )
    .eq("id", applicantId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data ?? null) as ApplicantProfileRow | null;
}

async function loadAnswers(applicationId: string): Promise<AnswerRow[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("visa_application_answers")
    .select("field_name, value_text, value_json")
    .eq("application_id", applicationId);

  if (error) throw new Error(error.message);
  return (data ?? []) as AnswerRow[];
}

function buildAnswersMap(answers: AnswerRow[]): Record<string, JsonValue> {
  const answerMap: Record<string, JsonValue> = {};

  for (const answer of answers) {
    answerMap[answer.field_name] = answer.value_json ?? answer.value_text;
  }

  return answerMap;
}

function buildStatusSummary(params: {
  application: ApplicationRow;
  payments: PaymentRecordRow[];
  consents: ConsentRow[];
  documents: DocumentRow[];
  signatures: SignatureRow[];
  answerCount: number;
  packet: PacketRow | null;
  events?: EventRow[];
}): StatusSummary {
  const documentCounts = buildDocumentCounts(params.documents);
  const latestPayment = getLatestPayment(params.payments);
  const latestConsent = getLatestAcceptedConsent(params.consents);
  const latestSignature = getLatestSignature(params.signatures);
  const readiness = buildReadiness({
    latestPayment,
    consents: params.consents,
    signatures: params.signatures,
    answerCount: params.answerCount,
    documents: params.documents,
    documentCounts,
    application: params.application,
    packet: params.packet,
  });
  const lifecycleStatus = determineLifecycleStatus(params.application, readiness);

  return {
    applicationId: params.application.id,
    lifecycleStatus,
    readiness,
    nextActions: getNextActions(lifecycleStatus),
    application: {
      country: params.application.country,
      visaType: params.application.visa_type,
      rawStatus: params.application.status,
      packageId: params.application.visa_package_id,
      submittedAt: params.application.submitted_at,
      updatedAt: params.application.updated_at,
    },
    payment: {
      latestStatus: latestPayment?.status ?? null,
      paidAt: latestPayment?.updated_at ?? latestPayment?.created_at ?? null,
      amountCents: latestPayment?.amount_cents ?? null,
      currency: latestPayment?.currency ?? null,
      receiptUrl: latestPayment?.receipt_url ?? null,
    },
    consent: {
      accepted: Boolean(latestConsent),
      latestAcceptedAt: latestConsent?.created_at ?? null,
      consentTypes: params.consents
        .filter((consent) => consent.accepted)
        .map((consent) => consent.consent_type),
    },
    documents: {
      counts: documentCounts,
      items: params.documents.map((document) => ({
        id: document.id,
        documentType: document.document_type,
        requirementKey: document.requirement_key,
        status: document.status,
        required: document.required !== false,
        reviewedAt: document.reviewed_at,
        updatedAt: document.updated_at,
      })),
    },
    formAnswers: {
      count: params.answerCount,
    },
    signature: {
      complete: Boolean(latestSignature),
      signedAt: latestSignature?.signed_at ?? null,
    },
    packet: {
      status: params.packet?.status ?? params.application.packet_status,
      storagePath: params.packet?.storage_path ?? params.application.packet_storage_path,
      readyAt: params.application.packet_ready_at,
      generatedAt: params.packet?.generated_at ?? null,
    },
    external: {
      status: params.application.external_status,
      reference: params.application.external_reference,
      updatedAt: params.application.external_status_updated_at,
    },
    result: {
      status: params.application.result_status,
      storagePath: params.application.result_storage_path,
      notes: params.application.result_notes,
    },
    ...(params.events ? { events: params.events } : {}),
  };
}

function toJsonObject(value: JsonValue | null): JsonValue | null {
  return value;
}

function buildPacketPayload(params: {
  application: ApplicationRow;
  applicant: ApplicantProfileRow | null;
  answers: AnswerRow[];
  documents: DocumentRow[];
  signatures: SignatureRow[];
  packet: PacketRow | null;
}): PacketHandoffPayload {
  return {
    generatedAt: new Date().toISOString(),
    application: {
      id: params.application.id,
      applicantId: params.application.applicant_id,
      country: params.application.country,
      visaType: params.application.visa_type,
      status: params.application.status,
      packageId: params.application.visa_package_id,
      arrivalDate: params.application.arrival_date,
      departureDate: params.application.departure_date,
      portOfEntry: params.application.port_of_entry,
      purpose: params.application.purpose,
      accommodationName: params.application.accommodation_name,
      accommodationAddress: params.application.accommodation_address,
      confirmationNumber: params.application.confirmation_number,
      submittedAt: params.application.submitted_at,
      estimatedProcessingDays: params.application.estimated_processing_days,
      governmentFee: {
        amountCents: params.application.government_fee_cents,
        currency: params.application.government_fee_currency,
        mode: params.application.government_fee_mode,
      },
    },
    applicant: params.applicant
      ? {
          id: params.applicant.id,
          fullName: params.applicant.full_name,
          dateOfBirth: params.applicant.date_of_birth,
          placeOfBirth: params.applicant.place_of_birth,
          gender: params.applicant.gender,
          nationality: params.applicant.nationality,
          occupation: params.applicant.occupation,
          address: params.applicant.address,
          email: params.applicant.email,
          phone: params.applicant.phone,
          wechat: params.applicant.wechat,
          languagePref: params.applicant.language_pref,
          passport: {
            number: params.applicant.passport_number,
            issueDate: params.applicant.passport_issue_date,
            expiryDate: params.applicant.passport_expiry_date,
            issuingCountry: params.applicant.passport_issuing_country,
            issuingAuthority: params.applicant.passport_issuing_authority,
          },
        }
      : null,
    answers: buildAnswersMap(params.answers),
    documents: params.documents.map((document) => ({
      id: document.id,
      documentType: document.document_type,
      requirementKey: document.requirement_key,
      storagePath: document.storage_path,
      filename: document.filename,
      status: document.status,
      required: document.required !== false,
      reviewedAt: document.reviewed_at,
    })),
    signatures: params.signatures.map((signature) => ({
      id: signature.id,
      signatureType: signature.signature_type,
      signerName: signature.signer_name,
      signedDocumentPath: signature.signed_document_path,
      documentHash: signature.document_hash,
      signedAt: signature.signed_at,
    })),
    packet: {
      id: params.packet?.id ?? null,
      status: params.packet?.status ?? params.application.packet_status,
      manifest: toJsonObject(params.packet?.manifest ?? params.application.packet_manifest),
      storagePath: params.packet?.storage_path ?? params.application.packet_storage_path,
      generatedAt: params.packet?.generated_at ?? params.application.packet_ready_at,
      updatedAt: params.packet?.updated_at ?? params.application.updated_at,
    },
  };
}

function mapApplicationStatus(input: ExternalStatusUpdateInput): string | null {
  if (
    input.resultStatus === "approved" ||
    input.resultStatus === "issued" ||
    input.externalStatus === "approved"
  ) {
    return "approved";
  }

  if (
    input.resultStatus === "rejected" ||
    input.resultStatus === "refused" ||
    input.externalStatus === "rejected"
  ) {
    return "rejected";
  }

  if (input.externalStatus === "submitted") return "submitted";
  return null;
}

function getNotificationTemplate(input: ExternalStatusUpdateInput): string | null {
  if (input.resultStatus === "approved" || input.resultStatus === "issued") {
    return "visa_result_approved";
  }
  if (input.resultStatus === "rejected" || input.resultStatus === "refused") {
    return "visa_result_rejected";
  }
  if (input.externalStatus === "additional_information_required") {
    return "visa_additional_information_required";
  }
  if (input.externalStatus === "submitted") {
    return "external_submission_submitted";
  }
  return null;
}

function buildExternalEventMetadata(input: ExternalStatusUpdateInput): JsonObject {
  return {
    source: input.source,
    externalStatus: input.externalStatus,
    resultStatus: input.resultStatus ?? null,
    externalReference: input.externalReference ?? null,
    resultStoragePathPresent: Boolean(input.resultStoragePath),
    occurredAt: input.occurredAt ?? null,
  };
}

export async function getApplicationStatusSummary(
  applicationId: string,
  options: { includeEvents: boolean; eventLimit: number },
): Promise<ServiceResult<StatusSummary>> {
  const application = await loadApplication(applicationId);
  if (!application) {
    return {
      ok: false,
      status: 404,
      code: "application_not_found",
      message: "Application not found",
    };
  }

  const [
    payments,
    consents,
    documents,
    signatures,
    answerCount,
    packet,
    events,
  ] = await Promise.all([
    loadPayments(applicationId),
    loadConsents(applicationId),
    loadDocuments(applicationId),
    loadSignatures(applicationId),
    countAnswers(applicationId),
    loadLatestPacket(applicationId),
    options.includeEvents ? loadEvents(applicationId, options.eventLimit) : Promise.resolve(undefined),
  ]);

  return {
    ok: true,
    data: buildStatusSummary({
      application,
      payments,
      consents,
      documents,
      signatures,
      answerCount,
      packet,
      events,
    }),
  };
}

export async function getApplicationPacketHandoff(
  applicationId: string,
): Promise<ServiceResult<PacketHandoffPayload>> {
  const application = await loadApplication(applicationId);
  if (!application) {
    return {
      ok: false,
      status: 404,
      code: "application_not_found",
      message: "Application not found",
    };
  }

  const packet = await loadLatestPacket(applicationId);
  if (!isPacketReady(application, packet)) {
    return {
      ok: false,
      status: 409,
      code: "packet_not_ready",
      message: "Application packet is not ready for handoff",
    };
  }

  const [applicant, answers, documents, signatures] = await Promise.all([
    loadApplicantProfile(application.applicant_id),
    loadAnswers(applicationId),
    loadDocuments(applicationId),
    loadSignatures(applicationId),
  ]);

  return {
    ok: true,
    data: buildPacketPayload({
      application,
      applicant,
      answers,
      documents,
      signatures,
      packet,
    }),
  };
}

export async function ingestExternalStatus(
  input: ExternalStatusUpdateInput,
): Promise<ServiceResult<ExternalStatusIngestResponse>> {
  const application = await loadApplication(input.applicationId);
  if (!application) {
    return {
      ok: false,
      status: 404,
      code: "application_not_found",
      message: "Application not found",
    };
  }

  const supabase = getSupabaseClient();
  const updatedAt = input.occurredAt ?? new Date().toISOString();
  const mappedApplicationStatus = mapApplicationStatus(input);
  const updatePayload: Record<string, string | null> = {
    external_status: input.externalStatus,
    external_status_updated_at: updatedAt,
    updated_at: new Date().toISOString(),
  };

  if (input.externalReference !== undefined) {
    updatePayload.external_reference = input.externalReference;
  }
  if (input.resultStatus !== undefined) {
    updatePayload.result_status = input.resultStatus;
  }
  if (input.resultStoragePath !== undefined) {
    updatePayload.result_storage_path = input.resultStoragePath;
  }
  if (input.resultNotes !== undefined) {
    updatePayload.result_notes = input.resultNotes;
  }
  if (mappedApplicationStatus) {
    updatePayload.status = mappedApplicationStatus;
  }

  const { data: updatedApplication, error: updateError } = await supabase
    .from("applications")
    .update(updatePayload)
    .eq("id", input.applicationId)
    .select("id, external_status, external_reference, result_status, updated_at")
    .single();

  if (updateError) throw new Error(updateError.message);

  const { error: eventError } = await supabase.from("application_events").insert({
    application_id: input.applicationId,
    applicant_id: application.applicant_id,
    event_type: input.resultStatus ? "external_result_updated" : "external_status_updated",
    actor_type: "external_service",
    message: `External status updated to ${input.externalStatus}`,
    metadata: buildExternalEventMetadata(input),
  });

  if (eventError) throw new Error(eventError.message);

  const templateKey = getNotificationTemplate(input);
  if (templateKey) {
    const { error: notificationError } = await supabase.from("notification_events").insert({
      application_id: input.applicationId,
      applicant_id: application.applicant_id,
      channel: "email",
      template_key: templateKey,
      status: "queued",
      payload: {
        applicationId: input.applicationId,
        country: application.country,
        visaType: application.visa_type,
        externalStatus: input.externalStatus,
        resultStatus: input.resultStatus ?? null,
        externalReference: input.externalReference ?? application.external_reference,
      },
    });

    if (notificationError) throw new Error(notificationError.message);
  }

  const updatedRow = updatedApplication as {
    external_status: string;
    external_reference: string | null;
    result_status: string | null;
    updated_at: string | null;
  };

  return {
    ok: true,
    data: {
      applicationId: input.applicationId,
      externalStatus: updatedRow.external_status,
      externalReference: updatedRow.external_reference,
      resultStatus: updatedRow.result_status,
      updatedAt: updatedRow.updated_at ?? updatedAt,
      notificationQueued: Boolean(templateKey),
    },
  };
}
