# Agent Backend Migrations Guide

Scope: this file applies to `viza-be/agent-backend/drizzle/**`.

## Purpose

This directory owns sequential SQL migrations for the agent backend Supabase
database.

## Key Responsibilities

- Keep migration filenames sequentially numbered.
- Make migrations idempotent where practical with `IF NOT EXISTS` and
  `ADD COLUMN IF NOT EXISTS`.
- Update `src/db/schema.ts` when SQL migrations add tables or columns that
  TypeScript code uses.
- Keep service-role-only tables behind RLS unless a clear authenticated policy
  is required.

## Internal Automation Tables

The website automation loop uses:

- `payment_records`
- `invoice_requests`
- `refund_records`
- `consent_events`
- `application_signatures`
- `document_requirements`
- `application_packets`
- `application_events`
- `notification_events`
- `ocr_extractions`
- `data_privacy_requests`
- `coverage_matrix`
- `government_fee_rules`
- `pii_retention_jobs`

The current internal automation migrations are:

- `0013_internal_automation_loop.sql`: first website automation tables and
  application/application document columns.
- `0014_internal_automation_db_refinements.sql`: coverage matrix,
  government-fee rules, retention jobs, data-rights columns, and lookup
  indexes.
- `0087_application_documents_bucket.sql`: private
  `application-documents` Storage bucket and user-prefix object policies.
- `0088_travel_destination_index.sql`: Travel AI destination index, aliases,
  lazy cards, itinerary session archive, and unresolved destination queue.
- `0089_official_fee_payment.sql`: official visa fee quote, consent-linked
  intent, attempt, receipt, instrument abstraction, reconciliation, and
  application-level official-fee status columns.
- `0090_applicant_profile_bilingual_fields.sql`: applicant profile Chinese and
  English value columns used by bilingual filling UI.
- `0091_us_appointment_assistant.sql`: U.S. appointment assistant tables,
  application-level appointment columns, RLS, service-role policies, and
  lookup indexes.
- `0092_travel_local_first_enrichment.sql`: local-first Travel destination
  localization fields, attraction/assets tables, destination-card source
  metadata, and enrichment job/event history.
- `0093_ds160_live_assisted_controls.sql`: DS-160 live assisted queue/job,
  encrypted official retrieval fields, review snapshot/diff tables, and manual
  checkpoint tables. Dry-run remains the default and final applicant
  Sign/Submit remains outside automation.
- `0123_viza_knowledge_releases_and_chat_memory.sql`: versioned RAG releases,
  structured entry rules, durable per-session VIZA memory, and redacted agent
  diagnostics.
- `0124_travel_agent_conversation_state.sql`: server-owned Travel Agent state,
  optimistic versions, idempotent messages, OpenAI response continuity, and
  opt-in cross-session preferences.
- `0130_universal_profile_answers.sql`: service-only field-keyed reusable
  applicant facts synced explicitly from completed country forms and reused as
  non-overwriting autofill in future applications.
- `0094_vn_evisa_documents_and_labels.sql`: Vietnam e-Visa package document
  requirements and bilingual label metadata so the app uses official materials
  instead of generic fallback requirements.
- `0095_france_live_assisted_controls.sql`: France-Visas live assisted queue
  fields and manual checkpoint table. Dry-run remains default and final
  validation, payment, and appointment booking remain applicant-controlled.
- `0096_vietnam_live_assisted_controls.sql`: Vietnam e-Visa live-assisted
  queue stage/heartbeat fields, encrypted registration-code storage, and manual
  checkpoint table. CAPTCHA, payment, and final submit remain manual.
- `0097_ds160_live_queue_compat.sql`: DS-160 queue-level confirmation URL
  fields and a compatibility live-session table for encrypted official
  identifiers. CAPTCHA and final Sign/Submit remain manual.
- `0098_sg_arrival_card_package.sql`: Singapore SG Arrival Card package catalog
  row. It is separate from Singapore Visit Visa / SAVE.
