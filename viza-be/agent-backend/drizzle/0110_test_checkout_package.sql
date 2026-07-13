-- Add a tiny live-payment test package for end-to-end checkout verification.
-- The public flow uses static pricing in the portal, while this seed keeps the
-- backend package catalog and staff pricing surface aware of the same package.

WITH inserted_package AS (
  INSERT INTO visa_packages (country, visa_type, name, description)
  VALUES (
    'viza_test',
    'TEST_CHECKOUT',
    'VIZA Test Checkout',
    'Internal live-payment test package for validating guest checkout, Stripe payment, magic-link account creation, and paid-application visibility with a tiny charge.'
  )
  ON CONFLICT DO NOTHING
  RETURNING id
),
resolved_package AS (
  SELECT id FROM inserted_package
  UNION ALL
  SELECT id
  FROM visa_packages
  WHERE country = 'viza_test'
    AND visa_type = 'TEST_CHECKOUT'
  LIMIT 1
)
INSERT INTO package_pricing (
  visa_package_id,
  currency,
  government_fee_cents,
  agency_fee_cents,
  source
)
SELECT
  id,
  'USD',
  0,
  50,
  'seed'
FROM resolved_package
ON CONFLICT (visa_package_id, currency)
DO UPDATE SET
  government_fee_cents = EXCLUDED.government_fee_cents,
  agency_fee_cents = EXCLUDED.agency_fee_cents,
  source = EXCLUDED.source,
  updated_at = NOW();
