# Internal Website Agent Guide

`lib/submission-worker-wake.server.ts` centralizes authenticated Fly worker
wake requests; its focused tests live under `lib/__tests__/`.

Scope: this file applies to `viza-fe/internal-website/**`.

Production Vercel Functions are pinned by `vercel.json` to `bom1` (Mumbai),
which is the compute region nearest the production Supabase primary in
`ap-south-1`. Keep database-backed Node.js routes in that region unless the
primary database is deliberately migrated; static assets remain globally
served by Vercel's CDN.

## Purpose

The internal website is the main VIZA portal. It contains the applicant client
portal, admin operations portal, dynamic visa application forms, VIZA AI chat,
Travel AI UI, Supabase auth, and Next.js API proxy routes.

## Key Flows

- Client portal under `app/client/**`.
- Client dashboard country hero artwork under `public/country-heroes/**`, mapped
  to application country slugs by `lib/client/country-hero-theme.ts`.
- Arrival-card preview entries under `app/client/arrival-cards/**`, routed to
  dedicated DB-driven application packages and kept separate from visa packages.
- Admin portal under `app/admin/**`.
- Application lifecycle and dynamic forms under `app/client/application/**`,
  `components/dynamic-step-form.tsx`, `components/dynamic-form-field.tsx`, and
  `components/application-steps/**`.
- Website internal automation client routes under `app/client/status/**`,
  `app/client/documents/**`, `app/client/checkout/**`,
  `app/client/billing/**`, `app/client/consent/**`, and
  `app/client/support/**`.
- Staff monitoring and coverage routes under
  `app/admin/(dashboard)/applications/**`,
  `app/admin/(dashboard)/packages/**`, and
  `app/admin/(dashboard)/billing/**`.
- Website automation server actions under
  `app/actions/internal-automation/**`.
- Payment, uploads, OCR, and external status API boundaries under
  `app/api/stripe/**`, `app/api/payments/**`, `app/api/document-upload/**`,
  `app/api/passport-ocr/**`, `app/api/translations/**`,
  `app/api/translate/**`, and
  `app/api/external-submission/**`.
- Vietnam Pre-Arrival official dropdown lookup is proxied through
  `app/api/vn-prearrival/options/**` (with implementation/test helpers in the
  adjacent non-route `route-handler.ts`); this route may read official category
  options but must not submit declarations or pretend a session-gated official
  list is complete when the portal returns an auth/session error.
  `components/__tests__/dynamic-step-form-vn-prearrival-options.test.ts`
  guards the local country-code dropdown fallback used when the official
  category endpoint is session-gated.
- Vietnam Pre-Arrival E-Visa number guidance uses the official visual reference
  at `public/images/vietnam/evisa-number-help-official.png`; keep its modal
  layout aligned with the official portal while presenting the instructions in
  Chinese.
- Philippines eTravel airline-dependent flight numbers are proxied read-only
  through `app/api/ph-etravel/options/**`; the form stores the exact official
  flight code and reloads options whenever the official airline code changes.
- Indonesia eVisa postal-code preflight is proxied through
  `app/api/indonesia/postal-code/**`. It may only validate and derive the
  province/city/district/village display values; the official eVisa portal
  remains the final authority and portal-side rejection must be surfaced to
  the applicant.
- Applicant upload storage is the private Supabase Storage bucket
  `application-documents`, created by `supabase/migrations/**` with user-id
  path-prefix policies.
- Reusable passport, portrait, and electronic-signature metadata is stored in
  the server-only `universal_profile_documents` table created by
  `supabase/migrations/20260721030018_create_universal_profile_documents.sql`;
  application document requirements may map their country-specific photo and
  signature aliases to these canonical profile materials.
- Application-scoped Form Filling Assistant sessions and persisted text turns
  are stored in `form_assistant_sessions` and `form_assistant_messages` by
  `supabase/migrations/20260806155039_form_assistant_sessions.sql`; raw voice
  recordings are ephemeral and never persisted.
- Expanded reusable applicant facts are stored in the server-only,
  field-keyed `universal_profile_answers` table created by
  `supabase/migrations/20260801193500_create_universal_profile_answers.sql`.
  Review-tab sync is explicit, excludes trip/payment/declaration/secret data,
  and future forms consume it only as non-overwriting prefill.
