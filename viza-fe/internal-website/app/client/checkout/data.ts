import "server-only";

import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import {
  getDestinationDisplayName,
  getVisaTypeDisplayName,
} from "@/lib/visa-destinations";

type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type QueryError = {
  message: string;
};

type QueryResponse<T> = {
  data: T | null;
  error: QueryError | null;
};

interface CheckoutQueryBuilder<Row> extends PromiseLike<QueryResponse<Row[]>> {
  contains(column: string, value: unknown): CheckoutQueryBuilder<Row>;
  eq(column: string, value: unknown): CheckoutQueryBuilder<Row>;
  in(column: string, values: readonly unknown[]): CheckoutQueryBuilder<Row>;
  insert(values: unknown): CheckoutQueryBuilder<Row>;
  limit(count: number): CheckoutQueryBuilder<Row>;
  maybeSingle(): Promise<QueryResponse<Row>>;
  order(column: string, options?: { ascending?: boolean }): CheckoutQueryBuilder<Row>;
  select(columns?: string): CheckoutQueryBuilder<Row>;
  single(): Promise<QueryResponse<Row>>;
  update(values: unknown): CheckoutQueryBuilder<Row>;
}

interface CheckoutAdminClient {
  from(table: "applicant_profiles"): CheckoutQueryBuilder<ApplicantProfileRow>;
  from(table: "application_events"): CheckoutQueryBuilder<ApplicationEventRow>;
  from(table: "application_signatures"): CheckoutQueryBuilder<ApplicationSignatureRow>;
  from(table: "applications"): CheckoutQueryBuilder<ApplicationRow>;
  from(table: "consent_events"): CheckoutQueryBuilder<ConsentEventRow>;
  from(table: "payment_records"): CheckoutQueryBuilder<PaymentRecordRow>;
  from(table: "user_packages"): CheckoutQueryBuilder<UserPackageRow>;
  from(table: "visa_packages"): CheckoutQueryBuilder<VisaPackageRow>;
}

export interface CheckoutUser {
  id: string;
  name: string;
  email: string;
}

export interface ApplicantProfileRow {
  id: string;
  auth_user_id: string | null;
  full_name: string | null;
  email: string | null;
}

export interface UserPackageRow {
  id: string;
  auth_user_id: string;
  visa_package_id: string;
  application_id: string | null;
  status: string;
  assigned_at: string | null;
}

export interface VisaPackageRow {
  id: string;
  country: string;
  visa_type: string;
  name: string;
  description: string | null;
  price_cents: number | null;
  currency: string | null;
  is_active: boolean | null;
  metadata: Json | null;
}

export interface ApplicationRow {
  id: string;
  applicant_id: string;
  country: string;
  visa_type: string;
  status: string;
  visa_package_id: string | null;
  government_fee_cents: number | null;
  government_fee_currency: string | null;
  government_fee_mode: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface PaymentRecordRow {
  id: string;
  application_id: string | null;
  applicant_id: string | null;
  visa_package_id: string | null;
  provider: string;
  provider_session_id: string | null;
  provider_payment_id: string | null;
  amount_cents: number;
  currency: string;
  status: string;
  fee_type: string;
  receipt_url: string | null;
  metadata: Json | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface ConsentEventRow {
  application_id: string;
  accepted: boolean;
  consent_type: string;
}

export interface ApplicationSignatureRow {
  application_id: string;
  signature_type: string;
  signed_at: string | null;
}

export interface ApplicationEventRow {
  id: string;
  application_id: string;
  applicant_id: string | null;
  event_type: string;
  actor_type: string;
  actor_id: string | null;
  message: string | null;
  metadata: Json | null;
  created_at: string | null;
}

export interface MoneyAmount {
  cents: number;
  currency: string;
  label: string;
}

export interface GovernmentFeeDisclosure {
  mode: "separate" | "estimated" | "unknown" | "external" | "included";
  label: string;
  amountLabel: string;
  description: string;
  detail: string;
}

export interface CheckoutNextStep {
  href: string;
  label: string;
  description: string;
}

export interface CheckoutPackageSummary {
  assignmentId: string;
  assignedAt: string | null;
  packageId: string;
  packageName: string;
  description: string | null;
  country: string;
  countryName: string;
  visaType: string;
  visaTypeLabel: string;
  agencyFee: MoneyAmount | null;
  governmentFee: GovernmentFeeDisclosure;
  applicationId: string | null;
  applicationStatus: string | null;
  latestPayment: PaymentRecordRow | null;
  isPaid: boolean;
  hasConsent: boolean;
  hasSignature: boolean;
  nextStep: CheckoutNextStep;
}

export interface CheckoutContext {
  user: CheckoutUser | null;
  applicantProfile: ApplicantProfileRow | null;
  selectedPackage: CheckoutPackageSummary | null;
  packages: CheckoutPackageSummary[];
  stripeConfigured: boolean;
  error: string | null;
}

export type CheckoutReturnState =
  | {
      tone: "success" | "warning" | "error";
      title: string;
      description: string;
    }
  | null;

export function createCheckoutAdminClient(): CheckoutAdminClient {
  return createAdminClient() as unknown as CheckoutAdminClient;
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function createStripeClient(): Stripe | null {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return null;
  return new Stripe(secretKey);
}

export function formatMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
    }).format(cents / 100);
  } catch {
    return `${currency.toUpperCase()} ${(cents / 100).toFixed(2)}`;
  }
}

