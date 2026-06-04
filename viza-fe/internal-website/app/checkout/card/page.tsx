import { redirect } from "next/navigation";
import { pricingFor } from "@/lib/pricing";
import { CardCheckoutForm } from "./_components/card-checkout-form";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    country?: string;
    visa?: string;
    locale?: string;
  }>;
}

/**
 * Unauthenticated landing for the guest card checkout (Stripe). The
 * marketing site links here with `?country=<code>&visa=<type>&locale=`.
 *
 * Server Component: validates the package has pricing, then hands a typed
 * prop bundle to the client form. No auth required — the visitor pays
 * first, then receives a magic-link email.
 */
export default async function CardCheckoutPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const country = params.country?.trim();
  const visa = params.visa?.trim();
  const locale = params.locale === "zh-CN" ? "zh-CN" : "en";

  if (!country || !visa) {
    redirect("/client/login");
  }

  const pricing = pricingFor(country, visa);
  if (!pricing) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6 py-12">
        <div className="max-w-md text-center space-y-3">
          <h1 className="text-xl font-medium text-fg-1">
            {locale === "zh-CN"
              ? "暂未支持该签证"
              : "This visa isn't available yet"}
          </h1>
          <p className="text-sm text-fg-2">
            {country} · {visa}
          </p>
        </div>
      </main>
    );
  }

  const passthroughGovt =
    pricing.govtFeeChannel === "viza_passthrough" ? pricing.govtFeeCents : 0;
  const amountCents = pricing.agencyFeeCents + passthroughGovt;

  return (
    <main className="min-h-screen bg-bg-1 flex items-center justify-center px-6 py-12">
      <CardCheckoutForm
        country={country}
        visaType={visa}
        locale={locale}
        amountCents={amountCents}
        currency={pricing.currency}
      />
    </main>
  );
}
