# Admin UI Components Guide

Scope: this file applies to `components/admin/**`.

## Purpose

This directory composes the existing shadcn primitives into admin-only page,
metric, queue, status, and navigation patterns. It does not own business logic
or data fetching.

## Rules

- Build admin surfaces from `components/ui/**` primitives and semantic theme
  classes such as `bg-card`, `text-muted-foreground`, and `border-border`.
- Do not introduce hard-coded business copy, Supabase access, or client portal
  styles here.
- Admin theme variables are scoped by `app/admin/admin-theme.css`; never change
  global/client tokens to restyle the admin portal.
- Preserve keyboard focus, semantic headings, and accessible names.
- Route components supply localized copy and mutations.

## Validation

Run `npm run type-check`, focused lint, and smoke an authenticated admin route
at desktop and mobile widths after changing these components.

## Related Files

- `app/admin/admin-theme.css`
- `app/admin/admin-layout-content.tsx`
- `components/ui/**`
