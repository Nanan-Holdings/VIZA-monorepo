import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import {
  applyBetaAccess,
  buildBalancedBetaDeliveryPlan,
  hashBetaCode,
  hashBetaIdentity,
  normalizeBetaCode,
} from "./beta-access";

type QueryResult = { data: unknown; error?: { code?: string; message?: string } | null };

function queuedClient(...results: QueryResult[]) {
  const inserts: Array<{ table: string; value: unknown }> = [];
  let index = 0;
  const client = {
    from(table: string) {
      const result = results[index++];
      if (!result) throw new Error(`Unexpected query for ${table}`);
      const query = {
        select: () => query,
        eq: () => query,
        order: () => query,
        limit: () => query,
        insert: (value: unknown) => {
          inserts.push({ table, value });
          return query;
        },
        maybeSingle: async () => result,
        single: async () => result,
      };
      return query;
    },
    async rpc() {
      const result = results[index++];
      if (!result) throw new Error("Unexpected RPC");
      return result;
    },
  };
  return { client: client as unknown as SupabaseClient, inserts };
}

const socialCode = {
  id: "code-social",
  assignment_id: "assignment-social",
  audience: "social",
  delivery_method: "promo_code",
  discount_percent: 50,
  access_scope: "one_country",
  expires_at: null,
  campaign: "launch-beta-2026",
};

const socialGrant = {
  id: "grant-social",
  code_id: socialCode.id,
  applicant_id: "applicant-a",
  first_application_id: "application-a",
  first_order_id: "order-a",
  country: "indonesia",
  campaign: socialCode.campaign,
  audience: socialCode.audience,
  delivery_method: socialCode.delivery_method,
  discount_percent: socialCode.discount_percent,
  access_scope: socialCode.access_scope,
  discount_cents: 2_500,
};

const claim = {
  token: "VIZA50-TEST",
  deliveryMethod: "promo_code" as const,
  applicantId: "applicant-a",
  applicationId: "application-a",
  orderId: "order-a",
  country: "indonesia",
  baseAgencyFeeCents: 5_000,
};

