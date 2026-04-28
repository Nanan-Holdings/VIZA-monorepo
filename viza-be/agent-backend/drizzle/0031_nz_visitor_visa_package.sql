-- Add New Zealand Visitor Visa to the visa_packages catalog.
-- Companion seed script: scripts/seed-nz-visitor-visa-form-fields.ts

INSERT INTO visa_packages (country, visa_type, name, description) VALUES
  (
    'new_zealand',
    'NZ_VISITOR_VISA',
    'New Zealand Visitor Visa',
    'New Zealand Visitor Visa processed by Immigration New Zealand (INZ) via the Immigration Online portal at onlineservices.immigration.govt.nz. Three submission variants captured by visa_type_requested: NZeTA (Electronic Travel Authority for visa-waiver nationals, online, ~NZD 17 + IVL NZD 100), Visitor Visa Single Entry (~NZD 211, up to 9-month stay), and Visitor Visa Multiple Entry (~NZD 246, up to 3-year multi-entry). Restricted to Ordinary passport holders. Out of scope: Work Visa (AEWV / Working Holiday / Specific Purpose), Resident Visa (Skilled Migrant / Parent / Partnership), Student Visa, Transit Visa, Group Visitor Visa, Limited Visa, Refugee/Protection, and bespoke INZ pathways (Active Investor Plus, Entrepreneur).'
  )
ON CONFLICT DO NOTHING;
