import { beforeEach, describe, expect, it, vi } from "vitest";

const inserts: Array<{ table: string; row: Record<string, unknown> }> = [];
let profile: Record<string, unknown> | null = null;
let prefs: Record<string, unknown> | null = null;
const sendEmail = vi.fn();

function fakeAdmin() {
  return {
    from(table: string) {
      return {
        select() {
          return {
            eq() {
              return {
                maybeSingle: async () => ({ data: table === "applicant_profiles" ? profile : prefs, error: null }),
              };
            },
          };
        },
        insert: async (row: Record<string, unknown>) => {
          inserts.push({ table, row });
          return { error: null };
        },
      };
    },
    auth: { admin: { getUserById: async () => ({ data: { user: { email: "fallback@example.org" } } }) } },
  };
}

vi.mock("@/lib/auth/with-admin", () => ({
  withAdmin: (_mode: string, _actor: string, fn: (admin: unknown) => unknown) => fn(fakeAdmin()),
}));
vi.mock("@/lib/email/resend", () => ({ sendEmail: (...args: unknown[]) => sendEmail(...args) }));

import { sendTransitionNotification } from "../dispatch";

const ctx = {
  applicantName: "",
  applicationId: "22222222-2222-4222-8222-222222222222",
  countryLabel: "Japan",
  countryLabelZh: "日本",
  visaTypeLabel: "Tourist eVisa",
};

describe("sendTransitionNotification", () => {
  beforeEach(() => {
    inserts.length = 0;
    sendEmail.mockReset();
    prefs = null;
    profile = { id: "p1", full_name: "Lin", email: "lin@example.org", auth_user_id: "u1", language_pref: "zh", nationality: null };
    delete process.env.RESEND_FROM_EMAIL;
    process.env.NOTIFY_FROM_EMAIL = "onboarding@resend.dev";
  });

  it("sends in the applicant's language from the verified sender and logs both tables", async () => {
    sendEmail.mockResolvedValue({ id: "re_123" });
    const result = await sendTransitionNotification("p1", "visa_approved", ctx, { actorId: "staff-1", source: "admin_outcome" });

    expect(result.delivered).toEqual(["email"]);
    expect(result.locale).toBe("zh-CN");
    const email = sendEmail.mock.calls[0][0] as { from: string; to: string; subject: string };
    expect(email.from).toBe("VIZA <updates@viza.it.com>");
    expect(email.to).toBe("lin@example.org");
    expect(email.subject).toContain("日本");

    const log = inserts.find((entry) => entry.table === "notification_event_log")?.row;
    expect(log).toMatchObject({ event: "visa_approved", channel: "email", outcome: "sent", external_id: "re_123", template_key: "visa_approved" });
    expect(log?.payload).toMatchObject({ from_domain: "viza.it.com", locale: "zh-CN", source: "admin_outcome", actor_id: "staff-1" });
    const visible = inserts.find((entry) => entry.table === "notification_events")?.row;
    expect(visible).toMatchObject({ status: "sent", provider: "resend", provider_message_id: "re_123", template_key: "visa_approved" });
  });

  it("records a failed send instead of throwing", async () => {
    sendEmail.mockRejectedValue(new Error("Resend 403: domain not verified"));
    const result = await sendTransitionNotification("p1", "info_requested", { ...ctx, detail: "Upload passport" });
    expect(result.delivered).toEqual([]);
    expect(result.error).toContain("403");
    expect(inserts.find((entry) => entry.table === "notification_event_log")?.row).toMatchObject({ outcome: "error" });
    expect(inserts.find((entry) => entry.table === "notification_events")?.row).toMatchObject({ status: "failed" });
  });

  it("respects an opt-out for non-essential events", async () => {
    prefs = { channel_email: true, channel_push: false, notify_runner_started: true, notify_runner_stopped_for_input: true, notify_submitted: false, notify_document_ready: true, push_token: null, push_provider: null };
    const result = await sendTransitionNotification("p1", "submitted", ctx);
    expect(result.suppressed).toBe(true);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(inserts[0]).toMatchObject({ table: "notification_event_log", row: { outcome: "suppressed_by_pref" } });
  });

  it("falls back to the auth email when the profile has none, in English by default", async () => {
    profile = { id: "p1", full_name: null, email: null, auth_user_id: "u1", language_pref: null, nationality: null };
    sendEmail.mockResolvedValue({ id: "re_9" });
    const result = await sendTransitionNotification("p1", "status_update", { ...ctx, detail: "Ready" });
    expect(result.recipient).toBe("fallback@example.org");
    expect(result.locale).toBe("en");
    expect((sendEmail.mock.calls[0][0] as { text: string }).text).toContain("Hi there,");
  });
});
