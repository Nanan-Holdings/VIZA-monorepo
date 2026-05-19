import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUserFromSupabaseSession } from "@/lib/client-session";
import {
  AGENCY_FEE_TYPE,
  PAYMENT_RECORD_SELECT,
  STRIPE_PROVIDER,
  StripeRouteConfigError,
  createStripeAdminClient,
  getAppBaseUrl,
  getStripeClient,
  insertApplicationEventOnce,
  jsonError,
  normalizeCurrency,
  upsertPaymentRecord,
  type ApplicationRow,
  type JsonObject,
  type PaymentRecordRow,
  type StripeSupabaseClient,
  type VisaPackageRow,
} from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const checkoutRequestSchema = z.object({
  applicationId: z.string().uuid(),
  packageId: z.string().uuid().optional(),
});

async function parseCheckoutRequest(request: NextRequest) {
  try {
    return checkoutRequestSchema.safeParse(await request.json());
  } catch {
    return checkoutRequestSchema.safeParse(null);
  }
}

async function getOwnedApplication(
  adminClient: StripeSupabaseClient,
  applicationId: string,
  applicantId: string,
): Promise<ApplicationRow | null> {
  const { data, error } = await adminClient
    .from("applications")
    .select("id, applicant_id, country, visa_type, status, visa_package_id, submitted_at, updated_at")
    .eq("id", applicationId)
    .eq("applicant_id", applicantId)
    .maybeSingle();

  if (error) throw error;
  return (data as unknown as ApplicationRow | null) ?? null;
}

async function getVisaPackage(
  adminClient: StripeSupabaseClient,
  packageId: string,
): Promise<VisaPackageRow | null> {
  const { data, error } = await adminClient
    .from("visa_packages")
    .select("id, country, visa_type, name, description, price_cents, currency, is_active, metadata")
    .eq("id", packageId)
    .maybeSingle();

  if (error) throw error;
  return (data as unknown as VisaPackageRow | null) ?? null;
}

