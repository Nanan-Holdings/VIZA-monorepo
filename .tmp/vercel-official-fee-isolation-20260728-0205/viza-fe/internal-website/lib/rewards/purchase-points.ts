import { createAdminClient } from "@/lib/supabase/admin";

const POINTS_PER_MAJOR_UNIT = 1;

export interface PurchasePointsInput {
  paymentRecordId: string;
  applicantId?: string | null;
  userId?: string | null;
  amountCents: number;
  currency: string;
  provider: string;
}

async function resolveUserId(input: PurchasePointsInput): Promise<string | null> {
  if (input.userId) return input.userId;
  if (!input.applicantId) return null;

  const { data } = await createAdminClient()
    .from("applicant_profiles")
    .select("auth_user_id")
    .eq("id", input.applicantId)
    .maybeSingle();

  return data?.auth_user_id ?? null;
}

async function ensureRewardWallet(userId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data: existingWallet } = await admin
    .from("reward_wallets")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existingWallet?.id) return existingWallet.id;

  const { data: createdWallet, error } = await admin
    .from("reward_wallets")
    .insert({ user_id: userId })
    .select("id")
    .single();

  if (error) {
    const { data: retryWallet } = await admin
      .from("reward_wallets")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    return retryWallet?.id ?? null;
  }

  return createdWallet?.id ?? null;
}

export function calculatePurchasePoints(amountCents: number): number {
  if (!Number.isFinite(amountCents) || amountCents <= 0) return 0;
  return Math.floor(amountCents / 100) * POINTS_PER_MAJOR_UNIT;
}

export async function awardPurchasePointsForPayment(input: PurchasePointsInput): Promise<number> {
  const points = calculatePurchasePoints(input.amountCents);
  if (points <= 0) return 0;

  const userId = await resolveUserId(input);
  if (!userId) return 0;

  const walletId = await ensureRewardWallet(userId);
  if (!walletId) return 0;

  const admin = createAdminClient();
  const { data: existingTransaction } = await admin
    .from("reward_transactions")
    .select("id")
    .eq("wallet_id", walletId)
    .eq("source", "purchase")
    .eq("reference_type", "payment_record")
    .eq("reference_id", input.paymentRecordId)
    .maybeSingle();

  if (existingTransaction?.id) return 0;

  const { error } = await admin.from("reward_transactions").insert({
    wallet_id: walletId,
    amount: points,
    type: "earned",
    source: "purchase",
    reason: "Confirmed VIZA payment reward",
    reference_type: "payment_record",
    reference_id: input.paymentRecordId,
    meta: {
      amount_cents: input.amountCents,
      currency: input.currency,
      provider: input.provider,
      rule: "100 points per RMB 100 confirmed spend",
    },
  });

  return error ? 0 : points;
}
