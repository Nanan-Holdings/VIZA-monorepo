# Travel Static Asset Rules

Scope: this file applies to `viza-fe/internal-website/public/travel/**`.

This directory stores Travel AI card imagery that must render without relying
on remote hotlinks at runtime.

- `cities/`: city card cover images.
- `attractions/`: attraction card images keyed by city and attraction slug.

When adding or replacing an image, update
`components/client/travel/travel-card-curated-data.json` so the card title,
local image path, source URL, and coordinates stay in sync.
