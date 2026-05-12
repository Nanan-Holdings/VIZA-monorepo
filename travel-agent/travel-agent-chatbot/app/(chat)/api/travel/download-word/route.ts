import { forwardJsonToTravelBackend } from "@/lib/travel/backend";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const response = await forwardJsonToTravelBackend("/download-word", payload);

    if (!response.ok) {
      const detail = await response.text();
      return Response.json(
        { error: detail || "Failed to generate Word file." },
        { status: response.status }
      );
    }

    const fileBuffer = await response.arrayBuffer();
    const contentType =
      response.headers.get("content-type") ??
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    const contentDisposition =
      response.headers.get("content-disposition") ??
      'attachment; filename="travel-itinerary.docx"';

    return new Response(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": contentDisposition,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Download failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}
