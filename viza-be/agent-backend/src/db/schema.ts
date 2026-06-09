import {
	pgTable,
	text,
	timestamp,
	uuid,
	boolean,
	date,
	integer,
	bigint,
	jsonb,
	numeric,
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
	fullNameZh: text("full_name_zh"),
	fullNameEn: text("full_name_en"),
	surname: text("surname"),
	surnameZh: text("surname_zh"),
	surnameEn: text("surname_en"),
	givenNames: text("given_names"),
	givenNamesZh: text("given_names_zh"),
	givenNamesEn: text("given_names_en"),
	dateOfBirth: date("date_of_birth"),
	placeOfBirth: text("place_of_birth"),
	placeOfBirthZh: text("place_of_birth_zh"),
	placeOfBirthEn: text("place_of_birth_en"),
	birthCountry: text("birth_country"),
	birthProvinceOrState: text("birth_province_or_state"),
	birthProvinceOrStateZh: text("birth_province_or_state_zh"),
	birthProvinceOrStateEn: text("birth_province_or_state_en"),
	birthCity: text("birth_city"),
	birthCityZh: text("birth_city_zh"),
	birthCityEn: text("birth_city_en"),
	gender: text("gender"),
	nationality: text("nationality"),
	occupation: text("occupation"),
	occupationZh: text("occupation_zh"),
	occupationEn: text("occupation_en"),
	address: text("address"),
	addressZh: text("address_zh"),
	addressEn: text("address_en"),
	passportNumber: text("passport_number"),
	passportIssueDate: date("passport_issue_date"),
	passportExpiryDate: date("passport_expiry_date"),
	passportIssuingCountry: text("passport_issuing_country"),
	passportIssuingAuthority: text("passport_issuing_authority"),
	email: text("email"),
	phone: text("phone"),
	wechat: text("wechat"),
	dependantOfUserId: uuid("dependant_of_user_id"),
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
	officialFeeStatus: text("official_fee_status").default("not_started"),
	officialFeeQuoteId: uuid("official_fee_quote_id"),
	officialFeePaymentIntentId: uuid("official_fee_payment_intent_id"),
	officialFeeReceiptId: uuid("official_fee_receipt_id"),
	officialFeeReconciliationStatus: text("official_fee_reconciliation_status").default("pending"),
	appointmentAssistanceStatus: text("appointment_assistance_status").default("appointment_not_started"),
	appointmentAssistanceJobId: uuid("appointment_assistance_job_id"),
	appointmentConfirmationId: uuid("appointment_confirmation_id"),
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
	submissionResult: jsonb("submission_result"),
	submissionResultStatus: text("submission_result_status"),
	submissionResultUpdatedAt: timestamp("submission_result_updated_at", { withTimezone: true }),
	groupId: uuid("group_id"),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
	applicantStatusIdx: index("applications_applicant_status_idx").on(table.applicantId, table.status),
	visaPackageIdx: index("applications_visa_package_idx").on(table.visaPackageId),
	automationStatusIdx: index("applications_automation_status_idx").on(table.automationStatus),
	automationStageIdx: index("applications_automation_stage_idx").on(table.automationStage),
	paymentStatusIdx: index("applications_payment_status_idx").on(table.paymentStatus),
	officialFeeStatusIdx: index("applications_official_fee_status_idx").on(table.officialFeeStatus),
	officialFeeIntentIdx: index("applications_official_fee_intent_idx").on(table.officialFeePaymentIntentId),
	appointmentStatusIdx: index("applications_appointment_status_idx").on(table.appointmentAssistanceStatus),
	appointmentJobIdx: index("applications_appointment_job_idx").on(table.appointmentAssistanceJobId),
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
	userId: uuid("user_id"),
	status: text("status").default("pending").notNull(),
	mode: text("mode").default("dry_run"),
	provider: text("provider"),
	attempts: integer("attempts").default(0).notNull(),
	lastError: text("last_error"),
	pausedReason: text("paused_reason"),
	officialApplicationIdEncrypted: text("official_application_id_encrypted"),
	officialConfirmationNumberEncrypted: text("official_confirmation_number_encrypted"),
	officialSecurityQuestionEncrypted: text("official_security_question_encrypted"),
	officialSecurityAnswerEncrypted: text("official_security_answer_encrypted"),
	officialLocation: text("official_location"),
	reviewDiffStatus: text("review_diff_status").default("not_run"),
	finalUserConfirmationAt: timestamp("final_user_confirmation_at", { withTimezone: true }),
	finalUserConfirmationIpHash: text("final_user_confirmation_ip_hash"),
	finalUserConfirmationUserAgentHash: text("final_user_confirmation_user_agent_hash"),
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

export const ds160SubmissionJobs = pgTable("ds160_submission_jobs", {
	id: uuid("id").primaryKey().defaultRandom(),
	applicationId: uuid("application_id").notNull(),
	userId: uuid("user_id"),
	countryCode: text("country_code").notNull().default("US"),
	visaType: text("visa_type").notNull().default("DS160"),
	mode: text("mode").notNull().default("dry_run"),
	provider: text("provider").notNull().default("ceac_dry_run"),
	status: text("status").notNull().default("pending"),
	officialApplicationIdEncrypted: text("official_application_id_encrypted"),
	officialConfirmationNumberEncrypted: text("official_confirmation_number_encrypted"),
	officialSecurityQuestionEncrypted: text("official_security_question_encrypted"),
	officialSecurityAnswerEncrypted: text("official_security_answer_encrypted"),
	officialLocation: text("official_location"),
	officialStartedAt: timestamp("official_started_at", { withTimezone: true }),
	officialSubmittedAt: timestamp("official_submitted_at", { withTimezone: true }),
	officialConfirmationPageUrl: text("official_confirmation_page_url"),
	confirmationPdfUrl: text("confirmation_pdf_url"),
	confirmationScreenshotUrl: text("confirmation_screenshot_url"),
	reviewDiffStatus: text("review_diff_status").notNull().default("not_run"),
	finalUserConfirmationAt: timestamp("final_user_confirmation_at", { withTimezone: true }),
	finalUserConfirmationIpHash: text("final_user_confirmation_ip_hash"),
	finalUserConfirmationUserAgentHash: text("final_user_confirmation_user_agent_hash"),
	errorCode: text("error_code"),
	errorMessage: text("error_message"),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
	applicationIdx: index("ds160_submission_jobs_application_idx").on(table.applicationId),
	userIdx: index("ds160_submission_jobs_user_idx").on(table.userId),
	statusIdx: index("ds160_submission_jobs_status_idx").on(table.status),
	modeIdx: index("ds160_submission_jobs_mode_idx").on(table.mode),
}));

