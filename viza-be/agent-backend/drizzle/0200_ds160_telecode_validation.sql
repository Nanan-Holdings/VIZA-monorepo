-- Align the DS-160 telecode inputs with CEAC's Personal Information 1
-- validation. The surname accepts one or more four-digit groups separated by
-- single spaces and remains required; given names use the same format when
-- supplied but are optional. Preserve existing field IDs and answers.

UPDATE public.visa_form_fields
SET
  required = CASE field_name
    WHEN 'telecode_surname' THEN TRUE
    WHEN 'telecode_given_names' THEN FALSE
    ELSE required
  END,
  validation_rules = CASE field_name
    WHEN 'telecode_surname' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":20,"pattern":"^[0-9]{4}(?: [0-9]{4})*$","specific_error_zh":"请输入由空格分隔的四位数字组","specific_error_en":"Enter four-digit groups separated by spaces"}'::jsonb
    WHEN 'telecode_given_names' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":20,"pattern":"^[0-9]{4}(?: [0-9]{4})*$","specific_error_zh":"请输入由空格分隔的四位数字组","specific_error_en":"Enter four-digit groups separated by spaces"}'::jsonb
    ELSE validation_rules
  END,
  updated_at = now()
WHERE visa_type = 'DS160'
  AND field_name IN ('telecode_surname', 'telecode_given_names');
