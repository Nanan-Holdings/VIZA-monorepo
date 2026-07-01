import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";

import { renderKoreaC39Annex17 } from "../render-annex17";

describe("renderKoreaC39Annex17", () => {
  it("renders the official Korea Visa Portal Annex-17 template with C-3-9 answers", async () => {
    const bytes = await renderKoreaC39Annex17({
      family_name: "ZHANG",
      given_names: "SAN",
      date_of_birth: "1997-04-09",
      sex: "male",
      nationality: "China",
      passport_number: "E12345678",
      passport_issue_date: "2022-01-01",
      passport_expiry_date: "2032-01-01",
      email_address: "zhangsan@example.com",
      mobile_phone: "+8613800000000",
      purpose_of_visit: "tourism_transit",
      intended_date_of_entry: "2026-09-01",
      intended_period_of_stay: "7",
      address_in_korea: "100 Toegye-ro, Jung-gu, Seoul",
    });

    const pdf = await PDFDocument.load(bytes);

    expect(pdf.getPageCount()).toBe(5);
    expect(bytes.length).toBeGreaterThan(150_000);
  });

  it("fails safely when required Korea Annex-17 answers are missing", async () => {
    await expect(renderKoreaC39Annex17({ family_name: "ZHANG" })).rejects.toThrow(
      /Missing required Korea Annex-17 fields/,
    );
  });
});
