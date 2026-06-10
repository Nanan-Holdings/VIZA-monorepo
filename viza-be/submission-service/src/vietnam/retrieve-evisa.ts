import { waitForVnRegistrationEmail } from "./inbox.js";
import { VN_GOVT_PAYMENT_MECHANISM } from "./govt-payment.js";
import { storeEvisaArtifact } from "../runners/evisa-artifact.js";

/**
 * Vietnam e-Visa retrieval + storage (RUN-VN-002).
 *
 * Status flow (matches index.ts VN statuses):
 *   vn_prefill_pending → vn_prefill_processing
 *     → fillVietnamApplication fills + advances to the pre-pay review and
 *       HALTS before government payment (run.ts never clicks Pay; the runner
 *       result is `submitted_pending_pay`). Per payment-routing the Vietnam
 *       fee is `runner_escrow_card` (VIZA collects) — govt-payment.ts
 *       (loadEscrowCard / recordPortalReceipt) backs that escrow path once
 *       in-portal escrow payment is integrated; until then we deliberately
 *       halt (VN_GOVT_PAYMENT_MECHANISM documents the intended mechanism).
 *   [payment completes out of band] → portal emails the e-visa
 *     → retrieveAndStoreVnEvisa polls inbox.ts for the registration email,
 *       downloads the e-visa result PDF, and stores it via artifact-storage.
 */

export interface VnEvisaArtifact {
  storagePath: string | null;
  registrationCode: string;
  resultLink: string | null;
}

export interface RetrieveVnEvisaInput {
  applicantId: string;
  applicationId: string;
  /** Auth user id used for the artifact storage path. */
  authUserId: string;
  timeoutMs?: number;
}

export async function retrieveAndStoreVnEvisa(
  input: RetrieveVnEvisaInput,
): Promise<VnEvisaArtifact> {
  // Documented for ops: the live fill halts before this mechanism's payment.
  void VN_GOVT_PAYMENT_MECHANISM;

  const email = await waitForVnRegistrationEmail(input.applicantId, input.timeoutMs ?? 60_000);

  let storagePath: string | null = null;
  if (email.resultLink) {
    const res = await fetch(email.resultLink);
    if (res.ok) {
      const data = Buffer.from(await res.arrayBuffer());
      storagePath = await storeEvisaArtifact({
        applicationId: input.applicationId,
        jobId: input.authUserId,
        country: "VN",
        data,
      });
    } else {
      console.warn(`[vn-evisa] result link fetch failed: ${res.status}`);
    }
  }

  return {
    storagePath,
    registrationCode: email.registrationCode,
    resultLink: email.resultLink,
  };
}
