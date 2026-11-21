-- France-Visas step 5 requires the host organisation's telephone and e-mail
-- for hotel and rented stays (and VIZA uses the same details for the
-- reception contact). Make accommodation_phone and accommodation_email
-- required; they are only shown for hotel/rented stays. Idempotent.

UPDATE public.visa_form_fields
SET required = TRUE,
    validation_rules = '{"label_zh":"住宿电话","maxLength":20,"block_group":"accommodation_address","helper_zh":"请填写酒店或住处的电话，包含国家代码，例如 +33 1 23 45 67 89。"}'::JSONB,
    updated_at = NOW()
WHERE visa_type = 'EU_SCHENGEN_C_SHORT_STAY' AND field_name = 'accommodation_phone';

UPDATE public.visa_form_fields
SET required = TRUE,
    validation_rules = '{"label_zh":"住宿电子邮箱","maxLength":70,"block_group":"accommodation_address","pattern":"^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$","helper_zh":"请填写酒店或住处的联系邮箱（可在预订确认中找到）。"}'::JSONB,
    updated_at = NOW()
WHERE visa_type = 'EU_SCHENGEN_C_SHORT_STAY' AND field_name = 'accommodation_email';
