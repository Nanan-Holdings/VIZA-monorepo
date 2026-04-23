# PRD — UK Package Assignment and Application Rendering

**Status:** Implementing
**Date:** 2026-04-23

## Goal
Make the UK Standard Visitor package usable end-to-end in VIZA so that:
1. admins can assign it from `/admin`
2. the assigned user sees the UK package reflected in `/client/home`
3. the user’s `/client/application` flow creates/loads a draft application using the assigned package instead of falling back to Indonesia B211A defaults

## Problem
The repo already contains:
- a real admin package assignment UI
- a `visa_packages` catalog entry for `UK_STANDARD_VISITOR`
- UK schema/seed artifacts

But the user-facing flow still contains hardcoded B211A assumptions in onboarding, application fallbacks, and display labels. That breaks package truth after assignment.

## Scope
### In scope
- preserve current admin assignment flow
- make onboarding create draft applications using the active assigned package
- make server-side draft application creation attach the active `visa_package_id`
- make `/client/application` prefer assigned package values instead of DS160/B211A defaults
- make home/application status display UK-friendly labels for `UK_STANDARD_VISITOR`

### Out of scope
- new admin screens
- UK schema reseeding / DB migration execution in production
- Access UK submission automation

## Requirements
### R1. Admin assignment remains the source of truth
The existing `/admin/(dashboard)/users/[id]/assign-package-form.tsx` and user detail page remain the package assignment surface.

### R2. Onboarding must respect assigned package
If a user has an active package, onboarding must create the draft application with:
- `country` from the assigned package
- `visa_type` from the assigned package
- `visa_package_id` set to that package id

### R3. Application draft creation must respect assigned package
When `/client/application` creates a draft through `ensureDraftApplication`, it must attach the active package metadata instead of silently creating generic DS160/B211A-style drafts.

### R4. User display must reflect the assigned visa type
Home/application surfaces must show UK package-friendly names and flag/country display, not Indonesia-specific copy when the active application/package is UK.

## Acceptance criteria
- Admin can still assign `UK_STANDARD_VISITOR` from `/admin/users/[id]`
- A user with an active UK package who completes onboarding gets an application row with UK country/type/package linkage
- `/client/application` renders with the assigned UK package title and uses package-aware draft creation
- Home/status cards display `UK Standard Visitor Visa` for UK applications instead of raw or B211A-only labels
- Frontend type-check passes

## Verification plan
- inspect admin assignment flow
- inspect onboarding/application/home code paths
- run frontend type-check
- verify diff only touches intentional UK package wiring files
