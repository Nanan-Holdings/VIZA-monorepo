import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { mailReceiptOnPaid } from "@/app/actions/receipts";
import { enqueueRunnerJob } from "@/lib/queue/enqueue";
import {
  AGENCY_FEE_TYPE,
  STRIPE_PROVIDER,
  StripeRouteConfigError,
  advanceApplicationAfterConfirmedPayment,
  chargeReceiptUrl,
  createStripeAdminClient,
  extractVizaMetadata,
  findLatestPaymentRecordByApplication,
  findPaymentRecord,
  getApplicantEmail,
  getStripeClient,
  getStripeWebhookSecret,
  insertApplicationEventOnce,
  insertNotificationEventOnce,
  invoiceReceiptUrl,
  isAgencyFeeMetadata,
  jsonError,
  normalizeCurrency,
  paymentIntentReceiptUrl,
  stripeObjectId,
  upsertPaymentRecord,
  type JsonObject,
  type PaymentRecordInput,
  type PaymentRecordRow,
  type StripeSupabaseClient,
  type VizaStripeMetadata,
} from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function checkoutSessionStatus(session: Stripe.Checkout.Session): string {
  if (session.payment_status === "paid") return "paid";
  if (session.status === "expired") return "expired";
  if (session.payment_status === "unpaid" && session.status === "complete") return "failed";
  return "pending";
}

function paymentIntentStatus(paymentIntent: Stripe.PaymentIntent, eventType: string): string {
  if (eventType === "payment_intent.succeeded" || paymentIntent.status === "succeeded") {
    return "paid";
  }
  if (eventType === "payment_intent.canceled" || paymentIntent.status === "canceled") {
    return "canceled";
  }
  if (eventType === "payment_intent.payment_failed") return "failed";
  return "pending";
}

function refundStatus(params: {
  refundStatus: string | null;
  refundAmount: number | null;
  record: PaymentRecordRow | null;
}): string {
  if (params.refundStatus === "failed" || params.refundStatus === "canceled") {
    return "refund_failed";
  }
  if (params.refundStatus && !["succeeded", "requires_action"].includes(params.refundStatus)) {
    return "refund_pending";
  }
  if (!params.record || params.refundAmount === null) return "refunded";
  return params.refundAmount >= params.record.amount_cents ? "refunded" : "partially_refunded";
}

function buildStripeMetadata(params: {
  event: Stripe.Event;
  metadata: VizaStripeMetadata;
  sessionId?: string | null;
  paymentIntentId?: string | null;
  chargeId?: string | null;
  invoiceId?: string | null;
  refundId?: string | null;
  stripeStatus?: string | null;
}): JsonObject {
  return {
    fee_type: AGENCY_FEE_TYPE,
    stripe: {
      event_id: params.event.id,
      event_type: params.event.type,
      checkout_session_id: params.sessionId ?? undefined,
      payment_intent_id: params.paymentIntentId ?? undefined,
      charge_id: params.chargeId ?? undefined,
      invoice_id: params.invoiceId ?? undefined,
      refund_id: params.refundId ?? undefined,
      status: params.stripeStatus ?? undefined,
    },
    payment_record_id: params.metadata.paymentRecordId ?? undefined,
  };
}

async function getRecordOrNull(
  adminClient: StripeSupabaseClient,
  identifiers: {
    paymentRecordId?: string | null;
    providerSessionId?: string | null;
    providerPaymentId?: string | null;
    applicationId?: string | null;
  },
): Promise<PaymentRecordRow | null> {
  return findPaymentRecord(adminClient, identifiers);
}

