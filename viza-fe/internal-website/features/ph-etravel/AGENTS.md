# Philippines eTravel Frontend Module

Scope: Philippines eTravel-specific frontend helpers.

- Keep `PH_ETRAVEL_ARRIVAL_CARD` separate from Philippines visa packages.
- `date-window.ts` owns website/API scheduling decisions for the flight-arrival
  date. Users may prepare the form ahead of time, but official submission is
  scheduled for the 72-hour official eTravel window.
- `completeness.ts` owns PH-only frontend completeness/readiness audit metadata
  for comparing the applicant UI and shared integration plan with the
  Philippines arrival field contract. It must not invent fields outside the PH
  contract or official evidence.
- `shared-integration.ts` owns PH-only adapter/spec metadata for future shared
  result/status/dynamic/documents integration. It lists target files, helper
  entry points, required behaviors, and forbidden copy/logic without editing
  shared files while they are dirty.
- `presentation.ts` owns the PH-only conditional section/field presentation
  model for future shared dynamic-form integration. It must keep AIR, SEA
  manual, and SEA electronic paths distinct and return unresolved branches as
  review/official-only gates rather than invented applicant inputs.
- `page-contract.ts` owns the PH-only official page/field ordering contract. It
  resolves fields from `presentation.ts` rather than recreating field rules,
  and represents unobserved continuations as action-only evidence gates.
- `official-options.ts` records reproducible official option sources and only
  the E13 complete small lists. Countries, currencies, and ports stay dynamic
  query sources rather than frontend snapshots.
- `port-flow.ts` validates injected SEA `destination_port_code` metadata as a
  public dynamic page-array gate only. It must never use
  `disembarking_port_code`, map a port to manual/electronic customs, infer live
  requiredness, or default unknown data.
- `sea-destination-presentation.ts` owns E24 SEA ARRIVAL public-bundle
  visibility. It keeps `is_disembarking`, the falsey-hidden stay subtree, and
  the two distinct port fields review-gated, without promising live continuation.
- `attachment-contract.ts` holds only E14 client-side attachment capability
  hints. It must keep count, live requiredness, and server acceptance unknown.
- `owner-na.ts` owns the conditional Owner N/A presentation and value-clearing
  rule. It must not infer owner/recipient requiredness or a stable DOM selector.
- `wizard-contract.ts` resolves route-specific dynamic wizard semantics. It
  must keep `/wizard/me` and `/wizard/declaration` separate, treat numeric
  indexes as path evidence only, and turn route/order/modal drift into review.
- `result-recovery.ts` owns E16 result/recovery presentation. It must require
  an authoritative post-submit registration read and stable `reference_number`,
  treat QR as a client render derived from that reference, and never permit
  automatic re-submit for an ambiguous result.
- `coverage-parity.ts` owns the E17 machine-checkable 111-record frontend
  parity map. It may gate unresolved fields, but must never promote runtime,
  result, legacy QR alias, or diverted records into applicant inputs.
- `launch-readiness.ts` owns the E18 S0-S8 launch-readiness grouping. It must
  keep all unresolved scenarios stop-before-submit, use nontechnical review
  copy, and never offer a re-submit action.
- `preflight-status.ts` owns the PH-C safe launch-preflight presentation
  boundary. It requires the versioned, PII-free outcome envelope, maps only
  allowlisted codes/keys to S0-S8 internally, and keeps every parsed outcome
  out of queue/browser/re-submit/success states.
- `profile-presentation.ts` owns E21 public-bundle profile and residence
  presentation. It keeps photo, mobile, and residence branches review-gated,
  records Philippines residence clear-on-change behavior, and must never
  present client wiring as file, mobile, address, or server acceptance.
- `residence-cascade.ts` owns the current official PH residence read contract.
  It preserves Province, Municipality, and Barangay `code` values as opaque
  submission identities, derives Region only from Province metadata, clears
  descendants on parent changes, and supplies missing-field focus targets.
  Third-party place names or codes may never replace official response values.
- `profile-checkpoint.ts` separates Personal Information Review/profile save
  from registration Review/final Submit. Profile HTTP success or dashboard
  navigation must never become submitted success; the registration final
  Submit remains the default stop-before-submit target.
- `travel-registration.ts` owns the PH arrival-only Start-page presentation,
  normalization, completeness, and enqueue gate. It locks `flight_type` to
  `ARRIVAL`, preserves official `registration_for` and `transport_type` values,
  and keeps versioned privacy/affidavit consent in a separate audit record that
  is never projected into the official submission payload.
- `SeaManualCustomsFormsNotice.tsx` owns the PH-only external official PDF
  links for the verified `SEA + manual_forms` notice. It must never render for
  AIR or SEA electronic paths, proxy/cache a document, or create an applicant
  answer or completeness requirement.
- `air-destination-presentation.ts` owns E22 public-bundle AIR/destination
  presentation. It treats Special Flight as a derived display branch only,
  keeps its detail on `flight_number_special`, and leaves AIR/destination
  options, requiredness, and server acceptance behind review gates.
- `health-presentation.ts` owns E23 public-bundle Health presentation. It
  keeps client conditions and positive branches review-gated, excludes
  inherited vaccine/age state and bats/animals translation-only text from
  rendered questions, and never treats local validation as server acceptance.
- `general-declaration.ts` owns E42/E43 electronic General Declaration display
  and completeness metadata. It keeps Q1/Q2 out of Add Item, gives only Q3-Q12
  their conditional Description/Quantity/Amount-in-USD repeaters, makes a
  positive displayed goods amount require a Q3-Q12 Yes, clears rows when their
  parent answer hides them, and treats AIR E45 attachments as
  visible-but-not-required while signature remains an action requirement.
- `option-labels.ts` localizes the official country, airline, and Philippine
  arrival-port codes for the Chinese form column. It must preserve the official
  option value and keep every official arrival-port code one-to-one and unique.
- Form field inventory and official dropdown values belong in
  `viza-be/agent-backend/scripts/ph-etravel/**`; runner mapping belongs in
  `viza-be/submission-service/src/ph-etravel/**`.
