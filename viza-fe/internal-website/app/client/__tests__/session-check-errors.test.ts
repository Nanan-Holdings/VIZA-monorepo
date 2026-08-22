import { describe, expect, it } from "vitest";

import {
  isIgnorableClientSessionCheckError,
  parseClientSessionResponse,
  UnexpectedClientSessionResponseError,
} from "../session-check-errors";

describe("isIgnorableClientSessionCheckError", () => {
  it("treats transient browser fetch failures as ignorable", () => {
    expect(isIgnorableClientSessionCheckError(new TypeError("Failed to fetch"))).toBe(true);
  });

  it("does not hide real session validation errors", () => {
    expect(isIgnorableClientSessionCheckError(new Error("Failed to check session"))).toBe(false);
  });

  it("rejects an HTML auth redirect without attempting to parse it as JSON", async () => {
    const response = new Response("<!DOCTYPE html><html></html>", {
      headers: { "content-type": "text/html; charset=utf-8" },
    });

    const error = await parseClientSessionResponse(response).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(UnexpectedClientSessionResponseError);
    expect(isIgnorableClientSessionCheckError(error)).toBe(true);
  });

  it("returns JSON session responses", async () => {
    const response = Response.json({ valid: true, userId: "applicant-1" });

    await expect(parseClientSessionResponse(response)).resolves.toEqual({
      valid: true,
      userId: "applicant-1",
    });
  });
});