- `0099_vietnam_payment_status_tracking.sql`: Vietnam official-fee queue links
  and redacted official status check history for applicant status refreshes.
- `0100_mdac_tdac_arrival_card_packages.sql`: Malaysia MDAC and Thailand TDAC
  package catalog rows. They are separate from eVisa/tourist visa workflows.
- `0151_kr_e_arrival_card.sql`: Korea e-Arrival Card package/catalog metadata,
  official-free fee rows, and the sequential shared-runner tuple/cancellation
  compatibility patch for `south_korea + kr_arrival_card`.
- `0152_repair_arrival_card_product_country_identity.sql`: repairs legacy
  dedicated arrival-card rows whose stored country conflicts with their product
  code, archives colliding in-flight drafts, and adds the database invariant
  that prevents another cross-country product identity. Its catalog-backed
  trigger also enforces exact linked-package identity and the canonical country
  for every product offered by exactly one country.
- `0153_france_appointment_slot_expiry.sql`: adds the ten-minute expiry
  contract and job/status/expiry lookup indexes for observed France TLS slots.
- `0154_japan_vjw_kenya_eta_products.sql`: installs the separate
  `JP_VISIT_JAPAN_WEB` arrival-declaration and `KE_ETA` travel-authorisation
  catalog rows, baseline official-fee metadata, and package-owned document
  requirements. Japan remains paper-form compatible and its delegated live
  automation is explicitly gated pending Digital Agency authorization; Kenya
  eTA is the only first-phase delegated online authorisation.
- `0155_application_inbox_aliases.sql`: adds the service-role-only,
  application-scoped alias table used by unattended portal runners so OTP and
  approval mail remain isolated between applications.
- `0157_jp_vjw_compliance_approval.sql`: records the operator-approved VJW
  compliance decision in package and fee-rule metadata while leaving runtime
  and applicant final-submission gates fail-closed.
- `0158_database_access_baseline.sql`: establishes deny-by-default future
  public-schema privileges for the `postgres` application migration owner and
  requires postflight findings for unsafe defaults owned by platform roles,
  restores the typed application-translation table
  with authenticated ownership RLS, restricts encrypted/runner/takeover state
  to service role, enables own-row RLS on `users`, switches
  `runner_queue_depth` to security-invoker, and removes the confirmed
  SECURITY DEFINER search-path/execute exposure without changing RPC identity.
- `0159_database_performance_indexes.sql`: creates three evidence-backed online
  indexes for application-scoped submission lookups and the confirmed
  `visa_chunks.document_id` / `pii_access_log.application_id` foreign-key scan
  gaps. It must run only through the non-transactional concurrent-index batch
  executor and never removes an existing index.
- `0160_agent_backend_role_timeouts.sql`: sets the `postgres` runtime role's
  `statement_timeout` and `idle_in_transaction_session_timeout` defaults to 30
  seconds. Apply it before deploying the fail-closed agent-backend runtime;
  postflight must verify the exact `pg_roles.rolconfig` entries and three new
  connections after the application/pooler connection lifecycle is recycled.
  The migration never terminates sessions or restarts PostgreSQL.
- `0161_kr_e_arrival_official_field_contract.sql`: replaces Korea e-Arrival
  combined/free-text transport and address controls with official A/S mode
  codes, mode-specific flight/ship fields, and one address-lookup record that
  derives the Korean address, English address, and five-digit ZIP together.
- `0169_jp_vjw_no_document_uploads.sql`: removes the legacy Japan VJW
  preparation-only document checklist. VIZA collects VJW traveller, trip,
  immigration, and customs answers directly; Kenya eTA uploads are unchanged.
- `0172_enable_jp_ke_shared_runner_flows.sql`: adds the exact `japan/jp_vjw`
  and `kenya/ke_eta` tuples to the on-demand shared runner enqueue, claim,
  recovery, requeue, concurrency-cap, and scale-to-zero database fences.
