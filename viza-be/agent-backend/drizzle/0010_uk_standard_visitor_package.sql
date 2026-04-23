-- Add UK Standard Visitor Visa to the visa_packages catalog.
-- Companion seed script: scripts/seed-uk-standard-visitor-form-fields.ts

INSERT INTO visa_packages (country, visa_type, name, description) VALUES
  ('united_kingdom', 'UK_STANDARD_VISITOR', 'UK Standard Visitor Visa', 'Standard visitor visa for the United Kingdom (up to 6 months)')
ON CONFLICT DO NOTHING;
