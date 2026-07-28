import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/rbac";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

interface JobRow {
  id: string;
  application_id: string;
  country: string;
  status: string;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  enqueued_at: string;
  started_at: string | null;
  finished_at: string | null;
  metadata: Record<string, unknown> | null;
}

interface ArtifactEntry {
  name: string;
  signedUrl: string;
}

interface StepRow {
  id: number;
  step_index: number;
  name: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  screenshot_path: string | null;
  har_path: string | null;
  console_path: string | null;
  error: string | null;
  metadata: Record<string, unknown> | null;
}

const ARTIFACT_BUCKET = "submission-artifacts";
const SIGNED_TTL_S = 300;

async function listJobArtifacts(jobId: string): Promise<ArtifactEntry[]> {
  const admin = createAdminClient();
  const prefix = `jobs/${jobId}`;
  const { data, error } = await admin.storage
    .from(ARTIFACT_BUCKET)
    .list(prefix, { limit: 200 });
  if (error || !data) return [];
  const entries: ArtifactEntry[] = [];
  for (const obj of data) {
    const path = `${prefix}/${obj.name}`;
    const { data: signed } = await admin.storage
      .from(ARTIFACT_BUCKET)
      .createSignedUrl(path, SIGNED_TTL_S);
    if (!signed) continue;
    entries.push({ name: obj.name, signedUrl: signed.signedUrl });
  }
  return entries;
}

