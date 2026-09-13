import { generateItineraryWithFallback } from "@/lib/travel/itinerary-fallback";
import { resolveRequestLocale } from "@/lib/travel/travel-locale";

export async function POST(request: Request) {
  const rawPayload = await request.json().catch(() => ({}));
  const payload =
    rawPayload && typeof rawPayload === "object" && !Array.isArray(rawPayload)
      ? {
          ...(rawPayload as Record<string, unknown>),
          locale: resolveRequestLocale(
            request,
            (rawPayload as Record<string, unknown>).locale
          ),
        }
      : { locale: resolveRequestLocale(request, undefined) };
  const result = await generateItineraryWithFallback(payload);

  if (result.success) {
    return Response.json(result, { status: 200 });
  }

  return Response.json(result, { status: 503 });
}
