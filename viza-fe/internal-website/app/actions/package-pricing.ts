"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export interface PricingRow {
  id: string;
  visa_package_id: string;
  package_label: string;
  currency: string;
  government_fee_cents: number;
  agency_fee_cents: number;
  override_until: string | null;
  override_reason: string | null;
  source: string;
  updated_at: string;
}

async function assertStaff(): Promise<{ userId?: string; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  const adminClient = createAdminClient();
  const { data: row } = await adminClient
    .from("users")
    .select("role")
    .eq("id", user.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (row?.role !== "admin" && row?.role !== "staff") return { error: "Staff role required" };
  return { userId: user.id };
}

export async function listPricing(): Promise<{ rows?: PricingRow[]; error?: string }> {
  const guard = await assertStaff();
  if (!guard.userId) return { error: guard.error };
  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from("package_pricing")
    .select("id, visa_package_id, currency, government_fee_cents, agency_fee_cents, override_until, override_reason, source, updated_at, visa_packages!inner(country, visa_type, name)")
    .order("currency", { ascending: true });
  if (error) return { error: error.message };
  type Joined = {
    id: string;
    visa_package_id: string;
    currency: string;
    government_fee_cents: number;
    agency_fee_cents: number;
    override_until: string | null;
    override_reason: string | null;
    source: string;
    updated_at: string;
    visa_packages: { country: string; visa_type: string; name: string } | { country: string; visa_type: string; name: string }[] | null;
  };
  const rows: PricingRow[] = ((data ?? []) as unknown as Joined[]).map((r) => {
    const pkg = Array.isArray(r.visa_packages) ? r.visa_packages[0] : r.visa_packages;
    return {
      id: r.id,
      visa_package_id: r.visa_package_id,
      package_label: `${pkg?.country ?? ""} · ${pkg?.visa_type ?? ""} (${pkg?.name ?? ""})`,
      currency: r.currency,
      government_fee_cents: r.government_fee_cents,
      agency_fee_cents: r.agency_fee_cents,
      override_until: r.override_until,
      override_reason: r.override_reason,
      source: r.source,
      updated_at: r.updated_at,
    };
  });
  return { rows };
}

export async function setPricingOverride(input: {
  visaPackageId: string;
  currency: string;
  governmentFeeCents: number;
  agencyFeeCents: number;
  overrideDays: number;
  reason: string;
}): Promise<{ ok: boolean; reason?: string }> {
  const guard = await assertStaff();
  if (!guard.userId) return { ok: false, reason: guard.error };
  if (input.reason.trim().length < 5) return { ok: false, reason: "Reason required (≥5 chars)" };
  if (input.overrideDays <= 0 || input.overrideDays > 90) {
    return { ok: false, reason: "Override duration must be 1–90 days" };
  }
  const adminClient = createAdminClient();
  const overrideUntil = new Date(Date.now() + input.overrideDays * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await adminClient.from("package_pricing").upsert(
    {
      visa_package_id: input.visaPackageId,
      currency: input.currency,
      government_fee_cents: input.governmentFeeCents,
      agency_fee_cents: input.agencyFeeCents,
      override_until: overrideUntil,
      override_reason: input.reason,
      override_by: guard.userId,
      source: "staff_override",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "visa_package_id,currency" },
  );
  if (error) return { ok: false, reason: error.message };
  await adminClient.from("package_pricing_history").insert({
    visa_package_id: input.visaPackageId,
    currency: input.currency,
    government_fee_cents: input.governmentFeeCents,
    agency_fee_cents: input.agencyFeeCents,
    source: "staff_override",
    changed_by: guard.userId,
    reason: input.reason,
  });
  return { ok: true };
}
