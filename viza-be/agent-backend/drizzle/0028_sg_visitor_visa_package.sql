-- Add Singapore Visit Visa to the visa_packages catalog.
-- Companion seed script: scripts/seed-sg-visitor-visa-form-fields.ts

INSERT INTO visa_packages (country, visa_type, name, description) VALUES
  (
    'singapore',
    'SG_VISITOR_VISA',
    'Singapore Visit Visa (Tourist / Social)',
    'Singapore Visit Visa for short-term tourism / social visits, processed by the Immigration & Checkpoints Authority (ICA) via the SAVE (Singapore Application for Visa Electronically) e-Service. Single-entry (~SGD 30, up to 35-day validity, 30-day stay) and multi-entry (~SGD 30, 1-5 year validity, 30-day stay per entry) variants are covered by the same field set; the variant is captured by the visa_type_requested field. SAVE applications by visa-required nationals must be submitted by a local sponsor (Singapore Citizen / PR aged 21+, ACRA-registered company, authorised visa agent, or strategic partner). Restricted to Ordinary passport holders. Out of scope: Employment Pass / S Pass / Work Permit (MOM portal), Long-Term Visit Pass (LTVP), Student Pass (STP), Dependant''s Pass (DP), and PR application.'
  )
ON CONFLICT DO NOTHING;
