import { describe, expect, it } from "vitest";

import {
  appointmentServiceFailureMessage,
  classifyAppointmentServiceFailure,
} from "../appointment-service-errors";

describe("Korea appointment service failure classification", () => {
  const poisonedWorkerText = "https://user:secret@internal.example/path?token=abc";

  it("keeps public failure messages free of worker URLs, credentials, and raw text", () => {
    const inputs = [
      { status: 502, rawError: poisonedWorkerText },
      { status: 500, rawError: `worker exploded: ${poisonedWorkerText}` },
      { rawError: `arbitrary worker diagnostic ${poisonedWorkerText}` },
    ];

    for (const input of inputs) {
      const kind = classifyAppointmentServiceFailure(input);
      const message = appointmentServiceFailureMessage(kind);
      expect(message).not.toContain("https://");
      expect(message).not.toContain("secret");
      expect(message).not.toContain("internal.example");
      expect(message).not.toContain("token=abc");
      expect(message).not.toContain("arbitrary worker diagnostic");
    }
  });

  it("classifies worker-unavailable statuses and network diagnostics", () => {
    expect(classifyAppointmentServiceFailure({ status: 404, rawError: poisonedWorkerText })).toBe("unavailable");
    expect(classifyAppointmentServiceFailure({ status: 404, rawError: "Official KVAC final booking button was not found after user approval." })).toBe("unavailable");
    expect(classifyAppointmentServiceFailure({ status: 400, rawError: "Official KVAC final booking button was not found after user approval." })).toBe("generic");
    expect(classifyAppointmentServiceFailure({ status: 503 })).toBe("unavailable");
    expect(classifyAppointmentServiceFailure({ networkError: true, rawError: poisonedWorkerText })).toBe("unavailable");
    expect(classifyAppointmentServiceFailure({ rawError: new TypeError("fetch failed") })).toBe("unavailable");
  });

  it("distinguishes network body aborts from ordinary malformed JSON", () => {
    expect(classifyAppointmentServiceFailure({ networkError: new Error("AbortError: terminated") })).toBe("unavailable");
    expect(classifyAppointmentServiceFailure({ networkError: new SyntaxError("Unexpected end of JSON input") })).toBe("generic");
  });

  it("classifies verified no-slots failures", () => {
    expect(classifyAppointmentServiceFailure({ rawError: "No selectable appointment slots are currently available." })).toBe("no_slots");
    expect(classifyAppointmentServiceFailure({ status: 400, rawError: "the official calendar is fully booked" })).toBe("no_slots");
    expect(classifyAppointmentServiceFailure({ rawError: "No appointments." })).toBe("no_slots");
    expect(classifyAppointmentServiceFailure({ rawError: { error: "no appointment slots available" } })).toBe("no_slots");
  });

  it("classifies expired cancellation sessions", () => {
    expect(classifyAppointmentServiceFailure({ rawError: "Official KVAC cancellation session is missing or expired." })).toBe("cancellation_session_expired");
    expect(classifyAppointmentServiceFailure({ rawError: "The cancellation button is no longer visible." })).toBe("cancellation_session_expired");
  });

  it("uses a generic stable message for unknown failures", () => {
    const kind = classifyAppointmentServiceFailure({ rawError: "unexpected provider response" });
    expect(kind).toBe("generic");
    expect(appointmentServiceFailureMessage(kind)).toBe(
      "The Korea appointment service could not complete this request safely. Please try again.",
    );
  });
});
