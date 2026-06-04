# Country Capability Matrix

Artifact for **RUN-CORE-004**. Single source of truth for launch readiness
across the 16 launch countries (+ extras with runners). Matches the bindings in
`viza-be/submission-service/src/queue/dispatch.ts` (`DISPATCH` / `DISPATCH_META`)
and the routing in `src/payment-routing.ts`. Referenced from the OBSV launch
checklist (OBSV-005).

Legend — **Policy**: `halt` = fills then stops before government payment;
`submit` = submits to the pre-pay/registration step; `paper` = renders a
printable pack (no online submit). **Collector**: who pays the government fee
(`viza` = escrow, `portal` = applicant in-portal, `applicant` = out-of-band
link, `none` = no portal fee). **Recon**: `best-effort` selectors pending a
live recon harvest (DATA-001); `scaffold` = structured but unconfirmed.

| Country | Runner path | Recon | Policy | Collector | Tests |
| --- | --- | --- | --- | --- | --- |
| indonesia | `id/runner.runOne` | best-effort | halt (escrow pending) | viza | field-mappings (5) |
| egypt | `egypt/runner.runOne` | best-effort | halt (escrow pending) | viza | field-mappings + fill-smoke (6) |
| vietnam | `vietnam/runner.runOne` | scaffold | submit (→submitted_pending_pay) | viza | step-fill (3) |
| italy | `italy-vfs-cn/runner.runOne` | scaffold (Annex I) | halt (appointment/VFS pay) | portal | normalize (4) |
| france | `france-visas/runner.runOne` | live (account-gated) | halt (CERFA, consulate fee) | portal | (halt-runner) |
| saudi_arabia | `sa/runner.runOne` | best-effort | halt (escrow pending) | viza | field-mappings + recon-parse (6) |
| malaysia | `my/runner.runOne` | best-effort | halt (escrow pending) | viza | field-mappings (4) |
| japan | `jp/runner.runOne` | n/a (paper) | **paper** (paper_ready) | none | paper snapshot (4) |
| united_states | `ceac/runner.runOne` | live (CEAC) | halt (sign page) | applicant | terminal-status |
| canada | `ca/runner.runOne` | best-effort (shared core) | halt | portal | field-mappings (3) |
| turkey | `tr/runner.runOne` | best-effort (shared core) | halt (escrow pending) | viza | field-mappings (2) |
| thailand | `th/runner.runOne` | best-effort (shared core) | halt (escrow pending) | viza | field-mappings (2) |
| united_arab_emirates | `ae/runner.runOne` | best-effort (shared core) | halt (escrow pending) | viza | field-mappings (2) |
| united_kingdom | `uk/runner.runOne` | live (account-gated) | halt (pay screen) | portal | terminal-status |
| australia | `au/runner.runOne` | live (ImmiAccount) | halt (signature) | portal | terminal-status |
| india | `in/runner.runOne` | live (selectors.generated) | halt | viza | terminal-status |

Extras (non-launch, have runners): sri_lanka (`lk`), cambodia (`kh`), laos (`la`),
south_africa (`za`) — all halt, routed in `payment-routing.ts`.

## Notes

- **Escrow pending**: countries routed `runner_escrow_card` (VIZA collects) still
  halt at the pay step because in-portal escrow-card payment is not yet
  integrated. They become `submit` once escrow lands.
- **Recon gate**: `best-effort`/`scaffold` selectors must be promoted from a
  live recon harvest (`npm run` per-country `form-recon`, DATA-001/002, onHold on
  proxies/creds) before production submit.
- **Account-gated**: France/UK/AU/US need provisioned portal accounts
  (`fv_accounts`/`uk_accounts`/`au_accounts`; CEAC needs 2captcha) — absent →
  `needs_human` (PROV-*, onHold).
- All halt/submit/paper outcomes map to runner_job `succeeded` via
  `runners/result-map.ts`; retryable failures → `failed`/`dead_letter`.
