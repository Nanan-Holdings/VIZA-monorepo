# Appointment Assistant State Contract

Use this contract for every VIZA appointment assistant.

| Stage | Source of truth | User sees | Allowed primary transition |
| --- | --- | --- | --- |
| `review` | Application and universal profile | Actual saved applicant values, provider-specific reference, selected center/post, missing values | Persist consent and create/resume one idempotent job |
| `account` | Job, official account, pending manual action | Current official-account operation or one checkpoint | Run/resume the worker or complete the displayed checkpoint |
| `slots` | Non-expired official observations | Available official times or an explicit no-slots result | Refresh observations or select one observed slot |
| `confirm` | Selected slot, fee/payment state, final approval | Exact selected time/location and only relevant fee/approval controls | Persist final approval, then invoke the separately gated official confirmation |
| `result` | Official confirmation and evidence | Confirmation reference, date, time, location, and evidence/status controls | Read or refresh official status |

## Stage Mapping Priority

Map from the most conclusive state downward:

1. Official confirmation evidence means `result`.
2. A selected slot or pending final approval means `confirm`.
3. Official slot observations or a no-slots result mean `slots`.
4. An active job means `account`.
5. No active job, or a restartable failed/cancelled job, means `review`.

Never let polling move a user backward from a more conclusive persisted state.
Terminal failure and cancellation should expose a clear restart path through a
fresh review and consent transition.

## Review Contract

The review card must show, when applicable:

- passport-matching English name;
- date of birth and nationality;
- passport number and expiry;
- phone, personal email, and residential address;
- provider-specific application reference, such as DS-160 or France-Visas;
- embassy, consulate, VAC, or appointment center.

Render missing fields as “not provided”; never use sample values. Link Edit back
to the authoritative VIZA form. The Confirm action must remain disabled until
required local confirmation inputs are complete.

## Safety and Evidence Contract

- Do not create jobs, official sessions, or accounts on initial page render.
- Treat CAPTCHA solving as a checkpoint capability, not proof of success.
- Save screenshots, final URL, page state, and replay identifiers in redacted
  evidence storage. Do not log credentials, OTPs, document contents, or CDP URLs.
- Keep user selection and final approval distinct even when the provider has one
  combined official button.
- Make retries idempotent and preserve existing lease/concurrency controls.
