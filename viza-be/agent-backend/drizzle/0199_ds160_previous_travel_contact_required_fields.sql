-- Align the confirmed DS-160 Previous U.S. Travel, Address and Phone, and
-- family-spouse branches with CEAC Next validation. Existing branch
-- conditions, repeat groups, and explicit Does Not Apply/Do Not Know rules
-- are preserved.

UPDATE public.visa_form_fields
SET
  required = CASE field_name
    WHEN 'previous_visit_date_arrived' THEN TRUE
    WHEN 'previous_visit_length_of_stay' THEN TRUE
    WHEN 'previous_visit_length_of_stay_unit' THEN TRUE
    WHEN 'us_drivers_license_number' THEN TRUE
    WHEN 'us_drivers_license_state' THEN TRUE
    WHEN 'visa_number' THEN TRUE
    WHEN 'visa_lost_or_stolen_explain' THEN TRUE
    WHEN 'visa_cancelled_or_revoked_explain' THEN TRUE
    WHEN 'refusal_explain' THEN TRUE
    WHEN 'immigrant_petition_explain' THEN TRUE
    WHEN 'home_address_line1' THEN TRUE
    WHEN 'home_address_city' THEN TRUE
    WHEN 'home_address_state_province' THEN TRUE
    WHEN 'home_address_postal_code' THEN TRUE
    WHEN 'home_address_country' THEN TRUE
    WHEN 'mailing_same_as_home' THEN TRUE
    WHEN 'mailing_address_line1' THEN TRUE
    WHEN 'mailing_address_city' THEN TRUE
    WHEN 'mailing_address_state' THEN TRUE
    WHEN 'mailing_address_postal' THEN TRUE
    WHEN 'mailing_address_country' THEN TRUE
    WHEN 'primary_phone' THEN TRUE
    WHEN 'secondary_phone' THEN TRUE
    WHEN 'work_phone' THEN TRUE
    WHEN 'has_other_phones' THEN TRUE
    WHEN 'additional_phone' THEN TRUE
    WHEN 'email_address' THEN TRUE
    WHEN 'has_other_emails' THEN TRUE
    WHEN 'additional_email' THEN TRUE
    WHEN 'has_social_media' THEN TRUE
    WHEN 'social_media_platform' THEN TRUE
    WHEN 'social_media_handle' THEN TRUE
    WHEN 'has_other_social_media' THEN TRUE
    WHEN 'other_social_media_name' THEN TRUE
    WHEN 'other_social_media_identifier' THEN TRUE
    WHEN 'social_media_identifier' THEN TRUE
    WHEN 'father_surname' THEN TRUE
    WHEN 'father_given_names' THEN TRUE
    WHEN 'father_date_of_birth' THEN TRUE
    WHEN 'father_in_us' THEN TRUE
    WHEN 'mother_surname' THEN TRUE
    WHEN 'mother_given_names' THEN TRUE
    WHEN 'mother_date_of_birth' THEN TRUE
    WHEN 'mother_in_us' THEN TRUE
    WHEN 'spouse_surname' THEN TRUE
    WHEN 'spouse_given_names' THEN TRUE
    WHEN 'spouse_date_of_birth' THEN TRUE
    WHEN 'spouse_nationality' THEN TRUE
    WHEN 'spouse_city_of_birth' THEN TRUE
    WHEN 'spouse_country_of_birth' THEN TRUE
    WHEN 'spouse_address_type' THEN TRUE
    WHEN 'spouse_address_street1' THEN TRUE
    WHEN 'spouse_address_city' THEN TRUE
    WHEN 'spouse_address_state' THEN TRUE
    WHEN 'spouse_address_zip' THEN TRUE
    WHEN 'spouse_address_country' THEN TRUE
    ELSE required
  END,
  validation_rules = CASE field_name
    WHEN 'intended_arrival_date' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"minimum_date_precision":"month"}'::jsonb
    WHEN 'previous_visit_date_arrived' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"minimum_date_precision":"year"}'::jsonb
    WHEN 'previous_visit_length_of_stay' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":3}'::jsonb
    WHEN 'us_drivers_license_number' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":20}'::jsonb
    WHEN 'visa_number' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":12}'::jsonb
    WHEN 'visa_lost_or_stolen_explain' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":4000}'::jsonb
    WHEN 'visa_cancelled_or_revoked_explain' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":4000}'::jsonb
    WHEN 'refusal_explain' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":4000}'::jsonb
    WHEN 'immigrant_petition_explain' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":4000}'::jsonb
    WHEN 'home_address_line1' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":40}'::jsonb
    WHEN 'home_address_line2' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":40}'::jsonb
    WHEN 'home_address_city' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":20}'::jsonb
    WHEN 'home_address_state_province' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":20,"has_does_not_apply":true}'::jsonb
    WHEN 'home_address_postal_code' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":10,"has_does_not_apply":true}'::jsonb
    WHEN 'mailing_address_line1' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":40}'::jsonb
    WHEN 'mailing_address_line2' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":40}'::jsonb
    WHEN 'mailing_address_city' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":20}'::jsonb
    WHEN 'mailing_address_state' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":20,"has_does_not_apply":true}'::jsonb
    WHEN 'mailing_address_postal' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":10,"has_does_not_apply":true}'::jsonb
    WHEN 'primary_phone' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":15}'::jsonb
    WHEN 'secondary_phone' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":15,"has_does_not_apply":true}'::jsonb
    WHEN 'work_phone' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":15,"has_does_not_apply":true}'::jsonb
    WHEN 'additional_phone' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":15}'::jsonb
    WHEN 'email_address' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":50}'::jsonb
    WHEN 'additional_email' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":40}'::jsonb
    WHEN 'social_media_handle' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":50}'::jsonb
    WHEN 'social_media_identifier' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":50}'::jsonb
    WHEN 'other_social_media_name' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":40}'::jsonb
    WHEN 'other_social_media_identifier' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":40}'::jsonb
    WHEN 'father_surname' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":33}'::jsonb
    WHEN 'father_given_names' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":33}'::jsonb
    WHEN 'father_date_of_birth' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"minimum_date_precision":"year"}'::jsonb
    WHEN 'mother_surname' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":33}'::jsonb
    WHEN 'mother_given_names' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":33}'::jsonb
    WHEN 'mother_date_of_birth' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"minimum_date_precision":"year"}'::jsonb
    WHEN 'spouse_surname' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":33}'::jsonb
    WHEN 'spouse_given_names' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":33}'::jsonb
    WHEN 'spouse_date_of_birth' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"minimum_date_precision":"year"}'::jsonb
    WHEN 'spouse_city_of_birth' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":20,"allow_do_not_know":true}'::jsonb
    WHEN 'spouse_address_street1' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":40}'::jsonb
    WHEN 'spouse_address_street2' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":40}'::jsonb
    WHEN 'spouse_address_city' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":20}'::jsonb
    WHEN 'spouse_address_state' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":20,"allow_does_not_apply":true}'::jsonb
    WHEN 'spouse_address_zip' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":10,"allow_does_not_apply":true}'::jsonb
    ELSE validation_rules
  END,
  conditional_logic = CASE field_name
    WHEN 'social_media_platform' THEN '{"showIf":"has_social_media === yes"}'::jsonb
    WHEN 'social_media_handle' THEN '{"showIf":"has_social_media === yes && social_media_platform !== NONE && social_media_platform !== null"}'::jsonb
    WHEN 'social_media_identifier' THEN '{"showIf":"has_social_media === yes && social_media_provider !== NONE && social_media_provider !== null"}'::jsonb
    WHEN 'father_date_of_birth' THEN '{"showIf":"father_surname !== DO_NOT_KNOW || father_given_names !== DO_NOT_KNOW"}'::jsonb
    WHEN 'father_in_us' THEN '{"showIf":"father_surname !== DO_NOT_KNOW || father_given_names !== DO_NOT_KNOW"}'::jsonb
    WHEN 'mother_date_of_birth' THEN '{"showIf":"mother_surname !== DO_NOT_KNOW || mother_given_names !== DO_NOT_KNOW"}'::jsonb
    WHEN 'mother_in_us' THEN '{"showIf":"mother_surname !== DO_NOT_KNOW || mother_given_names !== DO_NOT_KNOW"}'::jsonb
    WHEN 'spouse_surname' THEN '{"showIf":"marital_status === married || marital_status === legally_separated || marital_status === common_law || marital_status === other"}'::jsonb
    WHEN 'spouse_given_names' THEN '{"showIf":"marital_status === married || marital_status === legally_separated || marital_status === common_law || marital_status === other"}'::jsonb
    WHEN 'spouse_date_of_birth' THEN '{"showIf":"marital_status === married || marital_status === legally_separated || marital_status === common_law || marital_status === other"}'::jsonb
    WHEN 'spouse_nationality' THEN '{"showIf":"marital_status === married || marital_status === legally_separated || marital_status === common_law || marital_status === other"}'::jsonb
    WHEN 'spouse_city_of_birth' THEN '{"showIf":"marital_status === married || marital_status === legally_separated || marital_status === common_law || marital_status === other"}'::jsonb
    WHEN 'spouse_country_of_birth' THEN '{"showIf":"marital_status === married || marital_status === legally_separated || marital_status === common_law || marital_status === other"}'::jsonb
    WHEN 'spouse_address_type' THEN '{"showIf":"marital_status === married || marital_status === legally_separated || marital_status === common_law || marital_status === other"}'::jsonb
    WHEN 'spouse_address_street1' THEN '{"showIf":"spouse_address_type === other"}'::jsonb
    WHEN 'spouse_address_street2' THEN '{"showIf":"spouse_address_type === other"}'::jsonb
    WHEN 'spouse_address_city' THEN '{"showIf":"spouse_address_type === other"}'::jsonb
    WHEN 'spouse_address_state' THEN '{"showIf":"spouse_address_type === other"}'::jsonb
    WHEN 'spouse_address_zip' THEN '{"showIf":"spouse_address_type === other"}'::jsonb
    WHEN 'spouse_address_country' THEN '{"showIf":"spouse_address_type === other"}'::jsonb
    ELSE conditional_logic
  END,
  options = CASE field_name
    WHEN 'social_media_platform' THEN
      '[{"value":"ASKF","text":"ASK.FM"},{"value":"DUBN","text":"DOUBAN"},{"value":"FCBK","text":"FACEBOOK"},{"value":"FLKR","text":"FLICKR"},{"value":"GOGL","text":"GOOGLE+"},{"value":"INST","text":"INSTAGRAM"},{"value":"LINK","text":"LINKEDIN"},{"value":"MYSP","text":"MYSPACE"},{"value":"PTST","text":"PINTEREST"},{"value":"QZNE","text":"QZONE (QQ)"},{"value":"RDDT","text":"REDDIT"},{"value":"SWBO","text":"SINAWEIBO"},{"value":"TWBO","text":"TENCENTWEIBO"},{"value":"TUMB","text":"TUMBLR"},{"value":"TWIT","text":"TWITTER"},{"value":"TWOO","text":"TWOO"},{"value":"VINE","text":"VINE"},{"value":"VKON","text":"VKONTAKTE (VK)"},{"value":"YUKU","text":"YOUKU"},{"value":"YTUB","text":"YOUTUBE"},{"value":"NONE","text":"NONE"}]'::jsonb
    WHEN 'social_media_provider' THEN
      '[{"value":"ASKF","text":"ASK.FM"},{"value":"DUBN","text":"DOUBAN"},{"value":"FCBK","text":"FACEBOOK"},{"value":"FLKR","text":"FLICKR"},{"value":"GOGL","text":"GOOGLE+"},{"value":"INST","text":"INSTAGRAM"},{"value":"LINK","text":"LINKEDIN"},{"value":"MYSP","text":"MYSPACE"},{"value":"PTST","text":"PINTEREST"},{"value":"QZNE","text":"QZONE (QQ)"},{"value":"RDDT","text":"REDDIT"},{"value":"SWBO","text":"SINAWEIBO"},{"value":"TWBO","text":"TENCENTWEIBO"},{"value":"TUMB","text":"TUMBLR"},{"value":"TWIT","text":"TWITTER"},{"value":"TWOO","text":"TWOO"},{"value":"VINE","text":"VINE"},{"value":"VKON","text":"VKONTAKTE (VK)"},{"value":"YUKU","text":"YOUKU"},{"value":"YTUB","text":"YOUTUBE"},{"value":"NONE","text":"NONE"}]'::jsonb
    ELSE options
  END,
  updated_at = now()
