-- Add Indonesia C1 Tourist Single Entry Visa (formerly B211A) to the
-- visa_packages catalog. Companion seed: scripts/seed-id-c1-tourist-form-fields.ts

INSERT INTO visa_packages (country, visa_type, name, description) VALUES
  (
    'indonesia',
    'ID_C1_TOURIST',
    'Indonesia C1 Tourist Single Entry Visa',
    'Indonesia Tourist Visit Visa (Visa Kunjungan Wisata, formerly B211A, now C1 Single Entry under the 2024 framework). Up to 60 days, single entry, applied for online via the official eVisa portal evisa.imigrasi.go.id (which replaced molina.imigrasi.go.id). Schema is a reconstruction of the public eVisa journey — live-portal QA pass deferred per playbook.'
  )
ON CONFLICT DO NOTHING;
