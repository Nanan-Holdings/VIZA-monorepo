# Help articles + FAQ index (CS-004)

One MDX file per country/package, authored in plain markdown
(MDX-compatible — no JSX components yet). Surfaced via
`/client/help` filtered to the applicant's active package and via
chat-suggested-reply.

| Country | Package | File |
|---|---|---|
| Vietnam | VN_E_VISA | [vn.mdx](./vn.mdx) |
| United States | B1_B2 (DS-160) | [us.mdx](./us.mdx) |
| United Kingdom | UK_STANDARD_VISITOR | [uk.mdx](./uk.mdx) |
| EU / Schengen | EU_SCHENGEN_C_SHORT_STAY | [eu.mdx](./eu.mdx) |
| Australia | AU_VISITOR_600 | [au.mdx](./au.mdx) |
| India | IN_E_VISA | [in.mdx](./in.mdx) |

Each file follows:

```
# Title

## Documents required
…

## Processing time
…

## Refund eligibility
…

## Common rejection reasons
…
```

The `/client/help` route renders the markdown with a small subset
(H1/H2/H3, paragraphs, lists, links). MDX-flavoured JSX is not yet
parsed — keep markdown plain until we land an MDX compiler.

Last reviewed: 2026-05-08.
