import { getTravelBackendUrl } from "@/lib/travel/backend";

const HEALTH_TIMEOUT_MS = 2_500;

type ServiceHealth = {
  configured: boolean;
  reachable: boolean;
};

async function boundedFetch(
  url: string,
  init: RequestInit
): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      ...init,
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

async function checkOpenAI(): Promise<ServiceHealth> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return { configured: false, reachable: false };
  const reachable = await boundedFetch(
    "https://api.openai.com/v1/models",
    { method: "GET", headers: { Authorization: `Bearer ${apiKey}` } }
  );
  return { configured: true, reachable };
}

async function checkTravelService(): Promise<ServiceHealth> {
  const configured = Boolean(process.env.TRAVEL_BACKEND_URL?.trim());
  const reachable = await boundedFetch(`${getTravelBackendUrl()}/docs`, {
    method: "GET",
  });
  return { configured, reachable };
}

async function checkSessionDatabase(): Promise<ServiceHealth> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceRoleKey) {
    return { configured: false, reachable: false };
  }
  const reachable = await boundedFetch(
    `${supabaseUrl.replace(/\/$/, "")}/rest/v1/travel_agent_sessions?select=id&limit=1`,
    {
      method: "GET",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    }
  );
  return { configured: true, reachable };
}

function placesHealth(): ServiceHealth {
  const configured = Boolean(
    process.env.GOOGLE_MAPS_API_KEY?.trim() ||
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim()
  );
  return { configured, reachable: configured };
}

function clientSessionHealth(): ServiceHealth {
  const configured = (process.env.CLIENT_SESSION_SECRET?.trim().length ?? 0) >= 32;
  return { configured, reachable: configured };
}

export async function GET() {
  const [openai, travelService, sessionDatabase] = await Promise.all([
    checkOpenAI(),
    checkTravelService(),
    checkSessionDatabase(),
  ]);
  const places = placesHealth();
  const clientSession = clientSessionHealth();
  const services = {
    openai,
    travelService,
    sessionDatabase,
    places,
    clientSession,
  };
  return Response.json(
    {
      ok:
        openai.reachable &&
        sessionDatabase.reachable &&
        clientSession.reachable,
      services,
      // Compatibility fields for clients during the protocol rollout.
      llmConfigured: openai.configured,
      llmReachable: openai.reachable,
      googlePlacesConfigured: places.configured,
      cacheReachable: sessionDatabase.reachable,
      travelBackendReachable: travelService.reachable,
    },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
}
