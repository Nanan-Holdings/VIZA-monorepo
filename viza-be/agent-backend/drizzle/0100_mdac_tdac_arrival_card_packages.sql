-- Add standalone Malaysia MDAC and Thailand TDAC arrival-card packages.
-- Companion seed scripts:
--   scripts/seed-my-mdac-arrival-card-form-fields.ts
--   scripts/seed-th-tdac-arrival-card-form-fields.ts

INSERT INTO visa_packages (country, visa_type, name, description) VALUES
  (
    'malaysia',
    'MY_MDAC_ARRIVAL_CARD',
    'Malaysia Digital Arrival Card (MDAC)',
    'Malaysia Digital Arrival Card (MDAC) preparation for foreign visitors. MDAC is not a visa and should be completed through the official Immigration Malaysia channel according to the current MDAC submission window. This package collects traveller identity, passport, trip, contact, Malaysia address, and declaration details. Out of scope: Malaysia eVISA, pass applications, payment, CAPTCHA, and official-site automation until a dedicated MDAC portal runner is implemented.'
  ),
  (
    'thailand',
    'TH_TDAC_ARRIVAL_CARD',
    'Thailand Digital Arrival Card (TDAC)',
    'Thailand Digital Arrival Card (TDAC) preparation for foreign visitors. TDAC is not a visa and should be completed through the official Thailand TDAC channel according to the current TDAC submission window. This package collects traveller identity, passport, trip, Thailand address, health declaration, and declaration details. Out of scope: Thai tourist visa, Thai e-Visa, payment, CAPTCHA, and official-site automation until a dedicated TDAC portal runner is implemented.'
  )
ON CONFLICT DO NOTHING;
