import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  authGetUser,
  createClient,
  getSupabaseClient,
} = vi.hoisted(() => ({
  authGetUser: vi.fn(),
  createClient: vi.fn(),
  getSupabaseClient: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({ createClient }));
vi.mock("../db/supabase-client.js", () => ({ getSupabaseClient }));

import router, {
  isAllowedUkResumeUrl,
  isUkStandardVisitorApplication,
} from "./uk-account.routes.js";
import { encryptSecret } from "../utils/secret-cipher.js";

type QueryResult = {
  data: unknown;
  error: { message: string } | null;
};

interface FakeQuery {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
}

type FakeFrom = ReturnType<typeof vi.fn<[table: string], FakeQuery>>;

function queryWithResult(result: QueryResult): FakeQuery {
  const query: FakeQuery = {
    select: vi.fn(),
    eq: vi.fn(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
    upsert: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.single.mockResolvedValue(result);
  query.maybeSingle.mockResolvedValue(result);
  query.upsert.mockResolvedValue(result);
  return query;
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/applications", router);
  return app;
}

describe("UK application-scoped account access", () => {
  let appQuery: FakeQuery;
  let accountQuery: FakeQuery;
  let admin: { from: FakeFrom };
  const application = {
    id: "application-id",
    applicant_id: "applicant-id",
    country: "united_kingdom",
    visa_type: "UK_STANDARD_VISITOR",
    applicant_profiles: { auth_user_id: "owner-id" },
  };

  beforeEach(() => {
    vi.stubEnv("SUPABASE_URL", "https://supabase.example.com");
    vi.stubEnv("SUPABASE_ANON_KEY", "anon-key");
    vi.stubEnv("SUBMISSION_RESULT_SECRET_KEY", "test-secret-key-0123456789");
    appQuery = queryWithResult({ data: application, error: null });
    accountQuery = queryWithResult({
      data: {
        email: "application@viza.it.com",
        password_encrypted: encryptSecret("TestPassword2!"),
        resume_url: "https://visas-immigration.service.gov.uk/forceResume/application-token",
      },
      error: null,
    });
    admin = {
      from: vi.fn<[table: string], FakeQuery>(
        (table: string) => table === "applications" ? appQuery : accountQuery,
      ),
    };
    getSupabaseClient.mockReset().mockReturnValue(admin);
    createClient.mockReset().mockReturnValue({ auth: { getUser: authGetUser } });
    authGetUser.mockReset().mockResolvedValue({ data: { user: { id: "owner-id" } }, error: null });
  });

  it("accepts only the exact UK Standard Visitor product and country", () => {
    expect(isUkStandardVisitorApplication("united_kingdom", "UK_STANDARD_VISITOR")).toBe(true);
    expect(isUkStandardVisitorApplication("uk", "UK_STANDARD_VISITOR")).toBe(true);
    expect(isUkStandardVisitorApplication("united_kingdom", "UK_ETA")).toBe(false);
    expect(isUkStandardVisitorApplication("united_states", "UK_STANDARD_VISITOR")).toBe(false);
  });

  it("accepts only official HTTPS forceResume URL shapes", () => {
    expect(isAllowedUkResumeUrl(
      "https://visas-immigration.service.gov.uk/forceResume/application-token",
    )).toBe(true);
    expect(isAllowedUkResumeUrl(
      "https://apply-uk-visa.service.gov.uk/forceResume?token=application-token",
    )).toBe(true);
    expect(isAllowedUkResumeUrl("http://visas-immigration.service.gov.uk/forceResume/token")).toBe(false);
    expect(isAllowedUkResumeUrl("https://visas-immigration.service.gov.uk/forceResume/token#secret")).toBe(false);
    expect(isAllowedUkResumeUrl("https://apply-uk-visa.service.gov.uk/forceResume?token=token&next=https://evil.example")).toBe(false);
    expect(isAllowedUkResumeUrl("https://evil.example/forceResume/token")).toBe(false);
  });

  it("authenticates the owner, binds account lookup to both application and applicant, and disables caching", async () => {
    const response = await request(buildApp())
      .post("/api/applications/application-id/uk-account/reveal")
      .set("Authorization", "Bearer owner-token");

    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect(response.headers.pragma).toBe("no-cache");
    expect(response.body).toMatchObject({
      email: "application@viza.it.com",
      password: "TestPassword2!",
      resumeUrl: "https://visas-immigration.service.gov.uk/forceResume/application-token",
    });
    expect(accountQuery.eq).toHaveBeenCalledWith("application_id", "application-id");
    expect(accountQuery.eq).toHaveBeenCalledWith("applicant_id", "applicant-id");
  });

  it("rejects a non-owner before touching the UK account table", async () => {
    authGetUser.mockResolvedValue({ data: { user: { id: "another-user" } }, error: null });

    const response = await request(buildApp())
      .post("/api/applications/application-id/uk-account/reveal")
      .set("Authorization", "Bearer other-token");

    expect(response.status).toBe(403);
    expect(admin.from).toHaveBeenCalledTimes(1);
    expect(admin.from).toHaveBeenCalledWith("applications");
    expect(accountQuery.select).not.toHaveBeenCalled();
  });

  it("marks authentication failures as private and uncached", async () => {
    authGetUser.mockResolvedValue({ data: { user: null }, error: new Error("invalid") });

    const response = await request(buildApp())
      .post("/api/applications/application-id/uk-account/reveal")
      .set("Authorization", "Bearer invalid-token");

    expect(response.status).toBe(401);
    expect(response.headers["cache-control"]).toBe("private, no-store");
  });

  it("rejects a wrong product before reading or writing credentials", async () => {
    appQuery = queryWithResult({
      data: { ...application, country: "united_states", visa_type: "DS160" },
      error: null,
    });
    admin.from.mockImplementation((table: string) => table === "applications" ? appQuery : accountQuery);

    const response = await request(buildApp())
      .post("/api/applications/application-id/uk-account/reveal")
      .set("Authorization", "Bearer owner-token");

    expect(response.status).toBe(409);
    expect(accountQuery.select).not.toHaveBeenCalled();
    expect(response.headers["cache-control"]).toBe("private, no-store");
  });

  it("writes the application binding and rejects an untrusted resume URL", async () => {
    const rejected = await request(buildApp())
      .post("/api/applications/application-id/uk-account")
      .set("Authorization", "Bearer owner-token")
      .send({
        email: "application@viza.it.com",
        password: "TestPassword2!",
        resumeUrl: "https://evil.example/forceResume/token",
      });

    expect(rejected.status).toBe(400);
    expect(accountQuery.upsert).not.toHaveBeenCalled();

    const accepted = await request(buildApp())
      .post("/api/applications/application-id/uk-account")
      .set("Authorization", "Bearer owner-token")
      .send({
        email: " application@viza.it.com ",
        password: "TestPassword2!",
        resumeUrl: "https://visas-immigration.service.gov.uk/forceResume/token",
      });

    expect(accepted.status).toBe(200);
    expect(accountQuery.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        applicant_id: "applicant-id",
        application_id: "application-id",
        email: "application@viza.it.com",
        resume_url: "https://visas-immigration.service.gov.uk/forceResume/token",
      }),
      { onConflict: "application_id" },
    );
  });

  it("fails closed on malformed stored ciphertext without exposing it", async () => {
    accountQuery = queryWithResult({
      data: {
        email: "application@viza.it.com",
        password_encrypted: "ciphertext-must-not-leak",
        resume_url: "https://visas-immigration.service.gov.uk/forceResume/application-token",
      },
      error: null,
    });
    admin.from.mockImplementation((table: string) => table === "applications" ? appQuery : accountQuery);

    const response = await request(buildApp())
      .post("/api/applications/application-id/uk-account/reveal")
      .set("Authorization", "Bearer owner-token");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: "Could not reveal the UK managed account" });
    expect(JSON.stringify(response.body)).not.toContain("ciphertext-must-not-leak");
    expect(response.headers["cache-control"]).toBe("private, no-store");
  });
});
