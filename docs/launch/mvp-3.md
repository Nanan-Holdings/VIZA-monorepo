# MVP-3 launch gate: AUTO-T1 (KH/LA/LK/ZA/IN)

> Last reviewed: 2026-05-08.

Adds the recon-scaffolded countries once their AUTO-T1 stories close.

## Pre-requisites

- [x] AUTO-KH-01..04 `passes: true` (Cambodia e-Visa).
- [x] AUTO-LA-01..04 `passes: true` (Laos e-Visa).
- [x] AUTO-LK-01..04 `passes: true` (Sri Lanka ETA).
- [x] AUTO-ZA-01..04 `passes: true` (South Africa eVisa pilot — VFS Global).
- [x] AUTO-IN-01..04 `passes: true` (India e-Visa with sub-journey gating).

## Per-country canary monitors

| Country | Canary URL | SLA seed (median / p95) | Concurrency cap |
|---|---|---|---|
| KH | https://www.evisa.gov.kh/ | 24 h / 96 h | 2 |
| LA | https://laoevisa.gov.la/ | 72 h / 168 h | 2 |
| LK | https://eta.gov.lk/ | 24 h / 96 h | 2 |
| ZA | https://visa.vfsglobal.com/zaf/en/dha | 120 h / 240 h | 1 |
| IN | https://indianvisaonline.gov.in/evisa/ | 72 h / 168 h | 2 |

## Pre-launch checklist

- [x] All AUTO-T1 stories `passes: true`.
- [x] Per-country canary monitors live (OPS-004).
- [x] Per-country runbooks shipped (`docs/runbooks/{kh,la,lk,za,in}.md`).
- [ ] 10 staging-mode runs per country at ≥95% success.
- [ ] MVP-2 clean-ops gate evidence (30 days @ ≥95%).

## Linked from

- [docs/launch/mvp-2.md](./mvp-2.md) — predecessor gate.
- [docs/runbooks/](../runbooks/) — per-country runbooks.
