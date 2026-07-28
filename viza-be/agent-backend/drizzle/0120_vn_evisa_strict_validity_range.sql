-- Vietnam's official e-Visa portal requires a non-zero validity interval:
-- "valid from" must be strictly before "valid to".

UPDATE visa_form_fields
SET validation_rules = (COALESCE(validation_rules, '{}'::jsonb) - 'not_before_field')
      || '{"min_days_after_field":"visa_valid_from","min_days_after_field_days":1,"helper_zh":"结束日期必须至少晚于开始日期 1 天。","helper_en":"The end date must be at least 1 day after the start date."}'::jsonb,
    updated_at = now()
WHERE visa_type = 'VN_E_VISA'
  AND field_name = 'visa_valid_to';
