import { describe, expect, it } from "vitest";
import {
  isDs160VisaType,
  isSgArrivalCardApplication,
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
    expect(submissionQueueRequiresServerEnqueue("indonesia", "B211A", "dry_run")).toBe(false);
  });

  it("uses live official mode for the one-click Vietnam submit action", () => {
    expect(submitModeForPrimaryApplicationAction("vietnam", "evisa_tourism")).toBe("live_assisted");
    expect(submitModeForPrimaryApplicationAction("VN", "VN_E_VISA")).toBe("live_assisted");
    expect(submitModeForPrimaryApplicationAction("indonesia", "B211A")).toBe("dry_run");
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
});
