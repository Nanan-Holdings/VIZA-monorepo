import "server-only";

import Stripe from "stripe";
import { isAirwallexConfigured } from "@/lib/airwallex/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAlipayConfigReady } from "@/lib/alipay/client";
import { getCommercialAuthenticatedUser } from "@/lib/payments/commercial-session";
import { awardPurchasePointsForPayment } from "@/lib/rewards/purchase-points";

type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type QueryResponse<T> = {
  data: T | null;
  error: { message: string } | null;
};

interface CommercialQueryBuilder<Row> extends PromiseLike<QueryResponse<Row[]>> {
  eq(column: string, value: unknown): CommercialQueryBuilder<Row>;
  insert(values: unknown): CommercialQueryBuilder<Row>;
  limit(count: number): CommercialQueryBuilder<Row>;
  maybeSingle(): Promise<QueryResponse<Row>>;
  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }): CommercialQueryBuilder<Row>;
  select(columns?: string): CommercialQueryBuilder<Row>;
  single(): Promise<QueryResponse<Row>>;
  update(values: unknown): CommercialQueryBuilder<Row>;
}

interface CommercialAdminClient {
  from(table: "payment_records"): CommercialQueryBuilder<PaymentRecordRow>;
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
  auth_user_id?: string | null;
  paid_at?: string | null;
  failed_at?: string | null;
  cancelled_at?: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export type SubscriptionReturnState =
  | {
      tone: "success" | "warning" | "error";
      title: string;
      description: string;
    }
  | null;

export type CurrentSubscriptionStatus =
  | "free"
  | "incomplete"
  | "active"
  | "cancelled"
  | "expired";

export interface CurrentSubscriptionState {
  recordId: string | null;
  planCode: "free" | "access" | "pro";
  planName: string;
  status: CurrentSubscriptionStatus;
  statusLabel: string;
  renewalLabel: string;
  paymentMethodLabel: string;
  amountFen: number;
  countryLimitPerMonth: number | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

const FREE_SUBSCRIPTION_STATE: CurrentSubscriptionState = {
  recordId: null,
  planCode: "free",
  planName: "VIZA 申请体验版",
  status: "free",
  statusLabel: "预览中",
  renewalLabel: "暂未启用",
  paymentMethodLabel: "暂未设置",
  amountFen: 0,
  countryLimitPerMonth: null,
  currentPeriodStart: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
};

const PLAN_DETAILS: Record<
  string,
  { code: "access" | "pro"; name: string; countryLimitPerMonth: number }
> = {
  monthly_access: { code: "access", name: "Access", countryLimitPerMonth: 7 },
  monthly_pro: { code: "pro", name: "Pro", countryLimitPerMonth: 14 },
};

export function createSubscriptionAdminClient(): CommercialAdminClient {
  return createAdminClient() as unknown as CommercialAdminClient;
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

export function isWechatPayConfigured(): boolean {
  return Boolean(
    process.env.WECHAT_PAY_MCH_ID?.trim() &&
      process.env.WECHAT_PAY_APP_ID?.trim() &&
      process.env.WECHAT_PAY_API_V3_KEY?.trim() &&
      process.env.WECHAT_PAY_MERCHANT_SERIAL_NO?.trim() &&
      process.env.WECHAT_PAY_PRIVATE_KEY?.trim(),
  );
}

export function isAlipayConfigured(): boolean {
  return isAlipayConfigReady();
}

export function getPaymentProviderReadiness() {
  const airwallex = isAirwallexConfigured();
  return {
    stripe: isStripeConfigured(),
    wechat_pay: isWechatPayConfigured(),
    alipay: isAlipayConfigured(),
    airwallex_card: airwallex,
    airwallex_wechat: airwallex,
    airwallex_alipay: airwallex,
  };
}

export function createStripeClient(): Stripe | null {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) return null;
  return new Stripe(secretKey);
}

function asJsonObject(value: Json | null | undefined): Record<string, Json | undefined> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, Json | undefined>)
    : {};
}

function getJsonString(value: Json | undefined): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function addOneMonth(value: Date): Date {
  const next = new Date(value);
  next.setMonth(next.getMonth() + 1);
  return next;
}

