import { describe, expect, it, vi } from "vitest";
import {
  isSubmissionTransportError,
  reconcileSubmissionStatus,
} from "../submission-reconciliation";

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("submission reconciliation", () => {
  it("recognizes a queue accepted before the POST response was lost", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      response({
        ok: true,
        jobId: "queue-1",
        status: "running",
        applicationStatus: "processing",
        queue: { id: "queue-1", status: "ds160_live_assisted_processing" },
        result: null,
      }),
    );

    await expect(
      reconcileSubmissionStatus("application-1", { fetchImpl }),
    ).resolves.toEqual({
      kind: "accepted",
      jobId: "queue-1",
      submissionResultStatus: "processing",
      submissionResult: null,
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/applications/application-1/submission-status",
      expect.objectContaining({ cache: "no-store", credentials: "same-origin" }),
    );
  });

  it("keeps a transport failure unconfirmed when no queue or result exists", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      response({ ok: true, status: "failed", applicationStatus: null, queue: null, result: null }),
    );

    await expect(
      reconcileSubmissionStatus("application-2", { fetchImpl }),
    ).resolves.toEqual({ kind: "not_accepted" });
  });

  it("reports a failed status read as unconfirmed instead of treating it as accepted", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(
      reconcileSubmissionStatus("application-3", { fetchImpl }),
    ).resolves.toEqual({ kind: "unconfirmed", reason: "network_error" });
    expect(isSubmissionTransportError(new TypeError("Failed to fetch"))).toBe(true);
    expect(isSubmissionTransportError(new Error("Submission access denied"))).toBe(false);
    expect(isSubmissionTransportError(new Error("Failed to fetch"))).toBe(false);
  });

  it("does not classify an aborted request as a recoverable transport failure", () => {
    expect(isSubmissionTransportError(new DOMException("The operation was aborted.", "AbortError"))).toBe(false);
  });
});
