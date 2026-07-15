import { NextResponse } from "next/server";

const OFFICIAL_API_BASE = "https://ws.etravel.gov.ph";

type OfficialFlight = {
  code?: unknown;
  name?: unknown;
  flight_type?: unknown;
  travel_company_code?: unknown;
  travel_port_code?: unknown;
  travel_port_name?: unknown;
  country_of_origin_code?: unknown;
  country_of_origin_name?: unknown;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const source = url.searchParams.get("source");
  const parent = url.searchParams.get("parent")?.trim() ?? "";
  if (source !== "ph_etravel:flight_numbers" || !/^[A-Za-z0-9 _-]{1,40}$/.test(parent)) {
    return NextResponse.json({ error: "Unsupported Philippines eTravel option request", options: [] }, { status: 400 });
  }

  const params = new URLSearchParams({
    paginate: "0",
    order_by: "name",
    status_by: "asc",
    travel_company_code: parent,
  });
  try {
    const response = await fetch(`${OFFICIAL_API_BASE}/api/v1/common/flight_numbers?${params.toString()}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 60 * 60 },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      return NextResponse.json({ error: "Official eTravel options are temporarily unavailable", options: [] }, { status: 502 });
    }
    const payload = await response.json() as { data?: OfficialFlight[] };
    const options = (Array.isArray(payload.data) ? payload.data : [])
      .filter((item) => item.flight_type === "ARRIVAL")
      .map((item) => {
        const value = typeof item.code === "string" ? item.code.trim() : "";
        const text = typeof item.name === "string" ? item.name.trim() : value;
        if (!value) return null;
        return {
          value,
          text,
          label_en: text,
          label_zh: text,
          official_label: text,
          meta: {
            travel_company_code: item.travel_company_code,
            travel_port_code: item.travel_port_code,
            travel_port_name: item.travel_port_name,
            country_of_origin_code: item.country_of_origin_code,
            country_of_origin_name: item.country_of_origin_name,
          },
        };
      })
      .filter(Boolean);
    return NextResponse.json({ source, parent, totalCount: options.length, options });
  } catch {
    return NextResponse.json({ error: "Official eTravel options are temporarily unavailable", options: [] }, { status: 503 });
  }
}
