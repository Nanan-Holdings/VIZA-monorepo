import { describe, expect, it } from "vitest";
import { resolveSocketTransports } from "./socket-transports";

describe("resolveSocketTransports", () => {
  it("keeps polling fallback for the default single-replica topology", () => {
    expect(resolveSocketTransports(undefined)).toEqual(["polling", "websocket"]);
    expect(resolveSocketTransports("false")).toEqual(["polling", "websocket"]);
  });

  it("forces WebSocket-only when multi-replica mode is explicitly enabled", () => {
    expect(resolveSocketTransports("true")).toEqual(["websocket"]);
    expect(resolveSocketTransports("TRUE")).toEqual(["polling", "websocket"]);
  });
});
