#!/usr/bin/env npx tsx
/**
 * One readiness report for the five 2026-08 tourist products (CA/TR/IN/SA/AE).
 *
 * Each country is evaluated with the same preflight its runner uses, so the
 * output is the authoritative remaining-work list rather than a hand-kept note.
 * It is read-only: no browser is launched, nothing is enqueued, and no answer,
 * document path, alias, or credential value is printed — only field names.
 *
 * Usage:
 *   node --env-file=.env --env-file=../agent-backend/.env.local --import tsx \
 *     scripts/check-five-tourist-readiness.ts
 */
import "dotenv/config";
import { loadCanadaTrvPreflight } from "../src/ca/preflight.js";
import {
  loadCanonicalAnswers,
  loadCountrySubmissionContext,
  loadSubmissionPreflightContext,
} from "../src/queue/answers.js";
import { validateTrSubmissionPreflight } from "../src/tr/preflight.js";
import { validateInSubmissionPreflight } from "../src/in/preflight.js";
import { resolveApplicationDocumentInventory } from "../src/documents/resolve-application-documents.js";
import {
  missingRequired as saMissingRequired,
  missingSaDocuments,
  normalizeSaAnswers,
} from "../src/sa/field-mappings.js";
import { readSaudiLiveConfig, validateSaudiLiveConfig } from "../src/sa/live-flow.js";
import { loadSaudiPrivacyAuthorization } from "../src/sa/privacy-authorization.js";
import {
  aeDocumentEvidenceReviewBlockers,
  aeMissingRequired,
  missingAeDocuments,
  normalizeAeAnswers,
} from "../src/ae/field-mappings.js";
import { loadAeDocumentEvidenceFacts } from "../src/ae/document-evidence.js";
import { readAeLiveConfig, validateAeLiveConfig } from "../src/ae/live-flow.js";
import {
  FIVE_TOURIST_APPLICATIONS,
  type TouristCountry,
} from "../src/tourist-qa-applications.js";

interface CountryReadiness {
  country: TouristCountry;
  visaType: string;
  applicationId: string;
  ready: boolean;
  missingAnswers: string[];
  missingDocuments: string[];
  missingCredentials: string[];
  liveConfigBlockers: string[];
  notes: string[];
}

const captchaConfigured = (): boolean => Boolean(process.env.TWOCAPTCHA_API_KEY?.trim());

async function canadaReadiness(): Promise<CountryReadiness> {
  const { applicationId, visaType } = FIVE_TOURIST_APPLICATIONS.canada;
  const report = await loadCanadaTrvPreflight(applicationId);
  const r = report.readiness;
  return {
    country: "canada",
    visaType,
    applicationId,
    ready: r.readyForFullForm,
    missingAnswers: [...r.missingRequiredAnswers],
    missingDocuments: [...r.missingRequiredDocuments],
    missingCredentials: [...r.missingPortalSecretKeys],
    liveConfigBlockers: [],
    notes: [
      `readyForPortalLogin=${r.readyForPortalLogin}`,
      `readyForTermsAcceptance=${r.readyForTermsAcceptance}`,
      `readyForPurposePage=${r.readyForPurposePage}`,
      `documentsPendingReview=${r.documentsPendingReview.length}`,
      `feeQuote=${report.feeCheckpoint.quotePresent} feeIntent=${report.feeCheckpoint.paymentIntentPresent}`,
      ...r.blockers.map((b) => {
        const fields = b.fields ?? b.requirements ?? [];
        return fields.length > 0 ? `blocker:${b.code}(${fields.join(",")})` : `blocker:${b.code}`;
      }),
    ],
  };
}

async function turkeyReadiness(): Promise<CountryReadiness> {
  const { applicationId, visaType } = FIVE_TOURIST_APPLICATIONS.turkey;
  const [answers, context] = await Promise.all([
    loadCanonicalAnswers(applicationId),
    loadSubmissionPreflightContext(applicationId),
  ]);
  const preflight = validateTrSubmissionPreflight({
    answers,
    managedEmailAlias: context.inboxAlias,
    documents: context.documents,
    captchaConfigured: captchaConfigured(),
  });
  return {
    country: "turkey",
    visaType,
    applicationId,
    ready: preflight.ready,
    missingAnswers: preflight.missingAnswers,
    missingDocuments: preflight.missingDocuments,
    missingCredentials: preflight.missingCredentials,
    liveConfigBlockers: process.env.TR_LIVE_QA_TO_PAYMENT === "1" ? [] : ["TR_LIVE_QA_TO_PAYMENT"],
    notes: [
      `readyForEligibility=${preflight.readyForEligibility}`,
      `eligibilityMissing=${preflight.eligibilityMissingAnswers.length}`,
    ],
  };
}

