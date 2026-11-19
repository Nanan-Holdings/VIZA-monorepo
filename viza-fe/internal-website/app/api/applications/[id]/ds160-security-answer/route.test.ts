import { beforeEach, describe, expect, it, vi } from "vitest";

const { createAdminClient, createClient } = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

import { GET } from "./route";

function query(result: unknown) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => result),
  };
  return builder;
}

function signedIn(userId: string | null) {
  createClient.mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null } }) },
  });
}

function tables(rows: { profile: unknown; application: unknown; answer?: unknown }) {
  const from = vi.fn((table: string) => {
    if (table === "applicant_profiles") return query({ data: rows.profile, error: null });
    if (table === "applications") return query({ data: rows.application, error: null });
    return query({ data: rows.answer ?? null, error: null });
  });
  createAdminClient.mockReturnValue({ from });
  return from;
}

const params = { params: Promise.resolve({ id: "app-1" }) };

describe("GET ds160-security-answer", () => {
  beforeEach(() => {
    createAdminClient.mockReset();
    createClient.mockReset();
  });

  it("returns the owner's saved answer without caching", async () => {
    signedIn("user-1");
    tables({
      profile: { id: "profile-1" },
      application: { id: "app-1", applicant_id: "profile-1", visa_type: "DS160" },
      answer: { value_text: "  ABCDEFGH2345 " },
    });
    const response = await GET(new Request("http://localhost"), params);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ answer: "ABCDEFGH2345" });
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("returns null when no answer is saved yet", async () => {
    signedIn("user-1");
    tables({
      profile: { id: "profile-1" },
      application: { id: "app-1", applicant_id: "profile-1", visa_type: "DS160" },
    });
    const response = await GET(new Request("http://localhost"), params);
    expect(await response.json()).toEqual({ answer: null });
  });

  it("rejects another applicant's application", async () => {
    signedIn("user-2");
    const from = tables({
      profile: { id: "profile-2" },
      application: { id: "app-1", applicant_id: "profile-1", visa_type: "DS160" },
      answer: { value_text: "SECRET" },
    });
    const response = await GET(new Request("http://localhost"), params);
    expect(response.status).toBe(403);
    expect(from).not.toHaveBeenCalledWith("visa_application_answers");
  });

  it("requires an authenticated session", async () => {
    signedIn(null);
    tables({ profile: null, application: null });
    const response = await GET(new Request("http://localhost"), params);
    expect(response.status).toBe(401);
  });
});
