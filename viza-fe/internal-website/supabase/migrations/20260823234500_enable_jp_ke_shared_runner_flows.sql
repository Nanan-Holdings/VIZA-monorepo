-- Enable the registered Japan VJW and Kenya eTA flows in the on-demand shared pool.
INSERT INTO public.runner_concurrency_cap (country, max_concurrent, paused, notes)
VALUES
  ('japan', 1, FALSE, 'Shared pool: Japan Visit Japan Web session'),
  ('kenya', 1, FALSE, 'Shared pool: Kenya eTA application session')
ON CONFLICT (country) DO UPDATE
SET max_concurrent = EXCLUDED.max_concurrent,
    notes = EXCLUDED.notes,
    updated_at = NOW();

DO $$
DECLARE
  function_oid REGPROCEDURE;
  original_definition TEXT;
  updated_definition TEXT;
BEGIN
  FOR function_oid IN
    SELECT unnest(ARRAY[
      'public.enqueue_runner_pool_job(uuid,text,text,timestamptz,integer,text,jsonb,timestamptz)'::REGPROCEDURE,
      'runner_private.claim_runner_pool_job_core(text,integer,boolean,timestamptz,uuid,boolean)'::REGPROCEDURE,
      'runner_private.guard_runner_job_running_insert()'::REGPROCEDURE,
      'public.requeue_runner_job(uuid)'::REGPROCEDURE
    ])
  LOOP
    original_definition := pg_get_functiondef(function_oid);
    IF original_definition LIKE '%jp_vjw%' AND original_definition LIKE '%ke_eta%' THEN
      CONTINUE;
    END IF;
    updated_definition := original_definition;
    updated_definition := replace(updated_definition,
      $flow$    OR (v_country = 'taiwan' AND v_flow = 'tw_entry_permit')$flow$,
      $flow$    OR (v_country = 'taiwan' AND v_flow = 'tw_entry_permit')
    OR (v_country = 'japan' AND v_flow = 'jp_vjw')
    OR (v_country = 'kenya' AND v_flow = 'ke_eta')$flow$);
    updated_definition := replace(updated_definition,
      $flow$        OR (expired.country = 'taiwan' AND expired.flow_key = 'tw_entry_permit')$flow$,
      $flow$        OR (expired.country = 'taiwan' AND expired.flow_key = 'tw_entry_permit')
        OR (expired.country = 'japan' AND expired.flow_key = 'jp_vjw')
        OR (expired.country = 'kenya' AND expired.flow_key = 'ke_eta')$flow$);
    updated_definition := replace(updated_definition,
      $flow$      OR (v_expired_old_row.country = 'taiwan' AND v_expired_old_row.flow_key = 'tw_entry_permit')$flow$,
      $flow$      OR (v_expired_old_row.country = 'taiwan' AND v_expired_old_row.flow_key = 'tw_entry_permit')
      OR (v_expired_old_row.country = 'japan' AND v_expired_old_row.flow_key = 'jp_vjw')
      OR (v_expired_old_row.country = 'kenya' AND v_expired_old_row.flow_key = 'ke_eta')$flow$);
    updated_definition := replace(updated_definition,
      $flow$          OR (oldest_candidate.country = 'taiwan' AND oldest_candidate.flow_key = 'tw_entry_permit')$flow$,
      $flow$          OR (oldest_candidate.country = 'taiwan' AND oldest_candidate.flow_key = 'tw_entry_permit')
          OR (oldest_candidate.country = 'japan' AND oldest_candidate.flow_key = 'jp_vjw')
          OR (oldest_candidate.country = 'kenya' AND oldest_candidate.flow_key = 'ke_eta')$flow$);
    updated_definition := replace(updated_definition,
      $flow$          OR (candidate.country = 'taiwan' AND candidate.flow_key = 'tw_entry_permit')$flow$,
      $flow$          OR (candidate.country = 'taiwan' AND candidate.flow_key = 'tw_entry_permit')
          OR (candidate.country = 'japan' AND candidate.flow_key = 'jp_vjw')
          OR (candidate.country = 'kenya' AND candidate.flow_key = 'ke_eta')$flow$);
    updated_definition := replace(updated_definition,
      $flow$              OR (active.country = 'taiwan' AND active.flow_key = 'tw_entry_permit')$flow$,
      $flow$              OR (active.country = 'taiwan' AND active.flow_key = 'tw_entry_permit')
              OR (active.country = 'japan' AND active.flow_key = 'jp_vjw')
              OR (active.country = 'kenya' AND active.flow_key = 'ke_eta')$flow$);
    updated_definition := replace(updated_definition,
      $flow$                OR (active_global.country = 'taiwan' AND active_global.flow_key = 'tw_entry_permit')$flow$,
      $flow$                OR (active_global.country = 'taiwan' AND active_global.flow_key = 'tw_entry_permit')
                OR (active_global.country = 'japan' AND active_global.flow_key = 'jp_vjw')
                OR (active_global.country = 'kenya' AND active_global.flow_key = 'ke_eta')$flow$);
    updated_definition := replace(updated_definition,
      $flow$      OR (NEW.country = 'taiwan' AND NEW.flow_key = 'tw_entry_permit')$flow$,
      $flow$      OR (NEW.country = 'taiwan' AND NEW.flow_key = 'tw_entry_permit')
      OR (NEW.country = 'japan' AND NEW.flow_key = 'jp_vjw')
      OR (NEW.country = 'kenya' AND NEW.flow_key = 'ke_eta')$flow$);
    updated_definition := replace(updated_definition,
      $flow$    OR (job.country = 'taiwan' AND job.flow_key = 'tw_entry_permit')$flow$,
      $flow$    OR (job.country = 'taiwan' AND job.flow_key = 'tw_entry_permit')
    OR (job.country = 'japan' AND job.flow_key = 'jp_vjw')
    OR (job.country = 'kenya' AND job.flow_key = 'ke_eta')$flow$);
    updated_definition := replace(updated_definition,
      'WHILE v_cap_iterations < 6 LOOP',
      'WHILE v_cap_iterations < 8 LOOP');
    updated_definition := replace(updated_definition,
      $flow$'south_korea', 'taiwan'$flow$,
      $flow$'south_korea', 'taiwan', 'japan', 'kenya'$flow$);
    IF updated_definition NOT LIKE '%jp_vjw%' OR updated_definition NOT LIKE '%ke_eta%' THEN
      RAISE EXCEPTION 'Japan/Kenya runner tuple patch was not applied to %', function_oid;
    END IF;
    IF updated_definition <> original_definition THEN
      EXECUTE updated_definition;
    END IF;
  END LOOP;