- `0176_inbound_email_acl.sql`: removes anonymous and signed-in mutation
  privileges from `inbound_email` after the website's Supabase and legacy VIZA
  sessions moved behind an explicit active-alias ownership check. Authenticated
  callers retain policy-scoped SELECT and service-role workers retain full
  access; rows, policies, and RLS state are unchanged.
- `0177_audit_log_rls_initplan.sql`: preserves the two applicant-owned SELECT
  policies on credential and PII audit logs while
  evaluating the authenticated user identity once per statement. It changes no
  rows, relation privileges, policy identities, or service-role behavior; keep
  its Supabase migration mirror byte-identical.
- `0178_account_action_log_rls_initplan.sql`: preserves both the direct user-id
  and applicant-profile ownership paths of the account-action audit-log SELECT
  policy while evaluating each authenticated-user lookup once per statement.
  The migration captures and rechecks the policy OID and raw relation ACL in
  the same transaction so identity or privilege drift aborts the batch.
  Keep its Supabase migration mirror byte-identical; `consent_event` is not part
  of this migration.
- `0179_jp_vjw_official_accommodation_fields.sql`: adds the official VJW
  prefecture and city/ward/town inputs and enforces the observed 10-15 digit
  Japan accommodation contact-number contract in the DB-driven form schema.
- `0180_consent_event_rls_initplan.sql`: reconciles the historical Drizzle and
  website-only consent policy definitions against the metadata-only production
  catalog, preserves production's direct user-id plus applicant-profile
  ownership paths, and evaluates each authenticated-user lookup once per
  statement. It captures and rechecks the policy OID, normalized policy hashes,
  and raw relation ACL in the same transaction; keep its Supabase mirror
  byte-identical.
- `0181_applicant_single_path_rls_initplan.sql`: preserves the four
  production-confirmed single-path ownership policies on `applicant_secret`,
  `notification_preferences`, and `staff_chat_thread` while evaluating the
  authenticated user identity once per statement. It keeps policy OIDs,
  commands, PUBLIC roles, policy counts, RLS state, and relation ACLs unchanged;
  keep its Supabase mirror byte-identical.
- `0182_supporting_doc_submission_rls_initplan.sql`: preserves the sole
  supporting-document submission SELECT policy and its two-hop application to
  applicant ownership path while evaluating `auth.uid()` once per statement.
  It keeps policy/relation OIDs, the PUBLIC role, command, policy count, RLS
  state, and relation ACL unchanged; keep its Supabase mirror byte-identical.
- `0183_notification_preferences_policy_dedupe.sql`: removes only the
  redundant permissive SELECT policy after proving its predicate is identical
  to the surviving ALL policy. It pins both pre-policy contracts and preserves
  the surviving policy OID, PUBLIC role, relation identity, ACL, and RLS state;
  keep its Supabase mirror byte-identical.
- `0184_jp_ke_cancel_pending_submission.sql`: extends the application-first,
  null-lease cancellation RPC to Japan VJW and Kenya eTA pending/scheduled
  legacy queue states. Keep its Supabase migration mirror byte-identical.
- `0101_vn_evisa_official_form_parity.sql`: Vietnam e-Visa official portal
  form parity fields, conditional tables, ward/commune metadata hooks, and
  official date/expense/insurance validation rules.
- `0102_vn_evisa_photo_face_rules.sql`: Vietnam e-Visa photo/passport upload
  metadata, 2MB official image limits, face-match hints, and passport expiry
  validity relative to the e-Visa start date.
- `0104_ph_etravel_accounts.sql`: Philippines eTravel/eGovPH official account
  records, reused per applicant before creating a new VIZA inbox-alias account.
- `0095_universal_profile_documents.sql`: reusable Universal Profile passport
  document records, creation-time application profile snapshots, and answer
  source metadata for profile autofill provenance.
