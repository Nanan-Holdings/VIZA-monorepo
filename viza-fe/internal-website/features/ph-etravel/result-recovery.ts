export type PhEtravelDerivedQrRenderStatus =
  "rendered" | "failed" | "not_attempted" | "unknown";

export type PhEtravelResultState =
  "submitted_candidate" | "recovery_required" | "action_required" | "failed";

export type PhEtravelResultRecoveryReason =
  | "http_200_or_navigation_only"
  | "authoritative_read_failed"
  | "authoritative_reference_missing"
  | "derived_qr_render_failed"
  | "derived_qr_reference_mismatch"
  | "reopen_state_mismatch"
  | "local_result_not_authoritative";

export type PhEtravelResultEvidence = {
  authoritativePostSubmitRead?: boolean | null;
  authoritativeReferenceNumber?: string | null;
  authoritativeReadFailed?: boolean | null;
  derivedQrRenderStatus?: PhEtravelDerivedQrRenderStatus | null;
  derivedQrReferenceValue?: string | null;
  reopenStateConsistent?: boolean | null;
  finalSubmitHttpStatus?: number | null;
  navigatedToPreparing?: boolean | null;
  summaryVisible?: boolean | null;
  submitVisible?: boolean | null;
  localReferenceNumber?: string | null;
  localQrValue?: string | null;
  reviewReached?: boolean | null;
  stoppedBeforeSubmit?: boolean | null;
  officialStatus?: string | null;
  code?: string | null;
};

export type PhEtravelResultRecoveryPresentation = {
  state: PhEtravelResultState;
  reasons: PhEtravelResultRecoveryReason[];
  noResubmit: true;
  submitted: false;
  resultSource: "authoritative_registration_read" | "none";
  qr: {
    source: "client_rendered_from_reference";
    renderStatus: PhEtravelDerivedQrRenderStatus;
    referenceConsistent: boolean;
  };
};

export type PhEtravelResultCapability =
  | "dashboard_status"
  | "reopen_route"
  | "qr_route"
  | "download"
  | "print"
  | "scanability";

export type PhEtravelResultCapabilityEvidence = {
  capability: PhEtravelResultCapability;
  evidenceTier: "verified_public_bundle" | "unknown";
  userPromise: false;
};

export const PH_ETRAVEL_RESULT_CAPABILITY_EVIDENCE: PhEtravelResultCapabilityEvidence[] =
  [
    {
      capability: "dashboard_status",
      evidenceTier: "verified_public_bundle",
      userPromise: false,
    },
    {
      capability: "reopen_route",
      evidenceTier: "verified_public_bundle",
      userPromise: false,
    },
    {
      capability: "qr_route",
      evidenceTier: "verified_public_bundle",
      userPromise: false,
    },
    { capability: "download", evidenceTier: "unknown", userPromise: false },
    { capability: "print", evidenceTier: "unknown", userPromise: false },
    { capability: "scanability", evidenceTier: "unknown", userPromise: false },
  ];

const REVIEW_NOT_SUBMITTED_CODES = new Set([
  "signature_required",
  "family_gate",
  "companion_confirmation",
  "review_reached_not_submitted",
  "sea_manual_customs_forms",
  "sea_electronic_signature_required",
  "stopped_before_submit",
  "ph_etravel_stopped_before_submit",
  "phetravel_blocked",
]);

