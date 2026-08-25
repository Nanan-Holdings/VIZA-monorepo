import { describe, expect, it } from "vitest";
import { resolveApplicationCenterApplication } from "./application-center-resolution";

function resolve(
  overrides: Partial<
    Parameters<typeof resolveApplicationCenterApplication>[0]
  > = {}
) {
  return resolveApplicationCenterApplication({
    lifecycleState: "needs_payment",
    paymentState: "blocked",
    intake: {
      complete: false,
      questionnaireComplete: false,
      documentCollectionComplete: true,
    },
    officialReadOnly: false,
    officialProcessing: false,
    paymentEligible: false,
    editHref: "/client/application/long-form?applicationId=36cdba28-us",
    detailHref:
      "/client/application/long-form?applicationId=36cdba28-us&step=status",
    checkoutHref: "/client/checkout?applicationId=36cdba28-us",
    ...overrides,
  });
}

describe("application center status and action resolution", () => {
  it("keeps the 36% US unpaid draft editable instead of routing to checkout", () => {
    const result = resolve();

    expect(result.state).toBe("in_progress");
    expect(result.editable).toBe(true);
    expect(result.rowHref).toContain("applicationId=36cdba28-us");
    expect(result.rowHref).not.toContain("checkout");
    expect(result.actions).toEqual([
      {
        key: "continueForm",
        href: "/client/application/long-form?applicationId=36cdba28-us",
        primary: true,
      },
    ]);
  });

  it("keeps the 57% UK unpaid draft editable instead of routing to checkout", () => {
    const result = resolve({
      editHref: "/client/application/long-form?applicationId=2c828423-uk",
      detailHref:
        "/client/application/long-form?applicationId=2c828423-uk&step=status",
      checkoutHref: "/client/checkout?applicationId=2c828423-uk",
    });

    expect(result.state).toBe("in_progress");
    expect(result.rowHref).toBe(
      "/client/application/long-form?applicationId=2c828423-uk"
    );
  });

  it("shows payment only after applicant intake is complete and keeps edit separate", () => {
    const result = resolve({
      intake: {
        complete: true,
        questionnaireComplete: true,
        documentCollectionComplete: true,
      },
      paymentEligible: true,
      editHref: "/client/application/long-form?applicationId=c6d74bbb-test",
      detailHref:
        "/client/application/long-form?applicationId=c6d74bbb-test&step=status",
      checkoutHref: "/client/checkout?applicationId=c6d74bbb-test",
    });

    expect(result.state).toBe("needs_payment");
    expect(result.rowHref).toContain("application/long-form");
    expect(result.actions).toEqual([
      {
        key: "pay",
        href: "/client/checkout?applicationId=c6d74bbb-test",
        primary: true,
      },
      {
        key: "continueForm",
        href: "/client/application/long-form?applicationId=c6d74bbb-test",
        primary: false,
      },
    ]);
  });

  it("keeps a paid application editable while internal processing has not crossed the official boundary", () => {
    const result = resolve({
      lifecycleState: "packet_pending",
      paymentState: "complete",
      intake: {
        complete: true,
        questionnaireComplete: true,
        documentCollectionComplete: true,
      },
    });

    expect(result.state).toBe("packet_pending");
    expect(result.editable).toBe(true);
    expect(result.rowHref).toContain("application/long-form");
  });

  it("ignores a stale processing marker until agency payment is actually ready", () => {
    const result = resolve({
      lifecycleState: "external_pending",
      intake: {
        complete: true,
        questionnaireComplete: true,
        documentCollectionComplete: true,
      },
      officialProcessing: true,
      paymentEligible: false,
    });

    expect(result.state).toBe("in_progress");
    expect(result.editable).toBe(true);
    expect(result.rowHref).not.toContain("step=status");
  });

  it("opens read-only status after paid work enters official processing", () => {
    const result = resolve({
      lifecycleState: "external_pending",
      paymentState: "complete",
      intake: {
        complete: true,
        questionnaireComplete: true,
        documentCollectionComplete: true,
      },
      officialProcessing: true,
    });

    expect(result.state).toBe("external_pending");
    expect(result.editable).toBe(false);
    expect(result.rowHref).toContain("step=status");
  });

  it("locks only an official submitted application to its read-only detail", () => {
    const result = resolve({
      lifecycleState: "submitted",
      paymentState: "complete",
      intake: {
        complete: true,
        questionnaireComplete: true,
        documentCollectionComplete: true,
      },
      officialReadOnly: true,
    });

    expect(result.state).toBe("submitted");
    expect(result.editable).toBe(false);
    expect(result.rowHref).toContain("step=status");
  });
});
