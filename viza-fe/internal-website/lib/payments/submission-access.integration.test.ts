// @vitest-environment node
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { evaluateSubmissionAccess } from "./submission-access";

describe("payment-free access through the Supabase SDK", () => {
  it("reads only the selected application and its owner; rejects a foreign account", async () => {
    const requests: { method: string; path: string; id: string | null }[] = [];
    const server = createServer((request, response) => {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      requests.push({ method: request.method ?? "", path: url.pathname, id: url.searchParams.get("id") });
      const result = url.pathname === "/rest/v1/applications"
        ? { id: "application-1", applicant_id: "profile-1", group_id: null }
        : url.pathname === "/rest/v1/applicant_profiles"
          ? { id: "profile-1", auth_user_id: "owner-1", dependant_of_user_id: null }
          : null;
      response.writeHead(result ? 200 : 500, { "content-type": "application/json" });
      response.end(JSON.stringify(result ?? { message: "Financial storage is unavailable" }));
    });
    try {
      await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
      const admin = createClient(`http://127.0.0.1:${(server.address() as AddressInfo).port}`, "synthetic-test-key", {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const decision = await evaluateSubmissionAccess(admin, "application-1", { payerAuthUserId: "owner-1" });
      expect(decision.status).toBe("ready");
      expect(decision.checkoutUrl).toBeNull();
      await expect(evaluateSubmissionAccess(admin, "application-1", { payerAuthUserId: "foreign-owner" })).rejects.toThrow("does not own");
      expect(requests).toEqual([
        { method: "GET", path: "/rest/v1/applications", id: "eq.application-1" },
        { method: "GET", path: "/rest/v1/applicant_profiles", id: "eq.profile-1" },
        { method: "GET", path: "/rest/v1/applications", id: "eq.application-1" },
        { method: "GET", path: "/rest/v1/applicant_profiles", id: "eq.profile-1" },
      ]);
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
