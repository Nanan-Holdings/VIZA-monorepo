-- Add Hong Kong Visit Visa to the visa_packages catalog.
-- Companion seed script: scripts/seed-hk-visit-visa-form-fields.ts

INSERT INTO visa_packages (country, visa_type, name, description) VALUES
  (
    'hong_kong',
    'HK_VISIT_VISA',
    'Hong Kong Visit Visa',
    'Hong Kong Visit Visa for the ~76 visa-required nationalities, processed by the Hong Kong Immigration Department (ImmD) via Form ID 936 (Application for Visa to enter Hong Kong) submitted by post or via Chinese consular posts abroad. The Pre-arrival Registration (PAR) flow at immd.gov.hk/par for Indian nationals only is captured as a variant via visa_type_requested. Single-entry (~HKD 230) and multiple-entry (~HKD 460) variants share the same field set. Restricted to Ordinary passport holders. Out of scope: Right of Abode, Right to Land, HKID Card application, Employment Visa (GEP), QMAS, Top Talent Pass Scheme (TTPS), Investment as Entrepreneurs, Working Holiday Scheme, Dependant Visa, Student Visa, training programmes, and Mainland-specific entry permits.'
  )
ON CONFLICT DO NOTHING;
