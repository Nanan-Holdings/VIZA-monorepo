-- Add South Africa Visitor's Visa to the visa_packages catalog.
-- Companion seed script: scripts/seed-za-visitor-visa-form-fields.ts

INSERT INTO visa_packages (country, visa_type, name, description) VALUES
  (
    'south_africa',
    'ZA_VISITOR_VISA',
    'South Africa Visitor''s Visa + eVisa',
    'South Africa Visitor''s Visa (Section 11) processed by Department of Home Affairs (DHA) via VFS Global, plus eVisa pilot at evisa.gov.za for selected nationalities (CN/IN/NG/KE/CM/MX/SA/AE/EG). Three variants on visa_type_requested: eVisa (~ZAR 1,520 online), Visitor Single (~ZAR 1,520, up to 3-month stay), Visitor Multiple (~ZAR 1,520, up to 3-year validity, 3-month stay per entry). Includes yellow-fever endemic-country travel screening (mandatory South African public-health rule). Restricted to Ordinary passport holders. Out of scope: General Work / Critical Skills / Intra-Company Transfer / Business Visa, Study Visa, Relative''s Visa, Retired Person''s Visa, Treaty Visa, Permanent Residence, Asylum Seeker Permit.'
  )
ON CONFLICT DO NOTHING;
