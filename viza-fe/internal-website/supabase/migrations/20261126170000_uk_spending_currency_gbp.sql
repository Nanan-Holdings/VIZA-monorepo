UPDATE public.visa_form_fields
SET
  label = 'Planned spend currency (GBP)',
  options = '[{"value":"GBP","text":"GBP","label_en":"GBP","label_zh":"英镑（GBP）","official_label":"Pounds Sterling (GBP)"}]'::JSONB,
  validation_rules = COALESCE(validation_rules, '{}'::JSONB) || '{"label_zh":"计划花费币种（GBP）","label_en":"Planned spend currency (GBP)","official_page":"plannedSpendOnVisitToUK"}'::JSONB,
  updated_at = NOW()
WHERE visa_type = 'UK_STANDARD_VISITOR'
  AND field_name = 'planned_spend_currency';

UPDATE public.visa_form_fields
SET
  label = 'How much do you plan to spend on this visit (in GBP)?',
  validation_rules = COALESCE(validation_rules, '{}'::JSONB) || '{"label_zh":"您计划在此次访问中花费多少（英镑）？","official_label_en":"Provide the amount in Pounds Sterling (GBP).","official_page":"plannedSpendOnVisitToUK"}'::JSONB,
  updated_at = NOW()
WHERE visa_type = 'UK_STANDARD_VISITOR'
  AND field_name = 'planned_spend_amount';

UPDATE public.visa_form_fields
SET
  label = 'Monthly outgoings currency (GBP)',
  options = '[{"value":"GBP","text":"GBP","label_en":"GBP","label_zh":"英镑（GBP）","official_label":"Pounds Sterling (GBP)"}]'::JSONB,
  validation_rules = COALESCE(validation_rules, '{}'::JSONB) || '{"label_zh":"每月支出币种（GBP）","label_en":"Monthly outgoings currency (GBP)","official_page":"monthlyOutgoings"}'::JSONB,
  updated_at = NOW()
WHERE visa_type = 'UK_STANDARD_VISITOR'
  AND field_name = 'monthly_outgoings_currency';

UPDATE public.visa_form_fields
SET
  label = 'Total amount you spend each month (in GBP)',
  validation_rules = COALESCE(validation_rules, '{}'::JSONB) || '{"label_zh":"您每月支出的总金额（英镑）","official_label_en":"Provide the amount in Pounds Sterling (GBP).","official_page":"monthlyOutgoings"}'::JSONB,
  updated_at = NOW()
WHERE visa_type = 'UK_STANDARD_VISITOR'
  AND field_name = 'monthly_outgoings_amount';
