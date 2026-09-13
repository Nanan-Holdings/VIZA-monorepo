import { forwardJsonToTravelBackend } from "@/lib/travel/backend";
import { resolveRequestLocale } from "@/lib/travel/travel-locale";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export async function POST(request: Request) {
  let locale = resolveRequestLocale(request, undefined);
  try {
    const rawPayload = await request.json();
    locale = resolveRequestLocale(
      request,
      isRecord(rawPayload) ? rawPayload.locale : undefined
    );
    const payload = isRecord(rawPayload)
      ? { ...rawPayload, locale }
      : { locale };
    const response = await forwardJsonToTravelBackend("/download-pdf", payload);

    if (!response.ok) {
      const detail = await response.text();
      return Response.json(
        {
          error:
            detail ||
            (locale === "zh" ? "PDF 文件生成失败。" : "Failed to generate PDF file."),
        },
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
    const message =
      error instanceof Error
        ? error.message
        : locale === "zh"
          ? "下载失败。"
          : "Download failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}
