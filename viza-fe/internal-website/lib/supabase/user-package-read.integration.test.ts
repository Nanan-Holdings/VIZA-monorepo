// @vitest-environment node

import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";

const { getClientSessionWithFallback } = vi.hoisted(() => ({
  getClientSessionWithFallback: vi.fn(),
}));
vi.mock("@/lib/client-session", () => ({ getClientSessionWithFallback }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/rbac", () => ({ requireAdmin: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { getUserVisaPackage, getUserVisaPackages } from "@/app/actions/user-package";

const PROFILE_ID = "11111111-1111-4111-8111-111111111111";
const AUTH_ID = "22222222-2222-4222-8222-222222222222";

type PackageRow = {
  visa_package_id: string;
  auth_user_id: string;
  status: string;
  assigned_at: number;
  visa_packages: {
    id: string;
    country: string;
    visa_type: string;
    name: string;
    description: string | null;
  } | null;
};

type ObservedRead = {
  method: string | undefined;
  table: string;
  query: URLSearchParams;
  returnedRows: number;
};

async function withLocalPackageApi(
  run: (reads: ObservedRead[]) => Promise<void>,
): Promise<void> {
  const reads: ObservedRead[] = [];
  const rows: PackageRow[] = Array.from({ length: 50 }, (_, index) => ({
    visa_package_id: `synthetic-package-${index}`,
    auth_user_id: AUTH_ID,
    status: "active",
    assigned_at: index,
    visa_packages: {
      id: `synthetic-package-${index}`,
      country: "synthetic-country",
      visa_type: "synthetic-visa",
      name: `Synthetic package ${index}`,
      description: null,
    },
  }));
  rows.push(
    { ...rows[0], assigned_at: 100, visa_packages: null },
    { ...rows[0], assigned_at: 101, auth_user_id: "foreign-user" },
    { ...rows[0], assigned_at: 102, status: "inactive" },
  );

  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const table = url.pathname.replace("/rest/v1/", "");
    let result: unknown[];
    if (table === "applicant_profiles") {
      result = url.searchParams.get("id") === `eq.${PROFILE_ID}`
        ? [{ auth_user_id: AUTH_ID }]
        : [];
    } else if (table === "user_packages") {
      // A local PostgREST protocol fixture: apply the query actually sent by
      // the SDK. This is not a production database or query-plan benchmark.
      let selected = rows.filter((row) =>
        url.searchParams.get("auth_user_id") === `eq.${row.auth_user_id}` &&
        url.searchParams.get("status") === `eq.${row.status}`);
      if (url.searchParams.get("select")?.includes("visa_packages!inner(")) {
        selected = selected.filter((row) => row.visa_packages !== null);
      }
      if (url.searchParams.get("order") === "assigned_at.desc") {
        selected = selected.toSorted((left, right) => right.assigned_at - left.assigned_at);
      }
      const limit = url.searchParams.get("limit");
      if (limit !== null) selected = selected.slice(0, Number(limit));
      result = selected.map(({ visa_package_id, visa_packages }) => ({ visa_package_id, visa_packages }));
    } else {
      response.writeHead(404).end();
      return;
    }
    reads.push({ method: request.method, table, query: url.searchParams, returnedRows: result.length });
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify(result));
  });

  try {
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address() as AddressInfo;
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", `http://127.0.0.1:${address.port}`);
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "local-package-fixture-service-key");
    getClientSessionWithFallback.mockResolvedValue({ userId: PROFILE_ID, email: "synthetic@viza.test" });
    await run(reads);
  } finally {
    server.closeAllConnections();
    if (server.listening) await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("latest package read through the Supabase SDK", () => {
  it("sends owner-scoped inner embedding and a top-level limit while retaining the full list", async () => {
    await withLocalPackageApi(async (reads) => {
      const latest = await getUserVisaPackage();
      const all = await getUserVisaPackages();

      expect(latest).toEqual(all[0]);
      expect(latest?.id).toBe("synthetic-package-49");
      expect(all).toHaveLength(50);
      expect(reads).toHaveLength(4);
      expect(reads.every((read) => read.method === "GET")).toBe(true);
      const packages = reads.filter((read) => read.table === "user_packages");
      expect(packages[0].query.get("select")).toBe(
        "visa_package_id,visa_packages!inner(id,country,visa_type,name,description)",
      );
      expect(packages[0].query.get("limit")).toBe("1");
      expect(packages[0].query.get("order")).toBe("assigned_at.desc");
      expect(packages[0].returnedRows).toBe(1);
      expect(packages[1].query.get("limit")).toBeNull();
      expect(packages[1].query.get("select")).not.toContain("!inner");
      expect(packages[1].returnedRows).toBe(51);
      for (const read of packages) {
        expect(read.query.get("auth_user_id")).toBe(`eq.${AUTH_ID}`);
        expect(read.query.get("status")).toBe("eq.active");
      }
    });
  });
});
