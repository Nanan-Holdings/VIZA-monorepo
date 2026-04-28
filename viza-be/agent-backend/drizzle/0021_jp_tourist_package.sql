-- Add Japan Tourist Visa (Short-Term Stay) to the visa_packages catalog.
-- Companion seed script: scripts/seed-jp-tourist-form-fields.ts

INSERT INTO visa_packages (country, visa_type, name, description) VALUES
  (
    'japan',
    'JP_TOURIST',
    'Japan Tourist Visa (Short-Term Stay)',
    'Japan Short-Term Stay (Tourism) visa, schema modeled on the MOFA Application for Visa form (Form A). Intended for mainland-China (PRC) residents who submit the completed form through a designated travel agency, since the evisa.mofa.go.jp self-service portal is not directly accessible to PRC residents. Other Tourism-eligible nationalities may also use the schema; their submission channel (embassy or eVisa portal) is documented in the gap report.'
  )
ON CONFLICT DO NOTHING;
