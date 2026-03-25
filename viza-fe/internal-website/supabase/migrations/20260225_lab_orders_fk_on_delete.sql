-- Fix FK constraints on tables that reference lab_orders so that deleting a booking
-- (lab_orders row) does not cascade-delete valuable lab data.
--
-- Strategy:
--   lab_reports            → ON DELETE SET NULL  (keep signed reports, just unlink)
--   lab_pdf_extractions    → ON DELETE SET NULL  (keep extraction artifacts, just unlink)
--   lab_results            → ON DELETE SET NULL  (keep raw metric values, just unlink)
--   lab_aging_scores       → ON DELETE CASCADE   (derivative scores tied to the order; safe to remove)
--
-- lab_pdf_extractions.lab_order_id and lab_results.lab_order_id are currently NOT NULL,
-- so we must drop that constraint first to allow SET NULL to work.

-- ── lab_pdf_extractions ──────────────────────────────────────────────────────
ALTER TABLE public.lab_pdf_extractions
  ALTER COLUMN lab_order_id DROP NOT NULL;

ALTER TABLE public.lab_pdf_extractions
  DROP CONSTRAINT IF EXISTS lab_pdf_extractions_lab_order_id_fkey;

ALTER TABLE public.lab_pdf_extractions
  ADD CONSTRAINT lab_pdf_extractions_lab_order_id_fkey
  FOREIGN KEY (lab_order_id) REFERENCES public.lab_orders(id) ON DELETE SET NULL;

-- ── lab_results ──────────────────────────────────────────────────────────────
ALTER TABLE public.lab_results
  ALTER COLUMN lab_order_id DROP NOT NULL;

ALTER TABLE public.lab_results
  DROP CONSTRAINT IF EXISTS lab_results_lab_order_id_fkey;

ALTER TABLE public.lab_results
  ADD CONSTRAINT lab_results_lab_order_id_fkey
  FOREIGN KEY (lab_order_id) REFERENCES public.lab_orders(id) ON DELETE SET NULL;

-- ── lab_reports ───────────────────────────────────────────────────────────────
-- lab_order_id is already nullable here; just change the FK action.
ALTER TABLE public.lab_reports
  DROP CONSTRAINT IF EXISTS lab_reports_lab_order_id_fkey;

ALTER TABLE public.lab_reports
  ADD CONSTRAINT lab_reports_lab_order_id_fkey
  FOREIGN KEY (lab_order_id) REFERENCES public.lab_orders(id) ON DELETE SET NULL;

-- ── lab_aging_scores ──────────────────────────────────────────────────────────
-- These scores are derived from the order; cascade-delete them when the order goes away.
-- NOTE: The CHECK (lab_report_id IS NOT NULL OR lab_order_id IS NOT NULL) means
-- scores that only have lab_order_id set will be removed safely via CASCADE.
ALTER TABLE public.lab_aging_scores
  DROP CONSTRAINT IF EXISTS lab_aging_scores_lab_order_id_fkey;

ALTER TABLE public.lab_aging_scores
  ADD CONSTRAINT lab_aging_scores_lab_order_id_fkey
  FOREIGN KEY (lab_order_id) REFERENCES public.lab_orders(id) ON DELETE CASCADE;
