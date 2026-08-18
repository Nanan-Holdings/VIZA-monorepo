-- The official Vietnam pre-arrival form requires this acknowledgement, but the
-- VIZA dynamic form only renders helpers marked as critical. Make the notice
-- self-contained and visible next to the checkbox for existing seeded rows.

UPDATE public.visa_form_fields
SET validation_rules = COALESCE(validation_rules, '{}'::jsonb)
      || jsonb_build_object(
        'label_zh', '我已阅读并理解以下签证信息说明',
        'helper_priority', 'critical',
        'helper_zh', '签证信息说明：请按实际情况提供越南签证信息（如适用）。所选签证类型决定允许入境期限；请填写签证编号，以便在机场使用该服务。',
        'helper_en', 'Visa information notice: Provide details of your Vietnam visa (if applicable). The selected visa type determines your permitted entry period. Enter your visa number to enable the service at the airport.'
      ),
    updated_at = now()
WHERE visa_type = 'VN_PREARRIVAL_DECLARATION'
  AND field_name = 'visa_information_acknowledgement';
