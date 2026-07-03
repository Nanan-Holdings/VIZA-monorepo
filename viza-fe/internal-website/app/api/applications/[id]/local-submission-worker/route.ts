import { execFile } from "child_process";
import * as path from "path";
import { promisify } from "util";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);

function isLocalRequest(request: Request): boolean {
  const host = request.headers.get("host")?.toLowerCase() ?? "";
  return host.startsWith("localhost:") ||
    host.startsWith("127.0.0.1:") ||
    host.startsWith("[::1]:");
}

async function isSubmissionWorkerRunning(): Promise<boolean> {
  if (process.platform === "win32") {
    const script = [
      "$p = Get-CimInstance Win32_Process | Where-Object {",
      "$_.Name -eq 'node.exe' -and",
      "($_.CommandLine -match 'viza-be\\\\submission-service' -or $_.CommandLine -match 'ts-node-js-resolver\\.cjs')",
      "};",
      "if ($p) { 'running' }",
    ].join(" ");
    const { stdout } = await execFileAsync("powershell.exe", [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      script,
    ]);
    return stdout.toLowerCase().includes("running");
  }

  const { stdout } = await execFileAsync("sh", [
    "-lc",
    "ps -eo command | grep 'submission-service' | grep 'src/index.ts' | grep -v grep || true",
  ]);
  return stdout.trim().length > 0;
}

async function stopSubmissionWorker(): Promise<void> {
  if (process.platform !== "win32") {
    await execFileAsync("sh", [
      "-lc",
      "pkill -f 'viza-be/submission-service' || true",
    ]);
    return;
  }

  const script = [
    "$targets = Get-CimInstance Win32_Process | Where-Object {",
    "($_.Name -eq 'node.exe' -and ($_.CommandLine -match 'viza-be\\\\submission-service' -or $_.CommandLine -match 'ts-node-js-resolver\\.cjs')) -or",
    "($_.Name -eq 'cmd.exe' -and $_.CommandLine -match 'start-indonesia-submission-worker')",
    "};",
    "$targets | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }",
  ].join(" ");
  await execFileAsync("powershell.exe", [
    "-NoProfile",
    "-NonInteractive",
    "-Command",
    script,
  ]);
}

function psQuote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

async function startSubmissionWorker(): Promise<{ pid: number | null; launchPath: string }> {
  const repoRoot = path.resolve(process.cwd(), "..", "..");
  const workerDir = path.join(repoRoot, "viza-be", "submission-service");
  if (process.platform === "win32") {
    const launchPath = path.join(repoRoot, "scripts", "start-indonesia-submission-worker.cmd");
    const script = [
      `$p = Start-Process -FilePath ${psQuote(launchPath)} -WorkingDirectory ${psQuote(repoRoot)} -PassThru;`,
      "$p.Id",
    ].join(" ");
    const { stdout } = await execFileAsync("powershell.exe", [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      script,
    ]);
    const pid = Number.parseInt(stdout.trim(), 10);
    return { pid: Number.isFinite(pid) ? pid : null, launchPath };
  }

  const launchPath = path.join(workerDir, "npm-run-dev");
  await execFileAsync("sh", [
    "-lc",
    `cd ${JSON.stringify(workerDir)} && nohup npm run dev >/tmp/viza-submission-service.log 2>&1 &`,
  ]);
  return { pid: null, launchPath };
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  if (!isLocalRequest(request)) {
    return NextResponse.json({ error: "Local worker start is only available from localhost." }, { status: 403 });
  }

  const { id: applicationId } = await context.params;
  if (!applicationId) {
    return NextResponse.json({ error: "Missing application id" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("applicant_profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }
  if (!profile) {
    return NextResponse.json({ error: "Applicant profile not found" }, { status: 404 });
  }

  const { data: application, error: applicationError } = await admin
    .from("applications")
    .select("id, applicant_id")
    .eq("id", applicationId)
    .maybeSingle();
  if (applicationError) {
    return NextResponse.json({ error: applicationError.message }, { status: 500 });
  }
  if (!application) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }
  if (application.applicant_id !== profile.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = (await request.json().catch(() => null)) as { restart?: unknown } | null;
    const restart = body?.restart === true;

    if (await isSubmissionWorkerRunning()) {
      return NextResponse.json({ ok: true, alreadyRunning: true, restarted: false });
    }

    if (restart) {
      await stopSubmissionWorker();
      await new Promise((resolve) => setTimeout(resolve, 750));
    }

    const started = await startSubmissionWorker();
    await new Promise((resolve) => setTimeout(resolve, 8_000));
    const running = await isSubmissionWorkerRunning().catch(() => false);
    if (!running) {
      return NextResponse.json(
        {
          error: "Local submission worker did not start. Open scripts/start-indonesia-submission-worker.cmd and keep that window running.",
          launchPath: started.launchPath,
        },
        { status: 500 },
      );
    }
    return NextResponse.json({
      ok: true,
      alreadyRunning: false,
      pid: started.pid,
      launchPath: started.launchPath,
      running,
      restarted: restart,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
