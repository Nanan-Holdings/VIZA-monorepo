import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as path from "node:path";
import {
  activateSaudiManagedAccount,
  classifySaudiPortalState,
  classifySaudiRegistrationResult,
  extractSaudiActivationUrl,
  generateSaudiAccountPassword,
  generateSaudiSecretAnswer,
  isOfficialSaudiPortalUrl,
  isReadySaudiActivationMessage,
  redactSaudiRunnerError,
  isSaudiActivationSuccessText,
  isTrustedSaudiActivationMessage,
  isValidSaudiAccountPassword,
  resolveSaudiActivationUrl,
  SA_PUBLIC_SELECTORS,
  validateSaudiLiveConfig,
} from "../live-flow.js";
import {
  SA_PRIVACY_POLICY_SHA256,
  SA_PRIVACY_POLICY_URL,
  type SaudiPrivacyAuthorization,
} from "../privacy-authorization.js";

const SA_RUNNER_SOURCE = readFileSync(path.join(process.cwd(), "src/sa/runner.ts"), "utf8");
const SA_LIVE_FLOW_SOURCE = readFileSync(path.join(process.cwd(), "src/sa/live-flow.ts"), "utf8");

const TRUSTED_AUTHENTICATION_RESULTS = [
  "mx.cloudflare.net; spf=none smtp.mailfrom=bounce@wrqvznpx.outbound-mail.sendgrid.net",
  "dkim=pass header.d=visitsaudi.com",
  "dmarc=pass header.from=visitsaudi.com",
].join("; ");

function activationMessage(overrides: Record<string, unknown> = {}) {
  return {
    from_addr: "bounce@wrqvznpx.outbound-mail.sendgrid.net",
    subject: "Saudi eVisa account activation",
    headers: {
      From: "Visit Saudi <no-reply@visitsaudi.com>",
      "Authentication-Results": TRUSTED_AUTHENTICATION_RESULTS,
    },
    text: "Activate: https://visa.visitsaudi.com/Registration/Activation?token=test",
    html: null,
    ...overrides,
  };
}

test("sa public recon contract uses captured VisitSaudi eligibility/login selectors", () => {
  assert.equal(SA_PUBLIC_SELECTORS.passportType, "#PassportType");
  assert.equal(SA_PUBLIC_SELECTORS.nationality, "#Nationality");
  assert.equal(SA_PUBLIC_SELECTORS.captchaImage, "#imgCaptcha");
  assert.equal(SA_PUBLIC_SELECTORS.captchaInput, "#CaptchaCode");
  assert.equal(SA_PUBLIC_SELECTORS.eligibilityNext, "#btnVerify");
  assert.equal(SA_PUBLIC_SELECTORS.loginEmail, "#EmailId");
  assert.equal(SA_PUBLIC_SELECTORS.loginPassword, "#Password");
  assert.equal(SA_PUBLIC_SELECTORS.loginSubmit, "#btnSignIn");
  assert.equal(SA_PUBLIC_SELECTORS.registrationPrivacy, "#chkPPAgree");
  assert.equal(SA_PUBLIC_SELECTORS.registrationSubmit, "#btnAdd");
});

test("sa generated account credentials match the live registration policies", () => {
  for (let sample = 0; sample < 100; sample += 1) {
    assert.equal(isValidSaudiAccountPassword(generateSaudiAccountPassword()), true);
    assert.match(generateSaudiSecretAnswer(), /^(?!\s*$)[A-Za-z0-9 ]{2,250}$/);
  }
});

