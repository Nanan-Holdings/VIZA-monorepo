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
	submissionResult: jsonb("submission_result"),
	submissionResultStatus: text("submission_result_status"),
	submissionResultUpdatedAt: timestamp("submission_result_updated_at", { withTimezone: true }),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

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
	storagePath: text("storage_path"),
	filename: text("filename"),
	status: text("status").default("uploaded").notNull(),
	rejectionReason: text("rejection_reason"),
	metadata: jsonb("metadata"),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// =============================================================================
// SUBMISSION QUEUE
// Tracks automation submissions to evisa.imigrasi.go.id
// status: pending | processing | done | failed
// =============================================================================

export const ukAccounts = pgTable("uk_accounts", {
	id: uuid("id").primaryKey().defaultRandom(),
	applicantId: uuid("applicant_id").notNull(),
	email: text("email").notNull(),
	passwordEncrypted: text("password_encrypted").notNull(),
	resumeUrl: text("resume_url").notNull(),
	storageStateJson: jsonb("storage_state_json"),
	lastAuthenticatedAt: timestamp("last_authenticated_at", { withTimezone: true }),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const auAccounts = pgTable("au_accounts", {
	id: uuid("id").primaryKey().defaultRandom(),
	applicantId: uuid("applicant_id").notNull(),
	username: text("username").notNull(),
	passwordEncrypted: text("password_encrypted").notNull(),
	totpSecretEncrypted: text("totp_secret_encrypted"),
	resumeTrn: text("resume_trn"),
	storageStateJson: jsonb("storage_state_json"),
	lastAuthenticatedAt: timestamp("last_authenticated_at", { withTimezone: true }),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const submissionQueue = pgTable("submission_queue", {
	id: uuid("id").primaryKey().defaultRandom(),
	applicationId: uuid("application_id").notNull(),
	status: text("status").default("pending").notNull(),
	attempts: integer("attempts").default(0).notNull(),
	lastError: text("last_error"),
	ceacResultPayload: jsonb("ceac_result_payload"),
	fvResultPayload: jsonb("fv_result_payload"),
	fvApplicationReference: text("fv_application_reference"),
	fvPdfStoragePath: text("fv_pdf_storage_path"),
	ukResultPayload: jsonb("uk_result_payload"),
	ukApplicationReference: text("uk_application_reference"),
	auResultPayload: jsonb("au_result_payload"),
	auTrn: text("au_trn"),
	auReviewScreenshotStoragePath: text("au_review_screenshot_storage_path"),
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

// =============================================================================
// QUESTION SETS (PROD-001)
// Per (country, visa_type) version. Drives the answer-collection UI.
// Derived from each country's CanonicalAnswers + form-recon walker.
// =============================================================================

export const questionSet = pgTable("question_set", {
  id: uuid("id").primaryKey().defaultRandom(),
  country: text("country").notNull(),
  visaType: text("visa_type").notNull(),
  version: text("version").notNull().default("v1"),
  derivedFrom: text("derived_from"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export type QuestionSet = typeof questionSet.$inferSelect;
export type NewQuestionSet = typeof questionSet.$inferInsert;

export const questionField = pgTable("question_field", {
  id: uuid("id").primaryKey().defaultRandom(),
  questionSetId: uuid("question_set_id").notNull(),
  fieldName: text("field_name").notNull(),
  label: text("label").notNull(),
  widgetType: text("widget_type").notNull(),
  required: boolean("required").notNull().default(false),
  options: jsonb("options"),
  branch: jsonb("branch"),
  ordinal: integer("ordinal").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export type QuestionField = typeof questionField.$inferSelect;
export type NewQuestionField = typeof questionField.$inferInsert;

// =============================================================================
// PHOTO SPEC (DOCUP-003)
// Per (country, visa_type) photo dimensions consumed by lib/photo/crop.ts.
// =============================================================================

export const photoSpec = pgTable("photo_spec", {
  id: uuid("id").primaryKey().defaultRandom(),
  country: text("country").notNull(),
  visaType: text("visa_type").notNull(),
  widthMm: text("width_mm").notNull(),
  heightMm: text("height_mm").notNull(),
  dpi: integer("dpi").notNull().default(300),
  eyelineFromTop: text("eyeline_from_top"),
  headHeightPct: text("head_height_pct"),
  backgroundHex: text("background_hex"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export type PhotoSpec = typeof photoSpec.$inferSelect;
export type NewPhotoSpec = typeof photoSpec.$inferInsert;

// =============================================================================
// FACE MATCH AUDIT (DOCUP-004)
// =============================================================================

export const faceMatchAudit = pgTable("face_match_audit", {
  id: uuid("id").primaryKey().defaultRandom(),
  applicantId: uuid("applicant_id").notNull(),
  applicationId: uuid("application_id"),
  provider: text("provider").notNull(),
  score: text("score").notNull(),
  threshold: text("threshold").notNull(),
  decision: text("decision").notNull(),
  passportStoragePath: text("passport_storage_path"),
  applicantStoragePath: text("applicant_storage_path"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export type FaceMatchAudit = typeof faceMatchAudit.$inferSelect;
export type NewFaceMatchAudit = typeof faceMatchAudit.$inferInsert;

// =============================================================================
// ACCOUNT RECOVERY AUDIT (AUTH-004)
// =============================================================================

export const accountRecoveryAudit = pgTable("account_recovery_audit", {
  id: uuid("id").primaryKey().defaultRandom(),
  targetUserId: uuid("target_user_id").notNull(),
  performedBy: uuid("performed_by").notNull(),
  reason: text("reason").notNull(),
  identityChecks: jsonb("identity_checks").notNull(),
  actionKind: text("action_kind").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export type AccountRecoveryAudit = typeof accountRecoveryAudit.$inferSelect;
export type NewAccountRecoveryAudit = typeof accountRecoveryAudit.$inferInsert;

