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
