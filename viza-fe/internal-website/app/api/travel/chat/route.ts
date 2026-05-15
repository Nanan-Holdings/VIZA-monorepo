import { forwardJsonToTravelBackend } from "@/lib/travel/backend";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const candidatePaths = ["/chat", "/travel-chat", "/api/chat"];
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
              reply: text || "",
              mode: "collect_slots",
              quick_replies: [],
              cards: [],
              candidate_payload: {},
              sources: [],
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
            error: text || "Failed to generate travel chat response.",
            debug: { path, status: response.status },
          },
          { status: response.status }
        );
      }
    }

    return Response.json(
      {
        error:
          "No compatible travel chat endpoint found on backend. Please verify backend routes.",
        debug: tried,
      },
      { status: 502 }
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to generate travel chat response.";
    return Response.json({ error: message }, { status: 500 });
  }
}
