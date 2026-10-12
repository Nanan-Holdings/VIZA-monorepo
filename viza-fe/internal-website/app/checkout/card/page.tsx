import Image from "next/image";
import { redirect } from "next/navigation";
import { readCheckoutHandoff } from "@/lib/checkout/handoff";
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
 * marketing site links here with `?country=<code>&visa=<type>&locale=`
 * Sensitive wizard state arrives in a short-lived encrypted HttpOnly cookie
 * created by the POST handoff route, never in the URL.
 *
 * Server Component: validates the package has pricing, then hands a typed
 * prop bundle to the client form. No auth required — the visitor pays
 * first, then receives a magic-link email.
 */
export default async function CardCheckoutPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const handoff = await readCheckoutHandoff("card");
  const country = handoff?.country ?? params.country?.trim();
  const visa = handoff?.visaType ?? params.visa?.trim();
  const locale = handoff?.locale ?? (params.locale === "zh-CN" ? "zh-CN" : "en");
  const initialEmail = handoff?.email ?? "";
  const initialName = handoff?.fullName ?? "";
  const prefill = handoff?.prefill ?? "";
  const betaLinkToken = handoff?.betaToken ?? "";

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
        betaLinkToken={betaLinkToken}
      />
    </main>
  );
}
