import {
	pgTable,
	text,
	timestamp,
	uuid,
	boolean,
	date,
	integer,
	jsonb,
	customType,
	index,
	uniqueIndex,
} from "drizzle-orm/pg-core";

// =============================================================================
// CUSTOM TYPES
// =============================================================================

const vector = (size: number) =>
	customType<{ data: number[]; driverData: string }>({
		dataType() {
			return `vector(${size})`;
		},
		toDriver(value: number[]): string {
			return `[${value.join(",")}]`;
		},
		fromDriver(value: string): number[] {
			if (typeof value === "string") {
				return value
					.replace(/^\[|\]$/g, "")
					.split(",")
					.map((v) => Number.parseFloat(v.trim()));
			}
			return value as unknown as number[];
		},
	});

// =============================================================================
// APPLICANT PROFILES
// Personal details for each visa applicant
// =============================================================================

export const applicantProfiles = pgTable("applicant_profiles", {
	id: uuid("id").primaryKey().defaultRandom(),
	authUserId: uuid("auth_user_id").unique(),
	fullName: text("full_name"),
	dateOfBirth: date("date_of_birth"),
	placeOfBirth: text("place_of_birth"),
	gender: text("gender"),
	nationality: text("nationality"),
	occupation: text("occupation"),
	address: text("address"),
	passportNumber: text("passport_number"),
	passportIssueDate: date("passport_issue_date"),
	passportExpiryDate: date("passport_expiry_date"),
	passportIssuingCountry: text("passport_issuing_country"),
	passportIssuingAuthority: text("passport_issuing_authority"),
	email: text("email"),
	phone: text("phone"),
	wechat: text("wechat"),
	languagePref: text("language_pref").default("en").notNull(),
	onboardingDone: boolean("onboarding_done").default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// =============================================================================
// APPLICATIONS
// Visa application records (one per applicant per submission attempt)
// =============================================================================

export const applications = pgTable("applications", {
	id: uuid("id").primaryKey().defaultRandom(),
	applicantId: uuid("applicant_id").notNull(),
	country: text("country").default("indonesia").notNull(),
	visaType: text("visa_type").default("tourist_b211a").notNull(),
	status: text("status").default("draft").notNull(),
	arrivalDate: date("arrival_date"),
	departureDate: date("departure_date"),
	portOfEntry: text("port_of_entry"),
	purpose: text("purpose"),
	accommodationName: text("accommodation_name"),
	accommodationAddress: text("accommodation_address"),
	confirmationNumber: text("confirmation_number"),
	submittedAt: timestamp("submitted_at", { withTimezone: true }),
	estimatedProcessingDays: integer("estimated_processing_days"),
	receiptUrl: text("receipt_url"),
	visaPackageId: uuid("visa_package_id"),
	ds160ApplicationId: text("ds160_application_id"),
	ds160RetrievalUrl: text("ds160_retrieval_url"),
	ds160DatStoragePath: text("ds160_dat_storage_path"),
	packetStatus: text("packet_status").default("not_started"),
	packetManifest: jsonb("packet_manifest"),
	packetStoragePath: text("packet_storage_path"),
	packetReadyAt: timestamp("packet_ready_at", { withTimezone: true }),
	externalStatus: text("external_status"),
	externalReference: text("external_reference"),
	externalStatusUpdatedAt: timestamp("external_status_updated_at", { withTimezone: true }),
	resultStatus: text("result_status"),
	resultStoragePath: text("result_storage_path"),
	resultNotes: text("result_notes"),
	governmentFeeCents: integer("government_fee_cents"),
	governmentFeeCurrency: text("government_fee_currency").default("USD"),
	governmentFeeMode: text("government_fee_mode").default("display_only"),
	automationStatus: text("automation_status").default("not_started"),
	automationStage: text("automation_stage").default("intake"),
	automationStatusReason: text("automation_status_reason"),
	automationUpdatedAt: timestamp("automation_updated_at", { withTimezone: true }),
	paymentStatus: text("payment_status").default("not_started"),
	consentStatus: text("consent_status").default("not_started"),
	documentsStatus: text("documents_status").default("not_started"),
	signatureStatus: text("signature_status").default("not_started"),
	notificationStatus: text("notification_status").default("not_started"),
	coverageSnapshot: jsonb("coverage_snapshot"),
	staffReviewStatus: text("staff_review_status").default("not_started"),
	staffReviewedAt: timestamp("staff_reviewed_at", { withTimezone: true }),
	staffReviewedBy: uuid("staff_reviewed_by"),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
	applicantStatusIdx: index("applications_applicant_status_idx").on(table.applicantId, table.status),
	visaPackageIdx: index("applications_visa_package_idx").on(table.visaPackageId),
	automationStatusIdx: index("applications_automation_status_idx").on(table.automationStatus),
	automationStageIdx: index("applications_automation_stage_idx").on(table.automationStage),
	paymentStatusIdx: index("applications_payment_status_idx").on(table.paymentStatus),
	packetStatusIdx: index("applications_packet_status_idx").on(table.packetStatus),
	externalStatusIdx: index("applications_external_status_idx").on(table.externalStatus),
	staffReviewStatusIdx: index("applications_staff_review_status_idx").on(table.staffReviewStatus),
}));

// =============================================================================
// APPLICATION DOCUMENTS
// Uploaded supporting documents per application
// document_type: passport_copy | photo | flight_booking | hotel_booking |
//                travel_itinerary | bank_statement
// status: uploaded | validated | rejected | missing
// =============================================================================

export const applicationDocuments = pgTable("application_documents", {
	id: uuid("id").primaryKey().defaultRandom(),
	applicationId: uuid("application_id").notNull(),
	documentType: text("document_type").notNull(),
	requirementKey: text("requirement_key"),
	storagePath: text("storage_path"),
	filename: text("filename"),
	status: text("status").default("uploaded").notNull(),
	rejectionReason: text("rejection_reason"),
	required: boolean("required").default(true),
	reviewNotes: text("review_notes"),
	reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
	reviewedBy: uuid("reviewed_by"),
	automationStatus: text("automation_status").default("pending"),
	automationNotes: text("automation_notes"),
	requiredByVisaPackageId: uuid("required_by_visa_package_id"),
	latestOcrExtractionId: uuid("latest_ocr_extraction_id"),
	documentHash: text("document_hash"),
	uploadedBy: uuid("uploaded_by"),
	uploadedAt: timestamp("uploaded_at", { withTimezone: true }),
	expiresAt: timestamp("expires_at", { withTimezone: true }),
	metadata: jsonb("metadata"),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
	appTypeIdx: uniqueIndex("application_documents_app_type_idx").on(table.applicationId, table.documentType),
	applicationStatusIdx: index("application_documents_application_status_idx").on(table.applicationId, table.status),
	requirementIdx: index("application_documents_requirement_idx").on(table.applicationId, table.requirementKey),
	automationStatusIdx: index("application_documents_automation_status_idx").on(table.automationStatus),
	requiredPackageIdx: index("application_documents_required_package_idx").on(table.requiredByVisaPackageId),
	hashIdx: index("application_documents_hash_idx").on(table.documentHash),
}));

