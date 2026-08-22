import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPhEtravelArrivalRunnerJobPayload,
  classifyPhEtravelRunnerJobPortalCheckpoint,
  runPhEtravelArrivalRunnerJob,
  type PhEtravelRunnerJobState,
} from "../runner-job.js";
import { PH_ETRAVEL_FINAL_SUBMIT_ENABLED } from "../final-submit-gate.js";
import {
  buildPhEtravelFieldPlan,
  isPhEtravelConfirmationText,
  isPhEtravelReviewSummaryText,
} from "../form-filler.js";
import { normalizePhEtravelPortalPayload } from "../normalize.js";
import { gatePhEtravelAuthoritativeResult } from "../result-evidence.js";
import type { CanonicalRecord } from "../../queue/answers.js";

const applicationId = "app-runner-job-test";
const jobId = "job-runner-job-test";

function answers(overrides: CanonicalRecord = {}): CanonicalRecord {
  return {
    transport_type: "AIR",
    flight_arrival_date: "2026-08-15",
    flight_departure_date: "2026-08-14",
    travel_type: "ARRIVAL",
    registration_for: "FOR_ME",
    traveller_type: "AIRCRAFT PASSENGER",
    ...overrides,
  };
}

function state(overrides: Partial<PhEtravelRunnerJobState> = {}): PhEtravelRunnerJobState {
  return {
    applicationStatus: "processing",
    submissionResultStatus: "processing",
    submissionResult: null,
    activeJobIds: [],
    ...overrides,
  };
}

function ordinaryPassengerAnswers(overrides: CanonicalRecord = {}): CanonicalRecord {
  return {
    registration_for: "FOR_ME",
    travel_type: "ARRIVAL",
    transport_type: "AIR",
    passport_holder_type: "FOREIGNER",
    traveller_type: "AIRCRAFT PASSENGER",
    first_name: "SYNTHETIC",
    middle_name: "TEST",
    last_name: "USER",
    date_of_birth: "1990-01-01",
    sex: "FEMALE",
    nationality: "CN",
    country_of_birth: "CN",
    country_of_residence: "CN",
    residence_address_line1: "Synthetic residence",
    occupation: "OCC007",
    passport_number: "X12345678",
    passport_issue_date: "2020-01-01",
    passport_expiry_date: "2030-12-31",
    passport_issuing_authority: "CN",
    email_address: "synthetic@example.test",
    mobile_country_code: "+86",
    mobile_number: "13800138000",
    purpose_of_travel: "POV001",
    airline_name: "TC002",
    flight_number: "PR101",
    airport_of_origin: "SIN",
    origin_country: "SG",
    flight_departure_date: "2026-08-15",
    flight_arrival_date: "2026-08-15",
    port_of_entry: "TP1000",
    destination_port_code: "TP1000",
    destination_type: "HOTEL",
    destination_hotel_address: "Synthetic hotel address",
    has_recent_travel_history_30d: "no",
    has_exposure_to_sick_person_30d: "no",
    has_been_sick_30d: "no",
    accompanied_under_18_count: "0",
    accompanied_18_plus_count: "0",
    first_time_visiting_philippines: "no",
    checked_baggage_count: "1",
    handcarry_baggage_count: "1",
    customs_information_acknowledgement: "yes",
    has_baggage_or_currency_to_declare: "no",
    customs_checklist_1: "no",
    customs_checklist_2: "no",
    customs_checklist_3: "no",
    customs_checklist_4: "no",
    customs_checklist_5: "no",
    customs_checklist_6: "no",
    customs_checklist_7: "no",
    customs_checklist_8: "no",
    customs_checklist_9: "no",
    customs_checklist_10: "no",
    customs_checklist_11: "no",
    customs_checklist_12: "no",
    customs_signature_declaration: "yes",
    final_declaration: "yes",
    ...overrides,
  };
}

function completeStoredResult(): Record<string, unknown> {
  return {
    country: "PH",
    provider: "philippines_etravel_live",
    status: "submitted",
    submitted: true,
    resultEvidence: {
      authoritativeRead: {
        source: "official_registration_result_read",
        postSubmitRead: true,
        referenceNumber: "REF-RUNNER-001",
        stableReference: true,
      },
      qrRender: {
        renderer: "official_client_reference_qr",
        renderedForReference: "REF-RUNNER-001",
        rendered: true,
        referenceValueValidated: true,
      },
    },
    artifacts: { screenshots: [], pdfs: [] },
  };
}

