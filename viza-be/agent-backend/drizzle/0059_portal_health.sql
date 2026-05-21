-- =============================================================================
-- Per-portal canary health (OPS-004)
--
-- Hourly canary writes one row per country with the last-known
-- reachability state. The /admin/portal-health page reads this table
-- to render a per-country badge so ops can see a portal regression
-- before applicants do.
-- =============================================================================

CREATE TABLE IF NOT EXISTS portal_health (
  country TEXT PRIMARY KEY,
  /** ok | degraded | down | unknown */
  status TEXT NOT NULL DEFAULT 'unknown',
  http_status INTEGER,
  latency_ms INTEGER,
  /** Free-form note, e.g. "anti-bot gate served". */
  note TEXT,
  error TEXT,
  last_run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  /** Pinned probe URL per country — overridable by ops without redeploy. */
  probe_url TEXT
);

ALTER TABLE portal_health ENABLE ROW LEVEL SECURITY;
-- Service role only.

INSERT INTO portal_health (country, probe_url) VALUES
  ('united_states', 'https://ceac.state.gov/genniv/'),
  ('united_kingdom', 'https://www.apply-uk-visa.service.gov.uk/'),
  ('european_union', 'https://france-visas.gouv.fr/'),
  ('vietnam', 'https://evisa.xuatnhapcanh.gov.vn/'),
  ('australia', 'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/visitor-600'),
  ('japan', 'https://www.evisa.mofa.go.jp/'),
  ('indonesia', 'https://molina.imigrasi.go.id/'),
  ('egypt', 'https://visa2egypt.gov.eg/eVisa/Home'),
  ('south_korea', 'https://www.k-eta.go.kr/'),
  ('thailand', 'https://www.thaievisa.go.th/'),
  ('malaysia', 'https://malaysiavisa.imi.gov.my/evisa/'),
  ('singapore', 'https://www.ica.gov.sg/enter-transit-depart/entering-singapore/visa_requirements'),
  ('hong_kong', 'https://www.immd.gov.hk/'),
  ('macau', 'https://www.fsm.gov.mo/psp/'),
  ('new_zealand', 'https://www.immigration.govt.nz/new-zealand-visas'),
  ('philippines', 'https://evisa.gov.ph/'),
  ('cambodia', 'https://www.evisa.gov.kh/'),
  ('laos', 'https://laoevisa.gov.la/'),
  ('sri_lanka', 'https://www.eta.gov.lk/'),
  ('india', 'https://indianvisaonline.gov.in/evisa/'),
  ('maldives', 'https://imuga.immigration.gov.mv/'),
  ('russia', 'https://evisa.kdmid.ru/'),
  ('turkey', 'https://www.evisa.gov.tr/'),
  ('united_arab_emirates', 'https://smartservices.icp.gov.ae/'),
  ('canada', 'https://www.canada.ca/en/immigration-refugees-citizenship/services/visit-canada.html'),
  ('south_africa', 'https://visa.vfsglobal.com/zaf/en/zaf')
ON CONFLICT (country) DO NOTHING;