async function queuePaymentOutcome(
  adminClient: StripeSupabaseClient,
  params: {
    event: Stripe.Event;
    record: PaymentRecordRow;
    templateKey: string;
    eventType: string;
    message: string;
    recipient: string | null;
    extraPayload?: JsonObject;
  },
) {
  const eventMetadata = {
    provider: STRIPE_PROVIDER,
    stripe_event_id: params.event.id,
    stripe_event_type: params.event.type,
    payment_record_id: params.record.id,
    payment_status: params.record.status,
    ...(params.extraPayload ?? {}),
  };

  await insertApplicationEventOnce(adminClient, {
    applicationId: params.record.application_id,
    applicantId: params.record.applicant_id,
    eventType: params.eventType,
    message: params.message,
    metadata: eventMetadata,
    dedupe: {
      stripe_event_id: params.event.id,
    },
  });

  await insertNotificationEventOnce(adminClient, {
    applicationId: params.record.application_id,
    applicantId: params.record.applicant_id,
    templateKey: params.templateKey,
    recipient: params.recipient,
    payload: eventMetadata,
    dedupe: {
      payment_record_id: params.record.id,
    },
  });
}

async function finalizePaidRecord(
  adminClient: StripeSupabaseClient,
  event: Stripe.Event,
  record: PaymentRecordRow,
  recipient: string | null,
) {
  // 1. 执行 HEAD 原有的通知队列记录
  await queuePaymentOutcome(adminClient, {
    event,
    record,
    templateKey: "agency_fee_payment_confirmed",
    eventType: "agency_fee_paid",
    message: "VIZA agency fee payment confirmed by Stripe.",
    recipient,
  });

  // 2. 推进工作流状态
  const advancement = await advanceApplicationAfterConfirmedPayment(adminClient, {
    applicationId: record.application_id,
    applicantId: record.applicant_id,
    paymentRecordId: record.id,
    stripeEventId: event.id,
  });

  if (advancement.status) {
    await insertNotificationEventOnce(adminClient, {
      applicationId: record.application_id,
      applicantId: record.applicant_id,
      templateKey: "application_next_step_ready",
      recipient,
      payload: {
        provider: STRIPE_PROVIDER,
        stripe_event_id: event.id,
        payment_record_id: record.id,
        application_status: advancement.status,
        advanced: advancement.advanced,
      },
      dedupe: {
        payment_record_id: record.id,
        application_status: advancement.status,
      },
    });
  }

  // 3. 发送系统收据邮件（使用 IIFE 异步自执行块 + try-catch 绕过 PromiseLike 局限）
  (async () => {
    try {
      await mailReceiptOnPaid(record.id);
    } catch (err: any) {
      console.error("[receipts] mailReceiptOnPaid failed:", err);
    }
  })();

  // 4. 彻底重构：弃用 .then().catch() 链，改用独立的 async IIFE 执行块，100% 解决 .catch 报错问题
  const appId = record.application_id;
  if (appId) {
    (async () => {
      try {
        const { data: app } = await adminClient
          .from("applications")
          .select("country")
          .eq("id", appId)
          .maybeSingle();

        if (app?.country) {
          await enqueueRunnerJob(appId, app.country, {
            correlationId: `stripe:${record.id}`,
          });
        }
      } catch (err: any) {
        console.error("[queue] asynchronous enqueueRunnerJob execution collapsed:", err);
      }
    })();
  }
}

