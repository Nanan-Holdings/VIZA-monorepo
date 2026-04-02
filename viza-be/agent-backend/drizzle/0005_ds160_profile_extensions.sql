-- Migration: 0005_ds160_profile_extensions
-- DS-160 specific profile data NOT covered by applicant_profiles
-- Covers: other names, other nationalities, social media, lost passports,
--         US relatives, previous employers, security answers, interview records
-- Linked to applicant_id — does NOT modify existing tables

-- ─── Other Names Used ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ds160_other_names" (
  "id"                uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "applicant_id"      uuid NOT NULL,
  "surname"           text NOT NULL,
  "given_names"       text NOT NULL,
  "name_type"         text,     -- maiden | alias | professional | religious | other
  "created_at"        timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "ds160_other_names_applicant_idx" ON "ds160_other_names"("applicant_id");
ALTER TABLE "ds160_other_names" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ds160_other_names_service" ON "ds160_other_names"
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── Other Nationalities ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ds160_other_nationalities" (
  "id"                uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "applicant_id"      uuid NOT NULL,
  "country"           text NOT NULL,             -- ISO 3166-1 alpha-2
  "currently_held"    boolean NOT NULL DEFAULT true,
  "has_passport"      boolean,
  "created_at"        timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "ds160_other_nationalities_applicant_idx" ON "ds160_other_nationalities"("applicant_id");
ALTER TABLE "ds160_other_nationalities" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ds160_other_nationalities_service" ON "ds160_other_nationalities"
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── Social Media Handles ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ds160_social_media" (
  "id"                uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "applicant_id"      uuid NOT NULL,
  "platform"          text NOT NULL,  -- facebook | twitter_x | linkedin | youtube | tiktok | other
  "handle"            text NOT NULL,
  "created_at"        timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "ds160_social_media_applicant_idx" ON "ds160_social_media"("applicant_id");
ALTER TABLE "ds160_social_media" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ds160_social_media_service" ON "ds160_social_media"
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── Lost / Stolen Passports ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ds160_lost_passports" (
  "id"                uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "applicant_id"      uuid NOT NULL,
  "passport_number"   text NOT NULL,
  "issuing_country"   text NOT NULL,
  "explanation"       text,
  "created_at"        timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "ds160_lost_passports_applicant_idx" ON "ds160_lost_passports"("applicant_id");
ALTER TABLE "ds160_lost_passports" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ds160_lost_passports_service" ON "ds160_lost_passports"
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── US Relatives ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ds160_us_relatives" (
  "id"                uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "applicant_id"      uuid NOT NULL,
  "name"              text NOT NULL,
  "relationship"      text NOT NULL,  -- spouse | child | sibling | parent | fiance | other
  "immigration_status" text,
  "is_immediate"      boolean NOT NULL DEFAULT true,
  "created_at"        timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "ds160_us_relatives_applicant_idx" ON "ds160_us_relatives"("applicant_id");
ALTER TABLE "ds160_us_relatives" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ds160_us_relatives_service" ON "ds160_us_relatives"
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── Previous Employers ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ds160_previous_employers" (
  "id"                uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "applicant_id"      uuid NOT NULL,
  "employer_name"     text NOT NULL,
  "address_line1"     text,
  "city"              text,
  "state_province"    text,
  "country"           text,
  "phone"             text,
  "job_title"         text,
  "start_date"        text,           -- YYYY-MM
  "end_date"          text,           -- YYYY-MM
  "monthly_salary"    numeric(12,2),
  "salary_currency"   text,           -- ISO 4217
  "duties"            text,
  "sort_order"        integer NOT NULL DEFAULT 0,
  "created_at"        timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "ds160_prev_employers_applicant_idx" ON "ds160_previous_employers"("applicant_id");
ALTER TABLE "ds160_previous_employers" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ds160_prev_employers_service" ON "ds160_previous_employers"
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── Security & Background Answers ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ds160_security_answers" (
  "id"                uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "applicant_id"      uuid NOT NULL,
  "question_key"      text NOT NULL,  -- matches field_name in visa_form_fields
  "answer"            boolean NOT NULL,
  "explanation"       text,           -- required if answer = true
  "created_at"        timestamp with time zone DEFAULT now(),
  UNIQUE("applicant_id", "question_key")
);
CREATE INDEX IF NOT EXISTS "ds160_security_answers_applicant_idx" ON "ds160_security_answers"("applicant_id");
ALTER TABLE "ds160_security_answers" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ds160_security_answers_service" ON "ds160_security_answers"
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── Travel Companions ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ds160_travel_companions" (
  "id"                uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "applicant_id"      uuid NOT NULL,
  "surname"           text NOT NULL,
  "given_names"       text NOT NULL,
  "relationship"      text,
  "group_name"        text,
  "created_at"        timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "ds160_travel_companions_applicant_idx" ON "ds160_travel_companions"("applicant_id");
ALTER TABLE "ds160_travel_companions" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ds160_travel_companions_service" ON "ds160_travel_companions"
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── Interview Records ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ds160_interview_records" (
  "id"                uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "applicant_id"      uuid NOT NULL,
  "scheduled_date"    date,
  "scheduled_time"    time,
  "location"          text,           -- e.g. "US Embassy Singapore"
  "outcome"           text,           -- approved | refused | admin_processing_221g | rescheduled
  "outcome_date"      date,
  "refusal_code"      text,           -- e.g. "214b"
  "notes"             text,
  "created_at"        timestamp with time zone DEFAULT now(),
  "updated_at"        timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "ds160_interview_records_applicant_idx" ON "ds160_interview_records"("applicant_id");
ALTER TABLE "ds160_interview_records" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ds160_interview_records_service" ON "ds160_interview_records"
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── Payment Records ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ds160_payments" (
  "id"                uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "applicant_id"      uuid NOT NULL,
  "mrv_fee_amount"    numeric(10,2),
  "mrv_fee_currency"  text DEFAULT 'USD',
  "receipt_number"    text,
  "paid_at"           timestamp with time zone,
  "payment_method"    text,
  "created_at"        timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "ds160_payments_applicant_idx" ON "ds160_payments"("applicant_id");
ALTER TABLE "ds160_payments" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ds160_payments_service" ON "ds160_payments"
  FOR ALL TO service_role USING (true) WITH CHECK (true);
