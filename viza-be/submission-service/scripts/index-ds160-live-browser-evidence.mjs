import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";

const docs = path.resolve(import.meta.dirname, "../docs");
const rawPath = `${docs}/ds160-live-browser-raw-evidence-2026-09-21.json`;
const raw = JSON.parse(fs.readFileSync(rawPath, "utf8"));
const manifest = JSON.parse(fs.readFileSync(`${docs}/ds160-current-live-evidence-manifest-2026-09-21.json`, "utf8"));
const sha256 = crypto.createHash("sha256").update(fs.readFileSync(rawPath)).digest("hex").toUpperCase();
const controls = raw.controls;
const observations = raw.observations;
const pageUrl = page => `https://ceac.state.gov${page}`;

const compatibilityOnly = new Set([
  "mobile_phone", "has_social_media", "social_media_provider",
  "social_media_identifier", "passport_has_expiry", "job_title",
]);

const pageGroups = [
  ["personal-information-1", /\/complete_personal\.aspx$/, ["Personal Information 1"], "Identity, name, telecode, birth-place, marital, and validation controls are present in the raw Personal Information 1 catalog."],
  ["personal-information-2", /\/complete_personalcont\.aspx$/, ["Personal Information 2"], "Nationality, other-nationality, permanent-residence, identifier, N/A, and repeat controls are present in the raw Personal Information 2 catalog."],
  ["travel-information", /\/complete_travel\.aspx$/, ["Travel Information"], "Purpose, specific-plans, stay, payer, location-repeat, and duplicate-purpose states are present in the raw Travel Information catalog."],
  ["travel-companions", /\/complete_travelcompanions\.aspx$/, ["Travel Companions"], "Group/individual companion branches, required states, and Add/Remove controls are present in the raw catalog."],
  ["previous-us-travel", /\/complete_previousustravel\.aspx$/, ["Previous U.S. Travel"], "Visit, driver-license, visa, ESTA, petition, explanation, date, and repeat states are present in the raw catalog."],
  ["address-and-phone", /\/complete_contact\.aspx$/, ["Address and Phone"], "Home/mailing, phone/email/social, explicit N/A, and listed/NONE social controls are present in the raw catalog."],
  ["passport-information", /\/Passport_Visa_Info\.aspx$/, ["Passport Information"], "Passport types R/O/D/L/T, issuer/book/date/lost-passport controls, and lost-passport repeats are present in the raw catalog."],
  ["us-point-of-contact", /\/complete_uscontact\.aspx$/, ["US Point of Contact"], "Seven relationship choices, shared name/organization unknown controls, address, phone, email/N/A, and cross-branch states are present in the raw catalog."],
  ["family-relatives", /\/complete_family1\.aspx$/, ["Family Information: Relatives"], "Parent unknown/date/in-U.S. branches, immediate/other-relative branches, status options, and relative repeats are present in the raw catalog."],
  ["family-spouse-partner", /\/complete_family2\.aspx$/, ["Family Information: Spouse", "Family Information: Partner"], "Spouse/partner identity, date, nationality, address choices, and marital-route states are present in the raw catalog."],
  ["family-former-spouse", /\/complete_family4\.aspx$/, ["Family Information: Former Spouse"], "Former-spouse count, required, date, and Add/Remove states are present in the raw catalog."],
  ["family-deceased-spouse", /\/complete_family5\.aspx$/, ["Family Information: Deceased Spouse"], "Widowed/deceased-spouse required, year-only, and city-unknown states are present in the raw catalog."],
  ["work-present", /\/complete_workeducation1\.aspx$/, ["Work/Education/Training: Present"], "All 22 occupation choices and common employer/school controls with observed limits and N/A controls are present in the raw catalog."],
  ["work-previous", /\/complete_workeducation2\.aspx$/, ["Work/Education/Training: Previous"], "Previous-work/education fields, partial dates, required states, and repeat Add/Remove controls are present in the raw catalog."],
  ["work-additional", /\/complete_workeducation3\.aspx$/, ["Work/Education/Training: Additional"], "Additional yes/no branches, explanations, partial dates, and observed language/country/organization/military repeats are present in the raw catalog."],
  ["security-background-1", /\/complete_securityandbackground1\.aspx$/, ["Security and Background: Part 1"], "Part 1 security labels and Yes explanation/No hiding states are present in the raw catalog."],
  ["security-background-2", /\/complete_securityandbackground2\.aspx$/, ["Security and Background: Part 2"], "Part 2 security labels and Yes explanation/No hiding states are present in the raw catalog."],
  ["security-background-3", /\/complete_securityandbackground3\.aspx$/, ["Security and Background: Part 3"], "Part 3 security labels and Yes explanation/No hiding states are present in the raw catalog."],
  ["security-background-4", /\/complete_securityandbackground4\.aspx$/, ["Security and Background: Part 4"], "Part 4 security labels and Yes explanation/No hiding states are present in the raw catalog."],
  ["security-background-5", /\/complete_securityandbackground5\.aspx$/, ["Security and Background: Part 5"], "Part 5 security labels and Yes explanation/No hiding states are present in the raw catalog."],
  ["photo-flow", /\/photo\/|\/qotw\//, [], "The observed photo upload/quality failure and Continue Without Photo recovery states are present; a valid accepted photo is not proven."],
  ["review-progression", /\/review\//, [], "The observed review-page controls are present; this is navigation evidence, not final submission proof."],
  ["esign-structure", /\/esign\/signtheapplication\.aspx$/, ["Sign and Submit"], "The observed assistance/preparer structure, mutual name/organization N/A behavior, and state/postal N/A controls are present; final signature was not clicked."],
  ["designated-location", /\/designatelocation\.aspx$/, [], "The observed designate-location page is indexed as a page control outside the answer-field proof."],
];

const fieldsFor = pages => manifest.fields
  .filter(field => pages.includes(field.page) && field.fieldName !== "consular_post" && !compatibilityOnly.has(field.fieldName))
  .map(field => field.fieldName);

const groups = pageGroups.map(([id, matcher, pages, actual]) => {
  const matched = observations.filter(observation => matcher.test(observation.page));
  const refs = matched.map(observation => ({
    state: observation.state,
    page: observation.page,
    observedAt: observation.observedAt,
    controlIds: [...new Set(observation.controls.map(index => controls[index]?.id).filter(Boolean))].sort(),
  }));
  const controlIds = [...new Set(refs.flatMap(ref => ref.controlIds))].sort();
  return {
    parentFindingId: `ceac-live-2026-09-21:${id}`,
    covers: id === "designated-location" ? ["consular_post"] : fieldsFor(pages),
    sourceKind: "current_live_dom",
    observedOn: raw.observedOn,
    sourceUrls: [...new Set(matched.map(observation => pageUrl(observation.page)))].sort(),
    expected: "The scoped CEAC controls and states represented by this finding are present in the current live DOM catalog.",
    actual,
    comparison: matched.length > 0 ? "match" : "not_observed",
    evidenceGranularity: "aggregate_page_controls",
    serverValidation: "not_observed",
    observationRefs: refs,
    controlIds,
  };
});

const allStates = observations.map(observation => observation.state);
const indexedStates = new Set(groups.flatMap(group => group.observationRefs.map(ref => ref.state)));
const securityQuestionIds = raw.securityQuestions.map(question => question.id).sort();
const estaPositiveCodes = raw.nationalityGates.filter(gate => gate.esta).map(gate => gate.code).sort();
const coveredFields = [...new Set(groups.flatMap(group => group.covers))].sort();
const index = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  scope: "ds160_b1_b2_current_live_browser_evidence_index",
  officialParityVerified: false,
  claimBoundary: "Aggregate covers are trace links to current-live DOM/catalog findings. They do not prove independent server validation, reload/stale-value behavior, every option combination, final signature requiredness, or final submission.",
  htmlRequiredBoundary: "Control required values reflect the HTML attribute only. CEAC server validators must be verified separately; required:false does not establish that a field is optional.",
  rawEvidenceArtifact: {
    file: "ds160-live-browser-raw-evidence-2026-09-21.json",
    source: raw.source,
    observedOn: raw.observedOn,
    sha256,
    controls: raw.controls.length,
    observations: raw.observations.length,
    optionSets: raw.optionSets.length,
    nationalityGates: raw.nationalityGates.length,
    securityQuestions: raw.securityQuestions.length,
    applicantDataStored: false,
  },
  parentFindingIdConvention: "ceac-live-2026-09-21:<group>; observationRefs.state is copied verbatim from the raw artifact and controlIds are raw DOM control ids.",
  compatibilityOnlyFields: [...compatibilityOnly].sort().map(fieldName => ({ fieldName, reason: "Internal/legacy alias; its presence or mapping is not official CEAC question proof." })),
  catalogFacts: {
    securityQuestionCount: securityQuestionIds.length,
    securityQuestionIds,
    nationalityGateCount: raw.nationalityGates.length,
    estaPositiveCount: estaPositiveCodes.length,
    estaPositiveCodes,
  },
  findings: groups,
  fieldCoverage: {
    manifestFieldCount: manifest.fields.length,
    aggregateCoveredFieldCount: coveredFields.length,
    compatibilityOnlyFieldCount: compatibilityOnly.size,
    aggregateCoveredFields: coveredFields,
    uncoveredManifestFields: manifest.fields.map(field => field.fieldName).filter(fieldName => !compatibilityOnly.has(fieldName) && !coveredFields.includes(fieldName)).sort(),
  },
  observationCoverage: {
    rawObservationCount: allStates.length,
    indexedObservationCount: indexedStates.size,
    unindexedObservationCount: allStates.filter(state => !indexedStates.has(state)).length,
    unindexedStates: allStates.filter(state => !indexedStates.has(state)),
  },
  repeatContractBoundary: {
    structureNotApplicable: [
      { group: "visa_refused", reason: "Single conditional explanation; no official Add/Remove repeat control." },
      { group: "immigrant_petition", reason: "Single conditional explanation; no official Add/Remove repeat control." },
    ],
    rowOperations: "Only groups with actual Add/Remove observation states may be counted as row operations; the two singleton groups above remain structural N/A.",
  },
};
fs.writeFileSync(`${docs}/ds160-live-evidence-index-2026-09-21.json`, `${JSON.stringify(index, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ rawSha256: sha256, findings: groups.length, rawObservations: allStates.length, indexedObservations: indexedStates.size, unindexedObservations: allStates.length - indexedStates.size, manifestFields: manifest.fields.length, aggregateCoveredFields: coveredFields.length, compatibilityOnlyFields: compatibilityOnly.size, uncoveredManifestFields: index.fieldCoverage.uncoveredManifestFields }, null, 2));
