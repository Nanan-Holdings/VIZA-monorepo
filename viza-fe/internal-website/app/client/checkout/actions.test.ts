import { beforeEach, describe, expect, it, vi } from "vitest";
import { BetaAccessError, type AppliedBetaAccess } from "@/lib/checkout/beta-access";

const redirectMock = vi.hoisted(() => vi.fn((destination: string) => {
  throw new Error(`REDIRECT:${destination}`);
}));
const createStripeClientMock = vi.hoisted(() => vi.fn());
const getCheckoutContextMock = vi.hoisted(() => vi.fn());
const createCheckoutAdminClientMock = vi.hoisted(() => vi.fn());
const applyBetaAccessMock = vi.hoisted(() => vi.fn());
const advanceApplicationAfterConfirmedPaymentMock = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers({ origin: "https://app.viza.test" })) }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("./data", () => ({
  createCheckoutAdminClient: createCheckoutAdminClientMock,
  createStripeClient: createStripeClientMock,
  getCheckoutContext: getCheckoutContextMock,
}));
vi.mock("@/lib/checkout/beta-access", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/checkout/beta-access")>(),
  applyBetaAccess: applyBetaAccessMock,
}));
vi.mock("@/app/api/stripe/_shared", () => ({
  advanceApplicationAfterConfirmedPayment: advanceApplicationAfterConfirmedPaymentMock,
}));
vi.mock("@/lib/payments/method-availability", () => ({ stripeCheckoutPaymentMethodsFor: vi.fn(() => ["card"]) }));

import { startStripeCheckout } from "./actions";
import { deterministicCheckoutUuid } from "./beta-params";

const socialPromo: AppliedBetaAccess = {
  grantId: "grant-social", audience: "social", deliveryMethod: "promo_code",
  accessScope: "one_country", discountPercent: 50, discountCents: 4_950,
};
const friend: AppliedBetaAccess = {
  grantId: "grant-friend", audience: "friends", deliveryMethod: "promo_code",
  accessScope: "all_countries", discountPercent: 100, discountCents: 9_900,
};

function canonicalOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: deterministicCheckoutUuid("order", "app-1"), application_id: "app-1", applicant_id: "profile-1",
    agency_fee_cents: 9_900, govt_fee_cents: 8_000, currency: "USD", status: "pending",
    metadata: { source: "client_checkout" }, ...overrides,
  };
}

function discountedPayment(overrides: Record<string, unknown> = {}) {
  return {
    id: deterministicCheckoutUuid("payment", "app-1"), application_id: "app-1", applicant_id: "profile-1",
    auth_user_id: "user-1", order_id: deterministicCheckoutUuid("order", "app-1"),
    visa_package_id: "package-1", provider: "stripe", provider_session_id: null, amount_cents: 4_950,
    currency: "USD", status: "pending", fee_type: "agency_fee",
    metadata: { source: "client_checkout", beta_attempt: 1, beta: {
      grant_id: "grant-social", audience: "social", delivery_method: "promo_code", access_scope: "one_country",
      discount_percent: 50, base_agency_fee_cents: 9_900, discount_cents: 4_950,
    } }, ...overrides,
  };
}

function friendPayment(overrides: Record<string, unknown> = {}) {
  return {
    id: "friend-payment", provider: "beta", provider_payment_id: "beta:grant-friend:app-1",
    application_id: "app-1", applicant_id: "profile-1", order_id: deterministicCheckoutUuid("order", "app-1"),
    visa_package_id: "package-1", auth_user_id: "user-1", status: "paid", amount_cents: 0,
    fee_type: "agency_fee", currency: "USD", metadata: {
      source: "client_checkout", user_id: "user-1", applicant_id: "profile-1", application_id: "app-1",
      visa_package_id: "package-1", beta: {
        grant_id: "grant-friend", audience: "friends", delivery_method: "promo_code",
        access_scope: "all_countries", discount_percent: 100, base_agency_fee_cents: 9_900,
        discount_cents: 9_900,
      },
    }, ...overrides,
  };
}

