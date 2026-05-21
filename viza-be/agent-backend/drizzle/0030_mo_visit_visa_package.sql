-- Add Macau Visit Visa to the visa_packages catalog.
-- Companion seed script: scripts/seed-mo-visit-visa-form-fields.ts

INSERT INTO visa_packages (country, visa_type, name, description) VALUES
  (
    'macau',
    'MO_VISIT_VISA',
    'Macau Visit Visa',
    'Macau Visit Visa for the small visa-required population (~13 nationalities incl. Bangladesh, Pakistan, Nepal, Sri Lanka, Nigeria) AND visa-on-arrival pre-clearance for the ~80 VOA-eligible nationalities, processed by the Macao Public Security Police Force / DSI (Direcção dos Serviços de Identificação) via paper application by post or via Chinese consular posts abroad. Three submission variants (VOA single MOP 100, VOA multiple MOP 200, paper Visit Visa for visa-required nationalities) share the same field set; the variant is captured by the visa_type_requested field. Restricted to Ordinary passport holders. Out of scope: Macau Resident ID (BIR / BIRH), Non-Resident Worker Card (Blue Card), Investor Residence (CIPIM scheme), Student Visa, and Mainland-specific entry permits.'
  )
ON CONFLICT DO NOTHING;