WHERE visa_type = 'DS160'
  AND field_name IN (
    'intended_arrival_date',
    'previous_visit_date_arrived',
    'previous_visit_length_of_stay',
    'previous_visit_length_of_stay_unit',
    'us_drivers_license_number',
    'us_drivers_license_state',
    'visa_number',
    'visa_lost_or_stolen_explain',
    'visa_cancelled_or_revoked_explain',
    'refusal_explain',
    'immigrant_petition_explain',
    'home_address_line1',
    'home_address_line2',
    'home_address_city',
    'home_address_state_province',
    'home_address_postal_code',
    'home_address_country',
    'mailing_same_as_home',
    'mailing_address_line1',
    'mailing_address_line2',
    'mailing_address_city',
    'mailing_address_state',
    'mailing_address_postal',
    'mailing_address_country',
    'primary_phone',
    'secondary_phone',
    'work_phone',
    'has_other_phones',
    'additional_phone',
    'email_address',
    'has_other_emails',
    'additional_email',
    'has_social_media',
    'social_media_platform',
    'social_media_handle',
    'social_media_provider',
    'social_media_identifier',
    'has_other_social_media',
    'other_social_media_name',
    'other_social_media_identifier',
    'father_surname',
    'father_given_names',
    'father_date_of_birth',
    'mother_surname',
    'mother_given_names',
    'mother_date_of_birth',
    'father_in_us',
    'mother_in_us',
    'spouse_surname',
    'spouse_given_names',
    'spouse_date_of_birth',
    'spouse_nationality',
    'spouse_city_of_birth',
    'spouse_country_of_birth',
    'spouse_address_type',
    'spouse_address_street1',
    'spouse_address_street2',
    'spouse_address_city',
    'spouse_address_state',
    'spouse_address_zip',
    'spouse_address_country'
  );
