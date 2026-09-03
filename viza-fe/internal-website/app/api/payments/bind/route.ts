import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { disableAirwallexPaymentConsent } from "@/lib/airwallex/client";
import { getCommercialAuthenticatedUser } from "@/lib/payments/commercial-session";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BINDING_FEE_TYPE = "payment_method_binding";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type BindingMetadata = {
  card_nickname?: unknown;
  airwallex?: {
    payment_consent_id?: unknown;
    payment_method?: unknown;
  };
  settings?: {
    is_default?: unknown;
    label?: unknown;
    method?: unknown;
  };
};

type BindingRow = {
  id: string;
  provider: string;
  status: string;
  provider_payment_id: string | null;
  metadata: unknown;
  updated_at: string | null;
};

function metadata(value: unknown): BindingMetadata {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as BindingMetadata)
    : {};
}

function methodForProvider(provider: string, value: BindingMetadata) {
  const declaredMethod = value.settings?.method;
  if (declaredMethod === "bank_card" || declaredMethod === "wechat_pay" || declaredMethod === "alipay") {
    return declaredMethod;
  }
  if (provider === "airwallex" || provider === "stripe") return "bank_card";
  if (provider === "wechat_pay" || provider === "alipay") return provider;
  return null;
}

function providerLabel(provider: string) {
  if (provider === "wechat_pay") return "WeChat Pay";
  if (provider === "alipay") return "Alipay";
  return "Card";
}

function cardIdentifier(paymentMethod: unknown): string {
  if (!paymentMethod || typeof paymentMethod !== "object") return "Card · verified";
  const card = (paymentMethod as { card?: unknown }).card;
  const source = card && typeof card === "object" ? card : paymentMethod;
  const object = source as Record<string, unknown>;
  const brand = typeof object.brand === "string" && object.brand.trim() ? object.brand.trim() : "Card";
  const last4 = typeof object.last4 === "string" && object.last4.trim() ? object.last4.trim() : null;
  return last4 ? `${brand.toUpperCase()} · **** ${last4}` : `${brand.toUpperCase()} · verified`;
}

function toAccount(row: BindingRow, fallbackDefault: boolean) {
  const value = metadata(row.metadata);
  const method = methodForProvider(row.provider, value);
  if (!method) return null;
  const label =
    (typeof value.settings?.label === "string" && value.settings.label.trim()) ||
    (typeof value.card_nickname === "string" && value.card_nickname.trim()) ||
    (method === "bank_card" ? "Card" : providerLabel(method));
  const identifier =
    method === "bank_card"
      ? cardIdentifier(value.airwallex?.payment_method)
      : `${providerLabel(method)} · authorized`;

  return {
    id: row.id,
    method,
    label,
    identifier,
    isDefault: value.settings?.is_default === true || fallbackDefault,
    verificationStatus: row.status === "bound" ? "bound" : "requires_action",
    providerReference: row.provider_payment_id ?? row.id,
  };
}

async function ownedBinding(applicantId: string, bindingId: string) {
  return createAdminClient()
    .from("payment_records")
    .select("id, provider, status, provider_payment_id, metadata, updated_at")
    .eq("id", bindingId)
    .eq("applicant_id", applicantId)
    .eq("fee_type", BINDING_FEE_TYPE)
    .maybeSingle();
}

export async function GET() {
  const user = await getCommercialAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await createAdminClient()
    .from("payment_records")
    .select("id, provider, status, provider_payment_id, metadata, updated_at")
    .eq("applicant_id", user.id)
    .eq("fee_type", BINDING_FEE_TYPE)
    .eq("status", "bound")
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("[payment-bindings-list]", error.message);
    return NextResponse.json({ error: "Could not load payment methods." }, { status: 500 });
  }

  const rows = (data ?? []) as BindingRow[];
  const declaredDefaultIndex = rows.findIndex(
    (row) => metadata(row.metadata).settings?.is_default === true,
  );
  const defaultIndex = declaredDefaultIndex >= 0 ? declaredDefaultIndex : 0;
  const defaultId = rows[defaultIndex]?.id ?? null;
  const accounts = rows
    .map((row) => toAccount(row, row.id === defaultId))
    .filter((account): account is NonNullable<typeof account> => account !== null)
    .map((account) => ({ ...account, isDefault: account.id === defaultId }));

  return NextResponse.json({ accounts });
}

