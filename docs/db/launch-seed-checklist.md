# Launch Seed Checklist — visa_packages for the 16 launch countries

Artifact for **MIG-006**. Lists the `visa_packages` rows required for every
launch country, keyed to `viza-fe/internal-website/lib/pricing.ts`
(`country` + `visaType`). **No DB writes are performed by the agent.**

`visa_packages` is created in `viza-be/agent-backend/drizzle/0006_visa_packages.sql`
(plus per-country package migrations `0010_*`, `0011_*`, `0012_vn_*`). Each launch
country needs at least one `(country, visa_type)` row whose keys match `pricing.ts`.

## Required rows (16 launch countries)

| Country (canonical) | visa_type (pricing key) | In `pricing.ts`? |
| --- | --- | --- |
| indonesia | `B211A` / `ID_C1_TOURIST` | ✅ |
| egypt | `EG_E_VISA` | ✅ |
| australia | `AU_VISITOR_600` | ✅ |
| saudi_arabia | `SA_E_VISA` | ✅ (added MKT-007) |
| united_kingdom | `UK_STANDARD_VISITOR` | ✅ |
| vietnam | `VN_E_VISA` | ✅ |
| malaysia | `MY_TOURIST_E_VISA` | ✅ |
| japan | `JP_TOURIST` | ✅ |
| united_states | `B1_B2` | ✅ |
| canada | `CA_TRV` | ✅ |
| turkey | `TR_E_VISA` | ✅ |
| thailand | `TH_TOURIST_E_VISA` | ✅ |
| united_arab_emirates | `AE_TOURIST_VISA` | ✅ |
| france | `EU_SCHENGEN_C_SHORT_STAY` (FR deposit) | ✅ (added MKT-007) |
| italy | `EU_SCHENGEN_C_SHORT_STAY` (IT deposit) | ✅ (added MKT-007) |
| india | `IN_E_VISA` | ✅ |

## Gaps to close before launch

`pricing.ts` currently has 27 entries but is **missing saudi_arabia, italy, and
france**, and prices in USD. Before launch:

1. Add `saudi_arabia`, `italy`, `france` pricing entries to `lib/pricing.ts`
   (tracked by **PAYP-001** / **PAYP-007**). EU Schengen entries already exist
   (`EU_SCHENGEN_C_SHORT_STAY`); France and Italy reuse the Schengen package but
   need their own country rows so the marketing + portal country pickers and the
   `visa_packages` lookup resolve.
2. Seed matching `visa_packages` rows for all 16 so the portal wizard and pricing
   lookup succeed.
3. Confirm each launch country's `visa_type` key is identical across
   `pricing.ts`, `visa_packages`, the dispatch table (`dispatch.ts`), and the
   marketing country metadata (MKT-002).

## Verification

After seeding, the launch-readiness script (OBSV-004) should assert a
`visa_packages` row exists for each of the 16 launch (country, visa_type) pairs.