async function handleCheckoutSessionEvent(
  adminClient: StripeSupabaseClient,
  event: Stripe.Event,
) {
  const eventSession = event.data.object as Stripe.Checkout.Session;
  const stripe = getStripeClient();
  const session = await stripe.checkout.sessions.retrieve(eventSession.id, {
    expand: ["payment_intent.latest_charge", "invoice"],
  });
  const metadata = extractVizaMetadata(session.metadata);
  const existingRecord = await getRecordOrNull(adminClient, {
    paymentRecordId: metadata.paymentRecordId,
    providerSessionId: session.id,
    providerPaymentId: stripeObjectId(session.payment_intent),
    applicationId: metadata.applicationId,
  });

  if (!isAgencyFeeMetadata(metadata) && !existingRecord) return;

  const paymentIntentId = stripeObjectId(session.payment_intent);
  const receiptUrl =
    typeof session.payment_intent === "object"
      ? paymentIntentReceiptUrl(session.payment_intent)
      : invoiceReceiptUrl(session.invoice);
  const status = checkoutSessionStatus(session);
  const amountCents = session.amount_total ?? existingRecord?.amount_cents ?? 0;
  const currency = normalizeCurrency(session.currency ?? existingRecord?.currency);

  if (amountCents <= 0) return;

  const record = await upsertPaymentRecord(adminClient, {
    paymentRecordId: metadata.paymentRecordId,
    applicationId: metadata.applicationId ?? existingRecord?.application_id ?? null,
    applicantId: metadata.applicantId ?? existingRecord?.applicant_id ?? null,
    visaPackageId: metadata.visaPackageId ?? existingRecord?.visa_package_id ?? null,
    providerSessionId: session.id,
    providerPaymentId: paymentIntentId,
    amountCents,
    currency,
    status,
    receiptUrl,
    metadata: buildStripeMetadata({
      event,
      metadata,
      sessionId: session.id,
      paymentIntentId,
      invoiceId: stripeObjectId(session.invoice),
      stripeStatus: session.payment_status,
    }),
  });

  const recipient =
    session.customer_details?.email ??
    session.customer_email ??
    (await getApplicantEmail(adminClient, record.applicant_id));

  if (status === "paid") {
    await finalizePaidRecord(adminClient, event, record, recipient);
  } else if (["failed", "expired"].includes(status)) {
    await queuePaymentOutcome(adminClient, {
      event,
      record,
      templateKey: "agency_fee_payment_failed",
      eventType: "agency_fee_payment_failed",
      message: "Stripe reported that the agency fee payment did not complete.",
      recipient,
    });
  }
}

async function handlePaymentIntentEvent(
  adminClient: StripeSupabaseClient,
  event: Stripe.Event,
) {
  const eventIntent = event.data.object as Stripe.PaymentIntent;
  const stripe = getStripeClient();
  const paymentIntent = await stripe.paymentIntents.retrieve(eventIntent.id, {
    expand: ["latest_charge"],
  });
  const metadata = extractVizaMetadata(paymentIntent.metadata);
  const existingRecord = await getRecordOrNull(adminClient, {
    paymentRecordId: metadata.paymentRecordId,
    providerPaymentId: paymentIntent.id,
    applicationId: metadata.applicationId,
  });

  if (!isAgencyFeeMetadata(metadata) && !existingRecord) return;

  const status = paymentIntentStatus(paymentIntent, event.type);
  const record = await upsertPaymentRecord(adminClient, {
    paymentRecordId: metadata.paymentRecordId,
    applicationId: metadata.applicationId ?? existingRecord?.application_id ?? null,
    applicantId: metadata.applicantId ?? existingRecord?.applicant_id ?? null,
    visaPackageId: metadata.visaPackageId ?? existingRecord?.visa_package_id ?? null,
    providerSessionId: existingRecord?.provider_session_id ?? null,
    providerPaymentId: paymentIntent.id,
    amountCents: paymentIntent.amount_received || paymentIntent.amount || existingRecord?.amount_cents || 0,
    currency: normalizeCurrency(paymentIntent.currency ?? existingRecord?.currency),
    status,
    receiptUrl: paymentIntentReceiptUrl(paymentIntent),
    metadata: buildStripeMetadata({
      event,
      metadata,
      sessionId: existingRecord?.provider_session_id,
      paymentIntentId: paymentIntent.id,
      chargeId: stripeObjectId(paymentIntent.latest_charge),
      stripeStatus: paymentIntent.status,
    }),
  });

  const recipient = await getApplicantEmail(adminClient, record.applicant_id);

  if (status === "paid") {
    await finalizePaidRecord(adminClient, event, record, recipient);
  } else if (["failed", "canceled"].includes(status)) {
    await queuePaymentOutcome(adminClient, {
      event,
      record,
      templateKey: "agency_fee_payment_failed",
      eventType: "agency_fee_payment_failed",
      message: "Stripe reported that the agency fee payment did not complete.",
      recipient,
    });
  }
}

