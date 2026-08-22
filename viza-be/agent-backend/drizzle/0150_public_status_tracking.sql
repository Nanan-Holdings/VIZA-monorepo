-- =============================================================================
-- Public, evidence-backed service status tracking
--
-- `portal_health` remains the current-state projection used by ops. This
-- migration adds append-only observations, incident lifecycles, public-safe
-- labels, and transactional RPCs so the public status page never has to invent
-- uptime or incident history.
-- =============================================================================

ALTER TABLE public.portal_health
  ADD COLUMN IF NOT EXISTS monitor_type TEXT NOT NULL DEFAULT 'government_portal',
  ADD COLUMN IF NOT EXISTS iso_code TEXT,
  ADD COLUMN IF NOT EXISTS display_name_en TEXT,
  ADD COLUMN IF NOT EXISTS display_name_zh TEXT,
  ADD COLUMN IF NOT EXISTS description_en TEXT,
  ADD COLUMN IF NOT EXISTS description_zh TEXT,
  ADD COLUMN IF NOT EXISTS public_visible BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS last_ok_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_failure_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_status_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS consecutive_failures INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS consecutive_successes INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'portal_health_monitor_type_check'
  ) THEN
    ALTER TABLE public.portal_health
      ADD CONSTRAINT portal_health_monitor_type_check
      CHECK (monitor_type IN ('platform', 'government_portal'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'portal_health_status_check'
  ) THEN
    ALTER TABLE public.portal_health
      ADD CONSTRAINT portal_health_status_check
      CHECK (status IN ('ok', 'degraded', 'down', 'unknown'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.portal_health_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  monitor_key TEXT NOT NULL REFERENCES public.portal_health(country) ON UPDATE CASCADE ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('ok', 'degraded', 'down', 'unknown')),
  http_status INTEGER,
  latency_ms INTEGER,
  note TEXT,
  error_code TEXT,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source TEXT NOT NULL DEFAULT 'scheduled_probe'
);

CREATE INDEX IF NOT EXISTS portal_health_checks_monitor_checked_idx
  ON public.portal_health_checks (monitor_key, checked_at DESC);
CREATE INDEX IF NOT EXISTS portal_health_checks_checked_idx
  ON public.portal_health_checks (checked_at DESC);

CREATE TABLE IF NOT EXISTS public.status_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  monitor_key TEXT NOT NULL REFERENCES public.portal_health(country) ON UPDATE CASCADE ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'investigating'
    CHECK (status IN ('investigating', 'monitoring', 'resolved')),
  severity TEXT NOT NULL
    CHECK (severity IN ('degraded', 'down')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  last_observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  summary_en TEXT NOT NULL,
  summary_zh TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS status_incidents_one_active_per_monitor_idx
  ON public.status_incidents (monitor_key)
  WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS status_incidents_started_idx
  ON public.status_incidents (started_at DESC);

ALTER TABLE public.portal_health_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_incidents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.portal_health_checks FROM anon, authenticated;
REVOKE ALL ON TABLE public.status_incidents FROM anon, authenticated;
GRANT ALL ON TABLE public.portal_health_checks TO service_role;
GRANT ALL ON TABLE public.status_incidents TO service_role;

-- Public labels are kept beside the operator-controlled probe URL so adding or
-- renaming a monitor does not require a marketing-site deployment.
UPDATE public.portal_health AS health
SET
  iso_code = seed.iso_code,
  display_name_en = seed.name_en,
  display_name_zh = seed.name_zh,
  description_en = seed.description_en,
  description_zh = seed.description_zh,
  sort_order = seed.sort_order
FROM (VALUES
  ('united_states', 'US', 'United States', '美国', 'CEAC visa portal', 'CEAC 签证门户', 10),
  ('united_kingdom', 'GB', 'United Kingdom', '英国', 'UK Visas and Immigration', '英国签证与移民局门户', 20),
  ('european_union', 'FR', 'France / Schengen', '法国 / 申根', 'France-Visas portal', 'France-Visas 门户', 30),
  ('vietnam', 'VN', 'Vietnam', '越南', 'Vietnam e-Visa portal', '越南电子签证门户', 40),
  ('australia', 'AU', 'Australia', '澳大利亚', 'Department of Home Affairs', '内政部签证门户', 50),
  ('japan', 'JP', 'Japan', '日本', 'Japan eVISA portal', '日本电子签证门户', 60),
  ('indonesia', 'ID', 'Indonesia', '印度尼西亚', 'Official e-Visa portal', '官方电子签证门户', 70),
  ('egypt', 'EG', 'Egypt', '埃及', 'Egypt e-Visa portal', '埃及电子签证门户', 80),
  ('south_korea', 'KR', 'South Korea', '韩国', 'K-ETA portal', 'K-ETA 门户', 90),
  ('thailand', 'TH', 'Thailand', '泰国', 'Thailand e-Visa portal', '泰国电子签证门户', 100),
  ('malaysia', 'MY', 'Malaysia', '马来西亚', 'Malaysia eVISA portal', '马来西亚电子签证门户', 110),
  ('singapore', 'SG', 'Singapore', '新加坡', 'ICA visa information service', 'ICA 签证信息服务', 120),
  ('hong_kong', 'HK', 'Hong Kong', '中国香港', 'Immigration Department portal', '入境事务处门户', 130),
  ('macau', 'MO', 'Macao', '中国澳门', 'Public Security Police portal', '治安警察局门户', 140),
  ('new_zealand', 'NZ', 'New Zealand', '新西兰', 'Immigration New Zealand', '新西兰移民局门户', 150),
  ('philippines', 'PH', 'Philippines', '菲律宾', 'Philippines e-Visa portal', '菲律宾电子签证门户', 160),
  ('cambodia', 'KH', 'Cambodia', '柬埔寨', 'Cambodia e-Visa portal', '柬埔寨电子签证门户', 170),
  ('laos', 'LA', 'Laos', '老挝', 'Laos eVisa portal', '老挝电子签证门户', 180),
  ('sri_lanka', 'LK', 'Sri Lanka', '斯里兰卡', 'ETA portal', 'ETA 门户', 190),
  ('india', 'IN', 'India', '印度', 'Indian Visa Online', '印度在线签证门户', 200),
  ('maldives', 'MV', 'Maldives', '马尔代夫', 'IMUGA traveller portal', 'IMUGA 旅客门户', 210),
  ('russia', 'RU', 'Russia', '俄罗斯', 'Unified e-Visa portal', '统一电子签证门户', 220),
  ('turkey', 'TR', 'Türkiye', '土耳其', 'Ministry of Foreign Affairs e-Visa', '外交部电子签证门户', 230),
  ('united_arab_emirates', 'AE', 'United Arab Emirates', '阿联酋', 'ICP smart services', 'ICP 智能服务门户', 240),
  ('canada', 'CA', 'Canada', '加拿大', 'IRCC visitor visa service', 'IRCC 访客签证服务', 250),
  ('south_africa', 'ZA', 'South Africa', '南非', 'VFS visa portal', 'VFS 签证门户', 260)
) AS seed(monitor_key, iso_code, name_en, name_zh, description_en, description_zh, sort_order)
WHERE health.country = seed.monitor_key;

-- Replace two retired portal hosts from the original OPS-004 seed with the
-- current official public entry points used by VIZA's live product flows.
UPDATE public.portal_health
SET probe_url = 'https://evisa.gov.vn/'
WHERE country = 'vietnam';

UPDATE public.portal_health
SET probe_url = 'https://evisa.imigrasi.go.id/'
WHERE country = 'indonesia';

INSERT INTO public.portal_health (
  country,
  probe_url,
  monitor_type,
  iso_code,
  display_name_en,
  display_name_zh,
  description_en,
  description_zh,
  sort_order
) VALUES
(
  'viza_web',
  'https://viza.it.com/',
  'platform',
  'VZ',
  'VIZA web platform',
  'VIZA 网页平台',
  'Public website and status experience',
  '官网与状态服务',
  1
),
(
  'viza_client_portal',
  'https://app.viza.it.com/',
  'platform',
  'APP',
  'VIZA applicant portal',
  'VIZA 申请人门户',
  'Authentication and applicant workspace entry point',
  '登录与申请工作区入口',
  2
),
(
  'viza_agent_api',
  'https://viza-agent-backend-gqix.onrender.com/ready',
  'platform',
  'API',
  'VIZA application API',
  'VIZA 申请服务 API',
  'Dependency readiness for the application and AI backend',
  '申请与 AI 后端依赖就绪状态',
  3
)
ON CONFLICT (country) DO UPDATE SET
  probe_url = EXCLUDED.probe_url,
  monitor_type = EXCLUDED.monitor_type,
  iso_code = EXCLUDED.iso_code,
  display_name_en = EXCLUDED.display_name_en,
  display_name_zh = EXCLUDED.display_name_zh,
  description_en = EXCLUDED.description_en,
  description_zh = EXCLUDED.description_zh,
  sort_order = EXCLUDED.sort_order;

CREATE OR REPLACE FUNCTION public.record_portal_health_check(
  p_monitor_key TEXT,
  p_status TEXT,
  p_http_status INTEGER,
  p_latency_ms INTEGER,
  p_note TEXT,
  p_error_code TEXT,
  p_checked_at TIMESTAMPTZ DEFAULT NOW(),
  p_source TEXT DEFAULT 'scheduled_probe'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_previous_status TEXT;
  v_name_en TEXT;
  v_name_zh TEXT;
BEGIN
  IF p_status NOT IN ('ok', 'degraded', 'down', 'unknown') THEN
    RAISE EXCEPTION 'invalid portal health status: %', p_status;
  END IF;

  SELECT status, COALESCE(display_name_en, country), COALESCE(display_name_zh, display_name_en, country)
  INTO v_previous_status, v_name_en, v_name_zh
  FROM public.portal_health
  WHERE country = p_monitor_key
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown portal health monitor: %', p_monitor_key;
  END IF;

  INSERT INTO public.portal_health_checks (
    monitor_key, status, http_status, latency_ms, note, error_code, checked_at, source
  ) VALUES (
    p_monitor_key, p_status, p_http_status, p_latency_ms, p_note, p_error_code, p_checked_at, p_source
  );

  UPDATE public.portal_health
  SET
    status = p_status,
    http_status = p_http_status,
    latency_ms = p_latency_ms,
    note = p_note,
    error = p_error_code,
    last_run_at = p_checked_at,
    last_ok_at = CASE WHEN p_status = 'ok' THEN p_checked_at ELSE last_ok_at END,
    last_failure_at = CASE WHEN p_status IN ('degraded', 'down') THEN p_checked_at ELSE last_failure_at END,
    last_status_changed_at = CASE WHEN status IS DISTINCT FROM p_status THEN p_checked_at ELSE last_status_changed_at END,
    consecutive_failures = CASE WHEN p_status IN ('degraded', 'down') THEN consecutive_failures + 1 ELSE 0 END,
    consecutive_successes = CASE WHEN p_status = 'ok' THEN consecutive_successes + 1 ELSE 0 END
  WHERE country = p_monitor_key;

  IF p_status IN ('degraded', 'down') THEN
    INSERT INTO public.status_incidents (
      monitor_key,
      severity,
      started_at,
      last_observed_at,
      summary_en,
      summary_zh
    ) VALUES (
      p_monitor_key,
      p_status,
      p_checked_at,
      p_checked_at,
      v_name_en || CASE WHEN p_status = 'down' THEN ' is unavailable' ELSE ' is degraded' END,
      v_name_zh || CASE WHEN p_status = 'down' THEN '当前不可用' ELSE '当前性能下降' END
    )
    ON CONFLICT (monitor_key) WHERE resolved_at IS NULL
    DO UPDATE SET
      severity = EXCLUDED.severity,
      last_observed_at = EXCLUDED.last_observed_at,
      summary_en = EXCLUDED.summary_en,
      summary_zh = EXCLUDED.summary_zh,
      updated_at = NOW();
  ELSIF p_status = 'ok' AND v_previous_status IN ('degraded', 'down') THEN
    UPDATE public.status_incidents
    SET
      status = 'resolved',
      resolved_at = p_checked_at,
      last_observed_at = p_checked_at,
      updated_at = NOW()
    WHERE monitor_key = p_monitor_key
      AND resolved_at IS NULL;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_public_portal_status(p_days INTEGER DEFAULT 90)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH bounded AS (
    SELECT LEAST(GREATEST(COALESCE(p_days, 90), 1), 90) AS days
  ),
  visible AS (
    SELECT *
    FROM public.portal_health
    WHERE public_visible = TRUE
  ),
  daily AS (
    SELECT
      checks.monitor_key,
      checks.checked_at::date AS day,
      COUNT(*)::integer AS checks,
      ROUND(
        100.0 * COUNT(*) FILTER (WHERE checks.status = 'ok') / NULLIF(COUNT(*), 0),
        2
      ) AS uptime,
      CASE
        WHEN BOOL_OR(checks.status = 'down') THEN 'down'
        WHEN BOOL_OR(checks.status = 'degraded') THEN 'degraded'
        WHEN BOOL_OR(checks.status = 'ok') THEN 'ok'
        ELSE 'unknown'
      END AS status
    FROM public.portal_health_checks AS checks, bounded
    WHERE checks.checked_at >= CURRENT_DATE - (bounded.days - 1)
    GROUP BY checks.monitor_key, checks.checked_at::date
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
        'uptime90d', (
          SELECT ROUND(
            100.0 * COUNT(*) FILTER (WHERE checks.status = 'ok') / NULLIF(COUNT(*), 0),
            2
          )
          FROM public.portal_health_checks AS checks, bounded
          WHERE checks.monitor_key = visible.country
            AND checks.checked_at >= NOW() - make_interval(days => bounded.days)
        ),
        'days', COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object(
              'date', daily.day,
              'status', daily.status,
              'uptime', daily.uptime,
              'checks', daily.checks
            ) ORDER BY daily.day
          )
          FROM daily
          WHERE daily.monitor_key = visible.country
        ), '[]'::jsonb)
      ) AS payload
    FROM visible
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
          100.0 * COUNT(*) FILTER (WHERE checks.status = 'ok') / NULLIF(COUNT(*), 0),
          2
        )
        FROM public.portal_health_checks AS checks
        JOIN visible ON visible.country = checks.monitor_key
        CROSS JOIN bounded
        WHERE checks.checked_at >= NOW() - make_interval(days => bounded.days)
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
$$;

REVOKE ALL ON FUNCTION public.record_portal_health_check(TEXT, TEXT, INTEGER, INTEGER, TEXT, TEXT, TIMESTAMPTZ, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_public_portal_status(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_portal_health_check(TEXT, TEXT, INTEGER, INTEGER, TEXT, TEXT, TIMESTAMPTZ, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_public_portal_status(INTEGER) TO service_role;

COMMENT ON TABLE public.portal_health_checks IS
  'Append-only, service-only synthetic reachability observations used to calculate real public uptime.';
COMMENT ON TABLE public.status_incidents IS
  'Incident lifecycles derived transactionally from portal health observations; contains no applicant data.';
COMMENT ON FUNCTION public.get_public_portal_status(INTEGER) IS
  'Returns the redacted status-page snapshot consumed only through the agent-backend public API.';
