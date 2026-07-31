import assert from "node:assert/strict";
import test from "node:test";

process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role";

test("Indonesia B1/C1 reuses one canonical applicant alias account", async () => {
  const { resolveIndonesiaAliasMigration } = await import("../account-alias.js");
  const result = resolveIndonesiaAliasMigration({
    canonicalAlias: "APPL-CANONICAL@VIZA.IT.COM",
    currentEmail: "appl-canonical@viza.it.com",
    currentPassword: "existing-password",
    generatedPassword: "new-password",
  });

  assert.deepEqual(result, {
    email: "appl-canonical@viza.it.com",
    password: "existing-password",
    reuseExistingAccount: true,
    migrated: false,
  });
});

test("Indonesia alias v2 rotates a legacy portal account and password", async () => {
  const { resolveIndonesiaAliasMigration } = await import("../account-alias.js");
  const result = resolveIndonesiaAliasMigration({
    canonicalAlias: "appl-canonical@viza.it.com",
    currentEmail: "traveller@example.com",
    currentPassword: "legacy-password",
    generatedPassword: "new-password",
  });

  assert.deepEqual(result, {
    email: "appl-canonical@viza.it.com",
    password: "new-password",
    reuseExistingAccount: false,
    migrated: true,
  });
});
