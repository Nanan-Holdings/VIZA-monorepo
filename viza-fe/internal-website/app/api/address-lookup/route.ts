import { parseGoogleAddressLookup } from "@/lib/address-autofill";

const GOOGLE_GEOCODE_ENDPOINT = "https://maps.googleapis.com/maps/api/geocode/json";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("query")?.trim() ?? "";
  const country = url.searchParams.get("country")?.trim().toUpperCase() ?? "";

  if (query.length < 3 || query.length > 300) {
    return Response.json({ error: "Enter a hotel name, address, or postal code." }, { status: 400 });
  }
  if (!/^[A-Z]{2}$/.test(country)) {
    return Response.json({ error: "A valid two-letter country code is required." }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim() ?? "";
  if (!apiKey) {
    return Response.json({ error: "Address lookup is not configured." }, { status: 503 });
  }

  const params = new URLSearchParams({
    address: query,
    components: `country:${country}`,
    key: apiKey,
    language: "en",
    region: country.toLowerCase(),
  });

  try {
    const response = await fetch(`${GOOGLE_GEOCODE_ENDPOINT}?${params.toString()}`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      return Response.json({ error: "Address lookup is temporarily unavailable." }, { status: 502 });
    }

    const payload = await response.json();
    const location = parseGoogleAddressLookup(payload);
    return Response.json({ location }, { status: 200 });
  } catch {
    return Response.json({ error: "Address lookup is temporarily unavailable." }, { status: 502 });
  }
}
