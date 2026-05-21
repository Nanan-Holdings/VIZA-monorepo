/// <reference lib="dom" />
/**
 * Parallel recon orchestrator (BOT-001).
 *
 * Fans out to every per-country `src/<country>/form-recon.ts` walker
 * concurrently — capped at MAX_BOTS (default 30) — and consolidates the
 * harvest into a single `recon-out/<YYYY-MM-DD>/<country>/` tree with
 * dom.html, screenshot.png, and selectors.json so we can refresh the
 * selector promotion pipeline (BOT-002) in one shot instead of pacing
 * one country at a time.
 *
 * Run:
 *   cd viza-be/submission-service
 *   npx ts-node scripts/parallel-recon.ts
 *
 * Env knobs:
 *   MAX_BOTS            concurrency cap (default 30)
 *   RECON_DEADLINE_MS   per-country wall-clock cap (default 300_000 = 5 min)
 *
 * UK is gated behind email-verified auth so its walker is headful + manual;
 * the orchestrator marks it `skipped` rather than burning a slot on it.
 */

import { spawn } from "node:child_process";
import * as fs from "node:fs/promises";
import * as path from "node:path";

interface CountryEntry {
  code: string;
  script: string;
  outSubdir: string;
  manual?: boolean;
  manualReason?: string;
}

const ROSTER: CountryEntry[] = [
  { code: "kh", script: "src/kh/form-recon.ts", outSubdir: "kh" },
  { code: "la", script: "src/la/form-recon.ts", outSubdir: "la" },
  { code: "lk", script: "src/lk/form-recon.ts", outSubdir: "lk" },
  { code: "za", script: "src/za/form-recon.ts", outSubdir: "za" },
  { code: "in", script: "src/in/form-recon.ts", outSubdir: "in" },
  { code: "egypt", script: "src/egypt/form-recon.ts", outSubdir: "egypt" },
  { code: "vietnam", script: "src/vietnam/form-recon.ts", outSubdir: "vietnam" },
  {
    code: "uk",
    script: "src/uk/form-recon.ts",
    outSubdir: "uk",
    manual: true,
    manualReason: "headful manual walk (auth-gated)",
  },
];

type CountryStatus =
  | "passed"
  | "blocked"
  | "not_found"
  | "timed_out"
  | "failed"
  | "skipped";

interface CountryResult {
  code: string;
  status: CountryStatus;
  durationMs: number;
  pagesOk: number;
  pagesTotal: number;
  notes?: string;
}

interface SummaryWalk {
  slug: string;
  status: string;
  url?: string;
  title?: string;
  fields?: number;
  notes?: string;
}

async function runOne(
  entry: CountryEntry,
  bucketDir: string,
  deadlineMs: number,
): Promise<CountryResult> {
  const started = Date.now();
  if (entry.manual) {
    console.log(`[${entry.code}] skipped — ${entry.manualReason}`);
    return {
      code: entry.code,
      status: "skipped",
      durationMs: 0,
      pagesOk: 0,
      pagesTotal: 0,
      notes: entry.manualReason,
    };
  }

  console.log(`[${entry.code}] spawn → ${entry.script}`);
  const cwd = path.resolve(__dirname, "..");
  const child = spawn("npx", ["ts-node", entry.script], {
    cwd,
    env: { ...process.env, RECON_HEADFUL: "0" },
    stdio: ["ignore", "pipe", "pipe"],
  });

  const chunks: string[] = [];
  child.stdout?.on("data", (b: Buffer) => chunks.push(b.toString()));
  child.stderr?.on("data", (b: Buffer) => chunks.push(b.toString()));

  let timedOut = false;
  const killer = setTimeout(() => {
    timedOut = true;
    child.kill("SIGKILL");
  }, deadlineMs);

  const exitCode: number | null = await new Promise((resolve) => {
    child.on("close", (code) => resolve(code));
  });
  clearTimeout(killer);

  const durationMs = Date.now() - started;
  const destDir = path.join(bucketDir, entry.code);
  await fs.mkdir(destDir, { recursive: true });
  await fs.writeFile(path.join(destDir, "child.log"), chunks.join(""), "utf8");

  if (timedOut) {
    return {
      code: entry.code,
      status: "timed_out",
      durationMs,
      pagesOk: 0,
      pagesTotal: 0,
      notes: `killed after ${(deadlineMs / 1000).toFixed(0)}s`,
    };
  }
  if (exitCode !== 0) {
    return {
      code: entry.code,
      status: "failed",
      durationMs,
      pagesOk: 0,
      pagesTotal: 0,
      notes: `exit ${exitCode}`,
    };
  }

  const sourceDir = path.resolve(cwd, "recon-out", entry.outSubdir);
  const collected = await collectArtifacts(entry.code, sourceDir, destDir);
  return { ...collected, durationMs };
}

