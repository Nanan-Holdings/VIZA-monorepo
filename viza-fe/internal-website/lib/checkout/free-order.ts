import type { SupabaseClient } from "@supabase/supabase-js";
import { runPostPaidSideEffects } from "@/lib/checkout/post-paid";

/**
 * Complete a zero-total ("free demo") order without touching a payment
 * provider. Used by both guest checkout rails when `isFreePackage()` is
 * true (lib/pricing.ts): Stripe cannot process a 0-amount Checkout
 * session and a free flow has nothing to collect, so we mark the order
 * paid directly and run the same post-paid side-effects the payment
 * webhook would (account provisioning + magic-link mail + runner job —
 * all idempotent).
 */
export async function completeFreeOrder(
  admin: SupabaseClient,
  orderId: string,
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await admin
    .from("order")
    .update({ status: "paid", paid_at: now, updated_at: now })
    .eq("id", orderId);
  if (error) throw new Error(`free order paid update: ${error.message}`);

  runPostPaidSideEffects(orderId, "free");
}
