import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

type OwnershipManifest = {
	version: number;
	productionProjectRef: string;
	productionCatalogCapturedAt: string;
	owners: {
		"drizzle-managed": string[];
		"rest-service-only": string[];
		"compatibility-only": string[];
	};
	declaredButNotObserved: string[];
};

const manifestPath = fileURLToPath(new URL("./schema-ownership.manifest.json", import.meta.url));
const schemaPath = fileURLToPath(new URL("./schema.ts", import.meta.url));
const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as OwnershipManifest;
const schemaSource = readFileSync(schemaPath, "utf8");
const productionTables = new Set([
	"_migrations", "account_action_log", "account_recovery_audit", "admin_command_events",
	"admin_work_item_events", "admin_work_items", "alert_throttle", "applicant_browser_profile",
	"applicant_profiles", "applicant_secret", "application_documents", "application_events",
	"application_group", "application_inbox_aliases", "application_packets", "application_signatures",
	"application_status_history", "application_translations", "applications", "appointment_accounts", "appointment_assistance_attempts",
	"appointment_assistance_jobs", "appointment_audit_events", "appointment_confirmations",
	"appointment_manual_actions", "appointment_operation_cases", "appointment_slots",
	"appointment_status_checks", "au_accounts", "catalogue_publication_history", "catalogue_publications",
	"consent_event", "consent_events", "coverage_matrix", "data_privacy_requests", "document_requirements",
	"ds160_live_manual_actions", "ds160_live_sessions", "ds160_official_review_snapshots",
	"ds160_review_diffs", "ds160_submission_jobs", "eg_accounts", "face_match_audit",
	"form_assistant_messages", "form_assistant_sessions", "fv_accounts", "government_fee_allocations",
	"government_fee_rules", "inbound_email", "invoice_requests", "issuer_card_attempts",
	"it_vfs_cn_accounts", "marketing_leads", "notification_dlq", "notification_event_log",
	"notification_events", "notification_preferences", "ocr_extractions", "official_application_tracking",
	"official_fee_payment_attempts", "official_fee_payment_intents", "official_fee_quotes",
	"official_fee_receipts", "official_fee_reconciliation_entries", "official_status_checks", "order",
	"order_line", "package_pricing", "package_pricing_history", "package_sla", "paper_template",
	"payment_dispute_cases", "payment_instruments", "payment_lifecycle_events", "payment_provisioning_jobs",
	"payment_records", "ph_etravel_accounts", "photo_spec", "pii_access_log", "pii_retention_jobs",
	"portal_health", "portal_health_checks", "privacy_execution_jobs", "proxy_pool", "question_field",
	"question_set", "refund_records", "refund_request", "retention_purge_log", "runner_concurrency_cap",
	"runner_concurrency_metric", "runner_job", "runner_machine_slot", "runner_metric", "runner_step_log",
	"secret_access_log", "shared_profile_fields", "signature_event", "staff_chat_message",
	"staff_chat_thread", "status_incidents", "storage_backup_log", "stripe_identity_session",
	"submission_manual_actions", "submission_queue", "submission_review_diffs", "submission_review_snapshots",
	"support_internal_note", "support_macro", "support_message", "support_ticket", "supporting_doc_slot",
	"supporting_doc_submission", "takeover_action_log", "takeover_session", "travel_agent_messages",
	"travel_agent_sessions", "travel_assets", "travel_attractions", "travel_destination_aliases",
	"travel_destination_cards", "travel_destinations", "travel_enrichment_events", "travel_enrichment_jobs",
	"travel_itinerary_sessions", "travel_unresolved_destinations", "travel_user_preferences",
	"treasury_exceptions", "treasury_funding_events", "treasury_payouts", "treasury_reconciliation_runs",
	"uk_accounts", "universal_profile_answers", "universal_profile_documents", "user_chat_sessions",
	"user_form_requests", "user_packages", "users", "vietnam_live_manual_actions",
	"visa_agent_run_diagnostics", "visa_application_answers", "visa_chat_messages", "visa_chat_sessions",
	"visa_chunks", "visa_documents", "visa_entry_rules", "visa_form_fields", "visa_knowledge_releases",
	"visa_packages", "visa_vietnam", "runner_private.runner_job_update_capability",
	"runner_private.runner_load_test_config",
]);

describe("database schema ownership manifest", () => {
	it("assigns every observed production table exactly once", () => {
		const assignments = Object.values(manifest.owners).flat();
		expect(new Set(assignments).size).toBe(assignments.length);
		expect(new Set(assignments)).toEqual(productionTables);
	});

	it("pins the production snapshot identity", () => {
		expect(manifest.version).toBe(1);
		expect(manifest.productionProjectRef).toBe("oyjxdzsoejraedqghndi");
		expect(Number.isNaN(Date.parse(manifest.productionCatalogCapturedAt))).toBe(false);
	});

	it("keeps every drizzle-managed table declared in schema.ts", () => {
		for (const table of manifest.owners["drizzle-managed"]) {
			expect(schemaSource).toContain(`pgTable("${table}"`);
		}
	});

	it("adds typed contracts for directly used service tables", () => {
		for (const table of [
			"runner_concurrency_metric",
			"takeover_session",
			"takeover_action_log",
			"application_inbox_aliases",
			"ds160_live_sessions",
		]) {
			expect(schemaSource).toContain(`pgTable("${table}"`);
		}
	});

	it("tracks schema declarations not observed in the production snapshot", () => {
		const declared = Array.from(schemaSource.matchAll(/pgTable\("([a-z][a-z0-9_]*)"/g), (match) => match[1]);
		const expectedMissing = declared.filter((table) => !productionTables.has(table)).sort();
		expect([...manifest.declaredButNotObserved].sort()).toEqual(expectedMissing);
	});
});
