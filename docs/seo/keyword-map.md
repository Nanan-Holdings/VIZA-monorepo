# viza.it.com keyword map

Measured 2026-10-24. Every volume is Google Keyword Planner (Google Ads API, VIZA
research run via `~/.claude/skills/seo-optimizer/scripts/keyword-planner.mjs`),
average monthly searches over the last 12 months, **geo Singapore**, with the
language filter shown. "No data" means below Planner's floor, not zero.

Who the pages are for: Singapore citizens are visa-free (or ETA/ESTA only) for
most of these destinations, so the people who actually need a visa filed are
foreign passport holders living in Singapore, above all Chinese nationals. That
is why the Chinese pages (`/zh-CN/...`) are the primary set and why page copy
says who needs the visa.

## Method notes

- **Chinese terms must be measured in Planner's segmented form.** `越南签证`
  returns no data; `越南 签证` returns 480. Planner tokenises Chinese and merges
  the unspaced query into the spaced one, so the spaced numbers below are the
  volumes for the queries people type.
- **Cross-check tool: none available today.** Semrush (no API units), Ubersuggest
  (daily report limit already used), Ahrefs Keywords Explorer (plan does not
  include it) and OpenRush (no credits) all refused. Keyword difficulty is
  therefore not recorded; re-run `keywords-explorer-overview` or Ubersuggest
  `keyword_overview` for the head terms when quota is back.
- **SERP check:** WebSearch (US-located index, not a Singapore SERP) on
  2026-10-24 for `vietnam e visa`, `us visa application singapore`,
  `japan visa singapore`, `schengen visa singapore`, `india visa singapore`,
  `越南签证 新加坡`, `新加坡 办理 美国签证 中国护照` and `ds160 填写`. Page one is
  official sources (embassies, evisa.gov.vn, VFS, travel.state.gov) plus
  explainer guides (Wise, MoneySmart, trip.com, intermediaries such as
  localvietnam.com). The intent VIZA can win is "how do I apply from Singapore,
  and can someone do it for me", answered on the destination page with the
  official source linked, not a duplicate of the government page.

## Map

