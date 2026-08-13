import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { StatusApplication } from "@/app/client/status/status-data";
import { ApplicationTimelineSection } from "./ApplicationTimelineSection";

vi.mock("next/image", () => ({
  default: ({ alt = "" }: { alt?: string }) => <span role="img" aria-label={alt || "task image"} />,
}));

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string, values?: Record<string, string | number>) => {
    const labels: Record<string, string> = {
      "groups.todo": "To-dos",
      "groups.completed": "Completed tasks",
      "steps.payment.title": "Complete service-fee payment",
      "steps.payment.description": "Confirm payment.",
      "steps.consent.title": "Confirm consent and authority",
      "steps.consent.description": "Complete consent.",
      "steps.form.title": "Complete the application form",
      "steps.form.description": "Complete the form.",
      "states.attention": "Action needed",
      "states.upcoming": "Not started",
      "relative.justNow": "Just now",
      "empty.incomplete": "No to-dos.",
      "empty.completed": "No completed tasks.",
    };
    const label = labels[key] ?? key;
    return Object.entries(values ?? {}).reduce(
      (value, [name, replacement]) => value.replace(`{${name}}`, String(replacement)),
      label,
    );
  },
}));

const application = {
  formAnswerCount: 0,
  officialReference: null,
  documents: { total: 0, uploaded: 0, validated: 0, missing: 0, rejected: 0 },
  actions: [{ key: "pay", href: "/client/checkout", primary: true }],
  steps: [
    {
      key: "payment",
      state: "attention",
      updatedAt: null,
      statusValue: null,
      metricValue: null,
    },
    {
      key: "consent",
      state: "complete",
      updatedAt: new Date().toISOString(),
      statusValue: null,
      metricValue: null,
    },
  ],
} as StatusApplication;

describe("ApplicationTimelineSection", () => {
  it("shows to-dos and completed tasks together as separate activity cards", () => {
    const { container } = render(<ApplicationTimelineSection application={application} />);

    expect(screen.getByRole("heading", { name: "To-dos" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Completed tasks" })).toBeInTheDocument();
    expect(screen.getByText("Complete service-fee payment")).toBeInTheDocument();
    expect(screen.getByText("Confirm consent and authority")).toBeInTheDocument();
    expect(container.querySelectorAll(".application-form-panel")).toHaveLength(2);
    expect(container.querySelector("[role=tablist]")).not.toBeInTheDocument();
  });

  it("hides an empty completed group and grays out not-started tasks", () => {
    const applicationWithoutCompletedTasks = {
      ...application,
      actions: [],
      steps: [
        {
          key: "form",
          state: "upcoming",
          updatedAt: null,
          statusValue: null,
          metricValue: null,
        },
      ],
    } as StatusApplication;

    const { container } = render(
      <ApplicationTimelineSection application={applicationWithoutCompletedTasks} />,
    );

    expect(screen.queryByRole("heading", { name: "Completed tasks" })).not.toBeInTheDocument();
    expect(screen.queryByText("No completed tasks.")).not.toBeInTheDocument();
    expect(container.querySelector('[data-state="upcoming"]')).toHaveClass(
      "bg-[#f5f5f5]",
      "opacity-65",
    );
  });
});
