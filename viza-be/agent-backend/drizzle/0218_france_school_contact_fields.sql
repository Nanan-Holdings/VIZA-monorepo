-- France-Visas opens its employer / educational-establishment section for
-- students and requires the establishment's name, street, city, phone and
-- e-mail. The France form asked students only for the school name, address
-- and an optional phone, so step 2 of every student's run was rejected. Add
-- the school's city, country and e-mail, require the school phone, and
-- require the employer e-mail (France-Visas requires it for employees too).
-- Idempotent.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.visa_form_fields
    WHERE visa_type = 'EU_SCHENGEN_C_SHORT_STAY' AND field_name = 'school_city'
  ) THEN
    INSERT INTO public.visa_form_fields (
      visa_type, field_name, label, field_type, required, step_number, step_name,
      display_order, placeholder, validation_rules, options, conditional_logic
    )
    SELECT 'EU_SCHENGEN_C_SHORT_STAY', v.field_name, v.label, v.field_type, TRUE,
           s.step_number, s.step_name, v.display_order, NULL, v.rules::JSONB, NULL,
           '{"showIf": "is_student === yes"}'::JSONB
    FROM (VALUES
      ('school_city', 'City of educational establishment', 'text', 10,
       '{"label_zh":"学校所在城市","maxLength":50,"pattern":"^[A-Za-zÀ-ÿ'' .,()-]{2,50}$","helper_zh":"请用英文或拼音填写，例如 Singapore。"}'),
      ('school_country', 'Country of educational establishment', 'country', 11,
       '{"label_zh":"学校所在国家"}'),
      ('school_email', 'E-mail address of educational establishment', 'text', 13,
       '{"label_zh":"学校电子邮箱","maxLength":70,"pattern":"^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$","helper_zh":"学校或院系的公开联系邮箱。"}')
    ) AS v(field_name, label, field_type, display_order, rules)
    CROSS JOIN (
      SELECT step_number, step_name FROM public.visa_form_fields
      WHERE visa_type = 'EU_SCHENGEN_C_SHORT_STAY' AND field_name = 'school_name'
    ) AS s;
  END IF;

  UPDATE public.visa_form_fields
  SET display_order = 12, required = TRUE, updated_at = NOW()
  WHERE visa_type = 'EU_SCHENGEN_C_SHORT_STAY' AND field_name = 'school_phone';

  UPDATE public.visa_form_fields
  SET required = TRUE, updated_at = NOW()
  WHERE visa_type = 'EU_SCHENGEN_C_SHORT_STAY' AND field_name = 'employer_email';
END $$;
