# Translation API Agent Guide

Scope: this file applies to `viza-fe/internal-website/app/api/translations/**`.

Translation routes are server-side provider boundaries. Do not expose API keys,
service credentials, or raw provider diagnostics to browser code. Avoid logging
applicant-entered text. Keep route output small and typed for UI consumption.
