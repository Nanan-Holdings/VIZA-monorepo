# Client Departure Cards Agent Guide

Scope: this file applies to `app/client/departure-cards/**`.

- Departure-card routes are authenticated deep links into dedicated DB-driven
  packages; they must not reuse arrival-card package identities.
- Philippines uses `PH_ETRAVEL_DEPARTURE_CARD` and shares only presentation and
  runner infrastructure with the independent arrival package.
- Keep official submission logic in `viza-be/submission-service`.

Validate with frontend type-check/lint and smoke the changed route.
