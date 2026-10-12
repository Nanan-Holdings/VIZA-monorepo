import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  classifyRegistrationFailure,
  continueToAppointmentAfterRegistration,
  parseUSAppointmentRegistrationArgs,
  prepareRegistrationBrowserConfig,
  registrationGateSummary,
  registrationSucceeded,
  shouldContinueToAppointment,
  summarizeAppointmentPreparation,
  validateUSAppointmentRegistrationPreflight,
  validateUSAppointmentRegistrationPreflightWithInbox,
  type USAppointmentRegistrationPreflightConfig,
} from "../registration-command";
import type {
  AppointmentAccountCredentials,
  AppointmentPreparationResult,
  USAppointmentJobRow,
} from "../runner";

const APPLICATION_ID = "2d5c87b4-b6fc-4681-8b26-adb9ecd27d75";

const config: USAppointmentRegistrationPreflightConfig = {
  enabled: true,
  providerAllowlist: ["usvisascheduling"],
  supportedCountries: ["CN"],
  playwrightEnabled: true,
  playwrightCdpEndpoint: null,
};

function makeJob(overrides: Partial<USAppointmentJobRow> = {}): USAppointmentJobRow {
  return {
    id: "726cd3b4-d0b9-4c19-a0a9-7d963c936b68",
    application_id: APPLICATION_ID,
    user_id: "9adf3b5f-9360-4d50-9cde-35b0f5ad418a",
    appointment_account_id: "8bca4d4c-77d3-4ccd-86bc-701b94ae3647",
    applying_country_code: "CN",
    applying_post_city: "Beijing",
    scheduling_provider: "usvisascheduling",
    status: "appointment_account_creation_started",
    mode: "assisted_live",
    user_preferences_json: null,
    requires_user_action: false,
    current_manual_action: null,
    updated_at: new Date(0).toISOString(),
    ...overrides,
  };
}

function makeCredentials(
  overrides: Partial<AppointmentAccountCredentials> = {},
): AppointmentAccountCredentials {
  return {
    email: "appl-1234567890abcdef@inbound.viza.test",
    password: "stored-secret",
    givenName: "Test",
    surname: "Applicant",
    accountStatus: "account_creation_started",
    emailVerified: false,
    ...overrides,
  };
}

function preflight(
  overrides: Partial<Parameters<typeof validateUSAppointmentRegistrationPreflight>[0]> = {},
) {
  return validateUSAppointmentRegistrationPreflight({
    applicationId: APPLICATION_ID,
    job: makeJob(),
    credentials: makeCredentials(),
    consentCompleted: true,
    config,
    browserMode: "browserbase",
    browserbaseApiKeyConfigured: true,
    ...overrides,
  });
}

