# SGAC Frontend Module

Scope: SG Arrival Card-specific UI and server helpers.

- Keep result UI applicant-focused: status, DE/reference number, PDF, submit-another action, official link.
- Do not expose portal dumps, payloads, storage paths, logs, or internal queue status to applicants.
- A new submission creates a new application and preserves previous confirmation evidence.
- Next.js route files may delegate here, but SGAC business logic belongs in this folder.
