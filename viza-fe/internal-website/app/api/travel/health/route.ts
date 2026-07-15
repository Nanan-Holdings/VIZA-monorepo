import { getTravelBackendUrl } from "@/lib/travel/backend";

const CACHE_HEALTH_TIMEOUT_MS = 1_500;

type TravelHealthResponse = {
  ok: boolean;
  llmConfigured: boolean;
  llmReachable: boolean;
  googlePlacesConfigured: boolean;
  cacheReachable: boolean;
  travelBackendReachable: boolean;
};

async function checkTravelBackendReachable(): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2_500);
  try {
    const response = await fetch(`${getTravelBackendUrl()}/docs`, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function checkCacheReachable(): Promise<boolean> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceRoleKey) return false;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CACHE_HEALTH_TIMEOUT_MS);
  try {
    // This cache check is optional for local startup. Query the REST endpoint
    // directly so its AbortSignal bounds DNS/network failures as well.
    const response = await fetch(
      `${supabaseUrl.replace(/\/$/, "")}/rest/v1/travel_destinations?select=id&limit=1`,
      {
        method: "GET",
        cache: "no-store",
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        signal: controller.signal,
      }
    );
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET() {
  const llmConfigured = Boolean(process.env.OPENAI_API_KEY?.trim());
  const googlePlacesConfigured = Boolean(
    process.env.GOOGLE_MAPS_API_KEY?.trim() ||
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim()
  );
  const [travelBackendReachable, cacheReachable] = await Promise.all([
    checkTravelBackendReachable(),
    checkCacheReachable(),
  ]);
  const llmReachable = llmConfigured && travelBackendReachable;
  const body: TravelHealthResponse = {
    ok: llmReachable,
    llmConfigured,
    llmReachable,
    googlePlacesConfigured,
    cacheReachable,
    travelBackendReachable,
  };

  return Response.json(body, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}
