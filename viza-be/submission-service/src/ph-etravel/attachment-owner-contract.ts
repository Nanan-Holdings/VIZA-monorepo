import type { PhEtravelCurrencyParty } from "./normalize";

/**
 * E14 proves only the public widget's per-file client hint. This contract is
 * intentionally metadata-only: it cannot upload a file or expose its path.
 */
export const PH_ETRAVEL_ATTACHMENT_ALLOWED_MIME_TYPES = [
  "image/png",
  "image/jpg",
  "image/jpeg",
] as const;

export const PH_ETRAVEL_ATTACHMENT_MAX_BYTES = 5_242_880;

export interface PhEtravelAttachmentCandidate {
  mimeType: string;
  sizeBytes: number;
}

export interface PhEtravelAttachmentActionContract {
  actions: [];
  actionRequired: true;
  blockingCodes: string[];
}

export function buildPhEtravelAttachmentActionContract(
  attachments: readonly PhEtravelAttachmentCandidate[] | null | undefined,
): PhEtravelAttachmentActionContract {
  const blockingCodes: string[] = [];
  if (!attachments || attachments.length === 0) {
    // The public bundle does not prove that an attachment is required here.
    blockingCodes.push("attachment_requiredness_unverified", "attachment_metadata_not_provided");
  } else {
    for (const attachment of attachments) {
      if (!PH_ETRAVEL_ATTACHMENT_ALLOWED_MIME_TYPES.includes(
        attachment.mimeType as typeof PH_ETRAVEL_ATTACHMENT_ALLOWED_MIME_TYPES[number],
      )) {
        blockingCodes.push("attachment_mime_not_allowed");
      }
      if (!Number.isFinite(attachment.sizeBytes) || attachment.sizeBytes < 0 || attachment.sizeBytes > PH_ETRAVEL_ATTACHMENT_MAX_BYTES) {
        blockingCodes.push("attachment_file_size_not_allowed");
      }
    }
    // E14 did not establish a count/aggregate/server rule, so a locally valid
    // list still cannot be uploaded or treated as portal-ready.
    blockingCodes.push("attachment_count_unverified", "attachment_server_rules_unverified");
  }
  return { actions: [], actionRequired: true, blockingCodes: [...new Set(blockingCodes)] };
}

export interface PhEtravelCurrencyOwnerBranch {
  ownerNotApplicable: boolean;
  owner: PhEtravelCurrencyParty | null;
  recipient: PhEtravelCurrencyParty | null;
  blockingCodes: string[];
}

/**
 * Owner N/A is a Formik boolean, not a stable DOM control. When it is true,
 * E14 proves the official client clears/disables both party field groups.
 */
export function normalizePhEtravelCurrencyOwnerBranch(input: {
  ownerNotApplicable: boolean;
  owner: PhEtravelCurrencyParty | null;
  recipient: PhEtravelCurrencyParty | null;
}): PhEtravelCurrencyOwnerBranch {
  if (input.ownerNotApplicable) {
    return {
      ownerNotApplicable: true,
      owner: null,
      recipient: null,
      blockingCodes: ["owner_na_stable_selector_unverified"],
    };
  }
  return {
    ownerNotApplicable: false,
    owner: input.owner,
    recipient: input.recipient,
    blockingCodes: ["owner_recipient_requiredness_unverified"],
  };
}
