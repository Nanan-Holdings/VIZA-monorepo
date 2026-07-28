import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id: applicationId } = await ctx.params;
  if (!applicationId) return NextResponse.json({ error: "Missing application id" }, { status: 400 });
  return NextResponse.json(
    {
      error:
        "Korea Annex-17 backup PDF generation is disabled. Generate the official Korea Visa Portal barcode e-Form PDF instead.",
    },
    { status: 410 },
  );
}
