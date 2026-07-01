#!/usr/bin/env npx tsx
import "dotenv/config";
import {
  assertUSAppointmentAutoVerificationConfig,
  generateUSAppointmentAccountPassword,
  loadUSAppointmentRunnerConfig,
  PlaywrightUSVisaSchedulingPortalClient,
  resolveUSAppointmentAccountEmail,
  waitForUSAppointmentVerificationEmail,
  type AppointmentAccountCredentials,
} from "../src/us-appointment";
import { ensureApplicantInboxAlias } from "../src/inbox/alias";
import { supabase } from "../src/supabase";
import { encryptSecret } from "../src/secret-cipher";

type ParsedArgs = {
  email?: string;
  password?: string;
  givenName?: string;
  surname?: string;
  applicantId?: string;
  headless: boolean;
  localBrowser: boolean;
  keepOpen: boolean;
  autoVerifyEmail: boolean;
};

function getArg(argv: string[], name: string): string | undefined {
  const full = `--${name}=`;
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === `--${name}` && argv[index + 1]) {
      return argv[index + 1];
    }
    if (token.startsWith(full)) {
      return token.slice(full.length);
    }
  }
  return undefined;
}

function hasArg(argv: string[], name: string): boolean {
  return argv.includes(`--${name}`);
}

function parseBooleanArg(
  argv: string[],
  name: string,
  fallback: boolean,
): boolean {
  const value = getArg(argv, name);
  if (value === undefined) return fallback;
  return !["0", "false", "no"].includes(value.toLowerCase());
}

function parseArgs(argv: string[]): ParsedArgs {
  const applicantId = getArg(argv, "applicant-id") ?? process.env.US_APPOINTMENT_APPLICANT_ID;
  return {
    email: getArg(argv, "email") ?? process.env.US_APPOINTMENT_ACCOUNT_EMAIL,
    password: getArg(argv, "password") ?? process.env.US_APPOINTMENT_ACCOUNT_PASSWORD,
    givenName: getArg(argv, "given-name") ?? process.env.US_APPOINTMENT_ACCOUNT_GIVEN_NAME,
    surname: getArg(argv, "surname") ?? process.env.US_APPOINTMENT_ACCOUNT_SURNAME,
    applicantId,
    headless: parseBooleanArg(
      argv,
      "headless",
      process.env.US_APPOINTMENT_PLAYWRIGHT_HEADLESS !== "false",
    ),
    localBrowser: hasArg(argv, "local-browser"),
    keepOpen: hasArg(argv, "keep-open") || process.env.US_APPOINTMENT_KEEP_BROWSER_OPEN === "true",
    autoVerifyEmail:
      !hasArg(argv, "no-auto-verify")
      && process.env.US_APPOINTMENT_AUTO_VERIFY_EMAIL !== "false"
      && Boolean(applicantId?.trim()),
  };
}

function requireText(value: string | undefined, label: string): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new Error(`${label} is required.`);
  }
  return trimmed;
}

