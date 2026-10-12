import { beforeEach, describe, expect, it, vi } from "vitest";

type PackageRow = {
  id: string;
  country: string;
  visa_type: string;
  name: string;
  description: string | null;
};

type UserPackageRow = {
  visa_package_id: string | null;
  visa_packages: PackageRow | PackageRow[] | null;
};

type QueryResult = {
  data: unknown;
  error: { message: string } | null;
};

type QueryCall = {
  table: string;
  select: string | null;
  eq: Array<[string, string]>;
  order: Array<{ column: string; ascending: boolean }>;
  limit: number[];
};

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  getClientSessionWithFallback: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/client-session", () => ({
  getClientSessionWithFallback: mocks.getClientSessionWithFallback,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

import { getUserVisaPackage, getUserVisaPackages } from "./user-package";

const PROFILE_ID = "11111111-1111-4111-8111-111111111111";
const AUTH_USER_ID = "22222222-2222-4222-8222-222222222222";

function packageRow(id: string, country = "japan"): PackageRow {
  return {
    id,
    country,
    visa_type: "tourism",
    name: `${country} tourism`,
    description: `${country} package`,
  };
}

function userPackageRow(
  pkg: PackageRow | PackageRow[] | null,
): UserPackageRow {
  const first = Array.isArray(pkg) ? pkg[0] : pkg;
  return {
    visa_package_id: first?.id ?? null,
    visa_packages: pkg,
  };
}

function createAdminClientMock({
  profile,
  list,
  latest,
}: {
  profile: QueryResult;
  list: QueryResult;
  latest: QueryResult;
}) {
  const calls: QueryCall[] = [];

  const client = {
    from(table: string) {
      const call: QueryCall = {
        table,
        select: null,
        eq: [],
        order: [],
        limit: [],
      };
      calls.push(call);

      const response = () => {
        if (table === "applicant_profiles") return profile;
        return call.select?.includes("!inner") ? latest : list;
      };

      const query = {
        select(columns: string) {
          call.select = columns;
          return query;
        },
        eq(column: string, value: string) {
          call.eq.push([column, value]);
          return query;
        },
        order(column: string, options: { ascending: boolean }) {
          call.order.push({ column, ascending: options.ascending });
          return query;
        },
        limit(value: number) {
          call.limit.push(value);
          return query;
        },
        maybeSingle() {
          return Promise.resolve(response());
        },
        then<TResult1 = QueryResult, TResult2 = never>(
          onfulfilled?:
            | ((value: QueryResult) => TResult1 | PromiseLike<TResult1>)
            | null,
          onrejected?:
            | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
            | null,
        ) {
          return Promise.resolve(response()).then(onfulfilled, onrejected);
        },
      };

      return query;
    },
  };

  return { calls, client };
}

function defaultResponses(
  overrides: Partial<{
    profile: QueryResult;
    list: QueryResult;
    latest: QueryResult;
  }> = {},
) {
  const latest = packageRow("pkg-latest");
  return {
    profile: {
      data: { auth_user_id: AUTH_USER_ID },
      error: null,
    },
    list: {
      data: [userPackageRow(latest)],
      error: null,
    },
    latest: {
      data: userPackageRow(latest),
      error: null,
    },
    ...overrides,
  } satisfies {
    profile: QueryResult;
    list: QueryResult;
    latest: QueryResult;
  };
}

beforeEach(() => {
  mocks.createAdminClient.mockReset();
  mocks.getClientSessionWithFallback.mockReset();
  mocks.revalidatePath.mockReset();
  mocks.getClientSessionWithFallback.mockResolvedValue({
    userId: PROFILE_ID,
    email: "applicant@example.test",
  });
});

describe("getUserVisaPackage latest read", () => {
  it("limits the latest-only query to one valid embedded package", async () => {
    const latest = packageRow("pkg-latest");
    const older = packageRow("pkg-older", "france");
    const fake = createAdminClientMock(
      defaultResponses({
        list: {
          data: [userPackageRow(latest), userPackageRow(older)],
          error: null,
        },
        latest: { data: userPackageRow(latest), error: null },
      }),
    );
    mocks.createAdminClient.mockReturnValue(fake.client);

    await expect(getUserVisaPackage()).resolves.toEqual({
      id: latest.id,
      country: latest.country,
      visa_type: latest.visa_type,
      name: latest.name,
      description: latest.description,
    });

    expect(mocks.createAdminClient).toHaveBeenCalledWith({
      requestTimeoutMs: 4_000,
      retryDelaysMs: [250],
    });
    expect(fake.calls.filter((call) => call.table === "user_packages")).toHaveLength(1);
    const call = fake.calls.find((entry) => entry.table === "user_packages");
    expect(call?.select).toBe(
      "visa_package_id, visa_packages!inner(id, country, visa_type, name, description)",
    );
    expect(call?.eq).toContainEqual(["auth_user_id", AUTH_USER_ID]);
    expect(call?.eq).toContainEqual(["status", "active"]);
    expect(call?.order).toEqual([{ column: "assigned_at", ascending: false }]);
    expect(call?.limit).toEqual([1]);
  });

  it("returns the next valid assignment when the newest package relation is absent", async () => {
    const newestWithoutPackage = userPackageRow(null);
    const nextValid = packageRow("pkg-next-valid", "singapore");
    const fake = createAdminClientMock(
      defaultResponses({
        list: {
          data: [newestWithoutPackage, userPackageRow(nextValid)],
          error: null,
        },
        // The !inner relation removes newestWithoutPackage before limit(1).
        latest: { data: userPackageRow(nextValid), error: null },
      }),
    );
    mocks.createAdminClient.mockReturnValue(fake.client);

    await expect(getUserVisaPackage()).resolves.toMatchObject({
      id: nextValid.id,
      country: nextValid.country,
    });

    const call = fake.calls.find((entry) => entry.table === "user_packages");
    expect(call?.select).toContain("visa_packages!inner(");
    expect(call?.limit).toEqual([1]);
  });

  it("keeps the full list query and filters missing relations", async () => {
    const first = packageRow("pkg-first");
    const second = packageRow("pkg-second", "vietnam");
    const fake = createAdminClientMock(
      defaultResponses({
        list: {
          data: [
            userPackageRow(first),
            userPackageRow([second]),
            userPackageRow(null),
          ],
          error: null,
        },
      }),
    );
    mocks.createAdminClient.mockReturnValue(fake.client);

    await expect(getUserVisaPackages()).resolves.toEqual([
      {
        id: first.id,
        country: first.country,
        visa_type: first.visa_type,
        name: first.name,
        description: first.description,
      },
      {
        id: second.id,
        country: second.country,
        visa_type: second.visa_type,
        name: second.name,
        description: second.description,
      },
    ]);

    const call = fake.calls.find((entry) => entry.table === "user_packages");
    expect(call?.select).toBe(
      "visa_package_id, visa_packages(id, country, visa_type, name, description)",
    );
    expect(call?.limit).toEqual([]);
  });
});

