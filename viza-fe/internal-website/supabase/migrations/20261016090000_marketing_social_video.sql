-- Vertical shorts rendered by viza-fe/social-video, posted to TikTok,
-- Instagram Reels and YouTube Shorts through Upload-Post.
--
-- A short is its own composition, linked to the same blog post as the
-- article's caption composition: the video channels publish on their own
-- schedule and are reconciled separately from the image and feed channels.
-- The existing service-role-only table and RLS/ACL boundary remain unchanged.

ALTER TABLE public.marketing_social_compositions
  ADD COLUMN IF NOT EXISTS video_url TEXT
  CHECK (video_url IS NULL OR video_url ~ '^https://');

ALTER TABLE public.marketing_social_compositions
  ADD COLUMN IF NOT EXISTS video_locale TEXT
  CHECK (video_locale IS NULL OR video_locale IN ('en', 'zh-CN'));

ALTER TABLE public.marketing_social_compositions
  ADD COLUMN IF NOT EXISTS video_title TEXT
  CHECK (video_title IS NULL OR char_length(video_title) <= 100);

COMMENT ON COLUMN public.marketing_social_compositions.video_url IS
  'Public MP4 in marketing-public-assets for TikTok, Instagram Reels and YouTube Shorts.';
COMMENT ON COLUMN public.marketing_social_compositions.video_locale IS
  'Spoken language of the short: en or zh-CN.';
COMMENT ON COLUMN public.marketing_social_compositions.video_title IS
  'YouTube Shorts title (YouTube caps titles at 100 characters).';

-- Shorts are 1080x1920 H.264 MP4s of 5 to 15 MB. They are uploaded straight
-- from the browser to a signed storage URL, because a Vercel function body is
-- capped at 4.5 MB. 50 MB is the largest object the bucket now accepts; images
-- and documents keep their tighter limits in lib/marketing/assets.ts.
UPDATE storage.buckets
SET
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'video/mp4'
  ]::text[]
WHERE id = 'marketing-public-assets';
