import { createServer, request as httpRequest, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { Request, Response } from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ocr = vi.hoisted(() => ({ handle: vi.fn<[Request, Response], void>() }));

vi.mock("./routes/passport-scan.routes.js", async () => {
  const { Router } = await import("express");
  return { default: Router().post("/extract", (req, res) => ocr.handle(req, res)) };
});
vi.mock("./db/index.js", () => ({
  db: { execute: vi.fn() },
  getDatabasePoolMetrics: vi.fn(),
  getDatabaseQueryMetrics: vi.fn(),
}));

let server: Server;

async function startApp(): Promise<Server> {
  const { default: app } = await import("./app.js");
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return server;
}

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("PASSPORT_SCAN_MAX_IN_FLIGHT", "4");
  ocr.handle.mockReset();
  ocr.handle.mockImplementation((_req, res) => res.json({ error: false }));
});

afterEach(async () => {
  if (server?.listening) {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
      server.closeAllConnections();
    });
  }
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("OCR admission before the production app body parsers", () => {
  it("admits four large uploads, rejects 96 overlapping requests before JSON parsing, and keeps liveness available", async () => {
    await startApp();
    const held: Response[] = [];
    let signalAdmitted: () => void = () => {};
    const allAdmitted = new Promise<void>((resolve) => { signalAdmitted = resolve; });
    ocr.handle.mockImplementation((req, res) => {
      // Larger than the ordinary API parser limit, but valid for OCR.
      expect(req.body.imageBase64.length).toBe(1024 * 1024 + 1);
      held.push(res);
      if (held.length === 4) signalAdmitted();
    });
    const accepted = Array.from({ length: 4 }, () => request(server)
      .post("/api/passport-scan/extract")
      .send({ imageBase64: "a".repeat(1024 * 1024 + 1), mediaType: "image/jpeg" })
      .expect(200)
      .then((response) => response));

    try {
      await allAdmitted;
      const overflow = await Promise.all(Array.from({ length: 96 }, () => request(server)
        .post("/api/passport-scan/extract")
        .type("json")
        .send("{not valid JSON")));
      for (const response of overflow) {
        expect(response.status).toBe(503);
        expect(response.headers["retry-after"]).toBe("2");
        expect(response.headers["connection"]).toBe("close");
        expect(response.headers["cache-control"]).toBe("no-store");
        expect(response.body).toEqual({ error: true, message: "OCR service is busy; retry shortly" });
      }
      expect(ocr.handle).toHaveBeenCalledTimes(4);
      await request(server).get("/live").expect(200, { status: "ok" });
      // Other routes retain their smaller parser and normal error contract.
      await request(server).post("/not-an-ocr-route")
        .send({ padding: "a".repeat(1024 * 1024 + 1) }).expect(413);
    } finally {
      for (const response of held) response.json({ error: false });
      await Promise.all(accepted);
    }

    ocr.handle.mockImplementation((_req, res) => res.json({ error: false }));
    await request(server).post("/api/passport-scan/extract")
      .send({ imageBase64: "ZmFrZQ==" }).expect(200);
  });

  it("releases aborted incomplete uploads so a new request can proceed", async () => {
    await startApp();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const partial: Array<{
      client: ReturnType<typeof httpRequest>;
      incoming: IncomingMessage;
      closed: Promise<void>;
    }> = [];
    const { port } = server.address() as AddressInfo;
    try {
      for (let index = 0; index < 4; index += 1) {
        const observed = new Promise<IncomingMessage>((resolve) => server.once("request", resolve));
        const client = httpRequest({
          hostname: "127.0.0.1", port, path: "/api/passport-scan/extract", method: "POST",
          headers: { "Content-Type": "application/json", "Content-Length": "1024" },
        });
        client.on("error", () => {});
        client.write('{"imageBase64":"');
        const incoming = await observed;
        const closed = new Promise<void>((resolve) => incoming.once("close", resolve));
        partial.push({ client, incoming, closed });
      }

      await request(server).post("/api/passport-scan/extract")
        .send({ imageBase64: "ZmFrZQ==" }).expect(503);
      expect(ocr.handle).not.toHaveBeenCalled();

      const first = partial[0]!;
      const aborted = new Promise<void>((resolve) => first.incoming.once("aborted", resolve));
      first.client.destroy();
      await aborted;
      await request(server).post("/api/passport-scan/extract")
        .send({ imageBase64: "ZmFrZQ==" }).expect(200);
      expect(ocr.handle).toHaveBeenCalledOnce();
    } finally {
      for (const upload of partial) upload.client.destroy();
      await Promise.all(partial.map((upload) => upload.closed));
      // Let body-parser's deferred abort callbacks finish before restoring spies.
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
  });

  it("releases admission after malformed and oversized bodies without changing parser limits", async () => {
    await startApp();
    vi.spyOn(console, "error").mockImplementation(() => {});
    for (let index = 0; index < 5; index += 1) {
      // The existing global error handler maps JSON parse errors to 500.
      await request(server).post("/api/passport-scan/extract")
        .type("json").send("{not valid JSON").expect(500);
    }
    await request(server).post("/api/passport-scan/extract")
      .send({ padding: "a".repeat(16 * 1024 * 1024) }).expect(413);
    expect(ocr.handle).not.toHaveBeenCalled();
    await request(server).post("/api/passport-scan/extract")
      .send({ imageBase64: "ZmFrZQ==" }).expect(200);
  });
});
