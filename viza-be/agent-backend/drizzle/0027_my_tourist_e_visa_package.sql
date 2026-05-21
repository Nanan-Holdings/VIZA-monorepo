-- Add Malaysia Tourist eVISA to the visa_packages catalog.
-- Companion seed script: scripts/seed-my-tourist-e-visa-form-fields.ts

INSERT INTO visa_packages (country, visa_type, name, description) VALUES
  (
    'malaysia',
    'MY_TOURIST_E_VISA',
    'Malaysia Tourist eVISA',
    'Malaysia online tourist visa issued by the Department of Immigration (Jabatan Imigresen Malaysia, Kementerian Dalam Negeri) via malaysiavisa.imi.gov.my. Single-entry (~USD 50, 3-month validity, 30-day stay) and multiple-entry (~USD 100, 12-month validity, 30-day stay per entry) variants are covered by the same field set; the variant is captured by the visa_type_requested field. Restricted to Ordinary passport holders. Out of scope: Employment Pass / DP10 / Expatriate / MyXpats categories, MM2H Long-Term Social Visit Pass, Premium Visa Programme (PVIP), Sarawak / Sabah-internal entry permits, visa-on-arrival, and visa exemption.'
  )
ON CONFLICT DO NOTHING;
