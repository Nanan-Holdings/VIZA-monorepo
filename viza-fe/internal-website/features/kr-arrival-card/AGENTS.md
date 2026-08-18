# Korea e-Arrival Card Frontend Module

Scope: Korea e-Arrival Card-specific frontend helpers.

- Keep `KR_E_ARRIVAL_CARD` separate from the Korean C-3/K-ETA product.
- `date-window.ts` owns the Asia/Seoul two-calendar-day submission-window
  calculation; never use the browser's local date for scheduling.
- `answer-loader.ts` may read only canonical Korea answer keys. Do not reuse
  SGAC/MDAC/TDAC transport or date aliases for Korea scheduling.
- `preflight.ts` keys are VIZA audit metadata only; they must never be mapped
  into the official Korea payload.
- `config.ts` is disabled by default: live submission requires both explicit
  server and client rollout flags to equal `true`.
- The eligibility preflight marker is required before a live submission can be
  started. Uncertain or exempt applicants must remain outside the queue.
- Keep official issue-number and confirmation-PDF evidence requirements in the
  shared arrival-card lifecycle gate; never treat a bare submitted flag as
  official success.