test("PH runner_job preserves AIR/SEA 72-hour dates and starts no external work", async () => {
  let portalCalls = 0;
  const scheduled = await runPhEtravelArrivalRunnerJob(applicationId, jobId, {
    loadAnswers: async () => answers(),
    loadState: async () => state(),
    portalRunner: async () => {
      portalCalls += 1;
      throw new Error("must not run");
    },
    now: new Date("2026-08-10T00:00:00Z"),
  });
  assert.equal(scheduled.stage, "scheduled");
  assert.equal(scheduled.safeReasonCode, "ph_etravel_runner_window_scheduled");
  assert.equal(portalCalls, 0);
  assert.deepEqual(
    [scheduled.accountPreparation, scheduled.browser, scheduled.queue, scheduled.officialResubmitAllowed],
    ["not_started", "not_started", "not_started", false],
  );

  const seaPayload = buildPhEtravelArrivalRunnerJobPayload(applicationId, jobId, answers({
    transport_type: "SEA",
    voyage_arrival_date: "2026-08-15",
    voyage_departure_date: "2026-08-14",
    flight_arrival_date: "2020-01-01",
    flight_departure_date: "2020-01-01",
  }));
  assert.equal(seaPayload.trip.arrivalDate, "2026-08-15");
  assert.equal(seaPayload.trip.departureDate, "2026-08-14");
});

test("PH runner_job blocks active duplicates and P0 preflight before account, OTP, Turnstile, or browser", async () => {
  let portalCalls = 0;
  const duplicate = await runPhEtravelArrivalRunnerJob(applicationId, jobId, {
    loadAnswers: async () => answers(),
    loadState: async () => state({ activeJobIds: ["other-active-job"] }),
    portalRunner: async () => {
      portalCalls += 1;
      throw new Error("must not run");
    },
    now: new Date("2026-08-13T00:00:00Z"),
  });
  assert.equal(duplicate.stage, "active_job_guard");
  assert.equal(duplicate.safeReasonCode, "ph_etravel_runner_active_job_exists");

  const preflight = await runPhEtravelArrivalRunnerJob(applicationId, jobId, {
    loadAnswers: async () => answers({ email_address: "synthetic@example.test", passport_number: "P12345678" }),
    loadState: async () => state(),
    portalRunner: async () => {
      portalCalls += 1;
      throw new Error("must not run");
    },
    now: new Date("2026-08-13T00:00:00Z"),
  });
  assert.equal(preflight.stage, "preflight_action_required");
  assert.equal(portalCalls, 0);
  assert.doesNotMatch(JSON.stringify(preflight), /synthetic@example\.test|P12345678/);
});

test("PH AIR and SEA synthetic answers normalize to field plans and Review stop offline", () => {
  const reviewSummary = "New Travel Declaration Summary Kindly double check the information before submitting. For Customs - General Declaration Previous Submit";
  const fixtures: Array<["AIR" | "SEA", CanonicalRecord, {
    transportNumberKey: string;
    travelCompanyKey: string;
    travelCompanyPortalName: string;
    transportNumberPortalName: string;
  }]> = [
    ["AIR", ordinaryPassengerAnswers(), {
      transportNumberKey: "flight_number",
      travelCompanyKey: "airline",
      travelCompanyPortalName: "travel_company_code",
      transportNumberPortalName: "flight_number",
    }],
    ["SEA", ordinaryPassengerAnswers({
      transport_type: "SEA",
      passport_holder_type: "FILIPINO",
      traveller_type: "VESSEL_PASSENGER",
      nationality: "PH",
      country_of_birth: "PH",
      country_of_residence: "PH",
      passport_issuing_authority: "PH",
      airline_name: "",
      vessel_name: "Synthetic Vessel",
      flight_number: "",
      voyage_number: "VOY-SYN-001",
      flight_departure_date: "2020-01-01",
      flight_arrival_date: "2020-01-01",
      voyage_departure_date: "2026-08-15",
      voyage_arrival_date: "2026-08-15",
      airport_of_origin: "",
      origin_port: "SGSIN",
      port_of_entry: "TP0103",
      destination_port_code: "TP0103",
      is_disembarking: "yes",
      destination_type: "TRAVEL_PORT",
      disembarking_port_code: "TP2000",
      destination_hotel_address: "",
    }), {
      transportNumberKey: "voyage_number",
      travelCompanyKey: "vessel_name",
      travelCompanyPortalName: "vessel_name",
      transportNumberPortalName: "flight_number",
    }],
  ];

  for (const [transport, fixture, expected] of fixtures) {
    const submission = buildPhEtravelArrivalRunnerJobPayload(applicationId, `${jobId}-${transport.toLowerCase()}`, fixture);
    const normalized = normalizePhEtravelPortalPayload(submission, { now: new Date("2026-08-13T00:00:00Z") });
    const plan = buildPhEtravelFieldPlan(normalized);
    const byKey = new Map(plan.map((item) => [item.key, item]));
    const transportNumber = byKey.get(expected.transportNumberKey);

    assert.equal(normalized.travelType, "ARRIVAL");
    assert.equal(normalized.transportType, transport);
    assert.equal(normalized.arrivalBranch?.transportType, transport);
    assert.equal(byKey.get("purpose")?.portalName, "purpose_of_visit_code");
    assert.equal(byKey.get(expected.travelCompanyKey)?.portalName, expected.travelCompanyPortalName);
    assert.equal(byKey.get("port_of_entry")?.portalName, "destination_port_code");
    assert.equal(transportNumber?.portalName, expected.transportNumberPortalName);
    assert.equal(transportNumber?.value, transport === "AIR" ? "PR101" : "VOY-SYN-001");
    assert.equal(byKey.get("health_recent_travel")?.value, "No");
    assert.equal(byKey.get("health_exposure")?.value, "No");
    assert.equal(byKey.get("health_sick")?.value, "No");
    if (transport === "SEA") {
      assert.equal(normalized.portOfEntry, "TP0103");
      assert.equal(normalized.destinationPort, "TP2000");
      assert.equal(byKey.get("disembarking_port")?.portalName, "disembarking_port_code");
    }
  }

  assert.equal(isPhEtravelReviewSummaryText(reviewSummary), true);
  assert.equal(isPhEtravelConfirmationText(reviewSummary), false);
  assert.equal(PH_ETRAVEL_FINAL_SUBMIT_ENABLED, false);

  const reviewOnlyGate = gatePhEtravelAuthoritativeResult({ finalPostObservation: "http_200_navigation" });
  assert.equal(reviewOnlyGate.status, "recovery_required");
  if (reviewOnlyGate.status === "recovery_required") {
    assert.equal(reviewOnlyGate.officialResubmitAllowed, false);
  }
});