- `0105_submission_queue_claim_locks.sql`: legacy `submission_queue` claim
  leases and service-role RPC using `FOR UPDATE SKIP LOCKED` for horizontally
  scaled submission-service workers.
- `0107_indonesia_official_evisa_packages.sql`: Indonesia C1 and B1 official
  eVisa package catalog rows and provider metadata.
- `0108_indonesia_b1_evoa_document_requirements.sql`: Indonesia B1 e-VoA
  official document checklist, replacing the generic proof-of-funds fallback
  with passport/photo, return-or-onward ticket, and passport-validity support
  materials.
- `0109_taiwan_overseas_cn_tourism_entry_permit.sql`: Taiwan package catalog
  and official document requirements for mainland Chinese passport holders
  resident in Singapore; keep it separate from Taiwan arrival-card concepts.
- `0111_vietnam_evisa_status_tracking_delivery.sql`: service-only Vietnam
  tracking rows, idempotent daily queueing, atomic claims, email/user audit
  fields, and private official-PDF delivery pointers.
- `0112_inbound_email_alias_forwarding.sql`: delivery and retry state for
  forwarding VIZA alias inbox messages, including official OTP, QR, and PDF
  correspondence, to the applicant's real profile email.
- `0114_appointment_slot_check_timestamp.sql`: last official appointment-slot
  observation timestamp used by France appointment cooldown and recovery state.
- `0115_france_tls_applicant_profile_parity.sql`: adds the TLScontact China
  origin-departure date and French-overseas-territory questions to the France
  Schengen review form before the cloud runner opens the official profile.
- `0116_vietnam_cloud_only_queue_claim.sql`: introduces the dedicated,
  service-role-only claim RPC for `vn_cloud_live_pending`, keeping Vietnam
  e-Visa production jobs invisible to older local queue consumers.
- `0117_vietnam_prearrival_queue_claim.sql`: adds Vietnam Pre-Arrival dry-run,
  scheduled, and live pending states to the atomic legacy queue claim RPC so
  cloud workers do not depend on the unlocked compatibility fallback.
- `0118_official_fee_queue_isolation.sql`: serializes Vietnam/Indonesia
  official-fee enqueue operations per application, supersedes stale work and
  manual checkpoints, and enforces one active payment browser job per
  application/provider.
- `0119_submission_retry_queue_isolation.sql`: makes generic retry enqueue a
  per-application transaction, reuses an already-active job, expires stale
  checkpoints, and enforces one active submission job per application.
- `0120_vn_evisa_strict_validity_range.sql`: requires the Vietnam e-Visa
  validity end date to be at least one calendar day after its start date,
  matching the official portal's strict date-order validation.
- `0121_ds160_consular_post.sql`: adds the required CEAC China issuing-post
  selector to the DS-160 form using the live official location codes.
- `0125_backfill_account_alias_forwarding_consent.sql`: promotes accepted
  application-alias forwarding consent into the canonical consent event used
  by queue and email-worker authorization checks.
- `0126_sgac_country_runner_retry.sql`: adds the SGAC country-runner retry RPC
  and compatibility mapping for queued runner jobs.
- `0127_runner_pool.sql`: adds typed six-country `runner_job` scheduling,
  service-role-only atomic enqueue/claim RPCs, country concurrency caps, ten
  logical Machine lease slots, sticky-service priority, scheduled availability,
  lease recovery, and the shared-pool depth view.
- `0128_dedupe_visa_packages.sql`: removes the unused duplicate Japan and South
  Korea package rows, preserves referenced canonical rows, and adds a
  case-insensitive country/visa-type uniqueness guard.
- `0129_indonesia_sticky_runner.sql`: migrates queued Indonesia B1/C1 jobs out
  of the generic pool, adds the sticky Indonesia Machine slot/claim RPC,
  excludes Indonesia from legacy and pool claims, and prevents new simplified
  Indonesia `runner_job` inserts.
