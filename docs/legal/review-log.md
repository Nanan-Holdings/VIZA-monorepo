# Legal review log

Every section of `/legal/terms`, `/legal/privacy`, `/legal/cookies`, `/legal/subprocessors`, `/legal/refund-policy` must be counsel-reviewed before public launch. Track each review here.

| Date       | Surface            | Reviewer (firm + name) | Outcome                  | Diff committed |
| ---------- | ------------------ | ---------------------- | ------------------------ | -------------- |
| 2026-05-11 | /legal/terms       | pending                | placeholder draft only   | n/a            |
| 2026-05-11 | /legal/privacy     | pending                | placeholder draft only   | n/a            |
| 2026-05-11 | /legal/cookies     | not yet drafted        | —                        | n/a            |
| 2026-05-11 | /legal/subprocessors | not yet drafted      | —                        | n/a            |
| 2026-05-11 | /legal/refund-policy | not yet drafted      | —                        | n/a            |

## Process

1. Draft locally. Mark placeholder text with a yellow callout in the page so it's visible in staging.
2. Send the rendered page URL + the source MDX to counsel.
3. Apply their redline; commit with `chore(legal): counsel review pass on /legal/<surface>`; log the row here with the reviewer + date.
4. Remove the yellow callout in the same commit.

Launch gate: every surface must show **outcome = reviewed** with a committed diff before the public marketing site goes live.
