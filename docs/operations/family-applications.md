# Family / multi-applicant (PRODUCT-002)

## Model

| Concept            | Table / column                                                   | Notes                                                                  |
| ------------------ | ---------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Group              | `application_group`                                              | One row per family checkout. Holds the Stripe session + total amount.  |
| Payer              | `application_group.payer_user_id` → `auth.users.id`              | The one auth user paying for everyone.                                 |
| Dependant profile  | `applicant_profiles.dependant_of_user_id` → `auth.users.id`      | No `auth_user_id` — payer manages on their behalf.                     |
| Member application | `applications.group_id` → `application_group.id`                 | One per family member; independent answer set / docs / face-match.     |

## Flow

1. Payer hits `/application/new?multi=1`, picks the package, fills `members[]` (name only).
2. `createApplicationGroup` (in `app/actions/application-group.ts`) creates the group row + an `applicant_profiles` row per member (payer reuses their existing profile if any) + an `applications` row per member linked back to the group.
3. Each member's `/application/[id]/answer` flow runs independently — answers, doc upload, OCR, face-match all per applicant.
4. Stripe checkout charges `price_cents × members.length` against the group row's `stripe_checkout_session_id`.
5. On `/home`, applications under the same `group_id` render under a single expandable card with the group `label`.

## RLS

- Payer can read every member application through the join `applicant_profiles.dependant_of_user_id = auth.uid()`.
- Dependants never see anything because they have no auth row.
- Existing applicant-self policies remain — a member whose `auth_user_id` is set (e.g. an adult sibling who signed up later) sees their own application directly.

To enable payer-access for dependant applications, extend the existing `applications_select_own` policy:

```sql
ALTER POLICY "applications_select_own" ON applications
  USING (
    applicant_id IN (
      SELECT id FROM applicant_profiles WHERE auth_user_id = auth.uid()
    )
    OR applicant_id IN (
      SELECT id FROM applicant_profiles WHERE dependant_of_user_id = auth.uid()
    )
  );
```

(This patch is **not** in migration `0082` — it's an RLS update to land alongside the front-end change. Add it via a separate migration when you ship the /home group view.)

## Limits

- Max 10 applicants per group (server-side check).
- Same package for every member at MVP (no mixed-package groups; mixed flows surface to staff).

## Audit

`application_status_history` already covers per-applicant transitions. For group-level events (Stripe session created, paid, refunded) the audit lives on `application_group.stripe_checkout_session_id` + the standard Stripe webhook log.
