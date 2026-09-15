# Retired Payments and Submission Access

Scope: this directory.

Payments were removed by product decision on 2026-09-15. Do not restore
checkout, subscription sales, payment-method binding, refunds, card issuance,
or payment-gated submission.

- submission-access.ts retains the legacy response shape for existing clients
  but only verifies application/profile/group ownership. It performs no
  financial reads, entitlement writes, allocation, or payment-deferral RPC.
- submission-access.test.ts covers unpaid applications, old refund evidence,
  foreign owners, group owners, and missing applications.
- submission-access.integration.test.ts verifies owner-scoped reads through
  the installed Supabase SDK against a local HTTP fixture, with all financial
  storage unavailable. It never connects to a production database.
- Legacy financial types/helpers may remain only for historical compatibility.
  No active application flow may call them to collect or execute payment.

Fee fields in the legacy response describe VIZA collection only; zero collection
is never evidence that an official authority's fee has been paid.
