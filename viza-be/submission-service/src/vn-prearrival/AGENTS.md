# Vietnam Pre-Arrival Submission Runner

Scope: `viza-be/submission-service/src/vn-prearrival/**`.

This module is only for `VN_PREARRIVAL_DECLARATION`. Keep it separate from the
Vietnam e-Visa runner and from legacy `VN_E_VISA` statuses.

Guardrails:

- Use only the official portal `https://prearrival.immigration.gov.vn/`.
- Do not submit or report success unless the official portal returns a
  confirmation/QR/reference.
- Use the VIZA-managed alias email for official OTP and confirmation delivery;
  keep the traveller's real email only as the forwarding target.
- Download the official PDF when available and save the QR code as evidence so
  the frontend can surface official artifacts from Supabase Storage.
- Do not implement health declaration automation until an official Ministry of
  Health electronic declaration system is confirmed active.
- Do not fallback dropdown or boolean values. If an official field cannot be
  mapped exactly, fail with a structured validation or portal error.
- Flight option labels must follow the official autocomplete formatter,
  including its unpadded/padded alias such as `MH746 (MH0746) - DAD`; verify
  that selecting the option auto-populates the locked airport field. Keep this
  pure formatting contract in `flight-label.ts`.
- `flight-catalog.ts` owns the authenticated, CAPTCHA-backed read-only refresh
  of the official flight catalog. Keep refreshes single-flight and rate-bounded,
  and never invalidate a saved frontend selection from a stale snapshot or a
  failed official refresh.
- Final success requires the official success heading plus a QR or confirmation
  reference. Keep strict result-page matching in `result-page.ts`; processing
  or Finalizing copy must never be reported as completed.
- Passenger-to-trip transition failures are classified in `trip-transition.ts`.
  Stop immediately on official passenger validation errors; never cascade a
  failed transition into misleading missing Trip Information controls.
- Province and ward values are persisted as official numeric codes, but the
  portal autocomplete must be searched and matched with the bundled English
  labels from `administrative-label.ts`. Keep this mapping covered by
  `runner-administrative-options.spec.ts`.
- Shared-pool runs receive a `RunnerExecutionContext`; close the browser on
  lease-loss abort and assert ownership immediately before Review/Submit and
  final Submit. Ownership-loss/AbortError paths must bypass portal-failure
  persistence in the queue adapter.
- Browser/session acquisition must use `launchAbortableResource`; keep the
  delayed-launch cancellation and cleanup coverage in `runner-launch.spec.ts`.
