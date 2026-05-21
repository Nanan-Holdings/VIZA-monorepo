# MVP-2 launch gate: AU + VN + UK

> Last reviewed: 2026-05-08.

Adds three high-volume markets after MVP-1 has 30 days of clean operation.

## Pre-requisites

- [ ] MVP-1 (US + FR) completed 30 days clean operation with success rate ≥ 95%.
- [x] AUTO-AU-01..04 `passes: true` (Subclass 600 — TRN flow + ImmiAccount auth).
- [x] AUTO-VN-01..04 `passes: true` (e-Visa — applicant_direct_link + email PDF capture).
- [x] AUTO-UK-01..04 `passes: true` (Standard Visitor — two-step Worldpay + GWF reference).

## Per-country government-fee mechanism

| Country | Mechanism (PAY-003) | Notes |
|---|---|---|
| AU | runner_escrow_card | TRN captured at payment; grant letter via inbound email. |
| VN | applicant_direct_link | Applicant pays directly on evisa.gov.vn (chargeback risk). |
| UK | runner_escrow_card | Worldpay; GWF reference; biometrics appointment downstream. |

## Pre-launch checklist

- [x] All AUTO-AU/VN/UK stories `passes: true`.
- [ ] 5 internal end-to-end submissions per country.
- [x] Per-country canary monitors live.
- [x] Per-country runbooks shipped (`docs/runbooks/au.md`, `vn.md`, `uk.md`).
- [ ] 30-day MVP-1 clean-ops gate evidence in `docs/launch/mvp-1-retrospective.md`.

## Linked from

- [docs/launch/mvp-1.md](./mvp-1.md) — predecessor gate.
- [docs/runbooks/](../runbooks/) — per-country runbooks.
