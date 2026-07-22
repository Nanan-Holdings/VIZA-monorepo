#!/usr/bin/env npx tsx
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { extname, join, resolve } from "node:path";
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
import { buildPhEtravelFieldPlan } from "../src/ph-etravel/form-filler";
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
  profilePhotoPath?: string;
  forceLocalBrowser: boolean;
  useImapMailbox: boolean;
  newImapAlias: boolean;
  travelType: "arrival" | "departure";
  transport: "air" | "sea";
  passportHolder: "filipino" | "foreigner";
  recoverQr: boolean;
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
    profilePhotoPath: getArg("profile-photo"),
    forceLocalBrowser: hasArg("local-browser"),
    useImapMailbox: hasArg("imap-mailbox") || hasArg("use-imap-mailbox"),
    newImapAlias: hasArg("new-imap-alias"),
    travelType: getArg("travel-type")?.toLowerCase() === "departure" ? "departure" : "arrival",
    transport: getArg("transport")?.toLowerCase() === "sea" ? "sea" : "air",
    passportHolder: getArg("passport-holder")?.toLowerCase() === "filipino" ? "filipino" : "foreigner",
    recoverQr: hasArg("recover-qr"),
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
  passportHolderType: "FOREIGNER",
  flightNumber: "PR101",
  airlineOrVesselName: "Philippine Airlines",
  airportOfOrigin: "Singapore Changi Airport",
  portOfEntry: "Ninoy Aquino International Airport T1 - (MNL)",
  arrivalDate: isoDatePlus(1),
  departureDate: isoDatePlus(1),
  originCountry: "SINGAPORE",
  purposeOfTravel: "HOLIDAY",
  withTransit: false,
  destinationType: "HOTEL_RESORT",
  destinationPort: null,
  philippinesAddress: "The Manila Hotel",
  returnDate: null,
  travelTaxPaymentType: null,
  travelTaxReferenceNumber: null,
  travelTaxTicketNumber: null,
  cfoRegistrationNumber: null,
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
    customsSignatureFile: null,
    customsInformationAcknowledgement: true,
    hasGoodsToDeclare: false,
    hasCurrencyToDeclare: false,
    currencyType: null,
    currencyAmount: null,
    currencySource: null,
    bspAuthorizationNumber: null,
    bspAuthorizationDate: null,
    customsSignatureDeclaration: true,
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

function isConfiguredImapPlusAlias(email: string): boolean {
  const inbox = process.env.IMAP_EMAIL?.trim().toLowerCase();
  if (!inbox) return false;
  const [localPart, domain] = inbox.split("@");
  return Boolean(localPart && domain && email.toLowerCase().startsWith(`${localPart}+`) && email.toLowerCase().endsWith(`@${domain}`));
}

