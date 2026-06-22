# SGAC Seed Module

Scope: Singapore `SG_ARRIVAL_CARD` form schema only.

- `form-fields.ts` is the official ICA field inventory used by the DB seed.
- `seed-form-fields.ts` replaces all SGAC rows idempotently.
- Keep non-official notices and VIZA workflow acknowledgements out of the applicant form.
- Keep `scripts/seed-sg-arrival-card-form-fields.ts` as the compatible command entry point.
