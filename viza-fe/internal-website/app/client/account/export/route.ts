import { NextResponse } from "next/server";
import { exportAccountData, AccountRateLimitError } from "@/app/actions/account";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { zip, filename } = await exportAccountData();
    // Copy bytes into a fresh ArrayBuffer to satisfy DOM Blob typing
    // (Buffer's underlying buffer can be SharedArrayBuffer on some
    // Node configs, which BlobPart rejects).
    const ab = new ArrayBuffer(zip.byteLength);
    new Uint8Array(ab).set(zip);
    const blob = new Blob([ab], { type: "application/zip" });
    return new NextResponse(blob, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(zip.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    if (err instanceof AccountRateLimitError) {
      return NextResponse.json(
        { error: err.message },
        { status: 429, headers: { "Cache-Control": "no-store" } },
      );
    }
    const message = err instanceof Error ? err.message : "Export failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
