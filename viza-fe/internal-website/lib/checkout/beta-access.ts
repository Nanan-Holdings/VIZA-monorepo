import { createHash, createHmac } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export type BetaDeliveryMethod = "promo_code" | "link_suffix";

export function buildBalancedBetaDeliveryPlan(count: number): BetaDeliveryMethod[] {
  if (!Number.isInteger(count) || count < 2 || count > 100 || count % 2 !== 0) {
    throw new Error("Balanced beta cohorts require an even count between 2 and 100");
  }
  return Array.from({ length: count }, (_, index) =>
    index % 2 === 0 ? "promo_code" : "link_suffix",
  );
}

type BetaCodeRow = {
  id: string;
  assignment_id: string | null;
  audience: "social" | "friends";
  delivery_method: BetaDeliveryMethod;
  discount_percent: 50 | 100;
  access_scope: "one_country" | "all_countries";
  expires_at: string | null;
  campaign: string;
};

type BetaGrantRow = {
  id: string;
  code_id: string;
  applicant_id: string;
  first_application_id: string;
  first_order_id: string;
  country: string;
  campaign: string;
  discount_cents: number;
  audience: "social" | "friends";
  delivery_method: BetaDeliveryMethod;
  discount_percent: 50 | 100;
  access_scope: "one_country" | "all_countries";
};

export class BetaAccessError extends Error {
  constructor(public readonly code: "invalid" | "used" | "wrong_channel") {
    super(code);
    this.name = "BetaAccessError";
  }
}

export function normalizeBetaCode(value: string): string {
  return value.trim().toUpperCase().replace(/[\s-]+/g, "");
}

export function hashBetaCode(value: string): string {
  return createHash("sha256").update(normalizeBetaCode(value)).digest("hex");
}

export function normalizeBetaIdentity(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Bind a social invitation to the verified checkout identity without storing
 * a queryable email address in the experiment tables.
 */
export function hashBetaIdentity(value: string): string {
  const key = process.env.BETA_IDENTITY_HMAC_KEY?.trim() ?? "";
  if (key.length < 32) {
    throw new Error("BETA_IDENTITY_HMAC_KEY must contain at least 32 characters");
  }
  return createHmac("sha256", key).update(normalizeBetaIdentity(value)).digest("hex");
}

export type AppliedBetaAccess = {
  grantId: string;
  audience: "social" | "friends";
  deliveryMethod: BetaDeliveryMethod;
  accessScope: "one_country" | "all_countries";
  discountPercent: 50 | 100;
  discountCents: number;
};

export async function getExistingAllCountriesBetaAccess(
  admin: SupabaseClient,
  applicantId: string,
  baseAgencyFeeCents: number,
): Promise<AppliedBetaAccess | null> {
  const { data: existing, error } = await admin
    .from("beta_access_grants")
    .select("id, audience, delivery_method, discount_percent, access_scope")
    .eq("applicant_id", applicantId)
    .eq("access_scope", "all_countries")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`beta entitlement lookup: ${error.message}`);
  if (!existing) return null;
  const percent = Number(existing.discount_percent) as 50 | 100;
  return {
    grantId: String(existing.id),
    audience: existing.audience as "social" | "friends",
    deliveryMethod: existing.delivery_method as BetaDeliveryMethod,
    accessScope: "all_countries",
    discountPercent: percent,
    discountCents: Math.round((baseAgencyFeeCents * percent) / 100),
  };
}