describe("beta access codes", () => {
  beforeAll(() => {
    process.env.BETA_IDENTITY_HMAC_KEY = "test-only-beta-identity-key-32-bytes-minimum";
  });

  it("builds a strict, alternating 50/50 delivery plan", () => {
    const plan = buildBalancedBetaDeliveryPlan(100);
    expect(plan).toHaveLength(100);
    expect(plan.filter((method) => method === "promo_code")).toHaveLength(50);
    expect(plan.filter((method) => method === "link_suffix")).toHaveLength(50);
    expect(plan.slice(0, 4)).toEqual([
      "promo_code",
      "link_suffix",
      "promo_code",
      "link_suffix",
    ]);
  });

  it("rejects an odd or out-of-range balanced cohort", () => {
    expect(() => buildBalancedBetaDeliveryPlan(3)).toThrow(/even count/);
    expect(() => buildBalancedBetaDeliveryPlan(102)).toThrow(/even count/);
  });

  it("normalizes formatting before hashing", () => {
    expect(normalizeBetaCode("  viza50-ab cd  ")).toBe("VIZA50ABCD");
    expect(hashBetaCode("VIZA50-ABCD")).toBe(hashBetaCode("viza50 abcd"));
  });

  it("does not expose the plaintext code in its digest", () => {
    const digest = hashBetaCode("VIZAFREE-EXAMPLE");
    expect(digest).toMatch(/^[a-f0-9]{64}$/);
    expect(digest).not.toContain("VIZAFREE");
  });

  it("binds normalized identities with a keyed digest", () => {
    expect(hashBetaIdentity(" Tester@Example.com ")).toBe(hashBetaIdentity("tester@example.com"));
    expect(hashBetaIdentity("tester@example.com")).toMatch(/^[a-f0-9]{64}$/);
    expect(hashBetaIdentity("tester@example.com")).not.toContain("tester");
  });

  it("binds a social code to one order and discounts exactly half the agency fee", async () => {
    const db = queuedClient(
      { data: socialCode },
      { data: { email: "tester@example.com" } },
      { data: [{
        grant_id: socialGrant.id,
        audience: socialGrant.audience,
        delivery_method: socialGrant.delivery_method,
        access_scope: socialGrant.access_scope,
        discount_percent: socialGrant.discount_percent,
        discount_cents: socialGrant.discount_cents,
      }], error: null },
    );

    const access = await applyBetaAccess(db.client, claim);

    expect(access).toMatchObject({
      grantId: "grant-social",
      audience: "social",
      accessScope: "one_country",
      discountPercent: 50,
      discountCents: 2_500,
    });
    expect(db.inserts).toHaveLength(0);
  });

  it("rejects a code already claimed by another applicant or order", async () => {
    const db = queuedClient(
      { data: socialCode },
      { data: { email: "tester@example.com" } },
      { data: null, error: { message: "beta_social_claim_used" } },
    );

    await expect(applyBetaAccess(db.client, claim)).rejects.toMatchObject({
      code: "used",
    });
  });

  it("fails closed when the claimant identity does not match the verified recipient", async () => {
    const db = queuedClient(
      { data: socialCode },
      { data: { email: "forwarded-to@example.com" } },
      { data: null, error: { message: "beta_social_claim_invalid" } },
    );

    await expect(applyBetaAccess(db.client, claim)).rejects.toMatchObject({
      code: "invalid",
    });
  });

  it("allows a safe retry only for the same applicant and first order", async () => {
    const db = queuedClient(
      { data: socialCode },
      { data: { email: "tester@example.com" } },
      { data: [{
        grant_id: socialGrant.id,
        audience: socialGrant.audience,
        delivery_method: socialGrant.delivery_method,
        access_scope: socialGrant.access_scope,
        discount_percent: socialGrant.discount_percent,
        discount_cents: socialGrant.discount_cents,
      }], error: null },
    );

    await expect(applyBetaAccess(db.client, claim)).resolves.toMatchObject({
      grantId: "grant-social",
      discountCents: 2_500,
    });
  });

  it("keeps a friend's all-country benefit on later checkouts without reusing the code", async () => {
    const db = queuedClient({
      data: {
        id: "grant-friend",
        audience: "friends",
        delivery_method: "link_suffix",
        discount_percent: 100,
        access_scope: "all_countries",
      },
    });

    const access = await applyBetaAccess(db.client, {
      ...claim,
      token: undefined,
      deliveryMethod: undefined,
      applicationId: "application-later-country",
      orderId: "order-later-country",
      country: "vietnam",
    });

    expect(access).toMatchObject({
      grantId: "grant-friend",
      audience: "friends",
      accessScope: "all_countries",
      discountPercent: 100,
      discountCents: 5_000,
    });
    expect(db.inserts).toHaveLength(0);
  });

  it("fails closed when an existing friend entitlement cannot be queried", async () => {
    const db = queuedClient({
      data: null,
      error: { message: "temporary database failure" },
    });

    await expect(applyBetaAccess(db.client, {
      ...claim,
      token: undefined,
      deliveryMethod: undefined,
    })).rejects.toThrow(/beta entitlement lookup/);
  });

  it("keeps promo and unique-link cohorts mutually exclusive", async () => {
    const db = queuedClient({ data: socialCode });
    await expect(applyBetaAccess(db.client, {
      ...claim,
      deliveryMethod: "link_suffix",
    })).rejects.toMatchObject({ code: "wrong_channel" });
  });

  it("requires a delivery channel whenever a token is supplied", async () => {
    const db = queuedClient({ data: socialCode });
    await expect(applyBetaAccess(db.client, {
      ...claim,
      deliveryMethod: undefined,
    })).rejects.toMatchObject({ code: "wrong_channel" });
  });
});
