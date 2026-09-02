-- Public beta feedback is written only by the server-side feedback endpoint.
-- It remains inaccessible through the browser-facing Data API.
CREATE TABLE IF NOT EXISTS public.beta_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experience_rating SMALLINT NOT NULL CHECK (experience_rating BETWEEN 1 AND 5),
  ease_rating SMALLINT NOT NULL CHECK (ease_rating BETWEEN 1 AND 5),
  task TEXT NOT NULL CHECK (task IN ('sign-up', 'choose-visa', 'application', 'documents', 'assistant', 'payment', 'status', 'travel', 'other')),
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('bug', 'confusing', 'missing', 'idea', 'praise')),
  description TEXT NOT NULL CHECK (char_length(description) BETWEEN 10 AND 4000),
  reproduce_steps TEXT CHECK (reproduce_steps IS NULL OR char_length(reproduce_steps) <= 2000),
  expected_result TEXT CHECK (expected_result IS NULL OR char_length(expected_result) <= 2000),
  environment TEXT CHECK (environment IS NULL OR char_length(environment) <= 300),
  contact_consent BOOLEAN NOT NULL DEFAULT FALSE,
  tester_email TEXT CHECK (tester_email IS NULL OR char_length(tester_email) <= 320),
  locale TEXT NOT NULL CHECK (locale IN ('en', 'zh')),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'planned', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS beta_feedback_status_created_idx
  ON public.beta_feedback(status, created_at DESC);

ALTER TABLE public.beta_feedback ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.beta_feedback FROM anon, authenticated;
GRANT ALL ON TABLE public.beta_feedback TO service_role;
