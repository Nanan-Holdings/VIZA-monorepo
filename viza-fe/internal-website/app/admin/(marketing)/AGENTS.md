# Marketing Portal Route Guide

Scope: applies to `app/admin/(marketing)/**`.

This route group owns `/admin/marketing` under a dedicated layout. Active
`admin` and `staff` users can view the marketing workspace and prepare blog and
social drafts. Only admins may approve blog publication or mutate external
social posts. Keep those checks in server actions as well as hiding controls
in the UI. The sibling `(dashboard)` group remains admin-only; its beta invite
console stays there.

Use `AdminLayoutContent` with support and marketing navigation for staff. Never
broaden the main dashboard layout to admit staff.

## Visual language

These screens are a content pipeline, not a card gallery. The layout is ported
from the Volumet internal portal (`/internal/blog`): a page header with a
light-weight title, a one-line description and right-aligned actions, closed by
a hairline; then a vertical stack of dense, bordered table panels introduced by
small uppercase captions.

- `marketing/marketing-portal.css` is the whole stylesheet. Every class is
  prefixed `.mkt-` and every rule is scoped under `.mkt-root`, which the group
  layout wraps around each screen, so nothing here can reach the rest of
  `/admin`. Colours, fonts and radii are VIZA design-system values only.
- `marketing/_components/portal-ui.tsx` holds the primitives: `PortalPage`,
  `PortalHeader`, `PortalStack`, `PortalSection`, `TablePanel`, `StatusBadge`,
  `Counters`, `BarRows`, `EmptyState`. A new screen is a page file using these
  and nothing else.
- Do not reach for shadcn `Card`, `Button`, `Input` or `Badge` inside this
  group. Status is text colour on a neutral pill, never a coloured plate: a
  table of twenty rows has to stay readable.
