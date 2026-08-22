import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

let accountRegistration: typeof import("../account-registration");

before(async () => {
  process.env.SUPABASE_URL ||= "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY ||= "test-service-role";
  accountRegistration = await import("../account-registration");
});

describe("France TLS account registration", () => {
  it("generates a TLS-compatible password without leaking deterministic credentials", () => {
    const first = accountRegistration.generateFranceTlsAccountPassword();
    const second = accountRegistration.generateFranceTlsAccountPassword();

    for (const password of [first, second]) {
      assert.equal(password.length, 16);
      assert.match(password, /[A-Z]/);
      assert.match(password, /[a-z]/);
      assert.match(password, /[0-9]/);
      assert.match(password, /[!@#$%^&*_+=?\-]/);
      assert.match(password, /^[A-Za-z0-9!@#$%^&*_+=?\-]+$/);
    }
    assert.notEqual(first, second);
  });

  it("only treats a redirect away from the TLS identity host as authenticated", () => {
    assert.equal(
      accountRegistration.isAuthenticatedFranceTlsRedirectUrl(
        "https://i2-auth.visas-fr.tlscontact.com/auth/realms/atlas/login-actions/authenticate",
      ),
      false,
    );
    assert.equal(
      accountRegistration.isAuthenticatedFranceTlsRedirectUrl("https://visas-fr.tlscontact.com/en-us/"),
      true,
    );
  });

  it("only auto-fills phone numbers when the TLS country-code selection is deterministic", () => {
    assert.deepEqual(accountRegistration.normalizeFranceTlsPhone("+86 138-0013-8000"), {
      countryCode: "+86",
      number: "13800138000",
    });
    assert.deepEqual(accountRegistration.normalizeFranceTlsPhone("13800138000"), {
      countryCode: "+86",
      number: "13800138000",
    });
    assert.deepEqual(accountRegistration.normalizeFranceTlsPhone("+65 8123 4567"), {
      countryCode: null,
      number: null,
    });
  });

  it("reuses a verified official account alias after the applicant inbox alias rotates", () => {
    assert.equal(accountRegistration.resolveFranceTlsAccountAlias({
      applicantAlias: "new@viza.test",
      storedAccountAlias: "existing@viza.test",
      emailVerified: true,
    }), "existing@viza.test");
  });

  it("refuses an unverified mismatched alias instead of risking duplicate registration", () => {
    assert.throws(() => accountRegistration.resolveFranceTlsAccountAlias({
      applicantAlias: "new@viza.test",
      storedAccountAlias: "pending@viza.test",
      emailVerified: false,
    }), /Unverified TLS account alias does not match/);
  });

  it("abandons the legacy alias while preserving an existing current-alias retry", () => {
    assert.deepEqual(accountRegistration.planFranceTlsAccountReplacement({
      applicantAlias: "current@viza.test",
      accounts: [
        { id: "current", account_email: "CURRENT@viza.test", account_status: "activation_email_pending" },
        { id: "legacy", account_email: "old@example.test", account_status: "manual_required" },
        { id: "history", account_email: "older@example.test", account_status: "abandoned" },
      ],
    }), {
      reusableAccountId: "current",
      accountIdsToAbandon: ["legacy"],
    });
  });

  it("abandons every active legacy account when the current alias has no account", () => {
    assert.deepEqual(accountRegistration.planFranceTlsAccountReplacement({
      applicantAlias: "current@viza.test",
      accounts: [
        { id: "legacy-1", account_email: "old@example.test", account_status: "manual_required" },
        { id: "legacy-2", account_email: "pending@example.test", account_status: "activation_email_pending" },
      ],
    }), {
      reusableAccountId: null,
      accountIdsToAbandon: ["legacy-1", "legacy-2"],
    });
  });
});
