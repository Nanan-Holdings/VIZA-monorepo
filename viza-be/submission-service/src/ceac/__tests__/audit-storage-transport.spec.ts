import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { createDs160AuditStorageTransport } from "../audit-storage-transport";
import { writeDs160AuditArtifact } from "../audit-storage";

async function withStorageServer(
  handle: http.RequestListener,
  run: (url: string) => Promise<void>,
): Promise<void> {
  const server = http.createServer(handle);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert(address && typeof address !== "string");
  try { await run(`http://127.0.0.1:${address.port}`); }
  finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}

test("real SDK recovers committed ciphertext after a storage response failure without signing URLs or rewriting", async () => {
  let stored: Buffer | null = null;
  const methods: string[] = [];
  const requests: string[] = [];
  await withStorageServer((req, res) => {
    methods.push(req.method ?? "");
    requests.push(req.url ?? "");
    assert.equal(req.headers["x-upsert"] ?? "false", "false");
    if (req.method === "POST") {
      const chunks: Buffer[] = [];
      req.on("data", chunk => chunks.push(Buffer.from(chunk)));
      req.on("end", () => {
        stored = Buffer.concat(chunks);
        res.writeHead(503, { "content-type": "application/json" });
        res.end(JSON.stringify({ statusCode: "503", message: "The connection to the database timed out" }));
      });
    } else {
      res.writeHead(200, { "content-type": "application/octet-stream" });
      res.end(stored);
    }
  }, async url => {
    const result = await writeDs160AuditArtifact({
      jobId: "fixture", runId: "fixture-run",
      transport: createDs160AuditStorageTransport({ url, key: "fixture-key" }),
    }, "pre-sign-review.enc", "encrypted-fixture");
    assert.equal(result.sizeBytes, 17);
    assert.deepEqual(methods, ["POST", "GET"]);
    assert.equal(stored?.toString(), "encrypted-fixture");
    assert(requests.every(value => !value.includes("/sign/")));
  });
});

test("actual upload request honors cancellation and does not outlive its caller", async () => {
  let received: (() => void) | undefined;
  const started = new Promise<void>(resolve => { received = resolve; });
  await withStorageServer((_req, _res) => { received?.(); }, async url => {
    const controller = new AbortController();
    const transport = createDs160AuditStorageTransport({ url, key: "fixture-key" });
    const operation = transport.upload({ path: "jobs/fixture/run/pre-sign-review.enc", body: Buffer.from("ciphertext"), contentType: "application/octet-stream", signal: controller.signal });
    const rejected = assert.rejects(operation, error => error instanceof Error && error.name === "AbortError");
    await started;
    controller.abort();
    await rejected;
  });
});

test("only explicit missing objects reconcile as absent; missing buckets and authorization remain errors", async () => {
  for (const [message, absent] of [["Object not found", true], ["Bucket not found", false], ["Unauthorized", false]] as const) {
    await withStorageServer((_req, res) => {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ statusCode: message === "Unauthorized" ? "403" : "404", message }));
    }, async url => {
      const transport = createDs160AuditStorageTransport({ url, key: "fixture-key" });
      const result = transport.download({ path: "jobs/fixture/run/official-evidence.enc", signal: new AbortController().signal });
      if (absent) assert.equal(await result, null);
      else await assert.rejects(result, error => error instanceof Error && error.message === message);
    });
  }
});
