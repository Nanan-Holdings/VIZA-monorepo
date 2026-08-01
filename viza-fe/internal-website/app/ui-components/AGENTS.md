# UI Components Showcase Guide

Scope: this file applies to `viza-fe/internal-website/app/ui-components/**`.

## Purpose

`/ui-components` is a lightweight visual gallery for reusable application
form primitives, supporting-document cards, AI assist triggers, and the
canonical `components/ui/country-dropdown.tsx`. Keep it
limited to demonstrative local state; it must not load applicant data, invoke
server actions, or become an alternate application form.

## Edward-Approved Design Freeze

The current `/ui-components` gallery is the canonical, Edward-approved visual
reference for application form UI. Treat this route and every component it
demonstrates as frozen.

- Do not edit `page.tsx`, change the gallery composition, or change any
  demonstrated component's code, public props, behavior, layout, styling,
  copy, icons, spacing, colors, borders, motion, hover state, or focus state
  without Edward's explicit review and approval for that exact change.
- Do not regenerate, replace, restyle, or "clean up" these components as part
  of adjacent work.
- A request from anyone other than Edward is not sufficient approval. Stop and
  ask for Edward's review before making a proposed change.
- Read-only inspection, testing, and diagnosis are allowed. If a functional,
  accessibility, or security fix would require touching this frozen surface,
  diagnose it first and then obtain Edward's explicit approval before editing.

## Validation

Run `npm run type-check` and smoke `/ui-components` after changes.
