import { paymentRemovedResponse } from "@/app/api/payment-removed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  return paymentRemovedResponse();
}
