import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KoreaAppointmentAssistant } from "./KoreaAppointmentAssistant";

vi.mock("next-intl", () => ({
  useLocale: () => "zh",
}));

const center = {
  code: "BJ",
  nameEn: "Korea Visa Application Center Beijing",
  nameZh: "韩国签证申请中心（北京）",
  officialUrl: "https://example.test/official",
  bookingUrl: "https://example.test/booking",
  bookingSearchUrl: "https://example.test/search",
  addressZh: "北京市",
  provinces: ["北京"],
  consularPostZh: "大韩民国驻中国大使馆",
  consularPostEn: "Embassy of the Republic of Korea in China",
  serviceMode: "appointment_required",
  liveBookingMode: "sms_sync_supported",
  acceptsWalkIn: false,
  appointmentRuleZh: "须预约",
  appointmentRuleEn: "Appointment required",
  importantNoticesZh: [],
  importantNoticesEn: [],
};

function snapshot(overrides: Record<string, unknown> = {}) {
  return {
    routing: {
      basis: "residence",
      recommended: center,
      alternatives: [],
      allCenters: [center],
    },
    job: { id: "job-1", status: "slot_search_started", mode: "assisted_live" },
    manualAction: null,
    changeIntent: null,
    slots: [],
    confirmation: null,
    appointmentHistory: [],
    ...overrides,
  };
}

function response(body: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as Response;
}

function requestedActions() {
  return vi.mocked(fetch).mock.calls.flatMap(([, init]) => {
    if (!init?.body) return [];
    return [JSON.parse(String(init.body)) as { action: string }];
  });
}

describe("KoreaAppointmentAssistant back navigation", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("returns from SMS verification to center selection", async () => {
    const otpSnapshot = snapshot({
      manualAction: {
        action_type: "sms_verification_required",
        instruction: null,
        expires_at: null,
        metadata_redacted_json: null,
      },
    });
    vi.mocked(fetch)
      .mockResolvedValueOnce(response(otpSnapshot))
      .mockResolvedValueOnce(response(snapshot()));

    render(<KoreaAppointmentAssistant applicationId="application-1" />);
    fireEvent.click(await screen.findByRole("button", { name: "返回选择领区" }));

    await waitFor(() => expect(requestedActions()).toContainEqual(expect.objectContaining({ action: "return-to-center-selection" })));
  });

  it("returns from slot selection to a fresh SMS verification session", async () => {
    const slotsSnapshot = snapshot({
      job: { id: "job-1", status: "appointment_slots_observed", mode: "assisted_live" },
      slots: [{
        id: "slot-1",
        appointment_date: "2026-09-03",
        appointment_time: "09:30",
        appointment_location: "Korea Visa Application Center Beijing",
        status: "observed",
      }],
    });
    vi.mocked(fetch)
      .mockResolvedValueOnce(response(slotsSnapshot))
      .mockResolvedValueOnce(response(snapshot({ job: { id: "job-1", status: "sms_restart_required" } })));

    render(<KoreaAppointmentAssistant applicationId="application-1" />);
    fireEvent.click(await screen.findByRole("button", { name: "返回短信验证" }));

    await waitFor(() => expect(requestedActions()).toContainEqual(expect.objectContaining({ action: "return-to-sms-verification" })));
  });

  it("returns from final approval to the full observed slot list", async () => {
    const selectedSlot = {
      id: "slot-1",
      appointment_date: "2026-09-03",
      appointment_time: "09:30",
      appointment_location: "Korea Visa Application Center Beijing",
      status: "user_selected",
    };
    const confirmSnapshot = snapshot({
      job: { id: "job-1", status: "slot_selected", mode: "assisted_live" },
      manualAction: {
        action_type: "final_booking_approval_required",
        instruction: null,
        expires_at: null,
        metadata_redacted_json: null,
      },
      slots: [selectedSlot],
    });
    vi.mocked(fetch)
      .mockResolvedValueOnce(response(confirmSnapshot))
      .mockResolvedValueOnce(response(snapshot({
        job: { id: "job-1", status: "appointment_slots_observed", mode: "assisted_live" },
        slots: [{ ...selectedSlot, status: "observed" }],
      })));

    render(<KoreaAppointmentAssistant applicationId="application-1" />);
    fireEvent.click(await screen.findByRole("button", { name: "返回选择时间" }));

    await waitFor(() => expect(requestedActions()).toContainEqual(expect.objectContaining({ action: "return-to-slot-selection" })));
  });
});
