import { forwardJsonToTravelBackend } from "@/lib/travel/backend";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const candidatePaths = [
      "/flight-options",
      "/flights",
      "/api/flight-options",
      "/api/flights",
    ];
    const tried: Array<{ path: string; status: number; detail: string }> = [];

    for (const path of candidatePaths) {
      const response = await forwardJsonToTravelBackend(path, payload);
      const text = await response.text();

      if (response.ok) {
        try {
          return Response.json(JSON.parse(text), { status: 200 });
        } catch {
          return Response.json({ legs: [] }, { status: 200 });
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
            error: "暂时无法加载航班候选，请稍后再试。",
            debug: { path, status: response.status, detail: text || undefined },
          },
          { status: response.status }
        );
      }
    }

    return Response.json(
      {
        error: "航班服务暂时不可用，请稍后再试。",
        debug: tried,
      },
      { status: 502 }
    );
  } catch (error) {
    return Response.json(
      {
        error: "暂时无法加载航班候选，请稍后再试。",
        debug: error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