async function getExistingPaidRecord(
  adminClient: StripeSupabaseClient,
  applicationId: string,
): Promise<PaymentRecordRow | null> {
  const { data, error } = await adminClient
    .from("payment_records")
    .select(PAYMENT_RECORD_SELECT)
    .eq("provider", STRIPE_PROVIDER)
    .eq("application_id", applicationId)
    .eq("fee_type", AGENCY_FEE_TYPE)
    .in("status", ["paid", "succeeded", "complete", "partially_refunded"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data as unknown as PaymentRecordRow | null) ?? null;
}

async function getReusablePendingSession(
  adminClient: StripeSupabaseClient,
  applicationId: string,
) {
  const stripe = getStripeClient();
  const { data, error } = await adminClient
    .from("payment_records")
    .select(PAYMENT_RECORD_SELECT)
    .eq("provider", STRIPE_PROVIDER)
    .eq("application_id", applicationId)
    .eq("fee_type", AGENCY_FEE_TYPE)
    .eq("status", "pending")
    .not("provider_session_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(3);

  if (error) throw error;

  for (const record of (data as unknown as PaymentRecordRow[] | null) ?? []) {
    if (!record.provider_session_id) continue;
    const session = await stripe.checkout.sessions.retrieve(record.provider_session_id);
    if (session.status === "open" && session.url) {
      return { record, session };
    }

    if (session.status === "expired") {
      await adminClient
        .from("payment_records")
        .update({ status: "expired", updated_at: new Date().toISOString() })
        .eq("id", record.id);
    }
  }

  return null;
}

function checkoutReturnUrl(baseUrl: string, applicationId: string, status: "success" | "cancelled") {
  const url = new URL("/client/checkout", baseUrl);
  url.searchParams.set("status", status);
  url.searchParams.set("applicationId", applicationId);
  if (status === "success") url.searchParams.set("session_id", "{CHECKOUT_SESSION_ID}");
  return url.toString();
}

function buildCheckoutMetadata(params: {
  application: ApplicationRow;
  applicantEmail: string;
  packageRow: VisaPackageRow;
}): Record<string, string> {
  return {
    applicationId: params.application.id,
    applicantId: params.application.applicant_id,
    applicantEmail: params.applicantEmail,
    visaPackageId: params.packageRow.id,
    feeType: AGENCY_FEE_TYPE,
    viza_application_id: params.application.id,
    viza_applicant_id: params.application.applicant_id,
    viza_package_id: params.packageRow.id,
    viza_fee_type: AGENCY_FEE_TYPE,
  };
}

function buildPaymentMetadata(params: {
  application: ApplicationRow;
  packageRow: VisaPackageRow;
  sessionId: string;
}): JsonObject {
  const packageMetadata =
    params.packageRow.metadata && typeof params.packageRow.metadata === "object" && !Array.isArray(params.packageRow.metadata)
      ? params.packageRow.metadata
      : {};

  return {
    source: "stripe_checkout_route",
    fee_type: AGENCY_FEE_TYPE,
    country: params.application.country,
    visa_type: params.application.visa_type,
    package_name: params.packageRow.name,
    government_fee_mode:
      typeof packageMetadata.government_fee === "object" &&
      packageMetadata.government_fee &&
      !Array.isArray(packageMetadata.government_fee) &&
      typeof packageMetadata.government_fee.mode === "string"
        ? packageMetadata.government_fee.mode
        : "display_only",
    stripe: {
      checkout_session_id: params.sessionId,
      checkout_created_by: "api_route",
    },
  };
}

export async function POST(request: NextRequest) {
  const session = await getUserFromSupabaseSession();
  if (!session) {
    return jsonError("Unauthorized", 401);
  }

  const parsed = await parseCheckoutRequest(request);
  if (!parsed.success) {
    return jsonError("applicationId is required.", 400);
  }

  let stripe;
  try {
    stripe = getStripeClient();
  } catch (error) {
    if (error instanceof StripeRouteConfigError) {
      return jsonError("Stripe Checkout is not configured.", 503);
    }
    throw error;
  }

  const adminClient = createStripeAdminClient();

  try {
    const application = await getOwnedApplication(
      adminClient,
      parsed.data.applicationId,
      session.userId,
    );

    if (!application) {
      return jsonError("Application not found.", 404);
    }

    const packageId = application.visa_package_id ?? parsed.data.packageId ?? null;
    if (!packageId) {
      return jsonError("Application package is not configured.", 409);
    }

    if (parsed.data.packageId && parsed.data.packageId !== packageId) {
      return jsonError("Package does not match application.", 409);
    }

    const packageRow = await getVisaPackage(adminClient, packageId);
    if (!packageRow || packageRow.is_active === false) {
      return jsonError("Visa package is unavailable.", 409);
    }

    if (typeof packageRow.price_cents !== "number" || packageRow.price_cents <= 0) {
      return jsonError("Agency fee pricing is not configured.", 409);
    }

    const existingPaidRecord = await getExistingPaidRecord(adminClient, application.id);
    if (existingPaidRecord) {
      return NextResponse.json({
        alreadyPaid: true,
        paymentRecordId: existingPaidRecord.id,
        redirectUrl: `/client/status?applicationId=${application.id}`,
      });
    }

    const reusableSession = await getReusablePendingSession(adminClient, application.id);
    if (reusableSession?.session.url) {
      return NextResponse.json({
        checkoutUrl: reusableSession.session.url,
        sessionId: reusableSession.session.id,
        paymentRecordId: reusableSession.record.id,
        reused: true,
      });
    }

    const currency = normalizeCurrency(packageRow.currency);
    const metadata = buildCheckoutMetadata({
      application,
      applicantEmail: session.email,
      packageRow,
    });
    const appBaseUrl = getAppBaseUrl(request);

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: session.email,
      line_items: [
        {
          price_data: {
            currency: currency.toLowerCase(),
            unit_amount: packageRow.price_cents,
            product_data: {
              name: packageRow.name,
              description:
                packageRow.description ??
                `${application.country} ${application.visa_type} VIZA agency fee`,
            },
          },
          quantity: 1,
        },
      ],
      success_url: checkoutReturnUrl(appBaseUrl, application.id, "success"),
      cancel_url: checkoutReturnUrl(appBaseUrl, application.id, "cancelled"),
      client_reference_id: application.id,
      metadata,
      payment_intent_data: { metadata },
      invoice_creation: {
        enabled: true,
        invoice_data: {
          description: `${packageRow.name} VIZA agency fee`,
          metadata,
        },
      },
      custom_text: {
        submit: {
          message:
            "This Stripe Checkout charges only the VIZA agency fee. Government portal fees, if required, are handled separately.",
        },
      },
    });

    if (!checkoutSession.url) {
      return jsonError("Stripe Checkout session could not be created.", 502);
    }

    const paymentRecord = await upsertPaymentRecord(adminClient, {
      applicationId: application.id,
      applicantId: application.applicant_id,
      visaPackageId: packageRow.id,
      providerSessionId: checkoutSession.id,
      providerPaymentId:
        typeof checkoutSession.payment_intent === "string"
          ? checkoutSession.payment_intent
          : checkoutSession.payment_intent?.id ?? null,
      amountCents: packageRow.price_cents,
      currency,
      status: "pending",
      receiptUrl: null,
      metadata: buildPaymentMetadata({
        application,
        packageRow,
        sessionId: checkoutSession.id,
      }),
    });

    await insertApplicationEventOnce(adminClient, {
      applicationId: application.id,
      applicantId: application.applicant_id,
      eventType: "agency_fee_checkout_started",
      message: "Stripe Checkout session created for VIZA agency fee.",
      metadata: {
        provider: STRIPE_PROVIDER,
        payment_record_id: paymentRecord.id,
        checkout_session_id: checkoutSession.id,
      },
      dedupe: {
        payment_record_id: paymentRecord.id,
      },
    });

    return NextResponse.json({
      checkoutUrl: checkoutSession.url,
      sessionId: checkoutSession.id,
      paymentRecordId: paymentRecord.id,
    });
  } catch (error) {
    console.error(
      "[stripe-checkout] Checkout creation failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return jsonError("Unable to create Stripe Checkout session.", 500);
  }
}
