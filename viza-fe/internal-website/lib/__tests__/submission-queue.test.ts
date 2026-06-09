import { describe, expect, it } from "vitest";
import {
  isDs160VisaType,
  queueProviderForVisaType,
  queueStatusForApplication,
  queueStatusForVisaType,
} from "@/lib/submission-queue";

describe("queueStatusForVisaType", () => {
  it("routes France Schengen forms to the France-Visas prefill worker", () => {
    expect(queueStatusForVisaType("EU_SCHENGEN_C_SHORT_STAY")).toBe("fv_prefill_pending");
    expect(queueStatusForVisaType("SCHENGEN_C")).toBe("fv_prefill_pending");
  });

  it("keeps other implemented automation providers scoped to their own queues", () => {
    expect(queueStatusForVisaType("DS160")).toBe("ds160_prefill_pending");
    expect(queueStatusForVisaType("UK_STANDARD_VISITOR")).toBe("uk_prefill_pending");
    expect(queueStatusForVisaType("VN_E_VISA")).toBe("vn_prefill_pending");
    expect(queueStatusForVisaType("AU_VISITOR_600")).toBe("au_prefill_pending");
  });

  it("routes legacy Vietnam e-visa tourism packages by country without hijacking other countries", () => {
    expect(queueStatusForApplication("vietnam", "evisa_tourism")).toBe("vn_prefill_pending");
    expect(queueStatusForApplication("Viet Nam", "tourist-e-visa")).toBe("vn_prefill_pending");
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
    expect(queueProviderForVisaType("EU_SCHENGEN_C_SHORT_STAY", "dry_run")).toBe("france_visas_dry_run");
    expect(queueProviderForVisaType("EU_SCHENGEN_C_SHORT_STAY", "live_assisted")).toBe("france_visas_live");
  });
});
