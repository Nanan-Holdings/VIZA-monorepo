import { NextResponse } from "next/server";
import { getOrderReceiptPdf } from "@/app/actions/receipts";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const url = new URL(req.url);
    const mode = url.searchParams.get("mode") === "invoice" ? "invoice" : "receipt";
    const company = url.searchParams.get("company") ?? undefined;
    const taxId = url.searchParams.get("tax_id") ?? undefined;
    const vatPercent = url.searchParams.get("vat_percent");
    const billing = url.searchParams.get("billing") ?? undefined;

    const invoice =
      mode === "invoice" && company && taxId
        ? {
            companyName: company,
            taxId,
            vatPercent: vatPercent ? Number.parseFloat(vatPercent) : undefined,
            billingAddress: billing,
          }
        : undefined;

    const { pdf, filename } = await getOrderReceiptPdf(id, mode, invoice);
    const ab = new ArrayBuffer(pdf.byteLength);
    new Uint8Array(ab).set(pdf);
    const blob = new Blob([ab], { type: "application/pdf" });
    return new NextResponse(blob, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(pdf.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
