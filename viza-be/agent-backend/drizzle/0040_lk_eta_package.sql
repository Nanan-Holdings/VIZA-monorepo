-- Add Sri Lanka ETA to the visa_packages catalog.
-- Companion seed script: scripts/seed-lk-eta-form-fields.ts

INSERT INTO visa_packages (country, visa_type, name, description) VALUES
  (
    'sri_lanka',
    'LK_ETA',
    'Sri Lanka ETA (Electronic Travel Authorization)',
    'Sri Lanka ETA issued by the Department of Immigration and Emigration via eta.gov.lk. Four variants on visa_type_requested: Tourist single (~USD 35-50), Tourist double (~USD 50-75), Tourist multiple (~USD 60-100), Business single (~USD 40-60). All variants 30-day stay per entry. Restricted to Ordinary passport holders. Out of scope: Resident Visa, Work Visa, Student Visa, Investor Visa, Dependent Visa, Diplomatic / Official.'
  )
ON CONFLICT DO NOTHING;
