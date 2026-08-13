import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, it } from "node:test";
import type { Page } from "@playwright/test";
import type { TwOfficialLoginOtpProvider, TwOfficialLoginProvider } from "../auth";

const fakePage = {} as Page;

describe("Taiwan official login provider wiring", () => {
  it("fails closed when the controlled runtime has not configured a provider", async () => {
    const {
      createTwOfficialLoginOtpProviderFromEnvironment,
      createTwOfficialLoginProviderFromEnvironment,
      setTwOfficialLoginProviderForRuntime,
      twFailClosedOfficialLoginProvider,
      TwOfficialLoginConfigurationError,
    } = await loadAuthModule();
    setTwOfficialLoginProviderForRuntime(null);

    await assert.rejects(
      () =>
        twFailClosedOfficialLoginProvider.completeLogin(fakePage, {
          applicantId: "synthetic-applicant",
          runId: "synthetic-run",
          otpProvider: createTwOfficialLoginOtpProviderFromEnvironment(),
        }),
      TwOfficialLoginConfigurationError,
    );

    const provider = createTwOfficialLoginProviderFromEnvironment();
    await assert.rejects(
      () =>
        provider.completeLogin(fakePage, {
          applicantId: "synthetic-applicant",
          otpProvider: createTwOfficialLoginOtpProviderFromEnvironment(),
        }),
      TwOfficialLoginConfigurationError,
    );
  });

  it("allows a configured mock provider to authenticate before the runner can continue", async () => {
    const { createTwOfficialLoginOtpProvider, createTwOfficialLoginProvider } = await loadAuthModule();
    const calls: string[] = [];
    const mockProvider: TwOfficialLoginProvider = {
      async completeLogin(_page, input) {
        const { code } = await input.otpProvider.waitForOfficialLoginOtp({
          applicantId: input.applicantId,
          runId: input.runId,
          timeoutMs: 1_000,
        });
        calls.push(`login:${input.applicantId}:${input.runId ?? "none"}:${code.length}`);
        return { status: "authenticated", method: "mock_controlled_callback" };
      },
    };

    const provider = createTwOfficialLoginProvider({ provider: mockProvider });
    const otpProvider = createTwOfficialLoginOtpProvider({
      provider: {
        async waitForOfficialLoginOtp() {
          return { code: "mock-code" };
        },
      },
    });
    const result = await provider.completeLogin(fakePage, {
      applicantId: "synthetic-applicant",
      runId: "synthetic-run",
      otpProvider,
    });

    assert.deepEqual(result, { status: "authenticated", method: "mock_controlled_callback" });
    assert.deepEqual(calls, ["login:synthetic-applicant:synthetic-run:9"]);
  });

  it("uses the runtime-registered provider when the queue asks for one", async () => {
    const {
      createTwOfficialLoginOtpProviderFromEnvironment,
      createTwOfficialLoginProviderFromEnvironment,
      setTwOfficialLoginOtpProviderForRuntime,
      setTwOfficialLoginProviderForRuntime,
    } = await loadAuthModule();
    const mockProvider: TwOfficialLoginProvider = {
      async completeLogin() {
        return { status: "authenticated", method: "mock_runtime_provider" };
      },
    };
    setTwOfficialLoginOtpProviderForRuntime({
      async waitForOfficialLoginOtp() {
        return { code: "mock-code" };
      },
    });
    setTwOfficialLoginProviderForRuntime(mockProvider);
    try {
      const provider = createTwOfficialLoginProviderFromEnvironment();
      const result = await provider.completeLogin(fakePage, {
        applicantId: "synthetic-applicant",
        otpProvider: createTwOfficialLoginOtpProviderFromEnvironment(),
      });
      assert.equal(result.status, "authenticated");
      assert.equal(result.method, "mock_runtime_provider");
    } finally {
      setTwOfficialLoginOtpProviderForRuntime(null);
      setTwOfficialLoginProviderForRuntime(null);
    }
  });

  it("bootstraps fail-closed when no adapter is configured", async () => {
    const {
      bootstrapTwOfficialLoginProvidersFromEnvironment,
      createTwOfficialLoginOtpProviderFromEnvironment,
      createTwOfficialLoginProviderFromEnvironment,
      setTwOfficialLoginOtpProviderForRuntime,
      setTwOfficialLoginProviderForRuntime,
      TwOfficialLoginConfigurationError,
    } = await loadAuthModule();
    setTwOfficialLoginProviderForRuntime({
      async completeLogin() {
        return { status: "authenticated", method: "stale_provider" };
      },
    });
    setTwOfficialLoginOtpProviderForRuntime({
      async waitForOfficialLoginOtp() {
        return { code: "stale-code" };
      },
    });

    const result = await bootstrapTwOfficialLoginProvidersFromEnvironment({ env: {} });
    assert.deepEqual(result, {
      status: "fail_closed",
      adapterName: null,
      reason: "missing_adapter",
    });

    const provider = createTwOfficialLoginProviderFromEnvironment();
    await assert.rejects(
      () =>
        provider.completeLogin(fakePage, {
          applicantId: "synthetic-applicant",
          otpProvider: createTwOfficialLoginOtpProviderFromEnvironment(),
        }),
      TwOfficialLoginConfigurationError,
    );
  });

  it("rejects an unapproved official-login adapter name", async () => {
    const { bootstrapTwOfficialLoginProvidersFromEnvironment, createTwOfficialLoginProviderFromEnvironment, TwOfficialLoginConfigurationError } =
      await loadAuthModule();

    const result = await bootstrapTwOfficialLoginProvidersFromEnvironment({
      env: {
        TW_OFFICIAL_LOGIN_ADAPTER: "unreviewed_adapter",
        TW_OFFICIAL_LOGIN_APPROVED_ADAPTERS: "approved_adapter",
      },
      adapters: {
        unreviewed_adapter: async () => makeMockBootstrapProviders("unreviewed_adapter"),
      },
    });

    assert.deepEqual(result, {
      status: "fail_closed",
      adapterName: "unreviewed_adapter",
      reason: "adapter_not_approved",
    });
    await assert.rejects(
      () =>
        createTwOfficialLoginProviderFromEnvironment().completeLogin(fakePage, {
          applicantId: "synthetic-applicant",
          otpProvider: {
            async waitForOfficialLoginOtp() {
              return { code: "mock-code" };
            },
          },
        }),
      TwOfficialLoginConfigurationError,
    );
  });

  it("registers an approved controlled adapter and OTP provider", async () => {
    const {
      bootstrapTwOfficialLoginProvidersFromEnvironment,
      createTwOfficialLoginOtpProviderFromEnvironment,
      createTwOfficialLoginProviderFromEnvironment,
    } = await loadAuthModule();

    const result = await bootstrapTwOfficialLoginProvidersFromEnvironment({
      env: {
        TW_OFFICIAL_LOGIN_ADAPTER: "approved_adapter",
        TW_OFFICIAL_LOGIN_APPROVED_ADAPTERS: "approved_adapter",
      },
      adapters: {
        approved_adapter: async () => makeMockBootstrapProviders("approved_adapter"),
      },
    });

    assert.deepEqual(result, { status: "configured", adapterName: "approved_adapter" });
    const loginResult = await createTwOfficialLoginProviderFromEnvironment().completeLogin(fakePage, {
      applicantId: "synthetic-applicant",
      runId: "synthetic-run",
      otpProvider: createTwOfficialLoginOtpProviderFromEnvironment(),
    });
    assert.deepEqual(loginResult, { status: "authenticated", method: "approved_adapter" });
  });

  it("can bootstrap an approved adapter module supplied by deployment", async () => {
    const {
      bootstrapTwOfficialLoginProvidersFromEnvironment,
      createTwOfficialLoginProviderFromEnvironment,
      createTwOfficialLoginOtpProviderFromEnvironment,
    } = await loadAuthModule();

    const result = await bootstrapTwOfficialLoginProvidersFromEnvironment({
      env: {
        TW_OFFICIAL_LOGIN_ADAPTER: "approved_module_adapter",
        TW_OFFICIAL_LOGIN_APPROVED_ADAPTERS: "approved_module_adapter",
        TW_OFFICIAL_LOGIN_ADAPTER_MODULE: "@deployment/tw-official-login",
      },
      importAdapter: async (moduleRef) => {
        assert.equal(moduleRef, "@deployment/tw-official-login");
        return async () => makeMockBootstrapProviders("approved_module_adapter");
      },
    });

    assert.deepEqual(result, { status: "configured", adapterName: "approved_module_adapter" });
    const loginResult = await createTwOfficialLoginProviderFromEnvironment().completeLogin(fakePage, {
      applicantId: "synthetic-applicant",
      otpProvider: createTwOfficialLoginOtpProviderFromEnvironment(),
    });
    assert.equal(loginResult.method, "approved_module_adapter");
  });

  it("routes Taiwan through the canonical runner_job path and requires official receipt evidence", async () => {
    const dispatchSource = await readFile(join(process.cwd(), "src", "queue", "dispatch.ts"), "utf8");
    const runnerSource = await readFile(join(process.cwd(), "src", "tw", "runner.ts"), "utf8");
    const haltRunnerSource = await readFile(join(process.cwd(), "src", "queue", "halt-runners.ts"), "utf8");

    assert.match(dispatchSource, /import \{ runOne as runTaiwan \} from "\.\.\/tw\/runner\.js"/);
    assert.match(dispatchSource, /taiwan:\s*\(a, j\) => runTaiwan\(a, j\)/);
    assert.match(runnerSource, /export \{ runTwHalt as runOne \}/);
    assert.match(haltRunnerSource, /if \(!jobId\)/);
    assert.match(haltRunnerSource, /mode:\s*"applicant_handoff"/);
    assert.match(haltRunnerSource, /officialReceipt:\s*result\.officialReceipt/);
  });

  it("lets the normal email-verification entry continue without an official-login adapter", async () => {
    const source = await readFile(join(process.cwd(), "src", "tw", "apply.ts"), "utf8");
    assert.match(source, /async function maybeCompleteOfficialLoginIfPresent/);
    assert.match(source, /if \(!\(await isTwOfficialLoginPage\(page\)\)\) return null/);
    assert.match(source, /method:\s*"application_email_verification"/);
    assert.match(source, /await verifyTwEmail\(page,\s*input\.applicantId,\s*input\.email/);
  });

  it("fails closed on a real official login page unless an approved adapter is registered", async () => {
    const source = await readFile(join(process.cwd(), "src", "tw", "apply.ts"), "utf8");
    assert.match(source, /input\[type="password"\]/);
    assert.match(source, /officialLoginProvider\.completeLogin\(page/);
    assert.match(source, /options\.officialLoginProvider \?\? twFailClosedOfficialLoginProvider/);
  });

  it("uses a stable application-scoped Taiwan inbox alias on viza.it.com", async () => {
    const source = await readFile(join(process.cwd(), "src", "queue", "halt-runners.ts"), "utf8");
    assert.match(source, /const alias = twApplicationInboxAlias\(applicationId\)/);
    assert.match(source, /email:\s*alias/);
    assert.match(source, /VIZA_MANAGED_INBOX_DOMAIN/);
    assert.match(source, /"viza\.it\.com"/);
    assert.match(source, /return `tw-\$\{digest\}@\$\{domain\}`/);
    assert.doesNotMatch(source, /haggstorm\.com/);
    assert.doesNotMatch(source, /ensureApplicantInboxAlias\(applicantId\)/);
  });

  it("polls inbound_email for the generated Taiwan alias without exposing OTP or mailbox credentials", async () => {
    const source = await readFile(join(process.cwd(), "src", "tw", "auth.ts"), "utf8");
    assert.match(source, /waitForTwVerificationCodeToAlias\([\s\S]*input\.email,[\s\S]*input\.timeoutMs,[\s\S]*input\.sentAfter,[\s\S]*\)/);
    assert.match(source, /sentAfter/);
    assert.match(source, /\.from\("inbound_email"\)/);
    assert.match(source, /\.eq\("to_addr", normalizedAlias\)/);
    assert.match(source, /\.gte\("received_at", since\)/);
    assert.doesNotMatch(source, /TW_ENTRY_PERMIT_EMAIL|TW_ENTRY_PERMIT_IMAP|process\.env\.IMAP_PASSWORD|env\.IMAP_PASSWORD/);
    assert.doesNotMatch(source, /accessToken|refreshToken/i);
    assert.doesNotMatch(source, /console\.(log|warn|error).*code/i);
  });

  it("does not expose sensitive values through provider results or configuration errors", async () => {
    const {
      createTwOfficialLoginOtpProviderFromEnvironment,
      createTwOfficialLoginProvider,
      createTwOfficialLoginProviderFromEnvironment,
      setTwOfficialLoginProviderForRuntime,
      TwOfficialLoginConfigurationError,
    } =
      await loadAuthModule();
    setTwOfficialLoginProviderForRuntime(null);
    const provider = createTwOfficialLoginProviderFromEnvironment();

    await assert.rejects(
      async () =>
        provider.completeLogin(fakePage, {
          applicantId: "synthetic-applicant",
          otpProvider: createTwOfficialLoginOtpProviderFromEnvironment(),
        }),
      (err: unknown) => {
        assert.ok(err instanceof TwOfficialLoginConfigurationError);
        const serialized = JSON.stringify(err);
        assert.doesNotMatch(serialized, /mock-code|cookie|storage|secret|credential/i);
        return true;
      },
    );

    const mockProvider: TwOfficialLoginProvider = {
      async completeLogin() {
        return { status: "authenticated", method: "mock_redacted" };
      },
    };
    const result = await createTwOfficialLoginProvider({ provider: mockProvider }).completeLogin(fakePage, {
      applicantId: "synthetic-applicant",
      otpProvider: createTwOfficialLoginOtpProviderFromEnvironment(),
    });
    assert.doesNotMatch(JSON.stringify(result), /mock-code|cookie|storage|secret|credential/i);
  });
});

function makeMockBootstrapProviders(method: string): {
  officialLoginProvider: TwOfficialLoginProvider;
  officialLoginOtpProvider: TwOfficialLoginOtpProvider;
} {
  return {
    officialLoginProvider: {
      async completeLogin(_page, input) {
        const { code } = await input.otpProvider.waitForOfficialLoginOtp({
          applicantId: input.applicantId,
          runId: input.runId,
          timeoutMs: 1_000,
        });
        assert.equal(code.length > 0, true);
        return { status: "authenticated", method };
      },
    },
    officialLoginOtpProvider: {
      async waitForOfficialLoginOtp() {
        return { code: "mock-code" };
      },
    },
  };
}

async function loadAuthModule() {
  process.env.SUPABASE_URL ??= "http://localhost:54321";
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
  const [authModule, errorsModule] = await Promise.all([import("../auth"), import("../errors")]);
  return { ...authModule, TwOfficialLoginConfigurationError: errorsModule.TwOfficialLoginConfigurationError };
}
