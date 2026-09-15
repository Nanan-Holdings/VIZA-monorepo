# VIZA Submission Service

Browser automation service that polls `submission_queue` and submits Indonesian e-visa applications via Playwright.

## How it works

1. Every 30 seconds, polls `submission_queue` for rows with `status='pending'`
2. For each pending item, loads the full applicant data from Supabase
3. Downloads supporting documents from Supabase Storage to a temp directory
4. Launches a headless Chromium browser and fills the evisa.imigrasi.go.id form
5. On success: sets `applications.status='submitted'`, stores the confirmation number
6. On failure: increments `attempts` and retries up to 3 times
7. After 3 failures: sends an alert email to the operator via Resend

## Environment variables

Create a `.env` file in this directory:

```
SUPABASE_URL=https://oyjxdzsoejraedqghndi.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
RESEND_API_KEY=your-resend-key
```

## Running locally

```bash
npm install
npm run install-browsers   # installs Chromium for Playwright
npm run dev                # runs with ts-node (development)
npm run build && npm start  # compiled (production)
```

## Deploying to Railway

1. Create a new Railway project and link this directory as the source
2. Set the environment variables above in Railway's dashboard
3. Set the start command to `npm start` (uses the compiled `dist/index.js`)
4. Add a build command: `npm run build`
5. Railway will automatically restart the service on deploy

> **Note:** Playwright requires Chromium system dependencies. Use the
> `mcr.microsoft.com/playwright:v1.41.0-jammy` Docker image as the base,
> or add a `nixpacks.toml` with:
> ```toml
> [phases.setup]
> nixPkgs = ["chromium", "glib", "nss", "atk", "at-spi2-atk", "libdrm", "libxkbcommon", "xorg.libX11", "xorg.libXcomposite", "xorg.libXdamage", "xorg.libXext", "xorg.libXfixes", "xorg.libXrandr", "xorg.libxcb", "mesa"]
> ```

## Updating form mappings

The Indonesian e-visa portal selectors are in `src/form-mappings.ts`. If the portal changes its HTML structure, update the `selector` strings in that file — no other code needs to change.

## File structure

```
src/
  index.ts          — main polling loop + Playwright orchestration
  form-mappings.ts  — evisa.imigrasi.go.id CSS selectors (update if portal changes)
  alert.ts          — Resend failure email
  supabase.ts       — Supabase client singleton
  types.ts          — TypeScript interfaces
  payment-routing.ts            — per-country government-fee routing (decisionFor)
  applicant-vault.ts            — encrypted per-applicant credential vault (AES-256-GCM)
  clients/airwallex-issuing.ts  — Airwallex Issuing API client (single-use virtual cards)
  issuing/managed-card-provider.ts — exact-currency PhotonPay selection with durable, vault-free Airwallex fallback
```

Managed virtual-card issuing is fail-closed and gated by exact issuer currency
configuration — see `docs/photonpay-issuing-integration.md`.


## USVisaScheduling appointment runner

Explicit VIZA appointment actions wake `POST /internal/us-appointment/wake`
with `Authorization: Bearer <US_APPOINTMENT_INTERNAL_TOKEN>` and a JSON
`jobId`. The endpoint accepts one persisted live China USVisaScheduling job,
after startup and capacity-lease readiness, using migration 0193's atomic claim.
HTTP 202 means admission succeeded; it is not an official appointment result.
Duplicate calls share admission. Worker shutdown cancels queued claims;
ambiguous started claims remain held instead of replaying an official action.
The execution deadline includes queue wait. A browser that cannot stop within
the cleanup deadline makes the worker unhealthy and exits the machine.

The backend requires `US_APPOINTMENT_SUBMISSION_SERVICE_URL` and the matching
`US_APPOINTMENT_INTERNAL_TOKEN`; both sides also accept the existing shared
`SUBMISSION_QUEUE_INTERNAL_TOKEN` when no appointment-specific token is set.
For an existing on-demand Fly pool machine, configure
`US_APPOINTMENT_FLY_APP`, `US_APPOINTMENT_FLY_MACHINE_ID`, and the organization
`FLY_SUBMISSION_ORG_TOKEN`. The target URL must match that Fly app. The backend
verifies `RUNNER_MACHINE_KIND=pool` and a positive idle TTL no greater than one
hour before starting the exact existing machine and sending an instance-pinned
wake. It never creates or scales machines. Keep the existing pool sizing and
120-second idle setting. Enable the US live and Playwright flags on the worker
only after its secrets, claim RPCs, and portal configuration are verified.
Page/status reads do not wake or restart jobs.
