import { EventEmitter } from "node:events";
import type { Request, Response } from "express";
import { describe, expect, it } from "vitest";

import { createRequestAbortSignal } from "./request-abort.js";

function fakeHttpPair(): {
  req: Request;
  res: Response;
  reqEvents: EventEmitter;
  resEvents: EventEmitter & { writableFinished: boolean };
} {
  const reqEvents = new EventEmitter();
  const resEvents = Object.assign(new EventEmitter(), { writableFinished: false });
  return {
    req: reqEvents as unknown as Request,
    res: resEvents as unknown as Response,
    reqEvents,
    resEvents,
  };
}

describe("createRequestAbortSignal", () => {
  it("aborts on a prematurely closed response", () => {
    const { req, res, resEvents } = fakeHttpPair();
    const signal = createRequestAbortSignal(req, res);
    resEvents.emit("close");
    expect(signal.aborted).toBe(true);
  });

  it("does not abort after a normally finished response", () => {
    const { req, res, resEvents } = fakeHttpPair();
    const signal = createRequestAbortSignal(req, res);
    resEvents.writableFinished = true;
    resEvents.emit("finish");
    resEvents.emit("close");
    expect(signal.aborted).toBe(false);
  });
});
