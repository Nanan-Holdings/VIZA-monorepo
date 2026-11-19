import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import enMessages from "@/messages/en.json";
import zhMessages from "@/messages/zh.json";
import type { FrSubmissionResult } from "@/lib/submission-result";
import { FrResultCard } from "../FrResultCard";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("next-intl", () => ({
  useLocale: () => "zh-CN",
  useTranslations: () => (key: string) => key,
}));

const submittedResult: FrSubmissionResult = {
  country: "FR",
  status: "submitted",
  mode: "live_assisted",
  applicationReference: "FRA1PE20260000001",
  officialStatus: "lodged_at_visa_centre",
};

const savedResult: FrSubmissionResult = {
  ...submittedResult,
  status: "final_review_required",
  officialStatus: "official_record_created",
};

const dryRunResult: FrSubmissionResult = {
  country: "FR",
  status: "appointment_held",
  mode: "dry_run",
  applicationReference: "DRY-RUN-REF",
};

describe("FrResultCard next-steps guide link", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({}), { status: 200 })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("links a submitted France-Visas application to the next-steps guide", () => {
    render(<FrResultCard applicationId="viza-application-id" result={submittedResult} />);
    expect(screen.getByTestId("fr-next-steps-link")).toHaveAttribute(
      "href",
      "/client/application/fr-next-steps?applicationId=viza-application-id",
    );
    expect(zhMessages.franceAppointment.nextStepsGuide.title).toBe("提交后怎么办：预约递交与后续流程指引");
    for (const messages of [enMessages, zhMessages]) {
      expect(messages.franceAppointment.nextStepsGuide.body).toBeTruthy();
      expect(messages.franceAppointment.nextStepsGuide.loading).toBeTruthy();
    }
  });

  it("shows the guide once the application is saved on France-Visas", () => {
    render(<FrResultCard applicationId="viza-application-id" result={savedResult} />);
    expect(screen.getByTestId("fr-next-steps-link")).toBeInTheDocument();
  });

  it("hides the guide before anything exists on France-Visas", () => {
    render(<FrResultCard applicationId="viza-application-id" result={dryRunResult} />);
    expect(screen.queryByTestId("fr-next-steps-link")).not.toBeInTheDocument();
  });
});

describe("FrResultCard new application", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    push.mockReset();
  });

  it("copies the saved application into a new one and opens it", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith("/new-application")) {
        return new Response(
          JSON.stringify({ href: "/client/application/long-form?applicationId=new-fr&country=france&visaType=EU_SCHENGEN_C_SHORT_STAY" }),
          { status: 201 },
        );
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<FrResultCard applicationId="viza-application-id" result={submittedResult} />);

    fireEvent.click(screen.getByRole("button", { name: "button" }));

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(
        "/client/application/long-form?applicationId=new-fr&country=france&visaType=EU_SCHENGEN_C_SHORT_STAY",
      ),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/applications/viza-application-id/new-application",
      expect.objectContaining({ method: "POST" }),
    );
    for (const messages of [enMessages, zhMessages]) {
      expect(messages.franceAppointment.newApplication.title).toBeTruthy();
      expect(messages.franceAppointment.newApplication.button).toBeTruthy();
    }
  });

  it("shows the server's reason when the copy is refused", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) =>
        String(input).endsWith("/new-application")
          ? new Response(JSON.stringify({ error: "Only a submitted application can be used" }), { status: 409 })
          : new Response(JSON.stringify({}), { status: 200 }),
      ),
    );
    render(<FrResultCard applicationId="viza-application-id" result={submittedResult} />);
    fireEvent.click(screen.getByRole("button", { name: "button" }));
    expect(await screen.findByText("Only a submitted application can be used")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("is not offered for a dry run", () => {
    render(<FrResultCard applicationId="viza-application-id" result={dryRunResult} />);
    expect(screen.queryByTestId("fr-new-application")).not.toBeInTheDocument();
  });
});