export const ds160OfficialReviewSnapshots = pgTable("ds160_official_review_snapshots", {
	id: uuid("id").primaryKey().defaultRandom(),
	jobId: uuid("job_id"),
	applicationId: uuid("application_id").notNull(),
	userId: uuid("user_id"),
	source: text("source").notNull(),
	redactedSnapshotJson: jsonb("redacted_snapshot_json").notNull().default({}),
	snapshotHash: text("snapshot_hash").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
	jobIdx: index("ds160_review_snapshots_job_idx").on(table.jobId),
	applicationIdx: index("ds160_review_snapshots_application_idx").on(table.applicationId),
	sourceIdx: index("ds160_review_snapshots_source_idx").on(table.source),
}));

export const ds160ReviewDiffs = pgTable("ds160_review_diffs", {
	id: uuid("id").primaryKey().defaultRandom(),
	jobId: uuid("job_id"),
	applicationId: uuid("application_id").notNull(),
	fieldId: text("field_id").notNull(),
	vizaValueRedacted: text("viza_value_redacted"),
	ceacValueRedacted: text("ceac_value_redacted"),
	diffType: text("diff_type").notNull(),
	severity: text("severity").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
	jobIdx: index("ds160_review_diffs_job_idx").on(table.jobId),
	applicationIdx: index("ds160_review_diffs_application_idx").on(table.applicationId),
	fieldIdx: index("ds160_review_diffs_field_idx").on(table.fieldId),
	severityIdx: index("ds160_review_diffs_severity_idx").on(table.severity),
}));

export const ds160LiveManualActions = pgTable("ds160_live_manual_actions", {
	id: uuid("id").primaryKey().defaultRandom(),
	jobId: uuid("job_id"),
	applicationId: uuid("application_id").notNull(),
	userId: uuid("user_id"),
	actionType: text("action_type").notNull(),
	status: text("status").notNull().default("pending"),
	instruction: text("instruction"),
	screenshotUrl: text("screenshot_url"),
	redactedMetadataJson: jsonb("redacted_metadata_json").notNull().default({}),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	completedAt: timestamp("completed_at", { withTimezone: true }),
	expiresAt: timestamp("expires_at", { withTimezone: true }),
}, (table) => ({
	jobIdx: index("ds160_live_manual_actions_job_idx").on(table.jobId),
	applicationIdx: index("ds160_live_manual_actions_application_idx").on(table.applicationId),
	statusIdx: index("ds160_live_manual_actions_status_idx").on(table.status),
	typeIdx: index("ds160_live_manual_actions_type_idx").on(table.actionType),
}));

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
// TRAVEL DESTINATION INDEX
// Large searchable index for Travel AI destination resolution. Cards are stored
// separately and generated lazily only after a destination is selected.
// =============================================================================

export const travelDestinations = pgTable("travel_destinations", {
	id: uuid("id").primaryKey().defaultRandom(),
	canonicalName: text("canonical_name").notNull(),
	displayName: text("display_name").notNull(),
	normalizedName: text("normalized_name"),
	nameEn: text("name_en"),
	nameZh: text("name_zh"),
	aliasesJson: jsonb("aliases_json").default([]).notNull(),
	countryCode: text("country_code"),
	countryName: text("country_name"),
	countryNameEn: text("country_name_en"),
	countryNameZh: text("country_name_zh"),
	region: text("region"),
	city: text("city"),
	placeType: text("place_type"),
	latitude: numeric("latitude"),
	longitude: numeric("longitude"),
	timezone: text("timezone"),
	currency: text("currency"),
	population: bigint("population", { mode: "number" }),
	popularityScore: numeric("popularity_score").default("0"),
	source: text("source"),
	sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true }),
	geonamesId: text("geonames_id"),
	wikidataQid: text("wikidata_qid"),
	osmId: text("osm_id"),
	confidenceScore: numeric("confidence_score").default("1"),
	isVerified: boolean("is_verified").default(false),
	isActive: boolean("is_active").default(true),
	isSearchable: boolean("is_searchable").default(true),
	showOnHome: boolean("show_on_home").default(false),
	isFeatured: boolean("is_featured").default(false),
	isDropdownEnabled: boolean("is_dropdown_enabled").default(false),
	isPopular: boolean("is_popular").default(false),
	dataQuality: text("data_quality").default("incomplete").notNull(),
	completenessScore: numeric("completeness_score").default("0"),
	lastEnrichedAt: timestamp("last_enriched_at", { withTimezone: true }),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
	normalizedNameIdx: index("travel_destinations_normalized_name_idx").on(table.normalizedName),
	countryCodeIdx: index("travel_destinations_country_code_idx").on(table.countryCode),
	placeTypeIdx: index("travel_destinations_place_type_idx").on(table.placeType),
	popularityScoreIdx: index("travel_destinations_popularity_score_idx").on(table.popularityScore),
	isSearchableIdx: index("travel_destinations_is_searchable_idx").on(table.isSearchable),
	showOnHomeIdx: index("travel_destinations_show_on_home_idx").on(table.showOnHome),
	isFeaturedIdx: index("travel_destinations_is_featured_idx").on(table.isFeatured),
	isDropdownEnabledIdx: index("travel_destinations_dropdown_enabled_idx").on(table.isDropdownEnabled),
	dataQualityIdx: index("travel_destinations_data_quality_idx").on(table.dataQuality),
	completenessScoreIdx: index("travel_destinations_completeness_score_idx").on(table.completenessScore),
	geonamesIdIdx: index("travel_destinations_geonames_id_idx").on(table.geonamesId),
	wikidataQidIdx: index("travel_destinations_wikidata_qid_idx").on(table.wikidataQid),
	normalizedCountryIdx: uniqueIndex("travel_destinations_normalized_country_unique_idx").on(table.normalizedName, table.countryCode),
}));

