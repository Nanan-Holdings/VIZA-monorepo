-- Store image-network outcomes separately from historical Zernio IDs.
-- The existing service-role-only table and RLS/ACL boundary remain unchanged.
ALTER TABLE public.marketing_social_compositions
  ADD COLUMN IF NOT EXISTS upload_post_posts JSONB NOT NULL DEFAULT '{}'::jsonb
  CHECK (jsonb_typeof(upload_post_posts) = 'object');

ALTER TABLE public.marketing_social_compositions
  ADD COLUMN IF NOT EXISTS zernio_post_urls JSONB NOT NULL DEFAULT '{}'::jsonb
  CHECK (jsonb_typeof(zernio_post_urls) = 'object');

COMMENT ON COLUMN public.marketing_social_compositions.upload_post_posts IS
  'Per-platform Upload-Post request, remote post, and public URL status; no credentials.';

ALTER TABLE public.marketing_provider_activity
  DROP CONSTRAINT IF EXISTS marketing_provider_activity_provider_check;
ALTER TABLE public.marketing_provider_activity
  ADD CONSTRAINT marketing_provider_activity_provider_check
  CHECK (provider IN ('openrouter', 'deepseek', 'zernio', 'upload-post', 'google-analytics', 'search-console', 'system'));
