-- Add Thailand Tourist e-Visa to the visa_packages catalog.
-- Companion seed script: scripts/seed-th-tourist-e-visa-form-fields.ts

INSERT INTO visa_packages (country, visa_type, name, description) VALUES
  (
    'thailand',
    'TH_TOURIST_E_VISA',
    'Thailand Tourist e-Visa',
    'Thailand online tourist visa issued by the Royal Thai Ministry of Foreign Affairs via thaievisa.go.th. Single-entry Tourist Visa (TR, ~USD 30, 60-day max stay) and Multiple-Entry Tourist Visa (METV, ~USD 150, 6-month validity, 60-day max stay per entry) are covered by the same field set; the variant is captured by the visa_type_requested field. Restricted to Ordinary passport holders. Out of scope: Non-Immigrant categories (B / ED / O / IM), DTV (Destination Thailand Visa), Smart Visa, LTR visa, visa-on-arrival, and visa exemption.'
  )
ON CONFLICT DO NOTHING;
