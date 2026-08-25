-- Persist the exact legal/official statement accepted for an application. A
-- checkbox value alone is not durable evidence when the underlying form schema
-- is later corrected or refreshed from an official source.

CREATE TABLE IF NOT EXISTS public.application_agreement_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  content_fingerprint TEXT NOT NULL,
  agreement_version TEXT NOT NULL,
  agreement_content_en TEXT NOT NULL,
  agreement_content_zh TEXT,
  source_url TEXT,
  source_label TEXT,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (application_id, field_name, content_fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_application_agreement_acceptances_application_active
  ON public.application_agreement_acceptances (application_id, accepted_at DESC)
  WHERE revoked_at IS NULL;

ALTER TABLE public.application_agreement_acceptances ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.application_agreement_acceptances FROM anon, authenticated;

-- Normalise existing declaration fields to carry their rendered official text
-- as explicit agreement metadata. Later official-source recrawls can replace
-- only this metadata and create a new immutable acceptance fingerprint.
UPDATE public.visa_form_fields
SET validation_rules = COALESCE(validation_rules, '{}'::jsonb) || jsonb_strip_nulls(
  jsonb_build_object(
    'agreement_kind', 'official_statement',
    'agreement_content_en', label,
    'agreement_content_zh', NULLIF(validation_rules ->> 'label_zh', ''),
    'agreement_version', 'schema-statement-v1'
  )
)
WHERE field_type = 'checkbox'
  AND required = true
  AND (
    COALESCE(validation_rules ->> 'mustBeTrue', '') = 'true'
    OR label ~* '\\m(agree|agreement|consent|declare|declaration|certify|certification|undertaking|acknowledge|affirm|authorize)\\M'
  );

-- Preserve already-accepted declarations during rollout. md5 is used solely
-- as a stable version identifier, never as a security primitive.
INSERT INTO public.application_agreement_acceptances (
  application_id,
  field_name,
  content_fingerprint,
  agreement_version,
  agreement_content_en,
  agreement_content_zh,
  accepted_at,
  created_at,
  updated_at
)
SELECT
  answer.application_id,
  field.field_name,
  md5(field.validation_rules ->> 'agreement_content_en'),
  COALESCE(field.validation_rules ->> 'agreement_version', 'schema-statement-v1'),
  field.validation_rules ->> 'agreement_content_en',
  NULLIF(field.validation_rules ->> 'agreement_content_zh', ''),
  COALESCE(answer.updated_at, answer.created_at, now()),
  now(),
  now()
FROM public.visa_application_answers AS answer
JOIN public.applications AS application ON application.id = answer.application_id
JOIN public.visa_form_fields AS field
  ON field.visa_type = application.visa_type
  AND field.field_name = answer.field_name
WHERE field.validation_rules ->> 'agreement_kind' = 'official_statement'
  AND lower(trim(COALESCE(answer.value_text, ''))) IN ('true', 'yes', '1', 'on')
ON CONFLICT (application_id, field_name, content_fingerprint) DO NOTHING;
