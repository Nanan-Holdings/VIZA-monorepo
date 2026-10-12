import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  createAdminClient: vi.fn(),
  randomInt: vi.fn(() => 0),
  randomBytes: vi.fn(() => Buffer.from("beta-code-seed")),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({ requireRole: mocks.requireRole }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:crypto")>();
  return { ...actual, randomInt: mocks.randomInt, randomBytes: mocks.randomBytes };
});

import {
  getBetaOperatorState,
  initializeSocialBetaCohort,
  markSocialBetaInviteDelivered,
  cancelUndeliveredSocialInvite,
  issueFriendBetaInvite,
  issueNextSocialBetaInvite,
} from "./admin-beta";

function queryResult(result: { data: unknown; error: null | { message: string }; count?: number }) {
  const query: Record<string, unknown> = {};
  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.maybeSingle = vi.fn(async () => result);
  query.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return query;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.randomInt.mockImplementation(() => 0);
  mocks.randomBytes.mockImplementation(() => Buffer.from("beta-code-seed"));
  process.env.BETA_IDENTITY_HMAC_KEY = "test-beta-identity-key-at-least-32-characters";
});

describe("initializeSocialBetaCohort", () => {
  it("is admin-only and sends exactly one cryptographically shuffled 50/50 100-slot plan", async () => {
    mocks.requireRole.mockResolvedValue({ id: "admin-1", role: "admin" });
    const rpc = vi.fn().mockResolvedValue({ error: null });
    mocks.createAdminClient.mockReturnValue({ rpc });

    const result = await initializeSocialBetaCohort();

    expect(result).toEqual({ ok: true, data: { targetCount: 100 } });
    expect(mocks.requireRole).toHaveBeenCalledWith("admin");
    const [, payload] = rpc.mock.calls[0] as [string, { p_delivery_plan: string[]; p_created_by: string }];
    expect(rpc.mock.calls[0]?.[0]).toBe("initialize_beta_social_cohort");
    expect(payload.p_created_by).toBe("admin-1");
    expect(payload.p_delivery_plan).toHaveLength(100);
    expect(payload.p_delivery_plan.filter((method) => method === "promo_code")).toHaveLength(50);
    expect(payload.p_delivery_plan.filter((method) => method === "link_suffix")).toHaveLength(50);
    expect(payload.p_delivery_plan).not.toEqual(Array.from({ length: 100 }, (_, index) =>
      index % 2 === 0 ? "promo_code" : "link_suffix",
    ));
  });

  it("returns a typed duplicate-initialization error", async () => {
    mocks.requireRole.mockResolvedValue({ id: "admin-1", role: "admin" });
    mocks.createAdminClient.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({ error: { code: "23505", message: "duplicate cohort" } }),
    });
    await expect(initializeSocialBetaCohort()).resolves.toEqual({ ok: false, error: "already_initialized" });
  });
});

