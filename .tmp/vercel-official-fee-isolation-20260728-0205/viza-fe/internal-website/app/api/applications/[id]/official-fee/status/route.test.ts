import { describe, expect, it } from "vitest";
import {
  deriveVietnamOfficialFeeQueueState,
  VIETNAM_OFFICIAL_FEE_QUEUE_STATUSES,
} from "./route";

describe("deriveVietnamOfficialFeeQueueState", () => {
  it("keeps the loading UI active for a newly queued Fly cloud run", () => {
    expect(
      deriveVietnamOfficialFeeQueueState({
        id: "new-cloud-queue",
        status: "vn_cloud_live_pending",
        payment_status: "authorized",
      }),
    ).toEqual({
      queueId: "new-cloud-queue",
      paymentQueued: true,
      paymentNeedsOperator: false,
    });
  });

  it("keeps the loading UI active after the Fly worker picks up the run", () => {
    expect(
      deriveVietnamOfficialFeeQueueState({
        id: "processing-cloud-queue",
        status: "vn_live_assisted_processing",
        payment_status: "authorized",
      }),
    ).toEqual({
      queueId: "processing-cloud-queue",
      paymentQueued: true,
      paymentNeedsOperator: false,
    });
  });

  it("returns to the retry form only when the latest run actually fails", () => {
    expect(
      deriveVietnamOfficialFeeQueueState({
        id: "failed-cloud-queue",
        status: "vn_live_assisted_failed",
        payment_status: "authorized",
      }),
    ).toEqual({
      queueId: "failed-cloud-queue",
      paymentQueued: false,
      paymentNeedsOperator: true,
    });
  });

  it("queries every cloud lifecycle status used by the payment restart flow", () => {
    expect(VIETNAM_OFFICIAL_FEE_QUEUE_STATUSES).toEqual(
      expect.arrayContaining([
        "vn_cloud_live_pending",
        "vn_live_assisted_processing",
        "vn_payment_pending",
        "vn_payment_processing",
        "vn_payment_paid",
        "vn_live_assisted_failed",
        "vn_blocked",
      ]),
    );
  });
});
