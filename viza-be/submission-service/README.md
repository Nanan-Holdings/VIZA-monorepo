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
  issuing/escrow-card-provider.ts — mint/freeze escrow card into the vault (flag: AIRWALLEX_ISSUING_ENABLED)
```

Airwallex virtual-card issuing is foundation-only and gated off by default — see
`docs/airwallex-issuing-integration.md` for design, status, and rollout.
