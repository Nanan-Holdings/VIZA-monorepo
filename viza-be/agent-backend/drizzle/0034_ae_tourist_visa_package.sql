-- Add UAE Tourist Visa to the visa_packages catalog.
-- Companion seed script: scripts/seed-ae-tourist-visa-form-fields.ts

INSERT INTO visa_packages (country, visa_type, name, description) VALUES
  (
    'united_arab_emirates',
    'AE_TOURIST_VISA',
    'UAE Tourist Visa',
    'United Arab Emirates Tourist Visa issued by the Federal Authority for Identity, Citizenship, Customs and Port Security (ICP) via smartservices.icp.gov.ae and GDRFA Dubai via smart.gdrfad.gov.ae. Three variants: 30-day single-entry (~AED 350), 60-day single-entry (~AED 650), and 5-year multiple-entry tourist (~AED 650, 90-day stay per entry up to 180 days/year). Sponsor required for most applications (airline / travel agent / hotel / UAE Resident); self-apply via ICP available. Restricted to Ordinary passport holders. Out of scope: Residence Visa (employment / investor / Golden Visa / retirement / real-estate / family / student), Green Visa, Freelance / Remote-work permit, Mission / Job-exploration visa, and visa-on-arrival / visa-exempt arrivals.'
  )
ON CONFLICT DO NOTHING;
