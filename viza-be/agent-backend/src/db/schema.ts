import {
	pgTable,
	text,
	timestamp,
	uuid,
	boolean,
	date,
	integer,
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
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

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
