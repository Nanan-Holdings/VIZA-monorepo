# VIZA live tourist-portal QA handover

Updated: 2026-08-19 (Asia/Singapore)

## Objective

Run the submission service for the five 2026-08 tourist products from Edward's
existing `/applications` records, driving each official portal as far as it
will go and stopping before payment and before final submission.

Boundary held throughout: no charge authorized, no card data entered, no Pay
clicked, no application submitted. All five applications are still `draft` with
`official_fee_status = not_started`.

## Applications used for QA

Edward's hosted Supabase drafts. Do not replace them or create new hosted QA
records. Applicant profile `f8e36807-36b1-432c-ae1b-c34fb01f053a` (Zehua Zhang).

| Country | Visa type | Application ID |
| --- | --- | --- |
| Canada | `CA_TRV` | `74e62018-bab6-4ca4-aa15-f213294b4683` |
| Türkiye | `TR_E_VISA` | `b8df7a56-aed1-4b7b-8a6c-4e90cc5fe2bf` |
| India | `IN_E_VISA` | `69911d95-8cb1-4d31-b2a6-6899d929b12c` |
| Saudi Arabia | `SA_E_VISA` | `de07907d-43eb-4375-a6d7-6b1972b80045` |
| UAE | `AE_TOURIST_VISA` | `cbac3e41-2d4a-44f0-9bf7-2fac12f6508c` |

Never print the national-ID number, passwords, CAPTCHA key, portal secrets,
document storage paths, or personal email credentials.

## Tooling

Both scripts are read-only with respect to payment and submission.

```bash
# Readiness for all five, using each runner's own preflight
node --env-file=.env --env-file=../agent-backend/.env.local --import tsx \
  scripts/check-five-tourist-readiness.ts

# Drive one country through the real queue dispatch table
node --env-file=.env --env-file=../agent-backend/.env.local --import tsx \
  scripts/run-tourist-runner.ts <canada|turkey|india|saudi_arabia|united_arab_emirates>
```

## Verified state per country (2026-08-19)

### Canada — furthest progress; blocked on a legal declaration

`halted_before_pay`, reached step `representative_status_required`.

The runner completes managed login, IRCC Terms and Conditions, the purpose
page, and the tourist application-type page. The earlier `credentials_rejected`
result no longer reproduces; login works and the built-in
`recoverCanadaIrccPortalPassword` path was not needed.

It stops because IRCC treats preparing an application for someone else as
representation. VIZA must not answer "No". Remaining, in order:

1. Record Edward's application consent and application signature — the two
   readiness blockers (`missing_application_consent`,
   `missing_application_signature`).
2. Decide and document VIZA's representative status (authorized paid
   representative vs documented uncompensated), with the applicant's signed
   appointment (IMM 5476) on record.

All required answers and documents are otherwise present.

### India — hard external block, verified at source

`needs_human`: the official portal offers no e-Tourist service to Chinese
ordinary-passport holders.

Evidence from the portal's own `POST /evisa/json/evisaServiceAllowed` for
nationality `CHN`:

- full catalogue `evisa_service_all` = `3,89,90,31,32,101,131,161,42,43,102,
  103,104,105,108,109,44,45,46,47,1,4,13,16,48`
- permitted `evisa_service_allowed` = `48` only

The only enabled purposes on the registration form are the eight
`e-Production Investment Visa (e-B4)` variants. e-Tourist services 31 (30 days),
3 (1 year) and 32 (5 years) are all unavailable. No code change makes an India
e-Tourist application possible for this applicant.

The runner now reports the requested and offered service codes so an operator
can distinguish a nationality restriction from a validity mismatch.

### Saudi Arabia — runner defect fixed; now at the official OTP boundary

`needs_human`: "VisitSaudi accepted the managed credentials and requires the
phone verification code."

Previously this reported "VisitSaudi rejected the managed-account credentials",
which was misleading. The vaulted password was always valid — a direct login
reached `/Login/OTPAuth` with no validation errors. The real cause: the runner
re-submitted the registration form for an already-confirmed account. VisitSaudi
rejects the duplicate, and the resulting session state made the follow-up login
look like a credential rejection.

Fixed in `src/sa/registration-policy.ts`
(`shouldRegisterSaudiManagedAccount`), covered by
`src/sa/__tests__/managed-account-registration.spec.ts`. No password recovery
flow is needed for Saudi.

Remaining gap: `submitSaudiLoginOtp` exists in `src/sa/live-flow.ts` but
**nothing calls it**. Reaching the document/payment checkpoint needs an
applicant-in-the-loop OTP hand-off, because VisitSaudi sends the code to
Edward's phone.

