import { NextResponse } from "next/server";
import { authorizeApplication, proxyTranslationRequest } from "../../translation-proxy";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; fieldKey: string }> },
): Promise<Response> {
  const { id, fieldKey } = await context.params;
  const authError = await authorizeApplication(id);
  if (authError) return authError;

  const body = await request.text();
  const proxied = await proxyTranslationRequest(
    `/api/applications/${encodeURIComponent(id)}/translations/${encodeURIComponent(fieldKey)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": request.headers.get("Content-Type") ?? "application/json" },
      body,
    },
  );

  if (proxied) return proxied;

  return NextResponse.json(
    { updated: false, error: "Translation service is unavailable." },
    { status: 503 },
  );
}
