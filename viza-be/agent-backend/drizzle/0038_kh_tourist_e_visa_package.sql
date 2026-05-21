-- Add Cambodia Tourist e-Visa to the visa_packages catalog.
-- Companion seed script: scripts/seed-kh-e-visa-form-fields.ts

INSERT INTO visa_packages (country, visa_type, name, description) VALUES
  (
    'cambodia',
    'KH_TOURIST_E_VISA',
    'Cambodia Tourist e-Visa',
    'Kingdom of Cambodia Tourist e-Visa issued by the Ministry of Foreign Affairs and International Cooperation via evisa.gov.kh. Single-entry only (~USD 36 incl. service fee, 3-month validity, 30-day stay). Restricted to Ordinary passport holders. Out of scope: Business e-Visa, Ordinary Visa categories applied at consular posts (E-Class for work, K-Class for foreign dependants of Cambodian citizens, etc.), and visa-on-arrival (most nationalities, USD 30 cash at major entry points).'
  )
ON CONFLICT DO NOTHING;
