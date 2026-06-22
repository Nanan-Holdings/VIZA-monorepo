# SGAC Submission Runner Module

Scope: Singapore `SG_ARRIVAL_CARD` official ICA portal automation only.

- `normalize.ts` maps VIZA answer keys to the ICA portal payload.
- `official-options.ts` mirrors SGAC official-option lists used by the seed and
  blocks stale/free-text values before the worker opens the ICA portal.
- `runner.ts` drives the ICA SGAC e-Service, submits when enabled, and captures screenshots/PDF evidence.
- `__tests__/captcha-selector.spec.js` guards that the security verification
  solver captures the CAPTCHA image rather than the adjacent audio icon.
- `date-window.ts` owns the ICA three-day submission-window calculation for worker scheduling.
- Keep SGAC separate from `SG_VISITOR_VISA` and from generic visitor visa/RAG fallbacks.
- Do not log applicant secrets or commit downloaded ICA confirmation artifacts.
- Before marking SGAC verified, run the user-facing browser path: click the
  frontend submit/retry button, confirm the worker picks up the queue and the UI
  progresses, then preserve official trace/screenshot and DB result evidence.
  If the browser-click test is blocked, report the exact reason.