- Commercial and agency payment records are stored in `payment_records`,
  created by `supabase/migrations/*create_payment_records.sql`.
- Customer support ticket storage for `/client/support` and `/admin/support`
  is created by `supabase/migrations/*create_support_ticket_queue.sql`.
- VIZA AI chat under `app/client/chat/**` and
  `components/client/companion/**`.
- Customer service support center under `app/client/support/**`; keep it
  separate from `/client/chat`.
- U.S. B1/B2 appointment assistant under
  `app/client/applications/[applicationId]/us-appointment/**`,
  `components/client/us-appointment/**`, `lib/us-appointment/**`, and
  `types/us-appointment.ts`. The page reads existing VIZA appointment status on
  load, creates and starts work only from explicit user actions, lets applicants
  use China USVisaScheduling gated assisted-live with VIZA-created appointment
  account credentials, select observed official slots, approve payment/final
  booking, and display confirmation/status snapshots from the DB.
- Japan VFS/JVAC Singapore appointment preparation under
  `app/client/applications/[applicationId]/japan-appointment/**`,
  `components/client/japan-appointment/**`, `lib/japan-vfs-sg.ts`,
  `lib/japan-appointment-client.ts`, and `types/japan-appointment.ts`.
  It is limited to Chinese ordinary-passport holders with a Singapore long-term
  pass that covers their return date, records explicit consent, validates
  stored uploads through the backend, defaults the portrait to the latest
  reusable `universal_profile_documents` photo while allowing replacement,
  and displays Browser API evidence. Slot choice, one-time payment preparation,
  and final booking remain separate explicit user approvals.
- Travel AI under `app/client/travel-chat/**`, `components/client/travel/**`,
  `lib/travel/**`, and `app/api/travel/**`.
- Auth and session protection through `proxy.ts`, `lib/supabase/**`,
  `lib/client-session.ts`, `lib/impersonation-session.ts`, and the production
  admin email allowlist in `lib/admin-access.ts`.
- Supabase client credentials are normalized by `lib/supabase/env.ts` before
  use so BOM or surrounding whitespace from local environment files cannot
  produce invalid HTTP authorization headers.
- User-facing copy through `messages/en.json` and `messages/zh.json`.
- Local admin test-account bootstrap through
  `scripts/init-admin-account.mjs`, with password-reset decisions covered by
  `scripts/init-admin-account-helpers.mjs` and
  `scripts/__tests__/init-admin-account.test.ts`. Existing auth users must keep
  their password unless the CLI is run with both `--reset-password` and
  `--password`.
- Hosted Supabase auth email template sync through
  `scripts/sync-supabase-auth-email-templates.mjs`.
- Travel card coverage audit through
  `scripts/audit-travel-card-coverage.mjs`.
- Travel card coverage enrichment through
  `scripts/enrich-travel-card-coverage.mjs`.
- Travel local-first dropdown destination audit through
  `scripts/audit-travel-dropdown-destinations.ts`.
- Travel dropdown destination database seeding through
  `scripts/seed-dropdown-destinations.ts`.
- Travel local image relevance verification through
  `scripts/verify-travel-image-relevance.ts`.
- Travel natural-language prompt QA through
  `scripts/qa-travel-agent-prompts.ts`.
- Supabase remote schema verification through
  `scripts/verify-supabase-schema.ts`.
- Targeted VIZA-only Supabase migration through
  `scripts/migrate-viza-required.ts`.
- Live-assisted official submission status summaries are loaded through
  `lib/submission-live-status.ts`; keep service-role access server-only and
  expose customer/staff actions through route handlers or server actions.
- Cloud submission worker wake requests use the authenticated
  `app/api/submission-worker/wake/route.ts` boundary and the server-only
  `lib/submission-worker-wake.server.ts` helper. Never expose the internal
  bearer token to client components.
