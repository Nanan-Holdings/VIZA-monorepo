# Country compliance addenda (LEGAL-006)

Per-jurisdiction notes for each country with **material data rules** in
the VIZA schema. Each note flags whether VIZA's current architecture
appears compliant or needs work, alongside the obligations that apply
to us as either a controller (collecting applicant data ourselves) or a
processor (acting for B2B customers).

Schema set: every country with a `*_package.sql` migration in
`viza-be/agent-backend/drizzle/`. Countries without material privacy
regimes (e.g. those that do not yet have an enacted personal-data-
protection law affecting our service) are not addressed here; counsel
review may add new files as legal posture evolves.

| Jurisdiction | File | Status |
|---|---|---|
| EU (Schengen) | [eu.md](./eu.md) | Largely compliant; SCC paperwork pending. |
| UK | [uk.md](./uk.md) | Largely compliant; UK-IDTA review pending. |
| Singapore | [sg.md](./sg.md) | Compliant (home jurisdiction). |
| India | [in.md](./in.md) | DPDPA gap: consent manager registration TBD. |
| China | [cn.md](./cn.md) | Not applicable — VIZA does not operate in mainland China. |
| Australia | [au.md](./au.md) | Largely compliant; APP-8 cross-border review pending. |
| Canada | [ca.md](./ca.md) | Largely compliant; Quebec Law 25 review pending. |
| United States | [us.md](./us.md) | CPRA aligned; state-level monitoring needed. |
| South Korea | [kr.md](./kr.md) | Needs work — PIPA cross-border consent. |
| Japan | [jp.md](./jp.md) | Largely compliant; APPI joint disclosures TBD. |
| South Africa | [za.md](./za.md) | POPIA-aligned; Information Officer designation pending. |
| Vietnam | [vn.md](./vn.md) | Needs work — Decree 13/2023 cross-border filing. |
| Indonesia | [id.md](./id.md) | UU PDP transition phase; needs review on entry into force. |
| Thailand | [th.md](./th.md) | PDPA-aligned; needs DPO designation. |
| New Zealand | [nz.md](./nz.md) | Largely compliant. |

Cross-linked from `docs/legal/subprocessors.md`.
