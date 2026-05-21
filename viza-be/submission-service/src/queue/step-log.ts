import { supabase } from "../supabase.js";
import { artifact } from "../artifact.js";

/**
 * Per-step trace recorder for runner jobs (OPS-002).
 *
 * Country runners call `step.begin(name)` at the top of each page
 * transition / Playwright step and `step.complete(...)` at the
 * bottom, optionally attaching a screenshot, HAR slice, or console
 * dump that get written to `submission-artifacts` and persisted on
 * the row.
 *
 * The staff job-detail page (`/admin/jobs/[id]`) consumes the rows
 * back out as a timeline with diff-against-previous-run.
 */

export interface StepRecorder {
  begin(name: string): Promise<StepHandle>;
}

export interface StepHandle {
  /** Returns the runner_step_log row id and the step_index assigned. */
  readonly id: number;
  readonly stepIndex: number;
  attachScreenshot(pngBytes: Buffer | Uint8Array): Promise<void>;
  attachHar(harJson: unknown): Promise<void>;
  attachConsole(text: string): Promise<void>;
  complete(opts?: {
    status?: "ok" | "failed" | "skipped" | "gate";
    error?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void>;
}

export function createStepRecorder(
  jobId: string,
  applicationId: string,
): StepRecorder {
  let counter = 0;
  return {
    async begin(name: string): Promise<StepHandle> {
      const stepIndex = counter++;
      const { data, error } = await supabase
        .from("runner_step_log")
        .insert({
          job_id: jobId,
          application_id: applicationId,
          step_index: stepIndex,
          name,
          status: "ok",
        })
        .select("id")
        .single();
      if (error || !data) {
        throw new Error(`runner_step_log insert: ${error?.message}`);
      }
      const rowId = data.id as number;

      return {
        id: rowId,
        stepIndex,
        async attachScreenshot(pngBytes) {
          const ref = await artifact.put(
            jobId,
            `step-${String(stepIndex).padStart(3, "0")}.png`,
            pngBytes,
            { contentType: "image/png", upsert: true },
          );
          await supabase
            .from("runner_step_log")
            .update({ screenshot_path: ref.path })
            .eq("id", rowId);
        },
        async attachHar(harJson) {
          const ref = await artifact.put(
            jobId,
            `step-${String(stepIndex).padStart(3, "0")}.har`,
            JSON.stringify(harJson),
            { contentType: "application/json", upsert: true },
          );
          await supabase
            .from("runner_step_log")
            .update({ har_path: ref.path })
            .eq("id", rowId);
        },
        async attachConsole(text) {
          const ref = await artifact.put(
            jobId,
            `step-${String(stepIndex).padStart(3, "0")}.log`,
            text,
            { contentType: "text/plain; charset=utf-8", upsert: true },
          );
          await supabase
            .from("runner_step_log")
            .update({ console_path: ref.path })
            .eq("id", rowId);
        },
        async complete(opts = {}) {
          const status = opts.status ?? "ok";
          await supabase
            .from("runner_step_log")
            .update({
              finished_at: new Date().toISOString(),
              status,
              error: opts.error ?? null,
              metadata: opts.metadata ?? null,
            })
            .eq("id", rowId);
        },
      };
    },
  };
}
