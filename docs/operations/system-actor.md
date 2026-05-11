# System actor UUID

```
00000000-0000-0000-0000-000000000001
```

This UUID is used as `changed_by` / `actor_id` on audit rows produced by automated jobs (fee-scraper, canary-pager, retention-purge, notify worker) where no human `auth.users.id` is available.

## Rules

1. Never insert this UUID into `auth.users` or `users` — it is a sentinel, not a real principal.
2. Audit queries filter it out when reporting "staff-driven changes":
   ```sql
   WHERE changed_by IS NOT NULL
     AND changed_by != '00000000-0000-0000-0000-000000000001'::uuid;
   ```
3. New automated writers MUST use this UUID rather than NULL — null `changed_by` is reserved for legacy data only.

## Where it's used

| Table                        | Column        | Inserter                                   |
| ---------------------------- | ------------- | ------------------------------------------ |
| `package_pricing_history`    | `changed_by`  | `src/jobs/fee-scraper.ts`                  |
| `face_match_audit`           | — (existing)  | n/a (always tied to applicant)             |
| `application_status_history` | `actor_id`    | future: retention-purge, runner-side flips |

When adding a new automated audit writer, import `SYSTEM_ACTOR_UUID` from `src/jobs/fee-scraper.ts` and pass it explicitly.
