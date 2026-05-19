# Admin Portal Agent Guide

Scope: this file applies to `viza-fe/internal-website/app/admin/**`.

## Purpose

The admin portal is the internal operations surface for VIZA staff/admin users.
It manages accounts, products, orders, consultations, and user package
assignment.

## Key Flows

- `login/page.tsx`: admin login form using `app/actions/auth.ts`.
- `(dashboard)/layout.tsx`: server-side role gate through `lib/rbac.ts`.
- `admin-layout-content.tsx`: fixed desktop admin shell and sidebar.
- `(dashboard)/page.tsx`: dashboard shell.
- `(dashboard)/users/**`: user list/detail and package assignment.
- `(dashboard)/orders/page.tsx`: order management.
- `(dashboard)/products/page.tsx`: product management.
- `(dashboard)/cal-bookings/page.tsx`: consultation bookings.

## Ownership Boundaries

- Admin-only data access should use server components/actions and
  `createAdminClient()` where RLS bypass is required.
- Do not mix client applicant session assumptions into admin pages.
- Keep admin UI separate from `/client` visual rules unless a shared primitive
  is intentionally reused.
- If adding a new admin section, update `admin-layout-content.tsx` navigation
  and this file.

## Validation

Run from `viza-fe/internal-website`:

```powershell
npm run type-check
npm run lint
```

Smoke `/admin/login` and `/admin`. Without an admin session, verify protected
dashboard routes redirect to `/admin/login`.

## Related Files

- `viza-fe/internal-website/app/admin/login/page.tsx`
- `viza-fe/internal-website/app/admin/(dashboard)/layout.tsx`
- `viza-fe/internal-website/app/admin/admin-layout-content.tsx`
- `viza-fe/internal-website/lib/rbac.ts`
- `viza-fe/internal-website/app/actions/auth.ts`
- `viza-fe/internal-website/lib/supabase/admin.ts`
