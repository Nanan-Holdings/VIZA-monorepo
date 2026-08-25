import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { startStripeCheckout } from "./actions";
import { CheckoutSubmitButton } from "./submit-button";
import {
  type CheckoutPackageSummary,
  type CheckoutReturnState,
  formatMoney,
  getCheckoutContext,
  reconcileStripeCheckoutSession,
} from "./data";
import { Alert, AlertDescription, AlertIcon, AlertTitle } from "@/components/ui/alert";
import { ClientErrorAlert } from "@/components/client/client-error-alert";
import { Button } from "@/components/ui/button";
import { ApplicationFormPanel } from "@/components/ui/application-form-panel";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("clientCheckout");
  return { title: t("metaTitle"), description: t("metaDescription") };
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

type CheckoutT = Awaited<ReturnType<typeof getTranslations<"clientCheckout">>>;

const ERROR_KEYS = new Set([
  "checkout_unavailable",
  "missing_package",
  "package_not_found",
  "payment_record_failed",
  "pricing_missing",
  "stripe_unconfigured",
]);

const WARNING_ERRORS = new Set(["pricing_missing", "stripe_unconfigured"]);

function getErrorReturnState(error: string | null, t: CheckoutT): CheckoutReturnState {
  if (!error) return null;
  const key = ERROR_KEYS.has(error) ? error : "generic";
  return {
    tone: WARNING_ERRORS.has(key) ? "warning" : "error",
    title: t(`errors.${key}.title`),
    description: t(`errors.${key}.description`),
  };
}

async function getReturnState(
  params: CheckoutSearchParams | undefined,
  t: CheckoutT,
): Promise<CheckoutReturnState> {
  const status = getParam(params, "status");
  if (status === "success") {
    return reconcileStripeCheckoutSession(getParam(params, "session_id"));
  }

  if (status === "cancelled") {
    return {
      tone: "warning",
      title: t("errors.cancelled.title"),
      description: t("errors.cancelled.description"),
    };
  }

  return getErrorReturnState(getParam(params, "error"), t);
}

