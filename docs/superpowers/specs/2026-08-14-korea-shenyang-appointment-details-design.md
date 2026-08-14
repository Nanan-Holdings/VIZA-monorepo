# Korea Shenyang Appointment Details Design

## Goal

Collect every applicant detail that the Shenyang VFS account and appointment
flow has verified it needs, while reusing saved VIZA data first and keeping all
other Korea filing centers unchanged.

## Scope

This behavior applies only when the persisted current filing center is
`shenyang`. Beijing, Shanghai, Guangzhou, Xi'an, Chengdu, Wuhan, Qingdao, and
every other Korea center retain their existing review fields, validation, and
transitions.

The feature does not expand the official-portal automation boundary. Loading or
saving applicant details remains read/write activity against VIZA's existing
application records only. Fly wake-up, VFS account creation, email activation,
OTP handling, slot lookup, and booking remain behind the existing explicit
official-verification and final-approval transitions.

## Applicant Data Contract

The Shenyang review resolves applicant values in this order:

1. Non-empty `visa_application_answers` values for the current Korea
   application.
2. Canonical facts from `applicant_profiles` and reusable
   `universal_profile_answers`.
3. Values explicitly entered in the Shenyang review card for fields that remain
   missing.

The first non-empty value wins. Appointment-page supplements are written only
to `visa_application_answers` for the current Korea application. They do not
update the universal profile.

The confirmed minimum data for the implemented Shenyang VFS applicant step is:

- passport-matching English surname;
- passport-matching English given names;
- date of birth;
- passport number;
- passport expiry date; and
- mainland China mobile number.

Nationality may be displayed when available, but it does not block the current
flow until a verified official Shenyang DOM state proves that it is required.
The official account email is a VIZA-managed applicant alias, and the account
password is generated and encrypted by the worker. Neither is collected in the
appointment UI.

## Server Design

The Korea appointment API builds one normalized Shenyang applicant snapshot
from application answers plus universal-profile fallbacks. Each returned field
contains a redacted/display-safe value, its source (`korea_form`,
`universal_profile`, or `appointment_supplement`), and whether it is required.
Raw passport and phone values never appear in the GET response.

`confirm-review` accepts a scoped `shenyangApplicantDetails` payload only when
the resolved current center is `shenyang`. The route validates ownership,
center, formats, and the current application type; upserts only supplied
canonical fields into `visa_application_answers`; reloads the normalized
snapshot; and persists review confirmation only when every required field is
complete. The save and confirmation occur before any Fly wake or official HTTP
request.

For non-Shenyang centers, the route ignores or rejects the Shenyang supplement
payload and continues to use the existing review contract. A center change away
from Shenyang therefore removes the Shenyang fields and gates from the next
snapshot without deleting the application-scoped answers.

The submission worker's canonical answer loader is aligned with the same
precedence so final applicant filling sees the values confirmed by the UI.
Application answers continue to override profile fallbacks.

## Frontend Design

The five-stage FSM remains unchanged. Only the `review` card changes, and only
for Shenyang:

- available values appear in the compact summary with a localized source label;
- only missing required fields render as inputs below the summary;
- field-level format errors appear beside the corresponding input;
- the existing center card and center-change drawer remain unchanged; and
- one primary action saves any supplements and confirms the review.

The primary action label becomes “保存并确认资料” when Shenyang fields require
input and remains “确认资料并继续” when all values were resolved automatically.
During submission, the existing stable-height loading treatment disables
duplicate clicks. The card does not add a second alert dashboard or a new FSM
stage.

Switching to another center immediately restores that center's existing review
summary and validation. Switching back to Shenyang reloads the current
application answers, including any earlier Shenyang supplements.

All new copy is added to `messages/zh.json` and `messages/en.json`. Styling uses
the existing brand navy palette, heading/body typography, field components,
spacing, and accessible focus behavior.

## Validation and Error Handling

Validation is duplicated intentionally at the UI and server boundaries:

- surname and given names must be non-empty passport-style Latin text;
- date of birth and passport expiry must be valid ISO dates, with expiry later
  than the current date;
- passport number must use the existing safe passport character set and length
  bounds; and
- the phone must normalize to an 11-digit mainland China mobile number.

Server validation is authoritative. A rejected supplement returns structured
field errors without creating a job, starting Fly, or changing review
confirmation. Database failures return a calm retry message and preserve the
current review stage. Internal table names, worker URLs, and raw Supabase errors
are never exposed to the applicant.

## Testing

Focused tests cover:

- Korea-form values winning over universal-profile values;
- universal-profile fallback when Korea answers are absent;
- application-only supplement persistence and reload;
- Shenyang-only rendering and validation;
- unchanged review behavior for every non-Shenyang center;
- missing-field inputs, source labels, masked values, and one primary CTA;
- invalid date, passport, English-name, and phone formats;
- `confirm-review` remaining Fly-free and official-site-free;
- the worker receiving the same canonical values after confirmation; and
- 375 px and desktop browser smoke with no overflow or duplicate stage card.

Deployment includes the Vercel frontend/API and the retained South Korea Fly
worker only if the worker package changes. The production smoke stops before
VFS account creation, activation email, SMS, slot booking, or final submission.