async function handleChargeEvent(
  adminClient: StripeSupabaseClient,
  event: Stripe.Event,
) {
  const charge = event.data.object as Stripe.Charge;
  const metadata = extractVizaMetadata(charge.metadata);
  const paymentIntentId = stripeObjectId(charge.payment_intent);
  const existingRecord = await getRecordOrNull(adminClient, {
    paymentRecordId: metadata.paymentRecordId,
    providerPaymentId: paymentIntentId,
    applicationId: metadata.applicationId,
  });

  if (!isAgencyFeeMetadata(metadata) && !existingRecord) return;

  const isRefund = event.type === "charge.refunded" || (charge.amount_refunded ?? 0) > 0;
  const status = isRefund
    ? charge.amount_refunded >= charge.amount
      ? "refunded"
      : "partially_refunded"
    : charge.paid
      ? "paid"
      : "pending";

  const record = await upsertPaymentRecord(adminClient, {
    paymentRecordId: metadata.paymentRecordId,
    applicationId: metadata.applicationId ?? existingRecord?.application_id ?? null,
    applicantId: metadata.applicantId ?? existingRecord?.applicant_id ?? null,
    visaPackageId: metadata.visaPackageId ?? existingRecord?.visa_package_id ?? null,
    providerSessionId: existingRecord?.provider_session_id ?? null,
    providerPaymentId: paymentIntentId,
    amountCents: charge.amount || existingRecord?.amount_cents || 0,
    currency: normalizeCurrency(charge.currency ?? existingRecord?.currency),
    status,
    receiptUrl: chargeReceiptUrl(charge),
    metadata: buildStripeMetadata({
      event,
      metadata,
      sessionId: existingRecord?.provider_session_id,
      paymentIntentId: paymentIntentId,
      chargeId: charge.id,
      stripeStatus: charge.status,
    }),
  });

  const recipient =
    charge.billing_details.email ?? (await getApplicantEmail(adminClient, record.applicant_id));

  if (status === "paid") {
    await finalizePaidRecord(adminClient, event, record, recipient);
  } else if (status === "refunded" || status === "partially_refunded") {
    await queuePaymentOutcome(adminClient, {
      event,
      record,
      templateKey: "agency_fee_refund_updated",
      eventType: "agency_fee_refund_updated",
      message: "Stripe reported an agency fee refund update.",
      recipient,
      extraPayload: {
        refund_status: status,
        refunded_amount_cents: charge.amount_refunded,
      },
    });
  }
}

async function handleRefundEvent(
  adminClient: StripeSupabaseClient,
  event: Stripe.Event,
) {
  const refund = event.data.object as Stripe.Refund;
  const metadata = extractVizaMetadata(refund.metadata);
  const paymentIntentId = stripeObjectId(refund.payment_intent);
  const existingRecord = await getRecordOrNull(adminClient, {
    paymentRecordId: metadata.paymentRecordId,
    providerPaymentId: paymentIntentId,
    applicationId: metadata.applicationId,
  });

  if (!existingRecord && !isAgencyFeeMetadata(metadata)) return;

  const status = refundStatus({
    refundStatus: refund.status,
    refundAmount: refund.amount,
    record: existingRecord,
  });

  const record = await upsertPaymentRecord(adminClient, {
    paymentRecordId: metadata.paymentRecordId,
    applicationId: metadata.applicationId ?? existingRecord?.application_id ?? null,
    applicantId: metadata.applicantId ?? existingRecord?.applicant_id ?? null,
    visaPackageId: metadata.visaPackageId ?? existingRecord?.visa_package_id ?? null,
    providerSessionId: existingRecord?.provider_session_id ?? null,
    providerPaymentId: paymentIntentId,
    amountCents: existingRecord?.amount_cents ?? refund.amount,
    currency: normalizeCurrency(refund.currency ?? existingRecord?.currency),
    status,
    receiptUrl: existingRecord?.receipt_url ?? null,
    metadata: buildStripeMetadata({
      event,
      metadata,
      sessionId: existingRecord?.provider_session_id,
      paymentIntentId,
      refundId: refund.id,
      stripeStatus: refund.status,
    }),
  });

  await queuePaymentOutcome(adminClient, {
    event,
    record,
    templateKey: "agency_fee_refund_updated",
    eventType: "agency_fee_refund_updated",
    message: "Stripe reported an agency fee refund update.",
    recipient: await getApplicantEmail(adminClient, record.applicant_id),
    extraPayload: {
      refund_status: status,
      refund_id: refund.id,
      refund_amount_cents: refund.amount,
    },
  });
}

