"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  createCheckoutAdminClient,
  createStripeClient,
  getCheckoutContext,
} from "./data";
import { stripeCheckoutPaymentMethodsFor } from "@/lib/payments/method-availability";
import {
  applyBetaAccess,
  BetaAccessError,
  type AppliedBetaAccess,
  type BetaDeliveryMethod,
} from "@/lib/checkout/beta-access";
import {
  advanceApplicationAfterConfirmedPayment,
  type StripeSupabaseClient,
} from "@/app/api/stripe/_shared";
import { deterministicCheckoutUuid } from "./beta-params";

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

function betaDeliveryMethod(value: string): BetaDeliveryMethod | undefined {
  return value === "promo_code" || value === "link_suffix" ? value : undefined;
}

type CheckoutAdmin = ReturnType<typeof createCheckoutAdminClient>;

interface CanonicalOrderInput {
  applicationId: string;
  applicantId: string;
  agencyFeeCents: number;
  governmentFeeCents: number;
  currency: string;
}

function orderMatches(value: unknown, expected: CanonicalOrderInput): value is { id: string } {
  if (!isRecord(value) || typeof value.id !== "string") return false;
  return value.application_id === expected.applicationId
    && value.applicant_id === expected.applicantId
    && value.agency_fee_cents === expected.agencyFeeCents
    && value.govt_fee_cents === expected.governmentFeeCents
    && value.currency === expected.currency
    && (value.status === "draft" || value.status === "pending");
}

