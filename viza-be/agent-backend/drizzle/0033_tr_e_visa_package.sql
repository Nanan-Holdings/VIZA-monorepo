-- Add Türkiye e-Visa to the visa_packages catalog.
-- Companion seed script: scripts/seed-tr-e-visa-form-fields.ts

INSERT INTO visa_packages (country, visa_type, name, description) VALUES
  (
    'turkey',
    'TR_E_VISA',
    'Türkiye Tourist e-Visa',
    'Republic of Türkiye Tourist e-Visa issued by the Ministry of Foreign Affairs via evisa.gov.tr. Single-entry (~USD 50) and multiple-entry (~USD 80) variants share a 180-day validity and 30 or 90-day max stay (nationality-dependent). Tourism + commerce (business visit) purposes covered. Restricted to Ordinary passport holders. Out of scope: Work Permit (Çalışma İzni), Student Visa (consular flow), Humanitarian Residence Permit, Long-term / Family Residence Permit, Citizenship by Investment, and visa-on-arrival (largely eliminated post-2013).'
  )
ON CONFLICT DO NOTHING;
