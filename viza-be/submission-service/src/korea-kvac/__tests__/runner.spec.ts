import assert from "node:assert/strict";
import test from "node:test";

import { runKoreaKvacDryRun, runKoreaKvacLive } from "../runner";

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

test("Korea KVAC live runner is explicitly gated by environment", async () => {
  const previous = process.env.KR_KVAC_APPOINTMENT_ASSISTED_LIVE_ENABLED;
  delete process.env.KR_KVAC_APPOINTMENT_ASSISTED_LIVE_ENABLED;
  try {
    const result = await runKoreaKvacLive({
      applicationId: "app-1",
      jobId: "job-1",
      selectedSlotId: "slot-1",
      centerCode: "shanghai",
    });

    assert.equal(result.status, "manual_required");
    assert.equal(result.manualActionType, "site_policy_review");
  } finally {
    if (previous === undefined) delete process.env.KR_KVAC_APPOINTMENT_ASSISTED_LIVE_ENABLED;
    else process.env.KR_KVAC_APPOINTMENT_ASSISTED_LIVE_ENABLED = previous;
  }
});

test("Korea KVAC live runner requires selected slot before booking", async () => {
  const previous = process.env.KR_KVAC_APPOINTMENT_ASSISTED_LIVE_ENABLED;
  process.env.KR_KVAC_APPOINTMENT_ASSISTED_LIVE_ENABLED = "true";
  try {
    const result = await runKoreaKvacLive({
      applicationId: "app-1",
      jobId: "job-1",
      selectedSlotId: null,
      centerCode: "shanghai",
    });

    assert.equal(result.status, "manual_required");
    assert.equal(result.manualActionType, "appointment_slot_selection_required");
  } finally {
    if (previous === undefined) delete process.env.KR_KVAC_APPOINTMENT_ASSISTED_LIVE_ENABLED;
    else process.env.KR_KVAC_APPOINTMENT_ASSISTED_LIVE_ENABLED = previous;
  }
});

test("Korea KVAC live runner exposes SMS verification checkpoint", async () => {
  const previous = process.env.KR_KVAC_APPOINTMENT_ASSISTED_LIVE_ENABLED;
  process.env.KR_KVAC_APPOINTMENT_ASSISTED_LIVE_ENABLED = "true";
  try {
    const result = await runKoreaKvacLive({
      applicationId: "app-1",
      jobId: "job-1",
      selectedSlotId: "slot-1",
      centerCode: "shanghai",
    });

    assert.equal(result.status, "manual_required");
    assert.equal(result.manualActionType, "sms_verification_required");
    assert.ok(result.expiresAt);
    assert.deepEqual(result.userInputSchema?.required, ["smsCode"]);
  } finally {
    if (previous === undefined) delete process.env.KR_KVAC_APPOINTMENT_ASSISTED_LIVE_ENABLED;
    else process.env.KR_KVAC_APPOINTMENT_ASSISTED_LIVE_ENABLED = previous;
  }
});
