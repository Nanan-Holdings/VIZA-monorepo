-- Add Egypt e-Visa (Tourist) to the visa_packages catalog.
-- Companion seed script: scripts/seed-eg-e-visa-form-fields.ts

INSERT INTO visa_packages (country, visa_type, name, description) VALUES
  (
    'egypt',
    'EG_E_VISA',
    'Egypt e-Visa (Tourist)',
    'Egypt online tourist visa issued by the Ministry of Interior via visa2egypt.gov.eg. Single-entry (USD 30) and multiple-entries (USD 65) variants are covered by the same field set; the variant is captured by the visa_type_requested field. Restricted to Ordinary passport holders — diplomatic / service / official / special / refugee / temporary passport types must apply via embassy / consulate. Out of scope: business e-Visa, consular long-stay categories (work / study / residence), Sinai-only entry permits, and visa-on-arrival paid at the border kiosk.'
  )
ON CONFLICT DO NOTHING;
