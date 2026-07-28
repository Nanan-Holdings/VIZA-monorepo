# Support console (PRODUCT-003..006)

Single staff surface for managing applicant tickets — assign, reply, capture internal notes, track SLA.

## File layout

| Path                                                                      | Owns                                          |
| ------------------------------------------------------------------------- | --------------------------------------------- |
| `app/admin/cs/page.tsx`                                                   | Ticket queue (tabs + table)                   |
| `app/admin/cs/_components/CsQueueClient.tsx`                              | Tab switcher + queue table                    |
| `app/admin/cs/[ticketId]/page.tsx`                                        | Per-ticket reply + macros + internal notes    |
| `app/admin/cs/kpis/page.tsx`                                              | Median first-response / SLA / WoW             |
| `app/actions/admin-cs.ts`                                                 | All server actions                            |
| `viza-be/agent-backend/drizzle/0083_admin_cs.sql`                         | Schema: support_ticket extension + macros + internal notes |

## Tabs (PRODUCT-003)

- **Open** — every non-closed ticket.
- **Mine** — `assigned_to = auth.uid()` AND not closed.
- **Unassigned** — `assigned_to IS NULL` AND not closed.
- **Breaching** — `first_response_at IS NULL` AND `sla_due_at < now()`.

The breach detector relies on `sla_due_at` being set when the ticket lands. Producer-side: when a ticket is created via SUPPORT-001 / SUPPORT-002, set `sla_due_at = NOW() + package_sla` so the column is always populated for new rows; back-fill is acceptable.

## Macros (PRODUCT-004)

`support_macro` rows live per (country, locale). The ticket-reply UI filters by the linked application's country; staff click "Insert" to drop the body into the reply textarea (no auto-send).

Seed staffing: `db/seeds/support-macros/<country>.json` carries 5 starter macros per shipped country. Format:

```json
[
  { "title": "Status — KH", "body": "Your Cambodia e-Visa is still ...", "locale": "en" },
  ...
]
```

Apply via a one-off `npx ts-node scripts/seed-support-macros.ts` (not yet implemented — drop the seed file + script when ready).

## Internal notes (PRODUCT-005)

`support_internal_note` is staff-only RLS. The applicant-facing thread (`support_message`) is unaffected. The per-ticket page renders two threads side-by-side:

- **Reply** — surfaces to applicant.
- **Internal** — staff-only context (e.g. "called the consulate, waiting on the queue").

## KPIs (PRODUCT-006)

`loadKpis(windowDays=7)` returns five headline numbers. Aggregation runs in TS because window sizes are small (≤200 tickets typical). When volume grows, swap to a Postgres RPC to avoid PostgREST's 1k-row cap (`get_support_kpis(start_date, end_date)` is the placeholder name).

KPIs render under `/admin/cs/kpis`. Cards: brand-50 background, brand-500 numerals, no charts at MVP (charts come with PRODUCT-006 vNext).
