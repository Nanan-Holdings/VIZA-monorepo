-- Add Vietnam E-Visa to the visa_packages catalog.
-- Companion seed script: scripts/seed-vn-e-visa-form-fields.ts
--
-- The Vietnam E-Visa is a single electronic-visa product (up to 90 days,
-- single or multiple entry) issued by the Vietnam Immigration Department
-- via https://evisa.gov.vn. All nationalities have been eligible since
-- August 2023 (Resolution 127/NQ-CP).

INSERT INTO visa_packages (country, visa_type, name, description) VALUES
  ('vietnam', 'VN_E_VISA', 'Vietnam E-Visa', 'Electronic visa for Vietnam — up to 90 days, single or multiple entry. Issued by the Vietnam Immigration Department via evisa.gov.vn. Covers tourism, visiting relatives, business, short-term working, and other general-purpose visits.')
ON CONFLICT DO NOTHING;