async function indiaReadiness(): Promise<CountryReadiness> {
  const { applicationId, visaType } = FIVE_TOURIST_APPLICATIONS.india;
  const [answers, context] = await Promise.all([
    loadCanonicalAnswers(applicationId),
    loadSubmissionPreflightContext(applicationId),
  ]);
  const preflight = validateInSubmissionPreflight({
    answers,
    managedEmailAlias: context.inboxAlias,
    documents: context.documents,
    captchaConfigured: captchaConfigured(),
  });
  return {
    country: "india",
    visaType,
    applicationId,
    ready: preflight.ready,
    missingAnswers: preflight.missingAnswers,
    missingDocuments: preflight.missingDocuments,
    missingCredentials: preflight.missingCredentials,
    liveConfigBlockers: process.env.IN_LIVE_QA_TO_PAYMENT === "1" ? [] : ["IN_LIVE_QA_TO_PAYMENT"],
    notes: [],
  };
}

async function saudiReadiness(): Promise<CountryReadiness> {
  const { applicationId, visaType } = FIVE_TOURIST_APPLICATIONS.saudi_arabia;
  const context = await loadCountrySubmissionContext(applicationId);
  const answers = normalizeSaAnswers(context.answers);
  const documentKeys = await resolveApplicationDocumentInventory(applicationId);
  const config = readSaudiLiveConfig();
  const privacyAuthorization = await loadSaudiPrivacyAuthorization(applicationId).catch(() => null);
  return {
    country: "saudi_arabia",
    visaType,
    applicationId,
    ready: saMissingRequired(answers).length === 0 && missingSaDocuments(documentKeys).length === 0,
    missingAnswers: saMissingRequired(answers),
    missingDocuments: missingSaDocuments(documentKeys),
    missingCredentials: captchaConfigured() ? [] : ["TWOCAPTCHA_API_KEY"],
    liveConfigBlockers: [
      ...(config.preSubmitEnabled ? [] : ["SA_PRE_SUBMIT_QA_ENABLED"]),
      ...validateSaudiLiveConfig(config),
      ...(privacyAuthorization ? [] : ["visitsaudi_privacy_authorization"]),
    ],
    notes: [
      `accountPreparationEnabled=${config.accountPreparationEnabled}`,
      `loginEnabled=${config.loginEnabled}`,
      `twoCaptchaEnabled=${config.twoCaptchaEnabled}`,
      `paymentCheckpointEnabled=${config.paymentCheckpointEnabled}`,
    ],
  };
}

async function uaeReadiness(): Promise<CountryReadiness> {
  const { applicationId, visaType } = FIVE_TOURIST_APPLICATIONS.united_arab_emirates;
  const context = await loadCountrySubmissionContext(applicationId);
  const answers = normalizeAeAnswers(context.answers);
  const documentKeys = await resolveApplicationDocumentInventory(applicationId);
  const evidenceFacts = await loadAeDocumentEvidenceFacts(applicationId).catch(() => ({}));
  const config = readAeLiveConfig();
  const evidenceBlockers = aeDocumentEvidenceReviewBlockers(evidenceFacts);
  return {
    country: "united_arab_emirates",
    visaType,
    applicationId,
    ready:
      aeMissingRequired(answers).length === 0 &&
      missingAeDocuments(documentKeys, answers.current_nationality).length === 0 &&
      evidenceBlockers.length === 0,
    missingAnswers: aeMissingRequired(answers),
    missingDocuments: missingAeDocuments(documentKeys, answers.current_nationality),
    missingCredentials: [],
    liveConfigBlockers: [
      ...(config.preSubmitEnabled ? [] : ["AE_PRE_SUBMIT_QA_ENABLED"]),
      ...validateAeLiveConfig(config),
      ...(config.authenticatedCdpEnabled ? [] : ["AE_AUTHENTICATED_CDP_ENABLED"]),
    ],
    notes: evidenceBlockers.map((blocker) => `evidence_review:${blocker}`),
  };
}

const CHECKS: Record<TouristCountry, () => Promise<CountryReadiness>> = {
  canada: canadaReadiness,
  turkey: turkeyReadiness,
  india: indiaReadiness,
  saudi_arabia: saudiReadiness,
  united_arab_emirates: uaeReadiness,
};

async function main(): Promise<void> {
  const requested = process.argv.slice(2) as TouristCountry[];
  const countries = requested.length > 0 ? requested : (Object.keys(CHECKS) as TouristCountry[]);

  const results: Array<CountryReadiness | { country: string; error: string }> = [];
  for (const country of countries) {
    const check = CHECKS[country];
    if (!check) {
      results.push({ country, error: `unknown country: ${country}` });
      continue;
    }
    try {
      results.push(await check());
    } catch (error) {
      results.push({
        country,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  console.log(JSON.stringify({ capturedAt: new Date().toISOString(), results }, null, 2));
  if (results.some((result) => "error" in result || !result.ready)) process.exitCode = 2;
}

void main();
