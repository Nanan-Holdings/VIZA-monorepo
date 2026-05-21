-- Add Maldives IMUGA Traveller Declaration to the visa_packages catalog.
-- Companion seed script: scripts/seed-mv-imuga-form-fields.ts

INSERT INTO visa_packages (country, visa_type, name, description) VALUES
  (
    'maldives',
    'MV_IMUGA',
    'Maldives IMUGA Traveller Declaration',
    'Maldives IMUGA Traveller Declaration submitted via imuga.immigration.gov.mv (Immigration Maldives) within 96 hours of arrival. Maldives grants 30-day free visa-on-arrival to all nationalities, so this declaration replaces what would be a tourist visa application in countries that require one. Includes arrival, accommodation, health, and customs declarations. Out of scope: Resort Permit, Business Visa, Long-Stay Visa (Marriage / Dependant), Work Visa (Employment Approval letter required), Student Visa.'
  )
ON CONFLICT DO NOTHING;
