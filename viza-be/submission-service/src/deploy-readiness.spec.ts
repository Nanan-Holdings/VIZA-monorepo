import assert from "node:assert/strict";
import test from "node:test";

import { evaluateDeploymentReadiness } from "./deploy-readiness.js";

test("deployment is safe only when no protected work is active", () => {
  assert.equal(
    evaluateDeploymentReadiness({
      workerBusy: false,
      oneTimeCardSessionsPresent: false,
      protectedBrowserSessionsPresent: false,
    }).safeToDeploy,
    true,
  );

  for (const busyField of [
    "workerBusy",
    "oneTimeCardSessionsPresent",
    "protectedBrowserSessionsPresent",
  ] as const) {
    const input = {
      workerBusy: false,
      oneTimeCardSessionsPresent: false,
      protectedBrowserSessionsPresent: false,
    };
    input[busyField] = true;
    assert.equal(evaluateDeploymentReadiness(input).safeToDeploy, false);
  }
});
