import { getCountryOptions } from "@/lib/travel/locations-provider";

export async function GET() {
  try {
    const countries = await getCountryOptions();
    return Response.json({ countries }, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load countries.";
    return Response.json({ error: message }, { status: 500 });
  }
}
