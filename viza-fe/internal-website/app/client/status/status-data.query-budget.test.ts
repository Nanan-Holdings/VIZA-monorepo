import { describe, expect, it, vi } from "vitest";
import {
  buildStatusPaymentScopeFilter,
  loadStatusPayments,
} from "./status-data";

type QueryResult = {
  data: unknown;
  error: { message: string } | null;
};

function paymentQuery(result: QueryResult) {
  const builder: Record<string, unknown> = {};
  builder.select = vi.fn(() => builder);
  builder.or = vi.fn(() => Promise.resolve(result));
  return builder;
}

describe("status payment query budget", () => {
  it("uses one OR read scoped to the resolved applicant and application IDs", async () => {
    const profileId = "11111111-1111-4111-8111-111111111111";
    const applicationId = "22222222-2222-4222-8222-222222222222";
    const query = paymentQuery({ data: [], error: null });
    const from = vi.fn(() => query);
    const adminClient = { from } as unknown as Parameters<typeof loadStatusPayments>[0];

    await expect(loadStatusPayments(adminClient, [profileId], [applicationId])).resolves.toEqual({
      rows: [],
      failed: false,
    });

    expect(from).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith("payment_records");
    expect(query.or).toHaveBeenCalledTimes(1);
    expect(query.or).toHaveBeenCalledWith(
      `applicant_id.in.(${profileId}),application_id.in.(${applicationId})`,
    );
  });

  it("does not widen reads to shared visa-package IDs or malformed identifiers", () => {
    const profileId = "11111111-1111-4111-8111-111111111111";
    const applicationId = "22222222-2222-4222-8222-222222222222";
    const malformedId = "foreign-user,visa_package_id.in.(shared-package)";

    expect(buildStatusPaymentScopeFilter([profileId, malformedId], [applicationId])).toBe(
      `applicant_id.in.(${profileId}),application_id.in.(${applicationId})`,
    );
    expect(buildStatusPaymentScopeFilter([], [])).toBeNull();
  });
});
