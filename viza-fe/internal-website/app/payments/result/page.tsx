import { PaymentResult } from "./payment-result";

interface PaymentResultPageProps {
  searchParams?: Promise<{ paymentId?: string | string[] }>;
}

export default async function PaymentResultPage({ searchParams }: PaymentResultPageProps) {
  const params = await searchParams;
  const value = params?.paymentId;
  const paymentId = Array.isArray(value) ? value[0] ?? null : value ?? null;
  return <PaymentResult paymentId={paymentId} />;
}
