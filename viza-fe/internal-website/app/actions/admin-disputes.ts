"use server";

import { paymentRemovedError } from "./payment-removed";

/** Stripe dispute synchronization is retired. */
export async function syncAdminDispute(_formData: FormData): Promise<void> {
  throw paymentRemovedError("syncAdminDispute");
}

/** Stripe dispute evidence upload/submission is retired. */
export async function handleAdminDisputeEvidence(
  _formData: FormData,
): Promise<void> {
  throw paymentRemovedError("handleAdminDisputeEvidence");
}
