#!/usr/bin/env npx tsx
import "dotenv/config";
import { loadCanadaTrvPreflight } from "../src/ca/preflight.js";

async function main(): Promise<void> {
  const applicationId = process.argv[2] ?? process.env.CA_TRV_APPLICATION_ID;
  if (!applicationId) {
    throw new Error(
      "Usage: npx tsx scripts/check-canada-trv-readiness.ts <application-id>",
    );
  }

  const report = await loadCanadaTrvPreflight(applicationId);

  // Deliberately omit answer values, document paths, alias email and credentials.
  console.log(
    JSON.stringify(
      {
        applicationId: report.applicationId,
        readyForPortalLogin: report.readiness.readyForPortalLogin,
        readyForTermsAcceptance: report.readiness.readyForTermsAcceptance,
        readyForPurposePage: report.readiness.readyForPurposePage,
        readyForFullForm: report.readiness.readyForFullForm,
        blockers: report.readiness.blockers,
        counts: {
          missingRequiredAnswers: report.readiness.missingRequiredAnswers.length,
          missingRequiredDocuments: report.readiness.missingRequiredDocuments.length,
          documentsPendingReview: report.readiness.documentsPendingReview.length,
          missingPortalSecretKeys: report.readiness.missingPortalSecretKeys.length,
        },
        feeCheckpoint: report.feeCheckpoint,
      },
      null,
      2,
    ),
  );

  if (report.readiness.blockers.length > 0) process.exitCode = 2;
}

void main();
