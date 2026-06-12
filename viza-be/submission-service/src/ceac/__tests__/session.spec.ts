import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("CEAC session bootstrap navigation", () => {
  it("waits only for the initial CEAC response commit before page detection", async () => {
    const { gotoCeacStartPage } = require("../session") as typeof import("../session");
    const calls: Array<{ waitUntil?: string; timeout?: number }> = [];
    const page = {
      goto: async (_url: string, options: { waitUntil?: string; timeout?: number }) => {
        calls.push(options);
        return null;
      },
      waitForSelector: async () => undefined,
    };

    await gotoCeacStartPage(page as never, 12_345);

    assert.deepEqual(calls, [{ waitUntil: "commit", timeout: 12_345 }]);
  });

  it("waits for CEAC page markers after the initial response commit", async () => {
    const { gotoCeacStartPage } = require("../session") as typeof import("../session");
    const selectors: Array<{ selector: string; state?: string; timeout?: number }> = [];
    const page = {
      goto: async () => null,
      waitForSelector: async (selector: string, options: { state?: string; timeout?: number }) => {
        selectors.push({ selector, ...options });
      },
    };

    await gotoCeacStartPage(page as never, 12_345);

    assert.equal(selectors.length, 1);
    assert.match(selectors[0].selector, /h2/);
    assert.equal(selectors[0].state, "attached");
    assert.equal(selectors[0].timeout, 12_345);
  });
});