function paymentMethodLabel(record: PaymentRecordRow): string {
  const metadata = asJsonObject(record.metadata);
  const airwallex = asJsonObject(metadata.airwallex);
  const requestedMethod = getJsonString(airwallex.requested_method);

  if (record.provider === "airwallex") {
    if (requestedMethod === "wechat") return "微信支付";
    if (requestedMethod === "alipay") return "支付宝";
    return "银行卡";
  }

  if (record.provider === "wechat_pay") return "微信支付";
  if (record.provider === "alipay") return "支付宝";
  if (record.provider === "stripe") return "银行卡";
  return "在线支付";
}

function buildCurrentSubscriptionState(record: PaymentRecordRow | null): CurrentSubscriptionState {
  if (!record) return FREE_SUBSCRIPTION_STATE;

  const metadata = asJsonObject(record.metadata);
  const subscription = asJsonObject(metadata.subscription);
  const productId = getJsonString(metadata.product_id) ?? getJsonString(metadata.productId);
  const plan = productId ? PLAN_DETAILS[productId] : null;
  if (!plan) return FREE_SUBSCRIPTION_STATE;

  const periodStartDate = new Date(record.paid_at ?? record.created_at ?? Date.now());
  const periodEndDate = addOneMonth(periodStartDate);
  const now = new Date();
  const cancelAtPeriodEnd = subscription.cancel_at_period_end === true;
  const isPaid = record.status === "paid";
  const isExpired = isPaid && periodEndDate.getTime() < now.getTime();
  const status: CurrentSubscriptionStatus = isExpired
    ? "expired"
    : isPaid
      ? cancelAtPeriodEnd
        ? "cancelled"
        : "active"
      : "incomplete";

  const statusLabel =
    status === "active"
      ? "自动续费中"
      : status === "cancelled"
        ? "已取消，到期失效"
        : status === "expired"
          ? "已到期"
          : "待确认";

  const renewalLabel =
    status === "active"
      ? `将于 ${periodEndDate.toLocaleDateString("zh-CN")} 自动续费`
      : status === "cancelled"
        ? `已取消，将于 ${periodEndDate.toLocaleDateString("zh-CN")} 到期`
        : status === "expired"
          ? "已到期，请重新选择方案"
          : "支付确认后启用";

  return {
    recordId: record.id,
    planCode: plan.code,
    planName: plan.name,
    status,
    statusLabel,
    renewalLabel,
    paymentMethodLabel: paymentMethodLabel(record),
    amountFen: record.amount_cents,
    countryLimitPerMonth: plan.countryLimitPerMonth,
    currentPeriodStart: periodStartDate.toISOString(),
    currentPeriodEnd: periodEndDate.toISOString(),
    cancelAtPeriodEnd,
  };
}

async function getLatestSubscriptionRecordForCurrentUser(): Promise<PaymentRecordRow | null> {
  const user = await getCommercialAuthenticatedUser();
  if (!user) return null;

  const { data, error } = await createSubscriptionAdminClient()
    .from("payment_records")
    .select(
      "id, application_id, applicant_id, visa_package_id, provider, provider_session_id, provider_payment_id, amount_cents, currency, status, fee_type, receipt_url, metadata, auth_user_id, paid_at, failed_at, cancelled_at, created_at, updated_at",
    )
    .eq("auth_user_id", user.id)
    .eq("fee_type", "subscription_fee")
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) throw new Error(error.message);
  return (data ?? []).find((record) => record.status === "paid" || record.status === "pending") ?? null;
}

export async function getCurrentSubscriptionForCurrentUser(): Promise<CurrentSubscriptionState> {
  return buildCurrentSubscriptionState(await getLatestSubscriptionRecordForCurrentUser());
}