function hasNonEmptyValue(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export function hasPhEtravelAuthoritativePostSubmitReference(
  input: PhEtravelResultEvidence
): boolean {
  return (
    input.authoritativePostSubmitRead === true &&
    hasNonEmptyValue(input.authoritativeReferenceNumber)
  );
}

export function isPhEtravelDerivedQrReferenceConsistent(
  input: PhEtravelResultEvidence
): boolean {
  return (
    hasPhEtravelAuthoritativePostSubmitReference(input) &&
    input.derivedQrRenderStatus === "rendered" &&
    input.derivedQrReferenceValue?.trim() ===
      input.authoritativeReferenceNumber?.trim()
  );
}

export function isPhEtravelSubmittedCandidate(
  input: PhEtravelResultEvidence
): boolean {
  return (
    hasPhEtravelAuthoritativePostSubmitReference(input) &&
    isPhEtravelDerivedQrReferenceConsistent(input)
  );
}

function isReviewNotSubmitted(input: PhEtravelResultEvidence): boolean {
  const code = input.code?.trim().toLowerCase();
  const officialStatus = input.officialStatus?.trim().toLowerCase();
  return (
    input.reviewReached === true ||
    input.stoppedBeforeSubmit === true ||
    (code !== undefined && REVIEW_NOT_SUBMITTED_CODES.has(code)) ||
    (officialStatus !== undefined &&
      REVIEW_NOT_SUBMITTED_CODES.has(officialStatus))
  );
}

export function createPhEtravelResultRecoveryPresentation(
  input: PhEtravelResultEvidence
): PhEtravelResultRecoveryPresentation {
  const qrStatus = input.derivedQrRenderStatus ?? "unknown";
  const reasons: PhEtravelResultRecoveryReason[] = [];

  if (input.authoritativeReadFailed === true)
    reasons.push("authoritative_read_failed");
  if (input.reopenStateConsistent === false)
    reasons.push("reopen_state_mismatch");
  if (
    input.finalSubmitHttpStatus === 200 ||
    input.navigatedToPreparing === true ||
    input.summaryVisible === true ||
    input.submitVisible === true
  ) {
    reasons.push("http_200_or_navigation_only");
  }
  if (
    hasNonEmptyValue(input.localReferenceNumber) ||
    hasNonEmptyValue(input.localQrValue)
  ) {
    reasons.push("local_result_not_authoritative");
  }
  if (
    input.authoritativePostSubmitRead === true &&
    !hasNonEmptyValue(input.authoritativeReferenceNumber)
  ) {
    reasons.push("authoritative_reference_missing");
  }
  if (hasPhEtravelAuthoritativePostSubmitReference(input)) {
    if (qrStatus === "failed") reasons.push("derived_qr_render_failed");
    if (
      qrStatus === "rendered" &&
      input.derivedQrReferenceValue?.trim() !==
        input.authoritativeReferenceNumber?.trim()
    ) {
      reasons.push("derived_qr_reference_mismatch");
    }
  }

  if (isReviewNotSubmitted(input)) {
    return {
      state: "action_required",
      reasons,
      noResubmit: true,
      submitted: false,
      resultSource: "none",
      qr: {
        source: "client_rendered_from_reference",
        renderStatus: qrStatus,
        referenceConsistent: false,
      },
    };
  }

  if (isPhEtravelSubmittedCandidate(input)) {
    return {
      state: "submitted_candidate",
      reasons,
      noResubmit: true,
      submitted: false,
      resultSource: "authoritative_registration_read",
      qr: {
        source: "client_rendered_from_reference",
        renderStatus: qrStatus,
        referenceConsistent: true,
      },
    };
  }

  if (reasons.length > 0 || input.authoritativePostSubmitRead === true) {
    return {
      state: "recovery_required",
      reasons,
      noResubmit: true,
      submitted: false,
      resultSource: "none",
      qr: {
        source: "client_rendered_from_reference",
        renderStatus: qrStatus,
        referenceConsistent: false,
      },
    };
  }

  return {
    state: "action_required",
    reasons,
    noResubmit: true,
    submitted: false,
    resultSource: "none",
    qr: {
      source: "client_rendered_from_reference",
      renderStatus: qrStatus,
      referenceConsistent: false,
    },
  };
}

export function classifyPhEtravelResultState(
  input: PhEtravelResultEvidence
): PhEtravelResultState {
  return createPhEtravelResultRecoveryPresentation(input).state;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function readString(record: Record<string, unknown> | null, key: string): string | null {
  const value = record?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Stored PH results are untrusted until the runner records a post-submit
 * registration read. Legacy screenshots, status codes, navigation, and local
 * QR/reference values deliberately remain recovery-only evidence.
 */
export function createPhEtravelStoredResultRecoveryPresentation(
  storedResult: unknown,
): PhEtravelResultRecoveryPresentation {
  return createPhEtravelResultRecoveryPresentation(
    readPhEtravelStoredResultEvidence(storedResult),
  );
}

export function readPhEtravelStoredResultEvidence(
  storedResult: unknown,
): PhEtravelResultEvidence {
  const result = readRecord(storedResult);
  const resultEvidence = readRecord(result?.resultEvidence);
  const authoritativeRead = readRecord(resultEvidence?.authoritativeRead);
  const qrRender = readRecord(resultEvidence?.qrRender);
  const authoritative = readRecord(result?.authoritativeRegistration);
  const hasCurrentAuthoritativeRead =
    authoritativeRead?.postSubmitRead === true &&
    authoritativeRead?.stableReference === true;
  const currentQrRendered =
    qrRender?.rendered === true &&
    qrRender?.referenceValueValidated === true;

  return {
    authoritativePostSubmitRead:
      hasCurrentAuthoritativeRead || authoritative?.read === true,
    authoritativeReferenceNumber: hasCurrentAuthoritativeRead
      ? readString(authoritativeRead, "referenceNumber")
      : readString(authoritative, "referenceNumber"),
    authoritativeReadFailed:
      authoritativeRead?.readFailed === true || authoritative?.readFailed === true,
    derivedQrRenderStatus: qrRender
      ? currentQrRendered
        ? "rendered"
        : qrRender.rendered === false
          ? "failed"
          : "unknown"
      : readString(authoritative, "derivedQrRenderStatus") as PhEtravelDerivedQrRenderStatus | null,
    derivedQrReferenceValue: currentQrRendered
      ? readString(qrRender, "renderedForReference")
      : readString(authoritative, "derivedQrReferenceValue"),
    reopenStateConsistent:
      typeof authoritative?.reopenStateConsistent === "boolean"
        ? authoritative.reopenStateConsistent
        : null,
    finalSubmitHttpStatus:
      typeof result?.finalSubmitHttpStatus === "number" ? result.finalSubmitHttpStatus : null,
    navigatedToPreparing: result?.navigatedToPreparing === true,
    summaryVisible: result?.summaryVisible === true,
    submitVisible: result?.submitVisible === true,
    localReferenceNumber: readString(result, "referenceNumber"),
    localQrValue: readString(result, "localQrValue"),
    reviewReached: result?.reviewReached === true,
    stoppedBeforeSubmit: result?.stoppedBeforeSubmit === true,
    officialStatus: readString(result, "officialStatus"),
    code: readString(result, "code"),
  };
}
