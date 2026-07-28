import { redirect } from "next/navigation";
import { getUserFromSupabaseSession } from "@/lib/client-session";
import { getImpersonationSession } from "@/lib/impersonation-session";
import { createAdminClient } from "@/lib/supabase/admin";

export interface BillingApplicant {
  applicantId: string;
  email: string | null;
}

export interface BillingPaymentRecord {
  id: string;
  application_id: string | null;
  applicant_id: string | null;
  visa_package_id: string | null;
  amount_cents: number;
  currency: string;
  status: string;
  fee_type: string;
  receipt_url: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface BillingInvoiceRequest {
  id: string;
  payment_record_id: string | null;
  application_id: string | null;
  applicant_id: string | null;
  invoice_name: string | null;
  tax_identifier: string | null;
  billing_email: string | null;
  status: string;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface BillingRefundRecord {
  id: string;
  payment_record_id: string | null;
  application_id: string | null;
  applicant_id: string | null;
  amount_cents: number;
  currency: string;
  status: string;
  reason: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface BillingApplication {
  id: string;
  country: string;
  visa_type: string;
  status: string;
  visa_package_id: string | null;
  government_fee_cents: number | null;
  government_fee_currency: string | null;
  government_fee_mode: string | null;
  packet_status: string | null;
  external_status: string | null;
  result_status: string | null;
  submitted_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface BillingVisaPackage {
  id: string;
  country: string;
  visa_type: string;
  name: string;
  description: string | null;
  price_cents: number | null;
  currency: string | null;
  metadata: unknown;
}

export interface BillingOverview {
  applicant: BillingApplicant;
  payments: BillingPaymentRecord[];
  invoiceRequests: BillingInvoiceRequest[];
  refundRecords: BillingRefundRecord[];
  applications: BillingApplication[];
  packages: BillingVisaPackage[];
  error: string | null;
}

interface ApplicantProfileRow {
  id: string;
  email: string | null;
}

export function isPaidPaymentStatus(status: string): boolean {
  return ["paid", "succeeded", "complete", "completed"].includes(status.toLowerCase());
}

export async function resolveBillingApplicant(): Promise<BillingApplicant | null> {
  const impersonation = await getImpersonationSession();

  if (impersonation) {
    const adminClient = createAdminClient();
    const { data: profileByAuth } = await adminClient
      .from("applicant_profiles")
      .select("id, email")
      .eq("auth_user_id", impersonation.userId)
      .maybeSingle();

    const authProfile = profileByAuth as ApplicantProfileRow | null;
    if (authProfile) {
      return {
        applicantId: authProfile.id,
        email: authProfile.email ?? impersonation.userEmail,
      };
    }

    const { data: profileByEmail } = await adminClient
      .from("applicant_profiles")
      .select("id, email")
      .eq("email", impersonation.userEmail)
      .maybeSingle();

    const emailProfile = profileByEmail as ApplicantProfileRow | null;
    if (!emailProfile) return null;

    return {
      applicantId: emailProfile.id,
      email: emailProfile.email ?? impersonation.userEmail,
    };
  }

  const session = await getUserFromSupabaseSession();
  if (!session) return null;

  return {
    applicantId: session.userId,
    email: session.email,
  };
}

async function requireBillingApplicant(): Promise<BillingApplicant> {
  const applicant = await resolveBillingApplicant();
  if (!applicant) {
    redirect("/client/login?redirect=/client/billing");
  }

  return applicant;
}

function uniqueValues(values: Array<string | null>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

export async function getBillingOverview(): Promise<BillingOverview> {
  const applicant = await requireBillingApplicant();

  try {
    const adminClient = createAdminClient();

    const [paymentResult, applicationResult, invoiceResult, refundResult] = await Promise.all([
      adminClient
        .from("payment_records")
        .select(
          "id, application_id, applicant_id, visa_package_id, amount_cents, currency, status, fee_type, receipt_url, created_at, updated_at",
        )
        .eq("applicant_id", applicant.applicantId)
        .order("created_at", { ascending: false }),
      adminClient
        .from("applications")
        .select(
          "id, country, visa_type, status, visa_package_id, government_fee_cents, government_fee_currency, government_fee_mode, packet_status, external_status, result_status, submitted_at, created_at, updated_at",
        )
        .eq("applicant_id", applicant.applicantId)
        .order("updated_at", { ascending: false }),
      adminClient
        .from("invoice_requests")
        .select(
          "id, payment_record_id, application_id, applicant_id, invoice_name, tax_identifier, billing_email, status, notes, created_at, updated_at",
        )
        .eq("applicant_id", applicant.applicantId)
        .order("created_at", { ascending: false }),
      adminClient
        .from("refund_records")
        .select("id, payment_record_id, application_id, applicant_id, amount_cents, currency, status, reason, created_at, updated_at")
        .eq("applicant_id", applicant.applicantId)
        .order("created_at", { ascending: false }),
    ]);

    if (paymentResult.error || applicationResult.error || invoiceResult.error || refundResult.error) {
      return {
        applicant,
        payments: [],
        invoiceRequests: [],
        refundRecords: [],
        applications: [],
        packages: [],
        error: "We could not load billing records right now. Please try again later.",
      };
    }

    const payments = ((paymentResult.data ?? []) as BillingPaymentRecord[]).filter(
      (payment) => payment.fee_type === "agency_fee",
    );
    const applications = (applicationResult.data ?? []) as BillingApplication[];
    const invoiceRequests = (invoiceResult.data ?? []) as BillingInvoiceRequest[];
    const refundRecords = (refundResult.data ?? []) as BillingRefundRecord[];
    const packageIds = uniqueValues([
      ...payments.map((payment) => payment.visa_package_id),
      ...applications.map((application) => application.visa_package_id),
    ]);

    let packages: BillingVisaPackage[] = [];
    if (packageIds.length > 0) {
      const { data: packageData } = await adminClient
        .from("visa_packages")
        .select("id, country, visa_type, name, description, price_cents, currency, metadata")
        .in("id", packageIds);

      packages = (packageData ?? []) as BillingVisaPackage[];
    }

    return {
      applicant,
      payments,
      invoiceRequests,
      refundRecords,
      applications,
      packages,
      error: null,
    };
  } catch {
    return {
      applicant,
      payments: [],
      invoiceRequests: [],
      refundRecords: [],
      applications: [],
      packages: [],
      error: "Billing records are temporarily unavailable.",
    };
  }
}
