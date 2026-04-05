-- Visa Packages & User Packages
-- Product catalog for supported visa offerings + user assignment

-- =============================================================================
-- VISA PACKAGES (catalog)
-- =============================================================================

CREATE TABLE IF NOT EXISTS visa_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country TEXT NOT NULL,
  visa_type TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price_cents INTEGER,
  currency TEXT DEFAULT 'USD',
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed rows for Indonesia B211A and US DS-160 B1/B2
INSERT INTO visa_packages (country, visa_type, name, description) VALUES
  ('indonesia', 'B211A', 'Indonesia B211A Tourist Visa', 'Single-entry tourist visa for Indonesia (60 days)'),
  ('united_states', 'B1_B2', 'US DS-160 B1/B2 Visitor Visa', 'Non-immigrant visitor visa for tourism or business')
ON CONFLICT DO NOTHING;

-- =============================================================================
-- USER PACKAGES (assignment)
-- =============================================================================

CREATE TABLE IF NOT EXISTS user_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID NOT NULL,
  visa_package_id UUID NOT NULL REFERENCES visa_packages(id),
  application_id UUID REFERENCES applications(id),
  status TEXT NOT NULL DEFAULT 'active',
  assigned_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE visa_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_packages ENABLE ROW LEVEL SECURITY;

-- visa_packages is a public catalog — allow authenticated reads
CREATE POLICY "visa_packages_select" ON visa_packages
  FOR SELECT TO authenticated USING (true);

-- user_packages — users can only see their own
CREATE POLICY "user_packages_select" ON user_packages
  FOR SELECT TO authenticated USING (auth.uid() = auth_user_id);