export async function applyBetaAccess(
  admin: SupabaseClient,
  input: {
    token?: string;
    deliveryMethod?: BetaDeliveryMethod;
    applicantId: string;
    applicationId: string;
    orderId: string;
    country: string;
    baseAgencyFeeCents: number;
  },
): Promise<AppliedBetaAccess | null> {
  const token = input.token ? normalizeBetaCode(input.token) : "";

  // A friend invitation binds to one applicant on first claim, then keeps the
  // promised all-country, service-fee benefit without making them re-enter it.
  if (!token) {
    return getExistingAllCountriesBetaAccess(
      admin,
      input.applicantId,
      input.baseAgencyFeeCents,
    );
  }

  const codeHash = hashBetaCode(token);
  const { data: code, error: codeError } = await admin
    .from("beta_access_codes")
    .select("id, assignment_id, audience, delivery_method, discount_percent, access_scope, expires_at, campaign")
    .eq("code_hash", codeHash)
    .eq("status", "active")
    .maybeSingle();

  if (codeError) throw new Error(`beta access lookup: ${codeError.message}`);

  if (!code || (code.expires_at && new Date(code.expires_at).getTime() <= Date.now())) {
    throw new BetaAccessError("invalid");
  }
  const typedCode = code as BetaCodeRow;
  if (!input.deliveryMethod || typedCode.delivery_method !== input.deliveryMethod) {
    throw new BetaAccessError("wrong_channel");
  }

  if (typedCode.audience === "social") {
    const { data: applicant, error: applicantError } = await admin
      .from("applicant_profiles")
      .select("email")
      .eq("id", input.applicantId)
      .maybeSingle();
    if (applicantError) throw new Error(`beta applicant identity lookup: ${applicantError.message}`);
    const email = typeof applicant?.email === "string" ? applicant.email : "";
    if (!email) throw new BetaAccessError("invalid");

    const { data: claimed, error: claimError } = await admin.rpc("claim_social_beta_access", {
      p_code_hash: codeHash,
      p_delivery_method: input.deliveryMethod,
      p_claimant_identity_hmac: hashBetaIdentity(email),
      p_applicant_id: input.applicantId,
      p_application_id: input.applicationId,
      p_order_id: input.orderId,
      p_country: input.country,
      p_base_agency_fee_cents: input.baseAgencyFeeCents,
    });
    if (claimError) {
      const message = claimError.message?.toLowerCase() ?? "";
      if (message.includes("claim_used")) throw new BetaAccessError("used");
      if (message.includes("claim_invalid")) throw new BetaAccessError("invalid");
      throw new Error(`beta social access claim: ${claimError.message}`);
    }
    const row = Array.isArray(claimed) ? claimed[0] : claimed;
    if (!row) throw new Error("beta social access claim returned no grant");
    return {
      grantId: String(row.grant_id),
      audience: "social",
      deliveryMethod: row.delivery_method as BetaDeliveryMethod,
      accessScope: row.access_scope as "one_country" | "all_countries",
      discountPercent: Number(row.discount_percent) as 50 | 100,
      discountCents: Number(row.discount_cents),
    };
  }

  const discountCents = Math.round(
    (input.baseAgencyFeeCents * typedCode.discount_percent) / 100,
  );
  const { data: inserted, error } = await admin
    .from("beta_access_grants")
    .insert({
      code_id: typedCode.id,
      applicant_id: input.applicantId,
      first_application_id: input.applicationId,
      first_order_id: input.orderId,
      country: input.country,
      campaign: typedCode.campaign,
      audience: typedCode.audience,
      delivery_method: typedCode.delivery_method,
      discount_percent: typedCode.discount_percent,
      access_scope: typedCode.access_scope,
      base_agency_fee_cents: input.baseAgencyFeeCents,
      discount_cents: discountCents,
    })
    .select("id, code_id, applicant_id, first_application_id, first_order_id, country, campaign, audience, delivery_method, discount_percent, access_scope, discount_cents")
    .single();

  let grant = inserted as BetaGrantRow | null;
  if (error?.code === "23505") {
    const { data: existing } = await admin
      .from("beta_access_grants")
      .select("id, code_id, applicant_id, first_application_id, first_order_id, country, campaign, audience, delivery_method, discount_percent, access_scope, discount_cents")
      .eq("code_id", typedCode.id)
      .maybeSingle();
    grant = existing as BetaGrantRow | null;
    if (
      !grant ||
      grant.applicant_id !== input.applicantId ||
      grant.first_order_id !== input.orderId
    ) {
      throw new BetaAccessError("used");
    }
  } else if (error) {
    throw new Error(`beta access claim: ${error.message}`);
  }
  if (!grant) throw new Error("beta access claim returned no grant");

  return {
    grantId: grant.id,
    audience: grant.audience,
    deliveryMethod: grant.delivery_method,
    accessScope: grant.access_scope,
    discountPercent: grant.discount_percent,
    discountCents,
  };
}
