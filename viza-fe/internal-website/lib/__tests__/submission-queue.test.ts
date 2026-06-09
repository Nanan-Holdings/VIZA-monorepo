import { describe, expect, it } from "vitest";
import { queueStatusForVisaType } from "@/lib/submission-queue";

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
});
