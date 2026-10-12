-- Refuse to recreate an absent RPC with PostgreSQL's default PUBLIC execute
-- grant, or overwrite an unexpected function revision/authorization contract.
DO $preflight$
DECLARE
  current_function pg_catalog.pg_proc%ROWTYPE;
  body_hash text;
BEGIN
  SELECT * INTO current_function FROM pg_catalog.pg_proc
  WHERE oid = pg_catalog.to_regprocedure('public.get_public_portal_status(integer)');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Public status RPC prerequisite is missing';
  END IF;
  body_hash := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
    pg_catalog.btrim(pg_catalog.replace(current_function.prosrc, E'\r\n', E'\n'), E' \t\r\n'), 'UTF8'
  )), 'hex');
  IF body_hash NOT IN ('0e8edf81b8783280b498304588461d237678df166a254d13476c1762aa70e44b', '328e302e70b8dea767a7b966afb40731331746074a5a6ed2bffd2c1259c0ef30')
    OR current_function.prorettype <> 'jsonb'::pg_catalog.regtype
    OR current_function.provolatile <> 's'
    OR NOT current_function.prosecdef
    OR current_function.proconfig IS DISTINCT FROM ARRAY['search_path=""']::text[]
    OR pg_catalog.has_function_privilege('anon', current_function.oid, 'EXECUTE')
    OR pg_catalog.has_function_privilege('authenticated', current_function.oid, 'EXECUTE')
    OR NOT pg_catalog.has_function_privilege('service_role', current_function.oid, 'EXECUTE')
  THEN
    RAISE EXCEPTION 'Public status RPC body or authorization contract drifted';
  END IF;
END
$preflight$;

