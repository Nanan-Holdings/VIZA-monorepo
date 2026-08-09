function normalizeCountry(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function normalizeVisaType(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase().replace(/[\s/-]+/g, "_");
}

export function isIndonesiaPaymentApplication(
  country: string | null | undefined,
  visaType: string | null | undefined,
): boolean {
  const normalizedCountry = normalizeCountry(country);
  return (
    normalizedCountry === "id" ||
    normalizedCountry === "indonesia" ||
    normalizeVisaType(visaType).startsWith("ID_")
  );
}

type VietnamPaymentCheckpointSignals = {
  status?: string | null;
  provider?: string | null;
  errorCode?: string | null;
  currentStage?: string | null;
  officialStatus?: string | null;
  paymentStatus?: string | null;
  payloadCheckpoint?: string | null;
  payloadActionType?: string | null;
  payloadStatus?: string | null;
};

function normalizeSignal(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function isVietnamPaymentCheckpointState({
  status,
  provider,
  errorCode,
  currentStage,
  officialStatus,
  paymentStatus,
  payloadCheckpoint,
  payloadActionType,
  payloadStatus,
}: VietnamPaymentCheckpointSignals): boolean {
  const normalizedStatus = normalizeSignal(status);
  const normalizedProvider = normalizeSignal(provider);
  const normalizedErrorCode = normalizeSignal(errorCode);
  const normalizedCurrentStage = normalizeSignal(currentStage);
  const normalizedOfficialStatus = normalizeSignal(officialStatus);
  const normalizedPaymentStatus = normalizeSignal(paymentStatus);
  const normalizedPayloadCheckpoint = normalizeSignal(payloadCheckpoint);
  const normalizedPayloadActionType = normalizeSignal(payloadActionType);
  const normalizedPayloadStatus = normalizeSignal(payloadStatus);

  if (
    normalizedStatus.startsWith("id_") ||
    normalizedProvider.startsWith("indonesia_")
  ) {
    return false;
  }

  const hasNonPaymentBlocker =
    normalizedPayloadActionType === "captcha_required" ||
    normalizedPayloadCheckpoint === "captcha_submitted_blocked" ||
    normalizedCurrentStage === "captcha_submitted_blocked" ||
    normalizedErrorCode === "captcha_required" ||
    normalizedErrorCode === "captcha_failed" ||
    normalizedPayloadStatus === "captcha_required" ||
    normalizedPayloadStatus === "captcha_failed" ||
    normalizedErrorCode === "review_action_disabled";
  if (hasNonPaymentBlocker) return false;

  const isVietnamQueue =
    normalizedStatus.startsWith("vn_") || normalizedProvider === "vietnam_evisa_live";
  if (!isVietnamQueue) return false;

  // Preserve the legacy payload contract, which predates the VN-specific
  // payment-resume fields but still carries a VN queue identity.
  if (
    normalizedPayloadCheckpoint === "payment_page_visible" ||
    normalizedPayloadActionType === "payment_required"
  ) {
    return true;
  }

  return (
    normalizedErrorCode === "manual_payment_required" ||
    normalizedCurrentStage === "official_fee_manual_review" ||
    normalizedOfficialStatus === "registration_code_captured_payment_pending" ||
    normalizedPaymentStatus === "manual_review" ||
    normalizedPaymentStatus === "payment_manual_review" ||
    normalizedPayloadStatus === "payment_manual_review" ||
    (normalizedStatus === "vn_blocked" &&
      normalizedOfficialStatus === "payment_authorized")
  );
}

export function resolveVietnamSubmissionActionType(
  isPaymentCheckpoint: boolean,
  payloadActionType: string | null | undefined,
): string {
  if (isPaymentCheckpoint) return "payment_required";
  return payloadActionType?.trim() || "captcha_required";
}
