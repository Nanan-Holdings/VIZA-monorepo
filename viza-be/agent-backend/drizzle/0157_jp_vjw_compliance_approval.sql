-- Records the operator-approved Visit Japan Web compliance decision.
-- This changes catalog readiness only. Runtime and final-submission gates remain
-- fail-closed until their deployment flags and applicant authorization are set.

UPDATE public.visa_packages
SET
  description = 'Japan Visit Japan Web immigration and customs arrival declaration for one Chinese ordinary-passport tourism traveller. This is not a visa. The service is free on official channels. VIZA is an independent service and is not a Japanese government website.',
  metadata = COALESCE(metadata, '{}'::JSONB) || jsonb_build_object(
    'automation_gate', 'ready',
    'launch_compliance_gate', 'approved',
    'compliance_decision_source', 'operator_confirmation',
    'compliance_decision_date', '2026-08-21'
  ),
  updated_at = NOW()
WHERE LOWER(TRIM(country)) = 'japan'
  AND UPPER(TRIM(visa_type)) = 'JP_VISIT_JAPAN_WEB';

UPDATE public.government_fee_rules
SET
  notes = 'Official Visit Japan Web is free. VIZA service fees, if any, must remain separate from the official fee.',
  metadata = COALESCE(metadata, '{}'::JSONB) || jsonb_build_object(
    'automation_gate', 'ready',
    'compliance_decision_source', 'operator_confirmation',
    'compliance_decision_date', '2026-08-21'
  )
WHERE LOWER(TRIM(country)) = 'japan'
  AND UPPER(TRIM(visa_type)) = 'JP_VISIT_JAPAN_WEB'
  AND fee_type = 'government_fee';
