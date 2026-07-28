import { describe, expect, it } from "vitest";
import { normalizeSupabaseEnvValue } from "./env";

describe("normalizeSupabaseEnvValue", () => {
  it("removes a leading BOM and surrounding whitespace", () => {
    expect(
      normalizeSupabaseEnvValue(
        " \uFEFFsb_publishable_example \r\n",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY"
      )
    ).toBe("sb_publishable_example");
  });

  it("rejects a BOM embedded inside a credential", () => {
    expect(() =>
      normalizeSupabaseEnvValue(
        "sb_pub\uFEFFlishable_example",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY"
      )
    ).toThrow(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY contains an unexpected Unicode BOM"
    );
  });

  it("rejects a missing credential with its environment name", () => {
    expect(() =>
      normalizeSupabaseEnvValue(undefined, "NEXT_PUBLIC_SUPABASE_URL")
    ).toThrow("Missing NEXT_PUBLIC_SUPABASE_URL");
  });
});