async function handleInvoiceEvent(
  adminClient: StripeSupabaseClient,
  event: Stripe.Event,
) {
  const invoice = event.data.object as Stripe.Invoice;
  const metadata = extractVizaMetadata(invoice.metadata);
  if (!isAgencyFeeMetadata(metadata) && !metadata.applicationId) return;

  const existingRecord = metadata.applicationId
    ? await findLatestPaymentRecordByApplication(adminClient, metadata.applicationId)
    : await getRecordOrNull(adminClient, { paymentRecordId: metadata.paymentRecordId });

  if (!existingRecord) return;

  const status =
    event.type === "invoice.payment_failed"
      ? "failed"
      : invoice.status === "paid" || event.type === "invoice.paid"
        ? "paid"
        : existingRecord.status;

  const recordInput: PaymentRecordInput = {
    paymentRecordId: existingRecord.id,
    applicationId: existingRecord.application_id,
    applicantId: existingRecord.applicant_id,
    visaPackageId: existingRecord.visa_package_id,
    providerSessionId: existingRecord.provider_session_id,
    providerPaymentId: existingRecord.provider_payment_id,
    amountCents: existingRecord.amount_cents,
    currency: existingRecord.currency,
    status,
    receiptUrl: invoiceReceiptUrl(invoice),
    metadata: buildStripeMetadata({
      event,
      metadata,
      sessionId: existingRecord.provider_session_id,
      paymentIntentId: existingRecord.provider_payment_id,
      invoiceId: invoice.id,
      stripeStatus: invoice.status,
    }),
  };

  const record = await upsertPaymentRecord(adminClient, recordInput);
  if (status === "paid") {
    await finalizePaidRecord(
      adminClient,
      event,
      record,
      invoice.customer_email ?? (await getApplicantEmail(adminClient, record.applicant_id)),
    );
  }
}

async function handleStripeEvent(adminClient: StripeSupabaseClient, event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
    case "checkout.session.async_payment_failed":
    case "checkout.session.expired":
      await handleCheckoutSessionEvent(adminClient, event);
      return;
    case "payment_intent.succeeded":
    case "payment_intent.payment_failed":
    case "payment_intent.canceled":
      await handlePaymentIntentEvent(adminClient, event);
      return;
    case "charge.succeeded":
    case "charge.updated":
    case "charge.refunded":
      await handleChargeEvent(adminClient, event);
      return;
    case "refund.created":
    case "refund.updated":
      await handleRefundEvent(adminClient, event);
      return;
    case "invoice.finalized":
    case "invoice.paid":
    case "invoice.payment_succeeded":
    case "invoice.payment_failed":
      await handleInvoiceEvent(adminClient, event);
      return;
    default:
      return;
  }
}

export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return jsonError("Missing Stripe signature.", 400);
  }

  let event: Stripe.Event;
  try {
    event = Stripe.webhooks.constructEvent(
      await request.text(),
      signature,
      getStripeWebhookSecret(),
    );
  } catch (error) {
    if (error instanceof StripeRouteConfigError) {
      return jsonError("Stripe webhook is not configured.", 503);
    }

    console.warn(
      "[stripe-webhook] Signature verification failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return jsonError("Invalid Stripe signature.", 400);
  }

  try {
    await handleStripeEvent(createStripeAdminClient(), event);
  } catch (error) {
    if (error instanceof StripeRouteConfigError) {
      return jsonError("Stripe webhook processing is not configured.", 503);
    }

    console.error(
      `[stripe-webhook] Failed to process ${event.type} ${event.id}:`,
      error instanceof Error ? error.message : "Unknown error",
    );
    return jsonError("Webhook processing failed.", 500);
  }

  return NextResponse.json({ received: true });
}