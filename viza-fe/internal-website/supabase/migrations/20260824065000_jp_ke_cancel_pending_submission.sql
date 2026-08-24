-- Let the existing application-first cancellation RPC settle Japan VJW and
-- Kenya eTA pending/scheduled work without weakening its null-lease checks.
DO $$
DECLARE
  function_oid REGPROCEDURE :=
    'public.cancel_application_submission(uuid,uuid,text)'::REGPROCEDURE;
  original_definition TEXT;
  updated_definition TEXT;
BEGIN
  original_definition := pg_get_functiondef(function_oid);

  IF original_definition LIKE '%WHEN ''JP_VISIT_JAPAN_WEB'' THEN ''jp_vjw_live_assisted_cancelled''%'
     AND original_definition LIKE '%WHEN ''KE_ETA'' THEN ''ke_eta_live_assisted_cancelled''%'
     AND original_definition LIKE '%''jp_vjw_live_assisted_pending''%'
     AND original_definition LIKE '%''ke_eta_live_assisted_pending''%' THEN
    RETURN;
  END IF;

  updated_definition := replace(
    original_definition,
    $old$    WHEN 'KR_E_ARRIVAL_CARD' THEN 'kr_eac_live_assisted_cancelled'
    ELSE 'sgac_live_assisted_cancelled'$old$,
    $new$    WHEN 'KR_E_ARRIVAL_CARD' THEN 'kr_eac_live_assisted_cancelled'
    WHEN 'JP_VISIT_JAPAN_WEB' THEN 'jp_vjw_live_assisted_cancelled'
    WHEN 'KE_ETA' THEN 'ke_eta_live_assisted_cancelled'
    ELSE 'sgac_live_assisted_cancelled'$new$
  );
  updated_definition := replace(
    updated_definition,
    $old$        'vn_prearrival_dry_run_pending',$old$,
    $new$        'vn_prearrival_dry_run_pending',
        'jp_vjw_live_assisted_scheduled', 'jp_vjw_live_assisted_pending',
        'ke_eta_live_assisted_scheduled', 'ke_eta_live_assisted_pending',$new$
  );

  IF updated_definition = original_definition
     OR updated_definition NOT LIKE '%WHEN ''JP_VISIT_JAPAN_WEB'' THEN ''jp_vjw_live_assisted_cancelled''%'
     OR updated_definition NOT LIKE '%WHEN ''KE_ETA'' THEN ''ke_eta_live_assisted_cancelled''%'
     OR updated_definition NOT LIKE '%''jp_vjw_live_assisted_pending''%'
     OR updated_definition NOT LIKE '%''ke_eta_live_assisted_pending''%' THEN
    RAISE EXCEPTION 'Japan/Kenya cancellation patch was not applied';
  END IF;

  EXECUTE updated_definition;
END;
$$;

COMMENT ON FUNCTION public.cancel_application_submission(UUID, UUID, TEXT) IS
  'Cancels one exact null-lease queued submission, including Japan VJW and Kenya eTA, and resets its application atomically.';
