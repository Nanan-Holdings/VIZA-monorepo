-- UKVI's hasAdditionalEmailEV page asks whether the applicant has another
-- e-mail address and, only for a Yes answer, asks for that address. Publish
-- the two schema rows without touching existing application answers.
--
-- The step-3 seed now places these rows after email_address. The guarded
-- display-order shift keeps an already-seeded catalog in the same order and
-- is safe to run again after the shift has completed.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.visa_form_fields
    WHERE visa_type = 'UK_STANDARD_VISITOR'
      AND field_name = 'phone_number'
      AND step_number = 3
      AND display_order = 2
  ) THEN
    UPDATE public.visa_form_fields
    SET display_order = display_order + 2,
        updated_at = NOW()
    WHERE visa_type = 'UK_STANDARD_VISITOR'
      AND step_number = 3
      AND display_order >= 2
      AND display_order < 100
      AND field_name NOT IN ('has_alternative_email', 'alternative_email_address');
  END IF;
END $$;

INSERT INTO public.visa_form_fields (
  visa_type,
  field_name,
  label,
  field_type,
  required,
  step_number,
  step_name,
  display_order,
  placeholder,
  validation_rules,
  options,
  conditional_logic
)
VALUES
  (
    'UK_STANDARD_VISITOR',
    'has_alternative_email',
    'Do you have any other email addresses?',
    'radio',
    TRUE,
    3,
    'Your Contact Details',
    2,
    NULL,
    '{"label_zh":"您是否有其他电子邮箱地址？","label_en":"Do you have any other email addresses?","official_label_en":"Do you have any other email addresses?"}'::JSONB,
    '[{"value":"yes","text":"Yes","label_zh":"是","label_en":"Yes","official_label":"Yes"},{"value":"no","text":"No","label_zh":"否","label_en":"No","official_label":"No"}]'::JSONB,
    NULL
  ),
  (
    'UK_STANDARD_VISITOR',
    'alternative_email_address',
    'Alternative email address',
    'text',
    TRUE,
    3,
    'Your Contact Details',
    3,
    'e.g., name@example.com',
    '{"label_zh":"其他电子邮箱地址","label_en":"Alternative email address","official_label_en":"Alternative email address","maxLength":100,"pattern":"^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$"}'::JSONB,
    NULL,
    '{"showIf":"has_alternative_email === yes"}'::JSONB
  )
ON CONFLICT (visa_type, field_name) DO UPDATE
SET
  label = EXCLUDED.label,
  field_type = EXCLUDED.field_type,
  required = EXCLUDED.required,
  step_number = EXCLUDED.step_number,
  step_name = EXCLUDED.step_name,
  display_order = EXCLUDED.display_order,
  placeholder = EXCLUDED.placeholder,
  validation_rules = EXCLUDED.validation_rules,
  options = EXCLUDED.options,
  conditional_logic = EXCLUDED.conditional_logic,
  updated_at = NOW();
