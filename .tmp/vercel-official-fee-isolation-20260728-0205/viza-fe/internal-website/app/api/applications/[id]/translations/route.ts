import { NextResponse } from "next/server";
import { authorizeApplication, proxyTranslationRequest } from "../translation-proxy";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  const authError = await authorizeApplication(id);
  if (authError) return authError;

  const proxied = await proxyTranslationRequest(
    `/api/applications/${encodeURIComponent(id)}/translations`,
    { method: "GET" },
  );

  if (proxied?.ok) return proxied;

  return NextResponse.json({});
}
