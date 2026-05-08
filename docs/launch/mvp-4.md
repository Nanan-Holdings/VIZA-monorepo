# MVP-4 launch gate: AUTO-T3 prefill cohort

> Last reviewed: 2026-05-08.

Adds the remaining online-portal countries (12 prefill targets via the shared `runGenericPrefill` harness) once their AUTO-T3 stories close.

## Pre-requisites

| Country | Story | Portal | Notes |
|---|---|---|---|
| ID | AUTO-T3-ID | evisa.imigrasi.go.id | |
| EG | AUTO-T3-EG | visa2egypt.gov.eg | |
| IT | AUTO-T3-IT | visa.vfsglobal.com/chn/zh/ita | China-corridor only. |
| TH | AUTO-T3-TH | thaievisa.go.th | |
| MY | AUTO-T3-MY | evisa.imi.gov.my | |
| NZ | AUTO-T3-NZ | immigration.govt.nz/eta | |
| RU | AUTO-T3-RU | electronic-visa.kdmid.ru | |
| TR | AUTO-T3-TR | evisa.gov.tr | |
| AE | AUTO-T3-AE | smartservices.icp.gov.ae | |
| CA-eTA | AUTO-T3-CA | onlineservices-servicesenligne.cic.gc.ca | TRV stubbed pending GCKey live-QA. |
| MV | AUTO-T3-MV | imuga.immigration.gov.mv | Free entry permit. |
| PH-eTravel | AUTO-T3-PH | etravel.gov.ph | Mixed pipeline (paper 9(a) tracked separately). |

## Pre-launch checklist

- [x] Each online-portal AUTO-T3 country `passes: true`.
- [x] Per-country canary monitors live (OPS-004).
- [ ] 10 staging-mode runs per country at ≥95% success (relaxed to 5 for MV/CA-eTA where volumes are lower).
- [ ] MVP-3 clean-ops gate evidence (30 days @ ≥95%).
- [ ] CA-TRV GCKey OAuth captures landed; runner upgraded from stub.

## Known limitations

- Cuba, Iran, North Korea, Syria, Yemen, and Western Sahara are NOT supported in MVP-4 — sanctions / OFAC compliance review pending.
- IT corridor only services applicants applying via VFS-CN (China-mainland). Other Schengen corridors via FR/DE/ES will land in a later launch.

## Linked from

- [docs/launch/mvp-3.md](./mvp-3.md) — predecessor gate.
- [docs/runbooks/](../runbooks/) — per-country runbooks (T3 cohort uses lighter-weight per-runner notes).
