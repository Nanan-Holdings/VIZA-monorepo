import Image from "next/image";
import { redirect } from "next/navigation";
import { pricingFor } from "@/lib/pricing";
import { CardCheckoutForm } from "./_components/card-checkout-form";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    country?: string;
    visa?: string;
    locale?: string;
    email?: string;
    name?: string;
    prefill?: string;
  }>;
}

/**
 * Unauthenticated landing for the guest card checkout (Stripe). The
 * marketing site links here with `?country=<code>&visa=<type>&locale=`
 * plus optional `email` / `name` prefill collected by the /apply wizard.
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
  const initialEmail = params.email?.trim() ?? "";
  const initialName = params.name?.trim() ?? "";
  const prefill = params.prefill?.trim() ?? "";

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
    <main className="min-h-screen bg-gradient-to-b from-brand-50 to-white flex flex-col items-center px-6 py-10">
      <div className="w-full max-w-md">
        <Image src="/logo/viza-logo-blue.svg" alt="VIZA" width={80} height={24} priority />
      </div>
      <CardCheckoutForm
        country={country}
        visaType={visa}
        locale={locale}
        amountCents={amountCents}
        currency={pricing.currency}
        initialEmail={initialEmail}
        initialName={initialName}
        prefill={prefill}
      />
    </main>
  );
}
