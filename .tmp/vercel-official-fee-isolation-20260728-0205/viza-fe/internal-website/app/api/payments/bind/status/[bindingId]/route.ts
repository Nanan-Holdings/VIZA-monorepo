import { NextResponse } from "next/server";
import { getCommercialAuthenticatedUser } from "@/lib/payments/commercial-session";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BINDING_FEE_TYPE = "payment_method_binding";

type BindingMetadata = {
  binding?: {
    method?: string;
    nonce?: string;
    expires_at?: string;
  };
};

function getBindingMetadata(value: unknown): BindingMetadata {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as BindingMetadata)
    : {};
}

function providerLabel(provider: string) {
  if (provider === "wechat_pay") return "WeChat Pay";
  if (provider === "alipay") return "Alipay";
  return "Wallet";
}

function htmlResponse(title: string, body: string, status = 200) {
  return new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head><body style="font-family:system-ui,sans-serif;padding:32px;line-height:1.5"><h1>${title}</h1><p>${body}</p></body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

export async function GET(
  request: Request,
  context: { params: Promise<{ bindingId: string }> },
) {
  const { bindingId } = await context.params;
  const url = new URL(request.url);
  const shouldComplete = url.searchParams.get("complete") === "1";
  const nonce = url.searchParams.get("nonce");
  const admin = createAdminClient();

  const { data: record, error } = await admin
    .from("payment_records")
    .select("id, applicant_id, provider, status, metadata, updated_at")
    .eq("id", bindingId)
    .eq("fee_type", BINDING_FEE_TYPE)
    .maybeSingle();

  if (error) {
    console.error("[payment-binding-status] Lookup failed:", error.message);
    return shouldComplete
      ? htmlResponse("Binding unavailable", "VIZA could not read this binding request.", 500)
      : NextResponse.json({ error: "Could not load binding status." }, { status: 500 });
  }

  if (!record) {
    return shouldComplete
      ? htmlResponse("Binding unavailable", "This binding request was not found.", 404)
      : NextResponse.json({ error: "Binding not found." }, { status: 404 });
  }

  const metadata = getBindingMetadata(record.metadata);
  const expiresAt = metadata.binding?.expires_at ? Date.parse(metadata.binding.expires_at) : 0;
  const expired = Number.isFinite(expiresAt) && expiresAt > 0 && Date.now() > expiresAt;

  if (shouldComplete) {
    if (!nonce || nonce !== metadata.binding?.nonce || expired) {
      return htmlResponse("Binding expired", "Please return to VIZA settings and generate a new QR code.", 400);
    }

    const now = new Date().toISOString();
    await admin
      .from("payment_records")
      .update({
        status: "bound",
        provider_payment_id: `bind_${record.provider}_${record.id}`,
        updated_at: now,
        metadata: {
          ...metadata,
          binding: {
            ...metadata.binding,
            completed_at: now,
          },
        },
      })
      .eq("id", record.id);

    return htmlResponse(
      "Binding completed",
      "You can now return to VIZA settings. The account status will update after you check binding status.",
    );
  }

  const user = await getCommercialAuthenticatedUser();
  if (!user || user.id !== record.applicant_id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bound = record.status === "bound";
  return NextResponse.json({
    bindingId: record.id,
    method: record.provider,
    status: expired && !bound ? "expired" : record.status,
    accountLabel: providerLabel(record.provider),
    identifier: bound ? `${providerLabel(record.provider)} verified by QR scan` : null,
  });
}