describe("US appointment registration command", () => {
  it("clears inherited CDP bridges for isolated Browserbase registration", () => {
    const prepared = prepareRegistrationBrowserConfig({
      enabled: true,
      providerAllowlist: ["usvisascheduling"],
      supportedCountries: ["CN"],
      batchSize: 1,
      emailTimeoutMs: 1_000,
      slotCheckCooldownMs: 1_000,
      captchaSolvingEnabled: false,
      twoCaptchaConfigured: false,
      captchaMaxAttempts: 1,
      browserApiSessionAttempts: 1,
      playwrightEnabled: true,
      playwrightHeadless: false,
      playwrightChannel: null,
      playwrightCdpEndpoint: "https://brightdata.invalid/cdp",
      localCdpEndpoint: "http://127.0.0.1:9222",
      playwrightStorageStatePath: "./cookies.json",
      baseUrl: "https://portal.example.test",
      typingDelayMinMs: 0,
      typingDelayMaxMs: 0,
    }, "browserbase", true);

    assert.equal(prepared.playwrightCdpEndpoint, null);
    assert.equal(prepared.localCdpEndpoint, null);
    assert.equal(prepared.playwrightStorageStatePath, null);
    assert.equal(prepared.playwrightHeadless, true);
  });

  it("requires only an application id and supports isolated credential config", () => {
    const args = parseUSAppointmentRegistrationArgs([
      "--application-id",
      APPLICATION_ID,
      "--credential-config",
      "../agent-backend/.env",
      "--headless=false",
      "--browserbase",
    ]);

    assert.deepEqual(args, {
      applicationId: APPLICATION_ID,
      browserbase: true,
      localBrowser: false,
      headless: false,
      credentialConfig: "../agent-backend/.env",
      continueToAppointment: false,
    });

    assert.throws(
      () => parseUSAppointmentRegistrationArgs([], {
        US_APPOINTMENT_APPLICATION_ID: APPLICATION_ID,
      }),
      /application-id must be a valid application UUID/,
    );

    const headlessFlag = parseUSAppointmentRegistrationArgs([
      `--application-id=${APPLICATION_ID}`,
      "--headless",
    ]);
    assert.equal(headlessFlag.headless, true);

    const continuationFlag = parseUSAppointmentRegistrationArgs([
      "--application-id",
      APPLICATION_ID,
      "--continue-to-appointment",
    ]);
    assert.equal(continuationFlag.continueToAppointment, true);
  });

  it("rejects legacy password and email options before any browser can start", () => {
    assert.throws(
      () => parseUSAppointmentRegistrationArgs([
        "--application-id",
        APPLICATION_ID,
        "--password",
        "secret",
      ]),
      /Unsupported registration option/,
    );
    assert.throws(
      () => parseUSAppointmentRegistrationArgs([
        "--application-id",
        APPLICATION_ID,
        "--browserbase",
        "--local-browser",
      ]),
      /cannot be used together/,
    );
  });

  it("accepts an orchestrator-provisioned pending account for the exact China job", () => {
    const result = preflight();
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.jobId, "726cd3b4-d0b9-4c19-a0a9-7d963c936b68");
      assert.equal(result.credentials.email, "appl-1234567890abcdef@inbound.viza.test");
    }
  });

  it("rejects created or verified accounts and never permits duplicate registration", () => {
    for (const credentials of [
      makeCredentials({ accountStatus: "created" }),
      makeCredentials({ accountStatus: "active" }),
      makeCredentials({ accountStatus: "registration_started", emailVerified: true }),
    ]) {
      const result = preflight({ credentials });
      assert.equal(result.ok, false);
      if (!result.ok) assert.equal(result.code, "account_already_created");
    }

    const unknownStatus = preflight({ credentials: makeCredentials({ accountStatus: "pending" }) });
    assert.equal(unknownStatus.ok, false);
    if (!unknownStatus.ok) assert.equal(unknownStatus.code, "account_status_not_registration_pending");
  });

  it("rejects missing real names, consent checkpoints, and unsupported targets", () => {
    const missingName = preflight({ credentials: makeCredentials({ givenName: null }) });
    assert.equal(missingName.ok, false);
    if (!missingName.ok) assert.equal(missingName.code, "applicant_given_name_missing");

    const noConsent = preflight({ consentCompleted: false });
    assert.equal(noConsent.ok, false);
    if (!noConsent.ok) assert.equal(noConsent.code, "appointment_consent_required");

    const wrongCountry = preflight({ job: makeJob({ applying_country_code: "IN" }) });
    assert.equal(wrongCountry.ok, false);
    if (!wrongCountry.ok) assert.equal(wrongCountry.code, "unsupported_appointment_country");
  });

  it("requires browser configuration before opening an official page", () => {
    const disabled = preflight({ config: { ...config, enabled: false } });
    assert.equal(disabled.ok, false);
    if (!disabled.ok) assert.equal(disabled.code, "assisted_live_disabled");

    const missingBrowserbaseKey = preflight({ browserbaseApiKeyConfigured: false });
    assert.equal(missingBrowserbaseKey.ok, false);
    if (!missingBrowserbaseKey.ok) assert.equal(missingBrowserbaseKey.code, "browser_credentials_missing");

    const missingEndpoint = preflight({ browserMode: "configured" });
    assert.equal(missingEndpoint.ok, false);
    if (!missingEndpoint.ok) assert.equal(missingEndpoint.code, "browser_configuration_required");

    const configured = preflight({
      browserMode: "configured",
      config: { ...config, playwrightCdpEndpoint: "https://managed-browser.invalid/cdp" },
    });
    assert.equal(configured.ok, true);
  });

  it("checks inbox routing after static preflight and before browser creation", async () => {
    let routingChecks = 0;
    let browserCreated = false;
    const result = await validateUSAppointmentRegistrationPreflightWithInbox(
      {
        applicationId: APPLICATION_ID,
        job: makeJob(),
        credentials: makeCredentials(),
        consentCompleted: true,
        config,
        browserMode: "browserbase",
        browserbaseApiKeyConfigured: true,
      },
      {
        async assertAccountRegistrationInboxRoutable() {
          routingChecks += 1;
          throw new Error("alias DNS lookup failed");
        },
      },
    );
    if (result.ok) browserCreated = true;
    assert.equal(routingChecks, 1);
    assert.equal(browserCreated, false);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "registration_inbox_unavailable");
  });

  it("does not probe inbox routing when account or consent preflight fails", async () => {
    let routingChecks = 0;
    const result = await validateUSAppointmentRegistrationPreflightWithInbox(
      {
        applicationId: APPLICATION_ID,
        job: makeJob(),
        credentials: makeCredentials({ accountStatus: "active" }),
        consentCompleted: false,
        config,
        browserMode: "browserbase",
        browserbaseApiKeyConfigured: true,
      },
      {
        async assertAccountRegistrationInboxRoutable() {
          routingChecks += 1;
        },
      },
    );
    assert.equal(routingChecks, 0);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "appointment_consent_required");
  });

  it("requires both positive provider proofs for success", () => {
    const base: AppointmentPreparationResult = {
      readyForSlotCapture: false,
      emailVerified: true,
      accountCreated: true,
    };
    assert.equal(registrationSucceeded(base), true);
    assert.equal(registrationSucceeded({ ...base, gate: {
      jobStatus: "appointment_manual_required",
      actionType: "site_policy_review",
      instruction: "review",
      metadata: {},
    } }), false);
    assert.equal(registrationSucceeded({ ...base, accountCreated: false }), false);
    assert.deepEqual(registrationGateSummary({
      readyForSlotCapture: false,
      errorCode: "registration_unconfirmed",
      gate: {
        jobStatus: "appointment_manual_required",
        actionType: "account_email_verification",
        instruction: "verify",
        metadata: {},
      },
    }), {
      actionType: "account_email_verification",
      code: "registration_unconfirmed",
    });
  });

  it("continues only after strict registration evidence and redacts appointment preparation", async () => {
    const registered: AppointmentPreparationResult = {
      readyForSlotCapture: false,
      emailVerified: true,
      accountCreated: true,
    };
    const pending: AppointmentPreparationResult = {
      readyForSlotCapture: false,
      gate: {
        jobStatus: "appointment_manual_required",
        actionType: "account_email_verification",
        instruction: "enter code",
        metadata: { account_email: "[REDACTED]" },
        errorCode: "account_email_verification_required",
      },
    };
    assert.equal(shouldContinueToAppointment(false, registered), false);
    assert.equal(shouldContinueToAppointment(true, pending), false);
    assert.equal(shouldContinueToAppointment(true, registered), true);
    let prepareCalls = 0;
    const continued = {
      credentials: null as AppointmentAccountCredentials | null,
    };
    const continuation = await continueToAppointmentAfterRegistration({
      requested: true,
      registration: registered,
      credentials: makeCredentials(),
      prepare: async (credentials) => {
        prepareCalls += 1;
        continued.credentials = credentials;
        return { readyForSlotCapture: true };
      },
    });
    assert.equal(prepareCalls, 1);
    assert.equal(continued.credentials?.accountStatus, "active");
    assert.equal(continued.credentials?.emailVerified, true);
    assert.equal(continuation?.readyForSlotCapture, true);
    const blockedContinuation = await continueToAppointmentAfterRegistration({
      requested: true,
      registration: pending,
      credentials: makeCredentials(),
      prepare: async () => {
        throw new Error("prepare must not run before registration proof");
      },
    });
    assert.equal(blockedContinuation, null);
    assert.deepEqual(summarizeAppointmentPreparation({
      readyForSlotCapture: false,
      gate: {
        jobStatus: "appointment_manual_required",
        actionType: "payment",
        instruction: "payment",
        metadata: { raw: "must not be printed" },
        errorCode: "payment_required",
      },
    }), {
      status: "checkpoint",
      readyForSlotCapture: false,
      actionType: "payment",
      code: "payment_required",
    });
  });

  it("classifies failures without returning provider error text", () => {
    assert.equal(classifyRegistrationFailure(new Error("Browserbase session API was not reachable.")), "registration_failed");
    assert.equal(classifyRegistrationFailure(new Error("SUBMISSION_RESULT_SECRET_KEY missing")), "credential_config_invalid");
    assert.equal(classifyRegistrationFailure(new Error("operation timed out")), "operation_timed_out");
  });
});
