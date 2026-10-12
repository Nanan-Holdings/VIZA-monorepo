"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { paymentRemovedError } from "./payment-removed";

/**
 * Result shape retained for the retired provisioning worker contract.
 */
export interface ProvisionedAccount {
  authUserId: string;
  applicantId: string;
  applicationId: string;
  country: string;
  visaType: string;
}

/**
 * Account provisioning and magic-link delivery were post-payment side
 * effects. Keep the export while old worker callers are being removed, but
 * fail before reading or mutating Supabase Auth or applicant records.
 */
export async function provisionAccountAndMagicLink(
  _orderId: string,
): Promise<ProvisionedAccount> {
  throw paymentRemovedError("provisionAccountAndMagicLink");
}

export async function ensureAccountAndMagicLinkWithAdmin(
  _admin: SupabaseClient,
  _orderId: string,
): Promise<ProvisionedAccount> {
  throw paymentRemovedError("ensureAccountAndMagicLinkWithAdmin");
}