interface FakeOptions {
  order?: Record<string, unknown> | null;
  orderLookupMissOnce?: boolean;
  orderInsertError?: { message: string } | null;
  concurrentOrder?: Record<string, unknown> | null;
  payments?: Array<Record<string, unknown>>;
  paymentInsertError?: { message: string } | null;
  concurrentPayment?: Record<string, unknown> | null;
  betaGrant?: Record<string, unknown> | null;
}

function fakeAdmin(options: FakeOptions = {}) {
  let order = options.order === undefined ? canonicalOrder() : options.order;
  let orderLookupCount = 0;
  const payments = [...(options.payments ?? [])];
  const inserts: Array<{ table: string; value: Record<string, unknown> }> = [];
  const updates: Array<{ table: string; value: Record<string, unknown> }> = [];
  return {
    inserts, updates, payments,
    get order() { return order; },
    client: {
      from(table: string) {
        let operation: "read" | "insert" | "update" = "read";
        let payload: Record<string, unknown> = {};
        const filters = new Map<string, unknown>();
        const builder = {
          select() { return builder; },
          eq(column: string, value: unknown) { filters.set(column, value); return builder; },
          in() { return builder; }, order() { return builder; }, limit() { return builder; }, contains() { return builder; },
          update(value: Record<string, unknown>) { operation = "update"; payload = value; updates.push({ table, value }); return builder; },
          insert(value: Record<string, unknown>) { operation = "insert"; payload = value; inserts.push({ table, value }); return builder; },
          maybeSingle: async () => {
            if (table === "order") {
              orderLookupCount += 1;
              if (options.orderLookupMissOnce && orderLookupCount === 1) return { data: null, error: null };
              return { data: order ?? options.concurrentOrder ?? null, error: null };
            }
            if (table === "payment_records") {
              const id = filters.get("id");
              const providerPaymentId = filters.get("provider_payment_id");
              const found = payments.find((row) =>
                (id ? row.id === id : true) && (providerPaymentId ? row.provider_payment_id === providerPaymentId : true),
              ) ?? options.concurrentPayment ?? null;
              return { data: found, error: null };
            }
            if (table === "beta_access_grants") return { data: options.betaGrant ?? null, error: null };
            return { data: null, error: null };
          },
          single: async () => {
            if (operation !== "insert") return { data: null, error: null };
            if (table === "order") {
              if (options.orderInsertError) { order = options.concurrentOrder ?? order; return { data: null, error: options.orderInsertError }; }
              order = payload; return { data: payload, error: null };
            }
            if (table === "payment_records") {
              if (options.paymentInsertError) return { data: null, error: options.paymentInsertError };
              const row = { id: payload.id ?? "payment-new", ...payload }; payments.push(row);
              return { data: { id: row.id }, error: null };
            }
            return { data: null, error: null };
          },
          then(resolve: (value: { data: null; error: null }) => unknown) {
            if (operation === "update") {
              if (table === "order" && order) order = { ...order, ...payload };
              if (table === "payment_records") {
                const row = payments.find((candidate) => candidate.id === filters.get("id"));
                if (row) Object.assign(row, payload);
              }
            }
            return Promise.resolve({ data: null, error: null }).then(resolve);
          },
        };
        return builder;
      },
    },
  };
}

function betaForm(method: "promo_code" | "link_suffix" = "promo_code") {
  const form = new FormData();
  form.set("packageId", "package-1"); form.set("applicationId", "app-1");
  form.set("betaToken", "plaintext-secret-code"); form.set("betaDeliveryMethod", method);
  return form;
}

