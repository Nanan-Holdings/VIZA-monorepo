-- Add standalone Vietnam Pre-Arrival Information declaration package.
-- Companion seed script:
--   scripts/seed-vn-prearrival-declaration-form-fields.ts

INSERT INTO visa_packages (country, visa_type, name, description) VALUES
  (
    'vietnam',
    'VN_PREARRIVAL_DECLARATION',
    'Vietnam Pre-Arrival Information Declaration',
    'Vietnam Pre-Arrival Information declaration preparation for foreign-passport arrivals through the official Immigration Department portal at prearrival.immigration.gov.vn. This declaration is free, separate from the Vietnam e-Visa, and is currently associated with arrivals at Tan Son Nhat International Airport with a 72-hour pre-arrival submission window. The package collects traveller identity, passport, entry-permission, transport, Viet Nam address, contact, and declaration details. Health declaration support is informational only unless the Ministry of Health activates specific guidance and opens the official system; do not use tokhaiyte.vn for the new 2026 health declaration framework. Out of scope: Vietnam e-Visa applications, official fee payment, residence registration after arrival, group/family submissions in v1, and non-official websites.'
  )
ON CONFLICT DO NOTHING;