export function normalizeCurrency(currency: string | null | undefined): string {
  return (currency || "USD").trim().toUpperCase();
}

function isPaidStatus(status: string | null | undefined): boolean {
  return status === "paid" || status === "succeeded" || status === "complete";
}

function asRecord(value: Json | undefined): Record<string, Json | undefined> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value;
}

function getString(record: Record<string, Json | undefined> | null, keys: string[]): string | null {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function getNumber(record: Record<string, Json | undefined> | null, keys: string[]): number | null {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function getGovernmentFeeMetadata(packageRow: VisaPackageRow): Record<string, Json | undefined> | null {
  const metadata = asRecord(packageRow.metadata ?? undefined);
  return (
    asRecord(metadata?.government_fee) ??
    asRecord(metadata?.governmentFee) ??
    asRecord(metadata?.government_portal_fee) ??
    null
  );
}

function normalizeGovernmentFeeMode(
  rawMode: string | null,
  amountCents: number | null,
): GovernmentFeeDisclosure["mode"] {
  const normalized = rawMode?.toLowerCase().replace(/[\s-]+/g, "_") ?? "";
  if (normalized.includes("included")) return "included";
  if (normalized.includes("estimate")) return "estimated";
  if (normalized.includes("external") || normalized.includes("portal")) return "external";
  if (normalized.includes("unknown") || normalized.includes("tbd")) return "unknown";
  if (amountCents !== null) return "separate";
  return "unknown";
}

export function resolveGovernmentFee(
  packageRow: VisaPackageRow,
  application: ApplicationRow | null,
): GovernmentFeeDisclosure {
  const metadata = getGovernmentFeeMetadata(packageRow);
  const amountCents =
    application?.government_fee_cents ??
    getNumber(metadata, ["amount_cents", "amountCents", "cents", "estimated_amount_cents"]);
  const amount = amountCents ?? getNumber(metadata, ["amount", "estimated_amount"]);
  const currency = normalizeCurrency(
    application?.government_fee_currency ??
      getString(metadata, ["currency", "estimated_currency"]),
  );
  const rawMode =
    application?.government_fee_mode ??
    getString(metadata, ["mode", "payment_mode", "paymentMode", "status"]);
  const mode = normalizeGovernmentFeeMode(rawMode, amountCents ?? amount);
  const metadataNote = getString(metadata, ["note", "description", "disclosure"]);
  const amountLabel =
    amountCents !== null
      ? formatMoney(amountCents, currency)
      : amount !== null
        ? `${currency} ${amount.toFixed(2)}`
        : mode === "unknown"
          ? "Not available yet"
          : "Shown by the official portal or external process";

  if (mode === "included") {
    return {
      mode,
      label: "Government fee disclosure",
      amountLabel,
      description: "A package note marks the government fee as covered by a separate written arrangement.",
      detail:
        metadataNote ??
        "This page still starts Stripe Checkout for VIZA's agency fee only. It does not collect official portal card details.",
    };
  }

  if (mode === "estimated") {
    return {
      mode,
      label: "Estimated government fee",
      amountLabel,
      description: "Government portal fees are separate from the VIZA agency fee.",
      detail:
        metadataNote ??
        "The official amount can change. VIZA will surface the latest known amount before any external handoff.",
    };
  }

  if (mode === "external") {
    return {
      mode,
      label: "Government fee handled separately",
      amountLabel,
      description: "The official portal or another external process may ask you to pay this directly.",
      detail:
        metadataNote ??
        "VIZA does not automatically pay official government portal fees from this checkout.",
    };
  }

  if (mode === "separate") {
    return {
      mode,
      label: "Separate government fee",
      amountLabel,
      description: "This fee is not part of today's Stripe Checkout total.",
      detail:
        metadataNote ??
        "If a government portal fee is required, VIZA will guide you through the separate official payment step.",
    };
  }

  return {
    mode,
    label: "Government fee not confirmed",
    amountLabel,
    description: "VIZA agency payment can be started, but the official fee is not confirmed in the package data.",
    detail:
      metadataNote ??
      "We will confirm official government fee details before any external handoff. This checkout will not charge them.",
  };
}

function buildNextStep(
  summary: Pick<
    CheckoutPackageSummary,
    "applicationId" | "country" | "visaType" | "hasConsent" | "hasSignature"
  >,
): CheckoutNextStep {
  const params = new URLSearchParams({
    country: summary.country,
    visaType: summary.visaType,
  });

  if (!summary.applicationId) {
    return {
      href: `/client/application?${params.toString()}`,
      label: "Start application",
      description: "Start the application form so VIZA can prepare the next steps.",
    };
  }

  params.set("applicationId", summary.applicationId);

  if (!summary.hasConsent || !summary.hasSignature) {
    return {
      href: `/client/consent?${params.toString()}`,
      label: "Continue to consent",
      description: "Review VIZA's terms, privacy notice, and agency authorisation for this application.",
    };
  }

  params.set("view", "detail");

  return {
    href: `/client/documents?${params.toString()}`,
    label: "Continue to documents",
    description: "Upload and review supporting documents for this visa package.",
  };
}

function selectApplication(
  packageId: string,
  assignment: UserPackageRow,
  applications: ApplicationRow[],
): ApplicationRow | null {
  const byAssignment = assignment.application_id
    ? applications.find((application) => application.id === assignment.application_id)
    : null;
  return (
    byAssignment ??
    applications.find((application) => application.visa_package_id === packageId) ??
    null
  );
}

function selectLatestPayment(
  packageId: string,
  applicationId: string | null,
  payments: PaymentRecordRow[],
): PaymentRecordRow | null {
  return (
    payments.find(
      (payment) =>
        payment.visa_package_id === packageId &&
        (payment.application_id === applicationId || !payment.application_id || !applicationId),
    ) ?? null
  );
}

function buildPackageSummaries({
  assignments,
  packages,
  applications,
  payments,
  consentEvents,
  signatures,
}: {
  assignments: UserPackageRow[];
  packages: VisaPackageRow[];
  applications: ApplicationRow[];
  payments: PaymentRecordRow[];
  consentEvents: ConsentEventRow[];
  signatures: ApplicationSignatureRow[];
}): CheckoutPackageSummary[] {
  const packagesById = new Map(packages.map((packageRow) => [packageRow.id, packageRow]));

  return assignments
    .map((assignment) => {
      const packageRow = packagesById.get(assignment.visa_package_id);
      if (!packageRow) return null;

      const application = selectApplication(packageRow.id, assignment, applications);
      const latestPayment = selectLatestPayment(packageRow.id, application?.id ?? null, payments);
      const applicationId = application?.id ?? assignment.application_id;
      const hasConsent = applicationId
        ? consentEvents.some((event) => event.application_id === applicationId && event.accepted)
        : false;
      const hasSignature = applicationId
        ? signatures.some((signature) => signature.application_id === applicationId && Boolean(signature.signed_at))
        : false;
      const agencyFee =
        typeof packageRow.price_cents === "number" && packageRow.price_cents > 0
          ? {
              cents: packageRow.price_cents,
              currency: normalizeCurrency(packageRow.currency),
              label: formatMoney(packageRow.price_cents, normalizeCurrency(packageRow.currency)),
            }
          : null;

      const summaryBase = {
        assignmentId: assignment.id,
        assignedAt: assignment.assigned_at,
        packageId: packageRow.id,
        packageName: packageRow.name,
        description: packageRow.description,
        country: packageRow.country,
        countryName: getDestinationDisplayName(packageRow.country),
        visaType: packageRow.visa_type,
        visaTypeLabel: getVisaTypeDisplayName(packageRow.visa_type),
        agencyFee,
        governmentFee: resolveGovernmentFee(packageRow, application),
        applicationId: application?.id ?? assignment.application_id,
        applicationStatus: application?.status ?? null,
        latestPayment,
        isPaid: isPaidStatus(latestPayment?.status),
        hasConsent,
        hasSignature,
      };

      return {
        ...summaryBase,
        nextStep: buildNextStep(summaryBase),
      };
    })
    .filter((summary): summary is CheckoutPackageSummary => Boolean(summary));
}

export async function getCheckoutContext(selectedPackageId?: string | null): Promise<CheckoutContext> {
  const authenticatedUser = await getAuthenticatedUser();
  if (!authenticatedUser) {
    return {
      user: null,
      applicantProfile: null,
      selectedPackage: null,
      packages: [],
      stripeConfigured: isStripeConfigured(),
      error: null,
    };
  }

  const user: CheckoutUser = {
    id: authenticatedUser.id,
    name: authenticatedUser.name,
    email: authenticatedUser.email,
  };

  try {
    const adminClient = createCheckoutAdminClient();

    const [{ data: profileData }, { data: assignmentData, error: assignmentError }] = await Promise.all([
      adminClient
        .from("applicant_profiles")
        .select("id, auth_user_id, full_name, email")
        .eq("auth_user_id", user.id)
        .limit(1)
        .maybeSingle(),
      adminClient
        .from("user_packages")
        .select("id, auth_user_id, visa_package_id, application_id, status, assigned_at")
        .eq("auth_user_id", user.id)
        .eq("status", "active")
        .order("assigned_at", { ascending: false }),
    ]);

    if (assignmentError) {
      return {
        user,
        applicantProfile: null,
        selectedPackage: null,
        packages: [],
        stripeConfigured: isStripeConfigured(),
        error: "We could not load your active visa packages. Please refresh or contact support.",
      };
    }

    const applicantProfile = profileData ?? null;
    const assignments = assignmentData ?? [];
    const packageIds = [...new Set(assignments.map((assignment) => assignment.visa_package_id))];

    if (packageIds.length === 0) {
      return {
        user,
        applicantProfile,
        selectedPackage: null,
        packages: [],
        stripeConfigured: isStripeConfigured(),
        error: null,
      };
    }

    const { data: packageData, error: packageError } = await adminClient
      .from("visa_packages")
      .select("id, country, visa_type, name, description, price_cents, currency, is_active, metadata")
      .in("id", packageIds)
      .eq("is_active", true);

    if (packageError) {
      return {
        user,
        applicantProfile,
        selectedPackage: null,
        packages: [],
        stripeConfigured: isStripeConfigured(),
        error: "We could not load package pricing. Please refresh or contact support.",
      };
    }

    let applications: ApplicationRow[] = [];
    let payments: PaymentRecordRow[] = [];
    let consentEvents: ConsentEventRow[] = [];
    let signatures: ApplicationSignatureRow[] = [];

    if (applicantProfile) {
      const { data: applicationData } = await adminClient
        .from("applications")
        .select(
          "id, applicant_id, country, visa_type, status, visa_package_id, government_fee_cents, government_fee_currency, government_fee_mode, created_at, updated_at",
        )
        .eq("applicant_id", applicantProfile.id)
        .in("visa_package_id", packageIds)
        .order("updated_at", { ascending: false });

      applications = applicationData ?? [];
    }

    const paymentQuery = adminClient
      .from("payment_records")
      .select(
        "id, application_id, applicant_id, visa_package_id, provider, provider_session_id, provider_payment_id, amount_cents, currency, status, fee_type, receipt_url, metadata, created_at, updated_at",
      )
      .eq("fee_type", "agency_fee")
      .in("visa_package_id", packageIds)
      .order("created_at", { ascending: false });

    const { data: paymentData } = applicantProfile
      ? await paymentQuery.eq("applicant_id", applicantProfile.id)
      : await paymentQuery.contains("metadata", { user_id: user.id });

    payments = paymentData ?? [];

    if (applicantProfile) {
      const applicationIds = applications.map((application) => application.id);
      if (applicationIds.length > 0) {
        const [{ data: consentData }, { data: signatureData }] = await Promise.all([
          adminClient
            .from("consent_events")
            .select("application_id, accepted, consent_type")
            .in("application_id", applicationIds),
          adminClient
            .from("application_signatures")
            .select("application_id, signature_type, signed_at")
            .in("application_id", applicationIds),
        ]);

        consentEvents = consentData ?? [];
        signatures = signatureData ?? [];
      }
    }

    const packages = buildPackageSummaries({
      assignments,
      packages: packageData ?? [],
      applications,
      payments,
      consentEvents,
      signatures,
    });
    const selectedPackage =
      packages.find((packageSummary) => packageSummary.packageId === selectedPackageId) ??
      packages[0] ??
      null;

    return {
      user,
      applicantProfile,
      selectedPackage,
      packages,
      stripeConfigured: isStripeConfigured(),
      error: null,
    };
  } catch (error) {
    console.error("[checkout] Failed to load checkout context:", error);
    return {
      user,
      applicantProfile: null,
      selectedPackage: null,
      packages: [],
      stripeConfigured: isStripeConfigured(),
      error: "Checkout is temporarily unavailable. Please refresh or contact support.",
    };
  }
}

export async function reconcileStripeCheckoutSession(sessionId: string | null): Promise<CheckoutReturnState> {
  if (!sessionId) {
    return {
      tone: "warning",
      title: "Stripe returned without a session reference",
      description: "We could not confirm the payment yet. Please refresh billing in a moment or contact support.",
    };
  }

  const authenticatedUser = await getAuthenticatedUser();
  if (!authenticatedUser) {
    return {
      tone: "error",
      title: "Please sign in to confirm payment",
      description: "Stripe sent you back to VIZA, but your portal session is no longer active.",
    };
  }

  const stripe = createStripeClient();
  if (!stripe) {
    return {
      tone: "warning",
      title: "Stripe confirmation is not configured locally",
      description: "We cannot verify the payment in this environment. Production checkout requires Stripe secrets.",
    };
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.metadata?.userId !== authenticatedUser.id) {
      return {
        tone: "error",
        title: "Payment session does not match this account",
        description: "For safety, VIZA did not attach this Stripe return to your application.",
      };
    }

    const adminClient = createCheckoutAdminClient();
    const isPaid = session.payment_status === "paid" || session.status === "complete";
    const paymentIntentId =
      typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null;
    const now = new Date().toISOString();

    const updatePayload: Partial<PaymentRecordRow> = {
      provider_payment_id: paymentIntentId,
      status: isPaid ? "paid" : "pending",
      updated_at: now,
      metadata: {
        user_id: authenticatedUser.id,
        applicant_id: session.metadata?.applicantId ?? null,
        application_id: session.metadata?.applicationId ?? null,
        visa_package_id: session.metadata?.visaPackageId ?? null,
        stripe_payment_status: session.payment_status,
        stripe_session_status: session.status,
      },
    };

    await adminClient
      .from("payment_records")
      .update(updatePayload)
      .eq("provider_session_id", session.id)
      .eq("fee_type", "agency_fee");

    if (isPaid && session.metadata?.applicationId) {
      const { data: existingEvents } = await adminClient
        .from("application_events")
        .select("id")
        .eq("application_id", session.metadata.applicationId)
        .eq("event_type", "agency_fee_paid")
        .contains("metadata", { session_id: session.id })
        .limit(1);

      if (!existingEvents?.length) {
        await adminClient.from("application_events").insert({
          application_id: session.metadata.applicationId,
          applicant_id: session.metadata.applicantId || null,
          event_type: "agency_fee_paid",
          actor_type: "system",
          actor_id: null,
          message: "VIZA agency fee payment confirmed by Stripe Checkout.",
          metadata: {
            provider: "stripe",
            session_id: session.id,
          },
          created_at: now,
        });
      }
    }

    if (!isPaid) {
      return {
        tone: "warning",
        title: "Payment is still pending",
        description: "Stripe returned you to VIZA, but the payment has not been confirmed yet.",
      };
    }

    return {
      tone: "success",
      title: "Agency fee payment confirmed",
      description: "VIZA has recorded the Stripe Checkout confirmation for the agency fee only.",
    };
  } catch (error) {
    console.error("[checkout] Failed to reconcile Stripe session:", error);
    return {
      tone: "error",
      title: "Payment confirmation needs support review",
      description: "We could not verify the Stripe return automatically. Your card details were never handled by VIZA.",
    };
  }
}
