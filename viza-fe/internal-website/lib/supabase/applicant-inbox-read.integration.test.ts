// @vitest-environment node

import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";

const { getClientSessionWithFallback } = vi.hoisted(() => ({ getClientSessionWithFallback: vi.fn() }));
vi.mock("@/lib/client-session", () => ({ getClientSessionWithFallback }));
vi.mock("@/lib/rbac", () => ({ requireAdmin: vi.fn(), getCurrentUser: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn() }));

import { initializeAuthenticatedApplicantInbox } from "@/app/actions/applicant-inbox";

const PROFILE_ID = "11111111-1111-4111-8111-111111111111";
const AUTH_ID = "22222222-2222-4222-8222-222222222222";
const CONSENT_KIND = "alias_email_forwarding";
const CONSENT_VERSION = "2026-07-22";
type ObservedRead = { table: string; method: string | undefined; query: URLSearchParams };

async function withLocalInboxApi(
  options: { legacyIdentity: boolean; accountConsent: boolean },
  run: (reads: ObservedRead[]) => Promise<void>,
): Promise<void> {
  const reads: ObservedRead[] = [];
  const profile = {
    id: PROFILE_ID,
    auth_user_id: AUTH_ID,
    email: "Synthetic@Viza.Test",
    inbox_alias: "  APPL-SYNTHETIC@VIZA.IT.COM  ",
    inbox_alias_retired_at: null,
  };
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const table = url.pathname.replace("/rest/v1/", "");
    const query = url.searchParams;
    reads.push({ table, method: request.method, query });
    if (request.method !== "GET") {
      response.writeHead(405).end();
      return;
    }
    let data: unknown[];
    if (table === "applicant_profiles") {
      const matches = query.get("id") === `eq.${PROFILE_ID}` || query.get("auth_user_id") === `eq.${AUTH_ID}`;
      const columns = query.get("select")?.split(",") ?? [];
      // Return only the selected fields so this exercises the expanded
      // projection instead of accidentally supplying alias state to old code.
      data = matches ? [Object.fromEntries(Object.entries(profile).filter(([column]) => columns.includes(column)))] : [];
    } else if (table === "consent_event") {
      data = options.accountConsent &&
        query.get("applicant_id") === `eq.${PROFILE_ID}` &&
        query.get("doc_kind") === `eq.${CONSENT_KIND}` &&
        query.get("doc_version") === `eq.${CONSENT_VERSION}`
        ? [{ id: "synthetic-account-consent" }] : [];
    } else if (table === "consent_events") {
      data = query.get("applicant_id") === `eq.${PROFILE_ID}` &&
        query.get("consent_type") === `eq.${CONSENT_KIND}` &&
        query.get("version") === `eq.${CONSENT_VERSION}` &&
        query.get("accepted") === "eq.true"
        ? [{ id: "synthetic-application-consent" }] : [];
    } else {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(data));
  });

  try {
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", `http://127.0.0.1:${(server.address() as AddressInfo).port}`);
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "local-inbox-fixture-service-key");
    getClientSessionWithFallback.mockResolvedValue({
      userId: options.legacyIdentity ? AUTH_ID : PROFILE_ID,
      authUserId: AUTH_ID,
      email: "synthetic@viza.test",
    });
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

describe("inbox initialization through the Supabase SDK", () => {
  it.each([false, true])("reuses the active alias with legacyIdentity=%s", async (legacyIdentity) => {
    await withLocalInboxApi({ legacyIdentity, accountConsent: true }, async (reads) => {
      expect(await initializeAuthenticatedApplicantInbox()).toEqual({
        ok: true,
        data: {
          alias: "appl-synthetic@viza.it.com",
          destinationEmail: "synthetic@viza.test",
          forwardingAuthorized: true,
        },
      });
      expect(reads).toHaveLength(legacyIdentity ? 3 : 2);
      expect(reads.every((read) => read.method === "GET")).toBe(true);
      const profiles = reads.filter((read) => read.table === "applicant_profiles");
      expect(profiles).toHaveLength(legacyIdentity ? 2 : 1);
      profiles.forEach((read) => {
        expect(read.query.get("select")).toBe("id,auth_user_id,email,inbox_alias,inbox_alias_retired_at");
      });
      expect(profiles[0].query.get("id")).toBe(`eq.${legacyIdentity ? AUTH_ID : PROFILE_ID}`);
      if (legacyIdentity) expect(profiles[1].query.get("auth_user_id")).toBe(`eq.${AUTH_ID}`);
      expect(reads.at(-1)?.table).toBe("consent_event");
    });
  });

  it("retains the legacy application-consent read without backfilling or assigning an alias", async () => {
    await withLocalInboxApi({ legacyIdentity: false, accountConsent: false }, async (reads) => {
      const result = await initializeAuthenticatedApplicantInbox();
      expect(result.ok && result.data.forwardingAuthorized).toBe(true);
      expect(reads.map((read) => read.table)).toEqual(["applicant_profiles", "consent_event", "consent_events"]);
      expect(reads.every((read) => read.method === "GET")).toBe(true);
      const consent = reads.at(-1)?.query;
      expect(consent?.get("applicant_id")).toBe(`eq.${PROFILE_ID}`);
      expect(consent?.get("document_hash")).toBe(
        "eq.sha256:5d2d7fcccd083bbde90b9d42529b5f8cab380fd7bf26a79eb2ba84315f1fb212",
      );
      expect(consent?.get("accepted")).toBe("eq.true");
      expect(consent?.get("limit")).toBe("1");
    });
  });
});
