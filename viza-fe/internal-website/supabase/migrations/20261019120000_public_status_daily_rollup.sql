-- Public status reads a 90-day window. Aggregating raw portal_health_checks
-- (about 8,400 rows a day) took about 14s for 90 days and hit the statement
-- timeout, so /api/public/status returned 503 and the status page was blank.
-- Keep a per-day, per-status rollup that an insert trigger maintains, and read
-- the window from it. The RPC identity, ACL and JSON contract are unchanged.

CREATE TABLE IF NOT EXISTS public.portal_health_check_daily (
  monitor_key TEXT NOT NULL REFERENCES public.portal_health(country) ON UPDATE CASCADE ON DELETE CASCADE,
  day DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ok', 'degraded', 'down', 'unknown')),
  checks INTEGER NOT NULL DEFAULT 0 CHECK (checks >= 0),
  PRIMARY KEY (monitor_key, day, status)
);

CREATE INDEX IF NOT EXISTS portal_health_check_daily_day_idx
  ON public.portal_health_check_daily (day);

ALTER TABLE public.portal_health_check_daily ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.portal_health_check_daily FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.portal_health_check_daily TO service_role;

CREATE OR REPLACE FUNCTION public.portal_health_checks_rollup_daily()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  INSERT INTO public.portal_health_check_daily AS daily (monitor_key, day, status, checks)
  SELECT new_rows.monitor_key, new_rows.checked_at::date, new_rows.status, COUNT(*)::integer
  FROM new_rows
  GROUP BY new_rows.monitor_key, new_rows.checked_at::date, new_rows.status
  ON CONFLICT (monitor_key, day, status)
  DO UPDATE SET checks = daily.checks + EXCLUDED.checks;
  RETURN NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public.portal_health_checks_rollup_daily() FROM PUBLIC, anon, authenticated;

-- Block concurrent probe inserts while the trigger is installed and the
-- history is backfilled, so no check is counted twice or missed.
LOCK TABLE public.portal_health_checks IN SHARE ROW EXCLUSIVE MODE;

DROP TRIGGER IF EXISTS portal_health_checks_rollup_daily ON public.portal_health_checks;
CREATE TRIGGER portal_health_checks_rollup_daily
  AFTER INSERT ON public.portal_health_checks
  REFERENCING NEW TABLE AS new_rows
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.portal_health_checks_rollup_daily();

DELETE FROM public.portal_health_check_daily;
INSERT INTO public.portal_health_check_daily (monitor_key, day, status, checks)
SELECT checks.monitor_key, checks.checked_at::date, checks.status, COUNT(*)::integer
FROM public.portal_health_checks AS checks
GROUP BY checks.monitor_key, checks.checked_at::date, checks.status;

CREATE OR REPLACE FUNCTION public.get_public_portal_status(p_days INTEGER DEFAULT 90)
RETURNS JSONB
LANGUAGE SQL
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
    SELECT CURRENT_DATE - (days - 1) AS daily_start
    FROM bounded
  ),
  daily AS MATERIALIZED (
    SELECT rollup.monitor_key, rollup.day,
      SUM(rollup.checks)::integer AS checks,
      COALESCE(SUM(rollup.checks) FILTER (WHERE rollup.status = 'ok'), 0) AS ok_checks,
      CASE
        WHEN BOOL_OR(rollup.status = 'down') THEN 'down'
        WHEN BOOL_OR(rollup.status = 'degraded') THEN 'degraded'
        WHEN BOOL_OR(rollup.status = 'ok') THEN 'ok'
        ELSE 'unknown'
      END AS status
    FROM public.portal_health_check_daily AS rollup
    JOIN visible ON visible.country = rollup.monitor_key
    CROSS JOIN windows
    WHERE rollup.day >= windows.daily_start
      AND rollup.checks > 0
    GROUP BY rollup.monitor_key, rollup.day
  ),
  per_monitor AS MATERIALIZED (
    SELECT monitor_key,
      SUM(checks) AS uptime_checks,
      SUM(ok_checks) AS uptime_ok_checks,
      jsonb_agg(
        jsonb_build_object(
          'date', day,
          'status', status,
          'uptime', ROUND(100.0 * ok_checks / NULLIF(checks, 0), 2),
          'checks', checks
        ) ORDER BY day
      ) AS days
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

REVOKE ALL ON FUNCTION public.get_public_portal_status(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_portal_status(INTEGER) TO service_role;
