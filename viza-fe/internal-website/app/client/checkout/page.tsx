import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { startStripeCheckout } from "./actions";
import { CheckoutSubmitButton } from "./submit-button";
import {
  getCheckoutCopy,
  getCheckoutReturnState,
  localizeCheckoutStatus,
  localizeCheckoutNextStep,
  localizeGovernmentFee,
  type CheckoutCopy,
} from "./checkout-copy";
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

export async function generateMetadata(): Promise<Metadata> {
  const copy = getCheckoutCopy(await getLocale());
  return { title: copy.metadataTitle, description: copy.metadataDescription };
}

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

async function getReturnState(
  params: CheckoutSearchParams | undefined,
  locale: string,
): Promise<CheckoutReturnState> {
  const status = getParam(params, "status");
  if (status === "success") {
    return reconcileStripeCheckoutSession(getParam(params, "session_id"));
  }

  if (status === "cancelled") {
    return {
      tone: "warning",
      title: getCheckoutCopy(locale).cancelledTitle,
      description: getCheckoutCopy(locale).cancelledDescription,
    };
  }

  return getCheckoutReturnState(getParam(params, "error"), locale);
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

function EmptyCheckoutState({ copy }: { copy: CheckoutCopy }) {
  return (
    <ApplicationFormPanel className="flex min-h-[320px] flex-col items-center justify-center p-6 text-center">
      <h2 className="text-xl font-semibold text-foreground">{copy.emptyTitle}</h2>
      <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
        {copy.emptyDescription}
      </p>
      <Button asChild className="mt-6 h-11 rounded-full bg-brand-500 px-5 hover:bg-brand-600">
        <Link href="/client/application">{copy.chooseRoute}</Link>
      </Button>
    </ApplicationFormPanel>
  );
}

function CheckoutContent({
  selectedPackage,
  stripeConfigured,
  returnState,
  locale,
  copy,
}: {
  selectedPackage: CheckoutPackageSummary;
  stripeConfigured: boolean;
  returnState: CheckoutReturnState;
  locale: string;
  copy: CheckoutCopy;
}) {
  const canStartPayment = Boolean(selectedPackage.agencyFee) && stripeConfigured && !selectedPackage.isPaid;
  const agencyFeeLabel = selectedPackage.agencyFee?.label ?? copy.notConfigured;
  const paidAt = selectedPackage.latestPayment?.updated_at ?? selectedPackage.latestPayment?.created_at ?? null;
  const governmentFee = localizeGovernmentFee(selectedPackage.governmentFee, locale);
  const nextStep = localizeCheckoutNextStep(selectedPackage.nextStep, locale);

  return (
    <div className="space-y-6">
      <ReturnStateAlert state={returnState} />

      {!stripeConfigured ? (
        <Alert className="border-amber-200 bg-amber-50 text-amber-950">
          <AlertTitle>{copy.stripeNeedsConfiguration}</AlertTitle>
          <AlertDescription>
            {copy.stripeDisabledDescription}
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
                  <p className="text-xs font-medium uppercase text-muted-foreground">{copy.agencyFee}</p>
                  <p className="mt-2 text-xl font-semibold text-foreground">{agencyFeeLabel}</p>
                </div>
                <div className="border-t py-4 sm:border-t-0 sm:px-4">
                  <p className="text-xs font-medium uppercase text-muted-foreground">{copy.application}</p>
                  <p className="mt-2 text-sm font-medium capitalize text-foreground">
                    {localizeCheckoutStatus(selectedPackage.applicationStatus, locale, copy.notStarted)}
                  </p>
                </div>
                <div className="border-t py-4 sm:border-t-0 sm:pl-4">
                  <p className="text-xs font-medium uppercase text-muted-foreground">{copy.payment}</p>
                  <p className="mt-2 text-sm font-medium capitalize text-foreground">
                    {selectedPackage.isPaid
                      ? copy.paid
                      : localizeCheckoutStatus(selectedPackage.latestPayment?.status, locale, copy.notPaid)}
                  </p>
                </div>
              </div>
            </div>
          </ApplicationFormPanel>

          <ApplicationFormPanel className="p-5 sm:p-6">
            <div>
              <h2 className="text-base font-semibold text-foreground">{copy.officialFeePayment}</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {copy.officialFeeIntro}
              </p>
            </div>
            <div className="mt-5 space-y-4">
              <div className="border-y py-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">{governmentFee.label}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {governmentFee.description}
                    </p>
                  </div>
                  <p className="text-right text-sm font-semibold text-foreground">
                    {governmentFee.amountLabel}
                  </p>
                </div>
              </div>
              <p className="leading-7 text-muted-foreground">{governmentFee.detail}</p>
              <div className="rounded-lg bg-brand-50 p-4 text-sm leading-6 text-brand-900">
                {copy.noGovernmentCard}
              </div>
            </div>
          </ApplicationFormPanel>
        </div>

        <aside className="space-y-6">
          <ApplicationFormPanel className="p-5 sm:p-6">
            <h2 className="text-base font-semibold text-foreground">{copy.orderSummary}</h2>
            <div className="mt-5 space-y-5">
              <div>
                <DetailRow label={copy.package} value={selectedPackage.packageName} />
                <DetailRow label={copy.destination} value={selectedPackage.countryName} />
                <DetailRow label={copy.visaType} value={selectedPackage.visaTypeLabel} />
                <DetailRow label={copy.vizaAgencyFee} value={agencyFeeLabel} />
                <DetailRow label={copy.officialFee} value={copy.officialFeePaid} muted />
              </div>

              <div className="rounded-lg bg-muted/40 p-4">
                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-sm font-medium text-muted-foreground">{copy.dueToday}</span>
                  <span className="text-2xl font-semibold text-foreground">
                    {selectedPackage.agencyFee
                      ? formatMoney(selectedPackage.agencyFee.cents, selectedPackage.agencyFee.currency, locale)
                      : copy.unavailable}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {copy.stripeOnly}
                </p>
              </div>

              {selectedPackage.isPaid ? (
                <div className="space-y-4">
                  <Alert className="border-emerald-200 bg-emerald-50 text-emerald-950">
                    <AlertTitle>{copy.agencyFeeRecorded}</AlertTitle>
                    <AlertDescription>
                      {paidAt
                        ? copy.latestConfirmation(new Date(paidAt).toLocaleString(locale))
                        : copy.paymentOnFile}
                    </AlertDescription>
                  </Alert>
                  <Button asChild className="h-12 w-full rounded-full bg-brand-500 hover:bg-brand-600">
                    <a href={nextStep.href}>{nextStep.label}</a>
                  </Button>
                  <p className="text-sm leading-6 text-muted-foreground">{nextStep.description}</p>
                </div>
              ) : (
                <form action={startStripeCheckout} className="space-y-4">
                  <input type="hidden" name="packageId" value={selectedPackage.packageId} />
                  {selectedPackage.applicationId ? (
                    <input type="hidden" name="applicationId" value={selectedPackage.applicationId} />
                  ) : null}
                  <CheckoutSubmitButton disabled={!canStartPayment} loadingText={copy.openingStripe}>
                    {copy.payAgencyFee}
                  </CheckoutSubmitButton>
                  {!selectedPackage.agencyFee ? (
                    <p className="text-sm leading-6 text-muted-foreground">
                      {copy.checkoutDisabled}
                    </p>
                  ) : (
                    <p className="text-sm leading-6 text-muted-foreground">
                      {copy.stripeHosted}
                    </p>
                  )}
                </form>
              )}
            </div>
          </ApplicationFormPanel>

          <ApplicationFormPanel className="p-5 sm:p-6">
            <h2 className="text-base font-semibold text-foreground">{copy.afterPayment}</h2>
            <div className="mt-4 space-y-4 text-sm leading-6 text-muted-foreground">
              <p>{nextStep.description}</p>
              <p>
                {copy.noGovernmentCard}
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
  const locale = await getLocale();
  const copy = getCheckoutCopy(locale);
  const returnState = await getReturnState(params, locale);
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
          <h1 className="text-3xl font-semibold text-foreground md:text-4xl">{copy.title}</h1>
          <p className="text-base leading-7 text-muted-foreground">
            {copy.intro}
          </p>
        </div>
      </header>

      {context.error ? (
        <ClientErrorAlert message={copy.loadError} title={copy.loadError} />
      ) : null}

      {context.selectedPackage ? (
        <CheckoutContent
          selectedPackage={context.selectedPackage}
          stripeConfigured={context.stripeConfigured}
          returnState={returnState}
          locale={locale}
          copy={copy}
        />
      ) : (
        <div className="space-y-6">
          <ReturnStateAlert state={returnState} />
          <EmptyCheckoutState copy={copy} />
        </div>
      )}
    </div>
  );
}
