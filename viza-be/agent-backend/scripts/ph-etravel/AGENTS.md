# Philippines eTravel Seed Agent Guide

Scope: Philippines `PH_ETRAVEL_ARRIVAL_CARD` form schema only.

- Keep eTravel separate from `PH_TEMPORARY_VISITOR_VISA`; eTravel is an arrival
  declaration, not a Philippines 9(a) visa.
- `form-fields.ts` is the official eTravel-aligned DB seed inventory for v1
  arriving foreign passengers.
- `official-options.ts` owns runner-facing official option values. Chinese
  labels are display-only and must not replace official English values.
- `seed-form-fields.ts` replaces all `PH_ETRAVEL_ARRIVAL_CARD` rows
  idempotently.
- Keep family-member, departing Filipino, crew, cruise-specialized, and 9(a)
  visa fields out of this seed unless a future task explicitly expands scope.
