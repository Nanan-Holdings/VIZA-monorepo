import { describe, expect, it } from "vitest";
import { renderTemplate, type TransitionEvent } from "../templates";
import { DEFAULT_NOTIFY_FROM, resolveApplicantLocale, resolveNotifyFrom, senderDomain } from "../sender";
import { externalEmailDetail, pickExternalEmailEvent } from "../external-submission-email";

const ctx = {
  applicantName: "Ada",
  applicationId: "11111111-1111-4111-8111-111111111111",
  countryLabel: "Japan",
  countryLabelZh: "日本",
  visaTypeLabel: "Tourist eVisa",
  visaTypeLabelZh: "旅游电子签证",
};

const STAFF_EVENTS: TransitionEvent[] = ["status_update", "info_requested", "visa_approved", "visa_refused", "submitted"];

describe("staff outcome email templates", () => {
  it.each(STAFF_EVENTS)("renders %s in English and Chinese with the right labels", (event) => {
    const en = renderTemplate(event, ctx, "en");
    const zh = renderTemplate(event, ctx, "zh-CN");
    expect(en.subject).toContain("Japan");
    expect(zh.subject).toContain("日本");
    expect(zh.subject).not.toContain("Japan");
    expect(en.text).toContain("Hi Ada,");
    expect(zh.text).toContain("您好 Ada，");
    for (const out of [en, zh]) {
      expect(out.subject + out.text).not.toMatch(/[–—]/);
      expect(out.html).toContain("https://");
    }
  });

  it("marks the staff decision emails as essential so preferences cannot silence them", () => {
    for (const event of ["status_update", "info_requested", "visa_approved", "visa_refused"] as const) {
      expect(renderTemplate(event, ctx).essential).toBe(true);
    }
  });

  it("prefers the localized detail and escapes staff text in HTML", () => {
    const out = renderTemplate(
      "info_requested",
      { ...ctx, detailByLocale: { en: "Upload <b>passport</b> scan", "zh-CN": "请上传护照" } },
      "en",
    );
    expect(out.text).toContain("Upload <b>passport</b> scan");
    expect(out.html).toContain("Upload &lt;b&gt;passport&lt;/b&gt; scan");
    expect(out.html).not.toContain("<b>passport</b>");
    expect(renderTemplate("info_requested", { ...ctx, detailByLocale: { en: "x", "zh-CN": "请上传护照" } }, "zh-CN").text).toContain("请上传护照");
  });

  it("links the CTA to the absolute portal status page", () => {
    const out = renderTemplate("visa_approved", ctx, "en");
    expect(out.text).toMatch(/https:\/\/[^\s]+\/client\/status/);
  });
});

describe("notification sender", () => {
  it("never uses the Resend sandbox sender", () => {
    expect(resolveNotifyFrom({ RESEND_FROM_EMAIL: "onboarding@resend.dev" })).toBe(DEFAULT_NOTIFY_FROM);
    expect(resolveNotifyFrom({ RESEND_FROM_EMAIL: "Acme <onboarding@resend.dev>", NOTIFY_FROM_EMAIL: "VIZA <welcome@viza.it.com>" })).toBe("VIZA <welcome@viza.it.com>");
    expect(resolveNotifyFrom({})).toBe(DEFAULT_NOTIFY_FROM);
  });

  it("prefers RESEND_FROM_EMAIL and adds a display name to bare addresses", () => {
    expect(resolveNotifyFrom({ RESEND_FROM_EMAIL: "updates@viza.it.com", NOTIFY_FROM_EMAIL: "VIZA <welcome@viza.it.com>" })).toBe("VIZA <updates@viza.it.com>");
    expect(senderDomain("VIZA <updates@viza.it.com>")).toBe("viza.it.com");
    expect(senderDomain("not an address")).toBeNull();
  });

  it("picks the applicant locale from language_pref, then nationality", () => {
    expect(resolveApplicantLocale("zh")).toBe("zh-CN");
    expect(resolveApplicantLocale("zh-CN")).toBe("zh-CN");
    expect(resolveApplicantLocale("en", "China")).toBe("en");
    expect(resolveApplicantLocale(null, "CN")).toBe("zh-CN");
    expect(resolveApplicantLocale(null, "Singapore")).toBe("en");
  });
});

describe("external submission email mapping", () => {
  const before = { external_status: "in_progress", result_status: null };

  it("emails on real transitions only", () => {
    expect(pickExternalEmailEvent({ externalStatus: "submitted" }, before)).toBe("submitted");
    expect(pickExternalEmailEvent({ externalStatus: "submitted" }, { external_status: "submitted", result_status: null })).toBeNull();
    expect(pickExternalEmailEvent({ externalStatus: "completed", resultStatus: "issued" }, before)).toBe("visa_approved");
    expect(pickExternalEmailEvent({ externalStatus: "completed", resultStatus: "rejected" }, before)).toBe("visa_refused");
    expect(pickExternalEmailEvent({ externalStatus: "completed", resultStatus: "approved" }, { external_status: "completed", result_status: "approved" })).toBeNull();
    expect(pickExternalEmailEvent({ externalStatus: "action_required" }, before)).toBe("info_requested");
    expect(pickExternalEmailEvent({ externalStatus: "in_progress", resultStatus: "pending" }, before)).toBeNull();
  });

  it("builds localized details from reference and notes", () => {
    expect(externalEmailDetail("submitted", "ABC-123", null)?.en).toContain("ABC-123");
    expect(externalEmailDetail("info_requested", null, "Send bank statement")?.["zh-CN"]).toBe("Send bank statement");
    expect(externalEmailDetail("visa_refused", null, "Insufficient funds")?.en).toContain("Insufficient funds");
    expect(externalEmailDetail("visa_approved", null, null)).toBeUndefined();
  });
});
