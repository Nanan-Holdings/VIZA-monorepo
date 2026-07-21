import { describe, expect, it } from "vitest";
import {
  isDs160VisaType,
  isDigitalArrivalCardApplication,
  isIndonesiaEVisaApplication,
  isMalaysiaMdacApplication,
  isSgArrivalCardApplication,
  isThailandTdacApplication,
  RETRY_SUPERSEDABLE_SUBMISSION_QUEUE_STATUSES,
  retryQueueInsertCanUseLegacyPayload,
  queueProviderForApplication,
  queueProviderForVisaType,
  submissionQueueRequiresServerEnqueue,
  queueStatusForApplication,
  queueStatusForVisaType,
  submitModeForPrimaryApplicationAction,
} from "@/lib/submission-queue";

describe("queueStatusForVisaType", () => {
  it("routes France Schengen forms to the France-Visas prefill worker", () => {
    expect(queueStatusForVisaType("EU_SCHENGEN_C_SHORT_STAY")).toBe("fv_prefill_pending");
    expect(queueStatusForVisaType("SCHENGEN_C")).toBe("fv_prefill_pending");
  });

  it("keeps other implemented automation providers scoped to their own queues", () => {
    expect(queueStatusForVisaType("DS160")).toBe("ds160_prefill_pending");
    expect(queueStatusForVisaType("UK_STANDARD_VISITOR")).toBe("uk_prefill_pending");
    expect(queueStatusForVisaType("VN_E_VISA")).toBe("vn_dry_run_pending");
    expect(queueStatusForVisaType("AU_VISITOR_600")).toBe("au_prefill_pending");
  });

  it("routes legacy Vietnam e-visa tourism packages by country without hijacking other countries", () => {
    expect(queueStatusForApplication("vietnam", "evisa_tourism")).toBe("vn_dry_run_pending");
    expect(queueStatusForApplication("Viet Nam", "tourist-e-visa")).toBe("vn_dry_run_pending");
    expect(queueStatusForApplication("VN", "evisa_tourism", "live_assisted")).toBe("vn_live_assisted_pending");
    expect(queueStatusForApplication("egypt", "evisa_tourism")).toBe("pending");
  });

  it("preserves mode-specific DS-160 live assisted routing", () => {
    expect(queueStatusForApplication("United States", "DS160", "live_assisted")).toBe(
      "ds160_live_assisted_pending",
    );
  });

  it("marks U.S. DS-160 submissions with the CEAC provider for each mode", () => {
    expect(isDs160VisaType("US-B1/B2")).toBe(true);
    expect(queueProviderForVisaType("DS160", "dry_run")).toBe("ceac_dry_run");
    expect(queueProviderForVisaType("DS160", "live_assisted")).toBe("ceac_live");
    expect(queueProviderForVisaType("UK_STANDARD_VISITOR", "live_assisted")).toBeNull();
  });

  it("marks France Schengen submissions with the France-Visas provider for each mode", () => {
    expect(queueStatusForApplication("france", "EU_SCHENGEN_C_SHORT_STAY", "live_assisted")).toBe(
      "france_live_assisted_pending",
    );
    expect(queueProviderForVisaType("EU_SCHENGEN_C_SHORT_STAY", "dry_run")).toBe("france_visas_dry_run");
    expect(queueProviderForVisaType("EU_SCHENGEN_C_SHORT_STAY", "live_assisted")).toBe("france_visas_live");
  });

  it("marks Vietnam e-visa submissions with the Vietnam provider only when country matches", () => {
    expect(queueProviderForApplication("vietnam", "evisa_tourism", "dry_run")).toBe("vietnam_evisa_dry_run");
    expect(queueProviderForApplication("vietnam", "evisa_tourism", "live_assisted")).toBe("vietnam_evisa_live");
    expect(queueProviderForApplication("egypt", "evisa_tourism", "live_assisted")).toBeNull();
  });

  it("requires server-side queue creation for Vietnam e-visa in both modes", () => {
    expect(submissionQueueRequiresServerEnqueue("vietnam", "evisa_tourism", "dry_run")).toBe(true);
    expect(submissionQueueRequiresServerEnqueue("vietnam", "evisa_tourism", "live_assisted")).toBe(true);
    expect(submissionQueueRequiresServerEnqueue("indonesia", "B211A", "dry_run")).toBe(true);
  });

  it("uses live official mode for the one-click Vietnam submit action", () => {
    expect(submitModeForPrimaryApplicationAction("vietnam", "evisa_tourism")).toBe("live_assisted");
    expect(submitModeForPrimaryApplicationAction("VN", "VN_E_VISA")).toBe("live_assisted");
    expect(submitModeForPrimaryApplicationAction("indonesia", "B211A")).toBe("live_assisted");
  });

  it("routes Indonesia C1 and B1 e-visa applications to separate live providers", () => {
    expect(isIndonesiaEVisaApplication("indonesia", "ID_C1_TOURIST")).toBe(true);
    expect(isIndonesiaEVisaApplication("ID", "ID_B1_EVOA")).toBe(true);
    expect(queueStatusForApplication("indonesia", "ID_C1_TOURIST", "live_assisted")).toBe(
      "id_c1_live_assisted_pending",
    );
    expect(queueStatusForApplication("indonesia", "ID_B1_EVOA", "live_assisted")).toBe(
      "id_b1_evoa_live_assisted_pending",
    );
    expect(queueProviderForApplication("indonesia", "ID_C1_TOURIST", "live_assisted")).toBe(
      "indonesia_c1_live",
    );
    expect(queueProviderForApplication("indonesia", "ID_B1_EVOA", "live_assisted")).toBe(
      "indonesia_b1_evoa_live",
    );
    expect(queueStatusForApplication("singapore", "ID_C1_TOURIST", "live_assisted")).not.toBe(
      "id_c1_live_assisted_pending",
    );
  });

  it("routes SG Arrival Card to its own queue and never to Singapore visitor visa", () => {
    expect(isSgArrivalCardApplication("singapore", "SG_ARRIVAL_CARD")).toBe(true);
    expect(isSgArrivalCardApplication("singapore", "SG_VISITOR_VISA")).toBe(false);
    expect(queueStatusForApplication("singapore", "SG_ARRIVAL_CARD", "dry_run")).toBe("sgac_dry_run_pending");
    expect(queueStatusForApplication("singapore", "SG_ARRIVAL_CARD", "live_assisted")).toBe("sgac_live_assisted_pending");
    expect(queueProviderForApplication("singapore", "SG_ARRIVAL_CARD", "dry_run")).toBe("sg_arrival_card_dry_run");
    expect(queueProviderForApplication("singapore", "SG_ARRIVAL_CARD", "live_assisted")).toBe("sg_arrival_card_live");
    expect(queueStatusForApplication("singapore", "SG_VISITOR_VISA", "live_assisted")).not.toBe("sgac_live_assisted_pending");
  });

  it("routes Malaysia MDAC and Thailand TDAC standalone arrival cards to live official runners", () => {
    expect(isMalaysiaMdacApplication("malaysia", "MY_MDAC_ARRIVAL_CARD")).toBe(true);
    expect(isThailandTdacApplication("thailand", "TH_TDAC_ARRIVAL_CARD")).toBe(true);
    expect(isDigitalArrivalCardApplication("MY", "MY_MDAC_ARRIVAL_CARD")).toBe(true);
    expect(isDigitalArrivalCardApplication("TH", "TH_TDAC_ARRIVAL_CARD")).toBe(true);

    expect(queueStatusForApplication("malaysia", "MY_MDAC_ARRIVAL_CARD", "live_assisted")).toBe(
      "mdac_live_assisted_pending",
    );
    expect(queueStatusForApplication("thailand", "TH_TDAC_ARRIVAL_CARD", "live_assisted")).toBe(
      "tdac_live_assisted_pending",
    );
    expect(queueProviderForApplication("malaysia", "MY_MDAC_ARRIVAL_CARD", "live_assisted")).toBe(
      "malaysia_mdac_live",
    );
    expect(queueProviderForApplication("thailand", "TH_TDAC_ARRIVAL_CARD", "live_assisted")).toBe(
      "thailand_tdac_live",
    );
    expect(submitModeForPrimaryApplicationAction("malaysia", "MY_MDAC_ARRIVAL_CARD")).toBe("live_assisted");
    expect(submitModeForPrimaryApplicationAction("thailand", "TH_TDAC_ARRIVAL_CARD")).toBe("live_assisted");
  });

  it("routes Philippines eTravel standalone arrival cards to live official runners", () => {
    expect(isDigitalArrivalCardApplication("philippines", "PH_ETRAVEL_ARRIVAL_CARD")).toBe(true);
    expect(queueStatusForApplication("philippines", "PH_ETRAVEL_ARRIVAL_CARD", "dry_run")).toBe(
      "phetravel_dry_run_pending",
    );
    expect(queueStatusForApplication("PH", "PH_ETRAVEL_ARRIVAL_CARD", "live_assisted")).toBe(
      "phetravel_live_assisted_pending",
    );
    expect(queueProviderForApplication("philippines", "PH_ETRAVEL_ARRIVAL_CARD", "dry_run")).toBe(
      "philippines_etravel_dry_run",
    );
    expect(queueProviderForApplication("philippines", "PH_ETRAVEL_ARRIVAL_CARD", "live_assisted")).toBe(
      "philippines_etravel_live",
    );
    expect(submitModeForPrimaryApplicationAction("philippines", "PH_ETRAVEL_ARRIVAL_CARD")).toBe("live_assisted");
    expect(isDigitalArrivalCardApplication("philippines", "PH_ETRAVEL_DEPARTURE_CARD")).toBe(true);
    expect(queueStatusForApplication("PH", "PH_ETRAVEL_DEPARTURE_CARD", "dry_run")).toBe("phetravel_dry_run_pending");
    expect(queueStatusForApplication("philippines", "PH_ETRAVEL_DEPARTURE_CARD", "live_assisted")).toBe("phetravel_live_assisted_pending");
    expect(queueProviderForApplication("philippines", "PH_ETRAVEL_DEPARTURE_CARD", "live_assisted")).toBe("philippines_etravel_live");
    expect(submitModeForPrimaryApplicationAction("philippines", "PH_ETRAVEL_DEPARTURE_CARD")).toBe("live_assisted");
    expect(queueStatusForApplication("philippines", "PH_TEMPORARY_VISITOR_VISA", "live_assisted")).not.toBe(
      "phetravel_live_assisted_pending",
    );
  });

  it("routes Vietnam Pre-Arrival declarations separately from Vietnam eVisa", () => {
    expect(isDigitalArrivalCardApplication("vietnam", "VN_PREARRIVAL_DECLARATION")).toBe(true);
    expect(queueStatusForApplication("vietnam", "VN_PREARRIVAL_DECLARATION", "dry_run")).toBe(
      "vn_prearrival_dry_run_pending",
    );
    expect(queueStatusForApplication("VN", "VN_PREARRIVAL_DECLARATION", "live_assisted")).toBe(
      "vn_prearrival_live_assisted_pending",
    );
    expect(queueProviderForApplication("vietnam", "VN_PREARRIVAL_DECLARATION", "dry_run")).toBe(
      "vietnam_prearrival_dry_run",
    );
    expect(queueProviderForApplication("vietnam", "VN_PREARRIVAL_DECLARATION", "live_assisted")).toBe(
      "vietnam_prearrival_live",
    );
    expect(submitModeForPrimaryApplicationAction("vietnam", "VN_PREARRIVAL_DECLARATION")).toBe("live_assisted");
    expect(queueProviderForApplication("vietnam", "VN_E_VISA", "live_assisted")).toBe("vietnam_evisa_live");
  });

  it("does not let retry supersede active processing arrival-card jobs", () => {
    expect(RETRY_SUPERSEDABLE_SUBMISSION_QUEUE_STATUSES).toContain("tdac_live_assisted_pending");
    expect(RETRY_SUPERSEDABLE_SUBMISSION_QUEUE_STATUSES).toContain("tdac_live_assisted_failed");
    expect(RETRY_SUPERSEDABLE_SUBMISSION_QUEUE_STATUSES).not.toContain("tdac_live_assisted_processing");
    expect(RETRY_SUPERSEDABLE_SUBMISSION_QUEUE_STATUSES).not.toContain("mdac_live_assisted_processing");
    expect(RETRY_SUPERSEDABLE_SUBMISSION_QUEUE_STATUSES).not.toContain("sgac_live_assisted_processing");
  });

  it("allows legacy queue inserts for live France and SGAC retry rows when Supabase cache lacks live columns", () => {
    const schemaCacheError = {
      code: "PGRST204",
      message: "Could not find the 'mode' column of 'submission_queue' in the schema cache",
    };

    expect(retryQueueInsertCanUseLegacyPayload(schemaCacheError, {
      mode: "live_assisted",
      queueStatus: "france_live_assisted_pending",
    })).toBe(true);
    expect(retryQueueInsertCanUseLegacyPayload(schemaCacheError, {
      mode: "live_assisted",
      queueStatus: "sgac_live_assisted_pending",
    })).toBe(true);
    expect(retryQueueInsertCanUseLegacyPayload(schemaCacheError, {
      mode: "live_assisted",
      queueStatus: "sgac_live_assisted_scheduled",
    })).toBe(true);
    expect(retryQueueInsertCanUseLegacyPayload(schemaCacheError, {
      mode: "live_assisted",
      queueStatus: "id_c1_live_assisted_pending",
    })).toBe(true);
    expect(retryQueueInsertCanUseLegacyPayload(schemaCacheError, {
      mode: "live_assisted",
      queueStatus: "id_b1_evoa_live_assisted_pending",
    })).toBe(true);
  });
});