test("sa credential flows do not record HARs or expose remote endpoint errors", () => {
  assert.doesNotMatch(SA_RUNNER_SOURCE, /recordHar/);
  assert.doesNotMatch(SA_RUNNER_SOURCE, /\.screenshot\s*\(|artifact\.put|fullPage/);
  assert.match(SA_RUNNER_SOURCE, /VisitSaudi remote browser endpoint was not reachable/);
  assert.doesNotMatch(SA_RUNNER_SOURCE, /nationality option could not be matched:\s*\$\{/);
});

test("sa accepts only the exact HTTPS VisitSaudi host", () => {
  assert.equal(isOfficialSaudiPortalUrl("https://visa.visitsaudi.com/Login"), true);
  for (const url of [
    "http://visa.visitsaudi.com/Login",
    "https://visa.visitsaudi.com.evil.example/Login",
    "https://evil.example/visa.visitsaudi.com/Login",
    "https://visa.visitsaudi.com:444/Login",
    "https://user:secret@visa.visitsaudi.com/Login",
  ]) {
    assert.equal(isOfficialSaudiPortalUrl(url), false, url);
    assert.equal(classifySaudiPortalState({
      url,
      title: "VisitSaudi",
      bodyText: "My application passport upload payment SAR 535",
      hasDocumentInput: true,
      hasPaymentControl: true,
      productVerified: true,
    }).checkpoint, "selector_drift");
  }
});

test("sa downstream checkpoints require their preceding authorized stages", () => {
  const env = {
    SUBMISSION_RESULT_SECRET_KEY: "configured",
    TWOCAPTCHA_API_KEY: "configured",
  };
  assert.deepEqual(validateSaudiLiveConfig({
    preSubmitEnabled: true,
    accountPreparationEnabled: true,
    loginEnabled: false,
    twoCaptchaEnabled: true,
    documentUploadEnabled: true,
    paymentCheckpointEnabled: true,
  }, env), ["SA_LOGIN_ENABLED"]);
  assert.deepEqual(validateSaudiLiveConfig({
    preSubmitEnabled: true,
    accountPreparationEnabled: true,
    loginEnabled: true,
    twoCaptchaEnabled: true,
    documentUploadEnabled: false,
    paymentCheckpointEnabled: true,
  }, env), ["SA_DOCUMENT_UPLOAD_ENABLED"]);
});

test("sa registration and phone verification checkpoints are explicit", () => {
  assert.equal(classifySaudiRegistrationResult({
    url: "https://visa.visitsaudi.com/Registration/Add",
    bodyText: "Please check your email. An activation link has been sent.",
    hasRegistrationForm: false,
    hasLoginEmail: false,
  }).checkpoint, "activation_pending");
  assert.equal(classifySaudiPortalState({
    url: "https://visa.visitsaudi.com/Login/OTPAuth",
    title: "Welcome to eVisa",
    bodyText: "Verification code",
  }).checkpoint, "sms_otp");
});

test("sa payment checkpoint requires an observed SAR amount", () => {
  assert.equal(classifySaudiPortalState({
    url: "https://visa.visitsaudi.com/Application/Review",
    title: "Review",
    bodyText: "Continue to payment",
    hasPaymentControl: true,
    productVerified: true,
  }).checkpoint, "unknown");
  const state = classifySaudiPortalState({
    url: "https://visa.visitsaudi.com/Application/Payment",
    title: "Payment",
    bodyText: "Order summary Insurance premium SAR 535.00 Pay now",
    hasPaymentControl: true,
    productVerified: true,
  });
  assert.equal(state.checkpoint, "payment");
  assert.equal(state.observedCurrency, "SAR");
  assert.equal(state.observedAmount, "535.00");
  assert.deepEqual(state.observedComponents, ["insurance"]);
  assert.equal(classifySaudiPortalState({
    url: "https://example.com/payment",
    title: "Payment",
    bodyText: "Order summary SAR 535.00 Pay now",
    hasPaymentControl: true,
    productVerified: false,
  }).checkpoint, "selector_drift");
});

test("sa prepared but unconfirmed accounts never attempt login", () => {
  const state = classifySaudiPortalState({
    url: "https://visa.visitsaudi.com/Login?lang=en",
    title: "Saudi eVisa",
    bodyText: "4 unsuccessful attempts your account will be locked for 15 minutes",
    hasCaptchaImage: true,
    hasLoginEmail: true,
  });
  assert.equal(state.checkpoint, "captcha");
});

test("sa activation mail requires receiver-authenticated aligned VisitSaudi identity", () => {
  assert.equal(isTrustedSaudiActivationMessage(activationMessage()), true);
  assert.equal(isReadySaudiActivationMessage(activationMessage()), true);
  assert.equal(isTrustedSaudiActivationMessage(activationMessage({ headers: null })), false);
  assert.equal(isTrustedSaudiActivationMessage(activationMessage({
    headers: {
      From: "Visit Saudi <no-reply@visitsaudi.com>",
      "Authentication-Results": TRUSTED_AUTHENTICATION_RESULTS.replace(
        "mx.cloudflare.net",
        "attacker.example",
      ),
    },
  })), false);
  assert.equal(isTrustedSaudiActivationMessage(activationMessage({
    headers: {
      From: "Visit Saudi <no-reply@visitsaudi.com>",
      "Authentication-Results": `${TRUSTED_AUTHENTICATION_RESULTS}\n${TRUSTED_AUTHENTICATION_RESULTS}`,
    },
  })), false);
  assert.equal(isTrustedSaudiActivationMessage(activationMessage({
    headers: {
      From: "Visit Saudi <no-reply@visitsaudi.com>",
      "Authentication-Results": TRUSTED_AUTHENTICATION_RESULTS.replace(
        "header.d=visitsaudi.com",
        "header.d=attacker.example",
      ),
    },
  })), false);
  assert.equal(isTrustedSaudiActivationMessage(activationMessage({
    headers: {
      From: "Visit Saudi <no-reply@visitsaudi.com>",
      "Authentication-Results": TRUSTED_AUTHENTICATION_RESULTS.replace(
        "header.from=visitsaudi.com",
        "header.from=attacker.example",
      ),
    },
  })), false);
  assert.equal(isTrustedSaudiActivationMessage(activationMessage({
    from_addr: "bounce@attacker.example",
  })), false);
  assert.equal(isTrustedSaudiActivationMessage(activationMessage({
    headers: {
      From: "Visit Saudi <no-reply@visitsaudi.com>, attacker <x@attacker.example>",
      "Authentication-Results": TRUSTED_AUTHENTICATION_RESULTS,
    },
  })), false);
  assert.equal(isTrustedSaudiActivationMessage(activationMessage({
    headers: {
      From: "Visit Saudi <no-reply@visitsaudi.com>",
      "Authentication-Results": TRUSTED_AUTHENTICATION_RESULTS,
      "authentication-results": TRUSTED_AUTHENTICATION_RESULTS,
    },
  })), false);
  assert.equal(isTrustedSaudiActivationMessage(activationMessage({ text: "No link yet" })), true);
  assert.equal(isReadySaudiActivationMessage(activationMessage({ text: "No link yet" })), false);
});

test("sa activation URLs and success evidence fail closed", () => {
  assert.equal(
    extractSaudiActivationUrl("https://visa.visitsaudi.com/Registration/Activation?token=ok")?.hostname,
    "visa.visitsaudi.com",
  );
  assert.equal(extractSaudiActivationUrl("http://visa.visitsaudi.com/Activation?token=no"), null);
  assert.equal(extractSaudiActivationUrl("https://visa.visitsaudi.com.evil.test/Activation?token=no"), null);
  assert.equal(extractSaudiActivationUrl("https://visa.visitsaudi.com:444/Activation?token=no"), null);
  assert.equal(isSaudiActivationSuccessText("Your account has been activated"), true);
  assert.equal(isSaudiActivationSuccessText("Sign in"), false);
  assert.equal(isSaudiActivationSuccessText("Your account has not been activated"), false);
  assert.equal(isSaudiActivationSuccessText("Activation was not successful"), false);
  assert.equal(isSaudiActivationSuccessText("Activation failed. Please request a new link."), false);
});

test("sa activation network errors never expose token-bearing URLs", async () => {
  const tracker = "https://u123.ct.sendgrid.net/ls/click?upn=TOP-SECRET-TOKEN";
  await assert.rejects(
    resolveSaudiActivationUrl(tracker, (async () => {
      throw new Error(`connect failed for ${tracker}`);
    }) as typeof fetch),
    (error: unknown) => {
      assert.equal((error as Error).message, "VisitSaudi activation-link resolution failed");
      assert.doesNotMatch((error as Error).message, /TOP-SECRET-TOKEN|sendgrid/i);
      return true;
    },
  );

  const authorization: SaudiPrivacyAuthorization = {
    consentEventId: "consent-1",
    applicationId: "application-1",
    acceptedAt: "2026-08-18T00:00:00.000Z",
    documentHash: SA_PRIVACY_POLICY_SHA256,
    officialUrl: SA_PRIVACY_POLICY_URL,
    source: "viza_application_confirmation",
  };
  const activationUrl = new URL(
    "https://visa.visitsaudi.com/Registration/Activation?token=PAGE-SECRET-TOKEN",
  );
  await assert.rejects(
    activateSaudiManagedAccount({
      page: {
        goto: async () => {
          throw new Error(`navigation failed at ${activationUrl.href}`);
        },
      } as never,
      activationUrl,
      applicantId: "applicant-1",
      applicationId: "application-1",
      privacyAuthorization: authorization,
    }),
    (error: unknown) => {
      assert.equal((error as Error).message, "VisitSaudi activation navigation failed");
      assert.doesNotMatch((error as Error).message, /PAGE-SECRET-TOKEN/);
      return true;
    },
  );

  const redacted = redactSaudiRunnerError(
    new Error("failed https://visa.visitsaudi.com/Activation?token=QUEUE-SECRET user@example.com"),
  );
  assert.doesNotMatch(redacted, /QUEUE-SECRET|user@example\.com/);
  assert.match(SA_LIVE_FLOW_SOURCE, /VisitSaudi activation navigation failed/);
});
