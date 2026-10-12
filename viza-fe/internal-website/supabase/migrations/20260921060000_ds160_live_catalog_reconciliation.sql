-- Reconcile discrepancies found by comparing the migrated production catalog
-- with the current B1/B2 seed. Metadata only; applicant answer rows are untouched.

UPDATE public.visa_form_fields
SET validation_rules = COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":75}'::jsonb,
    updated_at = now()
WHERE visa_type = 'DS160' AND field_name = 'companion_group_name';

UPDATE public.visa_form_fields
SET validation_rules = COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":33}'::jsonb,
    updated_at = now()
WHERE visa_type = 'DS160' AND field_name = 'companion_surname';

UPDATE public.visa_form_fields
SET validation_rules = COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":33}'::jsonb,
    updated_at = now()
WHERE visa_type = 'DS160' AND field_name = 'companion_given_names';

UPDATE public.visa_form_fields
SET display_order = 26,
    updated_at = now()
WHERE visa_type = 'DS160' AND field_name = 'immigrant_petition_filed';

UPDATE public.visa_form_fields
SET conditional_logic = '{"showIf":"marital_status === married || marital_status === legally_separated || marital_status === common_law"}'::jsonb,
    updated_at = now()
WHERE visa_type = 'DS160' AND field_name = 'spouse_surname';

UPDATE public.visa_form_fields
SET conditional_logic = '{"showIf":"marital_status === married || marital_status === legally_separated || marital_status === common_law"}'::jsonb,
    updated_at = now()
WHERE visa_type = 'DS160' AND field_name = 'spouse_given_names';

UPDATE public.visa_form_fields
SET conditional_logic = '{"showIf":"marital_status === married || marital_status === legally_separated || marital_status === common_law"}'::jsonb,
    updated_at = now()
WHERE visa_type = 'DS160' AND field_name = 'spouse_date_of_birth';

UPDATE public.visa_form_fields
SET conditional_logic = '{"showIf":"marital_status === married || marital_status === legally_separated || marital_status === common_law"}'::jsonb,
    updated_at = now()
WHERE visa_type = 'DS160' AND field_name = 'spouse_nationality';

UPDATE public.visa_form_fields
SET conditional_logic = '{"showIf":"marital_status === married || marital_status === legally_separated || marital_status === common_law"}'::jsonb,
    updated_at = now()
WHERE visa_type = 'DS160' AND field_name = 'spouse_city_of_birth';

UPDATE public.visa_form_fields
SET conditional_logic = '{"showIf":"marital_status === married || marital_status === legally_separated || marital_status === common_law"}'::jsonb,
    updated_at = now()
WHERE visa_type = 'DS160' AND field_name = 'spouse_country_of_birth';

UPDATE public.visa_form_fields
SET conditional_logic = '{"showIf":"marital_status === married || marital_status === legally_separated || marital_status === common_law"}'::jsonb,
    updated_at = now()
WHERE visa_type = 'DS160' AND field_name = 'spouse_address_type';

UPDATE public.visa_form_fields
SET required = TRUE,
    updated_at = now()
WHERE visa_type = 'DS160' AND field_name = 'partner_address_type';

UPDATE public.visa_form_fields
SET conditional_logic = '{"showIf":"has_specific_plans !== no || intended_length_of_stay_unit !== H"}'::jsonb,
    updated_at = now()
WHERE visa_type = 'DS160' AND field_name = 'us_contact_relationship';

UPDATE public.visa_form_fields
SET validation_rules = COALESCE(validation_rules, '{}'::jsonb) || '{"does_not_apply_label":"Does Not Apply"}'::jsonb,
    updated_at = now()
WHERE visa_type = 'DS160' AND field_name = 'ds160_preparer_surname';