test("PH final success gate requires authoritative registration read and matching reference QR", () => {
  const http200Only = gatePhEtravelAuthoritativeResult({ finalPostObservation: "http_200_navigation" });
  assert.equal(http200Only.status, "recovery_required");

  const qrWithoutAuthoritativeReference = gatePhEtravelAuthoritativeResult({
    qrRender: {
      renderer: "official_client_reference_qr",
      renderedForReference: "LOCAL-REF-001",
      rendered: true,
      referenceValueValidated: true,
    },
  });
  assert.equal(qrWithoutAuthoritativeReference.status, "recovery_required");

  const mismatchedQr = gatePhEtravelAuthoritativeResult({
    authoritativeRead: {
      source: "official_registration_result_read",
      postSubmitRead: true,
      referenceNumber: "REF-OK-001",
      stableReference: true,
    },
    qrRender: {
      renderer: "official_client_reference_qr",
      renderedForReference: "REF-WRONG-001",
      rendered: true,
      referenceValueValidated: true,
    },
  });
  assert.equal(mismatchedQr.status, "recovery_required");

  const complete = gatePhEtravelAuthoritativeResult({
    authoritativeRead: {
      source: "official_registration_result_read",
      postSubmitRead: true,
      referenceNumber: "REF-OK-001",
      stableReference: true,
    },
    qrRender: {
      renderer: "official_client_reference_qr",
      renderedForReference: "REF-OK-001",
      rendered: true,
      referenceValueValidated: true,
    },
  });
  assert.equal(complete.status, "recoverable_submitted_candidate");
});

test("PH canonical AIR and SEA runner paths fail closed before external actions", async () => {
  let portalCalls = 0;
  const fixtures: Array<["AIR" | "SEA", CanonicalRecord]> = [
    ["AIR", ordinaryPassengerAnswers()],
    ["SEA", ordinaryPassengerAnswers({
      transport_type: "SEA",
      passport_holder_type: "FILIPINO",
      traveller_type: "VESSEL_PASSENGER",
      nationality: "PH",
      country_of_birth: "PH",
      country_of_residence: "PH",
      passport_issuing_authority: "PH",
      airline_name: "",
      vessel_name: "Synthetic Vessel",
      flight_number: "",
      voyage_number: "VOY-SYN-001",
      flight_departure_date: "2020-01-01",
      flight_arrival_date: "2020-01-01",
      voyage_departure_date: "2026-08-15",
      voyage_arrival_date: "2026-08-15",
      airport_of_origin: "",
      origin_port: "SGSIN",
      port_of_entry: "TP0103",
      destination_port_code: "TP0103",
      is_disembarking: "yes",
      destination_type: "TRAVEL_PORT",
      disembarking_port_code: "TP2000",
      destination_hotel_address: "",
    })],
  ];

  for (const [transport, fixture] of fixtures) {
    const result = await runPhEtravelArrivalRunnerJob(applicationId, `${jobId}-${transport.toLowerCase()}`, {
      loadAnswers: async () => fixture,
      loadState: async () => state(),
      allowBrowser: true,
      portalRunner: async () => {
        portalCalls += 1;
        throw new Error("must not run before preflight closes");
      },
      now: new Date("2026-08-13T00:00:00Z"),
    });
    assert.equal(result.stage, "preflight_action_required");
    assert.equal(result.officialResubmitAllowed, false);
    assert.equal(result.queue, "not_started");
    assert.equal(result.browser, "not_started");
    assert.equal(result.accountPreparation, "not_started");
    assert.doesNotMatch(JSON.stringify(result), /synthetic@example\.test|X12345678/);
  }

  assert.equal(portalCalls, 0);
});