async function resolveCanonicalOrder(
  admin: CheckoutAdmin,
  input: CanonicalOrderInput,
): Promise<string> {
  const columns = "id,application_id,applicant_id,agency_fee_cents,govt_fee_cents,currency,status,metadata";
  const { data: existing, error: lookupError } = await admin
    .from("order")
    .select(columns)
    .eq("application_id", input.applicationId)
    .eq("applicant_id", input.applicantId)
    .in("status", ["draft", "pending"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (existing) {
    if (!orderMatches(existing, input)) throw new Error("canonical checkout order mismatch");
    return existing.id;
  }

  const orderId = deterministicCheckoutUuid("order", input.applicationId);
  const now = new Date().toISOString();
  const { data: inserted, error: insertError } = await admin
    .from("order")
    .insert({
      id: orderId,
      application_id: input.applicationId,
      applicant_id: input.applicantId,
      agency_fee_cents: input.agencyFeeCents,
      govt_fee_cents: input.governmentFeeCents,
      currency: input.currency,
      status: "pending",
      guest_checkout: false,
      metadata: { source: "client_checkout" },
      created_at: now,
      updated_at: now,
    })
    .select(columns)
    .single();
  if (!insertError && orderMatches(inserted, input)) return inserted.id;

  const { data: concurrent, error: concurrentError } = await admin
    .from("order")
    .select(columns)
    .eq("id", orderId)
    .maybeSingle();
  if (concurrentError || !orderMatches(concurrent, input)) {
    throw insertError ?? concurrentError ?? new Error("canonical checkout order unavailable");
  }
  return concurrent.id;
}

async function getOrderBoundBetaAccess(
  admin: CheckoutAdmin,
  input: {
    orderId: string;
    applicationId: string;
    applicantId: string;
    country: string;
    baseAgencyFeeCents: number;
  },
): Promise<AppliedBetaAccess | null> {
  const { data: grant, error } = await admin
    .from("beta_access_grants")
    .select("id,applicant_id,first_application_id,first_order_id,country,audience,delivery_method,discount_percent,access_scope,base_agency_fee_cents,discount_cents")
    .eq("first_order_id", input.orderId)
    .maybeSingle();
  if (error) throw error;
  if (!grant) return null;
  if (
    grant.applicant_id !== input.applicantId
    || grant.first_application_id !== input.applicationId
    || grant.first_order_id !== input.orderId
    || grant.country !== input.country
    || grant.base_agency_fee_cents !== input.baseAgencyFeeCents
    || grant.discount_cents !== Math.round((input.baseAgencyFeeCents * grant.discount_percent) / 100)
  ) throw new Error("beta grant does not match canonical checkout order");
  return {
    grantId: grant.id,
    audience: grant.audience,
    deliveryMethod: grant.delivery_method,
    accessScope: grant.access_scope,
    discountPercent: grant.discount_percent,
    discountCents: grant.discount_cents,
  };
}

function betaDescriptor(beta: AppliedBetaAccess, baseAgencyFeeCents: number) {
  return {
    grant_id: beta.grantId,
    audience: beta.audience,
    delivery_method: beta.deliveryMethod,
    access_scope: beta.accessScope,
    discount_percent: beta.discountPercent,
    base_agency_fee_cents: baseAgencyFeeCents,
    discount_cents: beta.discountCents,
  };
}

interface DiscountedPaymentExpectation {
  id: string;
  applicationId: string;
  applicantId: string;
  orderId: string;
  packageId: string;
  authUserId: string;
  amountCents: number;
  currency: string;
  beta: ReturnType<typeof betaDescriptor>;
}

interface ReusableDiscountedPayment {
  id: string;
  provider_session_id: string | null;
  status: string;
  metadata: Record<string, unknown>;
}

function matchingDiscountedPayment(
  value: unknown,
  expected: DiscountedPaymentExpectation,
): ReusableDiscountedPayment | null {
  if (!isRecord(value) || !isRecord(value.metadata) || !isRecord(value.metadata.beta)) return null;
  const beta = value.metadata.beta;
  const matchesBeta = Object.entries(expected.beta).every(([key, expectedValue]) => beta[key] === expectedValue);
  if (
    value.id !== expected.id
    || value.application_id !== expected.applicationId
    || value.applicant_id !== expected.applicantId
    || value.order_id !== expected.orderId
    || value.visa_package_id !== expected.packageId
    || value.auth_user_id !== expected.authUserId
    || value.provider !== "stripe"
    || value.amount_cents !== expected.amountCents
    || value.currency !== expected.currency
    || value.fee_type !== "agency_fee"
    || value.metadata.source !== "client_checkout"
    || !matchesBeta
    || !["pending", "failed", "expired", "paid"].includes(String(value.status))
  ) return null;
  return {
    id: expected.id,
    provider_session_id: typeof value.provider_session_id === "string" ? value.provider_session_id : null,
    status: String(value.status),
    metadata: value.metadata,
  };
}

interface ExpectedBetaWaiverPayment {
  providerPaymentId: string;
  applicationId: string;
  applicantId: string;
  orderId: string;
  packageId: string;
  authUserId: string;
  currency: string;
  grantId: string;
  audience: string;
  deliveryMethod: string;
  accessScope: string;
  discountPercent: number;
  baseAgencyFeeCents: number;
  discountCents: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMatchingBetaWaiverPayment(
  value: unknown,
  expected: ExpectedBetaWaiverPayment,
): value is { id: string } {
  if (!isRecord(value) || typeof value.id !== "string" || !value.id) return false;
  const metadata = value.metadata;
  if (!isRecord(metadata)) return false;
  const beta = metadata.beta;
  if (!isRecord(beta)) return false;
  return value.provider === "beta"
    && value.provider_payment_id === expected.providerPaymentId
    && value.application_id === expected.applicationId
    && value.applicant_id === expected.applicantId
    && value.order_id === expected.orderId
    && value.visa_package_id === expected.packageId
    && value.auth_user_id === expected.authUserId
    && value.status === "paid"
    && value.amount_cents === 0
    && value.fee_type === "agency_fee"
    && value.currency === expected.currency
    && metadata.source === "client_checkout"
    && metadata.user_id === expected.authUserId
    && metadata.applicant_id === expected.applicantId
    && metadata.application_id === expected.applicationId
    && metadata.visa_package_id === expected.packageId
    && beta.grant_id === expected.grantId
    && beta.audience === expected.audience
    && beta.delivery_method === expected.deliveryMethod
    && beta.access_scope === expected.accessScope
    && beta.discount_percent === expected.discountPercent
    && beta.base_agency_fee_cents === expected.baseAgencyFeeCents
    && beta.discount_cents === expected.discountCents;
}

export async function startStripeCheckout(formData: FormData): Promise<void> {
  const packageId = getFormString(formData, "packageId");
  const applicationId = getFormString(formData, "applicationId");
  const betaToken = getFormString(formData, "betaToken");
  const requestedBetaDeliveryMethod = getFormString(formData, "betaDeliveryMethod");
  const deliveryMethod = betaDeliveryMethod(requestedBetaDeliveryMethod);
  let destination = checkoutUrl({
    error: "checkout_unavailable",
    ...(packageId ? { packageId } : {}),
    ...(applicationId ? { applicationId } : {}),
  });

  try {
    if (!packageId) {
      destination = checkoutUrl({ error: "missing_package" });
      return;
    }

    const context = await getCheckoutContext({ packageId, applicationId });
    if (!context.user) {
      destination = "/client/login";
      return;
    }

    const selectedPackage = context.selectedPackage;
    if (!selectedPackage || selectedPackage.packageId !== packageId) {
      destination = checkoutUrl({
        error: "package_not_found",
        ...(applicationId ? { applicationId } : {}),
      });
      return;
    }

    if (!selectedPackage.agencyFee) {
      destination = checkoutUrl({
        error: "pricing_missing",
        packageId,
        ...(applicationId ? { applicationId } : {}),
      });
      return;
    }

    if (selectedPackage.isPaid) {
      destination = selectedPackage.nextStep.href;
      return;
    }

    const adminClient = createCheckoutAdminClient();

    if (selectedPackage.applicationId) {
      const { error: applicationPackageError } = await adminClient
        .from("applications")
        .update({
          visa_package_id: selectedPackage.packageId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedPackage.applicationId)
        .eq("applicant_id", context.applicantProfile?.id ?? context.user.id);

      if (applicationPackageError) {
        destination = checkoutUrl({
          error: "checkout_unavailable",
          packageId,
          applicationId: selectedPackage.applicationId,
        });
        return;
      }
    }

    const applicantId = context.applicantProfile?.id ?? null;
    if (betaToken && (!deliveryMethod || !applicantId || !selectedPackage.applicationId)) {
      destination = checkoutUrl({
        error: deliveryMethod ? "checkout_unavailable" : "beta_wrong_channel",
        packageId,
        ...(selectedPackage.applicationId ? { applicationId: selectedPackage.applicationId } : {}),
      });
      return;
    }

    let orderId: string | null = null;
    let betaAccess: AppliedBetaAccess | null = null;
    if (applicantId && selectedPackage.applicationId) {
      const governmentFeeAmount = selectedPackage.governmentFeeAmount;
      if (
        governmentFeeAmount
        && governmentFeeAmount.cents > 0
        && governmentFeeAmount.currency !== selectedPackage.agencyFee.currency
      ) {
        destination = checkoutUrl({ error: "pricing_missing", packageId, applicationId: selectedPackage.applicationId });
        return;
      }
      orderId = await resolveCanonicalOrder(adminClient, {
        applicationId: selectedPackage.applicationId,
        applicantId,
        agencyFeeCents: selectedPackage.agencyFee.cents,
        governmentFeeCents: governmentFeeAmount?.cents ?? 0,
        currency: selectedPackage.agencyFee.currency,
      });
      try {
        betaAccess = await applyBetaAccess(adminClient as never, {
          token: betaToken || undefined,
          deliveryMethod,
          applicantId,
          applicationId: selectedPackage.applicationId,
          orderId,
          country: selectedPackage.country,
          baseAgencyFeeCents: selectedPackage.agencyFee.cents,
        });
      } catch (error) {
        if (error instanceof BetaAccessError) {
          destination = checkoutUrl({
            error: `beta_${error.code}`,
            packageId,
            applicationId: selectedPackage.applicationId,
          });
          return;
        }
        throw error;
      }
      if (!betaAccess && !betaToken) {
        betaAccess = await getOrderBoundBetaAccess(adminClient, {
          orderId,
          applicationId: selectedPackage.applicationId,
          applicantId,
          country: selectedPackage.country,
          baseAgencyFeeCents: selectedPackage.agencyFee.cents,
        });
      }
    }
    if (orderId) {
      const { data: orderForPricing, error: orderReadError } = await adminClient
        .from("order")
        .select("metadata")
        .eq("id", orderId)
        .maybeSingle();
      if (orderReadError) throw orderReadError;
      const currentMetadata = isRecord(orderForPricing?.metadata) ? orderForPricing.metadata : {};
      const { error: orderPricingError } = await adminClient
        .from("order")
        .update({
          metadata: {
            ...currentMetadata,
            source: "client_checkout",
            ...(betaAccess ? { beta: betaDescriptor(betaAccess, selectedPackage.agencyFee.cents) } : {}),
            checkout_payment: {
              provider: betaAccess?.discountPercent === 100 ? "free" : "stripe",
              expected_amount_minor: Math.max(0, selectedPackage.agencyFee.cents - (betaAccess?.discountCents ?? 0)),
              currency: selectedPackage.agencyFee.currency,
              government_fee_passthrough_cents: 0,
            },
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId)
        .in("status", ["draft", "pending"]);
      if (orderPricingError) throw orderPricingError;
    }
    if (
      betaAccess?.audience === "friends"
      && betaAccess.accessScope === "all_countries"
      && betaAccess.discountPercent === 100
      && applicantId
      && selectedPackage.applicationId
      && orderId
    ) {
      const waiverAccess = betaAccess;
      const providerPaymentId = `beta:${waiverAccess.grantId}:${selectedPackage.applicationId}`;
      const expectedBetaPayment: ExpectedBetaWaiverPayment = {
        providerPaymentId,
        applicationId: selectedPackage.applicationId,
        applicantId,
        orderId,
        packageId: selectedPackage.packageId,
        authUserId: context.user.id,
        currency: selectedPackage.agencyFee.currency,
        grantId: waiverAccess.grantId,
        audience: waiverAccess.audience,
        deliveryMethod: waiverAccess.deliveryMethod,
        accessScope: waiverAccess.accessScope,
        discountPercent: waiverAccess.discountPercent,
        baseAgencyFeeCents: selectedPackage.agencyFee.cents,
        discountCents: waiverAccess.discountCents,
      };
      const betaPaymentColumns = [
        "id",
        "provider",
        "provider_payment_id",
        "application_id",
        "applicant_id",
        "order_id",
        "visa_package_id",
        "auth_user_id",
        "status",
        "amount_cents",
        "fee_type",
        "currency",
        "metadata",
      ].join(",");
      const { data: existingBetaPayment, error: existingBetaPaymentError } = await adminClient
        .from("payment_records")
        .select(betaPaymentColumns)
        .eq("provider", "beta")
        .eq("provider_payment_id", providerPaymentId)
        .eq("application_id", selectedPackage.applicationId)
        .maybeSingle();
      if (existingBetaPaymentError) throw existingBetaPaymentError;

      if (
        existingBetaPayment
        && !isMatchingBetaWaiverPayment(existingBetaPayment, expectedBetaPayment)
      ) {
        destination = checkoutUrl({
          error: "payment_record_failed",
          packageId,
          applicationId: selectedPackage.applicationId,
        });
        return;
      }

      let paymentRecordId = existingBetaPayment?.id ?? null;
      if (!paymentRecordId) {
        const now = new Date().toISOString();
        const { data: insertedPayment, error: paymentError } = await adminClient
          .from("payment_records")
          .insert({
            application_id: selectedPackage.applicationId,
            applicant_id: applicantId,
            order_id: orderId,
            visa_package_id: selectedPackage.packageId,
            auth_user_id: context.user.id,
            provider: "beta",
            provider_session_id: null,
            provider_payment_id: providerPaymentId,
            amount_cents: 0,
            currency: selectedPackage.agencyFee.currency,
            status: "paid",
            fee_type: "agency_fee",
            receipt_url: null,
            paid_at: now,
            metadata: {
              source: "client_checkout",
              user_id: context.user.id,
              applicant_id: applicantId,
              application_id: selectedPackage.applicationId,
              visa_package_id: selectedPackage.packageId,
              beta: {
                ...betaDescriptor(waiverAccess, selectedPackage.agencyFee.cents),
              },
            },
            created_at: now,
            updated_at: now,
          })
          .select("id")
          .single();
        if (paymentError || !insertedPayment) {
          // A concurrent retry may have won the partial unique index. Accept
          // only the exact deterministic waiver record; every other insert
          // failure remains fail-closed.
          const { data: concurrentPayment, error: concurrentPaymentError } = await adminClient
            .from("payment_records")
            .select(betaPaymentColumns)
            .eq("provider", "beta")
            .eq("provider_payment_id", providerPaymentId)
            .eq("application_id", selectedPackage.applicationId)
            .maybeSingle();
          if (
            concurrentPaymentError
            || !isMatchingBetaWaiverPayment(concurrentPayment, expectedBetaPayment)
          ) {
            destination = checkoutUrl({
              error: "payment_record_failed",
              packageId,
              applicationId: selectedPackage.applicationId,
            });
            return;
          }
          paymentRecordId = concurrentPayment.id;
        } else {
          paymentRecordId = insertedPayment.id;
        }
      }

      await advanceApplicationAfterConfirmedPayment(
        adminClient as unknown as StripeSupabaseClient,
        {
          applicationId: selectedPackage.applicationId,
          applicantId,
          paymentRecordId,
          stripeEventId: `beta-waiver:${waiverAccess.grantId}:${selectedPackage.applicationId}`,
          provider: "beta",
        },
      );
      if (orderId) {
        const paidAt = new Date().toISOString();
        const { error: orderPaymentError } = await adminClient
          .from("order")
          .update({ status: "paid", paid_at: paidAt, updated_at: paidAt })
          .eq("id", orderId)
          .in("status", ["draft", "pending"]);
        if (orderPaymentError) throw orderPaymentError;
      }
      destination = selectedPackage.nextStep.href;
      return;
    }

    const stripe = createStripeClient();
    const appBaseUrl = await getAppBaseUrl();
    if (!stripe || !appBaseUrl) {
      destination = checkoutUrl({
        error: "stripe_unconfigured",
        packageId,
        ...(applicationId ? { applicationId } : {}),
      });
      return;
    }

    if (
      !betaAccess &&
      selectedPackage.latestPayment?.status === "pending" &&
      selectedPackage.latestPayment.provider_session_id
    ) {
      const existingSession = await stripe.checkout.sessions.retrieve(
        selectedPackage.latestPayment.provider_session_id,
      );
      if (existingSession.status === "open" && existingSession.url) {
        destination = existingSession.url;
        return;
      }
      if (existingSession.status === "expired") {
        await adminClient
          .from("payment_records")
          .update({ status: "expired", updated_at: new Date().toISOString() })
          .eq("id", selectedPackage.latestPayment.id);
      }
    }

    const amountDueCents = Math.max(0, selectedPackage.agencyFee.cents - (betaAccess?.discountCents ?? 0));
    if (amountDueCents <= 0) {
      destination = checkoutUrl({ error: "payment_record_failed", packageId, ...(applicationId ? { applicationId } : {}) });
      return;
    }
    const paymentRecordId = betaAccess && selectedPackage.applicationId
      ? deterministicCheckoutUuid("payment", selectedPackage.applicationId)
      : undefined;
    const now = new Date().toISOString();
    const betaDetails = betaAccess ? betaDescriptor(betaAccess, selectedPackage.agencyFee.cents) : null;
    const paymentMetadata = {
      source: "client_checkout",
      user_id: context.user.id,
      applicant_id: context.applicantProfile?.id ?? null,
      application_id: selectedPackage.applicationId,
      visa_package_id: selectedPackage.packageId,
      government_fee_mode: selectedPackage.governmentFee.mode,
      government_fee_amount_label: selectedPackage.governmentFee.amountLabel,
      ...(betaDetails ? { beta: betaDetails, beta_attempt: 1 } : {}),
    };
    const paymentColumns = "id,application_id,applicant_id,auth_user_id,order_id,visa_package_id,provider,provider_session_id,amount_cents,currency,status,fee_type,metadata";
    const discountedExpectation = paymentRecordId && betaDetails && applicantId && orderId && selectedPackage.applicationId
      ? {
          id: paymentRecordId,
          applicationId: selectedPackage.applicationId,
          applicantId,
          orderId,
          packageId: selectedPackage.packageId,
          authUserId: context.user.id,
          amountCents: amountDueCents,
          currency: selectedPackage.agencyFee.currency,
          beta: betaDetails,
        } satisfies DiscountedPaymentExpectation
      : null;
    let usablePaymentRecord: { id: string; provider_session_id?: string | null; status?: string; metadata?: Record<string, unknown> } | null = null;

    if (discountedExpectation) {
      const { data: existingDiscounted, error: existingDiscountedError } = await adminClient
        .from("payment_records")
        .select(paymentColumns)
        .eq("id", paymentRecordId)
        .maybeSingle();
      if (existingDiscountedError) throw existingDiscountedError;
      usablePaymentRecord = existingDiscounted
        ? matchingDiscountedPayment(existingDiscounted, discountedExpectation)
        : null;
      if (existingDiscounted && !usablePaymentRecord) {
        destination = checkoutUrl({ error: "payment_record_failed", packageId, applicationId: discountedExpectation.applicationId });
        return;
      }
      if (usablePaymentRecord?.status === "paid") {
        destination = selectedPackage.nextStep.href;
        return;
      }
      if (usablePaymentRecord?.status === "pending" && usablePaymentRecord.provider_session_id) {
        const priorSession = await stripe.checkout.sessions.retrieve(usablePaymentRecord.provider_session_id);
        if (priorSession.status === "open" && priorSession.url) {
          destination = priorSession.url;
          return;
        }
        if (priorSession.status === "expired") usablePaymentRecord.status = "expired";
      }
      if (usablePaymentRecord && (usablePaymentRecord.status === "failed" || usablePaymentRecord.status === "expired")) {
        const priorAttempt = Number(usablePaymentRecord.metadata?.beta_attempt);
        const nextAttempt = Number.isInteger(priorAttempt) && priorAttempt > 0 ? priorAttempt + 1 : 2;
        const healedMetadata = { ...usablePaymentRecord.metadata, beta_attempt: nextAttempt };
        const { error: healError } = await adminClient
          .from("payment_records")
          .update({
            provider_session_id: null,
            provider_payment_id: null,
            status: "pending",
            metadata: healedMetadata,
            updated_at: new Date().toISOString(),
          })
          .eq("id", usablePaymentRecord.id)
          .in("status", ["failed", "expired"]);
        if (healError) throw healError;
        usablePaymentRecord = { ...usablePaymentRecord, provider_session_id: null, status: "pending", metadata: healedMetadata };
      }
    }

    if (!usablePaymentRecord) {
      const { data: insertedPayment, error: paymentError } = await adminClient
        .from("payment_records")
        .insert({
          ...(paymentRecordId ? { id: paymentRecordId } : {}),
          application_id: selectedPackage.applicationId,
          applicant_id: context.applicantProfile?.id ?? null,
          auth_user_id: context.user.id,
          order_id: orderId,
          visa_package_id: selectedPackage.packageId,
          provider: "stripe",
          provider_session_id: null,
          provider_payment_id: null,
          amount_cents: amountDueCents,
          currency: selectedPackage.agencyFee.currency,
          status: "pending",
          fee_type: "agency_fee",
          receipt_url: null,
          metadata: paymentMetadata,
          created_at: now,
          updated_at: now,
        })
        .select("id")
        .single();
      usablePaymentRecord = insertedPayment ? { id: insertedPayment.id } : null;
      if ((paymentError || !usablePaymentRecord) && discountedExpectation) {
        const { data: concurrentPayment, error: concurrentError } = await adminClient
          .from("payment_records")
          .select(paymentColumns)
          .eq("id", paymentRecordId)
          .maybeSingle();
        if (concurrentError) throw concurrentError;
        usablePaymentRecord = matchingDiscountedPayment(concurrentPayment, discountedExpectation);
      }
    }
    if (!usablePaymentRecord) {
      destination = checkoutUrl({
        error: "payment_record_failed",
        packageId,
        ...(selectedPackage.applicationId ? { applicationId: selectedPackage.applicationId } : {}),
      });
      return;
    }

    const successUrl = new URL("/client/checkout", appBaseUrl);
    successUrl.searchParams.set("status", "success");
    successUrl.searchParams.set("packageId", selectedPackage.packageId);
    if (selectedPackage.applicationId) {
      successUrl.searchParams.set("applicationId", selectedPackage.applicationId);
    }
    successUrl.searchParams.set("session_id", "{CHECKOUT_SESSION_ID}");

    const cancelUrl = new URL("/client/checkout", appBaseUrl);
    cancelUrl.searchParams.set("status", "cancelled");
    cancelUrl.searchParams.set("packageId", selectedPackage.packageId);
    if (selectedPackage.applicationId) {
      cancelUrl.searchParams.set("applicationId", selectedPackage.applicationId);
    }

    const paymentMethodTypes = stripeCheckoutPaymentMethodsFor(
      selectedPackage.country,
      selectedPackage.visaType,
    );

    const betaAttempt = Number(usablePaymentRecord.metadata?.beta_attempt) || 1;
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: context.user.email,
      line_items: [
        {
          price_data: {
            currency: selectedPackage.agencyFee.currency.toLowerCase(),
            unit_amount: amountDueCents,
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
      payment_method_types: paymentMethodTypes,
      payment_method_options: paymentMethodTypes.includes("wechat_pay")
        ? { wechat_pay: { client: "web" } }
        : undefined,
      client_reference_id: usablePaymentRecord.id,
      metadata: {
        paymentRecordId: usablePaymentRecord.id,
        userId: context.user.id,
        applicantId: context.applicantProfile?.id ?? "",
        applicationId: selectedPackage.applicationId ?? "",
        visaPackageId: selectedPackage.packageId,
        feeType: "agency_fee",
        ...(orderId ? { orderId } : {}),
        ...(betaAccess ? { betaGrantId: betaAccess.grantId, betaDeliveryMethod: betaAccess.deliveryMethod } : {}),
      },
      payment_intent_data: {
        metadata: {
          paymentRecordId: usablePaymentRecord.id,
          userId: context.user.id,
          applicantId: context.applicantProfile?.id ?? "",
          applicationId: selectedPackage.applicationId ?? "",
          visaPackageId: selectedPackage.packageId,
          feeType: "agency_fee",
        },
      },
      invoice_creation: {
        enabled: true,
        invoice_data: {
          description: `${selectedPackage.packageName} VIZA agency fee`,
          metadata: {
            paymentRecordId: usablePaymentRecord.id,
            userId: context.user.id,
            applicantId: context.applicantProfile?.id ?? "",
            applicationId: selectedPackage.applicationId ?? "",
            visaPackageId: selectedPackage.packageId,
            feeType: "agency_fee",
          },
        },
      },
      custom_text: {
        submit: {
          message:
            "This Stripe Checkout charges only the VIZA agency fee. When an official fee is due, VIZA creates a secure virtual card and pays the government portal on your behalf.",
        },
      },
    }, betaAccess && orderId ? { idempotencyKey: `client-beta-checkout:${orderId}:${betaAttempt}` } : undefined);

    if (!session.url) {
      await adminClient
        .from("payment_records")
        .update({ status: "failed", updated_at: new Date().toISOString() })
          .eq("id", usablePaymentRecord.id);
      destination = checkoutUrl({ error: "checkout_unavailable", packageId });
      return;
    }

    await adminClient
      .from("payment_records")
      .update({
        provider_session_id: session.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", usablePaymentRecord.id);

    destination = session.url;
  } catch (error) {
    console.error("[checkout] Failed to start Stripe Checkout:", error);
  } finally {
    redirect(destination);
  }
}