- Shared-pool retry submission resolves a typed flow through
  `lib/queue/flows.ts`, atomically enqueues through `lib/queue/enqueue.ts`, and
  starts only immediately claimable Fly pool capacity through
  `lib/fly-machine-wake.server.ts`. Indonesia B1/C1 instead enqueue to their
  dedicated `submission_queue` states and wake the sticky Indonesia Machine.
  Scheduled arrival-card work must keep its future `available_at` and must not
  wake compute early. Legacy, Indonesia and Korea sticky wake requests reserve
  database Machine slots and may preempt only an idle shared worker.
  Country wizard review-route coverage lives in
  `components/client/wizards/shell/__tests__/review-routing.test.ts`; every
  configured wizard must expose at least one review section and every review
  Edit target must match a declared wizard step key.
  Production Fly app names are selected through `FLY_RUNNER_POOL_APP`,
  `FLY_SUBMISSION_LEGACY_APP`, `FLY_RUNNER_INDONESIA_APP`, and
  `FLY_RUNNER_SOUTH_KOREA_APP`; unset values retain the original app names for
  rollback.
- Local developer recovery for stalled official submission jobs is exposed
  through `app/api/applications/[id]/local-submission-worker/route.ts`; it is
  localhost-only and may only start the repository `viza-be/submission-service`
  worker before the normal retry flow.
- Chinese and English legal article copy for `/terms`, `/privacy`, and
  `/disclaimer` lives in `lib/legal/*-legal-content.ts`; auth footers and
  signup consent link to these routes.
- Internal wrapper for the repo env doctor through `scripts/doctor-env.ts`.
- VIZA-required Supabase migrations under `supabase/migrations/20260610_*`,
  including the generic `submission_manual_actions` bridge for official-site
  checkpoints, and the SQL Editor bundle under
  `supabase/manual/viza_required_schema.sql`.
- Vietnam official-fee payment migrations under
  `supabase/migrations/20260625_official_fee_payment.sql` and
  `supabase/migrations/20260625_vietnam_payment_status_tracking.sql`; these
  create the quote/intent/attempt/receipt tables and queue/status columns used
  by the Vietnam e-Visa payment checkpoint UI and submission-service runner.
- Vietnam and Indonesia official-fee authorize/pay/status routes share
  `app/api/applications/[id]/official-fee/auth.ts`; keep its accepted session
  policy aligned with `/client/*` so signed `client_session` users do not see a
  payment form that then fails a Supabase-only authentication check.
- Vietnam e-Visa trip-expense coverage is made explicitly required by
  `supabase/migrations/20260809105541_vn_evisa_require_expense_coverage.sql`;
  keep the runtime parity patch and submission-service expense preflight in
  sync so the official review action cannot remain disabled after a cloud run.
- Production Indonesia official-fee card handoff uses the bearer-protected Fly
  endpoint configured by `INDONESIA_SUBMISSION_SERVICE_URL` and
  `INDONESIA_CARD_SESSION_INTERNAL_TOKEN`; it must not fall back to localhost.
- Production Vietnam official-fee card handoff uses the bearer-protected Fly
  endpoint configured by `VIETNAM_SUBMISSION_SERVICE_URL` (with
  `SUBMISSION_SERVICE_CLOUD_URL` as a compatibility fallback) and
  `VIETNAM_CARD_SESSION_INTERNAL_TOKEN`; it must not fall back to localhost.
- Local Indonesia payment testing may set
  `INDONESIA_OFFICIAL_FEE_RELAY_URL` to the HTTPS Vercel production origin.
  The local authenticated request is relayed server-to-server so the Fly
  internal token does not need to be stored on the developer workstation.
- Vietnam post-submission tracking and official PDF delivery are defined by
  `supabase/migrations/20260718025937_vietnam_evisa_status_tracking_delivery.sql`,
  mirrored in `supabase/manual/viza_required_schema.sql`, and exposed only by
  ownership-checked status refresh and artifact routes.
- Vietnam official e-Visa form parity migration under
  `supabase/migrations/20260625_vn_evisa_official_form_parity.sql`; it keeps
  the DB-driven VIZA form aligned with official conditional questions, tables,
  date constraints, expense/insurance details, and ward/commune dependencies.
  `lib/vietnam-evisa-form-parity.ts` mirrors the same official parity metadata
  as a runtime safety net when the local database has not applied the migration
  yet; keep it in sync with the migration and avoid duplicating fields.
  `lib/vietnam-evisa-official-countries.ts` is the exact 205-option official
  nationality source used by all four Vietnam e-Visa country fields.
