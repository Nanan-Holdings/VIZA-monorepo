# Design brief: DS-160 guide (`/guides/ds-160`, `/zh-CN/guides/ds-160`)

For the web version of Claude Design (claude.ai, the VIZA design project), not
the canvas. This session had no browser access to claude.ai, so the page was
built directly from the site's existing legal-page shell
(`app/[locale]/legal/legal.css`), `SiteNav` and `SiteFooter`. Use this brief to
redo or refine it there, then port only the named sections back.

## Why the page exists

- Keyword: `ds160`, 1,300 searches a month in Singapore (Google Keyword Planner,
  2026-10-24); `ds 160` 1,000; `ds 160 form` 390; Chinese `美 签 ds160` 20,
  `ds160 填写` 10. See `docs/seo/keyword-map.md`.
- Intent: how to fill in the form. Page one is official (ceac.state.gov,
  travel.state.gov) plus agency and study-abroad guides. VIZA fills DS-160s for
  a living, so the page answers the question and offers to do it.
- Money page it feeds: `/visa/united-states` (linked twice) and
  `/apply?country=united-states`.

## Rules (binding, `~/.claude/skills/seo-optimizer/references/page-design.md`)

- One heading and one short line. No eyebrow above the title, no subtitle, no
  paragraph after it.
- Sections show real things: the documents list, the six steps, the mistakes,
  the FAQ. No adjective-only sections, no icon grids.
- Short sentences, numbers and names (USD 185, 27 Napier Road, 20 minutes,
  600x600 px). No "seamless", "unlock", "elevate", no em dashes.
- Same tokens, components and spacing as the live site. It should look like it
  was always there.

## Content (from `messages/*.json` `guides.ds160`)

- H1: "DS-160 form: how to fill it in from Singapore" /
  "DS-160 填写指南：在新加坡申请美签"
- Line: the form is on ceac.state.gov; fill, upload photo, submit, pay USD 185,
  book the interview at the US Embassy Singapore.
- What you need (7 items), Step by step (6 numbered steps, link to
  ceac.state.gov/genniv), Common mistakes (4), Let VIZA fill it (one paragraph,
  text link to the US visa page, one primary button), Questions (4 FAQ, also in
  FAQPage JSON-LD).

## Open questions for design

- Whether the step list should reuse the numbered timeline from the visa pages
  (`VisaCountryRich` process section) instead of a plain ordered list.
- Whether the left contents column earns its place on a page this short.

Screenshots of the current build: `/tmp/seo-screens/viza/ds-160-{en,zh-CN}-{desktop,mobile}.png`.
