-- Remove the duplicate Japan and South Korea package rows created before
-- visa_packages had a natural-key uniqueness guard. The later copies have no
-- applicant/application ownership; their coverage and fee rows are exact
-- duplicates of the rows attached to the retained package.

BEGIN;

CREATE TEMP TABLE _duplicate_visa_packages ON COMMIT DROP AS
WITH ranked AS (
  SELECT
    id,
    country,
    visa_type,
    ROW_NUMBER() OVER (
      PARTITION BY LOWER(TRIM(country)), UPPER(TRIM(visa_type))
      ORDER BY created_at, id
    ) AS copy_number
  FROM public.visa_packages
  WHERE (LOWER(TRIM(country)), UPPER(TRIM(visa_type))) IN (
    ('japan', 'JP_TOURIST'),
    ('south_korea', 'KR_C39_SHORT_TERM_VISIT')
  )
)
SELECT id
FROM ranked
WHERE copy_number > 1;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM _duplicate_visa_packages duplicate
    WHERE EXISTS (
      SELECT 1 FROM public.applications row_ref
      WHERE row_ref.visa_package_id = duplicate.id
    )
      OR EXISTS (
        SELECT 1 FROM public.application_documents row_ref
        WHERE row_ref.required_by_visa_package_id = duplicate.id
      )
      OR EXISTS (
        SELECT 1 FROM public.application_group row_ref
        WHERE row_ref.visa_package_id = duplicate.id
      )
      OR EXISTS (
        SELECT 1 FROM public.document_requirements row_ref
        WHERE row_ref.visa_package_id = duplicate.id
      )
      OR EXISTS (
        SELECT 1 FROM public.package_pricing row_ref
        WHERE row_ref.visa_package_id = duplicate.id
      )
      OR EXISTS (
        SELECT 1 FROM public.paper_template row_ref
        WHERE row_ref.package_id = duplicate.id
      )
      OR EXISTS (
        SELECT 1 FROM public.payment_records row_ref
        WHERE row_ref.visa_package_id = duplicate.id
      )
      OR EXISTS (
        SELECT 1 FROM public.supporting_doc_slot row_ref
        WHERE row_ref.package_id = duplicate.id
      )
      OR EXISTS (
        SELECT 1 FROM public.user_chat_sessions row_ref
        WHERE row_ref.visa_package_id = duplicate.id
      )
      OR EXISTS (
        SELECT 1 FROM public.user_packages row_ref
        WHERE row_ref.visa_package_id = duplicate.id
      )
  ) THEN
    RAISE EXCEPTION
      'Refusing to delete a duplicate visa package that has non-duplicate dependent data';
  END IF;
END
$$;

DELETE FROM public.coverage_matrix row_ref
USING _duplicate_visa_packages duplicate
WHERE row_ref.visa_package_id = duplicate.id;

DELETE FROM public.government_fee_rules row_ref
USING _duplicate_visa_packages duplicate
WHERE row_ref.visa_package_id = duplicate.id;

DELETE FROM public.visa_packages package
USING _duplicate_visa_packages duplicate
WHERE package.id = duplicate.id;

CREATE UNIQUE INDEX IF NOT EXISTS visa_packages_country_visa_type_unique_idx
  ON public.visa_packages (
    LOWER(TRIM(country)),
    UPPER(TRIM(visa_type))
  );

COMMIT;