export async function setCurrentSubscriptionCancelAtPeriodEnd(
  cancelAtPeriodEnd: boolean,
): Promise<CurrentSubscriptionState> {
  const record = await getLatestSubscriptionRecordForCurrentUser();
  if (!record || record.status !== "paid") {
    return buildCurrentSubscriptionState(record);
  }

  const metadata = asJsonObject(record.metadata);
  const subscription = asJsonObject(metadata.subscription);
  const now = new Date().toISOString();
  const { error } = await createSubscriptionAdminClient()
    .from("payment_records")
    .update({
      metadata: {
        ...metadata,
        subscription: {
          ...subscription,
          cancel_at_period_end: cancelAtPeriodEnd,
          cancelled_at: cancelAtPeriodEnd ? now : null,
          resumed_at: cancelAtPeriodEnd ? null : now,
        },
      },
      updated_at: now,
    })
    .eq("id", record.id);

  if (error) throw new Error(error.message);
  return getCurrentSubscriptionForCurrentUser();
}

export async function getPaymentRecordForCurrentUser(paymentId: string): Promise<PaymentRecordRow | null> {
  const user = await getCommercialAuthenticatedUser();
  if (!user) return null;

  const { data, error } = await createSubscriptionAdminClient()
    .from("payment_records")
    .select(
      "id, application_id, applicant_id, visa_package_id, provider, provider_session_id, provider_payment_id, amount_cents, currency, status, fee_type, receipt_url, metadata, auth_user_id, paid_at, failed_at, cancelled_at, created_at, updated_at",
    )
    .eq("id", paymentId)
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export async function reconcileStripeSubscriptionReturn(
  paymentId: string | null,
  sessionId: string | null,
): Promise<SubscriptionReturnState> {
  if (!paymentId || !sessionId) return null;

  const user = await getCommercialAuthenticatedUser();
  if (!user) {
    return {
      tone: "error",
      title: "请先登录以确认支付",
      description: "Stripe 已返回 VIZA，但当前浏览器会话已失效。",
    };
  }

  const stripe = createStripeClient();
  if (!stripe) {
    return {
      tone: "warning",
      title: "Stripe 尚未配置",
      description: "本地环境无法自动核验 Stripe 支付，请配置密钥后重试。",
    };
  }

  const record = await getPaymentRecordForCurrentUser(paymentId);
  if (!record || record.provider !== "stripe") {
    return {
      tone: "error",
      title: "未找到匹配的支付记录",
      description: "为了安全，VIZA 没有把这次 Stripe 返回写入你的账户。",
    };
  }

  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (session.id !== record.provider_session_id || session.metadata?.paymentRecordId !== record.id) {
    return {
      tone: "error",
      title: "支付会话不匹配",
      description: "Stripe 返回的会话与当前订阅订单不一致。",
    };
  }

  const paid = session.payment_status === "paid" || session.status === "complete";
  const now = new Date().toISOString();
  const metadata =
    record.metadata && typeof record.metadata === "object" && !Array.isArray(record.metadata)
      ? record.metadata
      : {};

  const { error } = await createSubscriptionAdminClient()
    .from("payment_records")
    .update({
      provider_payment_id:
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : typeof session.subscription === "string"
            ? session.subscription
            : null,
      status: paid ? "paid" : "pending",
      paid_at: paid ? now : record.paid_at ?? null,
      updated_at: now,
      metadata: {
        ...metadata,
        stripe: {
          checkout_session_id: session.id,
          payment_status: session.payment_status,
          session_status: session.status,
          subscription_id:
            typeof session.subscription === "string" ? session.subscription : undefined,
        },
      },
    })
    .eq("id", record.id)
    .eq("auth_user_id", user.id);

  if (error) throw new Error(error.message);

  if (paid) {
    await awardPurchasePointsForPayment({
      paymentRecordId: record.id,
      applicantId: record.applicant_id,
      userId: record.auth_user_id,
      amountCents: record.amount_cents,
      currency: record.currency,
      provider: record.provider,
    });
  }

  return paid
    ? {
        tone: "success",
        title: "支付已确认",
        description: "VIZA 已记录这笔人民币支付。订阅权益开通逻辑已预留，可在接入账户体系后启用。",
      }
    : {
        tone: "warning",
        title: "支付仍在处理中",
        description: "Stripe 已返回，但支付状态尚未最终确认。请稍后刷新页面。",
      };
}
