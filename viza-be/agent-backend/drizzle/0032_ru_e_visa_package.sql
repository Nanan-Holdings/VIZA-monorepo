-- Add Russia Unified e-Visa to the visa_packages catalog.
-- Companion seed script: scripts/seed-ru-e-visa-form-fields.ts

INSERT INTO visa_packages (country, visa_type, name, description) VALUES
  (
    'russia',
    'RU_E_VISA',
    'Russia Unified e-Visa',
    'Russia Unified e-Visa (introduced August 2023) issued by the Ministry of Foreign Affairs Consular Department (KD MID) via evisa.kdmid.ru. Single-entry only, 16-day validity, 16-day max stay, ~USD 52, for the ~55 eligible nationalities (China, India, Bahrain, Iran, Mexico, Saudi Arabia, Turkey, Singapore, Japan, Indonesia, Philippines, Vietnam, etc.). Mandatory medical insurance with min ~30,000 EUR coverage. Restricted to Ordinary passport holders. Out of scope: consular paper visa (tourist / business / private / humanitarian / work / study / transit / dependant — applied at Russian embassy abroad), legacy Free e-Visa for FEZ Vladivostok / Kaliningrad (superseded August 2023), and visa-free regimes (CIS / SCO).'
  )
ON CONFLICT DO NOTHING;