async function loadApplicationForPhPayload(applicationId: string): Promise<{
  applicationPayload: PhEtravelPortalPayload;
  applicantId: string;
  authUserId: string;
  referenceNumber?: string;
  currentResult?: Record<string, unknown> | null;
  profilePhotoPath?: string;
}> {
  const appRes = await supabase
    .from("applications")
    .select(
      "id, applicant_id, country, visa_type, purpose, arrival_date, departure_date, accommodation_name, accommodation_address, port_of_entry, visa_package_id, confirmation_number, submission_result",
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
    confirmation_number: string | null;
    submission_result: Record<string, unknown> | null;
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

  return {
    applicationPayload: payload,
    applicantId: application.applicant_id,
    authUserId: profile.auth_user_id,
    referenceNumber: application.confirmation_number ??
      (typeof application.submission_result?.referenceNumber === "string"
        ? application.submission_result.referenceNumber
        : undefined),
    currentResult: application.submission_result,
    profilePhotoPath: await downloadReusableApplicantPhoto(application.applicant_id),
  };
}

async function persistRecoveredQr(input: {
  applicationId: string;
  authUserId: string;
  currentResult: Record<string, unknown> | null;
  qrCodes: string[];
  screenshots: string[];
}): Promise<void> {
  const timestamp = Date.now();
  const upload = async (localPath: string, kind: "qr" | "confirmation"): Promise<string> => {
    const storagePath = `${input.authUserId}/${input.applicationId}/PH/phetravel-${kind}-${timestamp}.png`;
    const bytes = await fs.readFile(localPath);
    const result = await supabase.storage.from("submission-artifacts").upload(storagePath, bytes, {
      contentType: "image/png",
      upsert: false,
    });
    if (result.error) throw new Error(`Failed to store recovered ${kind} artifact: ${result.error.message}`);
    return storagePath;
  };

  const qrStoragePaths: string[] = [];
  for (const qrCode of input.qrCodes) qrStoragePaths.push(await upload(qrCode, "qr"));
  const cleanedScreenshot = input.screenshots.at(-1);
  const screenshotStoragePath = cleanedScreenshot ? await upload(cleanedScreenshot, "confirmation") : null;
  const existingArtifacts = input.currentResult?.artifacts && typeof input.currentResult.artifacts === "object"
    ? input.currentResult.artifacts as Record<string, unknown>
    : {};
  const existingScreenshots = Array.isArray(existingArtifacts.screenshots)
    ? existingArtifacts.screenshots.filter((value): value is string => typeof value === "string")
    : [];
  const updatedResult = {
    ...input.currentResult,
    portalResponseSummary: "Philippines eTravel official QR was recovered from the existing Travel History record.",
    artifacts: {
      ...existingArtifacts,
      qrCodes: qrStoragePaths,
      screenshots: screenshotStoragePath ? [...existingScreenshots, screenshotStoragePath] : existingScreenshots,
    },
  };
  const update = await supabase.from("applications").update({
    submission_result: updatedResult,
    submission_result_status: "completed",
    submission_result_updated_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", input.applicationId);
  if (update.error) throw new Error(`Failed to attach recovered QR to application: ${update.error.message}`);
  console.log(JSON.stringify({ recoveredQrStored: true, qrArtifactCount: qrStoragePaths.length }));
}

async function downloadReusableApplicantPhoto(applicantId: string): Promise<string | undefined> {
  const applications = await supabase.from("applications").select("id").eq("applicant_id", applicantId);
  if (applications.error) throw new Error(`Failed to load applications for reusable photo: ${applications.error.message}`);
  const applicationIds = (applications.data ?? []).map((row) => row.id).filter(Boolean);
  if (applicationIds.length === 0) return undefined;

  const photos = await supabase
    .from("application_documents")
    .select("storage_path, filename, document_type, created_at")
    .in("application_id", applicationIds)
    .in("document_type", ["photo", "applicant_photo", "passport_photo"])
    .in("status", ["uploaded", "validated"])
    .not("storage_path", "is", null)
    .order("created_at", { ascending: false })
    .limit(10);
  if (photos.error) throw new Error(`Failed to load reusable applicant photos: ${photos.error.message}`);

  for (const photo of photos.data ?? []) {
    if (!photo.storage_path) continue;
    const download = await supabase.storage.from("application-documents").download(photo.storage_path);
    if (download.error || !download.data) continue;
    const extension = extname(photo.filename ?? photo.storage_path) || ".jpg";
    const directory = await fs.mkdtemp(join(tmpdir(), "viza-ph-etravel-photo-"));
    const filePath = join(directory, `profile${extension}`);
    await fs.writeFile(filePath, Buffer.from(await download.data.arrayBuffer()));
    return filePath;
  }
  return undefined;
}

async function loadProfileForSmokePayload(applicantId: string): Promise<{
  payload: PhEtravelPortalPayload;
  profilePhotoPath?: string;
}> {
  const profile = await supabase
    .from("applicant_profiles")
    .select("full_name, date_of_birth, gender, nationality, occupation, address, passport_number, passport_issue_date, passport_expiry_date, passport_issuing_country, passport_issuing_authority, email, phone")
    .eq("id", applicantId)
    .single();
  if (profile.error || !profile.data) {
    throw new Error(`Failed to load applicant profile for PH smoke: ${profile.error?.message ?? "not found"}`);
  }
  const row = profile.data;
  return {
    payload: {
      ...DEFAULT_PAYLOAD,
      applicationId: `ph-etravel-smoke-${Date.now()}`,
      fullName: row.full_name ?? DEFAULT_PAYLOAD.fullName,
      dateOfBirth: row.date_of_birth ?? DEFAULT_PAYLOAD.dateOfBirth,
      sex: row.gender ?? DEFAULT_PAYLOAD.sex,
      nationality: row.nationality ?? DEFAULT_PAYLOAD.nationality,
      countryOfResidence: row.nationality ?? DEFAULT_PAYLOAD.countryOfResidence,
      countryOfBirth: row.nationality ?? DEFAULT_PAYLOAD.countryOfBirth,
      occupation: row.occupation ?? DEFAULT_PAYLOAD.occupation,
      residenceAddress: row.address ?? DEFAULT_PAYLOAD.residenceAddress,
      passportNumber: row.passport_number ?? DEFAULT_PAYLOAD.passportNumber,
      passportIssueDate: row.passport_issue_date ?? DEFAULT_PAYLOAD.passportIssueDate,
      passportExpiryDate: row.passport_expiry_date ?? DEFAULT_PAYLOAD.passportExpiryDate,
      passportIssuingAuthority: row.passport_issuing_authority ?? row.passport_issuing_country ?? DEFAULT_PAYLOAD.passportIssuingAuthority,
      emailAddress: row.email ?? DEFAULT_PAYLOAD.emailAddress,
      mobileNumber: row.phone ?? DEFAULT_PAYLOAD.mobileNumber,
    },
    profilePhotoPath: await downloadReusableApplicantPhoto(applicantId),
  };
}

async function loadPayloadFromFile(filePath: string): Promise<PhEtravelPortalPayload> {
  const absolutePath = resolve(filePath);
  const raw = await import("node:fs").then((fs) => fs.promises.readFile(absolutePath, "utf8"));
  const parsed = JSON.parse(raw) as PhEtravelPortalPayload;
  if (!parsed?.applicationId || !["PH_ETRAVEL_ARRIVAL_CARD", "PH_ETRAVEL_DEPARTURE_CARD"].includes(parsed.visaType) || parsed.countryCode !== "PH") {
    throw new Error(`Payload file ${filePath} is missing Philippines eTravel fields.`);
  }
  return parsed;
}

function withDateOverrides(payload: PhEtravelPortalPayload, args: ParsedArgs): PhEtravelPortalPayload {
  const adjusted: PhEtravelPortalPayload = { ...payload };
  if (args.arrivalDate) adjusted.arrivalDate = args.arrivalDate;
  if (args.departureDate) adjusted.departureDate = args.departureDate;
  if (!args.arrivalDate && !args.departureDate) return adjusted;
  if (!adjusted.arrivalDate || !adjusted.departureDate) return adjusted;
  if (adjusted.travelType === "ARRIVAL" && adjusted.departureDate < adjusted.arrivalDate) {
    throw new Error("For arrival registration, departure-date must be on or after arrival-date");
  }
  if (adjusted.travelType === "DEPARTURE" && adjusted.arrivalDate < adjusted.departureDate) {
    throw new Error("For departure registration, destination arrival-date must be on or after departure-date");
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
  let loadedApplication: Awaited<ReturnType<typeof loadApplicationForPhPayload>> | null = null;
  let profilePhotoPath = args.profilePhotoPath ? resolve(args.profilePhotoPath) : undefined;
  if (args.payloadFile) {
    payload = await loadPayloadFromFile(args.payloadFile);
  } else if (args.applicationId) {
    const loaded = await loadApplicationForPhPayload(args.applicationId);
    loadedApplication = loaded;
    payload = loaded.applicationPayload;
    args.applicantId = args.applicantId ?? loaded.applicantId;
    profilePhotoPath = loaded.profilePhotoPath;
  } else if (args.applicantId) {
    const loaded = await loadProfileForSmokePayload(args.applicantId);
    payload = loaded.payload;
    profilePhotoPath = loaded.profilePhotoPath;
  }
  if (args.travelType === "departure") {
    const isAir = args.transport === "air";
    payload = {
      ...payload,
      visaType: "PH_ETRAVEL_DEPARTURE_CARD",
      applicationId: payload.applicationId === "ph-etravel-smoke" ? "ph-etravel-departure-smoke" : payload.applicationId,
      travelType: "DEPARTURE",
      transportType: isAir ? "AIR" : "SEA",
      passportHolderType: args.passportHolder === "filipino" ? "FILIPINO" : "FOREIGNER",
      nationality: args.passportHolder === "filipino" ? "PH" : payload.nationality,
      flightNumber: isAir ? "PR101" : "TEST VESSEL",
      airlineOrVesselName: isAir ? "PHILIPPINE AIRLINES" : "TEST VESSEL",
      portOfEntry: isAir ? "TP1000" : "SP1000",
      departureDate: args.departureDate ?? isoDatePlus(1),
      arrivalDate: args.arrivalDate ?? isoDatePlus(2),
      destinationCountry: "SG",
      destinationPort: isAir ? "Singapore Changi Airport" : "Singapore Cruise Centre",
      destinationAddress: "1 Airport Boulevard, Singapore",
      philippinesAddress: null,
      purposeOfTravel: "POV001",
      travellerType: isAir ? "AIRCRAFT PASSENGER" : "VESSEL PASSENGER",
      travelTaxPaymentType: args.passportHolder === "filipino" ? "TICKET PURCHASE" : null,
      travelTaxTicketNumber: args.passportHolder === "filipino" ? "PLACEHOLDER-TICKET" : null,
    };
  }
  payload = withDateOverrides(payload, args);

  const useApplicantId = args.applicantId?.trim();
  const existingImapAccount = args.useImapMailbox && !args.newImapAlias && useApplicantId
    ? await loadPhEtravelAccount(useApplicantId)
    : null;
  const context = args.useImapMailbox
    ? existingImapAccount?.password && isConfiguredImapPlusAlias(existingImapAccount.email)
      ? {
          email: existingImapAccount.email,
          password: existingImapAccount.password,
          mpin: existingImapAccount.mpin,
          mode: existingImapAccount.status === "verified" ? "reuse_existing" as const : "create_new" as const,
          applicantId: useApplicantId,
          forceAccountRegistration: existingImapAccount.status !== "verified",
        }
      : {
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

  if (args.recoverQr) {
    context.forceAccountRegistration = false;
  }

  if (args.useImapMailbox && useApplicantId && context.forceAccountRegistration) {
    await upsertPhEtravelAccount({
      applicantId: useApplicantId,
      email: context.email,
      password: context.password,
      mpin: context.mpin,
      status: "pending_registration",
    });
  }

  const mailbox = args.useImapMailbox
    ? createPhEtravelImapMailboxProvider(context.email)
    : useApplicantId
      ? createPhEtravelMailboxProvider(useApplicantId, context.email)
      : undefined;
  payload.emailAddress = context.email;
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
        profilePhotoPath,
        forceAccountRegistration: context.forceAccountRegistration,
        mailbox,
        forceLocalBrowser: args.forceLocalBrowser,
        recoverReferenceNumber: args.recoverQr ? loadedApplication?.referenceNumber : undefined,
      });
      if (args.recoverQr) {
        if (!args.applicationId || !loadedApplication?.referenceNumber) {
          throw new Error("--recover-qr requires an application with an official reference number.");
        }
        if (result.qrCodes.length === 0) {
          throw new Error("Official QR recovery completed without a QR artifact.");
        }
        await persistRecoveredQr({
          applicationId: args.applicationId,
          authUserId: loadedApplication.authUserId,
          currentResult: loadedApplication.currentResult ?? null,
          qrCodes: result.qrCodes,
          screenshots: result.screenshots,
        });
      }
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
    const officialFieldPlan = buildPhEtravelFieldPlan(payload);
    const requiredFields = officialFieldPlan.filter((field) => field.required).map((field) => field.key);
    const plannedFieldNames = new Set(officialFieldPlan.map((field) => field.key));
    // Reaching the official Summary means eTravel accepted every visible
    // required field, including personal fields supplied during eGov account
    // onboarding rather than on the declaration pages. Report those as
    // accepted instead of incorrectly labelling them missing.
    const filledFields = [...new Set([
      ...lastError.filledFields.filter((field) => plannedFieldNames.has(field)),
      ...(lastError.reachedReview ? requiredFields : []),
    ])];
    const missingFields = requiredFields.filter((field) => !filledFields.includes(field));
    if (context.applicantId) {
      await upsertPhEtravelAccount({
        applicantId: context.applicantId,
        email: context.email,
        password: context.password,
        mpin: context.mpin,
        status: "verified",
      });
    }
    console.log(JSON.stringify({
      status: "stopped_before_submit",
      code: lastError.code,
      screenshots: lastError.screenshotPaths,
      portalSummary: lastError.portalSummary,
      parity: {
        portalPlanFields: officialFieldPlan.map((field) => field.key),
        requiredFields,
        filledFields,
        missingFields,
        extraFields: [],
        validationErrors: [],
        reachedReview: lastError.reachedReview,
        evidencePaths: lastError.screenshotPaths,
      },
    }, null, 2));
    if (missingFields.length > 0) process.exitCode = 1;
  } else {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