export async function PATCH(request: Request) {
  const user = await getCommercialAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    bindingId?: unknown;
    operation?: unknown;
    label?: unknown;
  } | null;
  const bindingId = typeof body?.bindingId === "string" ? body.bindingId : "";
  if (!UUID_PATTERN.test(bindingId)) {
    return NextResponse.json({ error: "Invalid payment method." }, { status: 400 });
  }

  if (body?.operation === "set_default") {
    const { data, error } = await createAdminClient().rpc("set_default_client_payment_binding", {
      p_applicant_id: user.id,
      p_binding_id: bindingId,
    });
    if (error || data !== true) {
      return NextResponse.json({ error: "Could not update the default payment method." }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  }

  if (body?.operation !== "rename") {
    return NextResponse.json({ error: "Unsupported payment-method update." }, { status: 400 });
  }
  const label = typeof body.label === "string" ? body.label.trim() : "";
  if (!label || label.length > 80) {
    return NextResponse.json({ error: "Enter a nickname of 80 characters or fewer." }, { status: 400 });
  }

  const { data: record, error: lookupError } = await ownedBinding(user.id, bindingId);
  if (lookupError || !record || record.status !== "bound") {
    return NextResponse.json({ error: "Payment method not found." }, { status: 404 });
  }
  const value = metadata(record.metadata);
  const { error } = await createAdminClient()
    .from("payment_records")
    .update({
      metadata: {
        ...value,
        settings: { ...value.settings, label },
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", record.id)
    .eq("applicant_id", user.id);
  if (error) return NextResponse.json({ error: "Could not rename the payment method." }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const user = await getCommercialAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const bindingId = new URL(request.url).searchParams.get("id") ?? "";
  if (!UUID_PATTERN.test(bindingId)) {
    return NextResponse.json({ error: "Invalid payment method." }, { status: 400 });
  }
  const { data: record, error: lookupError } = await ownedBinding(user.id, bindingId);
  if (lookupError || !record || record.status !== "bound") {
    return NextResponse.json({ error: "Payment method not found." }, { status: 404 });
  }

  const value = metadata(record.metadata);
  if (record.provider !== "airwallex") {
    return NextResponse.json(
      { error: "This payment method must be removed through its provider." },
      { status: 409 },
    );
  }
  const consentId =
    (typeof value.airwallex?.payment_consent_id === "string" && value.airwallex.payment_consent_id) ||
    record.provider_payment_id;
  if (!consentId) {
    return NextResponse.json({ error: "Payment consent was not found." }, { status: 409 });
  }

  try {
    await disableAirwallexPaymentConsent({
      paymentConsentId: consentId,
      requestId: `settings-disable-${randomUUID()}`,
    });
  } catch (error) {
    console.error("[payment-binding-disable]", error);
    return NextResponse.json({ error: "The provider could not disable this payment method." }, { status: 502 });
  }

  const { error } = await createAdminClient()
    .from("payment_records")
    .update({
      status: "cancelled",
      metadata: {
        ...value,
        settings: {
          ...value.settings,
          is_default: false,
          disabled_at: new Date().toISOString(),
        },
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", record.id)
    .eq("applicant_id", user.id);
  if (error) {
    console.error("[payment-binding-disable-persist]", error.message);
    return NextResponse.json(
      { error: "The provider disabled the method, but VIZA could not refresh the list." },
      { status: 500 },
    );
  }

  if (value.settings?.is_default === true) {
    const admin = createAdminClient();
    const { data: replacement } = await admin
      .from("payment_records")
      .select("id")
      .eq("applicant_id", user.id)
      .eq("fee_type", BINDING_FEE_TYPE)
      .eq("status", "bound")
      .neq("id", record.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (replacement?.id) {
      const { error: defaultError } = await admin.rpc("set_default_client_payment_binding", {
        p_applicant_id: user.id,
        p_binding_id: replacement.id,
      });
      if (defaultError) {
        console.error("[payment-binding-disable-default]", defaultError.message);
      }
    }
  }

  return NextResponse.json({ success: true });
}
