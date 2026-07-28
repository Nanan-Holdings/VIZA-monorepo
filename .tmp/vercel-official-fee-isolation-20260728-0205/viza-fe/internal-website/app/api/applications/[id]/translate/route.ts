import { NextResponse } from "next/server";
import { authorizeApplication, proxyTranslationRequest } from "../translation-proxy";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  const authError = await authorizeApplication(id);
  if (authError) return authError;

  const proxied = await proxyTranslationRequest(
    `/api/applications/${encodeURIComponent(id)}/translate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    },
  );

  if (proxied?.ok) return proxied;

  return NextResponse.json({
    translated: false,
    count: 0,
    fields: {},
    warning: "Translation service is unavailable; showing saved answers without generated translations.",
  });
}
