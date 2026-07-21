-- Add a standalone Philippines eTravel departure-card package.
-- Companion seed script:
--   scripts/seed-ph-etravel-departure-card-form-fields.ts

INSERT INTO visa_packages (country, visa_type, name, description) VALUES
  (
    'philippines',
    'PH_ETRAVEL_DEPARTURE_CARD',
    'Philippines eTravel Departure Card',
    'Philippines eTravel departure declaration preparation through the official etravel.gov.ph channel. The service is free and normally opens within 72 hours before departure. Filipino departure registration and nationality-specific travel-tax controls remain distinct from foreign-traveller customs and currency declarations. Out of scope: visas, crew, group submissions, payment, and non-official websites.'
  )
ON CONFLICT DO NOTHING;