END;
$$;

ALTER TABLE public.runner_job DROP CONSTRAINT IF EXISTS runner_job_active_flow_key_check;
ALTER TABLE public.runner_job
  ADD CONSTRAINT runner_job_active_flow_key_check
  CHECK (
    status NOT IN ('queued', 'running')
    OR COALESCE((
      (country = 'vietnam' AND flow_key = 'vn_prearrival')
      OR (country = 'singapore' AND flow_key = 'sgac')
      OR (country = 'malaysia' AND flow_key = 'mdac')
      OR (country = 'thailand' AND flow_key = 'tdac')
      OR (country = 'south_korea' AND flow_key IN ('kr_eform', 'kr_arrival_card'))
      OR (country = 'taiwan' AND flow_key = 'tw_entry_permit')
      OR (country = 'japan' AND flow_key = 'jp_vjw')
      OR (country = 'kenya' AND flow_key = 'ke_eta')
    ), FALSE)
  );

DO $$
DECLARE
  original_definition TEXT;
  updated_definition TEXT;
BEGIN
  original_definition := pg_get_viewdef('public.runner_pool_depth'::REGCLASS, TRUE);
  IF original_definition LIKE '%jp_vjw%' AND original_definition LIKE '%ke_eta%' THEN
    RETURN;
  END IF;
  updated_definition := replace(original_definition,
    $view$OR rj.country = 'taiwan'::text AND rj.flow_key = 'tw_entry_permit'::text$view$,
    $view$OR rj.country = 'taiwan'::text AND rj.flow_key = 'tw_entry_permit'::text OR rj.country = 'japan'::text AND rj.flow_key = 'jp_vjw'::text OR rj.country = 'kenya'::text AND rj.flow_key = 'ke_eta'::text$view$);
  updated_definition := replace(updated_definition,
    $view$'taiwan'::text])$view$,
    $view$'taiwan'::text, 'japan'::text, 'kenya'::text])$view$);
  IF updated_definition NOT LIKE '%jp_vjw%' OR updated_definition NOT LIKE '%ke_eta%' THEN
    RAISE EXCEPTION 'Japan/Kenya runner pool depth patch was not applied';
  END IF;
  EXECUTE 'CREATE OR REPLACE VIEW public.runner_pool_depth WITH (security_invoker = true) AS ' || updated_definition;
END;
$$;

COMMENT ON FUNCTION public.enqueue_runner_pool_job(
  UUID, TEXT, TEXT, TIMESTAMPTZ, INTEGER, TEXT, JSONB, TIMESTAMPTZ
) IS 'Atomically reuses or enqueues one exact shared-pool flow, including Japan VJW and Kenya eTA.';
COMMENT ON VIEW public.runner_pool_depth IS
  'Claimable, scheduled, and running shared-pool demand, including Japan VJW and Kenya eTA.';