- Vietnam e-Visa strict validity ordering is applied by
  `supabase/migrations/20260728090000_vn_evisa_strict_validity_range.sql`:
  `visa_valid_to` must be at least one calendar day after `visa_valid_from`,
  matching the official portal rather than allowing a same-day interval.
- Active application-form Chinese copy is polished by the
  `20260807224244_polish_active_form_chinese_copy.sql` and
  `20260807230600_polish_arrival_and_visa_form_chinese_copy.sql` migrations,
  with the live Schengen sector field repaired by
  `20260807231500_repair_schengen_health_option_chinese_copy.sql`;
  it updates Chinese labels and option display text only, while preserving
  official English wording, stored values, and submission mappings. Keep it
  aligned with the runtime safety net in `lib/bilingual-schema-contract.ts`.
- The required U.S. DS-160 China issuing-post selector is applied by
  `supabase/migrations/20260729054904_add_ds160_consular_post.sql`; its stored
  values are the live CEAC location codes consumed by submission-service.
- Immediate SG Arrival Card retries use
  `supabase/migrations/20260730170000_sgac_country_runner_retry.sql` and the
  country-scoped `runner_job` transport. Keep future-window scheduled SGAC
  rows in `submission_queue`, preserve the atomic legacy collision check, and
  keep status/cancellation compatible with both transports during migration.
- Vietnam e-Visa photo and face-match rules live in
  `supabase/migrations/20260625_vn_evisa_photo_face_rules.sql`,
  `app/client/documents/actions.ts`, `app/actions/face-match.ts`,
  `app/api/applications/[id]/retry-submission/route.ts`, and
  `lib/face/match.ts`. The official upload gate requires portrait and passport
  data-page images under 2MB with detectable matching faces; use
  `FACE_MATCH_PROVIDER=openai_vision` plus `OPENAI_API_KEY` or
  `FACE_MATCH_OPENAI_API_KEY` for OpenAI vision matching, and tune
  `VN_FACE_MATCH_MIN_SCORE` only with evidence.
- France-Visas generated official account lookup for the applicant result UI
  is exposed server-side through
  `app/api/applications/[id]/france-visas-account/route.ts`; keep credential
  decryption service-role only and never put official account passwords in
  generic polling payloads or logs.

## Source Of Truth

Before client UI changes, read:

1. `viza-fe/internal-website/frontend.md`
2. The nearest route/component `AGENTS.md`
3. Neighboring components in the same feature directory

For product behavior, prefer docs under `docs/` and the current code over stale
comments.

## Ownership Boundaries

- Route orchestration belongs in `app/**/page.tsx` or route handlers.
- Reusable UI belongs in `components/**`.
- Server mutations belong in `app/actions/**` unless a real HTTP boundary is
  needed.
- Shared browser/server helpers belong in `lib/**`.
- User-facing filling/editing UI must align with the application form controls:
  reuse `components/application-steps/bilingual-form-shared.tsx`,
  `components/dynamic-form-field.tsx`, or canonical client form primitives for
  dates, countries, options, and text fields instead of adding one-off inputs.
- Keep `components/ui/**` as shadcn-style primitives; do not hide feature logic
  there.
- Do not expose service-role Supabase keys in client components.
- Do not implement official portal submission runners, CAPTCHA/proxy/browser
  fingerprint code, background slot polling, or real official-site payment
  inside website internal automation modules. The U.S. appointment assistant may
  call the gated submission-service China USVisaScheduling runner only from
  explicit user actions and must keep slot choice plus payment/final booking
  approval explicit in VIZA. Supported login/CAPTCHA/MFA/email/policy
  checkpoints belong in the gated runner with redacted official evidence and
  manual-required fallback.
- Korea C-3-9 official e-Form/KVAC flow lives under
  `app/api/applications/[id]/korea-official-eform/**`,
  `app/api/applications/[id]/kr-annex17-pdf/**`,
  `app/api/applications/[id]/korea-appointment/**`,
  `app/api/korea-addresses/**`,
  `app/client/applications/[applicationId]/korea-appointment/**`,
  `components/client/korea-appointment/**`, and `lib/korea-c39/**`.
  It prioritizes Korea Visa Portal barcode e-Form generation/download, keeps
  the printable Annex-17 packet as a fallback, resolves the recommended China
  KVAC center, and keeps cancellation/rebooking state transitions in
  `lib/korea-c39/appointment-rebooking.ts` while preserving old confirmations
  as history. Real KVAC portal booking must remain gated behind the
  submission-service runner and explicit user-selected slot.