export const travelDestinationAliases = pgTable("travel_destination_aliases", {
	id: uuid("id").primaryKey().defaultRandom(),
	destinationId: uuid("destination_id").notNull(),
	alias: text("alias").notNull(),
	normalizedAlias: text("normalized_alias"),
	language: text("language"),
	source: text("source"),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
	destinationIdx: index("travel_destination_aliases_destination_idx").on(table.destinationId),
	normalizedAliasIdx: index("travel_destination_aliases_normalized_alias_idx").on(table.normalizedAlias),
}));

export const travelDestinationCards = pgTable("travel_destination_cards", {
	id: uuid("id").primaryKey().defaultRandom(),
	destinationId: uuid("destination_id").notNull(),
	cardType: text("card_type").notNull(),
	title: text("title").notNull(),
	titleEn: text("title_en"),
	titleZh: text("title_zh"),
	subtitle: text("subtitle"),
	subtitleEn: text("subtitle_en"),
	subtitleZh: text("subtitle_zh"),
	descriptionEn: text("description_en"),
	descriptionZh: text("description_zh"),
	imageUrl: text("image_url"),
	imageAssetId: uuid("image_asset_id"),
	payloadJson: jsonb("payload_json").default({}).notNull(),
	source: text("source"),
	sourceStatus: text("source_status").default("placeholder").notNull(),
	isGenerated: boolean("is_generated").default(false),
	confidenceScore: numeric("confidence_score").default("1"),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
	destinationIdx: index("travel_destination_cards_destination_idx").on(table.destinationId),
	cardTypeIdx: index("travel_destination_cards_card_type_idx").on(table.cardType),
	imageAssetIdx: index("travel_destination_cards_image_asset_idx").on(table.imageAssetId),
	sourceStatusIdx: index("travel_destination_cards_source_status_idx").on(table.sourceStatus),
	destinationTypeIdx: uniqueIndex("travel_destination_cards_destination_type_unique_idx").on(table.destinationId, table.cardType),
}));

export const travelAttractions = pgTable("travel_attractions", {
	id: uuid("id").primaryKey().defaultRandom(),
	destinationId: uuid("destination_id").notNull(),
	canonicalName: text("canonical_name").notNull(),
	nameEn: text("name_en").notNull(),
	nameZh: text("name_zh"),
	descriptionEn: text("description_en"),
	descriptionZh: text("description_zh"),
	category: text("category"),
	latitude: numeric("latitude"),
	longitude: numeric("longitude"),
	recommendedDurationMinutes: integer("recommended_duration_minutes"),
	popularityScore: numeric("popularity_score").default("0"),
	dataQuality: text("data_quality").default("incomplete").notNull(),
	source: text("source"),
	sourceUrl: text("source_url"),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
	destinationIdx: index("travel_attractions_destination_idx").on(table.destinationId),
	dataQualityIdx: index("travel_attractions_data_quality_idx").on(table.dataQuality),
	destinationCanonicalIdx: uniqueIndex("travel_attractions_destination_canonical_unique_idx").on(table.destinationId, table.canonicalName),
}));

export const travelAssets = pgTable("travel_assets", {
	id: uuid("id").primaryKey().defaultRandom(),
	entityType: text("entity_type").notNull(),
	entityId: uuid("entity_id").notNull(),
	assetType: text("asset_type").notNull(),
	imageUrl: text("image_url").notNull(),
	thumbnailUrl: text("thumbnail_url"),
	width: integer("width"),
	height: integer("height"),
	source: text("source"),
	sourceUrl: text("source_url"),
	attribution: text("attribution"),
	license: text("license"),
	confidenceScore: numeric("confidence_score").default("0"),
	verified: boolean("verified").default(false),
	isPrimary: boolean("is_primary").default(false),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
	entityIdx: index("travel_assets_entity_idx").on(table.entityType, table.entityId),
	primaryIdx: index("travel_assets_primary_idx").on(table.entityType, table.entityId, table.isPrimary),
	verifiedIdx: index("travel_assets_verified_idx").on(table.verified),
	entityTypeAssetUrlIdx: uniqueIndex("travel_assets_entity_type_asset_url_unique_idx").on(table.entityType, table.entityId, table.assetType, table.imageUrl),
}));

export const travelEnrichmentJobs = pgTable("travel_enrichment_jobs", {
	id: uuid("id").primaryKey().defaultRandom(),
	destinationId: uuid("destination_id").notNull(),
	status: text("status").default("queued").notNull(),
	missingFieldsJson: jsonb("missing_fields_json").default([]).notNull(),
	provider: text("provider"),
	errorCode: text("error_code"),
	errorMessage: text("error_message"),
	startedAt: timestamp("started_at", { withTimezone: true }),
	finishedAt: timestamp("finished_at", { withTimezone: true }),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
	destinationIdx: index("travel_enrichment_jobs_destination_idx").on(table.destinationId),
	statusIdx: index("travel_enrichment_jobs_status_idx").on(table.status),
	createdAtIdx: index("travel_enrichment_jobs_created_at_idx").on(table.createdAt),
}));

