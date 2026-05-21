import { supabase } from "../supabase.js";
import { artifact } from "../artifact.js";
import { renderPdf, type PdfLine } from "./simple-pdf.js";

/**
 * Per-jurisdiction paper-channel PDF renderer (DOC-004).
 *
 * Flow:
 *   1. Pick the paper_template row keyed on (package_id, templateKey)
 *      for the application's package.
 *   2. Pull the canonical answer set from visa_application_answers.
 *   3. Render a printable PDF using simple-pdf.ts (no extra deps).
 *   4. Upload via artifact.put under jobs/<jobId>/paper-<key>.pdf and
 *      return the signed URL the staff portal links from.
 *
 * Note on AcroForm fillables: this renderer ships a printable
 * declaration-style PDF. Flows that need an AcroForm field-fill
 * (Japan MOFA Form A, pdf-lib already used in scripts/) will land a
 * sibling renderer that loads the byte-exact template and fills the
 * fields. The contract — `renderPaperPdf(jobId, applicationId,
 * templateKey)` returning an ArtifactRef — is shared.
 */

export interface PaperLayoutField {
  answerKey: string;
  label: string;
  /** Override the rendered value (e.g. "Yes/No" formatting). */
  format?: "default" | "yesno" | "uppercase";
}

export interface PaperLayout {
  fields: PaperLayoutField[];
  /** Optional footer line — agency disclaimer, return address, etc. */
  footer?: string;
}

interface AnswerRow {
  field_name: string;
  value_text: string | null;
}

interface TemplateRow {
  id: string;
  title: string;
  layout: PaperLayout;
}

function formatValue(raw: string, format?: PaperLayoutField["format"]): string {
  switch (format) {
    case "yesno":
      return raw === "true" || raw === "yes" || raw === "1" ? "Yes" : "No";
    case "uppercase":
      return raw.toUpperCase();
    default:
      return raw;
  }
}

export interface RenderInput {
  jobId: string;
  applicationId: string;
  templateKey: string;
}

export async function renderPaperPdf(input: RenderInput): Promise<{
  path: string;
  signedUrl: string;
  bytes: number;
}> {
  // Resolve package + template.
  const { data: app, error: appErr } = await supabase
    .from("applications")
    .select("country, visa_type")
    .eq("id", input.applicationId)
    .maybeSingle();
  if (appErr || !app) throw new Error(`application read: ${appErr?.message}`);
  const { data: pkg } = await supabase
    .from("visa_packages")
    .select("id")
    .eq("country", app.country)
    .eq("visa_type", app.visa_type)
    .maybeSingle();
  if (!pkg) throw new Error(`No package row for ${app.country}/${app.visa_type}`);
  const { data: template, error: tplErr } = await supabase
    .from("paper_template")
    .select("id, title, layout")
    .eq("package_id", pkg.id)
    .eq("key", input.templateKey)
    .maybeSingle();
  if (tplErr || !template) {
    throw new Error(
      `No paper_template ${input.templateKey} for package ${app.country}/${app.visa_type}`,
    );
  }
  const tpl = template as TemplateRow;

  const { data: answerRows } = await supabase
    .from("visa_application_answers")
    .select("field_name, value_text")
    .eq("application_id", input.applicationId);
  const answers = new Map<string, string>();
  for (const a of (answerRows ?? []) as AnswerRow[]) {
    if (a.value_text) answers.set(a.field_name, a.value_text);
  }

  const lines: PdfLine[] = [
    { text: "VIZA Pte. Ltd.", size: 14, bold: true },
    { text: "haggstorm.com  •  visa application packet" },
    { text: "" },
    { text: tpl.title, size: 16, bold: true },
    { text: `Application: ${input.applicationId}` },
    { text: `Package: ${app.country}/${app.visa_type}` },
    { text: `Generated: ${new Date().toISOString()}` },
    { text: "" },
  ];

  for (const f of tpl.layout.fields) {
    const raw = answers.get(f.answerKey) ?? "";
    const value = formatValue(raw, f.format);
    lines.push({ text: `${f.label}:`, bold: true });
    lines.push({ text: `  ${value || "(blank)"}` });
  }

  if (tpl.layout.footer) {
    lines.push({ text: "" });
    lines.push({ text: tpl.layout.footer });
  }

  const pdf = renderPdf(`${tpl.title} ${input.applicationId}`, lines);
  const ref = await artifact.put(input.jobId, `paper-${input.templateKey}.pdf`, pdf, {
    contentType: "application/pdf",
    upsert: true,
  });
  return { path: ref.path, signedUrl: ref.signedUrl, bytes: pdf.byteLength };
}
