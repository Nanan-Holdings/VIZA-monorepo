import { forwardJsonToTravelBackend } from "@/lib/travel/backend";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const response = await forwardJsonToTravelBackend("/download-pdf", payload);

    if (!response.ok) {
      const detail = await response.text();
      return Response.json(
        { error: detail || "Failed to generate PDF file." },
        { status: response.status }
      );
    }

    const fileBuffer = await response.arrayBuffer();
    const contentType = response.headers.get("content-type") ?? "application/pdf";
    const contentDisposition =
      response.headers.get("content-disposition") ??
      'attachment; filename="travel-itinerary.pdf"';

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
