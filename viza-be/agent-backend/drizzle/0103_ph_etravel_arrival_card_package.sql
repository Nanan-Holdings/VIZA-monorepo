-- Add standalone Philippines eTravel arrival-card package.
-- Companion seed script:
--   scripts/seed-ph-etravel-arrival-card-form-fields.ts

INSERT INTO visa_packages (country, visa_type, name, description) VALUES
  (
    'philippines',
    'PH_ETRAVEL_ARRIVAL_CARD',
    'Philippines eTravel Arrival Card',
    'Philippines eTravel preparation for arriving foreign passengers through the official etravel.gov.ph channel. eTravel is free, normally submitted within 72 hours before arrival, and combines travel, border-control, health, customs, and currency declaration data. This package is not a Philippines 9(a) Temporary Visitor Visa and must stay separate from PH_TEMPORARY_VISITOR_VISA. Out of scope: 9(a) visa applications, departing Filipino passenger declarations, crew declarations, group/family submissions, payment, and non-official websites.'
  )
ON CONFLICT DO NOTHING;
