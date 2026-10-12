import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  buildDs160OfficialEvidenceManifest,
  type Ds160OfficialEvidenceRecord,
} from "../ds160-coverage-audit";
import { readDs160SeedFields } from "../ds160-parity";
import { DS160_REPEAT_GROUP_CONTRACT_LIST } from "../ds160-repeat-contract";

const SEED_FILE = path.resolve(
  __dirname,
  "../../../agent-backend/scripts/seed-ds160-form-fields.ts",
);

function seedFields() {
  return readDs160SeedFields(readFileSync(SEED_FILE, "utf8"));
}

const liveMatch: Ds160OfficialEvidenceRecord = {
  sourceKind: "current_live_dom",
  sourceUrl: "https://ceac.state.gov/genniv/",
  observedOn: "2026-09-21",
  expected: "visible",
  actual: "visible",
  comparison: "match",
};

describe("DS-160 official evidence manifest", () => {
  it("enumerates every current field, branch, and repeat group and fails closed", () => {
    const fields = seedFields();
    const branchCount = new Set(fields.flatMap((field) => field.showIf ? [field.showIf] : [])).size;
    const repeatGroupCount = DS160_REPEAT_GROUP_CONTRACT_LIST.length;
    const evidenceSlotCount = fields.length + branchCount * 2 + repeatGroupCount * 2;
    const manifest = buildDs160OfficialEvidenceManifest(fields, {}, "2026-09-21T00:00:00.000Z");

    assert.equal(manifest.scope, "ds160_b1_b2_current_seed_and_repeat_contract");
    assert.equal(manifest.fields.length, fields.length);
    assert.equal(manifest.branches.length, branchCount);
    assert.equal(manifest.repeatGroups.length, repeatGroupCount);
    assert.equal(manifest.counts.evidenceSlots.total, evidenceSlotCount);
    assert.equal(manifest.counts.evidenceSlots.missingEvidence, evidenceSlotCount);
    assert.equal(manifest.officialParityVerified, false);
    assert.deepEqual(manifest.scopeReviewMissing, ["scope_review_complete"]);
    assert.ok(manifest.fields.every(field => !field.evidence.liveDomObserved));
    assert.ok(manifest.branches.every(branch => branch.contractComparison === null));
    assert.ok(manifest.repeatGroups.every(group => group.contractComparison === null));
    assert.equal(
      manifest.repeatGroups.filter(group => group.structure === "structure_not_applicable").length,
      2,
    );
    assert.equal(manifest.counts.evidenceSlots.structureNotApplicable, 4);
    assert.equal(manifest.missingEvidence.length, evidenceSlotCount);
  });

  it("tracks current live DOM observation separately from contract comparison", () => {
    const fields = seedFields();
    const expression = fields.find(field => field.showIf)?.showIf;
    assert.ok(expression);

    const manifest = buildDs160OfficialEvidenceManifest(fields, {
      fields: { surname: [liveMatch] },
      branches: { [expression]: { positive: [liveMatch], negative: [liveMatch] } },
      repeats: {
        other_nationality: { rowAdded: [liveMatch], rowDeleted: [liveMatch] },
      },
    });

    assert.equal(manifest.counts.fields.liveDomObserved, 1);
    assert.equal(manifest.counts.branches.fullyLiveDomObserved, 1);
    assert.equal(manifest.counts.repeatGroups.fullyLiveDomObserved, 1);
    assert.equal(manifest.fields.find(field => field.fieldName === "surname")?.evidence.liveDomObserved, true);
    assert.equal(manifest.fields.find(field => field.fieldName === "surname")?.evidence.contractComparison, "match");
    assert.equal(manifest.branches.find(branch => branch.expression === expression)?.contractComparison, "match");
    assert.equal(manifest.repeatGroups.find(group => group.group === "other_nationality")?.contractComparison, "match");
    assert.equal(manifest.officialParityVerified, false);
  });

  it("keeps published documents and incomplete observations distinct from live proof", () => {
    const published: Ds160OfficialEvidenceRecord = {
      ...liveMatch,
      sourceKind: "official_published",
    };
    const incomplete: Ds160OfficialEvidenceRecord = {
      ...liveMatch,
      actual: null,
    };
    const manifest = buildDs160OfficialEvidenceManifest(seedFields(), {
      fields: { surname: [published], given_names: [incomplete] },
    });

    const surname = manifest.fields.find(field => field.fieldName === "surname")!;
    const givenNames = manifest.fields.find(field => field.fieldName === "given_names")!;
    assert.equal(surname.evidence.publishedEvidence, true);
    assert.equal(surname.evidence.liveDomObserved, false);
    assert.equal(surname.evidence.contractComparison, "match");
    assert.equal(givenNames.evidence.liveDomObserved, false);
    assert.ok(givenNames.evidence.missingEvidence.includes("actual"));
    assert.ok(givenNames.evidence.missingEvidence.includes("current_live_dom_match"));
    assert.equal(manifest.officialParityVerified, false);
  });

  it("does not let a live mismatch be masked by another matching observation", () => {
    const mismatch: Ds160OfficialEvidenceRecord = {
      ...liveMatch,
      comparison: "mismatch",
      actual: "hidden",
    };
    const manifest = buildDs160OfficialEvidenceManifest(seedFields(), {
      fields: { surname: [liveMatch, mismatch] },
    });
    const surname = manifest.fields.find(field => field.fieldName === "surname")!;
    assert.equal(surname.evidence.liveDomObserved, false);
    assert.equal(surname.evidence.contractComparison, "mismatch");
    assert.ok(surname.evidence.missingEvidence.includes("no_mismatch"));
  });

  it("prefers a later live match over an earlier not-observed record", () => {
    const notObserved: Ds160OfficialEvidenceRecord = {
      ...liveMatch,
      comparison: "not_observed",
    };
    const manifest = buildDs160OfficialEvidenceManifest(seedFields(), {
      fields: { surname: [notObserved, liveMatch] },
    });
    const surname = manifest.fields.find(field => field.fieldName === "surname")!;
    assert.equal(surname.evidence.liveDomObserved, true);
    assert.equal(surname.evidence.contractComparison, "match");
  });

  it("keeps official controls discovered outside the seed as explicit scope gaps", () => {
    const manifest = buildDs160OfficialEvidenceManifest(seedFields(), {
      scopeReviewComplete: true,
      scopeGaps: [{
        key: "official_age_gate",
        category: "branch",
        description: "Official live page exposes an age-dependent control not represented in the seed.",
      }],
    });
    assert.equal(manifest.scopeReviewComplete, true);
    assert.equal(manifest.counts.scopeGaps.total, 1);
    assert.equal(manifest.counts.scopeGaps.missingEvidence, 1);
    assert.equal(manifest.counts.evidenceSlots.total, evidenceSlotCountFor(seedFields()) + 1);
    assert.equal(manifest.officialParityVerified, false);
    assert.ok(manifest.missingEvidence.some(item => item.kind === "scope_gap" && item.key === "official_age_gate"));
  });

  it("records singleton explanation structure without counting Add/Remove", () => {
    const manifest = buildDs160OfficialEvidenceManifest(seedFields(), {
      repeats: {
        visa_refused: { rowAdded: [liveMatch], rowDeleted: [liveMatch] },
        immigrant_petition: { rowAdded: [liveMatch], rowDeleted: [liveMatch] },
      },
    });

    const visaRefused = manifest.repeatGroups.find(group => group.group === "visa_refused")!;
    assert.equal(visaRefused.structure, "structure_not_applicable");
    assert.equal(visaRefused.contractComparison, "structure_not_applicable");
    assert.equal(visaRefused.rowAdded.contractComparison, "structure_not_applicable");
    assert.equal(visaRefused.rowDeleted.contractComparison, "structure_not_applicable");
    assert.equal(visaRefused.rowAdded.liveDomObserved, false);
    assert.equal(visaRefused.rowDeleted.liveDomObserved, false);
    assert.equal(manifest.counts.repeatGroups.structureNotApplicable, 2);
    assert.equal(manifest.counts.repeatGroups.rowAddedLiveDomObserved, 0);
    assert.equal(manifest.counts.repeatGroups.rowDeletedLiveDomObserved, 0);
    assert.equal(manifest.counts.repeatGroups.fullyLiveDomObserved, 0);
    assert.equal(visaRefused.missingEvidence.length, 0);
  });
});

function evidenceSlotCountFor(fields: ReturnType<typeof seedFields>): number {
  const branchCount = new Set(fields.flatMap((field) => field.showIf ? [field.showIf] : [])).size;
  return fields.length + branchCount * 2 + DS160_REPEAT_GROUP_CONTRACT_LIST.length * 2;
}
