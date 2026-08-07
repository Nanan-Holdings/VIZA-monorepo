import assert from "node:assert/strict";
import test from "node:test";

process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role";

test("generates Indonesia portal passwords within the official 8-12 character policy", async () => {
  const { generateIndonesiaPortalPassword } = await import("../account-alias.js");
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const password = generateIndonesiaPortalPassword();
    assert.equal(password.length, 12);
    assert.match(password, /[A-Z]/);
    assert.match(password, /[a-z]/);
    assert.match(password, /[0-9]/);
    assert.match(password, /[!@#$*?]/);
  }
});

test("Indonesia B1/C1 reuses one canonical applicant alias account", async () => {
  const { resolveIndonesiaAliasMigration } = await import("../account-alias.js");
  const result = resolveIndonesiaAliasMigration({
    canonicalAlias: "APPL-CANONICAL@VIZA.IT.COM",
    currentEmail: "appl-canonical@viza.it.com",
    currentPassword: "existing-password",
    currentAliasVersion: "v2",
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
    currentAliasVersion: null,
    generatedPassword: "new-password",
  });

  assert.deepEqual(result, {
    email: "appl-canonical@viza.it.com",
    password: "new-password",
    reuseExistingAccount: false,
    migrated: true,
  });
});

test("Indonesia alias v2 force-rotates an unversioned account even on the same alias", async () => {
  const { resolveIndonesiaAliasMigration } = await import("../account-alias.js");
  const result = resolveIndonesiaAliasMigration({
    canonicalAlias: "appl-canonical@viza.it.com",
    currentEmail: "appl-canonical@viza.it.com",
    currentPassword: "legacy-password",
    currentAliasVersion: null,
    generatedPassword: "new-password",
  });

  assert.deepEqual(result, {
    email: "appl-canonical@viza.it.com",
    password: "new-password",
    reuseExistingAccount: false,
    migrated: true,
  });
});
