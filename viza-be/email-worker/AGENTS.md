# Email Worker Agent Guide

Scope: this file applies to `viza-be/email-worker/**`.

## Purpose

This Cloudflare Email Worker owns the live VIZA applicant alias inbox path:

`appl-*@haggstorm.com` -> Cloudflare Email Routing -> Supabase `inbound_email`
-> applicant real email forwarding. R2 raw-message archival is optional until
the Cloudflare account enables R2.

## Guardrails

- Always attach the original RFC 822 bytes to the immediate forward so QR, PDF,
  and inline attachments remain intact. When R2 is configured, archive the raw
  message before acknowledging receipt so forwarding failures can be retried.
- OTP consumers read `inbound_email`; forwarding must never mark a message
  processed or delay runner access.
- Resolve the forwarding destination from `applicant_profiles.email`. Never
  submit the real email to an official portal when a managed alias is required.
- Do not log raw mail bodies, OTP values, recipient emails, API keys, or
  attachment contents.
- Quarantined messages are stored but not forwarded.
- Forwarding is idempotent. Retry failures asynchronously only when the raw
  message is durable in R2; never fabricate an attachment from parsed text.
- Keep secrets in Wrangler secrets. Do not add them to `wrangler.toml`.

## Validation

```powershell
cd viza-be\email-worker
npm run type-check
npx wrangler deploy --dry-run
```

Use the Cloudflare Email Routing canary for a live smoke. Confirm the row is
stored, forwarding status reaches `sent`, and the forwarded message retains the
original `.eml` attachment.
