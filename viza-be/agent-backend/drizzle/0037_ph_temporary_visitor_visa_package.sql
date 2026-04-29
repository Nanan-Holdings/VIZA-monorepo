-- Add Philippines Temporary Visitor Visa + eTravel to the visa_packages catalog.
-- Companion seed script: scripts/seed-ph-temporary-visitor-visa-form-fields.ts

INSERT INTO visa_packages (country, visa_type, name, description) VALUES
  (
    'philippines',
    'PH_TEMPORARY_VISITOR_VISA',
    'Philippines 9(a) Temporary Visitor Visa + eTravel Declaration',
    'Republic of the Philippines 9(a) Temporary Visitor Visa processed by Bureau of Immigration (BI) / Department of Foreign Affairs (DFA) at Philippine consular posts abroad (paper application) PLUS the mandatory pre-arrival eTravel Declaration at etravel.gov.ph. Four variants captured by visa_type_requested: eTravel-only (visa-free + VOA arrivals, free), 9(a) single-entry (~USD 30, 3-month validity, 59-day stay), 9(a) multi-entry 6-month (~USD 60), 9(a) multi-entry 1-year (~USD 90). Restricted to Ordinary passport holders. Out of scope: 9(d) Treaty Trader/Investor, 9(e) Foreign Government Official, 9(f) Student, 9(g) Pre-arranged Employee, SRRV (Special Resident Retiree''s Visa), SIRV (Special Investor''s Resident Visa), Balikbayan privilege.'
  )
ON CONFLICT DO NOTHING;
