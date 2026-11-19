-- France-Visas requires a postcode for the host person (and, once the
-- host-organisation block is mapped, for hotel/rented stays). The France
-- Schengen C form never collected one, so the worker used to invent "75001".
-- Add both postcode fields right after their address line, shifting the
-- following fields of the same step down by one. Idempotent.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.visa_form_fields
    WHERE visa_type = 'EU_SCHENGEN_C_SHORT_STAY' AND field_name = 'host_postcode'
  ) THEN
    UPDATE public.visa_form_fields
    SET display_order = display_order + 1, updated_at = NOW()
    WHERE visa_type = 'EU_SCHENGEN_C_SHORT_STAY'
      AND step_number = 8
      AND display_order >= 5;

    INSERT INTO public.visa_form_fields (
      visa_type, field_name, label, field_type, required, step_number, step_name,
      display_order, placeholder, validation_rules, options, conditional_logic
    )
    VALUES (
      'EU_SCHENGEN_C_SHORT_STAY',
      'host_postcode',
      'Host''s postcode',
      'text',
      TRUE,
      8,
      'Purpose-Specific Details',
      5,
      NULL,
      '{"maxLength": 10, "pattern": "^[A-Za-z0-9 -]{2,10}$", "block_group": "host_details", "required_unless": "has_eu_family_member === yes", "label_zh": "邀请人地址邮编", "official": true, "helper_zh": "请填写邀请人地址的邮政编码，只能使用字母、数字、空格或连字符。"}'::JSONB,
      NULL,
      '{"showIf": "purpose_of_journey === visiting_family_friends"}'::JSONB
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.visa_form_fields
    WHERE visa_type = 'EU_SCHENGEN_C_SHORT_STAY' AND field_name = 'accommodation_postcode'
  ) THEN
    UPDATE public.visa_form_fields
    SET display_order = display_order + 1, updated_at = NOW()
    WHERE visa_type = 'EU_SCHENGEN_C_SHORT_STAY'
      AND step_number = 9
      AND display_order >= 4;

    INSERT INTO public.visa_form_fields (
      visa_type, field_name, label, field_type, required, step_number, step_name,
      display_order, placeholder, validation_rules, options, conditional_logic
    )
    VALUES (
      'EU_SCHENGEN_C_SHORT_STAY',
      'accommodation_postcode',
      'Accommodation postcode',
      'text',
      TRUE,
      9,
      'Accommodation in Schengen',
      4,
      NULL,
      '{"maxLength": 10, "pattern": "^[A-Za-z0-9 -]{2,10}$", "block_group": "accommodation_address", "required_unless": "has_eu_family_member === yes", "label_zh": "住宿地址邮编", "official": true, "helper_zh": "请填写酒店或住处地址的邮政编码，例如巴黎 75001，只能使用字母、数字、空格或连字符。"}'::JSONB,
      NULL,
      '{"showIf": "accommodation_type === hotel || accommodation_type === rented"}'::JSONB
    );
  END IF;
END $$;
