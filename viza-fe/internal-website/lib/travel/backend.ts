const DEFAULT_TRAVEL_BACKEND_URL = "http://127.0.0.1:8000";
const DEFAULT_TRAVEL_BACKEND_TIMEOUT_MS = 20_000;

function getTravelBackendTimeoutMs(): number {
  const configured = Number.parseInt(process.env.TRAVEL_BACKEND_TIMEOUT_MS ?? "", 10);
  return Number.isFinite(configured) && configured > 0
    ? configured
    : DEFAULT_TRAVEL_BACKEND_TIMEOUT_MS;
}

export function getTravelBackendUrl(): string {
  return (
    process.env.TRAVEL_BACKEND_URL?.trim() ?? DEFAULT_TRAVEL_BACKEND_URL
  ).replace(/\/$/, "");
}

export async function forwardJsonToTravelBackend(
  path: string,
  body: unknown,
  method: "POST" | "PUT" = "POST"
) {
  return fetch(`${getTravelBackendUrl()}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(getTravelBackendTimeoutMs()),
  });
}