async function collectArtifacts(
  code: string,
  sourceDir: string,
  destDir: string,
): Promise<Omit<CountryResult, "durationMs">> {
  const summaryPath = path.join(sourceDir, "summary.json");
  let walks: SummaryWalk[] = [];
  try {
    const raw = await fs.readFile(summaryPath, "utf8");
    walks = (JSON.parse(raw).walks as SummaryWalk[]) || [];
  } catch {
    return {
      code,
      status: "failed",
      pagesOk: 0,
      pagesTotal: 0,
      notes: "summary.json missing",
    };
  }

  const okWalk = walks.find((w) => w.status === "ok") || walks[0];
  if (okWalk) {
    await safeCopy(
      path.join(sourceDir, `${okWalk.slug}.html`),
      path.join(destDir, "dom.html"),
    );
    await safeCopy(
      path.join(sourceDir, `${okWalk.slug}.png`),
      path.join(destDir, "screenshot.png"),
    );
  }
  await safeCopy(path.join(sourceDir, "fields.json"), path.join(destDir, "selectors.json"));
  await safeCopy(summaryPath, path.join(destDir, "summary.json"));

  const pagesOk = walks.filter((w) => w.status === "ok").length;
  const pagesTotal = walks.length;
  const blocked = walks.find((w) => w.status === "blocked");
  const notFound = walks.find((w) => w.status === "not_found");
  if (blocked) {
    return {
      code,
      status: "blocked",
      pagesOk,
      pagesTotal,
      notes: `${blocked.slug} hit anti-bot / cf challenge`,
    };
  }
  if (notFound) {
    return {
      code,
      status: "not_found",
      pagesOk,
      pagesTotal,
      notes: `${notFound.slug} returned 404`,
    };
  }
  if (pagesOk === 0) {
    return { code, status: "failed", pagesOk, pagesTotal, notes: "no ok pages" };
  }
  return { code, status: "passed", pagesOk, pagesTotal };
}

async function safeCopy(src: string, dest: string): Promise<void> {
  try {
    await fs.copyFile(src, dest);
  } catch {
    // source may legitimately be absent (e.g. screenshot timed out) — leave gap
  }
}

async function main(): Promise<void> {
  const maxBots = Math.max(1, Number(process.env.MAX_BOTS || "30"));
  const deadlineMs = Math.max(
    60_000,
    Number(process.env.RECON_DEADLINE_MS || String(5 * 60 * 1000)),
  );
  const date = new Date().toISOString().slice(0, 10);
  const cwd = path.resolve(__dirname, "..");
  const bucketDir = path.resolve(cwd, "recon-out", date);
  await fs.mkdir(bucketDir, { recursive: true });

  console.log(
    `[parallel-recon] start date=${date} maxBots=${maxBots} deadline=${(deadlineMs / 1000).toFixed(0)}s countries=${ROSTER.length}`,
  );

  const queue = [...ROSTER];
  const results: CountryResult[] = [];
  const inFlight = new Set<Promise<CountryResult>>();

  const launch = (entry: CountryEntry): void => {
    const p = runOne(entry, bucketDir, deadlineMs)
      .then((r) => {
        results.push(r);
        console.log(
          `[${r.code}] ${r.status} pages=${r.pagesOk}/${r.pagesTotal} ${(r.durationMs / 1000).toFixed(0)}s ${r.notes ? `— ${r.notes}` : ""}`,
        );
        return r;
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        const r: CountryResult = {
          code: entry.code,
          status: "failed",
          durationMs: 0,
          pagesOk: 0,
          pagesTotal: 0,
          notes: msg,
        };
        results.push(r);
        console.log(`[${entry.code}] failed — ${msg}`);
        return r;
      })
      .finally(() => {
        inFlight.delete(p);
      });
    inFlight.add(p);
  };

  while (queue.length > 0 || inFlight.size > 0) {
    while (inFlight.size < maxBots && queue.length > 0) {
      launch(queue.shift()!);
    }
    if (inFlight.size > 0) {
      await Promise.race(inFlight);
    }
  }

  const statusOrder: CountryStatus[] = [
    "passed",
    "blocked",
    "not_found",
    "timed_out",
    "failed",
    "skipped",
  ];
  results.sort(
    (a, b) =>
      statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status) ||
      a.code.localeCompare(b.code),
  );

  const flagged = results.filter(
    (r) =>
      r.status === "blocked" ||
      r.status === "not_found" ||
      r.status === "timed_out" ||
      r.status === "failed",
  );

  console.log("\n=== parallel-recon summary ===");
  console.log("country  status      pages   time     notes");
  console.log("-------  ----------  ------  -------  ----------------------------------");
  for (const r of results) {
    const pages = `${r.pagesOk}/${r.pagesTotal}`.padEnd(6);
    const time = `${(r.durationMs / 1000).toFixed(0)}s`.padEnd(7);
    console.log(
      `${r.code.padEnd(7)}  ${r.status.padEnd(10)}  ${pages}  ${time}  ${r.notes || ""}`,
    );
  }
  console.log(
    `\n[parallel-recon] ${results.length} countries · ${flagged.length} flagged · bucket=${bucketDir}`,
  );

  await fs.writeFile(
    path.join(bucketDir, "summary.json"),
    JSON.stringify({ date, maxBots, deadlineMs, results }, null, 2),
    "utf8",
  );
}

main().catch((err) => {
  console.error(
    "[parallel-recon] fatal:",
    err instanceof Error ? err.message : String(err),
  );
  process.exit(1);
});
