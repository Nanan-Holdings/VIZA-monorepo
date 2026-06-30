import * as http from "node:http";
import { putIndonesiaCardSession } from "./indonesia/card-session.js";
import { supabase } from "./supabase.js";
import { putVietnamCardSession } from "./vietnam/card-session.js";

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

function envEnabled(value: string | undefined): boolean {
  return /^(1|true|yes|on)$/i.test((value ?? "").trim());
}

function sendJson(res: http.ServerResponse, status: number, body: Record<string, unknown>): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

function isLocalRequest(req: http.IncomingMessage): boolean {
  const address = req.socket.remoteAddress ?? "";
  return ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(address);
}

async function readJsonBody(req: http.IncomingMessage, maxBytes = 4096): Promise<unknown> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > maxBytes) {
      throw new Error("Request body is too large.");
    }
    chunks.push(buffer);
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function handleVietnamCardSession(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  if (!envEnabled(process.env.VN_LOCAL_CARD_SESSION_ENABLED)) {
    sendJson(res, 404, { error: "not_found" });
    return;
  }
  if (!isLocalRequest(req)) {
    sendJson(res, 403, { error: "forbidden" });
    return;
  }

  try {
    const body = (await readJsonBody(req)) as Record<string, unknown>;
    const card = body.card && typeof body.card === "object" && !Array.isArray(body.card)
      ? (body.card as Record<string, unknown>)
      : {};
    const session = putVietnamCardSession({
      applicationId: typeof body.applicationId === "string" ? body.applicationId : "",
      card: {
        pan: typeof card.pan === "string" ? card.pan : null,
        expiry: typeof card.expiry === "string" ? card.expiry : null,
        cvv: typeof card.cvv === "string" ? card.cvv : null,
        holderName: typeof card.holderName === "string" ? card.holderName : null,
      },
    });
    sendJson(res, 200, { ok: true, ...session });
  } catch (error) {
    sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
  }
}

async function handleIndonesiaCardSession(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  if (!envEnabled(process.env.ID_LOCAL_CARD_SESSION_ENABLED)) {
    sendJson(res, 404, { error: "not_found" });
    return;
  }
  if (!isLocalRequest(req)) {
    sendJson(res, 403, { error: "forbidden" });
    return;
  }

  try {
    const body = (await readJsonBody(req)) as Record<string, unknown>;
    const card = body.card && typeof body.card === "object" && !Array.isArray(body.card)
      ? (body.card as Record<string, unknown>)
      : {};
    const session = putIndonesiaCardSession({
      applicationId: typeof body.applicationId === "string" ? body.applicationId : "",
      card: {
        pan: typeof card.pan === "string" ? card.pan : null,
        expiry: typeof card.expiry === "string" ? card.expiry : null,
        cvv: typeof card.cvv === "string" ? card.cvv : null,
        holderName: typeof card.holderName === "string" ? card.holderName : null,
      },
    });
    sendJson(res, 200, { ok: true, ...session });
  } catch (error) {
    sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
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
    if (req.method === "POST" && url === "/local/vietnam/card-session") {
      void handleVietnamCardSession(req, res);
      return;
    }
    if (req.method === "POST" && url === "/local/indonesia/card-session") {
      void handleIndonesiaCardSession(req, res);
      return;
    }
    if (req.method === "GET" && url === "/local/vietnam/card-session") {
      if (!envEnabled(process.env.VN_LOCAL_CARD_SESSION_ENABLED)) {
        sendJson(res, 404, { error: "not_found" });
        return;
      }
      if (!isLocalRequest(req)) {
        sendJson(res, 403, { error: "forbidden" });
        return;
      }
      sendJson(res, 200, { ok: true, enabled: true });
      return;
    }
    if (req.method === "GET" && url === "/local/indonesia/card-session") {
      if (!envEnabled(process.env.ID_LOCAL_CARD_SESSION_ENABLED)) {
        sendJson(res, 404, { error: "not_found" });
        return;
      }
      if (!isLocalRequest(req)) {
        sendJson(res, 403, { error: "forbidden" });
        return;
      }
      sendJson(res, 200, { ok: true, enabled: true });
      return;
    }
    sendJson(res, 404, { error: "not_found" });
  });

  server.listen(port, () => {
    const endpoints: string[] = [];
    if (envEnabled(process.env.VN_LOCAL_CARD_SESSION_ENABLED)) endpoints.push("/local/vietnam/card-session");
    if (envEnabled(process.env.ID_LOCAL_CARD_SESSION_ENABLED)) endpoints.push("/local/indonesia/card-session");
    const extra = endpoints.length ? `, ${endpoints.join(", ")}` : "";
    console.log(`[health] listening on :${port} (/health, /ready${extra})`);
  });
  return server;
}
