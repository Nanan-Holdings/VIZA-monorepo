import { forwardJsonToTravelBackend } from "@/lib/travel/backend";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const candidatePaths = ["/revise-itinerary", "/api/revise-itinerary"];
    const tried: Array<{ path: string; status: number; detail: string }> = [];

    for (const path of candidatePaths) {
      const response = await forwardJsonToTravelBackend(path, payload);
      const text = await response.text();

      if (response.ok) {
        try {
          return Response.json(JSON.parse(text), { status: 200 });
        } catch {
          return Response.json(
            {
              action: "clarify",
              reply: "行程修改返回格式无效，请再试一次。",
              itinerary: [],
              state_patch: {},
              module_patch: {},
              edit_summary: "revision response parse failed",
              quick_replies: [],
            },
            { status: 200 }
          );
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
            error: text || "Failed to revise itinerary.",
            debug: { path, status: response.status },
          },
          { status: response.status }
        );
      }
    }

    return Response.json(
      {
        error:
          "No compatible itinerary revision endpoint found on backend. Please verify backend routes.",
        debug: tried,
      },
      { status: 502 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to revise itinerary.";
    return Response.json({ error: message }, { status: 500 });
  }
}
