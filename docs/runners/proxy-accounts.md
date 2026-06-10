# Proxy + Account Pool Coverage

Artifact for **RUN-CORE-006**. Documents residential-proxy egress and portal
account requirements per launch country. **No secret values here.**

## Proxy egress (src/proxy/country-overrides.ts)

Every launch country resolves to a Bright Data egress geography via
`resolveEgressCountry(country)` — an explicit `PROXY_COUNTRY_OVERRIDES` entry or
the `SLUG_TO_ISO2` fallback. `proxyCoverageGaps()` asserts full coverage and is
run at startup by DEP-003 `validate-env` (missing mapping → clear boot error).

| Country | Egress | Source |
| --- | --- | --- |
| indonesia | id | fallback |
| egypt | eg | fallback |
| australia | au | fallback |
| saudi_arabia | sa | fallback (added RUN-CORE-006) |
| united_kingdom | gb | fallback |
| vietnam | vn | **override** (locale fingerprint) |
| malaysia | my | fallback |
| japan | jp | fallback |
| united_states | us | **override** (CEAC anti-bot) |
| canada | ca | fallback |
| turkey | tr | fallback |
| thailand | th | fallback |
| united_arab_emirates | ae | fallback |
| france | fr | fallback (added RUN-CORE-006) |
| italy | it | fallback; `italy_vfs_cn` slug **overrides** to cn/shanghai (VFS-CN mirror) |
| india | in | fallback |

Credentials: `BRIGHTDATA_PASSWORD` / zone config (see `secret-rotation.md`).
Pool seeded from a Bright Data zone CSV (DATA-008, onHold).

## Portal accounts (src/account-loader.ts)

Only auth-gated portals need a per-applicant `<cc>_accounts` row (login + resume
URL/TRN). e-Visa portals are unauthenticated (no account row).

| Country | Account table | Needed? |
| --- | --- | --- |
| united_kingdom | `uk_accounts` | yes (resume URL + login) |
| australia | `au_accounts` | yes (ImmiAccount + TOTP) |
| france | `fv_accounts` | yes (France-Visas login) |
| italy | `it_vfs_cn_accounts` | yes (VFS login) |
| egypt | `eg_accounts` | optional (portal account) |
| united_states | — | no (CEAC sessionless; 2captcha for start page) |
| indonesia, vietnam, malaysia, thailand, turkey, uae, canada, india, saudi_arabia, japan | — | no (unauthenticated e-Visa / paper) |

Rows are seeded by hand today (`scripts/seed-edward-test-credentials.ts`); an
intake worker auto-provisions per-applicant aliases post-launch (PROV-*, onHold).
A missing account row surfaces at runtime as `needs_human` (not a boot error,
since it's per-applicant, not config).