test("PH runner_job syncs only stored authoritative reference-derived QR evidence", async () => {
  const calls: unknown[] = [];
  const result = await runPhEtravelArrivalRunnerJob(applicationId, jobId, {
    loadState: async () => state({ submissionResult: completeStoredResult() }),
    syncAdapter: {
      sync: async (input) => {
        calls.push(input);
        return {
          outcome: "synchronized",
          idempotentReplay: false,
          safeReasonCode: "phetravel_result_consistency_sync_failed",
          officialResubmitAllowed: false,
        };
      },
    },
  });
  assert.equal(result.stage, "submitted_state_synchronized");
  assert.equal(calls.length, 1);
  assert.equal((calls[0] as { targetStatus: string }).targetStatus, "submitted");
  assert.equal(result.officialResubmitAllowed, false);
});

test("PH runner_job treats reference-only, QR mismatch, RPC failure, restart, and ambiguous POST as recovery only", async () => {
  let portalCalls = 0;
  const referenceOnly = {
    country: "PH",
    provider: "philippines_etravel_live",
    status: "submitted",
    submitted: true,
    referenceNumber: "REF-ONLY-001",
  };
  const missingReader = await runPhEtravelArrivalRunnerJob(applicationId, jobId, {
    loadState: async () => state({ submissionResult: referenceOnly }),
    portalRunner: async () => {
      portalCalls += 1;
      throw new Error("must not run");
    },
  });
  assert.equal(missingReader.stage, "result_recovery_required");
  assert.equal(portalCalls, 0);

  const mismatch = await runPhEtravelArrivalRunnerJob(applicationId, jobId, {
    loadState: async () => state({ submissionResult: {
      ...referenceOnly,
      errorDetails: { code: "ph_etravel_final_post_ambiguous_recovery_required" },
    } }),
    authoritativeReader: {
      read: async () => ({
        source: "official_registration_result_read",
        postSubmitRead: true,
        stableReference: true,
        referenceNumber: "REF-RECOVERY-001",
      }),
    },
    qrRenderer: {
      render: async () => ({
        renderer: "official_client_reference_qr",
        rendered: true,
        referenceValueValidated: true,
        renderedForReference: "WRONG-REFERENCE",
      }),
    },
  });
  assert.equal(mismatch.stage, "result_recovery_required");

  const rpcUnavailable = await runPhEtravelArrivalRunnerJob(applicationId, jobId, {
    loadState: async () => state({ submissionResult: completeStoredResult() }),
    syncAdapter: {
      sync: async () => ({
        outcome: "recovery_required",
        safeReasonCode: "phetravel_submission_state_sync_rpc_unavailable",
        officialResubmitAllowed: false,
      }),
    },
  });
  const restarted = await runPhEtravelArrivalRunnerJob(applicationId, jobId, {
    loadState: async () => state({ submissionResult: completeStoredResult() }),
    syncAdapter: {
      sync: async () => ({
        outcome: "recovery_required",
        safeReasonCode: "phetravel_submission_state_sync_rpc_unavailable",
        officialResubmitAllowed: false,
      }),
    },
  });
  assert.deepEqual(restarted, rpcUnavailable);
  assert.equal(rpcUnavailable.stage, "result_recovery_required");
  assert.equal(portalCalls, 0);
});

test("PH runner_job exposes OTP and Turnstile checkpoints as safe non-submitted states", () => {
  const otp = classifyPhEtravelRunnerJobPortalCheckpoint("ph_etravel_official_login_verification_required");
  const turnstile = classifyPhEtravelRunnerJobPortalCheckpoint("ph_etravel_registration_turnstile_blocked");
  const unsafe = classifyPhEtravelRunnerJobPortalCheckpoint("email=synthetic@example.test otp=123456");
  for (const result of [otp, turnstile, unsafe]) {
    assert.equal(result.stage, "account_or_portal_action_required");
    assert.equal(result.officialResubmitAllowed, false);
  }
  assert.equal(otp.safeReasonCode, "ph_etravel_official_login_verification_required");
  assert.equal(turnstile.safeReasonCode, "ph_etravel_registration_turnstile_blocked");
  assert.equal(unsafe.safeReasonCode, "ph_etravel_safe_failure");
  assert.doesNotMatch(JSON.stringify(unsafe), /synthetic@example\.test|123456/);
});