export const travelEnrichmentEvents = pgTable("travel_enrichment_events", {
	id: uuid("id").primaryKey().defaultRandom(),
	jobId: uuid("job_id"),
	destinationId: uuid("destination_id"),
	eventType: text("event_type").notNull(),
	message: text("message"),
	metadataJson: jsonb("metadata_json").default({}).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
	jobIdx: index("travel_enrichment_events_job_idx").on(table.jobId),
	destinationIdx: index("travel_enrichment_events_destination_idx").on(table.destinationId),
}));

export const travelItinerarySessions = pgTable("travel_itinerary_sessions", {
	id: uuid("id").primaryKey().defaultRandom(),
	userId: uuid("user_id"),
	applicationId: uuid("application_id"),
	destinationId: uuid("destination_id"),
	conversationMemoryJson: jsonb("conversation_memory_json").default({}).notNull(),
	itineraryJson: jsonb("itinerary_json").default({}).notNull(),
	mapStateJson: jsonb("map_state_json").default({}).notNull(),
	cardStateJson: jsonb("card_state_json").default({}).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
	userIdx: index("travel_itinerary_sessions_user_idx").on(table.userId),
	applicationIdx: index("travel_itinerary_sessions_application_idx").on(table.applicationId),
	destinationIdx: index("travel_itinerary_sessions_destination_idx").on(table.destinationId),
	updatedAtIdx: index("travel_itinerary_sessions_updated_at_idx").on(table.updatedAt),
}));

export const travelUnresolvedDestinations = pgTable("travel_unresolved_destinations", {
	id: uuid("id").primaryKey().defaultRandom(),
	userInput: text("user_input").notNull(),
	resolvedName: text("resolved_name"),
	llmGuessJson: jsonb("llm_guess_json"),
	confidenceScore: numeric("confidence_score"),
	status: text("status").default("pending").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
	userInputIdx: index("travel_unresolved_destinations_user_input_idx").on(table.userInput),
	statusIdx: index("travel_unresolved_destinations_status_idx").on(table.status),
}));

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

export type TravelDestination = typeof travelDestinations.$inferSelect;
export type NewTravelDestination = typeof travelDestinations.$inferInsert;

export type TravelDestinationAlias = typeof travelDestinationAliases.$inferSelect;
export type NewTravelDestinationAlias = typeof travelDestinationAliases.$inferInsert;

export type TravelDestinationCard = typeof travelDestinationCards.$inferSelect;
export type NewTravelDestinationCard = typeof travelDestinationCards.$inferInsert;

export type TravelItinerarySession = typeof travelItinerarySessions.$inferSelect;
export type NewTravelItinerarySession = typeof travelItinerarySessions.$inferInsert;

export type TravelUnresolvedDestination = typeof travelUnresolvedDestinations.$inferSelect;
export type NewTravelUnresolvedDestination = typeof travelUnresolvedDestinations.$inferInsert;

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

export const officialFeeQuotes = pgTable("official_fee_quotes", {
  id: uuid("id").primaryKey().defaultRandom(),
  applicationId: uuid("application_id").notNull(),
  userId: uuid("user_id").notNull(),
  countryCode: text("country_code").notNull(),
  visaType: text("visa_type"),
  officialFeeAmount: numeric("official_fee_amount").notNull(),
  officialFeeCurrency: text("official_fee_currency").notNull(),
  serviceFeeAmount: numeric("service_fee_amount"),
  serviceFeeCurrency: text("service_fee_currency"),
  totalChargeAmount: numeric("total_charge_amount"),
  totalChargeCurrency: text("total_charge_currency"),
  exchangeRate: numeric("exchange_rate"),
  feeSource: text("fee_source"),
  feeSourceUrl: text("fee_source_url"),
  feeBreakdownJson: jsonb("fee_breakdown_json").notNull().default({}),
  quoteStatus: text("quote_status").notNull().default("created"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  applicationIdx: index("official_fee_quotes_application_idx").on(table.applicationId),
  userIdx: index("official_fee_quotes_user_idx").on(table.userId),
  countryIdx: index("official_fee_quotes_country_idx").on(table.countryCode),
  statusIdx: index("official_fee_quotes_status_idx").on(table.quoteStatus),
  createdIdx: index("official_fee_quotes_created_idx").on(table.createdAt),
}));

export const paymentInstruments = pgTable("payment_instruments", {
  id: uuid("id").primaryKey().defaultRandom(),
  provider: text("provider").notNull(),
  providerInstrumentId: text("provider_instrument_id"),
  instrumentType: text("instrument_type").notNull(),
  status: text("status").notNull().default("active"),
  currency: text("currency"),
  spendingLimitAmount: numeric("spending_limit_amount"),
  spendingLimitCurrency: text("spending_limit_currency"),
  allowedCountryCodes: text("allowed_country_codes").array(),
  allowedMerchantCategories: text("allowed_merchant_categories").array(),
  last4: text("last4"),
  expiresMonth: integer("expires_month"),
  expiresYear: integer("expires_year"),
  metadataJson: jsonb("metadata_json").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  providerIdx: index("payment_instruments_provider_idx").on(table.provider),
  statusIdx: index("payment_instruments_status_idx").on(table.status),
  typeIdx: index("payment_instruments_type_idx").on(table.instrumentType),
  createdIdx: index("payment_instruments_created_idx").on(table.createdAt),
}));

