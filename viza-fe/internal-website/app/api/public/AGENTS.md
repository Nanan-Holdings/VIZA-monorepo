# Public Read API Agent Guide

Scope: this file applies to `viza-fe/internal-website/app/api/public/**`.

## Purpose

These route handlers expose deliberately public, read-only marketing data. They
must not become a path to applicant records, authentication state, credentials,
or other user-scoped values.

## Key Flows

- `catalogue/route.ts`: returns validated published catalogue snapshots from
  `catalogue_publications`.
- `catalogue/route.test.ts`: verifies cold-burst single-flight behavior and
  cache failure/expiry behavior.

## Concurrency and caching

- Keep catalogue responses limited to `isPublicCataloguePayload`-validated
  publication data.
- The route uses one bounded process-local cache key with a short TTL to
  coalesce concurrent Supabase reads. Keep the cache free of session,
  applicant, payment, and document data.
- Supabase reads must remain bounded by a timeout and must not amplify a public
  request burst with retries.
- Preserve the public CDN cache headers and return `no-store` for failures.

## Validation

Run from `viza-fe/internal-website`:

```powershell
npx vitest run app/api/public/catalogue/route.test.ts
npm run type-check
npm run lint
```

Smoke the route with a local dev server at
`http://127.0.0.1:3000/api/public/catalogue`.
