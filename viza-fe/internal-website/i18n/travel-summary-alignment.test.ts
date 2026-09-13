import { describe, expect, it } from "vitest";
import { createTravelFormMessage } from "@/lib/travel/planner";

describe("Travel form summaries follow the current interface locale", () => {
  it("renders an old Chinese origin confirmation in English from its canonical fields", () => {
    const message = createTravelFormMessage({
      origin_country: "Switzerland", origin_city: "Lausanne",
      return_country: "Switzerland", return_city: "Lausanne",
      display: { locale: "zh", origin_country: "瑞士", origin_city: "洛桑", return_country: "瑞士", return_city: "洛桑" },
    }, "en");
    expect(message).toBe("Departure: Switzerland | Lausanne; Return: Switzerland | Lausanne.");
  });

  it("does not reuse stale translated city or budget labels after switching", () => {
    const order = createTravelFormMessage({ travel_order: ["东京"], display: { locale: "zh", travel_order: ["东京"] } }, "en");
    expect(order).toBe("Travel order: Tokyo.");
    const budget = createTravelFormMessage({ budget: 16800, display: { locale: "en", budget_label: "Budget: RMB 16,800" } }, "zh");
    expect(budget).toContain("16800");
    expect(budget).toMatch(/预算/);
  });

  it("preserves the applicant's note while translating the surrounding label", () => {
    expect(createTravelFormMessage({ final_note: "我想参观东京" }, "en")).toBe("Note: 我想参观东京");
  });
});