## Validation

Run from this directory:

```powershell
npm run type-check
npm run lint
npm run test
```

For focused tests, use `npx vitest run <path> --testTimeout=15000`.

Smoke URLs:

- `/client/home`
- `/client/application`
- `/client/application?country=indonesia&visaType=B211A`
- `/client/status`
- `/client/documents`
- `/client/checkout`
- `/client/billing`
- `/client/consent`
- `/client/chat`
- `/client/support`
- `/client/travel-chat`
- `/admin`
- `/admin/applications`
- `/admin/packages`
- `/admin/billing`

## Important Files

- `package.json`
- `proxy.ts`
- `vitest.config.mts`
- `vitest.server-only.ts`
- `app/layout.tsx`
- `app/error.tsx`
- `app/client/layout.tsx`
- `app/admin/admin-layout-content.tsx`
- `app/actions/*`
- `app/actions/internal-automation/*`
- `app/api/document-upload/*`
- `app/api/external-submission/*`
- `app/api/passport-ocr/*`
- `app/api/translations/*`
- `app/api/translate/*`
- `app/api/stripe/*`
- `app/api/travel/*`
- `app/api/vn-prearrival/options/*`
- `app/api/ph-etravel/options/*`
- `components/ui/*`
- `components/smooth-progress.tsx`
- `components/runtime-abort-error-guard.tsx`
- `components/runtime-abort-error-script.tsx`
- `components/client/*`
- `components/client/passport-ocr-upload.tsx`
- `components/client/universal-profile-documents-carousel.tsx`
- `components/client/us-appointment/*`
- `components/client/japan-appointment/*`
- `components/client/korea-appointment/*`
- `components/application-steps/*`
- `components/dynamic-step-form.tsx`
- `components/__tests__/dynamic-step-form-vn-prearrival-options.test.ts`
- `components/dynamic-form-field.tsx`
- `components/field-guidance-panel.tsx`
- `hooks/use-smooth-progress.ts`
- `lib/supabase/*`
- `lib/resilience/*`: server-only HMAC transport, AES-256-GCM envelopes,
  continuity identity/OTP state, critical read cache, and encrypted outbox
  client. Never import these modules into browser bundles or expose their keys.
- `lib/admin-access.ts`
- `lib/document-upload-client.ts`
- `lib/document-image-validation.ts`
- `lib/application-tab-completion.ts`
- `lib/application-step-sections.ts`
- `lib/birthplace-options.ts`
- `lib/vietnam-administrative-units.ts`
- `lib/visa-form-schema-aliases.ts`
- `lib/__tests__/universal-profile-prefill.test.ts`
- `lib/us-appointment/*`
- `lib/japan-vfs-sg.ts`
- `lib/korea-c39/*`
- `lib/client/recent-application-form.ts`
- `lib/runtime-abort-errors.ts`
- `lib/runtime-abort-retry.ts`
- `lib/server-action-recovery.ts`
- `supabase/migrations/*`
- `supabase/manual/*`
- `supabase/templates/*`
- `lib/i18n/locale.ts`
- `app/account/security/copy.ts`: locale-scoped TOTP setup and recovery copy;
  factor identifiers and statuses remain language-neutral internally.
- `lib/frequent-traveler-profile.ts`
- `lib/universal-profile-prefill.ts`
- `lib/translation/*`
- `lib/passport/*`
- `lib/submission-queue.ts`
- `lib/applicant-profile-identity.ts`
- `lib/ds160-proof.ts`
- `lib/__tests__/ds160-proof.spec.ts`
- `lib/__tests__/form-utils.test.ts`
- `lib/legal/*`
- `lib/travel/*`
- `messages/en.json`
- `messages/zh.json`
- `types/us-appointment.ts`
- `scripts/sync-supabase-auth-email-templates.mjs`
- `scripts/audit-travel-card-coverage.mjs`
- `scripts/enrich-travel-card-coverage.mjs`
- `scripts/audit-travel-dropdown-destinations.ts`
- `scripts/seed-dropdown-destinations.ts`
- `scripts/verify-travel-image-relevance.ts`
- `types/*`