describe("issueNextSocialBetaInvite", () => {
  it("requires complete evidence before reserving a slot", async () => {
    mocks.requireRole.mockResolvedValue({ id: "staff-1", role: "staff" });
    const rpc = vi.fn();
    mocks.createAdminClient.mockReturnValue({ rpc });
    const result = await issueNextSocialBetaInvite({
      platform: "TikTok",
      recipientReference: " ",
      recipientEmail: "person@example.com",
      proofReference: "proof",
    });
    expect(result).toEqual({ ok: false, error: "invalid_evidence" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("lets the RPC choose one arm and persists only a digest and hint", async () => {
    mocks.requireRole.mockResolvedValue({ id: "staff-1", role: "staff" });
    const rpc = vi.fn().mockResolvedValue({
      data: [{ assignment_id: "assignment-1", slot_number: 17, delivery_method: "link_suffix", code_id: "code-1" }],
      error: null,
    });
    mocks.createAdminClient.mockReturnValue({ rpc });

    const result = await issueNextSocialBetaInvite({
      platform: " TikTok ",
      recipientReference: " @recipient ",
      recipientEmail: " Person@Example.com ",
      proofReference: " proof-123 ",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.invite.deliveryMethod).toBe("link_suffix");
    expect(result.data.invite.slotNumber).toBe(17);
    expect(result.data.invite.assignmentId).toBe("assignment-1");
    expect(result.data.invite.value).toMatch(/^https:\/\/viza\.it\.com\/apply\?beta=VIZA50-/);
    const [, payload] = rpc.mock.calls[0] as [string, Record<string, unknown>];
    expect(rpc.mock.calls[0]?.[0]).toBe("issue_verified_social_invite");
    expect(payload).toMatchObject({
      p_platform: "TikTok",
      p_recipient_reference: "@recipient",
      p_proof_reference: "proof-123",
      p_actor_id: "staff-1",
    });
    expect(payload.p_code_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(payload.p_recipient_identity_hmac).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(payload)).not.toContain("VIZA50-");
    expect(JSON.stringify(payload)).not.toContain("Person@Example.com");
    expect(JSON.stringify(payload)).not.toContain("person@example.com");
    expect(payload).not.toHaveProperty("p_delivery_method");
  });

  it("maps an exhausted cohort to a localized-safe error code", async () => {
    mocks.requireRole.mockResolvedValue({ id: "cs-1", role: "customer_service" });
    mocks.createAdminClient.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({ error: { message: "cohort exhausted" } }),
    });
    await expect(issueNextSocialBetaInvite({
      platform: "Instagram",
      recipientReference: "recipient",
      recipientEmail: "person@example.com",
      proofReference: "proof",
    })).resolves.toEqual({ ok: false, error: "exhausted" });
  });
});

describe("social invitation delivery lifecycle", () => {
  it("marks actual delivery with an authenticated actor and reference", async () => {
    mocks.requireRole.mockResolvedValue({ id: "staff-1", role: "staff" });
    const rpc = vi.fn().mockResolvedValue({ error: null });
    mocks.createAdminClient.mockReturnValue({ rpc });

    await expect(markSocialBetaInviteDelivered({
      assignmentId: "assignment-1",
      deliveryReference: "support-message-42",
    })).resolves.toEqual({ ok: true, data: { assignmentId: "assignment-1" } });
    expect(rpc).toHaveBeenCalledWith("mark_social_invite_delivered", {
      p_assignment_id: "assignment-1",
      p_actor_id: "staff-1",
      p_delivery_reference: "support-message-42",
    });
  });

  it("requires a cancellation reason before releasing an undelivered slot", async () => {
    mocks.requireRole.mockResolvedValue({ id: "cs-1", role: "customer_service" });
    const rpc = vi.fn().mockResolvedValue({ error: null });
    mocks.createAdminClient.mockReturnValue({ rpc });

    await expect(cancelUndeliveredSocialInvite({
      assignmentId: "assignment-1",
      reason: " ",
    })).resolves.toEqual({ ok: false, error: "invalid_evidence" });
    expect(rpc).not.toHaveBeenCalled();

    await expect(cancelUndeliveredSocialInvite({
      assignmentId: "assignment-1",
      reason: "Plaintext response was lost before delivery",
    })).resolves.toEqual({ ok: true, data: { assignmentId: "assignment-1" } });
    expect(rpc).toHaveBeenCalledWith("cancel_undelivered_social_invite", {
      p_assignment_id: "assignment-1",
      p_actor_id: "cs-1",
      p_reason: "Plaintext response was lost before delivery",
    });
  });
});

describe("issueFriendBetaInvite", () => {
  it("issues one fixed promo-code, 100%-off, all-country friend benefit", async () => {
    mocks.requireRole.mockResolvedValue({ id: "cs-1", role: "customer_service" });
    const insert = vi.fn().mockResolvedValue({ error: null });
    mocks.createAdminClient.mockReturnValue({ from: vi.fn(() => ({ insert })) });

    const result = await issueFriendBetaInvite();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.invite).toMatchObject({ deliveryMethod: "promo_code" });
    expect(result.data.invite.value).toMatch(/^VIZAFREE-/);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      audience: "friends",
      delivery_method: "promo_code",
      discount_percent: 100,
      access_scope: "all_countries",
    }));
    expect(insert.mock.calls[0]?.[0]).not.toHaveProperty("code");
  });
});

describe("getBetaOperatorState", () => {
  it("uses delivered social assignments as the funnel denominator and reports friends separately", async () => {
    mocks.requireRole.mockResolvedValue({ id: "admin-1", role: "admin" });
    const results: Record<string, ReturnType<typeof queryResult>> = {
      beta_campaign_cohorts: queryResult({ data: { campaign: "launch-beta-2026", target_count: 100, state: "active" }, error: null }),
      beta_social_assignments: queryResult({ data: [
        { id: "a1", slot_number: 1, delivery_method: "promo_code", platform: "TikTok", recipient_reference: "user-1", issued_at: "2026-09-09", delivered_at: "2026-09-09", code_id: "promo-delivered" },
        { id: "a2", slot_number: 2, delivery_method: "promo_code", platform: null, recipient_reference: null, issued_at: null, delivered_at: null, code_id: null },
        { id: "a3", slot_number: 3, delivery_method: "link_suffix", platform: "Instagram", recipient_reference: "user-3", issued_at: "2026-09-09", delivered_at: "2026-09-09", code_id: "link-delivered" },
        { id: "a4", slot_number: 4, delivery_method: "promo_code", platform: "XHS", recipient_reference: "user-4", issued_at: "2026-09-09", delivered_at: null, code_id: "promo-pending" },
      ], error: null }),
      beta_access_grants: queryResult({ data: [
        { code_id: "promo-delivered", delivery_method: "promo_code", checkout_started_at: "x", converted_at: "x", submitted_at: "x" },
        { code_id: "not-delivered", delivery_method: "promo_code", checkout_started_at: "x", converted_at: "x", submitted_at: "x" },
        { code_id: "link-delivered", delivery_method: "link_suffix", checkout_started_at: "x", converted_at: "x", submitted_at: null },
      ], error: null }),
      beta_access_codes: queryResult({ data: null, error: null, count: 2 }),
    };
    mocks.createAdminClient.mockReturnValue({ from: vi.fn((table: string) => results[table]) });

    const state = await getBetaOperatorState();

    expect(state).toMatchObject({
      initialized: true,
      targetCount: 100,
      issued: 3,
      delivered: 2,
      remainingIssuable: 97,
      friendInvitesIssued: 2,
      canInitialize: true,
      issuedUndelivered: [{
        assignmentId: "a4",
        slotNumber: 4,
        deliveryMethod: "promo_code",
        platform: "XHS",
        recipientReference: "user-4",
        issuedAt: "2026-09-09",
      }],
    });
    expect(state.metrics).toEqual([
      { deliveryMethod: "promo_code", delivered: 1, checkoutStarted: 1, converted: 1, submitted: 1 },
      { deliveryMethod: "link_suffix", delivered: 1, checkoutStarted: 1, converted: 1, submitted: 0 },
    ]);
  });
});
