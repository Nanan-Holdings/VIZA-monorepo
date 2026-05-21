-- Add Australia Visitor Visa (Subclass 600) to the visa_packages catalog.
-- Companion seed script: scripts/seed-au-visitor-600-form-fields.ts

INSERT INTO visa_packages (country, visa_type, name, description) VALUES
  (
    'australia',
    'AU_VISITOR_600',
    'Australia Visitor Visa (Subclass 600)',
    'Australia Subclass 600 Visitor Visa umbrella covering the Tourist, Business Visitor, Sponsored Family, Approved Destination Status (ADS) and Frequent Traveller streams. Stays of up to 12 months with single or multiple entries depending on the stream.'
  )
ON CONFLICT DO NOTHING;
