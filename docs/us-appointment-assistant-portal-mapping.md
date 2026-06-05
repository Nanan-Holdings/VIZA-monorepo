# U.S. B1/B2 Appointment Assistant Portal Mapping

Last updated: 2026-06-05

## Scope

This document records the implemented U.S. B1/B2 appointment assistant after
DS-160 capture. The current product surface is intentionally dry-run first:
it models account setup, email verification, DS-160 linking, fee/payment
checkpoint, calendar/slot observation, explicit slot selection, final approval,
mock booking, and status check without performing any real official-portal
booking.

Assisted live providers are scaffolded but disabled. Before any future live
mode is enabled, the applying country/post must be verified from the current
official embassy or consulate page, the portal terms must be reviewed, and
security/payment/final-confirmation checkpoints must remain human-in-the-loop.

## Official Source Notes

- Department of State DS-160 guidance says the DS-160 is only the first step;
  after completion applicants must keep the barcode page, schedule a visa
  interview appointment, and pay the visa application processing fee following
  country-specific embassy/consulate instructions:
  `https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/forms/ds-160-online-nonimmigrant-visa-application.html`
- The DS-160 FAQ reiterates that the applicant must contact the embassy or
  consulate where they wish to apply to determine interview requirements and
  scheduling:
  `https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/forms/ds-160-online-nonimmigrant-visa-application/ds-160-faqs.html.html`
- USTravelDocs presents itself as a site for learning how to apply, pay the
  visa application fee, and schedule interviews, with Singapore among listed
  locations:
  `https://www.ustraveldocs.com/`
- USVisaScheduling identifies itself as the Official U.S. Department of State
  Visa Appointment Service:
  `https://www.usvisascheduling.com/en-US/`
- AIS / usvisa-info country pages are used by some posts; official usembassy.gov
  pages should be checked per country before any live routing decision.

## Implemented Architecture

- Database migration:
  `viza-be/agent-backend/drizzle/0091_us_appointment_assistant.sql`
- Drizzle schema:
  `viza-be/agent-backend/src/db/schema.ts`
- Backend routes:
  `viza-be/agent-backend/src/routes/us-appointment.routes.ts`
- Backend service state machine:
  `viza-be/agent-backend/src/services/us-appointment/**`
- Browser API client:
  `viza-fe/internal-website/lib/us-appointment/client.ts`
- Applicant UI:
  `viza-fe/internal-website/components/client/us-appointment/us-appointment-assistant.tsx`
- Route after DS-160:
  `viza-fe/internal-website/app/client/applications/[applicationId]/us-appointment/page.tsx`
- DS-160 result-card entry point:
  `viza-fe/internal-website/app/client/application/_components/result-cards/UsResultCard.tsx`

## Compliance Design

- Dry-run is the only executable mode.
- No CAPTCHA solving, MFA/email bypass, payment automation, proxy rotation,
  browser fingerprinting, stealth mode, waiting-room bypass, or rate-limit
  bypass is implemented.
- Slot and status checks are user-triggered; no background polling loop exists.
- Payment is a manual checkpoint and cannot charge money in development.
- A selected slot requires explicit final approval before mock booking.
- Sensitive fields are redacted before audit logging.
- Site policy warnings map to manual review / blocked states rather than
  automatic continuation.

## Portal Mapping Table

