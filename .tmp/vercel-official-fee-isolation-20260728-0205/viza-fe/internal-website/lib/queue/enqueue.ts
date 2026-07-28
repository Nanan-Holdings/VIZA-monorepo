import { withAdmin } from "@/lib/auth/with-admin";
import { assertKnownCountry } from "@/lib/queue/countries";

/**
 * Producer for the runner_job queue (INFRA-002).
 *
 * `enqueueRunnerJob(applicationId, country, opts?)` is idempotent on
 * the application_id: a queued / running row for the same application
 * is reused rather than duplicated. Returns the runner_job id either
 * way.
 *
 * Called from the Stripe webhook handler on `order paid` (PAY-002 gate)
 * and any future server action that elects to fast-path an admin-paid
 * application.
 */

export interface EnqueueOpts {
  correlationId?: string;
  maxAttempts?: number;
  metadata?: Record<string, unknown>;
}

export async function enqueueRunnerJob(
  applicationId: string,
  country: string,
  opts: EnqueueOpts = {},
): Promise<{ id: string; created: boolean }> {
  // QUE-004: validate + normalize the country against the shared contract
  // so the consumer's dispatch table never sees an unroutable value.
  const normalizedCountry = assertKnownCountry(country);
  return withAdmin("system", "lib/queue:enqueue", async (admin) => {
    const { data: existing } = await admin
      .from("runner_job")
      .select("id, status")
      .eq("application_id", applicationId)
      .in("status", ["queued", "running"])
      .order("enqueued_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing) {
      return { id: existing.id as string, created: false };
    }
    const { data, error } = await admin
      .from("runner_job")
      .insert({
        application_id: applicationId,
        country: normalizedCountry,
        status: "queued",
        attempts: 0,
        max_attempts: opts.maxAttempts ?? 3,
        correlation_id: opts.correlationId ?? null,
        metadata: opts.metadata ?? null,
      })
      .select("id")
      .single();
    if (error || !data) {
      throw new Error(`runner_job insert: ${error?.message ?? "no data"}`);
    }
    return { id: data.id as string, created: true };
  });
}
