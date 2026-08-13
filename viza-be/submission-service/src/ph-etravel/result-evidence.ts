export interface PhEtravelAuthoritativeRegistrationRead {
  source: "official_registration_result_read";
  postSubmitRead: true;
  referenceNumber: string;
  stableReference: true;
}

export interface PhEtravelDerivedQrRenderMetadata {
  renderer: "official_client_reference_qr";
  renderedForReference: string;
  rendered: true;
  referenceValueValidated: true;
}

export type PhEtravelFinalPostObservation =
  | "http_200_navigation"
  | "network_interrupted"
  | "post_response_unreadable"
  | "authoritative_read_failed";

export type PhEtravelAuthoritativeResultGate =
  | {
    status: "recoverable_submitted_candidate";
    officialReference: string;
    qrRender: PhEtravelDerivedQrRenderMetadata;
  }
  | { status: "recovery_required"; code: string; officialResubmitAllowed: false };

function safeReference(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return /^[a-z0-9][a-z0-9._-]*$/i.test(normalized) && normalized.length <= 160
    ? normalized
    : null;
}

/**
 * E16 proves that the official result route renders its QR from a fetched
 * registration reference. It does not prove a separately issued QR artifact
 * or a successful final POST response body.
 */
export function gatePhEtravelAuthoritativeResult(input: {
  authoritativeRead?: PhEtravelAuthoritativeRegistrationRead | null;
  qrRender?: PhEtravelDerivedQrRenderMetadata | null;
  finalPostObservation?: PhEtravelFinalPostObservation | null;
}): PhEtravelAuthoritativeResultGate {
  const reference = safeReference(input.authoritativeRead?.referenceNumber);
  if (
    input.authoritativeRead?.source === "official_registration_result_read" &&
    input.authoritativeRead.postSubmitRead === true &&
    input.authoritativeRead.stableReference === true &&
    reference &&
    input.qrRender?.renderer === "official_client_reference_qr" &&
    input.qrRender.rendered === true &&
    input.qrRender.referenceValueValidated === true &&
    input.qrRender.renderedForReference === reference
  ) {
    return {
      status: "recoverable_submitted_candidate",
      officialReference: reference,
      qrRender: input.qrRender,
    };
  }

  const code = input.finalPostObservation === "http_200_navigation"
    ? "ph_etravel_final_post_http_200_unverified"
    : input.finalPostObservation === "network_interrupted" || input.finalPostObservation === "post_response_unreadable"
      ? "ph_etravel_final_post_ambiguous_recovery_required"
      : "ph_etravel_authoritative_result_read_required";
  return { status: "recovery_required", code, officialResubmitAllowed: false };
}
