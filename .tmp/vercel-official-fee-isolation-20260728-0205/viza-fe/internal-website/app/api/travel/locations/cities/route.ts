import { getCitiesForCountries } from "@/lib/travel/locations-provider";

type CitiesRequestBody = {
  countries?: unknown;
};

function coerceCountries(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const countries: string[] = [];

  for (const item of value) {
    if (typeof item !== "string") continue;
    const normalized = item.trim();
    if (!normalized) continue;
    countries.push(normalized);
  }

  return countries;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CitiesRequestBody;
    const countries = coerceCountries(body.countries);

    if (!countries.length) {
      return Response.json(
        { citiesByCountry: {}, cityCountByCountry: {} },
        { status: 200 }
      );
    }

    const citiesByCountry = await getCitiesForCountries(countries);
    const cityCountByCountry = Object.fromEntries(
      Object.entries(citiesByCountry).map(([country, cities]) => [
        country,
        Array.isArray(cities) ? cities.length : 0,
      ])
    );

    return Response.json(
      {
        citiesByCountry,
        cityCountByCountry,
      },
      { status: 200 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load cities.";
    return Response.json({ error: message }, { status: 500 });
  }
}
