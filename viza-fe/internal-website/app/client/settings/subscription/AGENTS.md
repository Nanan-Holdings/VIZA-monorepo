# Subscription Settings Agent Guide

Scope: this file applies to `viza-fe/internal-website/app/client/settings/subscription/**`.

## Purpose

This route lets clients review and manage the current monthly VIZA plan from
Settings.

## Guardrails

- Keep the detail surface behind the Settings entry point and
  `/client/subscription` management link.
- Read subscription state from server-side payment helpers. Do not expose
  service-role data to browser components.
- Cancellation in the sandbox is `cancel_at_period_end`; do not revoke access
  immediately unless the subscription service contract changes.
- Keep user-facing copy localized through `subscriptionManagement` messages.