// =============================================================================
// SUBMISSION QUEUE
// Tracks automation submissions to evisa.imigrasi.go.id
// status: pending | processing | done | failed
// =============================================================================

export const submissionQueue = pgTable("submission_queue", {
	id: uuid("id").primaryKey().defaultRandom(),
	applicationId: uuid("application_id").notNull(),
	status: text("status").default("pending").notNull(),
	attempts: integer("attempts").default(0).notNull(),
	lastError: text("last_error"),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// =============================================================================
// VISA CHAT SESSIONS
// AI assistant conversation sessions (replaces companion_sessions)
// =============================================================================

export const visaChatSessions = pgTable("visa_chat_sessions", {
	id: uuid("id").primaryKey().defaultRandom(),
	applicantId: uuid("applicant_id").notNull(),
	applicationId: uuid("application_id"),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// =============================================================================
// VISA CHAT MESSAGES
// Messages within AI assistant sessions (replaces companion_messages)
// role: user | assistant
// =============================================================================

export const visaChatMessages = pgTable("visa_chat_messages", {
	id: uuid("id").primaryKey().defaultRandom(),
	sessionId: uuid("session_id").notNull(),
	role: text("role").notNull(),
	content: text("content").notNull(),
	blockData: jsonb("block_data"),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// =============================================================================
// VISA DOCUMENTS
// Knowledge base source documents (scraped visa requirement pages)
// document_type: requirements | process | faq | form_fields | common_mistakes
// =============================================================================

export const visaDocuments = pgTable("visa_documents", {
	id: uuid("id").primaryKey().defaultRandom(),
	country: text("country").notNull(),
	visaType: text("visa_type").notNull(),
	documentType: text("document_type").notNull(),
	title: text("title"),
	sourceUrl: text("source_url"),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// =============================================================================
// VISA CHUNKS
// Chunked knowledge base entries with pgvector embeddings
// embedding: OpenAI text-embedding-3-small (1536 dimensions)
// NOTE: pgvector extension must be enabled on the Supabase project:
//   CREATE EXTENSION IF NOT EXISTS vector;
// =============================================================================

export const visaChunks = pgTable("visa_chunks", {
	id: uuid("id").primaryKey().defaultRandom(),
	documentId: uuid("document_id").notNull(),
	country: text("country").notNull(),
	visaType: text("visa_type").notNull(),
	documentType: text("document_type").notNull(),
	content: text("content").notNull(),
	embedding: vector(1536)("embedding"),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export type ApplicantProfile = typeof applicantProfiles.$inferSelect;
export type NewApplicantProfile = typeof applicantProfiles.$inferInsert;

export type Application = typeof applications.$inferSelect;
export type NewApplication = typeof applications.$inferInsert;

export type ApplicationDocument = typeof applicationDocuments.$inferSelect;
export type NewApplicationDocument = typeof applicationDocuments.$inferInsert;

export type SubmissionQueueItem = typeof submissionQueue.$inferSelect;
export type NewSubmissionQueueItem = typeof submissionQueue.$inferInsert;

export type VisaChatSession = typeof visaChatSessions.$inferSelect;
export type NewVisaChatSession = typeof visaChatSessions.$inferInsert;

export type VisaChatMessage = typeof visaChatMessages.$inferSelect;
export type NewVisaChatMessage = typeof visaChatMessages.$inferInsert;

export type VisaDocument = typeof visaDocuments.$inferSelect;
export type NewVisaDocument = typeof visaDocuments.$inferInsert;

export type VisaChunk = typeof visaChunks.$inferSelect;
export type NewVisaChunk = typeof visaChunks.$inferInsert;

// =============================================================================
// VISA FORM FIELDS
// Dynamic form field definitions for each visa type, drives the wizard UI
// field_type: text | select | date | file | radio | checkbox | textarea
// =============================================================================

export const visaFormFields = pgTable("visa_form_fields", {
	id: uuid("id").primaryKey().defaultRandom(),
	visaType: text("visa_type").notNull().default("B211A"),
	fieldName: text("field_name").notNull(),
	label: text("label").notNull(),
	fieldType: text("field_type").notNull(),
	required: boolean("required").notNull().default(false),
	stepNumber: integer("step_number").notNull(),
	stepName: text("step_name"),
	displayOrder: integer("display_order").notNull(),
	placeholder: text("placeholder"),
	validationRules: jsonb("validation_rules"),
	options: jsonb("options"),
	conditionalLogic: jsonb("conditional_logic"),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export type VisaFormField = typeof visaFormFields.$inferSelect;
export type NewVisaFormField = typeof visaFormFields.$inferInsert;

// =============================================================================
// KNOWLEDGE BASE UPDATES
// Tracks news articles detected by news-monitor for review/re-ingest workflow
// status: pending_review | approved | dismissed
// =============================================================================

export const knowledgeBaseUpdates = pgTable("knowledge_base_updates", {
	id: uuid("id").primaryKey().defaultRandom(),
	articleUrl: text("article_url").notNull(),
	headline: text("headline").notNull(),
	source: text("source").notNull(),
	publishedAt: timestamp("published_at", { withTimezone: true }),
	status: text("status").notNull().default("pending_review"),
	triggeredAt: timestamp("triggered_at", { withTimezone: true }).defaultNow(),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export type KnowledgeBaseUpdate = typeof knowledgeBaseUpdates.$inferSelect;
export type NewKnowledgeBaseUpdate = typeof knowledgeBaseUpdates.$inferInsert;

// =============================================================================
// DS-160 PROFILE EXTENSIONS
// DS-160 specific data not covered by applicantProfiles 鈥?linked via applicant_id
// =============================================================================

export const ds160OtherNames = pgTable("ds160_other_names", {
  id: uuid("id").primaryKey().defaultRandom(),
  applicantId: uuid("applicant_id").notNull(),
  surname: text("surname").notNull(),
  givenNames: text("given_names").notNull(),
  nameType: text("name_type"), // maiden | alias | professional | religious | other
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const ds160OtherNationalities = pgTable("ds160_other_nationalities", {
  id: uuid("id").primaryKey().defaultRandom(),
  applicantId: uuid("applicant_id").notNull(),
  country: text("country").notNull(),
  currentlyHeld: boolean("currently_held").notNull().default(true),
  hasPassport: boolean("has_passport"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const ds160SocialMedia = pgTable("ds160_social_media", {
  id: uuid("id").primaryKey().defaultRandom(),
  applicantId: uuid("applicant_id").notNull(),
  platform: text("platform").notNull(),
  handle: text("handle").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const ds160LostPassports = pgTable("ds160_lost_passports", {
  id: uuid("id").primaryKey().defaultRandom(),
  applicantId: uuid("applicant_id").notNull(),
  passportNumber: text("passport_number").notNull(),
  issuingCountry: text("issuing_country").notNull(),
  explanation: text("explanation"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const ds160UsRelatives = pgTable("ds160_us_relatives", {
  id: uuid("id").primaryKey().defaultRandom(),
  applicantId: uuid("applicant_id").notNull(),
  name: text("name").notNull(),
  relationship: text("relationship").notNull(),
  immigrationStatus: text("immigration_status"),
  isImmediate: boolean("is_immediate").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const ds160PreviousEmployers = pgTable("ds160_previous_employers", {
  id: uuid("id").primaryKey().defaultRandom(),
  applicantId: uuid("applicant_id").notNull(),
  employerName: text("employer_name").notNull(),
  addressLine1: text("address_line1"),
  city: text("city"),
  stateProvince: text("state_province"),
  country: text("country"),
  phone: text("phone"),
  jobTitle: text("job_title"),
  startDate: text("start_date"),   // YYYY-MM
  endDate: text("end_date"),       // YYYY-MM
  monthlySalary: text("monthly_salary"),
  salaryCurrency: text("salary_currency"),
  duties: text("duties"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const ds160SecurityAnswers = pgTable("ds160_security_answers", {
  id: uuid("id").primaryKey().defaultRandom(),
  applicantId: uuid("applicant_id").notNull(),
  questionKey: text("question_key").notNull(),
  answer: boolean("answer").notNull(),
  explanation: text("explanation"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const ds160TravelCompanions = pgTable("ds160_travel_companions", {
  id: uuid("id").primaryKey().defaultRandom(),
  applicantId: uuid("applicant_id").notNull(),
  surname: text("surname").notNull(),
  givenNames: text("given_names").notNull(),
  relationship: text("relationship"),
  groupName: text("group_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const ds160InterviewRecords = pgTable("ds160_interview_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  applicantId: uuid("applicant_id").notNull(),
  scheduledDate: text("scheduled_date"),  // YYYY-MM-DD
  scheduledTime: text("scheduled_time"),  // HH:MM
  location: text("location"),
  outcome: text("outcome"),
  outcomeDate: text("outcome_date"),
  refusalCode: text("refusal_code"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const ds160Payments = pgTable("ds160_payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  applicantId: uuid("applicant_id").notNull(),
  mrvFeeAmount: text("mrv_fee_amount"),
  mrvFeeCurrency: text("mrv_fee_currency").default("USD"),
  receiptNumber: text("receipt_number"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  paymentMethod: text("payment_method"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// Types
export type Ds160OtherName = typeof ds160OtherNames.$inferSelect;
export type Ds160OtherNationality = typeof ds160OtherNationalities.$inferSelect;
export type Ds160SocialMedia = typeof ds160SocialMedia.$inferSelect;
export type Ds160LostPassport = typeof ds160LostPassports.$inferSelect;
export type Ds160UsRelative = typeof ds160UsRelatives.$inferSelect;
export type Ds160PreviousEmployer = typeof ds160PreviousEmployers.$inferSelect;
export type Ds160SecurityAnswer = typeof ds160SecurityAnswers.$inferSelect;
export type Ds160TravelCompanion = typeof ds160TravelCompanions.$inferSelect;
export type Ds160InterviewRecord = typeof ds160InterviewRecords.$inferSelect;
export type Ds160Payment = typeof ds160Payments.$inferSelect;

// =============================================================================
// VISA PACKAGES
// Product catalog for supported visa offerings (country + visa type combos)
// =============================================================================

export const visaPackages = pgTable("visa_packages", {
  id: uuid("id").primaryKey().defaultRandom(),
  country: text("country").notNull(),
  visaType: text("visa_type").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  priceCents: integer("price_cents"),
  currency: text("currency").default("USD"),
  isActive: boolean("is_active").notNull().default(true),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export type VisaPackage = typeof visaPackages.$inferSelect;
export type NewVisaPackage = typeof visaPackages.$inferInsert;

// =============================================================================
// USER PACKAGES
// Links users to active/past visa packages
// status: active | completed | cancelled
// =============================================================================

export const userPackages = pgTable("user_packages", {
  id: uuid("id").primaryKey().defaultRandom(),
  authUserId: uuid("auth_user_id").notNull(),
  visaPackageId: uuid("visa_package_id").notNull(),
  applicationId: uuid("application_id"),
  status: text("status").notNull().default("active"),
  assignedAt: timestamp("assigned_at", { withTimezone: true }).defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export type UserPackage = typeof userPackages.$inferSelect;
export type NewUserPackage = typeof userPackages.$inferInsert;

// =============================================================================
// VISA APPLICATION ANSWERS
// Generic key-value answer storage for dynamic visa forms
// Upsert-safe on (application_id, field_name)
// =============================================================================

export const visaApplicationAnswers = pgTable("visa_application_answers", {
  id: uuid("id").primaryKey().defaultRandom(),
  applicationId: uuid("application_id").notNull(),
  fieldName: text("field_name").notNull(),
  valueText: text("value_text"),
  valueJson: jsonb("value_json"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export type VisaApplicationAnswer = typeof visaApplicationAnswers.$inferSelect;
export type NewVisaApplicationAnswer = typeof visaApplicationAnswers.$inferInsert;

// =============================================================================
// SHARED PROFILE FIELDS
// Tracks reusable cross-visa profile group completeness
// field_group: personal | passport | contact | employment | travel_history
// =============================================================================

export const sharedProfileFields = pgTable("shared_profile_fields", {
  id: uuid("id").primaryKey().defaultRandom(),
  applicantId: uuid("applicant_id").notNull(),
  fieldGroup: text("field_group").notNull(),
  isComplete: boolean("is_complete").notNull().default(false),
  lastVerified: timestamp("last_verified", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export type SharedProfileField = typeof sharedProfileFields.$inferSelect;
export type NewSharedProfileField = typeof sharedProfileFields.$inferInsert;

// =============================================================================
// INTERNAL WEBSITE AUTOMATION
// Website-owned payment, consent, document, packet, external status, and
// notification records. Official portal runners intentionally live outside this
// scope.
// =============================================================================

export const paymentRecords = pgTable("payment_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  applicationId: uuid("application_id"),
  applicantId: uuid("applicant_id"),
  authUserId: uuid("auth_user_id"),
  visaPackageId: uuid("visa_package_id"),
  provider: text("provider").notNull().default("stripe"),
  providerSessionId: text("provider_session_id"),
  providerPaymentId: text("provider_payment_id"),
  providerCustomerId: text("provider_customer_id"),
  providerEventId: text("provider_event_id"),
  idempotencyKey: text("idempotency_key"),
  providerPayloadDigest: text("provider_payload_digest"),
  amountCents: integer("amount_cents").notNull(),
  currency: text("currency").notNull().default("USD"),
  status: text("status").notNull().default("pending"),
  feeType: text("fee_type").notNull().default("agency_fee"),
  receiptUrl: text("receipt_url"),
  metadata: jsonb("metadata"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  failedAt: timestamp("failed_at", { withTimezone: true }),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  applicationIdx: index("payment_records_application_idx").on(table.applicationId),
  applicantIdx: index("payment_records_applicant_idx").on(table.applicantId),
  authUserIdx: index("payment_records_auth_user_idx").on(table.authUserId),
  statusIdx: index("payment_records_status_idx").on(table.status),
  providerSessionIdx: uniqueIndex("payment_records_provider_session_idx").on(table.providerSessionId),
  providerPaymentIdx: index("payment_records_provider_payment_idx").on(table.providerPaymentId),
  providerEventIdx: index("payment_records_provider_event_idx").on(table.providerEventId),
  appStatusIdx: index("payment_records_app_status_idx").on(table.applicationId, table.status),
  idempotencyKeyIdx: uniqueIndex("payment_records_idempotency_key_idx").on(table.idempotencyKey),
}));

export const invoiceRequests = pgTable("invoice_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  paymentRecordId: uuid("payment_record_id"),
  applicationId: uuid("application_id"),
  applicantId: uuid("applicant_id"),
  authUserId: uuid("auth_user_id"),
  requestReference: text("request_reference"),
  requestedBy: uuid("requested_by"),
  reviewedBy: uuid("reviewed_by"),
  invoiceName: text("invoice_name"),
  taxIdentifier: text("tax_identifier"),
  billingEmail: text("billing_email"),
  invoiceNumber: text("invoice_number"),
  invoiceStoragePath: text("invoice_storage_path"),
  status: text("status").notNull().default("requested"),
  notes: text("notes"),
  metadata: jsonb("metadata"),
  issuedAt: timestamp("issued_at", { withTimezone: true }),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  applicationIdx: index("invoice_requests_application_idx").on(table.applicationId),
  applicantIdx: index("invoice_requests_applicant_idx").on(table.applicantId),
  authUserIdx: index("invoice_requests_auth_user_idx").on(table.authUserId),
  paymentRecordIdx: index("invoice_requests_payment_record_idx").on(table.paymentRecordId),
  statusIdx: index("invoice_requests_status_idx").on(table.status),
  referenceIdx: uniqueIndex("invoice_requests_reference_idx").on(table.requestReference),
}));

export const refundRecords = pgTable("refund_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  paymentRecordId: uuid("payment_record_id"),
  applicationId: uuid("application_id"),
  applicantId: uuid("applicant_id"),
  authUserId: uuid("auth_user_id"),
  requestReference: text("request_reference"),
  providerRefundId: text("provider_refund_id"),
  requestedBy: uuid("requested_by"),
  reviewedBy: uuid("reviewed_by"),
  amountCents: integer("amount_cents").notNull(),
  currency: text("currency").notNull().default("USD"),
  status: text("status").notNull().default("requested"),
  reason: text("reason"),
  rejectionReason: text("rejection_reason"),
  policySnapshot: jsonb("policy_snapshot"),
  metadata: jsonb("metadata"),
  idempotencyKey: text("idempotency_key"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  refundedAt: timestamp("refunded_at", { withTimezone: true }),
  rejectedAt: timestamp("rejected_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  applicationIdx: index("refund_records_application_idx").on(table.applicationId),
  applicantIdx: index("refund_records_applicant_idx").on(table.applicantId),
  authUserIdx: index("refund_records_auth_user_idx").on(table.authUserId),
  paymentRecordIdx: index("refund_records_payment_record_idx").on(table.paymentRecordId),
  statusIdx: index("refund_records_status_idx").on(table.status),
  providerRefundIdx: index("refund_records_provider_refund_idx").on(table.providerRefundId),
  referenceIdx: uniqueIndex("refund_records_reference_idx").on(table.requestReference),
  idempotencyKeyIdx: uniqueIndex("refund_records_idempotency_key_idx").on(table.idempotencyKey),
}));

export const consentEvents = pgTable("consent_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  applicationId: uuid("application_id").notNull(),
  applicantId: uuid("applicant_id"),
  authUserId: uuid("auth_user_id"),
  consentType: text("consent_type").notNull(),
  version: text("version").notNull(),
  accepted: boolean("accepted").notNull().default(true),
  consentScope: jsonb("consent_scope"),
  source: text("source").default("website"),
  idempotencyKey: text("idempotency_key"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  documentHash: text("document_hash"),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  applicationIdx: index("consent_events_application_idx").on(table.applicationId),
  applicantIdx: index("consent_events_applicant_idx").on(table.applicantId),
  authUserIdx: index("consent_events_auth_user_idx").on(table.authUserId),
  lookupIdx: index("consent_events_lookup_idx").on(table.applicationId, table.consentType, table.version),
  idempotencyKeyIdx: uniqueIndex("consent_events_idempotency_key_idx").on(table.idempotencyKey),
}));

export const applicationSignatures = pgTable("application_signatures", {
  id: uuid("id").primaryKey().defaultRandom(),
  applicationId: uuid("application_id").notNull(),
  applicantId: uuid("applicant_id"),
  authUserId: uuid("auth_user_id"),
  signatureType: text("signature_type").notNull().default("agency_authorisation"),
  signerName: text("signer_name").notNull(),
  signatureText: text("signature_text"),
  signatureScope: jsonb("signature_scope"),
  source: text("source").default("website"),
  idempotencyKey: text("idempotency_key"),
  signedDocumentPath: text("signed_document_path"),
  documentHash: text("document_hash"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  signedAt: timestamp("signed_at", { withTimezone: true }).defaultNow(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  applicationIdx: index("application_signatures_application_idx").on(table.applicationId),
  applicantIdx: index("application_signatures_applicant_idx").on(table.applicantId),
  authUserIdx: index("application_signatures_auth_user_idx").on(table.authUserId),
  lookupIdx: index("application_signatures_lookup_idx").on(table.applicationId, table.signatureType),
  idempotencyKeyIdx: uniqueIndex("application_signatures_idempotency_key_idx").on(table.idempotencyKey),
}));

export const documentRequirements = pgTable("document_requirements", {
  id: uuid("id").primaryKey().defaultRandom(),
  visaPackageId: uuid("visa_package_id"),
  country: text("country").notNull(),
  visaType: text("visa_type").notNull(),
  requirementKey: text("requirement_key").notNull(),
  labelEn: text("label_en").notNull(),
  labelZh: text("label_zh").notNull(),
  description: text("description"),
  required: boolean("required").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  packageKeyIdx: uniqueIndex("document_requirements_package_key_idx").on(table.visaPackageId, table.requirementKey),
  countryVisaIdx: index("document_requirements_country_visa_idx").on(table.country, table.visaType, table.sortOrder),
}));

export const applicationPackets = pgTable("application_packets", {
  id: uuid("id").primaryKey().defaultRandom(),
  applicationId: uuid("application_id").notNull(),
  applicantId: uuid("applicant_id"),
  status: text("status").notNull().default("ready"),
  manifest: jsonb("manifest").notNull().default({}),
  manifestVersion: integer("manifest_version").notNull().default(1),
  storagePath: text("storage_path"),
  handoffToken: text("handoff_token"),
  handoffTokenHash: text("handoff_token_hash"),
  handoffTokenExpiresAt: timestamp("handoff_token_expires_at", { withTimezone: true }),
  generatedBy: uuid("generated_by"),
  generatedAt: timestamp("generated_at", { withTimezone: true }).defaultNow(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  supersededAt: timestamp("superseded_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  applicationIdx: index("application_packets_application_idx").on(table.applicationId),
  applicantIdx: index("application_packets_applicant_idx").on(table.applicantId),
  statusIdx: index("application_packets_status_idx").on(table.status),
  appStatusIdx: index("application_packets_app_status_idx").on(table.applicationId, table.status),
  handoffHashIdx: uniqueIndex("application_packets_handoff_hash_idx").on(table.handoffTokenHash),
}));

export const applicationEvents = pgTable("application_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  applicationId: uuid("application_id").notNull(),
  applicantId: uuid("applicant_id"),
  authUserId: uuid("auth_user_id"),
  eventType: text("event_type").notNull(),
  actorType: text("actor_type").notNull().default("system"),
  actorId: uuid("actor_id"),
  source: text("source").default("website_automation"),
  visibility: text("visibility").default("staff"),
  idempotencyKey: text("idempotency_key"),
  message: text("message"),
  metadata: jsonb("metadata"),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  applicationIdx: index("application_events_application_idx").on(table.applicationId),
  applicantIdx: index("application_events_applicant_idx").on(table.applicantId),
  authUserIdx: index("application_events_auth_user_idx").on(table.authUserId),
  typeIdx: index("application_events_type_idx").on(table.eventType),
  lookupIdx: index("application_events_lookup_idx").on(table.applicationId, table.eventType, table.createdAt),
  visibilityIdx: index("application_events_visibility_idx").on(table.visibility),
  idempotencyKeyIdx: uniqueIndex("application_events_idempotency_key_idx").on(table.idempotencyKey),
}));

export const notificationEvents = pgTable("notification_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  applicationId: uuid("application_id"),
  applicantId: uuid("applicant_id"),
  authUserId: uuid("auth_user_id"),
  channel: text("channel").notNull().default("email"),
  templateKey: text("template_key").notNull(),
  recipient: text("recipient"),
  status: text("status").notNull().default("queued"),
  provider: text("provider"),
  providerMessageId: text("provider_message_id"),
  providerEventId: text("provider_event_id"),
  idempotencyKey: text("idempotency_key"),
  errorMessage: text("error_message"),
  payload: jsonb("payload"),
  scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  applicationIdx: index("notification_events_application_idx").on(table.applicationId),
  applicantIdx: index("notification_events_applicant_idx").on(table.applicantId),
  authUserIdx: index("notification_events_auth_user_idx").on(table.authUserId),
  statusIdx: index("notification_events_status_idx").on(table.status),
  appStatusIdx: index("notification_events_app_status_idx").on(table.applicationId, table.status),
  templateStatusIdx: index("notification_events_template_status_idx").on(table.templateKey, table.status),
  providerMessageIdx: index("notification_events_provider_message_idx").on(table.providerMessageId),
  idempotencyKeyIdx: uniqueIndex("notification_events_idempotency_key_idx").on(table.idempotencyKey),
}));

export const ocrExtractions = pgTable("ocr_extractions", {
  id: uuid("id").primaryKey().defaultRandom(),
  applicationId: uuid("application_id").notNull(),
  applicantId: uuid("applicant_id"),
  documentId: uuid("document_id"),
  provider: text("provider").notNull().default("openai_vision"),
  status: text("status").notNull().default("pending"),
  extractedFields: jsonb("extracted_fields").notNull().default({}),
  errorMessage: text("error_message"),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  applicationIdx: index("ocr_extractions_application_idx").on(table.applicationId),
  applicantIdx: index("ocr_extractions_applicant_idx").on(table.applicantId),
  documentIdx: index("ocr_extractions_document_idx").on(table.documentId),
  statusIdx: index("ocr_extractions_status_idx").on(table.status),
  appStatusIdx: index("ocr_extractions_app_status_idx").on(table.applicationId, table.status),
}));

export const dataPrivacyRequests = pgTable("data_privacy_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  applicantId: uuid("applicant_id"),
  authUserId: uuid("auth_user_id"),
  applicationId: uuid("application_id"),
  requestReference: text("request_reference"),
  requestType: text("request_type").notNull(),
  status: text("status").notNull().default("requested"),
  requestedPayload: jsonb("requested_payload"),
  notes: text("notes"),
  identityVerifiedAt: timestamp("identity_verified_at", { withTimezone: true }),
  dueAt: timestamp("due_at", { withTimezone: true }),
  assignedTo: uuid("assigned_to"),
  decision: text("decision"),
  decisionNotes: text("decision_notes"),
  rejectionReason: text("rejection_reason"),
  exportStoragePath: text("export_storage_path"),
  legalHold: boolean("legal_hold").notNull().default(false),
  retentionNotes: text("retention_notes"),
  fulfilledAt: timestamp("fulfilled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  applicationIdx: index("data_privacy_requests_application_idx").on(table.applicationId),
  applicantIdx: index("data_privacy_requests_applicant_idx").on(table.applicantId),
  authUserIdx: index("data_privacy_requests_auth_user_idx").on(table.authUserId),
  statusIdx: index("data_privacy_requests_status_idx").on(table.status),
  typeStatusIdx: index("data_privacy_requests_type_status_idx").on(table.requestType, table.status),
  referenceIdx: uniqueIndex("data_privacy_requests_reference_idx").on(table.requestReference),
}));

export const coverageMatrix = pgTable("coverage_matrix", {
  id: uuid("id").primaryKey().defaultRandom(),
  visaPackageId: uuid("visa_package_id"),
  country: text("country").notNull(),
  visaType: text("visa_type").notNull(),
  schemaStatus: text("schema_status").notNull().default("unsupported"),
  documentChecklistStatus: text("document_checklist_status").notNull().default("unsupported"),
  paymentStatus: text("payment_status").notNull().default("unsupported"),
  packetStatus: text("packet_status").notNull().default("unsupported"),
  externalHandoffStatus: text("external_handoff_status").notNull().default("unsupported"),
  resultIngestStatus: text("result_ingest_status").notNull().default("unsupported"),
  statusUiStatus: text("status_ui_status").notNull().default("unsupported"),
  customerVisible: boolean("customer_visible").notNull().default(false),
  promiseLabel: text("promise_label"),
  notes: text("notes"),
  metadata: jsonb("metadata"),
  lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  packageIdx: uniqueIndex("coverage_matrix_package_uidx").on(table.visaPackageId),
  countryVisaIdx: index("coverage_matrix_country_visa_idx").on(table.country, table.visaType),
  customerVisibleIdx: index("coverage_matrix_customer_visible_idx").on(table.customerVisible),
  statusLookupIdx: index("coverage_matrix_status_lookup_idx").on(
    table.schemaStatus,
    table.documentChecklistStatus,
    table.paymentStatus,
    table.packetStatus,
  ),
}));

export const governmentFeeRules = pgTable("government_fee_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  visaPackageId: uuid("visa_package_id"),
  country: text("country").notNull(),
  visaType: text("visa_type").notNull(),
  feeType: text("fee_type").notNull().default("government_fee"),
  mode: text("mode").notNull().default("display_only"),
  amountCents: integer("amount_cents").notNull().default(0),
  currency: text("currency").notNull().default("USD"),
  label: text("label"),
  payer: text("payer").notNull().default("applicant"),
  collectionMethod: text("collection_method").notNull().default("official_portal"),
  effectiveFrom: date("effective_from").notNull(),
  effectiveTo: date("effective_to"),
  sourceUrl: text("source_url"),
  notes: text("notes"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  packageIdx: index("government_fee_rules_package_idx").on(table.visaPackageId),
  countryVisaIdx: index("government_fee_rules_country_visa_idx").on(table.country, table.visaType),
  modeIdx: index("government_fee_rules_mode_idx").on(table.mode),
  effectiveLookupIdx: index("government_fee_rules_effective_lookup_idx").on(
    table.country,
    table.visaType,
    table.feeType,
    table.effectiveFrom,
    table.effectiveTo,
  ),
}));

export const piiRetentionJobs = pgTable("pii_retention_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  dataPrivacyRequestId: uuid("data_privacy_request_id"),
  applicantId: uuid("applicant_id"),
  authUserId: uuid("auth_user_id"),
  applicationId: uuid("application_id"),
  jobType: text("job_type").notNull(),
  status: text("status").notNull().default("queued"),
  scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  retentionReason: text("retention_reason"),
  scope: jsonb("scope").notNull().default({}),
  resultSummary: text("result_summary"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  requestIdx: index("pii_retention_jobs_request_idx").on(table.dataPrivacyRequestId),
  applicantIdx: index("pii_retention_jobs_applicant_idx").on(table.applicantId),
  authUserIdx: index("pii_retention_jobs_auth_user_idx").on(table.authUserId),
  applicationIdx: index("pii_retention_jobs_application_idx").on(table.applicationId),
  statusIdx: index("pii_retention_jobs_status_idx").on(table.status),
  scheduleIdx: index("pii_retention_jobs_schedule_idx").on(table.status, table.scheduledFor),
}));

export type PaymentRecord = typeof paymentRecords.$inferSelect;
export type NewPaymentRecord = typeof paymentRecords.$inferInsert;
export type InvoiceRequest = typeof invoiceRequests.$inferSelect;
export type NewInvoiceRequest = typeof invoiceRequests.$inferInsert;
export type RefundRecord = typeof refundRecords.$inferSelect;
export type NewRefundRecord = typeof refundRecords.$inferInsert;
export type ConsentEvent = typeof consentEvents.$inferSelect;
export type NewConsentEvent = typeof consentEvents.$inferInsert;
export type ApplicationSignature = typeof applicationSignatures.$inferSelect;
export type NewApplicationSignature = typeof applicationSignatures.$inferInsert;
export type DocumentRequirement = typeof documentRequirements.$inferSelect;
export type NewDocumentRequirement = typeof documentRequirements.$inferInsert;
export type ApplicationPacket = typeof applicationPackets.$inferSelect;
export type NewApplicationPacket = typeof applicationPackets.$inferInsert;
export type ApplicationEvent = typeof applicationEvents.$inferSelect;
export type NewApplicationEvent = typeof applicationEvents.$inferInsert;
export type NotificationEvent = typeof notificationEvents.$inferSelect;
export type NewNotificationEvent = typeof notificationEvents.$inferInsert;
export type OcrExtraction = typeof ocrExtractions.$inferSelect;
export type NewOcrExtraction = typeof ocrExtractions.$inferInsert;
export type DataPrivacyRequest = typeof dataPrivacyRequests.$inferSelect;
export type NewDataPrivacyRequest = typeof dataPrivacyRequests.$inferInsert;
export const dataRightsRequests = dataPrivacyRequests;
export type DataRightsRequest = typeof dataPrivacyRequests.$inferSelect;
export type NewDataRightsRequest = typeof dataPrivacyRequests.$inferInsert;
export type CoverageMatrix = typeof coverageMatrix.$inferSelect;
export type NewCoverageMatrix = typeof coverageMatrix.$inferInsert;
export type GovernmentFeeRule = typeof governmentFeeRules.$inferSelect;
export type NewGovernmentFeeRule = typeof governmentFeeRules.$inferInsert;
export type PiiRetentionJob = typeof piiRetentionJobs.$inferSelect;
export type NewPiiRetentionJob = typeof piiRetentionJobs.$inferInsert;

// =============================================================================
// USER CHAT SESSIONS
// One persistent chat session per user (single continuous conversation)
// Linked to their active visa package when applicable
// =============================================================================

export const userChatSessions = pgTable("user_chat_sessions", {
	id: uuid("id").primaryKey().defaultRandom(),
	authUserId: uuid("auth_user_id").notNull().unique(),
	visaPackageId: uuid("visa_package_id"),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export type UserChatSession = typeof userChatSessions.$inferSelect;
export type NewUserChatSession = typeof userChatSessions.$inferInsert;

// =============================================================================
// APPLICATION TRANSLATIONS
// Stores Chinese→English translations of user-submitted application fields
// translated_by: google | user
// =============================================================================

export const applicationTranslations = pgTable("application_translations", {
	id: uuid("id").primaryKey().defaultRandom(),
	applicationId: uuid("application_id").notNull(),
	fieldKey: text("field_key").notNull(),
	sourceText: text("source_text").notNull(),
	translatedText: text("translated_text").notNull(),
	sourceLang: text("source_lang").notNull().default("zh"),
	targetLang: text("target_lang").notNull().default("en"),
	translatedBy: text("translated_by").notNull().default("google"),
	userEdited: boolean("user_edited").notNull().default(false),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export type ApplicationTranslation = typeof applicationTranslations.$inferSelect;
export type NewApplicationTranslation = typeof applicationTranslations.$inferInsert;

