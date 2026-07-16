#!/usr/bin/env npx tsx
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { buildCountrySubmissionApplication, getCountrySubmissionProvider } from "../src/country-submissions";
import { loadCanonicalAnswers } from "../src/queue/answers";
import { ensureApplicantInboxAlias } from "../src/inbox/alias";
import { choosePhEtravelAccountPlan, loadPhEtravelAccount, upsertPhEtravelAccount } from "../src/ph-etravel/account";
import {
  createPhEtravelImapMailboxProvider,
  createPhEtravelMailboxProvider,
} from "../src/ph-etravel/mailbox-provider";
import { PhEtravelPortalError, runPhEtravelPortalSubmission } from "../src/ph-etravel/runner";
import type { PhEtravelPortalPayload } from "../src/ph-etravel/normalize";
import { supabase } from "../src/supabase";
import type { CountrySubmissionApplication } from "../src/country-submissions/types";

type ParsedArgs = {
  submit: boolean;
  applicationId?: string;
  applicantId?: string;
  accountEmail?: string;
  accountPassword?: string;
  accountMpin?: string;
  mailboxEmail?: string;
  arrivalDate?: string;
  departureDate?: string;
  headless: boolean;
  payloadFile?: string;
  forceLocalBrowser: boolean;
  useImapMailbox: boolean;
};

function parseArgs(argv: string[]): ParsedArgs {
  const getArg = (name: string): string | undefined => {
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
  };

  const hasArg = (name: string): boolean => argv.includes(`--${name}`);
  const parseBoolean = (name: string, fallback: boolean): boolean => {
    const value = getArg(name);
    if (value === undefined) return fallback;
    return !["0", "false", "no"].includes(value.toLowerCase());
  };

  return {
    submit: hasArg("submit"),
    applicationId: getArg("application-id"),
    applicantId: getArg("applicant-id"),
    accountEmail: getArg("account-email"),
    accountPassword: getArg("account-password"),
    accountMpin: getArg("account-mpin"),
    mailboxEmail: getArg("mailbox-email"),
    arrivalDate: getArg("arrival-date"),
    departureDate: getArg("departure-date"),
    headless: parseBoolean("headless", process.env.PH_ETRAVEL_PLAYWRIGHT_HEADLESS !== "false"),
    payloadFile: getArg("payload-file"),
    forceLocalBrowser: hasArg("local-browser"),
    useImapMailbox: hasArg("imap-mailbox"),
  };
}

