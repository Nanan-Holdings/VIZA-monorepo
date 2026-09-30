-- Run with psql -v ON_ERROR_STOP=1 -f this-file.sql in an EMPTY disposable
-- PostgreSQL database only. Everything, including test roles, rolls back.
-- The initial guard refuses databases containing the application relations.
BEGIN;
DO $$
BEGIN
  IF to_regclass('public.applications') IS NOT NULL
     OR to_regclass('public.submission_queue') IS NOT NULL
     OR to_regprocedure('public.mark_stale_submission_queue_batch(timestamptz,timestamptz,timestamptz,integer)') IS NOT NULL THEN
    RAISE EXCEPTION 'Requires an empty disposable test database';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role; END IF;
END;
$$;
CREATE TABLE public.applications (
  id UUID PRIMARY KEY, submission_result JSONB, submission_result_status TEXT,
  submission_result_updated_at TIMESTAMPTZ
);
CREATE TABLE public.submission_queue (
  id UUID PRIMARY KEY, application_id UUID, provider TEXT, status TEXT,
  attempts INTEGER DEFAULT 0, last_error TEXT, error_code TEXT, error_message TEXT,
  current_stage TEXT, locked_by TEXT, locked_until TIMESTAMPTZ,
  heartbeat_at TIMESTAMPTZ, updated_at TIMESTAMPTZ, created_at TIMESTAMPTZ,
  ceac_result_payload JSONB
);
\ir ../../drizzle/0138_bounded_queue_maintenance.sql

INSERT INTO public.applications VALUES
  ('00000000-0000-4000-8000-000000000001', '{"status":"submitted","country":"US"}', 'submitted', NULL);
INSERT INTO public.submission_queue (id, application_id, provider, status, heartbeat_at)
SELECT id, id, 'ceac_proof', 'ds160_proof_processing', NOW() - INTERVAL '2 hours' FROM public.applications;
SELECT * FROM public.mark_stale_submission_queue_batch(NOW()-INTERVAL '1 hour', NOW()-INTERVAL '1 hour', NOW()-INTERVAL '1 hour');
DO $$
BEGIN
  IF (SELECT submission_result_status FROM public.applications) <> 'failed' THEN
    RAISE EXCEPTION 'Baseline did not reproduce the original proof-result overwrite';
  END IF;
END;
$$;
CREATE TEMP TABLE original_function_acl AS
SELECT proacl FROM pg_proc WHERE oid = 'public.mark_stale_submission_queue_batch(timestamptz,timestamptz,timestamptz,integer)'::regprocedure;
TRUNCATE public.submission_queue, public.applications;

\ir ../../drizzle/0207_preserve_ds160_proof_stale_results.sql
\ir ../../drizzle/0207_preserve_ds160_proof_stale_results.sql

INSERT INTO public.applications (id, submission_result, submission_result_status)
SELECT ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
       '{"status":"submitted","country":"US","proof":"synthetic-only"}', 'submitted'
FROM generate_series(1, 6) AS n;
INSERT INTO public.submission_queue (id, application_id, provider, status, locked_until, heartbeat_at, ceac_result_payload)
SELECT id, id,
       CASE WHEN right(id::text, 1)::int IN (1, 2) THEN 'ceac_proof' ELSE 'ordinary' END,
       CASE WHEN right(id::text, 1)::int IN (1, 2) THEN 'ds160_proof_processing'
            WHEN right(id::text, 1)::int = 5 THEN 'kr_eac_live_assisted_processing' ELSE 'processing' END,
       CASE WHEN right(id::text, 1)::int = 3 THEN NOW()+INTERVAL '10 minutes' ELSE NOW()-INTERVAL '1 minute' END,
       CASE WHEN right(id::text, 1)::int = 6 THEN NOW() ELSE NOW()-INTERVAL '2 hours' END,
       jsonb_build_object('email', jsonb_build_object('status', CASE WHEN right(id::text,1)::int = 2 THEN 'sending' ELSE 'queued' END))
FROM public.applications;
DO $$
DECLARE touched INTEGER;
BEGIN
  SELECT count(*) INTO touched FROM public.mark_stale_submission_queue_batch(NOW()-INTERVAL '1 hour',NOW()-INTERVAL '1 hour',NOW()-INTERVAL '1 hour',1);
  IF touched <> 1 THEN RAISE EXCEPTION 'Batch bound not respected'; END IF;
  SELECT count(*) INTO touched FROM public.mark_stale_submission_queue_batch(NOW()-INTERVAL '1 hour',NOW()-INTERVAL '1 hour',NOW()-INTERVAL '1 hour');
  IF touched <> 1 THEN RAISE EXCEPTION 'Unexpected rows retired'; END IF;
  SELECT count(*) INTO touched FROM public.mark_stale_submission_queue_batch(NOW()-INTERVAL '1 hour',NOW()-INTERVAL '1 hour',NOW()-INTERVAL '1 hour');
  IF touched <> 0 THEN RAISE EXCEPTION 'Maintenance not idempotent'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.submission_queue q JOIN public.applications a ON a.id=q.application_id
    WHERE right(q.id::text,1)::int IN (1,2,3,6)
      AND (a.submission_result <> '{"status":"submitted","country":"US","proof":"synthetic-only"}'::jsonb
           OR a.submission_result_status <> 'submitted'
           OR q.status <> CASE WHEN right(q.id::text,1)::int IN (1,2) THEN 'ds160_proof_processing' ELSE 'processing' END)
  ) THEN RAISE EXCEPTION 'Proof result, active lease or fresh heartbeat was overwritten'; END IF;
  IF EXISTS (SELECT 1 FROM public.submission_queue WHERE provider='ceac_proof'
      AND ceac_result_payload->'email'->>'status' <> CASE WHEN right(id::text,1)::int=2 THEN 'sending' ELSE 'queued' END)
  THEN RAISE EXCEPTION 'Proof payload changed'; END IF;
  IF (SELECT status FROM public.submission_queue WHERE right(id::text,1)='4') <> 'failed'
     OR (SELECT status FROM public.submission_queue WHERE right(id::text,1)='5') <> 'kr_eac_live_assisted_failed'
  THEN RAISE EXCEPTION 'Existing ordinary/Korea terminal behavior changed'; END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p CROSS JOIN original_function_acl a
      WHERE p.oid='public.mark_stale_submission_queue_batch(timestamptz,timestamptz,timestamptz,integer)'::regprocedure
        AND (p.proacl IS DISTINCT FROM a.proacl OR p.prosecdef))
  THEN RAISE EXCEPTION 'Function privilege boundary changed'; END IF;
  IF has_function_privilege('anon','public.mark_stale_submission_queue_batch(timestamptz,timestamptz,timestamptz,integer)','execute')
     OR has_function_privilege('authenticated','public.mark_stale_submission_queue_batch(timestamptz,timestamptz,timestamptz,integer)','execute')
     OR NOT has_function_privilege('service_role','public.mark_stale_submission_queue_batch(timestamptz,timestamptz,timestamptz,integer)','execute')
  THEN RAISE EXCEPTION 'Maintenance must remain service-role-only'; END IF;
END;
$$;
ROLLBACK;
