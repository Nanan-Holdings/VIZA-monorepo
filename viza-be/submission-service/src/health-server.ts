import * as http from "node:http";
import { supabase } from "./supabase.js";

/**
 * DEP-004: minimal HTTP server for Cloud Run health probes.
 *
 *   GET /health → 200 if the process is up.
 *   GET /ready  → 200 if the DB is reachable AND the worker loop has started;
 *                 503 otherwise.
 *
 * Port from PORT env (Cloud Run convention), default 8080. The worker-started
 * signal is supplied by the caller via `isWorkerStarted`.
 */
export interface HealthServerOptions {
  isWorkerStarted: () => boolean;
  port?: number;
}

async function dbReachable(): Promise<boolean> {
  try {
    const { error } = await supabase.from("runner_job").select("id", { head: true }).limit(1);
    return !error;
  } catch {
    return false;
  }
}

export function startHealthServer(opts: HealthServerOptions): http.Server {
  const port = opts.port ?? Number(process.env.PORT ?? 8080);

  const server = http.createServer((req, res) => {
    const url = req.url ?? "/";
    if (req.method === "GET" && url === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
      return;
    }
    if (req.method === "GET" && url === "/ready") {
      void (async () => {
        const reachable = await dbReachable();
        const ready = reachable && opts.isWorkerStarted();
        res.writeHead(ready ? 200 : 503, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            status: ready ? "ready" : "not_ready",
            dbReachable: reachable,
            workerStarted: opts.isWorkerStarted(),
          }),
        );
      })();
      return;
    }
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "not_found" }));
  });

  server.listen(port, () => {
    console.log(`[health] listening on :${port} (/health, /ready)`);
  });
  return server;
}
