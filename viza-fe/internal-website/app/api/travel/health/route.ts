import { createClient } from "@supabase/supabase-js";
import { getTravelBackendUrl } from "@/lib/travel/backend";

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

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await supabase
      .from("travel_destinations")
      .select("id", { count: "exact", head: true })
      .limit(1);
    return !error;
  } catch {
    return false;
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
