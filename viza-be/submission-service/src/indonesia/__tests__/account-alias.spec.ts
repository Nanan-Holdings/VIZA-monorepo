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
    assert.match(password, /!/);
    assert.doesNotMatch(password, /[@#$*?]/);
  }
});

test("Indonesia B1/C1 derives and reuses one service alias account", async () => {
  const { resolveIndonesiaAliasMigration } = await import("../account-alias.js");
  const result = resolveIndonesiaAliasMigration({
    canonicalAlias: "APPL-01KX2GDTC5GAEH0V3MVHX98JTJ@VIZA.IT.COM",
    currentEmail: "id-01kx2gdtc5gaeh0v3mvhx98jtj@viza.it.com",
    currentPassword: "existing-password",
    currentAliasVersion: "v3",
    generatedPassword: "new-password",
  });

  assert.deepEqual(result, {
    email: "id-01kx2gdtc5gaeh0v3mvhx98jtj@viza.it.com",
    password: "existing-password",
    reuseExistingAccount: true,
    migrated: false,
  });
});

test("Indonesia alias v3 rotates a legacy portal account and password", async () => {
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

test("Indonesia alias v3 rotates the canonical v2 account to the service alias", async () => {
  const { resolveIndonesiaAliasMigration } = await import("../account-alias.js");
  const result = resolveIndonesiaAliasMigration({
    canonicalAlias: "appl-01kx2gdtc5gaeh0v3mvhx98jtj@viza.it.com",
    currentEmail: "appl-01kx2gdtc5gaeh0v3mvhx98jtj@viza.it.com",
    currentPassword: "legacy-password",
    currentAliasVersion: "v2",
    generatedPassword: "new-password",
  });

  assert.deepEqual(result, {
    email: "id-01kx2gdtc5gaeh0v3mvhx98jtj@viza.it.com",
    password: "new-password",
    reuseExistingAccount: false,
    migrated: true,
  });
});

test("Indonesia alias v3 heals the v39 canonical-email persistence bug without rotating the password", async () => {
  const { resolveIndonesiaAliasMigration } = await import("../account-alias.js");
  const result = resolveIndonesiaAliasMigration({
    canonicalAlias: "appl-01kx2gdtc5gaeh0v3mvhx98jtj@viza.it.com",
    currentEmail: "appl-01kx2gdtc5gaeh0v3mvhx98jtj@viza.it.com",
    currentPassword: "existing-v3-password",
    currentAliasVersion: "v3",
    generatedPassword: "new-password",
  });

  assert.deepEqual(result, {
    email: "id-01kx2gdtc5gaeh0v3mvhx98jtj@viza.it.com",
    password: "existing-v3-password",
    reuseExistingAccount: true,
    migrated: true,
  });
});

test("inbox alias override accepts only the matching Indonesia service alias", async () => {
  const { resolveApplicantInboxAlias } = await import("../../inbox/wait-for-message.js");
  const canonical = "appl-01kx2gdtc5gaeh0v3mvhx98jtj@viza.it.com";
  const serviceAlias = "id-01kx2gdtc5gaeh0v3mvhx98jtj@viza.it.com";
  assert.equal(resolveApplicantInboxAlias(canonical, serviceAlias), serviceAlias);
  assert.throws(
    () => resolveApplicantInboxAlias(canonical, "id-01kx2gdtc5gaeh0v3mvhx98jtx@viza.it.com"),
    /does not belong/,
  );
});
