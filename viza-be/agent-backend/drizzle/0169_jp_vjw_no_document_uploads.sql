-- Visit Japan Web is a structured online arrival and customs declaration.
-- VIZA collects the traveller, trip, immigration, and customs answers directly;
-- no applicant document upload is required for this product. Kenya eTA document
-- requirements are deliberately unaffected.

DELETE FROM public.document_requirements requirement
WHERE requirement.visa_package_id IN (
  SELECT package.id
  FROM public.visa_packages package
  WHERE LOWER(TRIM(package.country)) = 'japan'
    AND UPPER(TRIM(package.visa_type)) = 'JP_VISIT_JAPAN_WEB'
);
