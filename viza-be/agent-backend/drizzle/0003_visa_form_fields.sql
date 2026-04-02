-- Migration: 0003_visa_form_fields
-- Creates visa_form_fields table for dynamic form rendering

CREATE TABLE IF NOT EXISTS "visa_form_fields" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "visa_type" text NOT NULL DEFAULT 'B211A',
  "field_name" text NOT NULL,
  "label" text NOT NULL,
  "field_type" text NOT NULL,
  "required" boolean NOT NULL DEFAULT false,
  "step_number" integer NOT NULL,
  "step_name" text,
  "display_order" integer NOT NULL,
  "placeholder" text,
  "validation_rules" jsonb,
  "options" jsonb,
  "conditional_logic" jsonb,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "visa_form_fields_visa_type_field_name_idx"
  ON "visa_form_fields"("visa_type", "field_name");

CREATE INDEX IF NOT EXISTS "visa_form_fields_step_number_idx"
  ON "visa_form_fields"("visa_type", "step_number", "display_order");

-- Enable RLS
ALTER TABLE "visa_form_fields" ENABLE ROW LEVEL SECURITY;

-- Public read access (form fields are not sensitive)
CREATE POLICY "visa_form_fields_read" ON "visa_form_fields"
  FOR SELECT USING (true);

-- Service role write access
CREATE POLICY "visa_form_fields_write" ON "visa_form_fields"
  FOR ALL TO service_role USING (true) WITH CHECK (true);
