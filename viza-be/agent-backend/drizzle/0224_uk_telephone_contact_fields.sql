-- Access UK's Standard Visitor contact pages expose phone purpose/type
-- checkboxes and a separate telephone-contact preference page. Publish those
-- controls without changing any applicant answers.
--
-- The 0219 email migration left the legacy contact rows at orders 5 onward.
-- Make room for the two observed phone multi-select groups, the contact
-- preference, and its conditional explanations. The guarded shift is safe to
-- rerun after the new phone-purpose row exists.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.visa_form_fields
    WHERE visa_type = 'UK_STANDARD_VISITOR'
      AND field_name = 'phone_purpose_labels'
  ) THEN
    UPDATE public.visa_form_fields
    SET display_order = display_order + 6,
        updated_at = NOW()
    WHERE visa_type = 'UK_STANDARD_VISITOR'
      AND step_number = 3
      AND display_order >= 7;

    UPDATE public.visa_form_fields
    SET display_order = 7,
        updated_at = NOW()
    WHERE visa_type = 'UK_STANDARD_VISITOR'
      AND field_name = 'has_alternative_phone';

    UPDATE public.visa_form_fields
    SET display_order = 8,
        updated_at = NOW()
    WHERE visa_type = 'UK_STANDARD_VISITOR'
      AND field_name = 'alternative_phone_number';
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
    'phone_purpose_labels',
    'Telephone number use',
    'multi_select',
    TRUE,
    3,
    'Your Contact Details',
    5,
    NULL,
    '{"label_zh":"电话号码使用范围","label_en":"Telephone number use","official_label_en":"Telephone number use","official_page":"standardTelephoneDetailsList.0"}'::JSONB,
    '[{"value":"in_uk","text":"For use whilst in the UK","label_zh":"在英国期间使用","label_en":"For use whilst in the UK","official_label":"For use whilst in the UK"},{"value":"outside_uk","text":"For use whilst out of the UK","label_zh":"在英国境外使用","label_en":"For use whilst out of the UK","official_label":"For use whilst out of the UK"}]'::JSONB,
    NULL
  ),
  (
    'UK_STANDARD_VISITOR',
    'phone_type_labels',
    'Telephone number type',
    'multi_select',
    TRUE,
    3,
    'Your Contact Details',
    6,
    NULL,
    '{"label_zh":"电话号码类型","label_en":"Telephone number type","official_label_en":"Telephone number type","official_page":"standardTelephoneDetailsList.0"}'::JSONB,
    '[{"value":"home","text":"Home telephone number","label_zh":"家庭电话号码","label_en":"Home telephone number","official_label":"Home telephone number"},{"value":"business","text":"Business telephone number","label_zh":"工作电话号码","label_en":"Business telephone number","official_label":"Business telephone number"},{"value":"mobile","text":"Mobile telephone number","label_zh":"手机号码","label_en":"Mobile telephone number","official_label":"Mobile telephone number"}]'::JSONB,
    NULL
  ),
  (
    'UK_STANDARD_VISITOR',
    'contact_by_phone_label',
    'Contacting you by telephone',
    'radio',
    TRUE,
    3,
    'Your Contact Details',
    9,
    NULL,
    '{"label_zh":"通过电话联系您","label_en":"Contacting you by telephone","official_label_en":"Contacting you by telephone","official_page":"standardContactingYouByTelephone"}'::JSONB,
    '[{"value":"call_and_text","text":"I can be contacted by telephone call and text message (SMS)","label_zh":"我可以通过电话和短信联系","label_en":"I can be contacted by telephone call and text message (SMS)","official_label":"I can be contacted by telephone call and text message (SMS)"},{"value":"call_only","text":"I can only be contacted by telephone call","label_zh":"我只能通过电话联系","label_en":"I can only be contacted by telephone call","official_label":"I can only be contacted by telephone call"},{"value":"text_only","text":"I can only be contacted by text message (SMS)","label_zh":"我只能通过短信联系","label_en":"I can only be contacted by text message (SMS)","official_label":"I can only be contacted by text message (SMS)"},{"value":"no_call_or_text","text":"I cannot be contacted by telephone call or text message (SMS)","label_zh":"我无法通过电话或短信联系","label_en":"I cannot be contacted by telephone call or text message (SMS)","official_label":"I cannot be contacted by telephone call or text message (SMS)"}]'::JSONB,
    NULL
  ),
  (
    'UK_STANDARD_VISITOR',
    'contact_call_only_reason',
    'Explain why you cannot be contacted by text message (SMS)',
    'textarea',
    FALSE,
    3,
    'Your Contact Details',
    10,
    NULL,
    '{"label_zh":"请说明您无法通过短信联系的原因","label_en":"Explain why you cannot be contacted by text message (SMS)","official_label_en":"Explain why you cannot be contacted by text message (SMS)","official_page":"standardContactingYouByTelephone","maxLength":1000}'::JSONB,
    NULL,
    '{"showIf":"contact_by_phone_label === call_only"}'::JSONB
  ),
  (
    'UK_STANDARD_VISITOR',
    'contact_text_only_reason',
    'Explain why you cannot be contacted by telephone call',
    'textarea',
    FALSE,
    3,
    'Your Contact Details',
    11,
    NULL,
    '{"label_zh":"请说明您无法通过电话联系的原因","label_en":"Explain why you cannot be contacted by telephone call","official_label_en":"Explain why you cannot be contacted by telephone call","official_page":"standardContactingYouByTelephone","maxLength":1000}'::JSONB,
    NULL,
    '{"showIf":"contact_by_phone_label === text_only"}'::JSONB
  ),
  (
    'UK_STANDARD_VISITOR',
    'contact_no_contact_reason',
    'Explain why you cannot be contacted by telephone call or text message (SMS)',
    'textarea',
    FALSE,
    3,
    'Your Contact Details',
    12,
    NULL,
    '{"label_zh":"请说明您无法通过电话或短信联系的原因","label_en":"Explain why you cannot be contacted by telephone call or text message (SMS)","official_label_en":"Explain why you cannot be contacted by telephone call or text message (SMS)","official_page":"standardContactingYouByTelephone","maxLength":1000}'::JSONB,
    NULL,
    '{"showIf":"contact_by_phone_label === no_call_or_text"}'::JSONB
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
