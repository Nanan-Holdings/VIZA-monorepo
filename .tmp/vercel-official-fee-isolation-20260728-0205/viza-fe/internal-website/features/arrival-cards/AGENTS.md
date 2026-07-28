# Arrival Cards Frontend Helpers

Scope: this file applies to `viza-fe/internal-website/features/arrival-cards/**`.

## Purpose

Shared applicant-portal helpers for country arrival-card products that are not
specific to a single country such as SGAC, MDAC, or TDAC.

## Guardrails

- Keep arrival-card package identities separate from visitor visa packages.
- A repeat submission must create a new application and preserve previous
  confirmations or references on the old application.
- Copy only stable traveller/profile answers into a repeat submission. Do not
  copy trip dates, transport, accommodation, health declarations, or official
  submission acknowledgements.
- Country-specific runner mapping, dropdown options, and official portal logic
  belong in the country-specific feature or submission-service folder.
