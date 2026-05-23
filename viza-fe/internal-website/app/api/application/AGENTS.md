# Application API Agent Guide

Scope: this file applies to `viza-fe/internal-website/app/api/application/**`.

## Purpose

These Next.js route handlers support client-side visa application forms with
server-side helpers that should not live in browser bundles.

## Key Flows

- `locations/cities/route.ts`: returns complete country and state/province
  city options for bilingual application forms. It reads public
  country-specific JSON from `dr5hn/countries-states-cities-database`, caches
  results in memory, and lets the frontend append a custom-city option.

## Ownership Boundaries

- Keep form rendering and two-way bilingual field state in
  `components/application-steps/**`.
- Keep this API read-only; do not persist applicant answers here.
- Prefer complete official or public location datasets over curated "popular"
  city lists for application forms. Travel AI can use curated destination lists,
  but visa birth/place fields need broad coverage plus custom fallback.

## Validation

Run from `viza-fe/internal-website`:

```powershell
npm run type-check
npm run lint
```

For location changes, smoke the API directly, for example:

```powershell
node -e "fetch('http://localhost:3000/api/application/locations/cities?countryCode=CN&regionCode=HN').then(r=>r.json()).then(j=>console.log(j.options.length))"
```
