import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const hookSource = readFileSync(
  resolve(process.cwd(), "hooks/use-agent-socket.ts"),
  "utf8",
);
const chatClientSource = readFileSync(
  resolve(process.cwd(), "app/client/chat/chat-client.tsx"),
  "utf8",
);

describe("Socket.IO transport wiring", () => {
  it("routes every VIZA Socket.IO client through the shared topology helper", () => {
    for (const source of [hookSource, chatClientSource]) {
      expect(source).toContain('from "@/lib/socket-transports"');
      expect(source).toContain("transports: resolveSocketTransports()");
      expect(source).toContain("tryAllTransports: true");
      expect(source).not.toMatch(/transports:\s*\["polling",\s*"websocket"\]/u);
    }
  });
});
