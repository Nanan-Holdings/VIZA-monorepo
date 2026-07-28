import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  CreditCard,
  FileText,
  Landmark,
  PackageCheck,
  ReceiptText,
  ShieldCheck,
  XCircle,
} from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
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

  const Icon =
    state.tone === "success" ? CheckCircle2 : state.tone === "warning" ? AlertCircle : XCircle;

  return (
    <Alert
      className={cn(
        "shadow-sm",
        state.tone === "success" && "border-emerald-200 bg-emerald-50 text-emerald-950",
        state.tone === "warning" && "border-amber-200 bg-amber-50 text-amber-950",
        state.tone === "error" && "border-destructive/30 bg-destructive/5 text-destructive",
      )}
    >
      <Icon className="h-4 w-4" />
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

function PackageSwitcher({
  packages,
  selectedPackage,
}: {
  packages: CheckoutPackageSummary[];
  selectedPackage: CheckoutPackageSummary;
}) {
  if (packages.length <= 1) return null;

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Active packages</h2>
        <p className="text-sm text-muted-foreground">
          Choose which visa package you want to pay the VIZA agency fee for.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {packages.map((packageSummary) => {
          const isSelected = packageSummary.packageId === selectedPackage.packageId;
          return (
            <Link
              key={packageSummary.assignmentId}
              href={`/client/checkout?packageId=${packageSummary.packageId}`}
              className={cn(
                "rounded-lg border bg-white p-4 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40",
                isSelected ? "border-brand-500 bg-brand-50" : "hover:border-brand-200",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{packageSummary.packageName}</p>
                  <p className="text-sm text-muted-foreground">
                    {packageSummary.countryName} · {packageSummary.visaTypeLabel}
                  </p>
                </div>
                {isSelected ? <Badge className="bg-brand-500">Selected</Badge> : null}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function GovernmentFeeBadge({ mode }: { mode: CheckoutPackageSummary["governmentFee"]["mode"] }) {
  const label =
    mode === "estimated"
      ? "Estimated"
      : mode === "unknown"
        ? "Unknown"
        : mode === "included"
          ? "Package note"
          : "Separate";

  return (
    <Badge variant="outline" className="border-brand-200 text-brand-500">
      {label}
    </Badge>
  );
}

function EmptyCheckoutState() {
  return (
    <Empty className="min-h-[420px] border bg-white shadow-sm">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <PackageCheck className="h-6 w-6" />
        </EmptyMedia>
        <EmptyTitle>No active package ready for checkout</EmptyTitle>
        <EmptyDescription>
          Select a destination or ask the VIZA team to assign a package before starting agency-fee payment.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild className="h-11 rounded-full bg-brand-500 px-5 hover:bg-brand-600">
          <Link href="/client/application">
            Choose a visa route
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </EmptyContent>
    </Empty>
  );
}

function CheckoutContent({
  selectedPackage,
  packages,
  stripeConfigured,
  returnState,
}: {
  selectedPackage: CheckoutPackageSummary;
  packages: CheckoutPackageSummary[];
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
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Stripe Checkout needs configuration</AlertTitle>
          <AlertDescription>
            The page is safe to review, but payment is disabled until Stripe environment variables are configured.
          </AlertDescription>
        </Alert>
      ) : null}

      <PackageSwitcher packages={packages} selectedPackage={selectedPackage} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader className="gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-50 text-brand-500">
                <PackageCheck className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-2xl">{selectedPackage.packageName}</CardTitle>
                <p className="mt-2 text-sm text-muted-foreground">
                  {selectedPackage.countryName} · {selectedPackage.visaTypeLabel}
                </p>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {selectedPackage.description ? (
                <p className="leading-7 text-muted-foreground">{selectedPackage.description}</p>
              ) : (
                <p className="leading-7 text-muted-foreground">
                  Confirm this package before starting Stripe Checkout for the VIZA agency fee.
                </p>
              )}

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border bg-muted/30 p-4">
                  <p className="text-xs font-medium uppercase text-muted-foreground">Agency fee</p>
                  <p className="mt-2 text-xl font-semibold text-foreground">{agencyFeeLabel}</p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-4">
                  <p className="text-xs font-medium uppercase text-muted-foreground">Application</p>
                  <p className="mt-2 text-sm font-medium capitalize text-foreground">
                    {selectedPackage.applicationStatus?.replace(/_/g, " ") ?? "Not started"}
                  </p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-4">
                  <p className="text-xs font-medium uppercase text-muted-foreground">Payment</p>
                  <p className="mt-2 text-sm font-medium capitalize text-foreground">
                    {selectedPackage.isPaid ? "Paid" : selectedPackage.latestPayment?.status ?? "Not paid"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
              <div className="space-y-2">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-50 text-brand-500">
                  <Landmark className="h-5 w-5" />
                </div>
                <CardTitle>Government fee disclosure</CardTitle>
              </div>
              <GovernmentFeeBadge mode={selectedPackage.governmentFee.mode} />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border bg-muted/30 p-4">
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
              <div className="flex gap-3 rounded-lg border border-brand-100 bg-brand-50 p-4 text-sm text-brand-900">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  VIZA Checkout never collects official portal card details and does not automatically pay
                  government portal fees from the agency-fee payment.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-50 text-brand-500">
                <ReceiptText className="h-5 w-5" />
              </div>
              <CardTitle>Order summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <DetailRow label="Package" value={selectedPackage.packageName} />
                <DetailRow label="Destination" value={selectedPackage.countryName} />
                <DetailRow label="Visa type" value={selectedPackage.visaTypeLabel} />
                <DetailRow label="VIZA agency fee" value={agencyFeeLabel} />
                <DetailRow label="Government fee" value="Separate from this checkout" muted />
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
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertTitle>Agency fee recorded</AlertTitle>
                    <AlertDescription>
                      {paidAt ? `Latest confirmation: ${new Date(paidAt).toLocaleString()}` : "Payment is on file."}
                    </AlertDescription>
                  </Alert>
                  <Button asChild className="h-12 w-full rounded-full bg-brand-500 hover:bg-brand-600">
                    <a href={selectedPackage.nextStep.href}>
                      {selectedPackage.nextStep.label}
                      <ArrowRight className="h-4 w-4" />
                    </a>
                  </Button>
                  <p className="text-sm leading-6 text-muted-foreground">{selectedPackage.nextStep.description}</p>
                </div>
              ) : (
                <form action={startStripeCheckout} className="space-y-4">
                  <input type="hidden" name="packageId" value={selectedPackage.packageId} />
                  <CheckoutSubmitButton disabled={!canStartPayment}>
                    <CreditCard className="h-4 w-4" />
                    Pay agency fee with Stripe
                  </CheckoutSubmitButton>
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-50 text-brand-500">
                <FileText className="h-5 w-5" />
              </div>
              <CardTitle>After payment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-6 text-muted-foreground">
              <p>{selectedPackage.nextStep.description}</p>
              <p>
                If an official portal fee becomes necessary, VIZA will show it as a separate step instead of adding it
                to this Stripe agency-fee checkout.
              </p>
            </CardContent>
          </Card>
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
    <div className="mx-auto max-w-7xl space-y-8 pb-16">
      <header className="space-y-3">
        <Badge variant="outline" className="border-brand-200 text-brand-500">
          VIZA agency fee
        </Badge>
        <div className="max-w-3xl space-y-3">
          <h1 className="text-3xl font-semibold text-foreground md:text-4xl">Checkout</h1>
          <p className="text-base leading-7 text-muted-foreground">
            Confirm your visa package and pay VIZA's agency fee through Stripe Checkout. Government portal fees stay
            separate and are never collected as card details in the VIZA portal.
          </p>
        </div>
      </header>

      {context.error ? (
        <Alert className="border-destructive/30 bg-destructive/5 text-destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>Checkout could not load</AlertTitle>
          <AlertDescription>{context.error}</AlertDescription>
        </Alert>
      ) : null}

      {context.selectedPackage ? (
        <CheckoutContent
          selectedPackage={context.selectedPackage}
          packages={context.packages}
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
