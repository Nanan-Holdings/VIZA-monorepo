-- Keep one Singapore Arrival Card catalog product while aligning its metadata
-- with ICA's three in-service residency routes. SG_VISITOR_VISA remains a
-- separate entry-visa product and is intentionally unchanged.

UPDATE public.visa_packages
SET
  name = 'Singapore Arrival Card',
  description = 'One Singapore Arrival Card (SGAC) application with an in-form ICA Residency Type choice: Singapore Citizen / Permanent Resident, Long-Term Pass Holder, or Foreign Visitor / In-Principle Approval Holder. VIZA collects only the fields required by the selected ICA scpr, ltp, or fvipa route and submits within ICA''s three-day window. SGAC is free on ICA official channels and is not a visa; Singapore Entry Visa remains the separate SG_VISITOR_VISA product.'
WHERE LOWER(TRIM(country)) = 'singapore'
  AND UPPER(TRIM(visa_type)) = 'SG_ARRIVAL_CARD';
