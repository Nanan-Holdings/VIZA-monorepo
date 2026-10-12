# VIZA marketing content pipeline

The portal app owns the twice-weekly news draft run, staff editor and social
delivery records. The auth-free marketing site reads published posts through
`/api/public/marketing/blog`.

- Configuration: `scripts/pipeline.config.json` (VIZA business, sources,
  categories, money pages, voice and approval defaults).
- Measured SEO terms: `content/seo-keywords.json`. Keep it empty until a VIZA
  keyword export is imported; never invent monthly search figures.
  Import a CSV/TSV export with
  `node scripts/build-seo-keywords.mjs /absolute/path/to/export.csv`.
  Rows containing volume ranges or thresholds
  are skipped because they are not measured point estimates.
- Schedule: `vercel.json`, Tuesday and Thursday at 01:00 UTC (09:00 Singapore).
- Staff: `/admin/marketing/blog` → prepare and edit drafts. Admins can also
  run the news pipeline, approve and publish, then send reviewed captions from
  `/admin/marketing/social`.
- Public: `/blog`, `/blog/<slug>`, `/blog/category/<slug>` and `/sitemap.xml`.

Server credentials belong only in the portal app's ignored `.env.local` and
Vercel Production environment, never in tracked files. From any directory:

```bash
bash /Users/edward/Github/Nanan-Holdings/VIZA-monorepo/viza-fe/internal-website/scripts/set-content-env.sh --social
bash /Users/edward/Github/Nanan-Holdings/VIZA-monorepo/viza-fe/internal-website/scripts/set-content-env.sh --clipboard
```

The social command reads the VIZA Zernio and Upload-Post keys plus explicit
account/profile/board identifiers from the portal app's `.env.local`. The
repository root is linked to the `viza-app` Vercel project because that project
sets its root directory to `viza-fe/internal-website`. For the second command,
copy the DeepSeek key to the clipboard first. It generates a hexadecimal
`CRON_SECRET`. The Vercel project must be linked at the repository root, and
new variables require another production deployment. `VIZA_MARKETING_AUTOMATION_ACTOR_ID`
must be an active admin UUID for cron; staff-triggered runs use the signed-in
admin as their audit actor.

Do not run a live draft/social pipeline against production credentials as a
test. The isolated scan can be exercised without a database or provider keys:

```bash
cd /Users/edward/Github/Nanan-Holdings/VIZA-monorepo/viza-fe/internal-website
npx tsx -e 'import {scanNews} from "./lib/marketing/news-pipeline"; import c from "./scripts/pipeline.config.json"; scanNews(c.news).then(r=>console.log(r.items.slice(0,15).map(x=>x.title)))'
```

Instagram and Pinterest image posts use Upload-Post. Those networks have no
deletion API in this workflow; staff remove the old post in the network and
record that removal in the social control room before reposting. A source
cover may be subject to publisher rights; review or replace it before approval.
