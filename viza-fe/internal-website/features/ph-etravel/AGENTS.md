# Philippines eTravel Frontend Module

Scope: Philippines eTravel-specific frontend helpers.

- Keep `PH_ETRAVEL_ARRIVAL_CARD` separate from Philippines visa packages.
- `date-window.ts` owns website/API scheduling decisions for the flight-arrival
  date. Users may prepare the form ahead of time, but official submission is
  scheduled for the 72-hour official eTravel window.
- Form field inventory and official dropdown values belong in
  `viza-be/agent-backend/scripts/ph-etravel/**`; runner mapping belongs in
  `viza-be/submission-service/src/ph-etravel/**`.