Live flags used (all default to off):

```
SA_PRE_SUBMIT_QA_ENABLED SA_TWOCAPTCHA_ENABLED SA_ACCOUNT_PREPARATION_ENABLED
SA_LOGIN_ENABLED SA_DOCUMENT_UPLOAD_ENABLED SA_PAYMENT_CHECKPOINT_ENABLED
```

Dependency chain is payment → documents → login → captcha, so enable them
together. Values must be the literal string `true`.

### Türkiye — environment blocker, not a product blocker

`retryable`: `net::ERR_NAME_NOT_RESOLVED` for `https://evisa.gov.tr/en/apply/`.

`evisa.gov.tr` does not resolve from this machine or via `8.8.8.8` (NXDOMAIN),
but does resolve via `1.1.1.1` to `212.174.190.168`. With a Chromium
`--host-resolver-rules` override the official site loads and 302-redirects to
`dtvgroup.com.tr` ("DTV - Republic of Türkiye e-Visa Services"), a redirect
`src/tr/live-flow.ts` already handles.

So the TR runner is intact and blocked only on DNS. Fix the resolver on the
host running the runner, then re-run. Confirm production runner egress can
resolve `evisa.gov.tr` before trusting a green TR result.

Separately, `confirm_all_official_prerequisites` is still not affirmative and
must not be flipped to `yes` to reach a later page.

### UAE — genuinely blocked on applicant evidence and identity session

`liveConfigBlockers`: `AE_PRE_SUBMIT_QA_ENABLED`, `AE_AUTHENTICATED_CDP_ENABLED`.

Missing documents: `uae_health_coverage_evidence`, `return_or_onward_ticket`.

Missing evidence review metadata for `six_month_bank_statement` (validated
status, reviewed_at, current review, months covered, minimum monthly balance,
official/stamped/signed/coloured) and for `uae_health_coverage_evidence`
(validated status, reviewed_at, current review, issuer country, validity days).

ICP transaction 783 also requires an authorized UAE Pass or eligible-provider
CDP session; ordinary foreign-tourist username creation is not a fallback.

## Infrastructure findings that block the queue path

The runners were driven directly through `getRunOne(country)` — the same
dispatch the `runner_job` worker uses. The queue delivery path itself is not
yet deployable:

1. **`DATABASE_URL` password authentication fails** against
   `aws-1-ap-south-1.pooler.supabase.com`. Migrations cannot be applied from
   this checkout. Rotate or re-issue the operator connection string.
2. **Do not run `npm run db:migrate` against production as-is.** The
   `public._migrations` ledger holds 99 rows while `drizzle/` has 170 files, so
   the runner would replay ~71 unrecorded migrations against a live database.
   Apply the two pending files individually and record them by filename.
3. **Migration number collision.** Production already has
   `0151_kr_e_arrival_card.sql` applied, which is not in this checkout. The two
   local pending files were renumbered to avoid the clash:
   - `0163_enable_five_tourist_runner_claims.sql`
   - `0164_application_document_review_integrity.sql`
4. **Saudi jobs can never be claimed until 0152 is applied.**
   `runner_concurrency_cap` has no `saudi_arabia` row, and
   `claim_runner_pool_job` joins that table, so SA `runner_job` rows stay
   queued forever.

## Test and type status

- `npm run type-check` passes.
- Full suite with env loaded: 1240 tests, 1060 pass, 120 fail. **Every failure
  is the missing Playwright browser binary** (`chromium_headless_shell-1208`;
  the cache only has `1228`). Zero assertion failures, zero env failures. Run
  `npx playwright install chromium` to clear them.
- Two pre-existing payment-boundary regressions were found and fixed: the
  uncommitted rewrites of `src/sa/runner.ts` and `src/in/runner.ts` had dropped
  `unavailableManagedPaymentBoundary`, so their halts no longer routed through
  the shared staff-review boundary. Both now do.

## Rules that still apply

- Fill only truthful answers. Do not invent itinerary, accommodation,
  reference, insurance, ticket, consent, or signature data in Edward's records.
- For every CAPTCHA, confirm the destination and action before invoking
  TWOCAPTCHA. Never log the API key or the solution.
- A payment checkpoint means the official unpaid controls and amount were
  observed. It is never authorization.
- Do not call the overall goal complete on the basis of runner exit codes
  alone; India is externally impossible today, and Türkiye/Saudi/UAE each stop
  at a boundary owned by the government portal or the applicant.
