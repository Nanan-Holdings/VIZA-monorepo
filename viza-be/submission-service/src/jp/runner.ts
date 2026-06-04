import { artifact } from "../artifact.js";
import { renderPdf } from "../paper/simple-pdf.js";
import { buildJpPaperLines, JP_PAPER_TITLE } from "./field-mappings.js";
import { loadCanonicalAnswers } from "../queue/answers.js";
import { type DispatchOutcome } from "../queue/types.js";

/**
 * Japan paper-pack runner (RUN-JP-001).
 *
 * Japan is paper-only (no online submit). runOne renders the printable
 * application PDF from canonical answers and stores it as an artifact, then
 * returns the terminal `paper_ready` outcome (the worker marks the job
 * succeeded — there is no government payment step to halt before). The
 * portal's JpResultCard surfaces the stored PDF to the applicant.
 */

export interface JpRunResult {
  status: "paper_ready";
  reachedStep: string;
  artefacts: string[];
}

export async function runJpRunner(input: {
  jobId: string;
  applicationId: string;
  answers: Record<string, string>;
}): Promise<JpRunResult> {
  const lines = buildJpPaperLines(input.answers);
  const pdf = renderPdf(JP_PAPER_TITLE, lines);
  const ref = await artifact.put(input.jobId, "jp-application.pdf", pdf, {
    contentType: "application/pdf",
    upsert: true,
  });
  return { status: "paper_ready", reachedStep: "paper_rendered", artefacts: [ref.path] };
}

export async function runOne(applicationId: string, jobId?: string): Promise<DispatchOutcome> {
  const answers = await loadCanonicalAnswers(applicationId);
  const result = await runJpRunner({ jobId: jobId ?? applicationId, applicationId, answers });
  return { outcome: "paper_ready", reachedStep: result.reachedStep, artefacts: result.artefacts };
}