export const officialFeePaymentIntents = pgTable("official_fee_payment_intents", {
  id: uuid("id").primaryKey().defaultRandom(),
  applicationId: uuid("application_id").notNull(),
  userId: uuid("user_id").notNull(),
  feeQuoteId: uuid("fee_quote_id"),
  countryCode: text("country_code").notNull(),
  provider: text("provider").notNull(),
  mode: text("mode").notNull().default("dry_run"),
  officialFeeAmount: numeric("official_fee_amount").notNull(),
  officialFeeCurrency: text("official_fee_currency").notNull(),
  targetPayee: text("target_payee"),
  targetSite: text("target_site"),
  paymentMethodType: text("payment_method_type"),
  paymentInstrumentId: uuid("payment_instrument_id"),
  status: text("status").notNull().default("created"),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  requiresAdminApproval: boolean("requires_admin_approval").default(true),
  adminApprovedBy: uuid("admin_approved_by"),
  adminApprovedAt: timestamp("admin_approved_at", { withTimezone: true }),
  userConsentedAt: timestamp("user_consented_at", { withTimezone: true }),
  userConsentSnapshotJson: jsonb("user_consent_snapshot_json"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  applicationIdx: index("official_fee_intents_application_idx").on(table.applicationId),
  userIdx: index("official_fee_intents_user_idx").on(table.userId),
  countryIdx: index("official_fee_intents_country_idx").on(table.countryCode),
  statusIdx: index("official_fee_intents_status_idx").on(table.status),
  idempotencyIdx: index("official_fee_intents_idempotency_idx").on(table.idempotencyKey),
  providerIdx: index("official_fee_intents_provider_idx").on(table.provider),
  createdIdx: index("official_fee_intents_created_idx").on(table.createdAt),
}));

export const officialFeePaymentAttempts = pgTable("official_fee_payment_attempts", {
  id: uuid("id").primaryKey().defaultRandom(),
  officialFeePaymentIntentId: uuid("official_fee_payment_intent_id"),
  applicationId: uuid("application_id").notNull(),
  attemptNumber: integer("attempt_number").notNull(),
  provider: text("provider").notNull(),
  mode: text("mode").notNull(),
  status: text("status").notNull().default("started"),
  requestPayloadRedactedJson: jsonb("request_payload_redacted_json"),
  responsePayloadRedactedJson: jsonb("response_payload_redacted_json"),
  errorCode: text("error_code"),
  errorMessage: text("error_message"),
  officialReceiptNumber: text("official_receipt_number"),
  officialReceiptUrl: text("official_receipt_url"),
  screenshotUrl: text("screenshot_url"),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
}, (table) => ({
  intentNumberIdx: uniqueIndex("official_fee_attempts_intent_number_idx").on(
    table.officialFeePaymentIntentId,
    table.attemptNumber,
  ),
  applicationIdx: index("official_fee_attempts_application_idx").on(table.applicationId),
  statusIdx: index("official_fee_attempts_status_idx").on(table.status),
  providerIdx: index("official_fee_attempts_provider_idx").on(table.provider),
  startedIdx: index("official_fee_attempts_started_idx").on(table.startedAt),
}));

export const officialFeeReceipts = pgTable("official_fee_receipts", {
  id: uuid("id").primaryKey().defaultRandom(),
  applicationId: uuid("application_id").notNull(),
  userId: uuid("user_id").notNull(),
  officialFeePaymentIntentId: uuid("official_fee_payment_intent_id"),
  countryCode: text("country_code").notNull(),
  receiptNumber: text("receipt_number"),
  receiptUrl: text("receipt_url"),
  receiptFileUrl: text("receipt_file_url"),
  amount: numeric("amount").notNull(),
  currency: text("currency").notNull(),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  source: text("source"),
  rawReceiptRedactedJson: jsonb("raw_receipt_redacted_json"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  applicationIdx: index("official_fee_receipts_application_idx").on(table.applicationId),
  userIdx: index("official_fee_receipts_user_idx").on(table.userId),
  countryIdx: index("official_fee_receipts_country_idx").on(table.countryCode),
  intentIdx: index("official_fee_receipts_intent_idx").on(table.officialFeePaymentIntentId),
  createdIdx: index("official_fee_receipts_created_idx").on(table.createdAt),
}));

export const officialFeeReconciliationEntries = pgTable("official_fee_reconciliation_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  applicationId: uuid("application_id").notNull(),
  userId: uuid("user_id").notNull(),
  officialFeePaymentIntentId: uuid("official_fee_payment_intent_id"),
  userPaymentId: uuid("user_payment_id"),
  officialFeeAmount: numeric("official_fee_amount").notNull(),
  officialFeeCurrency: text("official_fee_currency").notNull(),
  userCollectedAmount: numeric("user_collected_amount"),
  userCollectedCurrency: text("user_collected_currency"),
  fxRate: numeric("fx_rate"),
  balanceDelta: numeric("balance_delta"),
  reconciliationStatus: text("reconciliation_status").notNull().default("pending"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  applicationIdx: index("official_fee_reconciliation_application_idx").on(table.applicationId),
  userIdx: index("official_fee_reconciliation_user_idx").on(table.userId),
  statusIdx: index("official_fee_reconciliation_status_idx").on(table.reconciliationStatus),
  intentIdx: index("official_fee_reconciliation_intent_idx").on(table.officialFeePaymentIntentId),
  createdIdx: index("official_fee_reconciliation_created_idx").on(table.createdAt),
}));

export const appointmentAccounts = pgTable("appointment_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  applicationId: uuid("application_id"),
  countryCode: text("country_code").notNull().default("US"),
  portal: text("portal").notNull(),
  accountEmail: text("account_email"),
  encryptedAccountPassword: text("encrypted_account_password"),
  passwordVaultRef: text("password_vault_ref"),
  accountStatus: text("account_status").notNull().default("not_created"),
  emailVerified: boolean("email_verified").default(false),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  metadataRedactedJson: jsonb("metadata_redacted_json").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  userIdx: index("appointment_accounts_user_idx").on(table.userId),
  applicationIdx: index("appointment_accounts_application_idx").on(table.applicationId),
  statusIdx: index("appointment_accounts_status_idx").on(table.accountStatus),
}));

