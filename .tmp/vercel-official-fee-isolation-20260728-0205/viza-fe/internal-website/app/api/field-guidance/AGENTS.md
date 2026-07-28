# Field Guidance API Agent Guide

Scope: this file applies to `viza-fe/internal-website/app/api/field-guidance/**`.

## Purpose

This route is the browser-safe proxy for field-level visa form guidance.
Frontend components call the same-origin `POST /api/field-guidance` endpoint,
and this route forwards to the agent backend when available.

## Failure Behavior

- If the agent backend is unavailable, return a structured local fallback with
  `aiUsed: false` instead of letting the browser hit a cross-origin
  `Failed to fetch`.
- Keep user-facing text plain. Do not return Markdown-heavy guidance.
- Do not persist applicant answers here.

## Related Files

- `viza-fe/internal-website/components/field-guidance-panel.tsx`
- `viza-fe/internal-website/types/field-guidance.ts`
- `viza-be/agent-backend/src/routes/field-guidance.routes.ts`
