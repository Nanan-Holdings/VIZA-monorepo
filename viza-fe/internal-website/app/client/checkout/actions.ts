"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  createCheckoutAdminClient,
  createStripeClient,
  getCheckoutContext,
} from "./data";

function getFormString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

async function getAppBaseUrl(): Promise<string | null> {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configuredUrl) return configuredUrl.replace(/\/+$/, "");

  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin");
  if (origin) return origin.replace(/\/+$/, "");

  const host = requestHeaders.get("host");
  if (!host) return null;

  const proto = requestHeaders.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`.replace(/\/+$/, "");
}

function checkoutUrl(params: Record<string, string>): string {
  const query = new URLSearchParams(params);
  return `/client/checkout?${query.toString()}`;
}

export async function startStripeCheckout(formData: FormData): Promise<void> {
  const packageId = getFormString(formData, "packageId");
  let destination = checkoutUrl({
    error: "checkout_unavailable",
    ...(packageId ? { packageId } : {}),
  });

  try {
    if (!packageId) {
      destination = checkoutUrl({ error: "missing_package" });
      return;
    }

    const context = await getCheckoutContext(packageId);
    if (!context.user) {
      destination = "/client/login";
      return;
    }

    const selectedPackage = context.selectedPackage;
    if (!selectedPackage || selectedPackage.packageId !== packageId) {
      destination = checkoutUrl({ error: "package_not_found" });
      return;
    }

    if (!selectedPackage.agencyFee) {
      destination = checkoutUrl({ error: "pricing_missing", packageId });
      return;
    }

    if (selectedPackage.isPaid) {
      destination = selectedPackage.nextStep.href;
      return;
    }

    const stripe = createStripeClient();
    const appBaseUrl = await getAppBaseUrl();
    if (!stripe || !appBaseUrl) {
      destination = checkoutUrl({ error: "stripe_unconfigured", packageId });
      return;
    }

    const adminClient = createCheckoutAdminClient();
    const now = new Date().toISOString();
    const { data: paymentRecord, error: paymentError } = await adminClient
      .from("payment_records")
      .insert({
        application_id: selectedPackage.applicationId,
        applicant_id: context.applicantProfile?.id ?? null,
        visa_package_id: selectedPackage.packageId,
        provider: "stripe",
        provider_session_id: null,
        provider_payment_id: null,
        amount_cents: selectedPackage.agencyFee.cents,
        currency: selectedPackage.agencyFee.currency,
        status: "pending",
        fee_type: "agency_fee",
        receipt_url: null,
        metadata: {
          source: "client_checkout",
          user_id: context.user.id,
          applicant_id: context.applicantProfile?.id ?? null,
          application_id: selectedPackage.applicationId,
          visa_package_id: selectedPackage.packageId,
          government_fee_mode: selectedPackage.governmentFee.mode,
          government_fee_amount_label: selectedPackage.governmentFee.amountLabel,
        },
        created_at: now,
        updated_at: now,
      })
      .select("id")
      .single();

    if (paymentError || !paymentRecord) {
      destination = checkoutUrl({ error: "payment_record_failed", packageId });
      return;
    }

    const successUrl = new URL("/client/checkout", appBaseUrl);
    successUrl.searchParams.set("status", "success");
    successUrl.searchParams.set("packageId", selectedPackage.packageId);
    successUrl.searchParams.set("session_id", "{CHECKOUT_SESSION_ID}");

    const cancelUrl = new URL("/client/checkout", appBaseUrl);
    cancelUrl.searchParams.set("status", "cancelled");
    cancelUrl.searchParams.set("packageId", selectedPackage.packageId);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: context.user.email,
      line_items: [
        {
          price_data: {
            currency: selectedPackage.agencyFee.currency.toLowerCase(),
            unit_amount: selectedPackage.agencyFee.cents,
            product_data: {
              name: selectedPackage.packageName,
              description: `${selectedPackage.countryName} ${selectedPackage.visaTypeLabel} VIZA agency fee`,
            },
          },
          quantity: 1,
        },
      ],
      success_url: successUrl.toString().replace("%7BCHECKOUT_SESSION_ID%7D", "{CHECKOUT_SESSION_ID}"),
      cancel_url: cancelUrl.toString(),
      client_reference_id: paymentRecord.id,
      metadata: {
        paymentRecordId: paymentRecord.id,
        userId: context.user.id,
        applicantId: context.applicantProfile?.id ?? "",
        applicationId: selectedPackage.applicationId ?? "",
        visaPackageId: selectedPackage.packageId,
        feeType: "agency_fee",
      },
      payment_intent_data: {
        metadata: {
          paymentRecordId: paymentRecord.id,
          userId: context.user.id,
          applicantId: context.applicantProfile?.id ?? "",
          applicationId: selectedPackage.applicationId ?? "",
          visaPackageId: selectedPackage.packageId,
          feeType: "agency_fee",
        },
      },
      custom_text: {
        submit: {
          message:
            "This Stripe Checkout charges only the VIZA agency fee. Government portal fees, if required, are handled separately.",
        },
      },
    });

    if (!session.url) {
      await adminClient
        .from("payment_records")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", paymentRecord.id);
      destination = checkoutUrl({ error: "checkout_unavailable", packageId });
      return;
    }

    await adminClient
      .from("payment_records")
      .update({
        provider_session_id: session.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", paymentRecord.id);

    destination = session.url;
  } catch (error) {
    console.error("[checkout] Failed to start Stripe Checkout:", error);
  } finally {
    redirect(destination);
  }
}
