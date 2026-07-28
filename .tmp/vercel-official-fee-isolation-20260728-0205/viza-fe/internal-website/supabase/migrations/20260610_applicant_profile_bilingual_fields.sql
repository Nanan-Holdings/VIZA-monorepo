-- VIZA required Universal Profile bilingual fields.
-- Safe to run against the remote VIZA Supabase project more than once.

CREATE TABLE IF NOT EXISTS public.applicant_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID UNIQUE,
  full_name TEXT,
  date_of_birth DATE,
  place_of_birth TEXT,
  gender TEXT,
  nationality TEXT,
  occupation TEXT,
  address TEXT,
  passport_number TEXT,
  passport_issue_date DATE,
  passport_expiry_date DATE,
  passport_issuing_country TEXT,
  passport_issuing_authority TEXT,
  email TEXT,
  phone TEXT,
  wechat TEXT,
  language_pref TEXT NOT NULL DEFAULT 'en',
  onboarding_done BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.applicant_profiles
  ADD COLUMN IF NOT EXISTS full_name_zh TEXT,
  ADD COLUMN IF NOT EXISTS full_name_en TEXT,
  ADD COLUMN IF NOT EXISTS surname TEXT,
  ADD COLUMN IF NOT EXISTS surname_zh TEXT,
  ADD COLUMN IF NOT EXISTS surname_en TEXT,
  ADD COLUMN IF NOT EXISTS given_names TEXT,
  ADD COLUMN IF NOT EXISTS given_names_zh TEXT,
  ADD COLUMN IF NOT EXISTS given_names_en TEXT,
  ADD COLUMN IF NOT EXISTS place_of_birth_zh TEXT,
  ADD COLUMN IF NOT EXISTS place_of_birth_en TEXT,
  ADD COLUMN IF NOT EXISTS birth_country TEXT,
  ADD COLUMN IF NOT EXISTS birth_province_or_state TEXT,
  ADD COLUMN IF NOT EXISTS birth_province_or_state_zh TEXT,
  ADD COLUMN IF NOT EXISTS birth_province_or_state_en TEXT,
  ADD COLUMN IF NOT EXISTS birth_city TEXT,
  ADD COLUMN IF NOT EXISTS birth_city_zh TEXT,
  ADD COLUMN IF NOT EXISTS birth_city_en TEXT,
  ADD COLUMN IF NOT EXISTS occupation_zh TEXT,
  ADD COLUMN IF NOT EXISTS occupation_en TEXT,
  ADD COLUMN IF NOT EXISTS address_zh TEXT,
  ADD COLUMN IF NOT EXISTS address_en TEXT;

ALTER TABLE public.applicant_profiles ENABLE ROW LEVEL SECURITY;
