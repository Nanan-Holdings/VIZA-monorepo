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

  it("retries only an unverified failure from before official registration submission", () => {
    assert.equal(accountRegistration.isFranceTlsPreRegistrationRetryEligible({
      accountStatus: "manual_required",
      emailVerified: false,
    }), true);
    assert.equal(accountRegistration.isFranceTlsPreRegistrationRetryEligible({
      accountStatus: "activation_email_pending",
      emailVerified: false,
    }), false);
    assert.equal(accountRegistration.isFranceTlsPreRegistrationRetryEligible({
      accountStatus: "manual_required",
      emailVerified: true,
    }), false);
    assert.equal(accountRegistration.isFranceTlsPreRegistrationRetryEligible({
      accountStatus: "registration_retryable_error",
      emailVerified: false,
    }), true);
    assert.equal(accountRegistration.isFranceTlsPreRegistrationRetryEligible({
      accountStatus: "browser_session_retryable_error",
      emailVerified: false,
    }), true);
  });

  it("does not mistake the TLS registration service-error toast for success", () => {
    assert.equal(accountRegistration.classifyFranceTlsRegistrationResult({
      url: "https://visas-fr.tlscontact.com/en-us/registration",
      bodyText: "We apologise for the inconvenience. Our website team is currently working to fix this.",
    }), "retryable_error");
    assert.equal(accountRegistration.classifyFranceTlsRegistrationResult({
      url: "https://visas-fr.tlscontact.com/en-us/registration",
      bodyText: "Please check your email to activate your account.",
    }), "success");
    assert.equal(accountRegistration.classifyFranceTlsRegistrationResult({
      url: "https://visas-fr.tlscontact.com/en-us/registration",
      bodyText: "Register your account with TLScontact",
    }), "unverified");
  });

  it("retries only CAPTCHA failures that produced no answer", () => {
    assert.equal(accountRegistration.isRetryableFranceTlsCaptchaSolveError(
      new Error("2captcha API error: ERROR_CAPTCHA_UNSOLVABLE"),
    ), true);
    assert.equal(accountRegistration.isRetryableFranceTlsCaptchaSolveError(
      new Error("2captcha polling timeout"),
    ), true);
    assert.equal(accountRegistration.isRetryableFranceTlsCaptchaSolveError(
      new Error("TLS reCAPTCHA token injection failed"),
    ), false);
  });

  it("preserves official registration outcome checkpoints across outer errors", () => {
    assert.equal(accountRegistration.shouldPreserveFranceTlsRegistrationStatus(
      "registration_retryable_error",
    ), true);
    assert.equal(accountRegistration.shouldPreserveFranceTlsRegistrationStatus(
      "registration_result_unverified",
    ), true);
    assert.equal(accountRegistration.shouldPreserveFranceTlsRegistrationStatus(
      "browser_session_retryable_error",
    ), true);
    assert.equal(accountRegistration.shouldPreserveFranceTlsRegistrationStatus(
      "account_prepared",
    ), false);
  });

  it("classifies Browserbase lifecycle failures as retryable", () => {
    assert.equal(accountRegistration.isRetryableFranceTlsBrowserSessionError(
      new Error("page.screenshot: Target page, context or browser has been closed"),
    ), true);
    assert.equal(accountRegistration.isRetryableFranceTlsBrowserSessionError(
      new Error("TLS Cloudflare security verification did not clear within the Browserbase wait window"),
    ), true);
    assert.equal(accountRegistration.isRetryableFranceTlsBrowserSessionError(
      new Error("TLS login rejected the stored credentials"),
    ), false);
  });

  it("recognizes the official French Cloudflare waiting room", () => {
    assert.equal(accountRegistration.isFranceTlsWaitingRoomText(
      "Vous êtes maintenant dans la file d’attente. Votre temps d’attente est estimé à 1 minute.",
    ), true);
    assert.equal(accountRegistration.isFranceTlsWaitingRoomText(
      "Sign in to TLScontact",
    ), false);
  });

  it("recognizes the official TLS Cloudflare security verification page", () => {
    assert.equal(accountRegistration.isFranceTlsSecurityVerificationText(
      "Performing security verification. This website uses a security service to protect against malicious bots. This page is displayed while the website verifies you are not a bot.",
    ), true);
    assert.equal(accountRegistration.isFranceTlsSecurityVerificationText(
      "Vérification de sécurité — un instant…",
    ), true);
    assert.equal(accountRegistration.isFranceTlsSecurityVerificationText(
      "Sign in to TLScontact",
    ), false);
  });

  it("bounds each CAPTCHA solve attempt within the Browserbase session budget", () => {
    assert.equal(accountRegistration.resolveFranceTlsCaptchaAttemptTimeoutMs(undefined), 45_000);
    assert.equal(accountRegistration.resolveFranceTlsCaptchaAttemptTimeoutMs("5000"), 10_000);
    assert.equal(accountRegistration.resolveFranceTlsCaptchaAttemptTimeoutMs("180000"), 60_000);
  });

  it("retries only navigation failures from before the registration form", () => {
    assert.equal(accountRegistration.isRetryableFranceTlsRegistrationNavigationError(
      new Error("TLS registration entry was not found"),
    ), true);
    assert.equal(accountRegistration.isRetryableFranceTlsRegistrationNavigationError(
      new Error("TLS registration form unavailable (captcha_token at https://visas-fr.tlscontact.com/en-us)"),
    ), true);
    assert.equal(accountRegistration.isRetryableFranceTlsRegistrationNavigationError(
      new Error("TLScontact returned a retryable registration service error"),
    ), false);
  });
});
