import { describe, expect, it } from "vitest";
import { agentBackendBaseUrls } from "@/lib/agent-backend-url.server";
import { toBrowserSafeFranceVisasAccount } from "./route-handler";

describe("France-Visas browser account projection", () => {
  it("returns only linked status and never credential or reference fields", () => {
    const projection = toBrowserSafeFranceVisasAccount({
      id: "account-1",
      updated_at: "2026-08-19T00:00:00.000Z",
      created_at: null,
    });

    expect(projection).toEqual({
      email: null,
      configured: true,
      verificationStatus: "unknown",
      portalUrl: "https://application-form.france-visas.gouv.fr/fv-fo-dde/",
      updatedAt: "2026-08-19T00:00:00.000Z",
    });
    expect(projection).not.toHaveProperty("password");
    expect(projection).not.toHaveProperty("officialReference");
    expect(JSON.stringify(projection)).not.toContain("SUBMISSION_RESULT_SECRET_KEY");
  });

  it("falls back to the creation time", () => {
    expect(
      toBrowserSafeFranceVisasAccount({ id: "account-2", updated_at: null, created_at: "2026-08-18T00:00:00.000Z" })
        .updatedAt,
    ).toBe("2026-08-18T00:00:00.000Z");
  });
});

describe("agentBackendBaseUrls", () => {
  it("tries the configured backend first and the canonical one as a production fallback", () => {
    expect(
      agentBackendBaseUrls({ NODE_ENV: "production", AGENT_BACKEND_URL: "https://backend.example.test/" }),
    ).toEqual(["https://backend.example.test", "https://viza-agent-backend-gqix.onrender.com"]);
    expect(agentBackendBaseUrls({ NODE_ENV: "production" })).toEqual([
      "https://viza-agent-backend-gqix.onrender.com",
    ]);
    expect(agentBackendBaseUrls({ NODE_ENV: "development" })).toEqual(["http://localhost:3002"]);
  });
});
