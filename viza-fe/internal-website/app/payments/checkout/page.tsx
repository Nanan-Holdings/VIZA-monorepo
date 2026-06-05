import { AirwallexCheckout } from "./airwallex-checkout";

interface PaymentCheckoutPageProps {
  searchParams?: Promise<{
    paymentId?: string | string[];
    productId?: string | string[];
    method?: string | string[];
    billing?: string | string[];
  }>;
}

function first(value: string | string[] | undefined): string | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export default async function PaymentCheckoutPage({ searchParams }: PaymentCheckoutPageProps) {
  const params = await searchParams;
  return (
    <AirwallexCheckout
      paymentId={first(params?.paymentId)}
      productId={first(params?.productId)}
      preferredMethod={first(params?.method)}
      billing={first(params?.billing)}
      backHref="/client/subscription"
    />
  );
}