describe("getUserVisaPackage authentication compatibility", () => {
  it("uses the linked auth user id for ownership", async () => {
    const fake = createAdminClientMock(defaultResponses());
    mocks.createAdminClient.mockReturnValue(fake.client);
    mocks.getClientSessionWithFallback.mockResolvedValue({
      userId: PROFILE_ID,
      authUserId: "legacy-auth-id-that-must-not-win",
      email: "applicant@example.test",
    });

    await getUserVisaPackage();

    const packageCall = fake.calls.find((call) => call.table === "user_packages");
    expect(packageCall?.eq).toContainEqual(["auth_user_id", AUTH_USER_ID]);
    expect(packageCall?.eq).not.toContainEqual([
      "auth_user_id",
      "legacy-auth-id-that-must-not-win",
    ]);
  });

  it("falls back to the session user id when the profile has no auth link", async () => {
    const fake = createAdminClientMock(
      defaultResponses({ profile: { data: { auth_user_id: null }, error: null } }),
    );
    mocks.createAdminClient.mockReturnValue(fake.client);

    await getUserVisaPackage();

    const packageCall = fake.calls.find((call) => call.table === "user_packages");
    expect(packageCall?.eq).toContainEqual(["auth_user_id", PROFILE_ID]);
  });

  it("does not query admin data without a session", async () => {
    mocks.getClientSessionWithFallback.mockResolvedValue(null);

    await expect(getUserVisaPackage()).resolves.toBeNull();

    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("stops after a profile error and returns null", async () => {
    const fake = createAdminClientMock(
      defaultResponses({
        profile: { data: null, error: { message: "profile unavailable" } },
      }),
    );
    mocks.createAdminClient.mockReturnValue(fake.client);

    await expect(getUserVisaPackage()).resolves.toBeNull();

    expect(fake.calls.map((call) => call.table)).toEqual(["applicant_profiles"]);
  });

  it("returns null on a latest package query error", async () => {
    const fake = createAdminClientMock(
      defaultResponses({
        latest: { data: null, error: { message: "package unavailable" } },
      }),
    );
    mocks.createAdminClient.mockReturnValue(fake.client);

    await expect(getUserVisaPackage()).resolves.toBeNull();

    expect(fake.calls.map((call) => call.table)).toEqual([
      "applicant_profiles",
      "user_packages",
    ]);
  });
});

describe("getUserVisaPackage request isolation", () => {
  it("does not reuse a previous user's latest package", async () => {
    const firstPackage = packageRow("pkg-first-user", "japan");
    const secondPackage = packageRow("pkg-second-user", "canada");
    const first = createAdminClientMock(
      defaultResponses({ latest: { data: userPackageRow(firstPackage), error: null } }),
    );
    const second = createAdminClientMock(
      defaultResponses({
        profile: { data: { auth_user_id: "33333333-3333-4333-8333-333333333333" }, error: null },
        latest: { data: userPackageRow(secondPackage), error: null },
      }),
    );
    mocks.createAdminClient
      .mockReturnValueOnce(first.client)
      .mockReturnValueOnce(second.client);

    await expect(getUserVisaPackage()).resolves.toMatchObject({ id: firstPackage.id });
    mocks.getClientSessionWithFallback.mockResolvedValue({
      userId: "44444444-4444-4444-8444-444444444444",
      email: "second@example.test",
    });
    await expect(getUserVisaPackage()).resolves.toMatchObject({ id: secondPackage.id });

    expect(mocks.createAdminClient).toHaveBeenCalledTimes(2);
    expect(first.calls.find((call) => call.table === "user_packages")?.eq).toContainEqual([
      "auth_user_id",
      AUTH_USER_ID,
    ]);
    expect(second.calls.find((call) => call.table === "user_packages")?.eq).toContainEqual([
      "auth_user_id",
      "33333333-3333-4333-8333-333333333333",
    ]);
  });
});
