-- Add Laos Tourist e-Visa to the visa_packages catalog.
-- Companion seed script: scripts/seed-la-e-visa-form-fields.ts

INSERT INTO visa_packages (country, visa_type, name, description) VALUES
  (
    'laos',
    'LA_TOURIST_E_VISA',
    'Laos Tourist e-Visa',
    'Lao PDR Tourist e-Visa issued by the Ministry of Foreign Affairs via laoevisa.gov.la. Two variants on visa_type_requested: e-Visa single-entry (~USD 35-50, nationality-dependent, 60-day validity, 30-day stay) and Visa-on-Arrival (~USD 30-45, single-entry at VOA-eligible borders). Restricted to Ordinary passport holders. Out of scope: Business / NA-B Visa, Long-Stay Visa (NA-LS), Investment Visa, and Lao consular paper visas.'
  )
ON CONFLICT DO NOTHING;