- `0131_client_bootstrap_concurrency.sql`: adds the service-only first-login
  request table and atomic bootstrap/destination-selection RPCs so client
  navigation does not depend on check-then-insert request chains.
- `0132_reviewed_entry_rules_and_product_recommendations.sql`: adds reviewed
  rule evidence, policy expiry/review metadata, structured product
  recommendations, the `not_applicable` outcome, and the 77-row publication
  gate for the first audited passport matrix.
- `0133_harden_visa_knowledge_promotion.sql`: removes inherited anonymous and
  signed-in execution grants from knowledge promotion and keeps it service-only.
- `0134_form_assistant_sessions.sql`: durable application-scoped Form Filling
  Assistant sessions/messages, idempotency keys, validation state, indexes,
  answer provenance columns, explicit grants, and authenticated ownership RLS
  policies.
- `0135_retire_indonesia_b211a.sql`: retires obsolete Indonesia B211A catalog
  rows without deleting historical records, and changes application/form-field
  defaults to the canonical `ID_C1_TOURIST` product code.
- `0136_form_assistant_required_checkbox_rules.sql`: marks the Philippines
  eTravel privacy declarations and Taiwan permit terms as true-only required
  acknowledgements for consistent form and assistant validation.
- `0137_queue_worker_leases_and_runtime_claims.sql`: adds atomic notification
  claims with conditional ack/nack and DLQ settlement, Vietnam status-check
  worker leases with safe completion/failure RPCs and provider-filtered/
  targeted submission-queue claims.
- `0138_bounded_queue_maintenance.sql`: adds a bounded, service-role-only
  atomic stale-processing cleanup RPC and an index matching its heartbeat/status
  cutoff scan; callers run it as low-frequency maintenance rather than per poll.
- `0149_concurrency_phase_two.sql`: supersedes the global runner-pool advisory
  claim lock with country-cap row serialization, bounded one-row lease recovery,
  and partial indexes for queued ordering, running-country counts, lease
  expiry, and one-live-job-per-worker fencing. The service-role-only
  `claim_runner_pool_job`, `complete_runner_pool_job`, `renew_runner_pool_job`,
  and `fail_runner_pool_job` RPCs are `SECURITY DEFINER`, use an empty
  `search_path`, ignore caller-supplied timestamps in favor of
  `clock_timestamp()`, and grant execution only to `service_role`. Each locks
  the exact owner row, mints a generalized full OLD/NEW-row capability, and
  lets the permanent `BEFORE UPDATE` fence consume only that capability;
  metadata-only writes are the sole direct exception. Recovery is just one
  capability operation among the full-row lifecycle set, not a separate
  expired-row bypass.
  The service-role-only `write_runner_pool_submission_result` RPC locks the
  exact live owner, samples the post-lock database clock, and atomically writes
  the application result while changing application status only for
  `submitted`. The migration also carries the
  `defer_vn_official_status_check` RPC used to return provider-gate-denied
  status checks to the queue without consuming an admission attempt. Phase-two
  admission is restricted to the six canonical country/flow tuples and uses
  application-first locking; queued inserts and requeues are guarded against
  staff-review races, while active reuse requires an exact country/flow match.
  Claim candidate scans exclude staff-review applications, and the queued to
  running trigger takes the application mutex with `NOWAIT` before consuming a
  claim capability. Claiming mints and consumes a full old/new-row `claim`
  capability, and a `BEFORE INSERT` guard rejects direct running rows. The
  service-role-only `claim_takeover_session`,
  `cancel_application_submission`, `requeue_runner_job`, and
  `settle_runner_job_takeover` RPCs use exact row locks/capabilities. Takeover
  claims are kind-fenced and same-claimant idempotent; settlement requires the
  claimant's `claimed` session, writes only bounded string-valued answer JSON,
  derives the answer count, and atomically updates answers, queue/job,
  application, session, and takeover action-log state. Review pause atomically
  marks the application, pauses active legacy queue rows, and then pauses
  runner jobs under the application-first mutex.
  Apply this as a controlled-drain-only migration: pause enqueue/wakes, drain
  running jobs to zero, stop BASE workers, apply the migration, deploy strict
  RPC callers, smoke test, then resume workers.
  The same migration also installs the private shared claim core and the
  service-role-only `claim_runner_pool_load_test_job` wrapper. Its
  `runner_private.runner_load_test_config` row is owner-only, seeded disabled,
  and must be enabled/disabled out-of-band for an exact staging/local-test
  project; the load harness must never toggle it. Scoped claims require the
  synthetic application/metadata/correlation marker and never scan production
  rows. The global probe takes a private advisory lock, uses an effective
  per-country cap of ten, and counts all canonical running rows while leaving
  `runner_concurrency_cap` unchanged.