describe("authenticated beta checkout", () => {
  const createSession = vi.fn(async (
    _input: { cancel_url: string },
    _options?: { idempotencyKey: string },
  ) => ({ id: "cs_beta", status: "open", url: "https://stripe.test/cs_beta" }));
  const retrieveSession = vi.fn(async (_sessionId: string) => ({
    id: "cs_beta", status: "open", url: "https://stripe.test/cs_beta",
  }));

  beforeEach(() => {
    vi.clearAllMocks();
    createStripeClientMock.mockReturnValue({ checkout: { sessions: { create: createSession, retrieve: retrieveSession } } });
    advanceApplicationAfterConfirmedPaymentMock.mockResolvedValue({ advanced: true });
    getCheckoutContextMock.mockResolvedValue({
      user: { id: "user-1", email: "person@example.com" }, applicantProfile: { id: "profile-1" },
      selectedPackage: {
        packageId: "package-1", packageName: "Visa service", applicationId: "app-1", country: "france",
        countryName: "France", visaType: "tourist", visaTypeLabel: "Tourist",
        agencyFee: { cents: 9_900, currency: "USD" }, governmentFeeAmount: { cents: 8_000, currency: "USD" },
        governmentFee: { mode: "separate", amountLabel: "$80" }, latestPayment: null, isPaid: false,
        nextStep: { href: "/client/consent?applicationId=app-1" },
      },
    });
    applyBetaAccessMock.mockResolvedValue(socialPromo);
  });

  it.each(["promo_code", "link_suffix"] as const)("claims the %s arm and charges exactly 50%% of the agency fee", async (method) => {
    const admin = fakeAdmin(); createCheckoutAdminClientMock.mockReturnValue(admin.client);
    applyBetaAccessMock.mockResolvedValue({ ...socialPromo, deliveryMethod: method });
    await expect(startStripeCheckout(betaForm(method))).rejects.toThrow("REDIRECT:https://stripe.test/cs_beta");
    expect(applyBetaAccessMock).toHaveBeenCalledWith(admin.client, expect.objectContaining({
      token: "plaintext-secret-code", deliveryMethod: method,
      orderId: deterministicCheckoutUuid("order", "app-1"), baseAgencyFeeCents: 9_900,
    }));
    expect(createSession).toHaveBeenCalledWith(
      expect.objectContaining({ line_items: [expect.objectContaining({ price_data: expect.objectContaining({ unit_amount: 4_950 }) })] }),
      { idempotencyKey: `client-beta-checkout:${deterministicCheckoutUuid("order", "app-1")}:1` },
    );
    const sessionInput = createSession.mock.calls[0]?.[0];
    expect(sessionInput.cancel_url).not.toContain("plaintext-secret-code");
    expect(sessionInput.cancel_url).not.toContain("beta=");
    const persisted = JSON.stringify(admin.inserts);
    expect(persisted).not.toContain("plaintext-secret-code");
    expect(persisted).toContain(`\"delivery_method\":\"${method}\"`);
  });

  it.each(["wrong_channel", "used"] as const)("fails closed for a %s code", async (code) => {
    const admin = fakeAdmin(); createCheckoutAdminClientMock.mockReturnValue(admin.client);
    applyBetaAccessMock.mockRejectedValue(new BetaAccessError(code));
    await expect(startStripeCheckout(betaForm())).rejects.toThrow(
      `REDIRECT:/client/checkout?error=beta_${code}&packageId=package-1&applicationId=app-1`,
    );
    expect(createSession).not.toHaveBeenCalled();
  });

  it("records and reuses a fully validated zero-value friend waiver", async () => {
    const admin = fakeAdmin(); createCheckoutAdminClientMock.mockReturnValue(admin.client);
    applyBetaAccessMock.mockResolvedValue(friend);
    await expect(startStripeCheckout(betaForm())).rejects.toThrow("REDIRECT:/client/consent?applicationId=app-1");
    expect(createStripeClientMock).not.toHaveBeenCalled();
    expect(admin.inserts.find((entry) => entry.table === "payment_records")?.value).toMatchObject({
      order_id: deterministicCheckoutUuid("order", "app-1"), amount_cents: 0, status: "paid",
      metadata: { beta: { access_scope: "all_countries", discount_percent: 100 } },
    });
    expect(admin.order).toMatchObject({ status: "paid" });
  });

  it("reuses the exact friend waiver payment on retry without inserting another", async () => {
    const admin = fakeAdmin({ payments: [friendPayment()] });
    createCheckoutAdminClientMock.mockReturnValue(admin.client);
    applyBetaAccessMock.mockResolvedValue(friend);
    await expect(startStripeCheckout(betaForm())).rejects.toThrow("REDIRECT:/client/consent?applicationId=app-1");
    expect(admin.inserts.filter((entry) => entry.table === "payment_records")).toHaveLength(0);
    expect(advanceApplicationAfterConfirmedPaymentMock).toHaveBeenCalledWith(
      admin.client,
      expect.objectContaining({ paymentRecordId: "friend-payment", provider: "beta" }),
    );
  });

  it("converges concurrent order creation on the deterministic row", async () => {
    const concurrentOrder = canonicalOrder();
    const admin = fakeAdmin({ order: null, orderLookupMissOnce: true, orderInsertError: { message: "duplicate key" }, concurrentOrder });
    createCheckoutAdminClientMock.mockReturnValue(admin.client);
    await expect(startStripeCheckout(betaForm())).rejects.toThrow("REDIRECT:https://stripe.test/cs_beta");
    expect(applyBetaAccessMock).toHaveBeenCalledWith(admin.client, expect.objectContaining({ orderId: concurrentOrder.id }));
  });

  it("recovers an order-bound social grant after a transient redirect stripped a promo token", async () => {
    const admin = fakeAdmin({ betaGrant: {
      id: "grant-social", applicant_id: "profile-1", first_application_id: "app-1",
      first_order_id: deterministicCheckoutUuid("order", "app-1"), country: "france",
      audience: "social", delivery_method: "promo_code", discount_percent: 50,
      access_scope: "one_country", base_agency_fee_cents: 9_900, discount_cents: 4_950,
    } });
    createCheckoutAdminClientMock.mockReturnValue(admin.client);
    applyBetaAccessMock.mockResolvedValue(null);
    const form = new FormData(); form.set("packageId", "package-1"); form.set("applicationId", "app-1");
    await expect(startStripeCheckout(form)).rejects.toThrow("REDIRECT:https://stripe.test/cs_beta");
    expect(createSession).toHaveBeenCalledWith(
      expect.objectContaining({ line_items: [expect.objectContaining({ price_data: expect.objectContaining({ unit_amount: 4_950 }) })] }),
      expect.any(Object),
    );
  });

  it.each(["failed", "expired"])("heals a compatible %s discounted payment with a new Stripe attempt", async (status) => {
    const prior = discountedPayment({ status, metadata: { ...discountedPayment().metadata as object, beta_attempt: 1 } });
    const admin = fakeAdmin({ payments: [prior] }); createCheckoutAdminClientMock.mockReturnValue(admin.client);
    await expect(startStripeCheckout(betaForm())).rejects.toThrow("REDIRECT:https://stripe.test/cs_beta");
    expect(admin.updates.find((entry) => entry.table === "payment_records")?.value).toMatchObject({
      status: "pending", provider_session_id: null, metadata: { beta_attempt: 2 },
    });
    expect(createSession).toHaveBeenCalledWith(expect.any(Object), {
      idempotencyKey: `client-beta-checkout:${deterministicCheckoutUuid("order", "app-1")}:2`,
    });
  });

  it("reuses a fully matching concurrent discounted payment winner", async () => {
    const winner = discountedPayment();
    const admin = fakeAdmin({ paymentInsertError: { message: "duplicate key" }, concurrentPayment: winner });
    createCheckoutAdminClientMock.mockReturnValue(admin.client);
    await expect(startStripeCheckout(betaForm())).rejects.toThrow("REDIRECT:https://stripe.test/cs_beta");
    expect(createSession).toHaveBeenCalledTimes(1);
  });

  it("rejects a mismatched deterministic payment row", async () => {
    const admin = fakeAdmin({ payments: [discountedPayment({ amount_cents: 9_900 })] });
    createCheckoutAdminClientMock.mockReturnValue(admin.client);
    await expect(startStripeCheckout(betaForm())).rejects.toThrow(
      "REDIRECT:/client/checkout?error=payment_record_failed&packageId=package-1&applicationId=app-1",
    );
    expect(createSession).not.toHaveBeenCalled();
  });
});
