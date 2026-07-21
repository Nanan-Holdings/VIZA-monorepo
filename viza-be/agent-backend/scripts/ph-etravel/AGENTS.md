# Philippines eTravel Seed Agent Guide

Scope: Philippines `PH_ETRAVEL_ARRIVAL_CARD` and `PH_ETRAVEL_DEPARTURE_CARD` form schemas.

- Keep eTravel separate from `PH_TEMPORARY_VISITOR_VISA`; eTravel is an arrival
  declaration, not a Philippines 9(a) visa.
- `form-fields.ts` is the official eTravel-aligned DB seed inventory for
  arrival-focused traveller, passport, residence, transport, destination,
  health, customs, family-member, and declaration-signature fields.
- `official-options.ts` owns runner-facing official option values. Chinese
  labels are display-only and must not replace official English values.
- `sync-official-options.ts` refreshes `official-options.snapshot.json` from
  the public official eTravel common-data API. Preserve the official `code` as
  the submitted value; airline-dependent flight numbers stay runtime-loaded.
- `seed-form-fields.ts` replaces all `PH_ETRAVEL_ARRIVAL_CARD` rows
  idempotently.
- Keep 9(a) visa fields out of this seed. Departure-, crew-, sea-, and
  family-member branches may be represented only when they mirror official
  eTravel controls and keep runner-facing values in official English.
- `departure-form-fields.ts` owns the independent passenger-only departure
  schema. It supports AIR and SEA plus Filipino/foreigner conditional branches
  and must not inherit arrival health, accommodation, or Philippine-destination
  fields.
- `seed-departure-form-fields.ts` replaces only
  `PH_ETRAVEL_DEPARTURE_CARD` rows and must never delete arrival rows.
