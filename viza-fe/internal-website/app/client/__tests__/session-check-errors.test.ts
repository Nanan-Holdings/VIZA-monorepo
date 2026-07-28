import { describe, expect, it } from "vitest";

import { isIgnorableClientSessionCheckError } from "../session-check-errors";

describe("isIgnorableClientSessionCheckError", () => {
  it("treats transient browser fetch failures as ignorable", () => {
    expect(isIgnorableClientSessionCheckError(new TypeError("Failed to fetch"))).toBe(true);
  });

  it("does not hide real session validation errors", () => {
    expect(isIgnorableClientSessionCheckError(new Error("Failed to check session"))).toBe(false);
  });
});
