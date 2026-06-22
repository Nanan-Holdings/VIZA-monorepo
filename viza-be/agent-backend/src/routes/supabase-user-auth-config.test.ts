import { describe, expect, it } from "vitest";
import {
  describeMissingSupabaseUserAuthEnv,
  readSupabaseUserAuthConfig,
} from "./supabase-user-auth-config.js";

describe("Supabase user auth env config", () => {
  it("prefers NEXT_PUBLIC Supabase env names when both variants exist", () => {
    const config = readSupabaseUserAuthConfig({
      NEXT_PUBLIC_SUPABASE_URL: "https://public.example",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "public-anon",
      SUPABASE_URL: "https://server.example",
      SUPABASE_ANON_KEY: "server-anon",
    });

    expect(config).toMatchObject({
      supabaseUrl: "https://public.example",
      anonKey: "public-anon",
      supabaseUrlEnvName: "NEXT_PUBLIC_SUPABASE_URL",
      anonKeyEnvName: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    });
  });

  it("falls back to server Supabase env names used by local agent-backend", () => {
    const config = readSupabaseUserAuthConfig({
      SUPABASE_URL: "https://server.example",
      SUPABASE_ANON_KEY: "server-anon",
    });

    expect(config).toMatchObject({
      supabaseUrl: "https://server.example",
      anonKey: "server-anon",
      supabaseUrlEnvName: "SUPABASE_URL",
      anonKeyEnvName: "SUPABASE_ANON_KEY",
    });
  });

  it("reports grouped missing env requirements", () => {
    expect(describeMissingSupabaseUserAuthEnv({})).toEqual([
      "NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY",
    ]);
  });
});
