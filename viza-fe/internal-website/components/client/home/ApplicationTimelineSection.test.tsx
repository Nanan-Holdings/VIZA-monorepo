import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { StatusApplication } from "@/app/client/status/status-data";
import { getCountryHeroTheme } from "@/lib/client/country-hero-theme";
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
      "steps.payment.descriptions.pending": "Confirm payment.",
      "steps.payment.descriptions.completed": "Payment confirmed.",
      "steps.consent.title": "Confirm consent and authority",
      "steps.consent.descriptions.pending": "Complete consent.",
      "steps.consent.descriptions.completed": "Consent completed.",
      "steps.form.title": "Complete the application form",
      "steps.form.descriptions.pending": "Continue the form. {count} answers saved.",
      "steps.form.descriptions.completed": "Application information saved.",
      "steps.documents.title": "Upload required documents",
      "steps.documents.descriptions.pending": "Upload documents. {ready}/{total} ready.",
      "steps.documents.descriptions.completed": "Documents completed ({ready}/{total}).",
      "steps.documents.descriptions.completedNoRequirements":
        "No additional documents required.",
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
  it("uses the Indonesia blue gradient for every country while preserving artwork", () => {
    const indonesiaTheme = getCountryHeroTheme("indonesia");
    const germanyTheme = getCountryHeroTheme("germany");
    const japanTheme = getCountryHeroTheme("japan");
    const unknownTheme = getCountryHeroTheme("new_destination");

    expect(japanTheme).toMatchObject({
      from: indonesiaTheme.from,
      to: indonesiaTheme.to,
      image: "/country-heroes/japan.png",
    });
    expect(germanyTheme).toMatchObject({
      from: indonesiaTheme.from,
      to: indonesiaTheme.to,
      image: "/country-heroes/germany.png",
    });
    expect(unknownTheme).toMatchObject({
      from: indonesiaTheme.from,
      to: indonesiaTheme.to,
      image: null,
    });
  });

  it("shows to-dos and completed tasks together as separate activity cards", () => {
    const { container } = render(<ApplicationTimelineSection application={application} />);

    expect(screen.getByRole("heading", { name: "To-dos" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Completed tasks" })).toBeInTheDocument();
    expect(screen.getByText("Complete service-fee payment")).toBeInTheDocument();
    expect(screen.getByText("Confirm consent and authority")).toBeInTheDocument();
    expect(screen.getByText("Confirm payment.")).toBeInTheDocument();
    expect(screen.getByText("Consent completed.")).toBeInTheDocument();
    expect(container.querySelectorAll(".application-form-panel")).toHaveLength(2);
    expect(container.querySelector("[role=tablist]")).not.toBeInTheDocument();
  });

  it("uses actionable pending copy and outcome-focused completed copy for progress metrics", () => {
    const applicationWithProgressMetrics = {
      ...application,
      formAnswerCount: 3,
      actions: [],
      steps: [
        {
          key: "form",
          state: "upcoming",
          updatedAt: null,
          statusValue: null,
          metricValue: null,
        },
        {
          key: "documents",
          state: "complete",
          updatedAt: new Date().toISOString(),
          statusValue: null,
          metricValue: null,
        },
      ],
    } as StatusApplication;

    render(<ApplicationTimelineSection application={applicationWithProgressMetrics} />);

    expect(screen.getByText("Continue the form. 3 answers saved.")).toBeInTheDocument();
    expect(screen.getByText("No additional documents required.")).toBeInTheDocument();
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
