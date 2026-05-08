-- =============================================================================
-- Per-package photo specs (DOCUP-003)
--
-- Different consulates require different photo dimensions. Drives
-- `lib/photo/crop.ts` cropToSpec(buffer, spec).
-- =============================================================================

CREATE TABLE IF NOT EXISTS photo_spec (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country TEXT NOT NULL,
  visa_type TEXT NOT NULL,
  width_mm NUMERIC NOT NULL,
  height_mm NUMERIC NOT NULL,
  dpi INTEGER NOT NULL DEFAULT 300,
  /** Vertical position of the eyeline as a fraction of the photo height. */
  eyeline_from_top NUMERIC,
  /** Required head size, % of photo height (face from chin to crown). */
  head_height_pct NUMERIC,
  background_hex TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (country, visa_type)
);

ALTER TABLE photo_spec ENABLE ROW LEVEL SECURITY;
CREATE POLICY "photo_spec_select_all" ON photo_spec FOR SELECT USING (TRUE);

INSERT INTO photo_spec (country, visa_type, width_mm, height_mm, dpi, eyeline_from_top, head_height_pct, background_hex, notes) VALUES
  ('US', 'b1b2',           51, 51, 300, 0.45, 0.65, '#FFFFFF', 'DS-160 51×51mm white background'),
  ('JP', 'tourist_evisa',  35, 45, 300, 0.40, 0.66, '#FFFFFF', 'MoFA 35×45mm'),
  ('KR', 'tourist_evisa',  35, 45, 300, 0.40, 0.66, '#FFFFFF', 'KR consulate 35×45mm'),
  ('ZA', 'tourist_evisa',  50, 50, 300, 0.45, 0.65, '#FFFFFF', 'DHA eVisa 50×50mm'),
  ('IN', 'tourist_evisa',  50, 50, 300, 0.45, 0.65, '#FFFFFF', 'Bureau of Immigration 50×50mm'),
  ('UK', 'standard',       45, 35, 300, 0.40, 0.66, '#FFFFFF', 'UKVI 45×35mm'),
  ('AU', '600',            45, 35, 300, 0.40, 0.66, '#FFFFFF', 'ImmiAccount 45×35mm'),
  ('VN', 'tourist_evisa',  40, 60, 300, 0.40, 0.65, '#FFFFFF', 'VN eVisa 40×60mm'),
  ('KH', 'tourist_evisa',  35, 45, 300, 0.40, 0.66, '#FFFFFF', 'KH eVisa 35×45mm'),
  ('LA', 'tourist_evisa',  35, 45, 300, 0.40, 0.66, '#FFFFFF', 'LA eVisa 35×45mm'),
  ('LK', 'eta',            35, 45, 300, 0.40, 0.66, '#FFFFFF', 'LK ETA 35×45mm')
ON CONFLICT (country, visa_type) DO NOTHING;