| Page | Primary keyword | Vol (Planner SG, 2026-10-24) | Intent | Secondary terms (vol, lang) | Status |
|---|---|---|---|---|---|
| `/visa/vietnam`, `/zh-CN/visa/vietnam` | vietnam e visa | 3,600 (en) | apply / how to | vietnam visa singapore 590 (en); vietnam visa on arrival 390 (en); 越南 签证 480 (zh); 越南 电子 签 50; 越南 电子 签证 50; 越南 落地 签 50; 越南 签证 申请 40 | title + description set |
| `/visa/indonesia` | indonesia visa on arrival | 3,600 (en) | apply | evisa indonesia 2,900; bali visa on arrival 720; evoa indonesia 320 (en); 印尼 签证 260; 印尼 落地 签 70 (zh) | title + description set |
| `/visa/india` | india e visa | 1,600 (en) | apply | e tourist visa india 1,900 (en, Planner idea); india e visa singapore 110 (en); 印度 签证 70; 印度 电子 签 10 (zh) | title + description set |
| `/visa/united-states` | us visa application singapore | 1,000 (en) | apply / service | us visa singapore 590; us visa appointment singapore 260 (en); 美国 签证 320; 美 签 预约 170; 美国 签证 预约 140; 美国 签证 申请 50 (zh) | title + description set |
| `/guides/ds-160` (new, branch `seo/new-pages-viza`) | ds160 | 1,300 (en; same merged term 1,300 under zh-CN) | how to fill the form | ds 160 1,000; ds 160 form 390 (en); 美 签 ds160 20; ds160 填写 10 (zh) | built, not deployed |
| `/visa/japan` | japan visa application in singapore | 880 (en) | apply | japan evisa 1,000 (en); 日本 签证 390; 日本 签证 新加坡 70; 新加坡 日本 签证 50; 日本 签证 申请 40 (zh) | title + description set |
| `/visa/united-kingdom` | uk visa application singapore | 590 (en) | apply | uk visa singapore 480; uk eta 2,900 (en); 英国 签证 140; 英国 签证 申请 40 (zh) | title + description set |
| `/visa/france` | schengen visa singapore | 480 (en) | apply | france visa singapore 390; schengen visa application singapore 170 (en); 申根 签证 170; 法国 签证 140 (zh) | title + description set |
| `/visa/italy` | italy visa singapore | 320 (en) | apply | 意大利 签证 140 (zh) | title + description set |
| `/visa/australia` | 澳大利亚 签证 | 260 (zh) | apply | 澳洲 签证 260 (zh); australia eta singapore 390 (en); see trap on `australia visa singapore` | title + description set |
| `/visa/thailand` | thailand visa singapore | 390 (en) | apply | thai e visa 480; thailand e visa 320 (en); 泰国 签证 50 (zh) | title + description set |
| `/visa/canada` | canada visa singapore | 320 (en) | apply | canada eta 720 (en); 加拿大 签证 110 (zh) | title + description set |
| `/visa/malaysia` | malaysia visa singapore | 170 (en) | apply | 马来西亚 签证 70 (zh) | title + description set |
| `/visa/united-arab-emirates` | dubai visa singapore | 140 (en) | apply | 迪拜 签证 10 (zh) | title + description set |
| `/visa/saudi-arabia` | saudi visa singapore | 140 (en) | apply | saudi tourist visa 90; saudi e visa 70 (en); 沙特 签证 20 (zh) | title + description set |
| `/visa/turkiye` | turkey e visa | 110 (en) | apply / eligibility | turkey visa singapore 110 (en); 土耳其 签证 70 (zh) | title + description set |
| `/visa/egypt` | egypt e visa | 110 (en) | apply | egypt visa singapore 90 (en); 埃及 签证 30 (zh) | title + description set |
| `/` and `/zh-CN` | visa application singapore | 590 (en) | service | visa agent singapore 210 (en); 新加坡 签证 代办 10; 签证 代办 10 (zh) | existing title kept; zh description extended |

## Traps (measured, do not target as head terms)

- `sg arrival card` 135,000, `singapore arrival card` 60,500, `新加坡 入境 卡`
  1,900, `malaysia digital arrival card` 49,500, `马来西亚 入境 卡` 4,400,
  `thailand digital arrival card` 12,100, `tdac thailand` 6,600,
  `all indonesia arrival card` 12,100: free official forms. ICA warns about
  unofficial sites, and a service page would read as one. Blog explainers that
  link to the official form are fine; no service pages.
- `india visa singapore` 1,300: Planner merges it with "singapore visa for indian
  citizens"; most of the demand is Indians coming to Singapore. Use `india e visa`.
- `japan visa singapore` 2,400: merged with "singapore visa from japan". Use
  `japan visa application in singapore` 880.
- `australia visa singapore` 2,400: merged with "visa for singapore for
  australian". Use the Chinese terms and `australia eta singapore`.
- `china visa application singapore` 6,600: VIZA does not file China visas.
- `pr application singapore` 12,100, `singapore permanent residency application`
  12,100: residency, not travel visas; out of scope (see llms.txt poor matches).
- Navigational, not targetable: `singapore us embassy` 3,600, `embassy of vietnam
  in singapore` 2,400, `thai embassy in singapore` 2,400, `vfs singapore` 1,600,
  `italy embassy singapore` 1,900.

## Raw Planner output

Kept with the research run, not in the repo: seed files and full output were
`/tmp/seo-kw/viza/{zh1,zh2,zh3,zh4,en1,en2,en3}.out` (7 Planner calls, 20 seeds
each). Re-run with:

```bash
S=~/.claude/skills/seo-optimizer/scripts
node $S/keyword-planner.mjs --geo sg --lang zh-cn --ideas 40 "美国 签证" "申根 签证" ...
node $S/keyword-planner.mjs --geo sg --lang en --ideas 40 "us visa singapore" ...
```
