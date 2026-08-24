-- Keep the ownership-fenced shared-pool result writer aligned with the
-- canonical SubmissionResultStatus union used by automated JP/KE runners.
DO $migration$
DECLARE
  v_definition TEXT;
  v_status TEXT;
BEGIN
  SELECT pg_catalog.pg_get_functiondef(routine.oid)
  INTO v_definition
  FROM pg_catalog.pg_proc AS routine
  JOIN pg_catalog.pg_namespace AS namespace
    ON namespace.oid = routine.pronamespace
  WHERE namespace.nspname = 'public'
    AND routine.proname = 'write_runner_pool_submission_result'
    AND pg_catalog.pg_get_function_identity_arguments(routine.oid) =
      'p_job_id uuid, p_worker_id text, p_submission_result jsonb, p_submission_result_status text';

  IF v_definition IS NULL THEN
    RAISE EXCEPTION 'write_runner_pool_submission_result(UUID, TEXT, JSONB, TEXT) is missing';
  END IF;

  FOREACH v_status IN ARRAY ARRAY[
    'qr_ready',
    'approved',
    'rejected',
    'needs_attention',
    'blocked'
  ]
  LOOP
    IF pg_catalog.strpos(v_definition, pg_catalog.quote_literal(v_status)) = 0 THEN
      v_definition := pg_catalog.replace(
        v_definition,
        E'      ''submitted'',\n',
        pg_catalog.format(E'      ''submitted'',\n      %L,\n', v_status)
      );
    END IF;
  END LOOP;

  IF pg_catalog.strpos(v_definition, '''qr_ready''') = 0
    OR pg_catalog.strpos(v_definition, '''approved''') = 0
    OR pg_catalog.strpos(v_definition, '''rejected''') = 0
    OR pg_catalog.strpos(v_definition, '''needs_attention''') = 0
    OR pg_catalog.strpos(v_definition, '''blocked''') = 0
  THEN
    RAISE EXCEPTION 'write_runner_pool_submission_result status expansion did not match the installed function body';
  END IF;

  EXECUTE v_definition;
END;
$migration$;

COMMENT ON FUNCTION public.write_runner_pool_submission_result(UUID, TEXT, JSONB, TEXT) IS
  'Writes an application result only for the live runner-job lease owner; accepts every canonical JP/KE terminal result status.';
