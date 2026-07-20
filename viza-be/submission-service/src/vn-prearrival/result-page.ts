export function isVietnamPrearrivalSuccessPage(bodyText: string): boolean {
  return /\byour submission is successful\b|\bsubmission is successful\b/i.test(bodyText);
}

export function hasVietnamPrearrivalSuccessEvidence(input: {
  successHeadingVisible: boolean;
  confirmationNumber?: string | null;
  qrCaptured: boolean;
  pdfCaptured: boolean;
}): boolean {
  return input.successHeadingVisible && input.qrCaptured;
}

export function extractVietnamPrearrivalConfirmationNumber(bodyText: string): string | null {
  const candidates = bodyText.match(/\b(?:DE|VN|PAI|QR)[A-Z0-9-]{6,}\b/gi) ?? [];
  return candidates.find((candidate) => /\d/.test(candidate)) ?? null;
}
