-- Access UK's China-only adsAgreement page asks whether the applicant is an
-- employee of a licensed ADS tour operator submitting for an ADS group.
-- Publish the explicit answer in VIZA without inferring it or changing any
-- existing applicant answers.

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
VALUES (
  'UK_STANDARD_VISITOR',
  'ads_tour_operator_employee',
  'Are you the employee of a licensed ADS tour operator submitting this application on behalf of an ADS group?',
  'radio',
  TRUE,
  1,
  'About You — Personal Details',
  20,
  NULL,
  '{"label_zh":"您是否是持牌 ADS 旅游运营商的员工，并代表 ADS 团队提交这份申请？","official_label_en":"Are you the employee of a licensed ADS tour operator submitting this application on behalf of an ADS group?","official_page":"adsAgreement"}'::JSONB,
  '[{"value":"yes","text":"Yes","label_zh":"是","official_label":"Yes"},{"value":"no","text":"No","label_zh":"否","official_label":"No"}]'::JSONB,
  '{"showIf":"country_of_nationality in [China,CN,CHN]"}'::JSONB
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
