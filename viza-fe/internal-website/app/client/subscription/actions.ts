"use server";

import { randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createAlipayPagePayUrl } from "@/lib/alipay/client";
import {
  commercialProductFeeType,
  formatCny,
  getCommercialProduct,
  type CommercialPaymentProvider,
} from "@/lib/payments/commercial-products";
import { getCommercialAuthenticatedUser } from "@/lib/payments/commercial-session";
import { createNativeOrder } from "@/lib/wechatpay/client";
import {
  createStripeClient,
  createSubscriptionAdminClient,
  isAlipayConfigured,
  isStripeConfigured,
  isWechatPayConfigured,
} from "./data";

function getFormString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function normalizeProvider(value: string): CommercialPaymentProvider | null {
  if (
    value === "stripe" ||
    value === "wechat_pay" ||
    value === "alipay" ||
    value === "airwallex_card" ||
    value === "airwallex_wechat" ||
    value === "airwallex_alipay"
  ) {
    return value;
  }
  return null;
}

function subscriptionUrl(params: Record<string, string>): string {
  const query = new URLSearchParams(params);
  return `/client/subscription?${query.toString()}`;
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

function shortTradeNo(): string {
  return `viza${randomBytes(14).toString("hex")}`;
}

function yuanAmount(amountFen: number): string {
  return (amountFen / 100).toFixed(2);
}

function isPaymentRecordStorageUnavailable(error: { message: string } | null): boolean {
  const message = error?.message.toLowerCase() ?? "";
  return (
    message.includes("payment_records") &&
    (message.includes("schema cache") ||
      message.includes("does not exist") ||
      message.includes("could not find the table"))
  );
}

export async function startCommercialCheckout(formData: FormData): Promise<void> {
  const productId = getFormString(formData, "productId");
  const provider = normalizeProvider(getFormString(formData, "provider"));
  let destination = subscriptionUrl({ error: "payment_unavailable" });

  try {
    const product = getCommercialProduct(productId);
    if (!product || !provider) {
      destination = subscriptionUrl({ error: "invalid_product" });
      return;
    }

    if (provider === "stripe" && !isStripeConfigured()) {
      destination = subscriptionUrl({ error: "stripe_unconfigured" });
      return;
    }
    if (provider === "wechat_pay" && !isWechatPayConfigured()) {
      destination = subscriptionUrl({ error: "wechat_unconfigured" });
      return;
    }
    if (provider === "alipay" && !isAlipayConfigured()) {
      destination = subscriptionUrl({ error: "alipay_unconfigured" });
      return;
    }
    if (provider.startsWith("airwallex_") && !process.env.AIRWALLEX_CLIENT_ID?.trim()) {
      destination = subscriptionUrl({ error: "airwallex_unconfigured" });
      return;
    }
    if (provider.startsWith("airwallex_") && !process.env.AIRWALLEX_API_KEY?.trim()) {
      destination = subscriptionUrl({ error: "airwallex_unconfigured" });
      return;
    }

    const user = await getCommercialAuthenticatedUser();
    if (!user) {
      destination = "/client/login";
      return;
    }

    const appBaseUrl = await getAppBaseUrl();
    if (!appBaseUrl) {
      destination = subscriptionUrl({ error: "app_url_missing" });
      return;
    }

    const now = new Date().toISOString();
    const metadata = {
      source: "client_subscription",
      product_id: product.id,
      product_kind: product.kind,
      product_name: product.name,
      product_name_zh: product.nameZh,
      amount_label: formatCny(product.amountFen),
      country: product.country,
      visa_type: product.visaType,
    };

    const { data: paymentRecord, error: insertError } = await createSubscriptionAdminClient()
      .from("payment_records")
      .insert({
        application_id: null,
        applicant_id: null,
        visa_package_id: null,
        provider: provider.startsWith("airwallex_") ? "airwallex" : provider,
        provider_session_id: null,
        provider_payment_id: null,
        amount_cents: product.amountFen,
        currency: "CNY",
        status: "pending",
        fee_type: commercialProductFeeType(product),
        receipt_url: null,
        auth_user_id: user.id,
        metadata,
        created_at: now,
        updated_at: now,
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("[subscription-payment] Failed to insert payment record:", insertError.message);
    }

    const canContinueWithoutRecord =
      Boolean(insertError) && isPaymentRecordStorageUnavailable(insertError) && provider !== "wechat_pay";

    if ((insertError || !paymentRecord) && !canContinueWithoutRecord) {
      destination = subscriptionUrl({ error: "payment_record_failed" });
      return;
    }

    const paymentId = paymentRecord?.id ?? null;
    const successUrl = new URL("/client/subscription", appBaseUrl);
    successUrl.searchParams.set("payment", "success");
    successUrl.searchParams.set("provider", provider);
    if (paymentId) successUrl.searchParams.set("paymentId", paymentId);

    const cancelUrl = new URL("/client/subscription", appBaseUrl);
    cancelUrl.searchParams.set("payment", "cancelled");
    cancelUrl.searchParams.set("provider", provider);
    if (paymentId) cancelUrl.searchParams.set("paymentId", paymentId);

    if (provider === "stripe") {
      const stripe = createStripeClient();
      if (!stripe) {
        destination = subscriptionUrl({ error: "stripe_unconfigured" });
        return;
      }

      successUrl.searchParams.set("session_id", "{CHECKOUT_SESSION_ID}");

      const stripeMetadata: Record<string, string> = {
        userId: user.id,
        productId: product.id,
        feeType: commercialProductFeeType(product),
      };
      if (paymentId) stripeMetadata.paymentRecordId = paymentId;

      const session = await stripe.checkout.sessions.create({
        mode: product.kind === "monthly" ? "subscription" : "payment",
        customer_email: user.email,
        line_items: [
          {
            price_data: {
              currency: "cny",
              unit_amount: product.amountFen,
              recurring: product.kind === "monthly" ? { interval: "month" } : undefined,
              product_data: {
                name: product.nameZh,
                description: product.descriptionZh,
              },
            },
            quantity: 1,
          },
        ],
        success_url: successUrl.toString().replace("%7BCHECKOUT_SESSION_ID%7D", "{CHECKOUT_SESSION_ID}"),
        cancel_url: cancelUrl.toString(),
        client_reference_id: paymentId ?? `${product.id}:${user.id}`,
        metadata: stripeMetadata,
        subscription_data:
          product.kind === "monthly"
            ? {
                metadata: {
                  userId: user.id,
                  productId: product.id,
                  ...(paymentId ? { paymentRecordId: paymentId } : {}),
                },
              }
            : undefined,
        payment_intent_data:
          product.kind === "pay_per_application"
            ? {
                metadata: {
                  userId: user.id,
                  productId: product.id,
                  feeType: commercialProductFeeType(product),
                  ...(paymentId ? { paymentRecordId: paymentId } : {}),
                },
              }
            : undefined,
        custom_text: {
          submit: {
            message: "本页面仅收取 VIZA 服务费，官方签证费和第三方费用如发生将单独展示。",
          },
        },
      });

      if (!session.url) {
        destination = subscriptionUrl({ error: "payment_unavailable" });
        return;
      }

      if (paymentId) {
        await createSubscriptionAdminClient()
          .from("payment_records")
          .update({
            provider_session_id: session.id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", paymentId);
      }

      destination = session.url;
      return;
    }

    if (provider.startsWith("airwallex_")) {
      if (!paymentId) {
        destination = subscriptionUrl({ error: "payment_record_failed" });
        return;
      }

      const method = provider.replace("airwallex_", "");
      await createSubscriptionAdminClient()
        .from("payment_records")
        .update({
          metadata: {
            ...metadata,
            airwallex: {
              requested_method: method,
            },
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", paymentId);

      destination = `/payments/checkout?paymentId=${encodeURIComponent(paymentId)}&method=${encodeURIComponent(method)}`;
      return;
    }

    if (provider === "wechat_pay") {
      if (!paymentId) {
        destination = subscriptionUrl({ error: "payment_record_failed" });
        return;
      }

      const outTradeNo = shortTradeNo();
      const notifyUrl = new URL("/api/payments/wechat/notify", appBaseUrl).toString();
      const nativeOrder = await createNativeOrder({
        outTradeNo,
        amountFen: product.amountFen,
        description: product.nameZh.slice(0, 120),
        notifyUrl,
      });

      await createSubscriptionAdminClient()
        .from("payment_records")
        .update({
          provider_session_id: outTradeNo,
          metadata: {
            ...metadata,
            wechat_pay: {
              code_url: nativeOrder.codeUrl,
              out_trade_no: outTradeNo,
            },
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", paymentId);

      destination = `/client/subscription/pay?paymentId=${encodeURIComponent(paymentId)}`;
      return;
    }

    const outTradeNo = shortTradeNo();
    const notifyUrl = new URL("/api/payments/alipay/notify", appBaseUrl).toString();
    const returnUrl = new URL("/client/subscription", appBaseUrl);
    returnUrl.searchParams.set("payment", "return");
    returnUrl.searchParams.set("provider", "alipay");
    if (paymentId) returnUrl.searchParams.set("paymentId", paymentId);

    const alipayUrl = createAlipayPagePayUrl({
      outTradeNo,
      subject: product.nameZh,
      totalAmountYuan: yuanAmount(product.amountFen),
      notifyUrl,
      returnUrl: returnUrl.toString(),
    });

    if (paymentId) {
      await createSubscriptionAdminClient()
        .from("payment_records")
        .update({
          provider_session_id: outTradeNo,
          metadata: {
            ...metadata,
            alipay: {
              out_trade_no: outTradeNo,
            },
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", paymentId);
    }

    destination = alipayUrl;
  } catch (error) {
    console.error(
      "[subscription-payment] Failed to start checkout:",
      error instanceof Error ? error.message : "Unknown error",
    );
  } finally {
    redirect(destination);
  }
}