export const appointmentAssistanceJobs = pgTable("appointment_assistance_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  applicationId: uuid("application_id").notNull(),
  userId: uuid("user_id").notNull(),
  appointmentAccountId: uuid("appointment_account_id"),
  countryCode: text("country_code").notNull().default("US"),
  visaType: text("visa_type").notNull().default("B1/B2"),
  ds160ConfirmationCode: text("ds160_confirmation_code"),
  applyingCountryCode: text("applying_country_code"),
  applyingPostCity: text("applying_post_city"),
  schedulingProvider: text("scheduling_provider"),
  status: text("status").notNull().default("appointment_not_started"),
  mode: text("mode").notNull().default("dry_run"),
  userPreferencesJson: jsonb("user_preferences_json").notNull().default({}),
  requiresUserAction: boolean("requires_user_action").default(false),
  currentManualAction: text("current_manual_action"),
  lastErrorCode: text("last_error_code"),
  lastErrorMessage: text("last_error_message"),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  applicationIdx: index("appointment_assistance_jobs_application_idx").on(table.applicationId),
  userIdx: index("appointment_assistance_jobs_user_idx").on(table.userId),
  statusIdx: index("appointment_assistance_jobs_status_idx").on(table.status),
  providerIdx: index("appointment_assistance_jobs_provider_idx").on(table.schedulingProvider),
  idempotencyIdx: index("appointment_assistance_jobs_idempotency_idx").on(table.idempotencyKey),
}));

export const appointmentAssistanceAttempts = pgTable("appointment_assistance_attempts", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobId: uuid("job_id"),
  applicationId: uuid("application_id").notNull(),
  attemptNumber: integer("attempt_number").notNull(),
  status: text("status").notNull(),
  provider: text("provider"),
  mode: text("mode").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  requestSnapshotRedactedJson: jsonb("request_snapshot_redacted_json"),
  resultSnapshotRedactedJson: jsonb("result_snapshot_redacted_json"),
  errorCode: text("error_code"),
  errorMessage: text("error_message"),
  screenshotUrl: text("screenshot_url"),
  traceUrl: text("trace_url"),
  videoUrl: text("video_url"),
}, (table) => ({
  jobNumberIdx: uniqueIndex("appointment_attempts_job_number_idx").on(table.jobId, table.attemptNumber),
  applicationIdx: index("appointment_attempts_application_idx").on(table.applicationId),
  statusIdx: index("appointment_attempts_status_idx").on(table.status),
}));

export const appointmentManualActions = pgTable("appointment_manual_actions", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobId: uuid("job_id"),
  applicationId: uuid("application_id").notNull(),
  userId: uuid("user_id").notNull(),
  actionType: text("action_type").notNull(),
  status: text("status").notNull().default("pending"),
  instruction: text("instruction"),
  userInputSchemaJson: jsonb("user_input_schema_json"),
  userInputRedactedJson: jsonb("user_input_redacted_json"),
  screenshotUrl: text("screenshot_url"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  metadataRedactedJson: jsonb("metadata_redacted_json"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  jobIdx: index("appointment_manual_actions_job_idx").on(table.jobId),
  statusIdx: index("appointment_manual_actions_status_idx").on(table.status),
  applicationIdx: index("appointment_manual_actions_application_idx").on(table.applicationId),
  typeIdx: index("appointment_manual_actions_type_idx").on(table.actionType),
}));

export const appointmentSlots = pgTable("appointment_slots", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobId: uuid("job_id"),
  applicationId: uuid("application_id").notNull(),
  appointmentDate: date("appointment_date"),
  appointmentTime: text("appointment_time"),
  appointmentLocation: text("appointment_location"),
  appointmentType: text("appointment_type"),
  source: text("source"),
  status: text("status").notNull().default("observed"),
  observedAt: timestamp("observed_at", { withTimezone: true }).defaultNow(),
  metadataRedactedJson: jsonb("metadata_redacted_json"),
}, (table) => ({
  jobIdx: index("appointment_slots_job_idx").on(table.jobId),
  observedAtIdx: index("appointment_slots_observed_at_idx").on(table.observedAt),
  applicationIdx: index("appointment_slots_application_idx").on(table.applicationId),
  statusIdx: index("appointment_slots_status_idx").on(table.status),
}));

export const appointmentConfirmations = pgTable("appointment_confirmations", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobId: uuid("job_id"),
  applicationId: uuid("application_id").notNull(),
  userId: uuid("user_id").notNull(),
  countryCode: text("country_code").notNull().default("US"),
  visaType: text("visa_type").notNull().default("B1/B2"),
  appointmentDate: date("appointment_date"),
  appointmentTime: text("appointment_time"),
  appointmentLocation: text("appointment_location"),
  appointmentType: text("appointment_type"),
  confirmationNumber: text("confirmation_number"),
  confirmationPdfUrl: text("confirmation_pdf_url"),
  confirmationScreenshotUrl: text("confirmation_screenshot_url"),
  rawConfirmationRedactedJson: jsonb("raw_confirmation_redacted_json"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  applicationIdx: index("appointment_confirmations_application_idx").on(table.applicationId),
  jobIdx: index("appointment_confirmations_job_idx").on(table.jobId),
  userIdx: index("appointment_confirmations_user_idx").on(table.userId),
}));

export const appointmentStatusChecks = pgTable("appointment_status_checks", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobId: uuid("job_id"),
  applicationId: uuid("application_id").notNull(),
  userId: uuid("user_id").notNull(),
  status: text("status").notNull(),
  checkedAt: timestamp("checked_at", { withTimezone: true }).defaultNow(),
  resultRedactedJson: jsonb("result_redacted_json"),
  screenshotUrl: text("screenshot_url"),
  errorCode: text("error_code"),
  errorMessage: text("error_message"),
}, (table) => ({
  jobIdx: index("appointment_status_checks_job_idx").on(table.jobId),
  applicationIdx: index("appointment_status_checks_application_idx").on(table.applicationId),
  userCheckedIdx: index("appointment_status_checks_user_checked_idx").on(table.userId, table.checkedAt),
}));

