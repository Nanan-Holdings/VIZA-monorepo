import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicCataloguePayload } from "@/lib/admin/catalogue";

const { createAdminClient, pricingFor, requireRole, revalidatePath } = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  pricingFor: vi.fn(),
  requireRole: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/rbac", () => ({ requireRole }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));
vi.mock("@/lib/pricing", () => ({ pricingFor }));

import { publishCatalogueEntry } from "./admin-catalogue";

const payload: PublicCataloguePayload = {
  slug: "indonesia",
  portalCountry: "indonesia",
  name: "Indonesia",
  city: "Bali · Jakarta",
  flagCode: "id",
  type: "e-Visa",
  visaType: "ID_C1_TOURIST",
  validity: "90 days",
  image: "/assets/heroes/indonesia.jpg",
  tag: "fast",
  featured: true,
  pricing: {
    currency: "SGD",
    governmentFeeMinor: 3_500,
    agencyFeeMinor: 9_900,
    firstTimeDiscountMinor: 0,
  },
};

type PricingRow = {
  id: string;
  currency: string;
  government_fee_cents: number;
  agency_fee_cents: number;
  source: string;
  updated_at: string;
};

function clonePayload(overrides: Partial<PublicCataloguePayload["pricing"]> = {}): PublicCataloguePayload {
  return { ...payload, pricing: { ...payload.pricing, ...overrides } };
}

function setupAdmin(input: {
  draft?: PublicCataloguePayload;
  pricingRows?: PricingRow[];
} = {}) {
  const draft = input.draft ?? payload;
  const pricingRows = input.pricingRows ?? [{
    id: "pricing-id",
    currency: "SGD",
    government_fee_cents: 3_500,
    agency_fee_cents: 9_900,
    source: "approved",
    updated_at: "2026-09-09T00:00:00.000Z",
  }];
  const rpc = vi.fn(async () => ({ data: null, error: null }));
  const from = vi.fn((table: string) => {
    if (table === "catalogue_publications") {
      const builder = {
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        maybeSingle: vi.fn(async () => ({ data: { draft_payload: draft }, error: null })),
      };
      return builder;
    }
    if (table === "visa_packages") {
      const builder = {
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        maybeSingle: vi.fn(async () => ({
          data: {
            id: "package-id",
            country: "indonesia",
            visa_type: "ID_C1_TOURIST",
            name: "Indonesia e-Visa",
            is_active: true,
            metadata: { coverage: "complete" },
          },
          error: null,
        })),
      };
      return builder;
    }
    if (table === "package_pricing") {
      const builder = {
        select: vi.fn(() => builder),
        eq: vi.fn(async () => ({ data: pricingRows, error: null })),
      };
      return builder;
    }
    if (table === "visa_form_fields" || table === "document_requirements") {
      const builder = {
        select: vi.fn(() => builder),
        eq: vi.fn(async () => ({ data: null, error: null, count: 1 })),
      };
      return builder;
    }
    throw new Error(`Unexpected table: ${table}`);
  });
  createAdminClient.mockReturnValue({ from, rpc });
  return { rpc };
}

describe("catalogue publication pricing parity", () => {
  beforeEach(() => {
    createAdminClient.mockReset();
    pricingFor.mockReset();
    requireRole.mockReset();
    revalidatePath.mockReset();
    requireRole.mockResolvedValue({ id: "admin-id" });
    pricingFor.mockReturnValue({
      country: "indonesia",
      visaType: "ID_C1_TOURIST",
      currency: "SGD",
      govtFeeCents: 3_500,
      agencyFeeCents: 9_900,
      govtFeeChannel: "viza_passthrough",
    });
  });

  it("publishes only when the snapshot, package_pricing row, and checkout pricing match exactly", async () => {
    const { rpc } = setupAdmin();

    await expect(publishCatalogueEntry({ visaPackageId: "package-id", reason: "Launch approved" }))
      .resolves.toMatchObject({ success: true });
    expect(rpc).toHaveBeenCalledWith("publish_catalogue_entry", expect.any(Object));
  });

  it("rejects a discount greater than the agency fee and a negative advertised total", async () => {
    const { rpc } = setupAdmin({ draft: clonePayload({ governmentFeeMinor: 0, firstTimeDiscountMinor: 10_000 }) });

    const result = await publishCatalogueEntry({ visaPackageId: "package-id", reason: "Launch approved" });

    expect(result).toMatchObject({ success: false });
    expect(result.readiness?.blockers).toEqual(expect.arrayContaining([
      "Public discount cannot exceed the advertised agency fee.",
      "Public advertised total cannot be negative.",
    ]));
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects a public currency that differs from checkout pricing", async () => {
    pricingFor.mockReturnValue({
      country: "indonesia",
      visaType: "ID_C1_TOURIST",
      currency: "USD",
      govtFeeCents: 3_500,
      agencyFeeCents: 9_900,
      govtFeeChannel: "viza_passthrough",
    });
    const { rpc } = setupAdmin({
      pricingRows: [{
        id: "pricing-id",
        currency: "USD",
        government_fee_cents: 3_500,
        agency_fee_cents: 9_900,
        source: "approved",
        updated_at: "2026-09-09T00:00:00.000Z",
      }],
    });

    const result = await publishCatalogueEntry({ visaPackageId: "package-id", reason: "Launch approved" });

    expect(result).toMatchObject({ success: false });
    expect(result.readiness?.blockers).toContain("Public currency must exactly match checkout pricing currency (USD).");
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each([
    ["agency", { agencyFeeMinor: 9_800 }, "Public agency fee must exactly match checkout pricing."],
    ["government", { governmentFeeMinor: 3_400 }, "Public government fee must exactly match checkout pricing."],
  ])("rejects an advertised %s fee that differs from checkout pricing", async (_label, overrides, expected) => {
    const { rpc } = setupAdmin({ draft: clonePayload(overrides) });

    const result = await publishCatalogueEntry({ visaPackageId: "package-id", reason: "Launch approved" });

    expect(result).toMatchObject({ success: false });
    expect(result.readiness?.blockers).toContain(expected);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects a package_pricing row that differs from portal checkout pricing", async () => {
    const { rpc } = setupAdmin({
      draft: clonePayload({ agencyFeeMinor: 9_800 }),
      pricingRows: [{
        id: "pricing-id",
        currency: "SGD",
        government_fee_cents: 3_500,
        agency_fee_cents: 9_800,
        source: "approved",
        updated_at: "2026-09-09T00:00:00.000Z",
      }],
    });

    const result = await publishCatalogueEntry({ visaPackageId: "package-id", reason: "Launch approved" });

    expect(result).toMatchObject({ success: false });
    expect(result.readiness?.blockers).toContain("The package_pricing row must exactly match the pricing used by portal checkout.");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects ambiguous package pricing instead of choosing the first row", async () => {
    const canonicalRow: PricingRow = {
      id: "pricing-id",
      currency: "SGD",
      government_fee_cents: 3_500,
      agency_fee_cents: 9_900,
      source: "approved",
      updated_at: "2026-09-09T00:00:00.000Z",
    };
    const { rpc } = setupAdmin({ pricingRows: [canonicalRow, { ...canonicalRow, id: "pricing-id-2" }] });

    const result = await publishCatalogueEntry({ visaPackageId: "package-id", reason: "Launch approved" });

    expect(result).toMatchObject({ success: false });
    expect(result.readiness?.blockers).toContain("Exactly one authoritative package_pricing row is required.");
    expect(rpc).not.toHaveBeenCalled();
  });
});
