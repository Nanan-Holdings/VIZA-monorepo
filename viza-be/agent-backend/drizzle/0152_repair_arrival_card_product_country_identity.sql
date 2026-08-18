-- Repair legacy application rows whose dedicated arrival-card product was
-- combined with a stale route country, and prevent the mismatch from recurring.

SET lock_timeout = '5s';
SET statement_timeout = '30s';

-- If a misrouted draft would collide with an existing in-flight application
-- after its country is corrected, preserve its answers as archived history.
WITH dedicated_products(visa_type, expected_country) AS (
  VALUES
    ('SG_ARRIVAL_CARD', 'singapore'),
    ('MY_MDAC_ARRIVAL_CARD', 'malaysia'),
    ('TH_TDAC_ARRIVAL_CARD', 'thailand'),
    ('PH_ETRAVEL_ARRIVAL_CARD', 'philippines'),
    ('PH_ETRAVEL_DEPARTURE_CARD', 'philippines'),
    ('VN_PREARRIVAL_DECLARATION', 'vietnam'),
    ('KR_E_ARRIVAL_CARD', 'south_korea')
)
UPDATE public.applications AS misrouted
SET
  status = 'archived',
  updated_at = NOW()
FROM dedicated_products AS product
WHERE UPPER(TRIM(misrouted.visa_type)) = product.visa_type
  AND LOWER(TRIM(misrouted.country)) IS DISTINCT FROM product.expected_country
  AND LOWER(TRIM(COALESCE(misrouted.status, 'draft'))) IN (
    'draft',
    'not_started',
    'not_submitted'
  )
  AND EXISTS (
    SELECT 1
    FROM public.applications AS canonical
    WHERE canonical.id <> misrouted.id
      AND canonical.applicant_id = misrouted.applicant_id
      AND LOWER(TRIM(canonical.country)) = product.expected_country
      AND UPPER(TRIM(canonical.visa_type)) = product.visa_type
      AND LOWER(TRIM(COALESCE(canonical.status, 'draft'))) NOT IN (
        'submitted', 'submitted_mock', 'form_ready_for_agency',
        'completed', 'approved', 'rejected', 'cancelled', 'canceled',
        'archived', 'failed', 'stalled'
      )
      AND COALESCE(canonical.purpose, '') <> 'VIZA_PLACEHOLDER_DRY_RUN'
      AND LOWER(TRIM(COALESCE(canonical.submission_result_status, ''))) NOT IN (
        'completed', 'complete', 'submitted', 'success', 'done'
      )
      AND LOWER(TRIM(COALESCE(canonical.result_status, ''))) NOT IN (
        'approved', 'approved_pending_document', 'issued', 'granted',
        'rejected', 'refused', 'denied'
      )
      AND LOWER(
        TRIM(COALESCE(canonical.submission_result ->> 'submitted', ''))
      ) <> 'true'
      AND LOWER(
        TRIM(COALESCE(canonical.submission_result ->> 'status', ''))
      ) <> 'submitted'
  );

WITH dedicated_products(visa_type, expected_country) AS (
  VALUES
    ('SG_ARRIVAL_CARD', 'singapore'),
    ('MY_MDAC_ARRIVAL_CARD', 'malaysia'),
    ('TH_TDAC_ARRIVAL_CARD', 'thailand'),
    ('PH_ETRAVEL_ARRIVAL_CARD', 'philippines'),
    ('PH_ETRAVEL_DEPARTURE_CARD', 'philippines'),
    ('VN_PREARRIVAL_DECLARATION', 'vietnam'),
    ('KR_E_ARRIVAL_CARD', 'south_korea')
)
UPDATE public.applications AS application
SET
  country = product.expected_country,
  updated_at = NOW()
FROM dedicated_products AS product
WHERE UPPER(TRIM(application.visa_type)) = product.visa_type
  AND LOWER(TRIM(application.country)) IS DISTINCT FROM product.expected_country;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'applications_arrival_card_product_country_check'
      AND conrelid = 'public.applications'::regclass
  ) THEN
    ALTER TABLE public.applications
      ADD CONSTRAINT applications_arrival_card_product_country_check
      CHECK (
        CASE UPPER(TRIM(visa_type))
          WHEN 'SG_ARRIVAL_CARD' THEN COALESCE(LOWER(TRIM(country)), '') = 'singapore'
          WHEN 'MY_MDAC_ARRIVAL_CARD' THEN COALESCE(LOWER(TRIM(country)), '') = 'malaysia'
          WHEN 'TH_TDAC_ARRIVAL_CARD' THEN COALESCE(LOWER(TRIM(country)), '') = 'thailand'
          WHEN 'PH_ETRAVEL_ARRIVAL_CARD' THEN COALESCE(LOWER(TRIM(country)), '') = 'philippines'
          WHEN 'PH_ETRAVEL_DEPARTURE_CARD' THEN COALESCE(LOWER(TRIM(country)), '') = 'philippines'
          WHEN 'VN_PREARRIVAL_DECLARATION' THEN COALESCE(LOWER(TRIM(country)), '') = 'vietnam'
          WHEN 'KR_E_ARRIVAL_CARD' THEN COALESCE(LOWER(TRIM(country)), '') = 'south_korea'
          ELSE TRUE
        END
      ) NOT VALID;
  END IF;
END
$$;

ALTER TABLE public.applications
  VALIDATE CONSTRAINT applications_arrival_card_product_country_check;

-- Keep every catalog-backed application aligned as new products are added.
-- A product offered by exactly one catalog country is country-bound; products
-- offered by several countries (for example Schengen) stay multi-country.
CREATE OR REPLACE FUNCTION public.enforce_application_product_country_identity()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  linked_package_country TEXT;
  linked_package_visa_type TEXT;
  catalog_country TEXT;
  catalog_country_count INTEGER;
BEGIN
  IF NEW.visa_package_id IS NOT NULL THEN
    SELECT
      LOWER(TRIM(package.country)),
      UPPER(TRIM(package.visa_type))
    INTO linked_package_country, linked_package_visa_type
    FROM public.visa_packages AS package
    WHERE package.id = NEW.visa_package_id;

    IF FOUND AND (
      LOWER(TRIM(NEW.country)) IS DISTINCT FROM linked_package_country
      OR UPPER(TRIM(NEW.visa_type)) IS DISTINCT FROM linked_package_visa_type
    ) THEN
      RAISE EXCEPTION
        'Application country and visa type must match the linked visa package'
        USING ERRCODE = '23514',
              CONSTRAINT = 'applications_visa_package_identity';
    END IF;
  END IF;

  SELECT
    MIN(LOWER(TRIM(package.country))),
    COUNT(DISTINCT LOWER(TRIM(package.country)))
  INTO catalog_country, catalog_country_count
  FROM public.visa_packages AS package
  WHERE UPPER(TRIM(package.visa_type)) = UPPER(TRIM(NEW.visa_type))
    AND NULLIF(TRIM(package.country), '') IS NOT NULL;

  IF catalog_country_count = 1
    AND LOWER(TRIM(NEW.country)) IS DISTINCT FROM catalog_country
  THEN
    RAISE EXCEPTION
      'Application country must match the country-bound visa product'
      USING ERRCODE = '23514',
            CONSTRAINT = 'applications_product_country_identity';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS applications_product_country_identity_guard
  ON public.applications;

CREATE TRIGGER applications_product_country_identity_guard
BEFORE INSERT OR UPDATE OF country, visa_type, visa_package_id
ON public.applications
FOR EACH ROW
EXECUTE FUNCTION public.enforce_application_product_country_identity();