export const appointmentAuditEvents = pgTable("appointment_audit_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobId: uuid("job_id"),
  applicationId: uuid("application_id"),
  userId: uuid("user_id"),
  eventType: text("event_type").notNull(),
  eventMessage: text("event_message"),
  metadataRedactedJson: jsonb("metadata_redacted_json"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  jobIdx: index("appointment_audit_events_job_idx").on(table.jobId),
  applicationIdx: index("appointment_audit_events_application_idx").on(table.applicationId),
  userIdx: index("appointment_audit_events_user_idx").on(table.userId),
  typeIdx: index("appointment_audit_events_type_idx").on(table.eventType),
  createdIdx: index("appointment_audit_events_created_idx").on(table.createdAt),
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
export type OfficialFeeQuote = typeof officialFeeQuotes.$inferSelect;
export type NewOfficialFeeQuote = typeof officialFeeQuotes.$inferInsert;
export type PaymentInstrument = typeof paymentInstruments.$inferSelect;
export type NewPaymentInstrument = typeof paymentInstruments.$inferInsert;
export type OfficialFeePaymentIntent = typeof officialFeePaymentIntents.$inferSelect;
export type NewOfficialFeePaymentIntent = typeof officialFeePaymentIntents.$inferInsert;
export type OfficialFeePaymentAttempt = typeof officialFeePaymentAttempts.$inferSelect;
export type NewOfficialFeePaymentAttempt = typeof officialFeePaymentAttempts.$inferInsert;
export type OfficialFeeReceipt = typeof officialFeeReceipts.$inferSelect;
export type NewOfficialFeeReceipt = typeof officialFeeReceipts.$inferInsert;
export type OfficialFeeReconciliationEntry =
  typeof officialFeeReconciliationEntries.$inferSelect;
export type NewOfficialFeeReconciliationEntry =
  typeof officialFeeReconciliationEntries.$inferInsert;
export type AppointmentAccount = typeof appointmentAccounts.$inferSelect;
export type NewAppointmentAccount = typeof appointmentAccounts.$inferInsert;
export type AppointmentAssistanceJob = typeof appointmentAssistanceJobs.$inferSelect;
export type NewAppointmentAssistanceJob = typeof appointmentAssistanceJobs.$inferInsert;
export type AppointmentAssistanceAttempt = typeof appointmentAssistanceAttempts.$inferSelect;
export type NewAppointmentAssistanceAttempt = typeof appointmentAssistanceAttempts.$inferInsert;
export type AppointmentManualAction = typeof appointmentManualActions.$inferSelect;
export type NewAppointmentManualAction = typeof appointmentManualActions.$inferInsert;
export type AppointmentSlot = typeof appointmentSlots.$inferSelect;
export type NewAppointmentSlot = typeof appointmentSlots.$inferInsert;
export type AppointmentConfirmation = typeof appointmentConfirmations.$inferSelect;
export type NewAppointmentConfirmation = typeof appointmentConfirmations.$inferInsert;
export type AppointmentStatusCheck = typeof appointmentStatusChecks.$inferSelect;
export type NewAppointmentStatusCheck = typeof appointmentStatusChecks.$inferInsert;
export type AppointmentAuditEvent = typeof appointmentAuditEvents.$inferSelect;
export type NewAppointmentAuditEvent = typeof appointmentAuditEvents.$inferInsert;
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

// =============================================================================
// NOTIFICATION DLQ (NOTIFY-003)
// =============================================================================

export const notificationDlq = pgTable("notification_dlq", {
  id: uuid("id").primaryKey().defaultRandom(),
  sourceEventId: integer("source_event_id"),
  applicantId: uuid("applicant_id"),
  applicationId: uuid("application_id"),
  templateKey: text("template_key").notNull(),
  channel: text("channel").notNull(),
  recipient: text("recipient"),
  payload: jsonb("payload"),
  error: text("error").notNull(),
  retryCount: integer("retry_count").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  replayedAt: timestamp("replayed_at", { withTimezone: true }),
});

export type NotificationDlq = typeof notificationDlq.$inferSelect;
export type NewNotificationDlq = typeof notificationDlq.$inferInsert;

// =============================================================================
// APPLICATION STATUS HISTORY (STATUS-002)
// =============================================================================

export const applicationStatusHistory = pgTable("application_status_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  applicationId: uuid("application_id").notNull(),
  fromStatus: text("from_status"),
  toStatus: text("to_status").notNull(),
  actorId: uuid("actor_id"),
  actorKind: text("actor_kind").notNull().default("system"),
  reason: text("reason"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export type ApplicationStatusHistory = typeof applicationStatusHistory.$inferSelect;
export type NewApplicationStatusHistory = typeof applicationStatusHistory.$inferInsert;

// =============================================================================
// SUPPORT TICKETS + MESSAGES (SUPPORT-001 / SUPPORT-002)
// =============================================================================

export const supportTicket = pgTable("support_ticket", {
  id: uuid("id").primaryKey().defaultRandom(),
  applicantId: uuid("applicant_id").notNull(),
  applicationId: uuid("application_id"),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  status: text("status").notNull().default("open"),
  assignedTo: uuid("assigned_to"),
  firstResponseAt: timestamp("first_response_at", { withTimezone: true }),
  slaDueAt: timestamp("sla_due_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const supportMacro = pgTable("support_macro", {
  id: uuid("id").primaryKey().defaultRandom(),
  country: text("country").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  locale: text("locale").notNull().default("en"),
  isActive: boolean("is_active").notNull().default(true),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export type SupportMacro = typeof supportMacro.$inferSelect;
export type NewSupportMacro = typeof supportMacro.$inferInsert;

export const supportInternalNote = pgTable("support_internal_note", {
  id: uuid("id").primaryKey().defaultRandom(),
  ticketId: uuid("ticket_id").notNull(),
  authorId: uuid("author_id").notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export type SupportInternalNote = typeof supportInternalNote.$inferSelect;
export type NewSupportInternalNote = typeof supportInternalNote.$inferInsert;

// =============================================================================
// STRIPE IDENTITY (PRODUCT-007)
// =============================================================================

export const stripeIdentitySession = pgTable("stripe_identity_session", {
  id: uuid("id").primaryKey().defaultRandom(),
  applicantId: uuid("applicant_id").notNull(),
  applicationId: uuid("application_id").notNull(),
  sessionId: text("session_id").notNull().unique(),
  status: text("status").notNull().default("requires_input"),
  lastErrorCode: text("last_error_code"),
  lastReportId: text("last_report_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export type StripeIdentitySession = typeof stripeIdentitySession.$inferSelect;
export type NewStripeIdentitySession = typeof stripeIdentitySession.$inferInsert;

// =============================================================================
// STORAGE BACKUP LOG (OBS-004)
// =============================================================================

export const storageBackupLog = pgTable("storage_backup_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  bucket: text("bucket").notNull(),
  target: text("target").notNull(),
  status: text("status").notNull(),
  bytes: integer("bytes"),
  objectCount: integer("object_count"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  error: text("error"),
  isDrill: boolean("is_drill").notNull().default(false),
});

export type StorageBackupLog = typeof storageBackupLog.$inferSelect;
export type NewStorageBackupLog = typeof storageBackupLog.$inferInsert;

export type SupportTicket = typeof supportTicket.$inferSelect;
export type NewSupportTicket = typeof supportTicket.$inferInsert;

export const supportMessage = pgTable("support_message", {
  id: uuid("id").primaryKey().defaultRandom(),
  ticketId: uuid("ticket_id").notNull(),
  authorKind: text("author_kind").notNull(),
  authorId: uuid("author_id"),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export type SupportMessage = typeof supportMessage.$inferSelect;
export type NewSupportMessage = typeof supportMessage.$inferInsert;

// =============================================================================
// PROXY POOL (ANTIBOT-003)
// =============================================================================

export const proxyPool = pgTable("proxy_pool", {
  id: uuid("id").primaryKey().defaultRandom(),
  ip: text("ip").notNull(),
  region: text("region"),
  stickySessionId: text("sticky_session_id").notNull().unique(),
  cooledUntil: timestamp("cooled_until", { withTimezone: true }),
  lastChallengeAt: timestamp("last_challenge_at", { withTimezone: true }),
  challengeStreak: integer("challenge_streak").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export type ProxyPool = typeof proxyPool.$inferSelect;
export type NewProxyPool = typeof proxyPool.$inferInsert;

// =============================================================================
// PACKAGE PRICING (FEES-001 / FEES-002)
// =============================================================================

export const packagePricing = pgTable("package_pricing", {
  id: uuid("id").primaryKey().defaultRandom(),
  visaPackageId: uuid("visa_package_id").notNull(),
  currency: text("currency").notNull().default("USD"),
  governmentFeeCents: integer("government_fee_cents").notNull().default(0),
  agencyFeeCents: integer("agency_fee_cents").notNull().default(0),
  overrideUntil: timestamp("override_until", { withTimezone: true }),
  overrideReason: text("override_reason"),
  overrideBy: uuid("override_by"),
  source: text("source").notNull().default("seed"),
  scrapedAt: timestamp("scraped_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export type PackagePricing = typeof packagePricing.$inferSelect;
export type NewPackagePricing = typeof packagePricing.$inferInsert;

export const packagePricingHistory = pgTable("package_pricing_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  visaPackageId: uuid("visa_package_id").notNull(),
  currency: text("currency").notNull(),
  governmentFeeCents: integer("government_fee_cents").notNull(),
  agencyFeeCents: integer("agency_fee_cents").notNull(),
  source: text("source").notNull(),
  changedBy: uuid("changed_by"),
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export type PackagePricingHistory = typeof packagePricingHistory.$inferSelect;
export type NewPackagePricingHistory = typeof packagePricingHistory.$inferInsert;

// =============================================================================
// REFUND REQUESTS (PRODUCT-001)
// =============================================================================

export const refundRequest = pgTable("refund_request", {
  id: uuid("id").primaryKey().defaultRandom(),
  applicantId: uuid("applicant_id").notNull(),
  applicationId: uuid("application_id").notNull(),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  amountCents: integer("amount_cents").notNull(),
  currency: text("currency").notNull().default("USD"),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("requested"),
  staffNote: text("staff_note"),
  decidedBy: uuid("decided_by"),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  stripeRefundId: text("stripe_refund_id"),
  stripeDisputeId: text("stripe_dispute_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export type RefundRequest = typeof refundRequest.$inferSelect;
export type NewRefundRequest = typeof refundRequest.$inferInsert;

// =============================================================================
// APPLICATION GROUP (PRODUCT-002)
// =============================================================================

export const applicationGroup = pgTable("application_group", {
  id: uuid("id").primaryKey().defaultRandom(),
  payerUserId: uuid("payer_user_id").notNull(),
  visaPackageId: uuid("visa_package_id").notNull(),
  label: text("label"),
  stripeCheckoutSessionId: text("stripe_checkout_session_id"),
  totalAmountCents: integer("total_amount_cents"),
  currency: text("currency").notNull().default("USD"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export type ApplicationGroup = typeof applicationGroup.$inferSelect;
export type NewApplicationGroup = typeof applicationGroup.$inferInsert;

