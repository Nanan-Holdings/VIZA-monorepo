import assert from "node:assert/strict";
import test from "node:test";

import { runKoreaKvacDryRun } from "../runner";

test("Korea KVAC dry-run observes slots but does not book without selected slot", async () => {
  const result = await runKoreaKvacDryRun({
    applicationId: "app-1",
    jobId: "job-1",
    selectedSlotId: null,
    centerCode: "shanghai",
  });

  assert.equal(result.status, "appointment_slots_observed");
  assert.ok(result.slots.length > 0);
});

test("Korea KVAC dry-run confirms the selected slot", async () => {
  const result = await runKoreaKvacDryRun({
    applicationId: "app-1",
    jobId: "job-1",
    selectedSlotId: "dryrun-shanghai-1",
    centerCode: "shanghai",
  });

  assert.equal(result.status, "appointment_booked");
  assert.equal(result.confirmationNumber, "KR-DRYRUN-SHANGHAI-1");
});
