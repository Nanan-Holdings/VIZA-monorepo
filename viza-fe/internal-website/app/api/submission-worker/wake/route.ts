import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { wakeCloudSubmissionWorker } from "@/lib/submission-worker-wake.server";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { jobId?: unknown } | null;
  const jobId = typeof body?.jobId === "string" ? body.jobId : null;
  const result = await wakeCloudSubmissionWorker(jobId);
  if (!result.ok) {
    return NextResponse.json(
      { error: "Cloud submission worker wake is temporarily unavailable.", reason: result.reason },
      {
        status:
          result.reason === "cutover_paused" ||
          result.reason === "not_configured" ||
          result.reason === "insecure_url"
            ? 503
            : 502,
      },
    );
  }

  return NextResponse.json({ ok: true, accepted: true }, { status: 202 });
}