function isoDatePlus(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

const DEFAULT_PAYLOAD: PhEtravelPortalPayload = {
  countryCode: "PH",
  visaType: "PH_ETRAVEL_ARRIVAL_CARD",
  applicationId: "ph-etravel-smoke",
  fullName: "TEST USER",
  passportNumber: "E12345678",
  passportExpiryDate: "2030-12-31",
  passportIssueDate: "2020-01-01",
  passportIssuingAuthority: "China",
  nationality: "CHINA",
  countryOfBirth: "CHINA",
  countryOfResidence: "CHINA",
  residenceAddress: "Beijing",
  occupation: "STUDENT",
  dateOfBirth: "1990-01-01",
  sex: "FEMALE",
  emailAddress: "test@example.com",
  mobileCountryCode: "+86",
  mobileNumber: "13800138000",
  travelType: "ARRIVAL",
  transportType: "AIR",
  flightNumber: "PR101",
  airlineOrVesselName: "Philippine Airlines",
  portOfEntry: "NINOY AQUINO INTERNATIONAL AIRPORT",
  arrivalDate: isoDatePlus(1),
  departureDate: isoDatePlus(2),
  originCountry: "SINGAPORE",
  purposeOfTravel: "HOLIDAY",
  philippinesAddress: "Test Hotel, Manila",
  hasRecentTravelHistory30d: false,
  visitedCountries30d: [],
  hasExposureToSickPerson30d: false,
  hasBeenSick30d: false,
  sicknessSymptoms: [],
  hasHealthSymptoms: false,
  healthSymptomsDetails: null,
  customs: {
    hasCheckedBaggage: true,
    checkedBaggageCount: "1",
    hasHandcarryBaggage: true,
    handcarryBaggageCount: "1",
    hasDutiableGoods: false,
    dutiableGoodsDetails: null,
    hasCurrencyOverThreshold: false,
    currencyDeclarationDetails: null,
  },
  finalDeclaration: true,
};

function randomSuffix(length = 6): string {
  return randomBytes(Math.ceil(length / 2)).toString("hex").slice(0, length);
}

function derivePhAliasEmail(baseAlias: string): string {
  const [localPart, domain] = baseAlias.toLowerCase().split("@");
  if (!localPart || !domain) return baseAlias.toLowerCase();
  return `${localPart}-ph${randomSuffix(4)}@${domain}`;
}

function makeGeneratedPassword(): string {
  return `VizaPH-${randomBytes(9).toString("base64url").replace(/[^A-Za-z0-9]/g, "").slice(0, 14)}9!`;
}

function makeGeneratedMpin(): string {
  return randomBytes(3).readUIntLE(0, 3).toString().slice(0, 6).padStart(6, "0");
}

function makeImapPlusAlias(): string {
  const inbox = process.env.IMAP_EMAIL?.trim().toLowerCase();
  if (!inbox) throw new Error("--imap-mailbox requires IMAP_EMAIL in the local environment.");
  const [localPart, domain] = inbox.split("@");
  if (!localPart || !domain) throw new Error("IMAP_EMAIL must be a valid email address.");
  return `${localPart}+ph-etravel-${randomSuffix(8)}@${domain}`;
}

async function loadApplicationForPhPayload(applicationId: string): Promise<{
  applicationPayload: PhEtravelPortalPayload;
  applicantId: string;
}> {
  const appRes = await supabase
    .from("applications")
    .select(
      "id, applicant_id, country, visa_type, purpose, arrival_date, departure_date, accommodation_name, accommodation_address, port_of_entry, visa_package_id",
    )
    .eq("id", applicationId)
    .single();
  if (appRes.error || !appRes.data) {
    throw new Error(`Failed to load application ${applicationId}: ${appRes.error?.message ?? "not found"}`);
  }

  const application = appRes.data as {
    id: string;
    applicant_id: string;
    country: string;
    visa_type: string;
    purpose: string | null;
    arrival_date: string | null;
    departure_date: string | null;
    accommodation_name: string | null;
    accommodation_address: string | null;
    port_of_entry: string | null;
    visa_package_id: string | null;
  };

  if (application.country.toLowerCase() !== "philippines" || application.visa_type !== "PH_ETRAVEL_ARRIVAL_CARD") {
    throw new Error(`Application ${applicationId} is not a PH_ETRAVEL_ARRIVAL_CARD application.`);
  }

  const profileRes = await supabase
    .from("applicant_profiles")
    .select(
      "id, auth_user_id, full_name, date_of_birth, place_of_birth, gender, nationality, occupation, address, passport_number, passport_issue_date, passport_expiry_date, passport_issuing_country, passport_issuing_authority, email, phone",
    )
    .eq("id", application.applicant_id)
    .maybeSingle();
  if (profileRes.error || !profileRes.data) {
    throw new Error(`Failed to load applicant profile for ${application.applicant_id}: ${profileRes.error?.message ?? "not found"}`);
  }

  const profile = profileRes.data as {
    id: string;
    auth_user_id: string;
    full_name: string | null;
    date_of_birth: string | null;
    place_of_birth: string | null;
    gender: string | null;
    nationality: string | null;
    occupation: string | null;
    address: string | null;
    passport_number: string | null;
    passport_issue_date: string | null;
    passport_expiry_date: string | null;
    passport_issuing_country: string | null;
    passport_issuing_authority: string | null;
    email: string | null;
    phone: string | null;
  };

  const canonicalAnswers = await loadCanonicalAnswers(applicationId);
  const countrySpecific = buildCountrySubmissionApplication(
    {
      ...profile,
      issuing_country: profile.passport_issuing_country,
      issuing_authority: profile.passport_issuing_authority,
    },
    {
      ...application,
      status: "draft",
    },
    canonicalAnswers,
  ) as CountrySubmissionApplication;
  const provider = getCountrySubmissionProvider(countrySpecific.countryCode, countrySpecific.visaType);
  if (!provider || provider.countryCode !== "PH") {
    throw new Error(`No PH provider found for application=${applicationId}.`);
  }

  const validation = provider.validate(countrySpecific);
  if (!validation.ok) {
    throw new Error(`PH payload mapping validation failed: missing ${validation.missingRequiredFields.join(", ")}`);
  }

  const payload = provider.mapToSubmissionPayload(countrySpecific, {
    dryRun: false,
    idempotencyKey: `ph-etravel-smoke:${applicationId}`,
  }) as PhEtravelPortalPayload;

  return { applicationPayload: payload, applicantId: application.applicant_id };
}

async function loadPayloadFromFile(filePath: string): Promise<PhEtravelPortalPayload> {
  const absolutePath = resolve(filePath);
  const raw = await import("node:fs").then((fs) => fs.promises.readFile(absolutePath, "utf8"));
  const parsed = JSON.parse(raw) as PhEtravelPortalPayload;
  if (!parsed?.applicationId || parsed.visaType !== "PH_ETRAVEL_ARRIVAL_CARD" || parsed.countryCode !== "PH") {
    throw new Error(`Payload file ${filePath} is missing PH_ETRAVEL_ARRIVAL_CARD fields.`);
  }
  return parsed;
}

function withDateOverrides(payload: PhEtravelPortalPayload, args: ParsedArgs): PhEtravelPortalPayload {
  const adjusted: PhEtravelPortalPayload = { ...payload };
  if (args.arrivalDate) adjusted.arrivalDate = args.arrivalDate;
  if (args.departureDate) adjusted.departureDate = args.departureDate;
  if (!args.arrivalDate && !args.departureDate) return adjusted;
  if (!adjusted.arrivalDate || !adjusted.departureDate) return adjusted;
  if (adjusted.departureDate < adjusted.arrivalDate) {
    throw new Error("departure-date must be >= arrival-date");
  }
  return adjusted;
}

type PhEtravelAccountPlanContext = {
  email: string;
  password: string | null;
  mpin: string | null;
  mode: "reuse_existing" | "create_new";
  applicantId?: string;
  forceAccountRegistration: boolean;
};

async function buildPhEtravelAccountContext(input: {
  applicantId?: string;
  explicitEmail?: string;
  explicitPassword?: string;
  explicitMpin?: string;
  mailboxEmail?: string;
}): Promise<PhEtravelAccountContext> {
  if (input.explicitEmail || input.explicitPassword || input.explicitMpin || input.applicantId === undefined) {
    const email = input.explicitEmail?.trim();
    const password = input.explicitPassword?.trim() || process.env.PH_ETRAVEL_ACCOUNT_PASSWORD?.trim() || null;
    if (!email || !password) {
      throw new Error(
        "Explicit official credentials require at least email and password, or provide --applicant-id to auto-create/reuse official account.",
      );
    }
    return {
      email,
      password,
      mpin: input.explicitMpin?.trim() || process.env.PH_ETRAVEL_ACCOUNT_MPIN?.trim() || null,
      mode: "reuse_existing",
      forceAccountRegistration: false,
    };
  }

  if (!input.applicantId) {
    const fallbackEmail = process.env.PH_ETRAVEL_ACCOUNT_EMAIL?.trim();
    const fallbackPassword = process.env.PH_ETRAVEL_ACCOUNT_PASSWORD?.trim();
    if (fallbackEmail && fallbackPassword) {
      return {
        email: fallbackEmail,
        password: fallbackPassword,
        mpin: process.env.PH_ETRAVEL_ACCOUNT_MPIN?.trim() || null,
        mode: "reuse_existing",
        forceAccountRegistration: false,
      };
    }
    throw new Error("No official account credentials provided and --applicant-id was not set.");
  }

  const alias = input.mailboxEmail?.trim()
    ? { alias: input.mailboxEmail.trim(), created: false }
    : await ensureApplicantInboxAlias(input.applicantId);
  const aliasBase = input.mailboxEmail?.trim() || alias.alias;
  const existing = await loadPhEtravelAccount(input.applicantId);
  const chosen = choosePhEtravelAccountPlan({
    existingAccount: existing,
    aliasEmail: derivePhAliasEmail(aliasBase),
    generatedPassword: makeGeneratedPassword(),
    generatedMpin: makeGeneratedMpin(),
  });
  if (chosen.mode === "create_new") {
    await upsertPhEtravelAccount({
      applicantId: input.applicantId,
      email: chosen.email,
      password: chosen.password,
      mpin: chosen.mpin,
      status: "pending_registration",
    });
  }
  return {
    email: chosen.email,
    password: chosen.password,
    mpin: chosen.mpin,
    mode: chosen.mode,
    applicantId: input.applicantId,
    forceAccountRegistration: chosen.mode === "create_new",
  };
}

function isRetryablePhError(error: unknown): error is PhEtravelPortalError {
  if (!(error instanceof PhEtravelPortalError)) return false;
  return [
    "ph_etravel_official_account_required",
    "ph_etravel_official_login_verification_required",
    "ph_etravel_official_registration_verification_required",
    "ph_etravel_registration_turnstile_blocked",
    "ph_etravel_registration_otp_continue_disabled",
    "ph_etravel_otp_continue_disabled",
  ].includes(error.code);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (!args.submit) {
    console.warn("WARNING: --submit is required to trigger real submission against the eTravel portal.");
  } else {
    console.warn("WARNING: --submit will attempt real official submit. Use with real applicant data.");
  }

  let payload = DEFAULT_PAYLOAD;
  if (args.payloadFile) {
    payload = await loadPayloadFromFile(args.payloadFile);
  } else if (args.applicationId) {
    const loaded = await loadApplicationForPhPayload(args.applicationId);
    payload = loaded.applicationPayload;
    args.applicantId = args.applicantId ?? loaded.applicantId;
  }
  payload = withDateOverrides(payload, args);

  const useApplicantId = args.applicantId?.trim();
  const context = args.useImapMailbox
    ? {
        email: makeImapPlusAlias(),
        password: makeGeneratedPassword(),
        mpin: makeGeneratedMpin(),
        mode: "create_new" as const,
        applicantId: useApplicantId,
        forceAccountRegistration: true,
      }
    : await buildPhEtravelAccountContext({
        applicantId: useApplicantId,
        explicitEmail: args.accountEmail,
        explicitPassword: args.accountPassword,
        explicitMpin: args.accountMpin,
        mailboxEmail: args.mailboxEmail,
      });

  if (args.useImapMailbox && useApplicantId) {
    await upsertPhEtravelAccount({
      applicantId: useApplicantId,
      email: context.email,
      password: context.password,
      mpin: context.mpin,
      status: "pending_registration",
    });
  }

  const mailbox = args.useImapMailbox
    ? createPhEtravelImapMailboxProvider()
    : useApplicantId
      ? createPhEtravelMailboxProvider(useApplicantId, context.email)
      : undefined;
  let attempts = 0;
  let lastError: unknown;
  while (attempts < 3) {
  try {
      const result = await runPhEtravelPortalSubmission(payload, {
        stopBeforeSubmit: !args.submit,
        headless: args.headless,
        applicantId: useApplicantId,
        officialAccountEmail: context.email,
        officialAccountPassword: context.password,
        officialAccountMpin: context.mpin,
        forceAccountRegistration: context.forceAccountRegistration,
        mailbox,
        forceLocalBrowser: args.forceLocalBrowser,
      });
      console.log(JSON.stringify(result, null, 2));
      return;
    } catch (error) {
      lastError = error;
      if (!isRetryablePhError(error) || attempts >= 1 || !useApplicantId) {
        break;
      }
      attempts += 1;
      if (context.applicantId) {
        await upsertPhEtravelAccount({
          applicantId: context.applicantId,
          email: context.email,
          password: context.password,
          mpin: context.mpin,
          status: "failed",
        });
      }
      const retryContext = await buildPhEtravelAccountContext({
        applicantId: useApplicantId,
        explicitEmail: args.accountEmail,
        explicitPassword: args.accountPassword,
        explicitMpin: args.accountMpin,
        mailboxEmail: args.mailboxEmail,
      });
      context.email = retryContext.email;
      context.password = retryContext.password;
      context.mpin = retryContext.mpin;
      context.mode = retryContext.mode;
      context.forceAccountRegistration = retryContext.forceAccountRegistration;
    }
  }

  const details = lastError as { code?: string; screenshotPaths?: string[]; portalSummary?: string; logs?: string[] };
  console.error(lastError instanceof Error ? lastError.stack ?? lastError.message : String(lastError));
  if (typeof lastError === "object" && lastError !== null) {
    console.error(
      JSON.stringify({
        code: details.code,
        screenshots: details.screenshotPaths,
        portalSummary: details.portalSummary,
        logs: details.logs,
      }, null, 2),
    );
  }
  if (args.submit) {
    process.exit(1);
  }
  if (lastError instanceof PhEtravelPortalError && lastError.code === "ph_etravel_stopped_before_submit") {
    console.log(JSON.stringify({
      status: "stopped_before_submit",
      code: lastError.code,
      screenshots: lastError.screenshotPaths,
      portalSummary: lastError.portalSummary,
    }, null, 2));
  } else {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
