import { NextResponse } from "next/server";
import { uploadApplicationDocument } from "@/app/client/documents/actions";

export const runtime = "nodejs";

function statusForUploadError(code: string): number {
  if (code === "not_authenticated") return 401;
  if (code === "not_found") return 404;
  if (code === "invalid_request") return 400;
  return 500;
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const result = await uploadApplicationDocument(formData);
  return NextResponse.json(result, {
    status: result.ok ? 200 : statusForUploadError(result.code),
  });
}
