import type {
  PhEtravelPresentationTransport,
  PhEtravelSeaFlow,
} from "./presentation";

export const PH_ETRAVEL_ATTACHMENT_ACCEPTED_MIME_TYPES = [
  "image/png",
  "image/jpg",
  "image/jpeg",
] as const;

export const PH_ETRAVEL_ATTACHMENT_MAX_FILE_BYTES = 5_242_880;

export type PhEtravelAttachmentPresentation = {
  visible: boolean;
  stateKey: "attachments";
  control: "multi_file";
  acceptedMimeTypes: readonly string[];
  maxFileBytes: number;
  multiple: true;
  clientHint: string;
  countRule: "unknown";
  aggregateSizeRule: "unknown";
  liveRequiredness: "unknown";
  serverRules: "official_review_required";
  applicantFieldMode: "official_boundary_notice";
};

export type PhEtravelAttachmentCheck =
  | { accepted: true; code: "accepted" }
  | { accepted: false; code: "unsupported_mime_type" | "file_too_large" };

export function createPhEtravelAttachmentPresentation(input: {
  transportType: PhEtravelPresentationTransport;
  seaFlow?: PhEtravelSeaFlow;
  customsDeclaration?: "yes" | "no" | null;
}): PhEtravelAttachmentPresentation {
  const visible =
    input.customsDeclaration === "yes" &&
    (input.transportType === "AIR" || input.seaFlow === "electronic_customs");

  return {
    visible,
    stateKey: "attachments",
    control: "multi_file",
    acceptedMimeTypes: PH_ETRAVEL_ATTACHMENT_ACCEPTED_MIME_TYPES,
    maxFileBytes: PH_ETRAVEL_ATTACHMENT_MAX_FILE_BYTES,
    multiple: true,
    clientHint:
      "PNG, JPG, or JPEG; 5.00 MB per file. Attachment count, live requiredness, and server rules are not verified.",
    countRule: "unknown",
    aggregateSizeRule: "unknown",
    liveRequiredness: "unknown",
    serverRules: "official_review_required",
    applicantFieldMode: "official_boundary_notice",
  };
}

export function validatePhEtravelAttachmentClientHint(input: {
  mimeType: string;
  sizeBytes: number;
}): PhEtravelAttachmentCheck {
  if (
    !PH_ETRAVEL_ATTACHMENT_ACCEPTED_MIME_TYPES.includes(input.mimeType as never)
  ) {
    return { accepted: false, code: "unsupported_mime_type" };
  }
  if (input.sizeBytes > PH_ETRAVEL_ATTACHMENT_MAX_FILE_BYTES) {
    return { accepted: false, code: "file_too_large" };
  }
  return { accepted: true, code: "accepted" };
}
