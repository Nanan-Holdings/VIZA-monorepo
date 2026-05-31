import "server-only";

import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";

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
  maybeSingle(): Promise<QueryResponse<Row>>;
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
  return Boolean(
    process.env.ALIPAY_APP_ID?.trim() &&
      process.env.ALIPAY_PRIVATE_KEY?.trim() &&
      process.env.ALIPAY_PUBLIC_KEY?.trim(),
  );
}

export function getPaymentProviderReadiness() {
  return {
    stripe: isStripeConfigured(),
    wechat_pay: isWechatPayConfigured(),
    alipay: isAlipayConfigured(),
  };
}

export function createStripeClient(): Stripe | null {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) return null;
  return new Stripe(secretKey);
}

export async function getPaymentRecordForCurrentUser(paymentId: string): Promise<PaymentRecordRow | null> {
  const user = await getAuthenticatedUser();
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

  const user = await getAuthenticatedUser();
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
