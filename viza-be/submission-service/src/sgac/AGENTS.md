# SGAC Submission Runner Module

Scope: Singapore `SG_ARRIVAL_CARD` official ICA portal automation only.

- `normalize.ts` maps VIZA answer keys to the ICA portal payload.
- `official-options.ts` mirrors SGAC official-option lists used by the seed and
  blocks stale/free-text values before the worker opens the ICA portal.
- ICA's nationality API currently returns 204 base records, while the SGAC
  frontend injects `CHN_HK` and `CHN_MC` after `CHN`. Mirror the complete
  206-option frontend list so runner labels match the portal exactly.
- Commercial-air answers store the official carrier dropdown code separately
  from the flight-number field. Accept both `AS` + `223` and a combined value
  such as `AS223`, then send ICA the normalized carrier code and bare flight
  number. Keep land, cruise, and non-cruise vessel requirements branch-specific.
- `runner.ts` drives the ICA SGAC e-Service, submits when enabled, and captures screenshots/PDF evidence.
- Shared-pool runs receive a `RunnerExecutionContext`; check ownership before declaration/final verification clicks and abort the browser on lease loss. Do not wrap ownership-loss/abort errors as portal failures.
- `__tests__/captcha-selector.spec.js` guards that the security verification
  solver captures the CAPTCHA image rather than the adjacent audio icon.
- `date-window.ts` owns the ICA three-day submission-window calculation for worker scheduling.
- Keep SGAC separate from `SG_VISITOR_VISA` and from generic visitor visa/RAG fallbacks.
- Do not log applicant secrets or commit downloaded ICA confirmation artifacts.
- Before marking SGAC verified, run the user-facing browser path: click the
  frontend submit/retry button, confirm the worker picks up the queue and the UI
  progresses, then preserve official trace/screenshot and DB result evidence.
  If the browser-click test is blocked, report the exact reason.
