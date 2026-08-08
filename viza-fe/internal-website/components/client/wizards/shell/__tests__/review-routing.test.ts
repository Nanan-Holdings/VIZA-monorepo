import { describe, expect, test } from "vitest";
import { aeConfig } from "../../ae/config";
import { auConfig } from "../../au/config";
import { caConfig } from "../../ca/config";
import { egConfig } from "../../eg/config";
import { idConfig } from "../../id/config";
import { inConfig } from "../../in/config";
import { jpConfig } from "../../jp/config";
import { myConfig } from "../../my/config";
import { saConfig } from "../../sa/config";
import { schengenConfig } from "../../schengen/config";
import { thConfig } from "../../th/config";
import { trConfig } from "../../tr/config";
import { twConfig } from "../../tw/config";
import { ukConfig } from "../../uk/config";
import { usConfig } from "../../us/config";
import { vnConfig } from "../../vn/config";
import type { WizardConfig } from "../types";

function reviewRoutingSnapshot<TForm>(config: WizardConfig<TForm>) {
  const stepKeys = new Set(config.steps.map((step) => step.key));
  const reviewSections = config.reviewSections(config.emptyForm());
  return {
    visaType: config.visaType,
    reviewSectionCount: reviewSections.length,
    missingEditTargets: reviewSections
      .map((section) => section.editStepKey)
      .filter((stepKey): stepKey is string => Boolean(stepKey) && !stepKeys.has(stepKey!)),
  };
}

const CONFIG_SNAPSHOTS = [
  reviewRoutingSnapshot(aeConfig),
  reviewRoutingSnapshot(auConfig),
  reviewRoutingSnapshot(caConfig),
  reviewRoutingSnapshot(egConfig),
  reviewRoutingSnapshot(idConfig),
  reviewRoutingSnapshot(inConfig),
  reviewRoutingSnapshot(jpConfig),
  reviewRoutingSnapshot(myConfig),
  reviewRoutingSnapshot(saConfig),
  reviewRoutingSnapshot(schengenConfig),
  reviewRoutingSnapshot(thConfig),
  reviewRoutingSnapshot(trConfig),
  reviewRoutingSnapshot(twConfig),
  reviewRoutingSnapshot(ukConfig),
  reviewRoutingSnapshot(usConfig),
  reviewRoutingSnapshot(vnConfig),
];

describe("country wizard review routing", () => {
  test("every country wizard has a review page and valid Edit destinations", () => {
    expect(CONFIG_SNAPSHOTS).toHaveLength(16);
    for (const snapshot of CONFIG_SNAPSHOTS) {
      expect(snapshot.reviewSectionCount, `${snapshot.visaType} has no review sections`).toBeGreaterThan(0);
      expect(snapshot.missingEditTargets, `${snapshot.visaType} has invalid review Edit targets`).toEqual([]);
    }
  });
});
