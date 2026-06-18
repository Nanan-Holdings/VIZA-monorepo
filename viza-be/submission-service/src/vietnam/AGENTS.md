# Vietnam Submission Runner Agent Guide

Scope: this file applies to `viza-be/submission-service/src/vietnam/**`.

## Reference Implementation

When debugging official Vietnam e-Visa form location, dropdown selection, or
autofill behavior, first compare against the local Chrome extension reference:

```text
D:\NUS_Bachelor\Study\Y2S2\VIZA-monorepo\vietnam-visa-helper-v1
```

Key files:

- `vietnam-visa-helper-v1/content.js`: production content script with robust
  field discovery, Ant Design Vue select handling, checkbox/radio filling, and
  upload helpers.
- `vietnam-visa-helper-v1/diagnose-failed-dropdowns.js`: dropdown ownership and
  visible-menu diagnostics.
- `vietnam-visa-helper-v1/dropdown-smoke-test.js`: focused dropdown smoke logic.
- `vietnam-visa-helper-v1/TESTING_GUIDE.md`: concise notes on staged autofill.

Important patterns to mirror in the Playwright runner:

- Locate fields through their nearest `.ant-form-item` and associated visible
  labels before falling back to global selectors.
- For Ant Design Vue dropdowns, prefer the combobox input
  `.ant-select-selection-search-input, input[role="combobox"]`, inspect
  `aria-controls` / `aria-owns`, and choose from the visible owned dropdown
  before scanning global `.ant-select-dropdown` nodes.
- Dispatch real click/input/change events when direct DOM value assignment is
  used, because Vue state must receive the event.
- Keep a diagnostic artifact when a dropdown fails: selected field id, label,
  visible dropdown ids, candidate option text, and current displayed value.

## Runner Contract

- The worker may solve official Vietnam CAPTCHA with TWOCAPTCHA when the portal
  presents one and `TWOCAPTCHA_API_KEY` is configured.
- Stop at the payment/checkpoint page after registration/reference capture; do
  not pay the official fee.
- Preserve `validationErrors`, `fieldFallbacks`, CAPTCHA telemetry, trace, and
  final screenshot in the queue payload for frontend evidence and schema tuning.
