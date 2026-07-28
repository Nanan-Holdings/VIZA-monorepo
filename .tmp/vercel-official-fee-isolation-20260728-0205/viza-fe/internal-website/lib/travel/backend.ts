const DEFAULT_TRAVEL_BACKEND_URL = "http://127.0.0.1:8000";

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
  });
}
