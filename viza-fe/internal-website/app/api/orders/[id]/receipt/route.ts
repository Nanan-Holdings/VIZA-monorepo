import { paymentRemovedResponse } from "@/app/api/payment-removed";

export const dynamic = "force-dynamic";

export function GET() {
  return paymentRemovedResponse();
}
