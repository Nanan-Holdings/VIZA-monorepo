import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusGuide } from "./status-guide";

const labels: Record<string, string> = {
  "statusGuide.title": "Status guide",
  "statusGuide.description": "Recorded status only",
  "statusGuide.items.draft.title": "Draft",
  "statusGuide.items.draft.description": "Draft description",
  "statusGuide.items.missingInfo.title": "Missing information",
  "statusGuide.items.missingInfo.description": "Missing description",
  "statusGuide.items.review.title": "Awaiting confirmation",
  "statusGuide.items.review.description": "Review description",
  "statusGuide.items.queued.title": "Queued",
  "statusGuide.items.queued.description": "Queued description",
  "statusGuide.items.officialFilling.title": "Official site filling",
  "statusGuide.items.officialFilling.description": "Filling description",
  "statusGuide.items.userAction.title": "Waiting for user action",
  "statusGuide.items.userAction.description": "Action description",
  "statusGuide.items.submitted.title": "Submitted",
  "statusGuide.items.submitted.description": "Submitted description",
  "statusGuide.items.recoverableFailed.title": "Recoverable failure",
  "statusGuide.items.recoverableFailed.description": "Failure description",
};

const t = (key: string) => labels[key] ?? key;

describe("StatusGuide", () => {
  it("always shows the complete status guide without a toggle", () => {
    render(<StatusGuide t={t} />);

    expect(screen.getByRole("heading", { name: "Status guide" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Status guide|View|Collapse/i })).not.toBeInTheDocument();
    expect(screen.getByText("Draft description")).toBeInTheDocument();
    expect(screen.getByText("Queued description")).toBeInTheDocument();
    expect(screen.getByText("Submitted description")).toBeInTheDocument();
    expect(screen.getByText("Failure description")).toBeInTheDocument();
  });
});
