-- =============================================================================
-- Per-country concurrency caps + queue-depth view (INFRA-003)
--
-- runner_concurrency_cap is the source of truth for "no more than N
-- concurrent runner jobs against country C". Worker checks the count
-- of running rows for its country and refuses to claim past the cap.
--
-- runner_queue_depth is a SQL view the autoscaler reads each tick to
-- decide how many workers to fan out per country.
-- =============================================================================

CREATE TABLE IF NOT EXISTS runner_concurrency_cap (
  country TEXT PRIMARY KEY,
  max_concurrent INTEGER NOT NULL DEFAULT 1,
  /** Optional override — operator can pause a country by setting 0. */
  paused BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE runner_concurrency_cap ENABLE ROW LEVEL SECURITY;
-- Service role only.

-- Conservative defaults: 1 concurrent for every country we have a
-- runner for. Ops bumps these as we observe portal tolerance.
INSERT INTO runner_concurrency_cap (country, max_concurrent, notes) VALUES
  ('united_states', 1, 'CEAC anti-bot is aggressive — keep at 1 until proxy pool lands'),
  ('united_kingdom', 1, 'apply-uk-visa.service.gov.uk: account login throttle'),
  ('european_union', 1, 'France-Visas + Italy VFS-CN; per-portal cap'),
  ('vietnam', 2, 'evisa.xuatnhapcanh.gov.vn tolerates parallel sessions'),
  ('australia', 1, 'ImmiAccount per-account session lock'),
  ('japan', 1, 'paper-only; queue is mostly metadata'),
  ('indonesia', 2, 'imigrasi.go.id'),
  ('egypt', 2, 'visa2egypt.gov.eg'),
  ('south_korea', 1, 'k-eta.go.kr'),
  ('thailand', 2, 'thaievisa.go.th'),
  ('malaysia', 2, 'imigresen-online.imi.gov.my'),
  ('singapore', 1, 'SAVE'),
  ('hong_kong', 1, 'HKID paper'),
  ('macau', 1, 'MO paper'),
  ('new_zealand', 1, 'INZ portal'),
  ('russia', 2, 'electronic-visa.kdmid.ru'),
  ('turkey', 2, 'evisa.gov.tr'),
  ('united_arab_emirates', 2, 'smartservices.ica.gov.ae'),
  ('canada', 1, 'IRCC'),
  ('maldives', 2, 'IMUGA'),
  ('philippines', 1, 'embassy bank deposit'),
  ('cambodia', 2, 'evisa.gov.kh'),
  ('laos', 2, 'laoevisa.gov.la'),
  ('sri_lanka', 2, 'eta.gov.lk'),
  ('india', 2, 'indianvisaonline.gov.in/evisa'),
  ('south_africa', 1, 'VFS Global pay-link')
ON CONFLICT (country) DO NOTHING;

-- Per-country queue stats. Autoscaler reads this directly.
CREATE OR REPLACE VIEW runner_queue_depth AS
SELECT
  cap.country,
  cap.max_concurrent,
  cap.paused,
  COALESCE(SUM(CASE WHEN rj.status = 'queued' THEN 1 ELSE 0 END), 0)::INTEGER AS queued,
  COALESCE(SUM(CASE WHEN rj.status = 'running' THEN 1 ELSE 0 END), 0)::INTEGER AS running,
  COALESCE(SUM(CASE WHEN rj.status = 'failed' THEN 1 ELSE 0 END), 0)::INTEGER AS failed_24h
FROM runner_concurrency_cap cap
LEFT JOIN runner_job rj
  ON rj.country = cap.country
 AND (rj.status IN ('queued','running')
      OR (rj.status = 'failed' AND rj.finished_at >= NOW() - INTERVAL '24 hours'))
GROUP BY cap.country, cap.max_concurrent, cap.paused;
