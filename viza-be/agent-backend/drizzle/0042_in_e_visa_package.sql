-- Add India e-Visa to the visa_packages catalog.
-- Companion seed script: scripts/seed-in-e-visa-form-fields.ts

INSERT INTO visa_packages (country, visa_type, name, description) VALUES
  (
    'india',
    'IN_E_VISA',
    'India e-Visa (Tourist / Business / Medical / Conference)',
    'Government of India e-Visa issued by Ministry of Home Affairs Bureau of Immigration via indianvisaonline.gov.in/evisa. Seven variants on visa_type_requested: e-Tourist 30-day double entry (~USD 25), e-Tourist 1-year multi (~USD 40, max 90-day stay or 180 for US/UK/CA/JP), e-Tourist 5-year multi (~USD 80, max 90-day per visit), e-Business 1-year multi (~USD 80, max 180-day stay), e-Medical 60-day triple (~USD 80), e-Medical-Attendant 60-day triple (~USD 80), e-Conference 30-day single (~USD 80). Sub-purpose details captured per category in step 6 (Indian inviter / hospital / conference + MEA clearance number). SAARC nationality declaration mandatory. Restricted to Ordinary passport holders. Out of scope: Regular Tourist Visa (consular paper), Employment Visa, Student Visa, Research Visa, Journalist Visa, OCI, and consular paper categories.'
  )
ON CONFLICT DO NOTHING;