-- Aggregate public status history once before projecting monitor JSON.
-- Preserve the service-only RPC identity, ACL, time windows, and JSON contract.
CREATE OR REPLACE FUNCTION public.get_public_portal_status(p_days integer DEFAULT 90)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
WITH bounded AS (
    SELECT LEAST(GREATEST(COALESCE(p_days, 90), 1), 90) AS days
  ),
  visible AS MATERIALIZED (
    SELECT *
    FROM public.portal_health
    WHERE public_visible = TRUE
  ),
  windows AS (
    SELECT CURRENT_DATE - (days - 1) AS daily_start,
      NOW() - make_interval(days => days) AS uptime_start
    FROM bounded
  ),
  observation_counts AS MATERIALIZED (
    SELECT checks.monitor_key, checks.checked_at::date AS day, checks.status,
      COUNT(*) AS checks,
      COUNT(*) FILTER (WHERE checks.checked_at >= windows.uptime_start) AS uptime_checks
    FROM public.portal_health_checks AS checks
    JOIN visible ON visible.country = checks.monitor_key
    CROSS JOIN windows
    WHERE (checks.checked_at >= windows.daily_start OR checks.checked_at >= windows.uptime_start)
    GROUP BY checks.monitor_key, checks.checked_at::date, checks.status
  ),
  daily AS (
    SELECT counts.monitor_key, counts.day,
      COALESCE(SUM(counts.checks) FILTER (WHERE counts.day >= windows.daily_start), 0)::integer AS checks,
      COALESCE(SUM(counts.checks) FILTER (
        WHERE counts.day >= windows.daily_start AND counts.status = 'ok'
      ), 0) AS ok_checks,
      CASE
        WHEN BOOL_OR(counts.status = 'down') FILTER (WHERE counts.day >= windows.daily_start) THEN 'down'
        WHEN BOOL_OR(counts.status = 'degraded') FILTER (WHERE counts.day >= windows.daily_start) THEN 'degraded'
        WHEN BOOL_OR(counts.status = 'ok') FILTER (WHERE counts.day >= windows.daily_start) THEN 'ok'
        ELSE 'unknown'
      END AS status,
      SUM(counts.uptime_checks) AS uptime_checks,
      COALESCE(SUM(counts.uptime_checks) FILTER (WHERE counts.status = 'ok'), 0) AS uptime_ok_checks
    FROM observation_counts AS counts
    CROSS JOIN windows
    GROUP BY counts.monitor_key, counts.day
  ),
  per_monitor AS MATERIALIZED (
    SELECT monitor_key,
      SUM(uptime_checks) AS uptime_checks,
      SUM(uptime_ok_checks) AS uptime_ok_checks,
      jsonb_agg(
        jsonb_build_object(
          'date', day,
          'status', status,
          'uptime', ROUND(100.0 * ok_checks / NULLIF(checks, 0), 2),
          'checks', checks
        ) ORDER BY day
      ) FILTER (WHERE checks > 0) AS days
    FROM daily
    GROUP BY monitor_key
  ),
  monitor_payload AS (
    SELECT
      visible.country,
      visible.sort_order,
      jsonb_build_object(
        'id', visible.country,
        'type', visible.monitor_type,
        'code', visible.iso_code,
        'name', jsonb_build_object(
          'en', COALESCE(visible.display_name_en, visible.country),
          'zh-CN', COALESCE(visible.display_name_zh, visible.display_name_en, visible.country)
        ),
        'description', jsonb_build_object(
          'en', COALESCE(visible.description_en, ''),
          'zh-CN', COALESCE(visible.description_zh, visible.description_en, '')
        ),
        'status', visible.status,
        'lastCheckedAt', visible.last_run_at,
        'latencyMs', visible.latency_ms,
        'uptime90d', ROUND(
          100.0 * per_monitor.uptime_ok_checks / NULLIF(per_monitor.uptime_checks, 0), 2
        ),
        'days', COALESCE(per_monitor.days, '[]'::jsonb)
      ) AS payload
    FROM visible
    LEFT JOIN per_monitor ON per_monitor.monitor_key = visible.country
  ),
  summary AS (
    SELECT
      COUNT(*)::integer AS monitored,
      COUNT(*) FILTER (WHERE status = 'ok')::integer AS operational,
      CASE
        WHEN COUNT(*) = 0 OR BOOL_AND(status = 'unknown') THEN 'unknown'
        WHEN BOOL_OR(status = 'down') THEN 'major_outage'
        WHEN BOOL_OR(status = 'degraded') THEN 'degraded'
        WHEN BOOL_AND(status = 'ok') THEN 'operational'
        ELSE 'unknown'
      END AS status
    FROM visible
  )
  SELECT jsonb_build_object(
    'version', 1,
    'generatedAt', NOW(),
    'probeIntervalSeconds', 300,
    'staleAfterSeconds', 900,
    'summary', jsonb_build_object(
      'status', summary.status,
      'monitored', summary.monitored,
      'operational', summary.operational,
      'uptime90d', (
        SELECT ROUND(
          100.0 * SUM(uptime_ok_checks) / NULLIF(SUM(uptime_checks), 0), 2
        )
        FROM per_monitor
      ),
      'activeIncidents', (
        SELECT COUNT(*)::integer
        FROM public.status_incidents AS incidents
        JOIN visible ON visible.country = incidents.monitor_key
        WHERE incidents.resolved_at IS NULL
      )
    ),
    'monitors', COALESCE((
      SELECT jsonb_agg(monitor_payload.payload ORDER BY monitor_payload.sort_order, monitor_payload.country)
      FROM monitor_payload
    ), '[]'::jsonb),
    'incidents', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', incidents.id,
          'monitorId', incidents.monitor_key,
          'status', incidents.status,
          'severity', incidents.severity,
          'startedAt', incidents.started_at,
          'resolvedAt', incidents.resolved_at,
          'lastObservedAt', incidents.last_observed_at,
          'summary', jsonb_build_object(
            'en', incidents.summary_en,
            'zh-CN', incidents.summary_zh
          )
        ) ORDER BY incidents.started_at DESC
      )
      FROM public.status_incidents AS incidents
      JOIN visible ON visible.country = incidents.monitor_key
      WHERE incidents.started_at >= NOW() - INTERVAL '90 days'
    ), '[]'::jsonb)
  )
  FROM summary;
$function$;
