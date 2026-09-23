-- Add DeepSeek to the redacted marketing provider activity audit vocabulary.
-- The portal still stores no credentials, prompts, or generated copy here.

ALTER TABLE public.marketing_provider_activity
  DROP CONSTRAINT IF EXISTS marketing_provider_activity_provider_check;

ALTER TABLE public.marketing_provider_activity
  ADD CONSTRAINT marketing_provider_activity_provider_check
  CHECK (provider IN ('openrouter', 'deepseek', 'zernio', 'google-analytics', 'search-console', 'system'));
