import { describe, expect, it } from "vitest";
import { readDs160ProofEmailStatus } from "@/lib/ds160-proof";

function emailRow(lockedUntil: string | null, email: Record<string, unknown> = {}) {
  return {
    status: "ds160_proof_processing",
    locked_until: lockedUntil,
    ceac_result_payload: {
      action: "official_ceac_email",
      email,
    },
  };
}

describe("readOfficialEmailStatus", () => {
  it("keeps an actively leased queued email in sending state", () => {
    expect(
      readDs160ProofEmailStatus(emailRow(new Date(Date.now() + 60_000).toISOString(), { status: "queued" })),
    ).toBe("sending");
  });

  it("marks an expired lease before send reservation as failed", () => {
    expect(
      readDs160ProofEmailStatus(emailRow(new Date(Date.now() - 60_000).toISOString(), { status: "queued" })),
    ).toBe("failed");
  });

  it("marks an expired lease after send reservation as unknown", () => {
    expect(
      readDs160ProofEmailStatus(emailRow(null, {
        status: "sending",
        send_started_at: new Date(Date.now() - 60_000).toISOString(),
      })),
    ).toBe("unknown");
  });
});
