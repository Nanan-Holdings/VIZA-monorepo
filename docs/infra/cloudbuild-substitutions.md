# Cloud Build Substitutions — internal-website (CI-006)

`viza-fe/internal-website/cloudbuild.yaml` uses `_*` substitutions injected by
the Cloud Build trigger. `scripts/infra/validate-cloudbuild-subs.ts` fails the
build if any value is still the `REPLACE_VIA_TRIGGER` placeholder. **No secret
values here** — names + expected source only.

| Substitution | Expected value / source |
| --- | --- |
| `_NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (public) |
| `_NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (public) |
| `_NEXT_PUBLIC_AGENT_BACKEND_URL` | Agent backend origin (public) |
| `_NEXT_PUBLIC_SITE_URL` | Portal origin (public) |
| `_SUPABASE_SERVICE_ROLE_KEY` | Secret Manager: supabase service role |
| `_SHOPIFY_STORE_DOMAIN` / `_SHOPIFY_ACCESS_TOKEN` / `_SHOPIFY_WEBHOOK_SECRET` | Shopify app creds (secret) |
| `_CALCOM_API_KEY` / `_CAL_WEBHOOK_SECRET` | Cal.com creds (secret) |
| `_CLIENT_SESSION_SECRET` | Guest session signing key (secret) |
| `_LAB_REPORT_API_BASE` | Lab report API base (config) |
| `_PRESCRIPTION_API_KEY` / `_PRESCRIPTION_API_ALLOWED_ORIGINS` | Prescription API (secret/config) |
| `_AR_HOSTNAME` / `_AR_PROJECT_ID` / `_AR_REPOSITORY` / `_DEPLOY_REGION` / `_SERVICE_NAME` | Artifact Registry + Cloud Run deploy target |

Run: `npx tsx scripts/infra/validate-cloudbuild-subs.ts` (also gated in CI).
