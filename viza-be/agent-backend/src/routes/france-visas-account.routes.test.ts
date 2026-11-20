import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { authGetUser, createClient, getSupabaseClient } = vi.hoisted(() => ({
  authGetUser: vi.fn(),
  createClient: vi.fn(),
  getSupabaseClient: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({ createClient }));
vi.mock("../db/supabase-client.js", () => ({ getSupabaseClient }));

import router, { maskEmail, validateFranceVisasLogin } from "./france-visas-account.routes.js";
import { decryptSecret } from "../utils/secret-cipher.js";

interface FakeQuery {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  then?: unknown;
}

function chain(result: { data: unknown; error: { message: string } | null }): FakeQuery {
  const query: FakeQuery = {
    select: vi.fn(),
    eq: vi.fn(),
    single: vi.fn(),
    delete: vi.fn(),
    insert: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.delete.mockReturnValue(query);
  query.single.mockResolvedValue(result);
  query.insert.mockResolvedValue({ error: null });
  // `await admin.from().delete().eq().eq()` resolves the query itself.
  query.eq.mockImplementation(() => Object.assign(query, {
    then: (resolve: (value: unknown) => void) => resolve({ error: null }),
  }));
  return query;
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/applications", router);
  return app;
}

describe("France-Visas account linking", () => {
  let appQuery: FakeQuery;
  let accountQuery: FakeQuery;

  beforeEach(() => {
    vi.stubEnv("SUPABASE_URL", "https://supabase.example.com");
    vi.stubEnv("SUPABASE_ANON_KEY", "anon-key");
    vi.stubEnv("SUBMISSION_RESULT_SECRET_KEY", "test-secret-key-0123456789");
    appQuery = chain({
      data: {
        id: "application-id",
        visa_type: "EU_SCHENGEN_C_SHORT_STAY",
        applicant_profiles: { auth_user_id: "owner-id" },
      },
      error: null,
    });
    accountQuery = chain({ data: null, error: null });
    getSupabaseClient.mockReset().mockReturnValue({
      from: vi.fn((table: string) => (table === "applications" ? appQuery : accountQuery)),
    });
    createClient.mockReset().mockReturnValue({ auth: { getUser: authGetUser } });
    authGetUser.mockReset().mockResolvedValue({ data: { user: { id: "owner-id" } }, error: null });
  });

  it("validates the login and masks the email", () => {
    expect(validateFranceVisasLogin(" Me@Example.com ", "Secret-pass1")).toEqual({
      email: "me@example.com",
      password: "Secret-pass1",
    });
    expect(validateFranceVisasLogin("not-an-email", "Secret-pass1")).toHaveProperty("error");
    expect(validateFranceVisasLogin("me@example.com", "short")).toHaveProperty("error");
    expect(validateFranceVisasLogin("me@example.com", " padded-pass ")).toHaveProperty("error");
    expect(maskEmail("applicant@example.com")).toBe("ap•••@example.com");
  });

  it("rejects a request without a bearer token", async () => {
    const response = await request(buildApp())
      .post("/api/applications/application-id/france-visas-account")
      .send({ email: "me@example.com", password: "Secret-pass1" });
    expect(response.status).toBe(401);
  });

  it("rejects another user's application before touching fv_accounts", async () => {
    authGetUser.mockResolvedValue({ data: { user: { id: "someone-else" } }, error: null });
    const response = await request(buildApp())
      .post("/api/applications/application-id/france-visas-account")
      .set("Authorization", "Bearer token")
      .send({ email: "me@example.com", password: "Secret-pass1" });
    expect(response.status).toBe(403);
    expect(accountQuery.insert).not.toHaveBeenCalled();
  });

  it("stores the login encrypted for the owner and never echoes the password", async () => {
    const response = await request(buildApp())
      .post("/api/applications/application-id/france-visas-account")
      .set("Authorization", "Bearer token")
      .send({ email: "Me@Example.com", password: "Secret-pass1" });

    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect(response.body).toMatchObject({ ok: true, email: "me•••@example.com" });
    expect(JSON.stringify(response.body)).not.toContain("Secret-pass1");

    expect(accountQuery.delete).toHaveBeenCalled();
    expect(accountQuery.eq).toHaveBeenCalledWith("user_id", "owner-id");
    const row = accountQuery.insert.mock.calls[0][0] as Record<string, string>;
    expect(row).toMatchObject({ user_id: "owner-id", application_id: "application-id", provider: "france_visas", status: "linked" });
    expect(row.official_account_password_encrypted).not.toContain("Secret-pass1");
    expect(decryptSecret(row.official_account_email_encrypted)).toBe("me@example.com");
    expect(decryptSecret(row.official_account_password_encrypted)).toBe("Secret-pass1");
  });

  it("refuses a non-France application", async () => {
    appQuery.single.mockResolvedValue({
      data: { id: "application-id", visa_type: "DS160", applicant_profiles: { auth_user_id: "owner-id" } },
      error: null,
    });
    const response = await request(buildApp())
      .post("/api/applications/application-id/france-visas-account")
      .set("Authorization", "Bearer token")
      .send({ email: "me@example.com", password: "Secret-pass1" });
    expect(response.status).toBe(409);
  });
});