async function persistGeneratedAppointmentAccount(input: {
  applicantId?: string;
  email: string;
  password: string;
  generatedPassword: boolean;
}): Promise<{ persisted: boolean; accountId?: string; reason?: string }> {
  if (!input.applicantId?.trim()) {
    return { persisted: false, reason: "missing_applicant_id" };
  }
  const { data: profile, error: profileError } = await supabase
    .from("applicant_profiles")
    .select("auth_user_id")
    .eq("id", input.applicantId)
    .maybeSingle();
  if (profileError) throw new Error(`appointment account profile lookup failed: ${profileError.message}`);
  const userId = typeof profile?.auth_user_id === "string" ? profile.auth_user_id : null;
  if (!userId) return { persisted: false, reason: "missing_profile_auth_user_id" };

  const encrypted = encryptSecret(input.password);
  const now = new Date().toISOString();
  const { data: existing, error: existingError } = await supabase
    .from("appointment_accounts")
    .select("id")
    .eq("user_id", userId)
    .eq("portal", "usvisascheduling")
    .eq("account_email", input.email)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingError) throw new Error(`appointment account lookup failed: ${existingError.message}`);

  if (existing?.id) {
    const { error } = await supabase
      .from("appointment_accounts")
      .update({
        encrypted_account_password: encrypted,
        account_status: "registration_started",
        email_verified: false,
        metadata_redacted_json: {
          created_by: "run-us-appointment-register",
          generated_password: input.generatedPassword,
          account_email: "[REDACTED]",
        },
        updated_at: now,
      })
      .eq("id", existing.id);
    if (error) throw new Error(`appointment account update failed: ${error.message}`);
    return { persisted: true, accountId: existing.id };
  }

  const { data, error } = await supabase
    .from("appointment_accounts")
    .insert({
      user_id: userId,
      application_id: null,
      country_code: "US",
      portal: "usvisascheduling",
      account_email: input.email,
      encrypted_account_password: encrypted,
      password_vault_ref: null,
      account_status: "registration_started",
      email_verified: false,
      metadata_redacted_json: {
        created_by: "run-us-appointment-register",
        generated_password: input.generatedPassword,
        account_email: "[REDACTED]",
      },
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single();
  if (error || !data?.id) throw new Error(`appointment account insert failed: ${error?.message ?? "missing id"}`);
  return { persisted: true, accountId: data.id };
}

function maskEmail(email: string): string {
  const [localPart, domain] = email.split("@");
  if (!localPart || !domain) return "[REDACTED]";
  return `${localPart.slice(0, 2)}***@${domain}`;
}

async function waitUntilInterrupted(): Promise<void> {
  console.log("Browser session is being kept open. Press Ctrl+C to stop.");
  await new Promise<void>((resolve) => {
    process.once("SIGINT", () => resolve());
    process.once("SIGTERM", () => resolve());
  });
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  assertUSAppointmentAutoVerificationConfig({
    autoVerifyEmail: args.autoVerifyEmail,
    applicantId: args.applicantId,
  });
  const accountEmail = await resolveUSAppointmentAccountEmail({
    explicitEmail: args.email,
    applicantId: args.applicantId,
    ensureAlias: ensureApplicantInboxAlias,
  });
  const generatedPassword = !args.password?.trim();
  const password = args.password?.trim() || generateUSAppointmentAccountPassword();
  const credentials: AppointmentAccountCredentials = {
    email: accountEmail.email,
    password,
    givenName: args.givenName?.trim() || undefined,
    surname: args.surname?.trim() || undefined,
  };
  const persistedAccount = await persistGeneratedAppointmentAccount({
    applicantId: args.applicantId,
    email: credentials.email,
    password: credentials.password,
    generatedPassword,
  });
  const loadedConfig = loadUSAppointmentRunnerConfig();
  const config = {
    ...loadedConfig,
    playwrightEnabled: true,
    playwrightHeadless: args.headless,
    playwrightCdpEndpoint: args.localBrowser ? null : loadedConfig.playwrightCdpEndpoint,
  };

  if (!args.localBrowser && !config.playwrightCdpEndpoint) {
    throw new Error(
      "US_APPOINTMENT_BROWSER_API_ENDPOINT or US_APPOINTMENT_CDP_ENDPOINT must be set. Use --local-browser only for intentional local debugging.",
    );
  }

  console.log(JSON.stringify({
    status: "starting",
    provider: "usvisascheduling",
    accountEmail: maskEmail(credentials.email),
    accountEmailSource: accountEmail.source,
    aliasCreated: accountEmail.aliasCreated,
    generatedPassword,
    appointmentAccountPersisted: persistedAccount.persisted,
    appointmentAccountPersistReason: persistedAccount.reason,
    browserApi: config.playwrightCdpEndpoint ? "configured" : "local",
    typingDelayMs: {
      min: config.typingDelayMinMs,
      max: config.typingDelayMaxMs,
    },
  }, null, 2));

  const client = new PlaywrightUSVisaSchedulingPortalClient(config);
  try {
    const result = await client.registerAccount(credentials);
    const emailVerification = args.autoVerifyEmail && args.applicantId
      ? await waitForUSAppointmentVerificationEmail(args.applicantId, config.emailTimeoutMs)
          .then((message) => ({
            received: true,
            hasCode: Boolean(message.code),
            hasLink: Boolean(message.link),
            code: message.code,
            link: message.link,
          }))
          .catch((error) => ({
            received: false,
            error: error instanceof Error ? error.message : String(error),
          }))
      : null;
    const verificationResult =
      emailVerification?.received
        ? await client.completeAccountEmailVerification({
          emailCode: emailVerification.code,
          verificationLink: emailVerification.link,
        })
        : null;

    console.log(JSON.stringify({
      status:
        verificationResult?.gate?.actionType
        ?? (verificationResult ? "email_verification_completed" : result.gate?.actionType)
        ?? "registration_started",
      readyForSlotCapture: verificationResult?.readyForSlotCapture ?? result.readyForSlotCapture,
      gate: (verificationResult?.gate ?? result.gate)
        ? {
          actionType: (verificationResult?.gate ?? result.gate)?.actionType,
          errorCode: (verificationResult?.gate ?? result.gate)?.errorCode ?? null,
          message:
            (verificationResult?.gate ?? result.gate)?.errorMessage
            ?? (verificationResult?.gate ?? result.gate)?.instruction,
          metadata: (verificationResult?.gate ?? result.gate)?.metadata,
        }
        : null,
      emailVerification: emailVerification
        ? {
          received: emailVerification.received,
          hasCode: "hasCode" in emailVerification ? emailVerification.hasCode : false,
          hasLink: "hasLink" in emailVerification ? emailVerification.hasLink : false,
          error: "error" in emailVerification ? emailVerification.error : undefined,
        }
        : null,
    }, null, 2));

    if (args.keepOpen) {
      await waitUntilInterrupted();
    }
  } finally {
    if (!args.keepOpen) {
      await client.close();
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
