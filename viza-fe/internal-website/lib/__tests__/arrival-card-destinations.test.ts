import { describe, expect, test } from "vitest";
import {
  getVisaPackageTitle,
  getVisaPackageTitleZh,
  getVisaTypeDisplayName,
  getVisaTypeDisplayNameZh,
} from "../visa-destinations";

describe("arrival card destination labels", () => {
  test("SG Arrival Card has a dedicated package label separate from Singapore Visit Visa", () => {
    expect(getVisaTypeDisplayName("SG_ARRIVAL_CARD")).toBe("SG Arrival Card");
    expect(getVisaTypeDisplayNameZh("SG_ARRIVAL_CARD")).toBe("SG Arrival Card 入境卡");

    expect(getVisaPackageTitle("singapore", "SG_ARRIVAL_CARD")).toBe("Singapore SG Arrival Card");
    expect(getVisaPackageTitleZh("singapore", "SG_ARRIVAL_CARD")).toBe("新加坡SG Arrival Card 入境卡");
  });
});