| applying_country | applying_post | portal | provider | account_required | email_verification_likely | captcha_likely | payment_required | safe_automation_steps | manual_steps | risk_notes |
|---|---|---|---|---|---|---|---|---|---|---|
| Singapore | Singapore | Needs current official post verification; USTravelDocs lists Singapore, while the code registry records the likely scheduling family as USVisaScheduling for dry-run metadata | `usvisascheduling` metadata; executable provider is `dry_run` | Yes | Likely | Likely | Likely MRV / visa processing fee before or during scheduling | Dry-run account/profile modeling, DS-160 code validation, user-preference capture, mock slot observation, audit trail | Account creation/login, email verification, CAPTCHA, real payment, slot choice, final booking confirmation | Do not enable live mode until the current Singapore embassy/consulate scheduling URL and portal rules are verified. |
| Canada | Toronto / Vancouver / Ottawa / Montreal / Calgary / Quebec / Halifax | AIS / usvisa-info, subject to current post instructions | `ais_usvisa_info` metadata; executable provider is `dry_run` | Yes | Likely | Likely | Likely | Dry-run profile preparation, status modeling, manual checkpoint routing | Login, email/MFA/CAPTCHA, payment, calendar navigation, final confirmation | Provider and DS-160 matching rules can change by post; verify current Canada embassy guidance before live support. |
| United Kingdom | London / Belfast | AIS / usvisa-info is likely, but must be verified from the current UK embassy page | `ais_usvisa_info` metadata; executable provider is `dry_run` | Yes | Likely | Likely | Likely | Dry-run profile preparation and manual checkpoint routing | Login, CAPTCHA/MFA, payment, appointment selection, final confirmation | Official UK usembassy.gov pages were not reliably crawlable in research; treat as needs verification. |
| India | New Delhi / Mumbai / Chennai / Hyderabad / Kolkata | USVisaScheduling is the likely family for NIV appointment scheduling | `usvisascheduling` metadata; executable provider is `dry_run` | Yes | Likely | Likely | Likely | Dry-run DS-160/profile linking and slot scenario simulation | Portal account, email/MFA/CAPTCHA, MRV payment, biometric/interview selection, final confirmation | High demand and portal anti-abuse controls make any polling or automation especially risky. |
| China | Beijing / Shanghai / Guangzhou / Shenyang / Wuhan | USVisaScheduling / USTravelDocs family needs current post verification | `usvisascheduling` metadata; executable provider is `dry_run` | Yes | Likely | Likely | Likely | Dry-run profile preparation, DS-160 linking, mock slot observation | Login, security checks, payment, slot selection, final confirmation | Local instructions and language variants must be verified from current official pages. |
| Germany | Berlin / Frankfurt / Munich | USTravelDocs or local post-specific scheduling, needs verification | `ustraveldocs` metadata; executable provider is `dry_run` | Yes | Likely | Likely | Likely | Dry-run state transitions and user-guided checkpoints | Account/login, email/MFA/CAPTCHA, payment, slot selection, final confirmation | Code falls back to USTravelDocs metadata for countries outside AIS/USVisaScheduling lists; not a live-routing claim. |
| Manual / embassy-specific | Any post with nonstandard instructions | Embassy-specific page or manual consular instructions | `manual_provider` or `embassy_specific_niv`; executable provider is `dry_run` unless future approved live mode exists | Depends | Depends | Depends | Depends | Intake, checklist, reminder, audit, and human handoff only | All official portal interactions | Use this whenever provider confidence is low or site policy prohibits automation. |

## State Machine Summary

1. `appointment_consent_received`
2. `appointment_account_creation_started`
3. `appointment_email_verification_required`
4. `appointment_profile_fill_in_progress`
5. `appointment_profile_filled`
6. `appointment_ds160_linked`
7. `appointment_payment_required`
8. `appointment_payment_completed`
9. `appointment_calendar_opened`
10. `appointment_slots_observed` or `appointment_no_slots_available`
11. `appointment_slot_selection_required`
12. `appointment_final_confirmation_required`
13. `appointment_booked`
14. `appointment_confirmation_captured`
15. `appointment_status_checked` when the user explicitly checks status

## Future Live-Mode Gate

Live mode must remain disabled until all of the following are true:

- Current official post URL and provider routing are verified.
- Legal/product approval confirms the portal terms allow the planned assisted
  behavior.
- The browser runner uses ordinary user-visible sessions only, with no stealth,
  proxy, anti-detection, CAPTCHA solving, or high-frequency polling.
- The runner stops at login, CAPTCHA, MFA/email, payment, waiting room, policy
  warning, slot selection, and final confirmation checkpoints.
- Real booking is blocked unless the applicant explicitly approves the exact
  slot and final action.
