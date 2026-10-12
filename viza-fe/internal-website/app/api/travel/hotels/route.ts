import { forwardJsonToTravelBackend } from "@/lib/travel/backend";
import { resolveRequestLocale } from "@/lib/travel/travel-locale";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export async function POST(request: Request) {
  let locale = resolveRequestLocale(request, undefined);
  try {
    const payload = await request.json();
    locale = resolveRequestLocale(
      request,
      isRecord(payload) ? payload.locale : undefined
    );
    const candidatePaths = [
      "/hotel-options",
      "/hotels",
      "/api/hotel-options",
      "/api/hotels",
    ];
    const tried: Array<{ path: string; status: number; detail: string }> = [];

    for (const path of candidatePaths) {
      const response = await forwardJsonToTravelBackend(path, payload);
      const text = await response.text();

      if (response.ok) {
        try {
          return Response.json(JSON.parse(text), { status: 200 });
        } catch {
          return Response.json({ stays: [] }, { status: 200 });
        }
      }

      tried.push({
        path,
        status: response.status,
        detail: text || "",
      });

      if (response.status !== 404) {
        return Response.json(
          {
            error:
              locale === "en"
                ? "Hotel options are temporarily unavailable. Please try again shortly."
                : "暂时无法加载酒店候选，请稍后再试。",
            debug: { path, status: response.status, detail: text || undefined },
          },
          { status: response.status }
        );
      }
    }

    return Response.json(
      {
        error:
          locale === "en"
            ? "The hotel service is temporarily unavailable. Please try again shortly."
            : "酒店服务暂时不可用，请稍后再试。",
        debug: tried,
      },
      { status: 502 }
    );
  } catch (error) {
    return Response.json(
      {
        error:
          locale === "en"
            ? "Hotel options are temporarily unavailable. Please try again shortly."
            : "暂时无法加载酒店候选，请稍后再试。",
        debug: error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
