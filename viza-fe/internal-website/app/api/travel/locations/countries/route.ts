import { getCountryOptions } from "@/lib/travel/locations-provider";
import { localeFromRequest } from "@/lib/travel/travel-locale";

export async function GET(request: Request) {
  try {
    const countries = await getCountryOptions(localeFromRequest(request));
    return Response.json({ countries }, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load countries.";
    return Response.json({ error: message }, { status: 500 });
  }
}
