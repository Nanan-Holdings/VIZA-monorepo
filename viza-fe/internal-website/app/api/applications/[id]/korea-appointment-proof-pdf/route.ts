import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { getClientSessionWithFallback } from "@/lib/client-session";
import { createAdminClient } from "@/lib/supabase/admin";

interface ConfirmationRow {
  id: string;
  confirmation_number: string | null;
  appointment_date: string | null;
  appointment_time: string | null;
  appointment_location: string | null;
  appointment_type: string | null;
  confirmation_pdf_url: string | null;
  confirmation_screenshot_url: string | null;
  raw_confirmation_redacted_json: { mode?: string } | null;
  created_at: string | null;
}

async function renderProofPdf(applicationId: string, confirmation: ConfirmationRow): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const margin = 56;
  const maxWidth = page.getWidth() - margin * 2;
  let y = 760;

  const wrapText = (text: string, size: number, useBold: boolean): string[] => {
    const activeFont = useBold ? bold : font;
    const words = text.split(" ");
    const lines: string[] = [];
    let line = "";

    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (activeFont.widthOfTextAtSize(next, size) <= maxWidth) {
        line = next;
        continue;
      }

      if (line) lines.push(line);
      line = word;
      while (activeFont.widthOfTextAtSize(line, size) > maxWidth && line.length > 1) {
        let end = line.length;
        while (end > 1 && activeFont.widthOfTextAtSize(line.slice(0, end), size) > maxWidth) end -= 1;
        lines.push(line.slice(0, end));
        line = line.slice(end);
      }
    }

    if (line) lines.push(line);
    return lines;
  };

  const draw = (text: string, size = 11, useBold = false) => {
    for (const line of wrapText(text, size, useBold)) {
      page.drawText(line, {
        x: margin,
        y,
        size,
        font: useBold ? bold : font,
        color: rgb(0.1, 0.12, 0.16),
      });
      y -= size + 6;
    }
    y -= 4;
  };

  draw("Korea KVAC Appointment Proof Packet", 20, true);
  y -= 8;
  draw("This packet is generated from the official appointment confirmation captured by VIZA.", 10);
  draw("Carry the official KVAC appointment confirmation printout when attending the visa center.", 10);
  y -= 16;
  draw(`Application ID: ${applicationId}`, 11, true);
  draw(`Confirmation number: ${confirmation.confirmation_number ?? "Not provided by portal"}`, 12, true);
  draw(`Appointment date: ${confirmation.appointment_date ?? "Not provided"}`);
  draw(`Appointment time: ${confirmation.appointment_time ?? "Not provided"}`);
  draw(`Appointment location: ${confirmation.appointment_location ?? "Not provided"}`);
  draw(`Appointment type: ${confirmation.appointment_type ?? "Korea C-3-9 document intake"}`);
  draw(`Captured at: ${confirmation.created_at ?? new Date().toISOString()}`);
  if (confirmation.confirmation_screenshot_url) {
    y -= 8;
    draw(`Official confirmation screenshot: ${confirmation.confirmation_screenshot_url}`);
  }
  if (confirmation.confirmation_pdf_url) {
    draw(`Official confirmation PDF: ${confirmation.confirmation_pdf_url}`);
  }

  return pdf.save();
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await ctx.params;
  const session = await getClientSessionWithFallback();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const admin = createAdminClient();
  const { data: application, error: appError } = await admin
    .from("applications")
    .select("id, applicant_id, visa_type")
    .eq("id", id)
    .maybeSingle();
  if (appError || !application) return NextResponse.json({ error: "Application not found" }, { status: 404 });
  if (application.applicant_id !== session.userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (application.visa_type !== "KR_C39_SHORT_TERM_VISIT") {
    return NextResponse.json({ error: "Korea appointment proof only supports KR_C39_SHORT_TERM_VISIT" }, { status: 400 });
  }

  const { data: confirmation, error: confirmationError } = await admin
    .from("appointment_confirmations")
    .select("id, confirmation_number, appointment_date, appointment_time, appointment_location, appointment_type, confirmation_pdf_url, confirmation_screenshot_url, raw_confirmation_redacted_json, created_at")
    .eq("application_id", id)
    .eq("country_code", "KR")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (confirmationError) throw new Error(confirmationError.message);
  if (!confirmation) return NextResponse.json({ error: "Korea appointment confirmation not found" }, { status: 404 });
  if (
    (confirmation.raw_confirmation_redacted_json as { mode?: string } | null)?.mode === "dry_run" ||
    String(confirmation.confirmation_number ?? "").startsWith("KR-DRYRUN-")
  ) {
    return NextResponse.json({ error: "Official Korea appointment confirmation not found" }, { status: 404 });
  }

  const bytes = await renderProofPdf(id, confirmation as ConfirmationRow);
  const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return new Response(body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="korea-kvac-appointment-proof-${id}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
