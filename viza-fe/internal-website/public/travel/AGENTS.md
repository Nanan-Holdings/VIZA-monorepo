# Travel Static Asset Rules

Scope: this file applies to `/travel/**` image URLs.

Travel AI card imagery no longer lives in this directory. The binaries are
stored in the public Supabase Storage bucket `travel-images` (project
oyjxdzsoejraedqghndi), and an afterFiles rewrite in `next.config.ts` proxies
`/travel/<path>` to the bucket — so all `/travel/...` paths in code, JSON and
DB rows keep working unchanged. They were moved out of the repo because the
447MB `public/` directory was uploaded on every Vercel deploy (and once made
serverless functions exceed the 250MB limit via a file-trace sweep).

- `cities/<slug>.jpg|png`: city card cover images (in the bucket).
- `attractions/<city>-<attraction>.jpg|png`: attraction card images (bucket).
- `cities/travel-fallback.svg`: neutral fallback shown only when no verified
  city image exists; kept LOCAL in this directory on purpose (afterFiles
  rewrite means local files win). Do not use unrelated city photos as
  fallbacks.

To add or replace an image, upload it to the bucket (see
`scripts/upload-travel-images-to-storage.mjs`, re-runnable/upsert) and update
`components/client/travel/travel-card-curated-data.json` so the card title,
image path, source URL, and coordinates stay in sync. Do not commit image
binaries under this directory.
