import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

describe("Philippines eTravel official options proxy", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns only arrival flights with exact official codes", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ data: [
      { code: "PR100", name: "PR100", flight_type: "DEPARTURE", travel_company_code: "TC002" },
      { code: "PR101", name: "PR101", flight_type: "ARRIVAL", travel_company_code: "TC002", travel_port_code: "TP1000" },
    ] }), { status: 200, headers: { "Content-Type": "application/json" } })));

    const response = await GET(new Request(
      "http://localhost/api/ph-etravel/options?source=ph_etravel%3Aflight_numbers&parent=TC002",
    ));
    const payload = await response.json() as { totalCount: number; options: Array<{ value: string }> };

    expect(response.status).toBe(200);
    expect(payload.totalCount).toBe(1);
    expect(payload.options.map((option) => option.value)).toEqual(["PR101"]);
  });

  it("rejects unsupported sources", async () => {
    const response = await GET(new Request(
      "http://localhost/api/ph-etravel/options?source=unknown&parent=TC002",
    ));
    expect(response.status).toBe(400);
  });
});
