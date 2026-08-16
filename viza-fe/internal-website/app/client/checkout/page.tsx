import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { startStripeCheckout } from "./actions";
import { CheckoutSubmitButton } from "./submit-button";
import {
  type CheckoutPackageSummary,
  type CheckoutReturnState,
  formatMoney,
  getCheckoutContext,
  reconcileStripeCheckoutSession,
} from "./data";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ClientErrorAlert } from "@/components/client/client-error-alert";
import { Button } from "@/components/ui/button";
import { ApplicationFormPanel } from "@/components/ui/application-form-panel";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Checkout | VIZA",
  description: "Pay the VIZA agency fee through Stripe Checkout.",
};

type CheckoutSearchParams = {
  applicationId?: string | string[];
  error?: string | string[];
  packageId?: string | string[];
  session_id?: string | string[];
  status?: string | string[];
};

interface CheckoutPageProps {
  searchParams?: Promise<CheckoutSearchParams>;
}

function getParam(params: CheckoutSearchParams | undefined, key: keyof CheckoutSearchParams): string | null {
  const value = params?.[key];
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function getErrorReturnState(error: string | null): CheckoutReturnState {
  if (!error) return null;

  const messages: Record<string, CheckoutReturnState> = {
    checkout_unavailable: {
      tone: "error",
      title: "Checkout is temporarily unavailable",
      description: "Stripe Checkout could not be opened. Please try again or contact support.",
    },
    missing_package: {
      tone: "error",
      title: "Choose a visa package first",
      description: "We need an active package before starting agency-fee payment.",
    },
    package_not_found: {
      tone: "error",
      title: "Package not found",
      description: "This package is not active on your account. Please choose another package.",
    },
    payment_record_failed: {
      tone: "error",
      title: "Payment record was not created",
      description: "VIZA did not start Stripe Checkout because the payment record could not be prepared.",
    },
    pricing_missing: {
      tone: "warning",
      title: "Agency fee is not configured",
      description: "This package needs a VIZA agency fee before Stripe Checkout can be started.",
    },
    stripe_unconfigured: {
      tone: "warning",
      title: "Stripe Checkout is not configured",
      description: "Production payment requires STRIPE_SECRET_KEY (sk_...), STRIPE_WEBHOOK_SECRET, and an app URL. No card details are collected here.",
    },
  };

  return (
    messages[error] ?? {
      tone: "error",
      title: "Checkout needs attention",
      description: "Something interrupted checkout. Please try again or contact support.",
    }
  );
}

async function getReturnState(params: CheckoutSearchParams | undefined): Promise<CheckoutReturnState> {
  const status = getParam(params, "status");
  if (status === "success") {
    return reconcileStripeCheckoutSession(getParam(params, "session_id"));
  }

  if (status === "cancelled") {
    return {
      tone: "warning",
      title: "Stripe Checkout was cancelled",
      description: "No VIZA agency fee was recorded. You can review the package and restart Stripe Checkout.",
    };
  }

  return getErrorReturnState(getParam(params, "error"));
}

function ReturnStateAlert({ state }: { state: CheckoutReturnState }) {
  if (!state) return null;

  return (
    <Alert
      variant={state.tone === "success" ? "success" : state.tone === "warning" ? "warning" : "destructive"}
      className="shadow-sm"
    >
      <AlertTitle>{state.title}</AlertTitle>
      <AlertDescription>{state.description}</AlertDescription>
    </Alert>
  );
}

function DetailRow({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b py-3 last:border-b-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={cn("text-right text-sm font-medium", muted && "text-muted-foreground")}>{value}</span>
    </div>
  );
}

function EmptyCheckoutState() {
  return (
    <ApplicationFormPanel className="flex min-h-[320px] flex-col items-center justify-center p-6 text-center">
      <h2 className="text-xl font-semibold text-foreground">No active package ready for checkout</h2>
      <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
        Select a destination or ask the VIZA team to assign a package before starting agency-fee payment.
      </p>
      <Button asChild className="mt-6 h-11 rounded-full bg-brand-500 px-5 hover:bg-brand-600">
        <Link href="/client/application">Choose a visa route</Link>
      </Button>
    </ApplicationFormPanel>
  );
}

function CheckoutContent({
  selectedPackage,
  stripeConfigured,
  returnState,
}: {
  selectedPackage: CheckoutPackageSummary;
  stripeConfigured: boolean;
  returnState: CheckoutReturnState;
}) {
  const canStartPayment = Boolean(selectedPackage.agencyFee) && stripeConfigured && !selectedPackage.isPaid;
  const agencyFeeLabel = selectedPackage.agencyFee?.label ?? "Not configured";
  const paidAt = selectedPackage.latestPayment?.updated_at ?? selectedPackage.latestPayment?.created_at ?? null;

  return (
    <div className="space-y-6">
      <ReturnStateAlert state={returnState} />

      {!stripeConfigured ? (
        <Alert className="border-amber-200 bg-amber-50 text-amber-950">
          <AlertTitle>Stripe Checkout needs configuration</AlertTitle>
          <AlertDescription>
            The page is safe to review, but payment is disabled until Stripe environment variables are configured.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)]">
        <div className="space-y-6">
          <ApplicationFormPanel className="p-5 sm:p-6">
            <div>
              <h2 className="text-xl font-semibold text-foreground sm:text-2xl">
                {selectedPackage.packageName}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {selectedPackage.countryName} · {selectedPackage.visaTypeLabel}
              </p>
            </div>
            <div className="mt-5 space-y-5">
              {selectedPackage.description ? (
                <p className="leading-7 text-muted-foreground">{selectedPackage.description}</p>
              ) : (
                <p className="leading-7 text-muted-foreground">
                  Confirm this package before starting Stripe Checkout for the VIZA agency fee.
                </p>
              )}

              <div className="grid border-y sm:grid-cols-3 sm:divide-x">
                <div className="py-4 sm:pr-4">
                  <p className="text-xs font-medium uppercase text-muted-foreground">Agency fee</p>
                  <p className="mt-2 text-xl font-semibold text-foreground">{agencyFeeLabel}</p>
                </div>
                <div className="border-t py-4 sm:border-t-0 sm:px-4">
                  <p className="text-xs font-medium uppercase text-muted-foreground">Application</p>
                  <p className="mt-2 text-sm font-medium capitalize text-foreground">
                    {selectedPackage.applicationStatus?.replace(/_/g, " ") ?? "Not started"}
                  </p>
                </div>
                <div className="border-t py-4 sm:border-t-0 sm:pl-4">
                  <p className="text-xs font-medium uppercase text-muted-foreground">Payment</p>
                  <p className="mt-2 text-sm font-medium capitalize text-foreground">
                    {selectedPackage.isPaid ? "Paid" : selectedPackage.latestPayment?.status ?? "Not paid"}
                  </p>
                </div>
              </div>
            </div>
          </ApplicationFormPanel>

          <ApplicationFormPanel className="p-5 sm:p-6">
            <div>
              <h2 className="text-base font-semibold text-foreground">Official fee payment</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                VIZA pays the official portal on your behalf with a secure virtual card created for this application.
              </p>
            </div>
            <div className="mt-5 space-y-4">
              <div className="border-y py-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">{selectedPackage.governmentFee.label}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {selectedPackage.governmentFee.description}
                    </p>
                  </div>
                  <p className="text-right text-sm font-semibold text-foreground">
                    {selectedPackage.governmentFee.amountLabel}
                  </p>
                </div>
              </div>
              <p className="leading-7 text-muted-foreground">{selectedPackage.governmentFee.detail}</p>
              <div className="rounded-lg bg-brand-50 p-4 text-sm leading-6 text-brand-900">
                You will never need to enter card details on the government portal. When the official fee is due,
                VIZA creates a limited virtual card for this application, pays the portal, and records the result.
              </div>
            </div>
          </ApplicationFormPanel>
        </div>

        <aside className="space-y-6">
          <ApplicationFormPanel className="p-5 sm:p-6">
            <h2 className="text-base font-semibold text-foreground">Order summary</h2>
            <div className="mt-5 space-y-5">
              <div>
                <DetailRow label="Package" value={selectedPackage.packageName} />
                <DetailRow label="Destination" value={selectedPackage.countryName} />
                <DetailRow label="Visa type" value={selectedPackage.visaTypeLabel} />
                <DetailRow label="VIZA agency fee" value={agencyFeeLabel} />
                <DetailRow label="Official fee" value="Paid by VIZA with a virtual card" muted />
              </div>

              <div className="rounded-lg bg-muted/40 p-4">
                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-sm font-medium text-muted-foreground">Due today</span>
                  <span className="text-2xl font-semibold text-foreground">
                    {selectedPackage.agencyFee
                      ? formatMoney(selectedPackage.agencyFee.cents, selectedPackage.agencyFee.currency)
                      : "Unavailable"}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Paid through Stripe-hosted Checkout for VIZA's agency fee only.
                </p>
              </div>

              {selectedPackage.isPaid ? (
                <div className="space-y-4">
                  <Alert className="border-emerald-200 bg-emerald-50 text-emerald-950">
                    <AlertTitle>Agency fee recorded</AlertTitle>
                    <AlertDescription>
                      {paidAt ? `Latest confirmation: ${new Date(paidAt).toLocaleString()}` : "Payment is on file."}
                    </AlertDescription>
                  </Alert>
                  <Button asChild className="h-12 w-full rounded-full bg-brand-500 hover:bg-brand-600">
                    <a href={selectedPackage.nextStep.href}>{selectedPackage.nextStep.label}</a>
                  </Button>
                  <p className="text-sm leading-6 text-muted-foreground">{selectedPackage.nextStep.description}</p>
                </div>
              ) : (
                <form action={startStripeCheckout} className="space-y-4">
                  <input type="hidden" name="packageId" value={selectedPackage.packageId} />
                  {selectedPackage.applicationId ? (
                    <input type="hidden" name="applicationId" value={selectedPackage.applicationId} />
                  ) : null}
                  <CheckoutSubmitButton disabled={!canStartPayment}>Pay agency fee with Stripe</CheckoutSubmitButton>
                  {!selectedPackage.agencyFee ? (
                    <p className="text-sm leading-6 text-muted-foreground">
                      Checkout is disabled because this package does not have an agency fee configured.
                    </p>
                  ) : (
                    <p className="text-sm leading-6 text-muted-foreground">
                      You will enter card details only on Stripe's hosted checkout page.
                    </p>
                  )}
                </form>
              )}
            </div>
          </ApplicationFormPanel>

          <ApplicationFormPanel className="p-5 sm:p-6">
            <h2 className="text-base font-semibold text-foreground">After payment</h2>
            <div className="mt-4 space-y-4 text-sm leading-6 text-muted-foreground">
              <p>{selectedPackage.nextStep.description}</p>
              <p>
                When an official portal fee becomes due, VIZA will create an application-specific virtual card and pay
                it on your behalf. No government-portal card entry is required from you.
              </p>
            </div>
          </ApplicationFormPanel>
        </aside>
      </div>
    </div>
  );
}

export default async function CheckoutPage({ searchParams }: CheckoutPageProps) {
  const params = await searchParams;
  const returnState = await getReturnState(params);
  const context = await getCheckoutContext({
    packageId: getParam(params, "packageId"),
    applicationId: getParam(params, "applicationId"),
  });

  if (!context.user) {
    redirect("/client/login");
  }

  return (
    <div className="mx-auto max-w-[1090px] space-y-8 pb-16">
      <header className="space-y-3">
        <div className="max-w-3xl space-y-3">
          <h1 className="text-3xl font-semibold text-foreground md:text-4xl">Checkout</h1>
          <p className="text-base leading-7 text-muted-foreground">
            Confirm the visa application selected on your Home page and pay VIZA's agency fee through Stripe Checkout.
            When the official fee is due, VIZA creates a secure virtual card and pays the government portal for you.
          </p>
        </div>
      </header>

      {context.error ? (
        <ClientErrorAlert message={context.error} title="Checkout could not load" />
      ) : null}

      {context.selectedPackage ? (
        <CheckoutContent
          selectedPackage={context.selectedPackage}
          stripeConfigured={context.stripeConfigured}
          returnState={returnState}
        />
      ) : (
        <div className="space-y-6">
          <ReturnStateAlert state={returnState} />
          <EmptyCheckoutState />
        </div>
      )}
    </div>
  );
}
