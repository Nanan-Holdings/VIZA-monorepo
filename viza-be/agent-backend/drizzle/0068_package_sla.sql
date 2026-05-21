-- =============================================================================
-- Per-package SLA (CS-005)
--
-- Published median + p95 wall-clock from queue-enqueue to delivered.
-- Back-filled weekly by `scripts/backfill-package-sla.ts` reading
-- runner_metric.time_to_submit_s.
-- =============================================================================

CREATE TABLE IF NOT EXISTS package_sla (
  country TEXT NOT NULL,
  visa_type TEXT NOT NULL,
  median_hours INTEGER NOT NULL,
  p95_hours INTEGER NOT NULL,
  /** Sample size that produced the displayed numbers. */
  sample_size INTEGER NOT NULL DEFAULT 0,
  /** Source: 'seed' (initial estimate) or 'measured' (weekly back-fill). */
  source TEXT NOT NULL DEFAULT 'seed',
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (country, visa_type)
);

ALTER TABLE package_sla ENABLE ROW LEVEL SECURITY;
-- Open SELECT — pricing page reads anonymously.
CREATE POLICY "package_sla_select_all"
  ON package_sla FOR SELECT
  USING (TRUE);

INSERT INTO package_sla (country, visa_type, median_hours, p95_hours, source) VALUES
  ('united_states', 'B1_B2', 504, 1008, 'seed'),                       -- 3w / 6w (incl. interview)
  ('united_kingdom', 'UK_STANDARD_VISITOR', 504, 720, 'seed'),         -- 3w / 30d
  ('european_union', 'EU_SCHENGEN_C_SHORT_STAY', 360, 720, 'seed'),    -- 15d / 30d
  ('vietnam', 'VN_E_VISA', 72, 120, 'seed'),                           -- 3d / 5d
  ('australia', 'AU_VISITOR_600', 648, 1080, 'seed'),                  -- 27d / 45d
  ('japan', 'JP_TOURIST', 168, 336, 'seed'),                           -- 7d / 14d (paper)
  ('indonesia', 'B211A', 96, 168, 'seed'),                             -- 4d / 7d
  ('indonesia', 'ID_C1_TOURIST', 96, 168, 'seed'),
  ('egypt', 'EG_E_VISA', 168, 336, 'seed'),                            -- 7d / 14d
  ('south_korea', 'KR_C39_SHORT_TERM_VISIT', 240, 480, 'seed'),        -- 10d / 20d
  ('thailand', 'TH_TOURIST_E_VISA', 96, 240, 'seed'),                  -- 4d / 10d
  ('malaysia', 'MY_TOURIST_E_VISA', 72, 168, 'seed'),                  -- 3d / 7d
  ('singapore', 'SG_VISITOR_VISA', 168, 336, 'seed'),                  -- 7d / 14d
  ('hong_kong', 'HK_VISIT_VISA', 240, 480, 'seed'),                    -- 10d / 20d (paper)
  ('macau', 'MO_VISIT_VISA', 24, 72, 'seed'),                          -- 1d / 3d
  ('new_zealand', 'NZ_VISITOR_VISA', 432, 720, 'seed'),                -- 18d / 30d
  ('philippines', 'PH_TEMPORARY_VISITOR_VISA', 168, 336, 'seed'),      -- 7d / 14d
  ('cambodia', 'KH_TOURIST_E_VISA', 72, 168, 'seed'),
  ('laos', 'LA_TOURIST_E_VISA', 72, 168, 'seed'),
  ('sri_lanka', 'LK_ETA', 24, 72, 'seed'),
  ('india', 'IN_E_VISA', 72, 120, 'seed'),
  ('maldives', 'MV_IMUGA', 1, 24, 'seed'),                             -- on-arrival
  ('russia', 'RU_E_VISA', 96, 168, 'seed'),
  ('turkey', 'TR_E_VISA', 24, 72, 'seed'),
  ('united_arab_emirates', 'AE_TOURIST_VISA', 72, 168, 'seed'),
  ('canada', 'CA_TRV', 504, 1080, 'seed'),                             -- 3w / 45d
  ('south_africa', 'ZA_VISITOR_VISA', 504, 1080, 'seed')
ON CONFLICT (country, visa_type) DO NOTHING;
