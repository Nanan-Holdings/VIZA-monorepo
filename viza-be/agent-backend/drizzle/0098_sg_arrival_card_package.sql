-- Add Singapore SG Arrival Card to the visa_packages catalog.
-- Companion seed script: scripts/seed-sg-arrival-card-form-fields.ts

INSERT INTO visa_packages (country, visa_type, name, description) VALUES
  (
    'singapore',
    'SG_ARRIVAL_CARD',
    'Singapore SG Arrival Card',
    'Singapore SG Arrival Card (SGAC) preparation for foreign visitors. SGAC is not a visa, is free of charge on ICA official channels, and should normally be submitted within three (3) days including the day of arrival before arriving in Singapore. This package collects arrival information, contact details, Singapore accommodation, and electronic health declaration details for manual review and official submission by the traveller via ICA SGAC e-Service or MyICA Mobile. Out of scope: Singapore Visit Visa / SAVE, pass applications, payment, CAPTCHA, official-site automation, and final official submission.'
  )
ON CONFLICT DO NOTHING;
