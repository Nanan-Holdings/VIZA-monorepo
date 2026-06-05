ALTER TABLE applicant_profiles
  ADD COLUMN IF NOT EXISTS full_name_zh TEXT,
  ADD COLUMN IF NOT EXISTS full_name_en TEXT,
  ADD COLUMN IF NOT EXISTS place_of_birth_zh TEXT,
  ADD COLUMN IF NOT EXISTS place_of_birth_en TEXT,
  ADD COLUMN IF NOT EXISTS occupation_zh TEXT,
  ADD COLUMN IF NOT EXISTS occupation_en TEXT,
  ADD COLUMN IF NOT EXISTS address_zh TEXT,
  ADD COLUMN IF NOT EXISTS address_en TEXT;
