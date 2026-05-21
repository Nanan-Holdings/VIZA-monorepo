"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Family / multi-applicant application group (PRODUCT-002).
 *
 * One payer creates N applications under a single Stripe checkout. Each
 * applicant gets its own answer set, doc upload, face-match, and audit
 * trail — only the billing is shared.
 */

export interface CreateGroupInput {
  visaPackageId: string;
  label?: string;
  /** One row per family member; the first entry is the payer themselves. */
  members: Array<{
    surname: string;
    given_names: string;
    is_payer: boolean;
  }>;
}

export interface CreateGroupResult {
  ok: boolean;
  groupId?: string;
  applicationIds?: string[];
  reason?: string;
}

export async function createApplicationGroup(input: CreateGroupInput): Promise<CreateGroupResult> {
  if (input.members.length === 0) return { ok: false, reason: "At least one member required" };
  if (input.members.length > 10) return { ok: false, reason: "Max 10 applicants per group" };
  if (!input.members.some((m) => m.is_payer)) {
    return { ok: false, reason: "Exactly one member must be the payer" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: "Not authenticated" };
  const adminClient = createAdminClient();

  const { data: pkg } = await adminClient
    .from("visa_packages")
    .select("id, country, visa_type, price_cents, currency")
    .eq("id", input.visaPackageId)
    .eq("is_active", true)
    .maybeSingle();
  if (!pkg) return { ok: false, reason: "Package not found or inactive" };

  const total = (pkg.price_cents as number | null ?? 0) * input.members.length;

  const { data: group, error: groupErr } = await adminClient
    .from("application_group")
    .insert({
      payer_user_id: user.id,
      visa_package_id: input.visaPackageId,
      label: input.label ?? null,
      total_amount_cents: total,
      currency: (pkg.currency as string | null) ?? "USD",
    })
    .select("id")
    .single();
  if (groupErr || !group) return { ok: false, reason: groupErr?.message ?? "group insert failed" };

  // Each member gets a fresh applicant_profile + applications row.
  const applicationIds: string[] = [];
  for (const m of input.members) {
    let applicantProfileId: string;
    if (m.is_payer) {
      const { data: existingPayerProfile } = await adminClient
        .from("applicant_profiles")
        .select("id")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      if (existingPayerProfile) {
        applicantProfileId = existingPayerProfile.id as string;
      } else {
        const { data: newProfile, error: profErr } = await adminClient
          .from("applicant_profiles")
          .insert({ auth_user_id: user.id, full_name: `${m.given_names} ${m.surname}`.trim() })
          .select("id")
          .single();
        if (profErr || !newProfile) {
          return { ok: false, reason: profErr?.message ?? "payer profile insert failed" };
        }
        applicantProfileId = newProfile.id as string;
      }
    } else {
      const { data: childProfile, error: childErr } = await adminClient
        .from("applicant_profiles")
        .insert({
          /* Dependant profile — no auth_user_id; managed by payer only. */
          full_name: `${m.given_names} ${m.surname}`.trim(),
          dependant_of_user_id: user.id,
        })
        .select("id")
        .single();
      if (childErr || !childProfile) {
        return { ok: false, reason: childErr?.message ?? "dependant profile insert failed" };
      }
      applicantProfileId = childProfile.id as string;
    }
    const { data: app, error: appErr } = await adminClient
      .from("applications")
      .insert({
        applicant_id: applicantProfileId,
        country: pkg.country,
        visa_type: pkg.visa_type,
        status: "draft",
        visa_package_id: pkg.id,
        group_id: group.id,
      })
      .select("id")
      .single();
    if (appErr || !app) return { ok: false, reason: appErr?.message ?? "application insert failed" };
    applicationIds.push(app.id as string);
  }

  return { ok: true, groupId: group.id as string, applicationIds };
}

export async function listMyGroups() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from("application_group")
    .select(
      "id, label, total_amount_cents, currency, created_at, applications:applications!group_id(id, applicant_id, status)",
    )
    .eq("payer_user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) return { error: error.message };
  return { rows: data ?? [] };
}
