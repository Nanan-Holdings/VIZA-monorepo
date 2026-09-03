import "server-only";

import { retrieveAirwallexPaymentConsent } from "@/lib/airwallex/client";
import { createAdminClient } from "@/lib/supabase/admin";

const BINDING_FEE_TYPE = "payment_method_binding";

export type AirwallexWalletMethod = "wechat_pay" | "alipay";

type BindingMetadata = {
  airwallex?: {
    customer_id?: unknown;
    payment_consent_id?: unknown;
  };
  settings?: {
    is_default?: unknown;
    label?: unknown;
    method?: unknown;
  };
};

function asMetadata(value: unknown): BindingMetadata & Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as BindingMetadata & Record<string, unknown>)
    : {};
}

export function walletMethodFromMetadata(value: unknown): AirwallexWalletMethod | null {
  const method = asMetadata(value).settings?.method;
  return method === "wechat_pay" || method === "alipay" ? method : null;
}

function walletLabel(method: AirwallexWalletMethod): string {
  return method === "wechat_pay" ? "WeChat Pay" : "Alipay";
}

export async function syncAirwallexWalletConsent(paymentConsentId: string) {
  const admin = createAdminClient();
  const { data: record, error } = await admin
    .from("payment_records")
    .select("id, applicant_id, status, metadata")
    .eq("provider", "airwallex")
    .eq("provider_payment_id", paymentConsentId)
    .eq("fee_type", BINDING_FEE_TYPE)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!record) return null;

  const value = asMetadata(record.metadata);
  const method = walletMethodFromMetadata(value);
  const customerId = value.airwallex?.customer_id;
  if (!method || typeof customerId !== "string" || !customerId) return null;

  const consent = await retrieveAirwallexPaymentConsent(paymentConsentId);
  if (consent.id !== paymentConsentId || consent.customer_id !== customerId) {
    throw new Error("Airwallex consent ownership mismatch.");
  }

  const providerStatus = consent.status.toUpperCase();
  const nextStatus =
    providerStatus === "VERIFIED"
      ? "bound"
      : providerStatus === "DISABLED"
        ? "cancelled"
        : "requires_action";
  const now = new Date().toISOString();
  const { error: updateError } = await admin
    .from("payment_records")
    .update({
      status: nextStatus,
      updated_at: now,
      metadata: {
        ...value,
        airwallex: {
          ...value.airwallex,
          payment_consent_id: consent.id,
          payment_method: consent.payment_method ?? null,
          consent_status: providerStatus,
          synced_at: now,
        },
        settings: {
          ...value.settings,
          method,
          label:
            typeof value.settings?.label === "string" && value.settings.label.trim()
              ? value.settings.label.trim()
              : walletLabel(method),
        },
      },
    })
    .eq("id", record.id)
    .eq("applicant_id", record.applicant_id);
  if (updateError) throw new Error(updateError.message);

  if (nextStatus === "bound") {
    const { data: bindings, error: bindingsError } = await admin
      .from("payment_records")
      .select("id, metadata")
      .eq("applicant_id", record.applicant_id)
      .eq("fee_type", BINDING_FEE_TYPE)
      .eq("status", "bound")
      .limit(50);
    if (bindingsError) {
      console.error("[airwallex-wallet-consent] Default lookup failed:", bindingsError.message);
    } else {
      const hasDefault = (bindings ?? []).some(
        (binding) => asMetadata(binding.metadata).settings?.is_default === true,
      );
      if (!hasDefault) {
        const { error: defaultError } = await admin.rpc("set_default_client_payment_binding", {
          p_applicant_id: record.applicant_id,
          p_binding_id: record.id,
        });
        if (defaultError) {
          console.error("[airwallex-wallet-consent] Default update failed:", defaultError.message);
        }
      }
    }
  }

  return {
    bindingId: record.id,
    applicantId: record.applicant_id,
    method,
    status: nextStatus,
    providerStatus,
    label: walletLabel(method),
  };
}