export default async function AdminJobDetailPage({ params }: PageProps) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") redirect("/admin/login");

  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from("runner_job")
    .select(
      "id, application_id, country, status, attempts, max_attempts, last_error, enqueued_at, started_at, finished_at, metadata",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) {
    return (
      <div className="w-full p-6 md:p-8">
        <p className="text-sm text-red-600">{error.message}</p>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="w-full p-6 md:p-8">
        <p className="text-sm text-[#6b6b6b]">Job not found.</p>
      </div>
    );
  }

  const job = data as JobRow;
  const artefacts = await listJobArtifacts(id);

  // OPS-002: per-step trace + diff against the previous run for the
  // same application.
  const { data: stepRows } = await adminClient
    .from("runner_step_log")
    .select(
      "id, step_index, name, status, started_at, finished_at, screenshot_path, har_path, console_path, error, metadata",
    )
    .eq("job_id", id)
    .order("step_index", { ascending: true });
  const steps = (stepRows ?? []) as StepRow[];

  const { data: priorJob } = await adminClient
    .from("runner_job")
    .select("id, started_at")
    .eq("application_id", job.application_id)
    .lt("started_at", job.started_at ?? new Date().toISOString())
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: priorStepRows } = priorJob
    ? await adminClient
        .from("runner_step_log")
        .select("step_index, name, status")
        .eq("job_id", priorJob.id)
        .order("step_index", { ascending: true })
    : { data: [] as Array<{ step_index: number; name: string; status: string }> };
  const priorSteps = priorStepRows ?? [];

  const stepLinks = await Promise.all(
    steps.map(async (s) => {
      const sign = async (p: string | null) => {
        if (!p) return null;
        const { data: signed } = await adminClient.storage
          .from(ARTIFACT_BUCKET)
          .createSignedUrl(p, SIGNED_TTL_S);
        return signed?.signedUrl ?? null;
      };
      return {
        ...s,
        screenshotUrl: await sign(s.screenshot_path),
        harUrl: await sign(s.har_path),
        consoleUrl: await sign(s.console_path),
      };
    }),
  );

  // Diff: walk both lists by step_index, label changes.
  const diff = stepLinks.map((s) => {
    const prior = priorSteps.find((p) => p.step_index === s.step_index);
    if (!prior) return { ...s, diff: "added" as const };
    if (prior.name !== s.name) return { ...s, diff: "renamed" as const };
    if (prior.status !== s.status) return { ...s, diff: "status" as const };
    return { ...s, diff: "same" as const };
  });

  return (
    <div className="w-full p-6 md:p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <Link
          href="/admin"
          className="text-sm text-brand-500 hover:underline mb-1 inline-block"
        >
          &larr; Back
        </Link>
        <h1 className="text-2xl font-semibold text-[#232323]">
          Runner job {job.id.slice(0, 8)}
        </h1>
        <p className="text-sm text-[#6b6b6b]">
          {job.country} · status {job.status} · attempts {job.attempts}/
          {job.max_attempts}
        </p>
      </div>

      <div className="bg-white rounded-lg border border-[#efefef] shadow-sm p-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
        <div>
          <p className="text-[#6b6b6b]">Enqueued</p>
          <p className="font-mono">{new Date(job.enqueued_at).toLocaleString()}</p>
        </div>
        <div>
          <p className="text-[#6b6b6b]">Started</p>
          <p className="font-mono">
            {job.started_at ? new Date(job.started_at).toLocaleString() : "—"}
          </p>
        </div>
        <div>
          <p className="text-[#6b6b6b]">Finished</p>
          <p className="font-mono">
            {job.finished_at ? new Date(job.finished_at).toLocaleString() : "—"}
          </p>
        </div>
        <div className="md:col-span-3">
          <p className="text-[#6b6b6b]">Application</p>
          <p className="font-mono">
            <Link
              href={`/admin/users/${job.application_id}`}
              className="text-brand-500 hover:underline"
            >
              {job.application_id}
            </Link>
          </p>
        </div>
        {job.last_error ? (
          <div className="md:col-span-3">
            <p className="text-[#6b6b6b]">Last error</p>
            <pre className="text-xs whitespace-pre-wrap text-red-700">
              {job.last_error}
            </pre>
          </div>
        ) : null}
      </div>

      <div className="bg-white rounded-lg border border-[#efefef] shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b bg-[#fafafa]">
          <h2 className="font-semibold text-[#232323]">Artefacts</h2>
          <p className="text-xs text-[#6b6b6b]">
            R2 / Supabase Storage at <code>jobs/{job.id}/</code> · signed URLs
            valid for {SIGNED_TTL_S}s
          </p>
        </div>
        {artefacts.length === 0 ? (
          <p className="p-6 text-sm text-[#9ca3af]">No artefacts recorded.</p>
        ) : (
          <ul className="divide-y">
            {artefacts.map((a) => (
              <li key={a.name} className="px-4 py-2 flex items-center justify-between">
                <span className="font-mono text-xs text-[#232323]">{a.name}</span>
                <a
                  href={a.signedUrl}
                  className="text-xs text-brand-500 hover:underline"
                >
                  Download
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-white rounded-lg border border-[#efefef] shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b bg-[#fafafa] flex items-center justify-between">
          <h2 className="font-semibold text-[#232323]">Step timeline</h2>
          <span className="text-xs text-[#6b6b6b]">
            {priorJob
              ? `diff vs job ${priorJob.id.slice(0, 8)}`
              : "no previous run"}
          </span>
        </div>
        {diff.length === 0 ? (
          <p className="p-6 text-sm text-[#9ca3af]">
            No step trace recorded for this job yet.
          </p>
        ) : (
          <ul className="divide-y">
            {diff.map((s) => (
              <li key={s.id} className="px-4 py-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-[#6b6b6b] w-8">
                    {String(s.step_index).padStart(3, "0")}
                  </span>
                  <span className="font-medium text-[#232323]">{s.name}</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded border ${
                      s.status === "failed"
                        ? "border-red-200 bg-red-50 text-red-700"
                        : s.status === "ok"
                          ? "border-green-200 bg-green-50 text-green-700"
                          : "border-amber-200 bg-amber-50 text-amber-700"
                    }`}
                  >
                    {s.status}
                  </span>
                  {s.diff !== "same" ? (
                    <span className="text-xs text-[#6b6b6b]">[{s.diff}]</span>
                  ) : null}
                </div>
                <div className="text-xs text-[#6b6b6b] mt-1">
                  {new Date(s.started_at).toLocaleTimeString()}
                  {s.finished_at
                    ? ` → ${new Date(s.finished_at).toLocaleTimeString()}`
                    : ""}
                </div>
                {s.error ? (
                  <pre className="text-xs text-red-700 whitespace-pre-wrap mt-1">
                    {s.error}
                  </pre>
                ) : null}
                <div className="flex gap-3 mt-2">
                  {s.screenshotUrl ? (
                    <a
                      href={s.screenshotUrl}
                      className="text-xs text-brand-500 hover:underline"
                    >
                      screenshot
                    </a>
                  ) : null}
                  {s.harUrl ? (
                    <a
                      href={s.harUrl}
                      className="text-xs text-brand-500 hover:underline"
                    >
                      HAR
                    </a>
                  ) : null}
                  {s.consoleUrl ? (
                    <a
                      href={s.consoleUrl}
                      className="text-xs text-brand-500 hover:underline"
                    >
                      console
                    </a>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {job.metadata ? (
        <details className="bg-white rounded-lg border border-[#efefef] shadow-sm p-4">
          <summary className="cursor-pointer text-sm text-[#6b6b6b]">
            Metadata (proxy session, correlation ids)
          </summary>
          <pre className="mt-2 text-xs whitespace-pre-wrap font-mono">
            {JSON.stringify(job.metadata, null, 2)}
          </pre>
        </details>
      ) : null}
    </div>
  );
}
