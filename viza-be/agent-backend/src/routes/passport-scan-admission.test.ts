import { EventEmitter } from "node:events";
import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";

import {
  createPassportScanAdmission,
  readPassportScanMaxInFlight,
} from "./passport-scan-admission.js";

type ResponseStub = EventEmitter & {
  body?: unknown;
  headers: Record<string, string>;
  statusCode: number;
  json: (body: unknown) => ResponseStub;
  set: (name: string, value: string) => ResponseStub;
  status: (code: number) => ResponseStub;
};

function fakeRequest(): Request {
  return new EventEmitter() as unknown as Request;
}

function fakeResponse(): ResponseStub {
  const response = new EventEmitter() as ResponseStub;
  response.body = undefined;
  response.headers = {};
  response.statusCode = 200;
  response.set = (name, value) => {
    response.headers[name.toLowerCase()] = value;
    return response;
  };
  response.status = (code) => {
    response.statusCode = code;
    return response;
  };
  response.json = (body) => {
    response.body = body;
    return response;
  };
  return response;
}

function runAdmission(
  admission: ReturnType<typeof createPassportScanAdmission>,
  req: Request,
  res: ResponseStub,
  next: NextFunction,
): void {
  admission(req, res as unknown as Response, next);
}

describe("passport scan admission", () => {
  it("uses the default, clamps the environment value, and rejects invalid limits", () => {
    expect(readPassportScanMaxInFlight({})).toBe(4);
    expect(readPassportScanMaxInFlight({ PASSPORT_SCAN_MAX_IN_FLIGHT: "8" })).toBe(8);
    expect(readPassportScanMaxInFlight({ PASSPORT_SCAN_MAX_IN_FLIGHT: "99" })).toBe(16);
    expect(readPassportScanMaxInFlight({ PASSPORT_SCAN_MAX_IN_FLIGHT: "0" })).toBe(4);
    expect(readPassportScanMaxInFlight({ PASSPORT_SCAN_MAX_IN_FLIGHT: "not-a-number" })).toBe(4);

    expect(() => createPassportScanAdmission(0)).toThrowError(
      "Invalid passport scan admission limit",
    );
    expect(() => createPassportScanAdmission(17)).toThrowError(
      "Invalid passport scan admission limit",
    );
    expect(() => createPassportScanAdmission(1.5)).toThrowError(
      "Invalid passport scan admission limit",
    );
  });

  it("rejects overflow before reading the upload body or calling next", () => {
    const admission = createPassportScanAdmission(1);
    const acceptedRequest = fakeRequest();
    const acceptedResponse = fakeResponse();
    const acceptedNext = vi.fn<NextFunction>();
    runAdmission(admission, acceptedRequest, acceptedResponse, acceptedNext);
    expect(acceptedNext).toHaveBeenCalledOnce();

    const overflowRequest = fakeRequest();
    const overflowResponse = fakeResponse();
    const overflowNext = vi.fn<NextFunction>();
    runAdmission(admission, overflowRequest, overflowResponse, overflowNext);

    expect(overflowNext).not.toHaveBeenCalled();
    expect(overflowResponse.statusCode).toBe(503);
    expect(overflowResponse.headers).toMatchObject({
      "connection": "close",
      "cache-control": "no-store",
      "retry-after": "2",
    });
    expect(overflowResponse.body).toEqual({
      error: true,
      message: "OCR service is busy; retry shortly",
    });
    expect(overflowRequest.listenerCount("data")).toBe(0);
    expect(overflowRequest.listenerCount("readable")).toBe(0);
  });

  it("releases once when finish and close are both emitted", () => {
    const admission = createPassportScanAdmission(1);
    const firstNext = vi.fn<NextFunction>();
    const firstResponse = fakeResponse();
    runAdmission(admission, fakeRequest(), firstResponse, firstNext);

    firstResponse.emit("finish");
    firstResponse.emit("close");

    const secondNext = vi.fn<NextFunction>();
    const secondResponse = fakeResponse();
    runAdmission(admission, fakeRequest(), secondResponse, secondNext);
    expect(secondNext).toHaveBeenCalledOnce();

    const overflowNext = vi.fn<NextFunction>();
    runAdmission(admission, fakeRequest(), fakeResponse(), overflowNext);
    expect(overflowNext).not.toHaveBeenCalled();
  });

  it("keeps admission after request close until response close or request abort", () => {
    const admission = createPassportScanAdmission(1);
    const firstRequest = fakeRequest();
    const firstResponse = fakeResponse();
    const firstNext = vi.fn<NextFunction>();
    runAdmission(admission, firstRequest, firstResponse, firstNext);
    firstRequest.emit("close");

    const blockedNext = vi.fn<NextFunction>();
    runAdmission(admission, fakeRequest(), fakeResponse(), blockedNext);
    expect(blockedNext).not.toHaveBeenCalled();

    firstResponse.emit("close");
    const admittedAfterResponseClose = vi.fn<NextFunction>();
    const activeAfterResponseCloseRequest = fakeRequest();
    const activeAfterResponseCloseResponse = fakeResponse();
    runAdmission(
      admission,
      activeAfterResponseCloseRequest,
      activeAfterResponseCloseResponse,
      admittedAfterResponseClose,
    );
    expect(admittedAfterResponseClose).toHaveBeenCalledOnce();
    activeAfterResponseCloseResponse.emit("close");

    const secondRequest = fakeRequest();
    const secondResponse = fakeResponse();
    const secondNext = vi.fn<NextFunction>();
    runAdmission(admission, secondRequest, secondResponse, secondNext);
    expect(secondNext).toHaveBeenCalledOnce();
    secondRequest.emit("aborted");

    const admittedAfterAbort = vi.fn<NextFunction>();
    runAdmission(admission, fakeRequest(), fakeResponse(), admittedAfterAbort);
    expect(admittedAfterAbort).toHaveBeenCalledOnce();
  });

  it("releases after an error response completes", () => {
    const admission = createPassportScanAdmission(1);
    const errorRequest = fakeRequest();
    const errorResponse = fakeResponse();
    const errorNext = vi.fn<NextFunction>();
    runAdmission(admission, errorRequest, errorResponse, errorNext);
    expect(errorNext).toHaveBeenCalledOnce();

    errorResponse.status(500).json({ error: true, message: "temporary failure" });
    errorResponse.emit("finish");

    const retryNext = vi.fn<NextFunction>();
    runAdmission(admission, fakeRequest(), fakeResponse(), retryNext);
    expect(retryNext).toHaveBeenCalledOnce();
  });
});
