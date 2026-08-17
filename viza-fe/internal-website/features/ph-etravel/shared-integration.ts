export type PhEtravelSharedIntegrationTarget =
  | "SubmissionStatusStep"
  | "sharedSubmissionResult"
  | "FailureCard"
  | "WaitingCard"
  | "dynamicStepForm"
  | "dynamicFormField"
  | "documentsActions"
  | "longFormPhCopy";

export type PhEtravelSharedIntegrationSpec = {
  target: PhEtravelSharedIntegrationTarget;
  sharedFile: string;
  entryCondition: string;
  helperToUse: string[];
  requiredBehavior: string[];
  forbiddenBehavior: string[];
  releaseGate: "shared_unfreeze_required" | "official_evidence_required";
};

export const PH_ETRAVEL_SHARED_INTEGRATION_PACKAGE: PhEtravelSharedIntegrationSpec[] =
  [
    {
      target: "SubmissionStatusStep",
      sharedFile:
        "app/client/application/_components/result-cards/SubmissionStatusStep.tsx",
      entryCondition:
        "country=philippines and visaType=PH_ETRAVEL_ARRIVAL_CARD",
      helperToUse: [
        "classifyPhEtravelResultState",
        "createPhEtravelUserStatusMessage",
        "createPhEtravelResultRecoveryPresentation",
        "isPhEtravelSubmittedCandidate",
      ],
      requiredBehavior: [
        "Render review_reached_not_submitted, stopped-before-submit, family_gate, companion_confirmation, signature_required, sea_manual_customs_forms, and sea_electronic_signature_required as action-required or recovery states.",
        "Render a submitted candidate only after an authoritative post-submit registration read supplies a stable reference_number and the client-rendered QR matches it.",
        "Show HTTP 200, navigation, reference-missing, QR-render failure, and reopen mismatch as recovery-required with no re-submit.",
      ],
      forbiddenBehavior: [
        "Do not show success for Review/Summary visibility, Submit button visibility, screenshots, family/no-companion confirmation, or manual customs notice.",
        "Do not treat a local reference, locally generated QR, or a route opening as an authoritative result or downloadable/printable QR capability.",
        "Do not use SG/ICA fallback copy for Philippines eTravel.",
      ],
      releaseGate: "shared_unfreeze_required",
    },
    {
      target: "sharedSubmissionResult",
      sharedFile: "lib/submission-result.ts",
      entryCondition:
        "PH eTravel result normalization or applicant result card reads submission_result",
      helperToUse: [
        "classifyPhEtravelResultState",
        "hasPhEtravelAuthoritativePostSubmitReference",
        "isPhEtravelDerivedQrReferenceConsistent",
        "isPhEtravelSubmittedCandidate",
        "createPhEtravelResultRecoveryPresentation",
      ],
      requiredBehavior: [
        "Normalize a PH submitted candidate only through an authoritative post-submit registration read, stable reference_number, and consistent client-derived QR render.",
        "Preserve recovery-required for ambiguous POST, read failure, missing reference, QR render failure, or reopen mismatch; preserve action-required for Review stop, family gate, companion confirmation, signature stop, SEA manual customs, SEA electronic signature, and structured customs action-required outcomes.",
      ],
      forbiddenBehavior: [
        "Do not treat submitted=true alone as PH success.",
        "Do not store official reference or QR as applicant form answers.",
        "Do not require or promise an official downloadable or printable QR artifact from current evidence.",
      ],
      releaseGate: "shared_unfreeze_required",
    },
    {
      target: "FailureCard",
      sharedFile:
        "app/client/application/_components/result-cards/FailureCard.tsx",
      entryCondition:
        "PH eTravel failure, action-required, provider error, or retry status",
      helperToUse: [
        "phEtravelUserFacingError",
        "createPhEtravelUserStatusMessage",
      ],
      requiredBehavior: [
        "Display only allowlisted PH error copy or the generic safe PH fallback.",
        "Route review/family/signature/manual customs stops to action-required language rather than fatal failure where recoverable.",
      ],
      forbiddenBehavior: [
        "Do not echo raw official/provider messages, stack traces, tokens, names, passport numbers, cookies, OTPs, or internal paths.",
        "Do not mention ICA or Singapore copy.",
      ],
      releaseGate: "shared_unfreeze_required",
    },
    {
      target: "WaitingCard",
      sharedFile:
        "app/client/application/_components/result-cards/WaitingCard.tsx",
      entryCondition:
        "PH eTravel scheduled, queued, running, or result recovery status",
      helperToUse: [
        "createPhEtravelScheduledPortalSummary",
        "createPhEtravelUserStatusMessage",
      ],
      requiredBehavior: [
        "Explain 72-hour scheduling, queued refresh behavior, and authoritative result recovery without a repeat Submit.",
        "State eTravel is free, is not a visa, and does not guarantee border admission.",
      ],
      forbiddenBehavior: [
        "Do not imply refresh creates a new official task.",
        "Do not use SG/ICA wording.",
      ],
      releaseGate: "shared_unfreeze_required",
    },
    {
      target: "dynamicStepForm",
      sharedFile: "components/dynamic-step-form.tsx",
      entryCondition: "PH_ETRAVEL_ARRIVAL_CARD dynamic form rendering",
      helperToUse: [
        "createPhEtravelFormPresentation",
        "createPhEtravelOrderedPageContract",
        "createPhEtravelSeaPortOrderedPageContract",
        "createPhEtravelDynamicWizardContract",
        "reviewPhEtravelDynamicWizardObservation",
        "PH_ETRAVEL_OFFICIAL_OPTION_SOURCES",
        "createPhEtravelAttachmentPresentation",
        "createPhEtravelOwnerNaPresentation",
        "applyPhEtravelOwnerNaNormalization",
        "PH_ETRAVEL_CANONICAL_COVERAGE",
        "getPhEtravelEnabledApplicantCoverage",
        "auditPhEtravelCoverage",
        "PH_ETRAVEL_LAUNCH_SCENARIOS",
        "getPhEtravelLaunchReadiness",
        "auditPhEtravelLaunchScenarios",
        "createPhEtravelPreflightUserPresentation",
        "getPhEtravelPreflightReadiness",
        "createPhEtravelProfilePresentation",
        "buildPhResidenceOfficialRequest",
        "parsePhResidenceOfficialOptions",
        "applyPhResidenceCascadeChange",
        "applyPhResidenceCascadeFormChange",
        "readPhResidenceFormValues",
        "getPhResidenceMissingItems",
        "PH_ETRAVEL_SUBMIT_BOUNDARIES",
        "createPhEtravelCheckpointPresentation",
        "PH_ETRAVEL_TRAVEL_REGISTRATION_PRESENTATION",
        "normalizePhEtravelTravelRegistration",
        "createPhEtravelRegistrationAnswerProjection",
        "createPhEtravelAirDestinationPresentation",
        "createPhEtravelHealthPresentation",
        "createPhEtravelApplicantExperience",
        "createPhEtravelGeneralDeclarationPresentation",
        "getPhEtravelGeneralDeclarationMissingItems",
        "normalizePhEtravelGeneralDeclarationItemRows",
        "createPhEtravelSeaDestinationPresentation",
        "SeaManualCustomsFormsNotice",
        "PH_ETRAVEL_FORM_COMPLETENESS_MATRIX",
        "PH_ETRAVEL_SEA_REVIEW_COPY",
      ],
      requiredBehavior: [
        "Render PH contract-backed AIR/SEA branches only: SEA vessel/voyage/date aliases, is_disembarking, TRAVEL_PORT, and disembarking_port_code.",
        "Consume createPhEtravelOrderedPageContract() for the verified AIR positive, SEA manual, SEA electronic No, and SEA electronic Yes-through-signature page order; preserve AIR Customs No continuation and positive SEA post-signature continuation as action-only evidence gates.",
        "Use createPhEtravelSeaDestinationPresentation() for the E24 SEA ARRIVAL disembarking/stay branch and keep destination_port_code distinct from disembarking_port_code.",
        "Treat with_custom_declaration only as an official public dynamic page-array gate through createPhEtravelSeaPortOrderedPageContract(); live continuation remains action-required.",
        "Use the route-specific dynamic wizard contract: regular /wizard/me and short /wizard/declaration must be interpreted independently, with wizard indexes treated only as path results and observed indexes retained as evidence.",
        "Render AIR and SEA electronic Customs Yes structured UI through Currency Declaration from shared fields after unfreeze, while keeping full automation pending runner phase gates.",
        "Render SEA customs as path-specific: manual forms path and electronic customs/signature variant, including E9 signature -> Family Member(s) -> no-companion confirmation -> Summary order for no-declaration.",
        "Render SeaManualCustomsFormsNotice only after the current path is explicitly classified as SEA + manual_forms. Its two external official PDF links are reference-only: failures must not change form answers, completeness, queue state, or navigation.",
        "For SEA electronic positive physical transfer, require days-in-Philippines and last-travel only when physical_or_shipped is physically transferred; do not require them on courier or other paths.",
        "E11 confirms an action-required signature canvas on the SEA positive attachments/signature page. Keep upload rules official-only and do not turn the canvas into a file upload.",
        "Keep positive-path Family Member(s), no-companion confirmation, Summary, final Submit, reference, and QR behind official evidence; E9 no-declaration evidence does not close those positive-path gates.",
        "Keep destination branch gated by AIR or SEA is_disembarking=true only where the official branch displays it.",
        "Render attachments only on the conditional positive electronic attachment/signature context as an official-boundary notice: multiple PNG/JPG/JPEG files with a 5.00 MB per-file client hint; count, live requiredness, and server rules remain unknown.",
        "Render Owner N/A only on the conditional electronic Currency Declaration context. When true, clear and disable the confirmed owner/recipient fields; when false, leave requiredness unknown and keep physical/courier handling independent.",
        "Consume the PH presentation adapter's review/official-only gates instead of rendering unresolved contract fields as unconditional inputs.",
        "Before rendering a PH field, filter the E17 coverage map to applicant_input plus input_when_shared_ready for the resolved path; render profile, runtime, action-only, official-only, result-only, and needs-review records as the relevant eligibility or review gate.",
        "Use the E18 S0-S8 readiness contract for every unresolved branch. Its current authorization is stop-before-submit, its user copy is nontechnical, and it must not expose internal reason codes or a re-submit command.",
        "Consume only PH-C's versioned, deterministically sorted safe preflight envelope through createPhEtravelPreflightUserPresentation(). Unknown version/code/key, duplicate or unsorted key/code, out-of-scenario key, or any raw/PII-shaped payload must stay review/action-required with no queue, browser, or re-submit capability.",
        "Consume E21 photo, mobile, and residence client contracts only through createPhEtravelProfilePresentation(). Keep both passport-holder branches and the PH residence cascade review-gated; do not turn client widget wiring or client validation into live/server acceptance.",
        "When residence country is PH, use applyPhResidenceCascadeFormChange() to load Province -> Municipality -> Barangay from the verified official read endpoints, save their exact code values, derive region_code only from selected province metadata, and clear every descendant when a parent value changes. Show Chinese field copy with the official place label and keep foreign residence as line1/line2.",
        "Use getPhResidenceMissingItems() for the completeness list and navigate to its step/field anchor; incomplete residence must not enqueue or continue to an official write.",
        "Treat Personal Information Review Submit as profile_save_submit, an independently authorized official profile write. profile_saved/dashboard, HTTP 200, or navigation is not registration submitted; the default stop-before-submit target remains the later registration final_submit.",
        "For PH_ETRAVEL_ARRIVAL_CARD, render flight_type as the locked ARRIVAL - Entering the Philippines product value and expose no DEPARTURE choice. Preserve registration_for as FOR_ME/FOR_OTHER and transport_type as AIR/SEA without translating their saved values.",
        "Render privacy-and-affidavit consent as a separate affirmative VIZA gate. Persist its version and acceptance time through an authenticated audit boundary, use the returned step-1 focus target when missing, and prevent enqueue until canEnqueue is true.",
        "Create official registration answer input only through createPhEtravelRegistrationAnswerProjection(); the separate consent audit must never be copied into official form answers or payload fields.",
        "Consume E22 AIR/destination branches only through createPhEtravelAirDestinationPresentation(). Treat Special Flight as derived UI state, map only its detail to flight_number_special, and keep Residence/Hotel/Transit, dynamic hotel/port sources, return-date, and all S2 live/server gaps review-gated.",
        "Consume Health only through createPhEtravelHealthPresentation(). AIR and SEA use the same confirmed Health Declaration: require all three base Yes/No answers, show Add/Delete all-country rows only for recent-travel Yes, show the 15-option Symptoms multi-checkbox only for sick Yes, and clear either child when its parent switches to No. Bats/animals remains translation-only and exposure has no confirmed child.",
        "Use createPhEtravelApplicantExperience() for the PH final-confirmation, missing-item return links, safe status model, authoritative reference/QR display, and recovery UI. It permits live official-processing requests only when the client flag is exactly true and all supplied missing items are resolved; refresh and re-read actions are read-only and never re-submit.",
        "For electronic General Declaration, render no Add Item control for Q1/Q2. Render a separate Description/Quantity/Amount in USD repeater only for each Yes answer among Q3-Q12, and clear its retained rows when that answer stops being Yes. A positive displayed goods Amount requires at least one Q3-Q12 Yes and returns to Customs when missing. On the E45-confirmed AIR branch, show the Documents area when any Q3-Q12 answer is Yes but do not make its attachment required: an empty attachment plus a signature can continue to Family Member(s). Signature remains a required action with an attachments/signature return target; SEA requiredness/server acceptance remain gated.",
      ],
      forbiddenBehavior: [
        "Do not infer fields from Taiwan logic.",
        "Do not collapse customs checklist, goods rows, or currency groups into aggregate/free-text answers.",
        "Do not show AIR TRANSIT or AIR electronic customs/signature as universal SEA requirements.",
        "Do not say all SEA is manual forms, all SEA has no signature, or all SEA has electronic customs fully automated.",
        "Do not render the external PDF links for AIR, an unknown SEA path, or SEA electronic customs; do not proxy, cache, or copy either PDF.",
        "Do not render SEA manual or SEA electronic No with positive General Declaration/Currency fields.",
        "Do not show physical days/last-travel outside the selected SEA electronic positive physical branch, or model signature as a file upload question.",
        "Do not use disembarking_port_code to choose SEA manual/electronic customs, or default unknown, missing, stale, invalid, or mismatched destination-port metadata to either path.",
        "Do not make attachments globally required, claim an attachment count/aggregate or server limit, use generic #file markup as a stable selector, or turn the signature canvas into an upload.",
        "Do not show Owner N/A outside the conditional Currency Declaration page, infer owner/recipient requiredness, or apply it as a runner DOM selector.",
        "Do not reuse /wizard/declaration Family/Summary ordering for /wizard/me, treat a PNG signature data URL as an applicant attachment/result, or continue after unknown route, step-order mismatch, missing no-companion modal, or early Summary.",
        "Do not render result.reference_qr_render, its legacy result.qr_artifact alias, account runtime, or diverted identities as PH applicant questions or user-success capability.",
        "Do not turn S0-S8 coverage keys, reference/QR candidates, signature, attachment, Family/Summary, or any review gate into a retry-submit action.",
        "Do not expose PH-C safe codes, canonical keys, diagnostics, raw provider messages, or applicant values in UI copy, and do not treat allowed preflight as submitted or as authority to create a queue/browser action.",
        "Do not promise a photo size, camera mode, upload acceptance, mobile acceptance, address acceptance, or a server-required/optional rule from E21 public-bundle evidence.",
        "Do not submit Philippine province, municipality, or barangay names, Chinese labels, correspondence_code, or third-party PSGC values in place of the current official code.",
        "Do not treat profile review, profile save, profile HTTP success, or dashboard navigation as eTravel registration Review, final Submit, reference, QR, or submitted success.",
        "Do not expose or persist DEPARTURE for PH_ETRAVEL_ARRIVAL_CARD, silently accept a stale departure answer, translate FOR_ME/FOR_OTHER/AIR/SEA submission values, or enqueue without the auditable affirmative consent.",
        "Do not map ph_etravel_privacy_affidavit_consent, its version, acceptance time, or audit metadata to an official eTravel payload field.",
        "Do not send air.is_special_flight as an applicant answer, manufacture a hotel identifier, infer AIR customs from port metadata, or promise AIR/destination option or server acceptance from E22 bundle evidence.",
        "Do not turn vaccine/age inherited state, Health translation text, local Health validation, or client clear behavior into applicant answers, server acceptance, or Health launch readiness.",
        "Do not map destination_port_code or with_custom_declaration to a manual/electronic customs port flow, infer an explicit-false continuation, or use disembarking_port_code as a customs-flow alias.",
        "Do not show a PH submitted result from HTTP 200, navigation, local reference/QR, Summary, or Submit visibility; do not add a retry-submit control to an ambiguous PH result.",
        "Do not show Add Item for General Declaration Q1/Q2, retain rows for a hidden Q3-Q12 group, make an AIR E45 attachment a completeness error, or treat the E42/E45 client validation as server or final-submit acceptance.",
      ],
      releaseGate: "shared_unfreeze_required",
    },
    {
      target: "dynamicFormField",
      sharedFile: "components/dynamic-form-field.tsx",
      entryCondition: "PH-specific conditional field control rendering",
      helperToUse: ["PH_ETRAVEL_FORM_COMPLETENESS_MATRIX"],
      requiredBehavior: [
        "Support PH structured repeat/modal-like fields only when schema exposes them.",
        "Keep unverified attachment, Owner N/A, owner/recipient requiredness, physical branch validation, Other goods no-row blocking, and complete option-list behavior gated.",
      ],
      forbiddenBehavior: [
        "Do not mark attachment upload, profile photo, travel document, or custom signature file universally required.",
        "Do not fabricate option codes or requiredness not present in the PH field contract.",
      ],
      releaseGate: "shared_unfreeze_required",
    },
    {
      target: "documentsActions",
      sharedFile: "app/client/documents/actions.ts",
      entryCondition:
        "PH eTravel document requirement and reusable document handling",
      helperToUse: ["PH_ETRAVEL_FORM_COMPLETENESS_MATRIX"],
      requiredBehavior: [
        "Treat PH attachments and signature as conditional official-flow requirements.",
        "Use signature pad semantics only where the official signature page appears.",
      ],
      forbiddenBehavior: [
        "Do not require customs_signature_file, travel_document, or foreign profile photo globally.",
        "Do not convert the official signature pad into a mandatory PDF upload.",
      ],
      releaseGate: "shared_unfreeze_required",
    },
    {
      target: "longFormPhCopy",
      sharedFile: "app/client/application/long-form/page.tsx",
      entryCondition:
        "PH eTravel live handoff, status, and applicant pre-submit copy",
      helperToUse: [
        "PH_ETRAVEL_BOUNDARY_COPY",
        "PH_ETRAVEL_FAMILY_MEMBER_COPY",
        "PH_ETRAVEL_SEA_REVIEW_COPY",
        "isPhEtravelClientLiveSubmissionEnabled",
      ],
      requiredBehavior: [
        "Fail closed unless PH live submission env is explicitly true.",
        "Show eTravel is free, not a visa, and does not guarantee admission before live enqueue.",
        "Explain ordinary SEA is limited to verified non-cruise passenger paths, with crew diverted and cruise on the separate official route.",
        "Show SEA manual/electronic customs and signature copy as path-specific; Review/Summary is not submitted.",
      ],
      forbiddenBehavior: [
        "Do not imply live submission is enabled by default.",
        "Do not route FOR_OTHER/family member as an ordinary nested applicant without independent declaration handling.",
      ],
      releaseGate: "shared_unfreeze_required",
    },
    {
      target: "sharedSubmissionResult",
      sharedFile: "PH official final Submit/reference/QR evidence gate",
      entryCondition:
        "Any code path that would mark PH eTravel launch-ready submitted success",
      helperToUse: ["createPhEtravelResultRecoveryPresentation"],
      requiredBehavior: [
        "Keep final Submit, authoritative post-submit read, stable reference_number, QR render/scanability, dashboard reopen, and recovery page behind official_evidence_required until PH-A/coordinator verifies them.",
      ],
      forbiddenBehavior: [
        "Do not simulate final Submit/reference/QR from Review/Summary evidence.",
        "Do not re-submit after HTTP 200/navigation-only, read failure, reference-missing, QR-render failure, or reopen mismatch.",
        "Do not claim customs/currency full automation while runner phase remains pending.",
      ],
      releaseGate: "official_evidence_required",
    },
  ];

export function getPhEtravelSharedIntegrationByGate(
  gate: PhEtravelSharedIntegrationSpec["releaseGate"]
): PhEtravelSharedIntegrationSpec[] {
  return PH_ETRAVEL_SHARED_INTEGRATION_PACKAGE.filter(
    (item) => item.releaseGate === gate
  );
}

export function getPhEtravelSharedIntegrationForTarget(
  target: PhEtravelSharedIntegrationTarget
): PhEtravelSharedIntegrationSpec[] {
  return PH_ETRAVEL_SHARED_INTEGRATION_PACKAGE.filter(
    (item) => item.target === target
  );
}
