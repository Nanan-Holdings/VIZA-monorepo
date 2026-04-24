-- Add EU Schengen Type C (short-stay) Visa to the visa_packages catalog.
-- Companion seed script: scripts/seed-eu-schengen-c-short-stay-form-fields.ts
--
-- The Schengen Type C visa is a multilateral short-stay visa (up to 90 days
-- in any 180-day period) accepted by all 29 Schengen Area member states.
-- It is issued by the member state of main destination under the harmonized
-- Annex I form (EU Regulation 810/2009).

INSERT INTO visa_packages (country, visa_type, name, description) VALUES
  ('european_union', 'EU_SCHENGEN_C_SHORT_STAY', 'Schengen Short-Stay Visa (Type C)', 'Multilateral short-stay visa for the Schengen Area — up to 90 days in any 180-day period, accepted by all 29 Schengen member states. Covers tourism, business, visiting family/friends, cultural, sports, official visit, medical, short-term study, airport transit.')
ON CONFLICT DO NOTHING;