- `0150_vn_status_settlement_fence.sql`: replaces Vietnam official-status
  worker leases with a monotonic `BIGINT` lease generation and exact
  generation-bearing service-role RPCs for claim, renew, defer, fail, and
  complete. Settlement locks application, status-check, and tracking rows in
  that order, derives result state and bounded notification payloads, preserves
  legacy artifact paths, and atomically records deterministic full-SHA eVisa
  documents, events, bounded retry rows, and failure backoff. Legacy
  worker-only signatures are removed for the controlled cutover; callers must
  pass the generation returned by claim.
- `0156_concurrency_stable_speed.sql`: adds the service-role-only exact-owner
  machine-slot renewal RPC, queue/capacity health views for the six canonical
  shared-runner tuples and ten logical slots, and bounded non-PII claim/start
  timing samples. It does not change runner caps or slot allocation.
- `0139_dedupe_ongoing_applications.sql`: consolidates duplicate in-flight
  applications and enforces one ongoing row per applicant/country/visa type
  while preserving completed submission history; QA dry-run rows are isolated
  from deduplication and the customer uniqueness gate.
- `0140_prevent_qa_placeholder_submission.sql`: rejects synthetic QA answers on
  ordinary applications, blocks QA-marked data from live runner queues, and
  removes previously persisted QA sentinels from reusable/customer data.
- `0141_block_known_qa_account_sentinel.sql`: patches already-migrated databases
  to reject and remove the historical dedicated-QA WeChat sentinel.
- `0142_managed_card_issuer_router.sql`: permits PhotonPay and Airwallex card
  identities while preserving exact application/allocation/payment-intent
  binding in the service-only issuer-aware card-attempt claim RPC.
- `0143_scrub_uk_submission_result_credentials.sql`: removes legacy UK portal
  URLs, usernames, and password/cipher fields from customer-readable
  `applications.submission_result`; credentials remain only in `uk_accounts`.
- `0144_exclude_qa_drafts_from_ongoing_uniqueness.sql`: rebuilds the ongoing
  application uniqueness index so isolated schema-QA drafts can coexist with
  one real customer application for the same country and visa type.
- `0145_protect_issuer_card_attempt_leases.sql`: prevents a different worker
  from overwriting an unexpired issuer-card claim lease while preserving
  same-worker renewal and expired-lease recovery.
- `0146_vietnam_payment_registration_code_handoff.sql`: carries an existing
  encrypted Vietnam registration code into the next isolated payment queue row
  for the same application/provider without exposing the code in RPC payloads.
- `0147_uk_passport_upload_document_slot.sql`: maps the UK passport upload to
  the `passport_bio_page` application-document slot so it cannot be treated as
  an ordinary file-path answer.
- `0148_five_tourist_country_packages_and_documents.sql`: corrects the Canada,
  Türkiye, India, Saudi Arabia, and UAE tourist-product catalog boundaries and
  installs their audited Document Center requirements outside the answer
  schema.
