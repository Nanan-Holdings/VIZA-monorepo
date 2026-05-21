-- Add Canada TRV / eTA to the visa_packages catalog.
-- Companion seed script: scripts/seed-ca-trv-form-fields.ts

INSERT INTO visa_packages (country, visa_type, name, description) VALUES
  (
    'canada',
    'CA_TRV',
    'Canada Temporary Resident Visa (TRV) + eTA',
    'Canada Temporary Resident Visa (TRV — Visitor Visa) and Electronic Travel Authorization (eTA) issued by Immigration, Refugees and Citizenship Canada (IRCC) via the IRCC Secure Account portal at ircc.canada.ca (GCKey or Sign-In Partner authenticated). Three variants: eTA (visa-waiver nationals, ~CAD 7, 5-year validity, 6-month stay), TRV single-entry (~CAD 100, up to 6-month stay), and TRV multi-entry (~CAD 100, up to 10-year validity, 6-month stay per entry). Restricted to Ordinary passport holders. Out of scope: Work Permit (LMIA-based / Open / Post-Graduation), Study Permit, Permanent Residence (Express Entry / PNP / Family Sponsorship / Atlantic / Quebec), Super Visa for parents/grandparents, Refugee/Protected Person, and Inland TRP.'
  )
ON CONFLICT DO NOTHING;
