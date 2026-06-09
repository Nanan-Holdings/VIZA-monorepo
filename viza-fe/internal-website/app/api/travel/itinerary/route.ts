import { generateItineraryWithFallback } from "@/lib/travel/itinerary-fallback";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => ({}));
  const result = await generateItineraryWithFallback(payload);

  if (result.success) {
    return Response.json(result, { status: 200 });
  }

  return Response.json(result, { status: 503 });
}