function ReturnStateAlert({ state }: { state: CheckoutReturnState }) {
  if (!state) return null;

  return (
    <Alert
      variant={state.tone === "success" ? "success" : state.tone === "warning" ? "warning" : "destructive"}
      className="shadow-sm"
    >
      <AlertIcon variant={state.tone === "success" ? "success" : state.tone === "warning" ? "warning" : "destructive"} />
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

function EmptyCheckoutState({ t }: { t: CheckoutT }) {
  return (
    <ApplicationFormPanel className="flex min-h-[320px] flex-col items-center justify-center p-6 text-center">
      <h2 className="text-xl font-semibold text-foreground">{t("empty.title")}</h2>
      <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">{t("empty.description")}</p>
      <Button asChild className="mt-6 h-11 rounded-full bg-brand-500 px-5 hover:bg-brand-600">
        <Link href="/client/application">{t("empty.cta")}</Link>
      </Button>
    </ApplicationFormPanel>
  );
}

function CheckoutContent({
  selectedPackage,
  stripeConfigured,
  returnState,
  t,
}: {
  selectedPackage: CheckoutPackageSummary;
  stripeConfigured: boolean;
  returnState: CheckoutReturnState;
  t: CheckoutT;
}) {
  const canStartPayment = Boolean(selectedPackage.agencyFee) && stripeConfigured && !selectedPackage.isPaid;
  const agencyFeeLabel = selectedPackage.agencyFee?.label ?? t("notConfigured");
  const paidAt = selectedPackage.latestPayment?.updated_at ?? selectedPackage.latestPayment?.created_at ?? null;

  return (
    <div className="space-y-6">
      <ReturnStateAlert state={returnState} />

      {!stripeConfigured ? (
        <Alert variant="warning">
          <AlertIcon variant="warning" />
          <AlertTitle>{t("stripeUnconfigured.title")}</AlertTitle>
          <AlertDescription>{t("stripeUnconfigured.description")}</AlertDescription>
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
                <p className="leading-7 text-muted-foreground">{t("confirmPackage")}</p>
              )}

              <div className="grid border-y sm:grid-cols-3 sm:divide-x">
                <div className="py-4 sm:pr-4">
                  <p className="text-xs font-medium uppercase text-muted-foreground">{t("agencyFee")}</p>
                  <p className="mt-2 text-xl font-semibold text-foreground">{agencyFeeLabel}</p>
                </div>
                <div className="border-t py-4 sm:border-t-0 sm:px-4">
                  <p className="text-xs font-medium uppercase text-muted-foreground">{t("application")}</p>
                  <p className="mt-2 text-sm font-medium capitalize text-foreground">
                    {selectedPackage.applicationStatus?.replace(/_/g, " ") ?? t("notStarted")}
                  </p>
                </div>
                <div className="border-t py-4 sm:border-t-0 sm:pl-4">
                  <p className="text-xs font-medium uppercase text-muted-foreground">{t("payment")}</p>
                  <p className="mt-2 text-sm font-medium capitalize text-foreground">
                    {selectedPackage.isPaid ? t("paid") : selectedPackage.latestPayment?.status ?? t("notPaid")}
                  </p>
                </div>
              </div>
            </div>
          </ApplicationFormPanel>

          <ApplicationFormPanel className="p-5 sm:p-6">
            <div>
              <h2 className="text-base font-semibold text-foreground">{t("officialFee.title")}</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{t("officialFee.lede")}</p>
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
              <div className="rounded-lg bg-brand-50 p-4 text-sm leading-6 text-brand-900">{t("officialFee.note")}</div>
            </div>
          </ApplicationFormPanel>
        </div>

        <aside className="space-y-6">
          <ApplicationFormPanel className="p-5 sm:p-6">
            <h2 className="text-base font-semibold text-foreground">{t("summary.title")}</h2>
            <div className="mt-5 space-y-5">
              <div>
                <DetailRow label={t("summary.package")} value={selectedPackage.packageName} />
                <DetailRow label={t("summary.destination")} value={selectedPackage.countryName} />
                <DetailRow label={t("summary.visaType")} value={selectedPackage.visaTypeLabel} />
                <DetailRow label={t("summary.agencyFee")} value={agencyFeeLabel} />
                <DetailRow label={t("summary.officialFee")} value={t("summary.officialFeeValue")} muted />
              </div>

              <div className="rounded-lg bg-muted/40 p-4">
                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-sm font-medium text-muted-foreground">{t("summary.dueToday")}</span>
                  <span className="text-2xl font-semibold text-foreground">
                    {selectedPackage.agencyFee
                      ? formatMoney(selectedPackage.agencyFee.cents, selectedPackage.agencyFee.currency)
                      : t("unavailable")}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{t("summary.stripeNote")}</p>
              </div>

              {selectedPackage.isPaid ? (
                <div className="space-y-4">
                  <Alert variant="success">
                    <AlertIcon variant="success" />
                    <AlertTitle>{t("paidAlert.title")}</AlertTitle>
                    <AlertDescription>
                      {paidAt
                        ? t("paidAlert.confirmedAt", { at: new Date(paidAt).toLocaleString() })
                        : t("paidAlert.onFile")}
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
                  <CheckoutSubmitButton disabled={!canStartPayment}>{t("payButton")}</CheckoutSubmitButton>
                  {!selectedPackage.agencyFee ? (
                    <p className="text-sm leading-6 text-muted-foreground">{t("noAgencyFee")}</p>
                  ) : (
                    <p className="text-sm leading-6 text-muted-foreground">{t("stripeOnly")}</p>
                  )}
                </form>
              )}
            </div>
          </ApplicationFormPanel>

          <ApplicationFormPanel className="p-5 sm:p-6">
            <h2 className="text-base font-semibold text-foreground">{t("afterPayment.title")}</h2>
            <div className="mt-4 space-y-4 text-sm leading-6 text-muted-foreground">
              <p>{selectedPackage.nextStep.description}</p>
              <p>{t("afterPayment.body")}</p>
            </div>
          </ApplicationFormPanel>
        </aside>
      </div>
    </div>
  );
}

export default async function CheckoutPage({ searchParams }: CheckoutPageProps) {
  const t = await getTranslations("clientCheckout");
  const params = await searchParams;
  const returnState = await getReturnState(params, t);
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
          <h1 className="text-3xl font-semibold text-foreground md:text-4xl">{t("title")}</h1>
          <p className="text-base leading-7 text-muted-foreground">{t("lede")}</p>
        </div>
      </header>

      {context.error ? (
        <ClientErrorAlert message={context.error} title={t("loadFailed")} />
      ) : null}

      {context.selectedPackage ? (
        <CheckoutContent
          selectedPackage={context.selectedPackage}
          stripeConfigured={context.stripeConfigured}
          returnState={returnState}
          t={t}
        />
      ) : (
        <div className="space-y-6">
          <ReturnStateAlert state={returnState} />
          <EmptyCheckoutState t={t} />
        </div>
      )}
    </div>
  );
}
