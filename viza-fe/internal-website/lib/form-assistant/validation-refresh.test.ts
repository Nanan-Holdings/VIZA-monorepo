import { describe, expect, it } from "vitest";
import {
  FormAssistantValidationRefreshGuard,
  mergeFormAssistantIssueDraft,
} from "./validation-refresh";

describe("FormAssistantValidationRefreshGuard", () => {
  it("accepts a validation response for the current answer snapshot", () => {
    const guard = new FormAssistantValidationRefreshGuard();
    guard.markAnswersChanged();
    const request = guard.startRequest();

    expect(guard.isCurrent(request)).toBe(true);
  });

  it("rejects an in-flight response after another answer changes", () => {
    const guard = new FormAssistantValidationRefreshGuard();
    guard.markAnswersChanged();
    const staleRequest = guard.startRequest();

    guard.markAnswersChanged();

    expect(guard.isCurrent(staleRequest)).toBe(false);
    expect(guard.isLatestRequest(staleRequest)).toBe(true);
  });

  it("lets only the newest validation request update the UI", () => {
    const guard = new FormAssistantValidationRefreshGuard();
    guard.markAnswersChanged();
    const olderRequest = guard.startRequest();
    const latestRequest = guard.startRequest();

    expect(guard.isCurrent(olderRequest)).toBe(false);
    expect(guard.isCurrent(latestRequest)).toBe(true);
  });

  it("invalidates pending responses when the application changes", () => {
    const guard = new FormAssistantValidationRefreshGuard();
    const request = guard.startRequest();

    guard.reset();

    expect(guard.isCurrent(request)).toBe(false);
  });

  it("keeps other unsaved fields when an inline issue editor changes one answer", () => {
    expect(mergeFormAssistantIssueDraft(
      { arrival_date: "2026-08-17", departure_date: "2026-08-23" },
      { arrival_date: "2026-08-20" },
    )).toEqual({
      arrival_date: "2026-08-20",
      departure_date: "2026-08-23",
    });
  });
});
