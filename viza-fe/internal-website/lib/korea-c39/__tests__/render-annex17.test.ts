import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";

import { renderKoreaC39Annex17 } from "../render-annex17";

describe("renderKoreaC39Annex17", () => {
  it("renders a flattened multi-page PDF from Korea C-3-9 answers", async () => {
    const bytes = await renderKoreaC39Annex17({
      family_name: "ZHANG",
      given_names: "SAN",
      date_of_birth: "1997-04-09",
      sex: "male",
      nationality: "China",
      passport_number: "E12345678",
      email_address: "zhangsan@example.com",
      mobile_phone: "+8613800000000",
      purpose_of_visit: "tourism_transit",
      intended_date_of_entry: "2026-09-01",
      intended_period_of_stay: "7",
    });

    const pdf = await PDFDocument.load(bytes);

    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(5);
    expect(bytes.length).toBeGreaterThan(1000);
  });
});