- `0162_uae_tourist_document_contract.sql`: corrects the installed ICP
  transaction-783 checklist after live service-card verification: exact bank
  and UAE insurance review traits, optional identity evidence, and
  accommodation evidence requested only by the authenticated form.
- `0150_public_status_tracking.sql`: turns the latest-only portal canary row
  into an evidence-backed public status model with append-only observations,
  incidents, bilingual labels, and service-only RPCs.
- `0163_enable_five_tourist_runner_claims.sql`: routes Canada, Turkiye, India,
  Saudi Arabia, and UAE jobs through the retained on-demand shared pool while
  preserving per-country limits, slot-bound claims, lease recovery, and
  scale-to-zero depth accounting.
- `0164_application_document_review_integrity.sql`: prevents applicants from
  manufacturing privileged document-review fields or reviewed statuses.
  Applicant writes may only use clear `uploaded`/`missing` owner states, and
  legacy `validated`, `accepted`, `approved`, `verified`, or `ready` rows are
  reset for staff re-review without resurrecting rejected or deleted files.
- `0165_runner_needs_human_settlement.sql`: extends the exact live-owner
  failure RPC so applicant/operator checkpoints settle as terminal
  `needs_human` without consuming a retry or weakening the worker lease fence.
- `0166_kr_e_arrival_transport_visibility.sql`: repairs the installed Korea
  e-Arrival Card flight/ship visibility expressions to use the bare official
  A/S option codes understood by the DB-driven form evaluator.
- `0167_database_function_execution_baseline.sql`: fixes the namespace lookup
  path for nine legacy SECURITY INVOKER helpers without replacing their bodies
  or identities. Retention/purge helpers become service-role-only;
  `match_visa_chunks` remains available only to authenticated and service-role
  callers, while the harmless ISO-week helper retains its existing execution
  policy. Keep its Supabase migration mirror byte-identical.
- `0168_core_rls_initplan.sql`: preserves the identities and ownership
  semantics of the eleven audited applicant/application/document/queue RLS
  policies while evaluating the authenticated user identity once per statement.
  Keep its Supabase migration mirror byte-identical.
- `0170_chat_rls_initplan.sql`: preserves nine authenticated chat and Travel AI
  ownership policies while evaluating the caller identity once per statement;
  the separate service-role chat policy remains untouched. Keep its Supabase
  migration mirror byte-identical.
- `0171_user_packages_rls_initplan.sql`: preserves the single authenticated
  user-package SELECT policy while evaluating the caller identity once per
  statement. Keep its Supabase migration mirror byte-identical.
- `0173_notification_signature_rls_initplan.sql`: preserves the two audited
  applicant-owned notification/signature SELECT policies while evaluating the
  caller identity once per statement. Keep its Supabase migration mirror
  byte-identical.
- `0174_inbound_email_rls_initplan.sql`: preserves the applicant inbox SELECT
  policy, including quarantine and retired-alias filtering, while evaluating
  the caller identity once per statement. Service-role mailbox consumers and
  the table ACL remain unchanged; keep its Supabase migration mirror
  byte-identical.
- `0175_expand_runner_result_statuses.sql`: expands the exact-owner shared-pool
  result writer to accept the canonical Japan QR, Kenya approval/rejection,
  and needs-attention/blocked statuses. Keep its Supabase migration mirror
  byte-identical.

## Guardrails

- Do not add final official-site payment/booking/submission automation to this
  automation scope. DS-160 live assisted tables may store audited handoff,
  review-diff, and manual-checkpoint state only.
- U.S. appointment tables may track dry-run/manual checkpoint state only. Keep
  sensitive official-portal credentials, cookies, CAPTCHA answers, MFA codes,
  payment card data, and raw screenshots out of these migrations.
- Do not drop or rewrite existing tables without explicit user approval.
- Do not commit secrets or environment-specific values.

## Validation

Run from `viza-be/agent-backend` when database access is available:

```powershell
npm run db:migrate
npm run type-check
```
