import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KoreaAppointmentAssistant } from "./KoreaAppointmentAssistant";

const copy: Record<string, string> = {
  "page.backToForm": "返回申请表",
  "page.title": "韩国签证预约",
  "page.subtitle": "一次只完成一件事",
  "progress.ariaLabel": "预约进度",
  "progress.label": "预约进度",
  "progress.back": "返回上一步",
  "steps.review": "资料与领区",
  "steps.account": "官网验证",
  "steps.slots": "选择时间",
  "steps.confirm": "最终确认",
  "steps.result": "预约结果",
  "loading.title": "正在读取预约状态",
  "loading.body": "正在准备你的预约流程",
  "review.title": "确认资料与递签领区",
  "review.body": "请先核对资料",
  "review.name": "申请人英文姓名",
  "review.passport": "护照号码",
  "review.phone": "接收验证码的手机",
  "review.recommended": "系统推荐领区",
  "review.basisResidence": "现居住地推荐",
  "review.basisHukou": "户籍地推荐",
  "review.basisSelected": "手动选择",
  "review.changeCenter": "更改领区",
  "review.details": "查看领区依据与中心详情",
  "review.ambiguous": "请确认领区",
  "review.missingTitle": "预约资料尚未完整",
  "review.missingBody": "请补齐资料",
  "review.edit": "修改申请资料",
  "review.confirm": "确认资料并继续",
  "review.confirming": "正在保存确认",
  "common.notProvided": "未提供",
  "common.maskedPhone": "已登记手机号",
  "common.listSeparator": "、",
  "account.title": "完成官网验证",
  "account.focus": "连接官网完成验证",
  "account.body": "资料已确认",
  "account.restartBody": "请重新建立会话",
  "account.start": "查询官网时间",
  "account.viewMethod": "查看该中心办理方式",
  "account.checking": "正在查询官网时间",
  "account.scanProgress": "正在逐月读取官方预约日历",
  "account.smsBody": "验证码已发送",
  "account.expires": "验证码有效时间",
  "account.codeLabel": "短信验证码",
  "account.codePlaceholder": "输入验证码",
  "account.verify": "验证并读取时间",
  "account.verifying": "正在验证",
  "account.resend": "重新发送验证码",
  "account.backToCenter": "返回资料与领区",
  "account.manualBody": "该中心需要按照官方指引办理",
  "account.openOfficial": "打开官方办理入口",
  "account.workerTitle": "预约查询服务暂时不可用",
  "account.workerBody": "本次官网查询没有完成",
  "account.retry": "重新查询官网时间",
  "slots.title": "选择预约时间",
  "slots.body": "以下时间来自当前官方会话",
  "slots.choose": "选择此时间",
  "slots.continue": "使用这个时间继续",
  "slots.continuing": "正在保存所选时间",
  "slots.back": "返回官网验证",
  "slots.refresh": "重新读取时段",
  "slots.emptyTitle": "暂时没有开放的预约时间",
  "slots.emptyBody": "官方预约日历已完成检查",
  "slots.checkedAt": "官网检查时间",
  "slots.retry": "重新查询",
  "slots.checking": "正在重新查询",
  "slots.changeCenter": "更改领区",
  "slots.viewEvidence": "查看官网现场截图",
  "confirm.title": "确认最终预约",
  "confirm.body": "核对将要提交的预约",
  "confirm.date": "预约日期",
  "confirm.time": "预约时间",
  "confirm.location": "递签地点",
  "confirm.applicant": "申请人",
  "confirm.selected": "已选择的官方时段",
  "confirm.authorization": "我已核对日期、时间和地点",
  "confirm.approve": "保存最终授权",
  "confirm.approving": "正在保存授权",
  "confirm.approvedTitle": "最终授权已保存",
  "confirm.approvedBody": "再次点击提交",
  "confirm.submit": "提交官方预约",
  "confirm.submitting": "正在提交官方预约",
  "confirm.back": "返回选择时间",
  "result.title": "预约已确认",
  "result.body": "预约证据已保存",
  "result.officialConfirmation": "官网预约确认",
  "result.number": "官方确认号",
  "result.print": "下载或打印确认单",
  "result.preparingPrint": "正在准备确认单",
  "result.manage": "管理预约",
  "result.cancelledTitle": "预约已取消",
  "result.cancelledBody": "官网已确认取消",
  "result.bookAgain": "重新预约",
  "result.restarting": "正在创建新流程",
  "management.title": "管理预约",
  "management.description": "改约和取消会查询官网记录",
  "management.reschedule": "改约",
  "management.cancel": "取消预约",
  "management.history": "查看历史预约记录",
  "centerSheet.title": "更改递签领区",
  "centerSheet.description": "选择符合要求的中心",
  "errors.loadFailed": "无法读取预约状态",
  "errors.operationFailed": "当前操作没有完成",
};

vi.mock("next-intl", () => {
  const translate = (key: string) => copy[key] ?? key;
  return { useTranslations: () => translate };
});

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

const shanghaiCenter = {
  ...center,
  code: "SH",
  nameEn: "Korea Visa Application Center Shanghai",
  nameZh: "韩国签证申请中心（上海）",
  addressZh: "上海市",
  provinces: ["上海"],
};

function snapshot(overrides: Record<string, unknown> = {}) {
  return {
    routing: {
      basis: "residence",
      recommended: center,
      alternatives: [shanghaiCenter],
      allCenters: [center, shanghaiCenter],
    },
    review: {
      applicantName: "ZHANG SAN",
      passportNumber: "E12****78",
      phoneMasked: "138****0000",
      currentResidenceProvince: "北京",
      hukouProvince: "北京",
      routingBasis: "hukou",
    },
    reviewConfirmed: true,
    reviewConfirmedAt: "2026-08-10T08:00:00.000Z",
    noSlots: null,
    job: { id: "job-1", status: "not_started", mode: "live_assisted" },
    manualAction: null,
    changeIntent: null,
    slots: [],
    confirmation: null,
    appointmentHistory: [],
    ...overrides,
  };
}

function response(body: unknown) {
  return { ok: true, status: 200, json: async () => body } as Response;
}

function errorResponse(error: string, code?: string, evidenceUrl?: string) {
  return { ok: false, status: 400, json: async () => ({ error, code, evidenceUrl }) } as Response;
}

function requestedActions() {
  return vi.mocked(fetch).mock.calls.flatMap(([, init]) => {
    if (!init?.body) return [];
    return [JSON.parse(String(init.body)) as { action: string }];
  });
}

function expectOnlyStage(stage: string) {
  const cards = document.querySelectorAll("[data-current-stage]");
  expect(cards).toHaveLength(1);
  expect(cards[0]).toHaveAttribute("data-current-stage", stage);
}

describe("KoreaAppointmentAssistant five-stage flow", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("loads read-only and persists review confirmation before official work", async () => {
    const reviewSnapshot = snapshot({ job: null, reviewConfirmed: false, reviewConfirmedAt: null });
    vi.mocked(fetch)
      .mockResolvedValueOnce(response(reviewSnapshot))
      .mockResolvedValueOnce(response(snapshot()));

    render(<KoreaAppointmentAssistant applicationId="application-1" />);

    expect(await screen.findByText("确认资料与递签领区")).toBeInTheDocument();
    expectOnlyStage("review");
    expect(requestedActions()).toEqual([]);

    fireEvent.click(screen.getByRole("button", { name: "确认资料并继续" }));
    await waitFor(() => expect(requestedActions()).toContainEqual(expect.objectContaining({ action: "confirm-review" })));
    await waitFor(() => expectOnlyStage("account"));
  });

  it("keeps a verified no-slot result inside the slot stage", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(response(snapshot()))
      .mockResolvedValueOnce(errorResponse("no slots", "no_slots_available", "https://example.test/evidence"))
      .mockResolvedValueOnce(response(snapshot()));

    render(<KoreaAppointmentAssistant applicationId="application-1" />);
    fireEvent.click(await screen.findByRole("button", { name: "查询官网时间" }));

    expect(await screen.findByText("暂时没有开放的预约时间")).toBeInTheDocument();
    expectOnlyStage("slots");
    expect(screen.queryByText("确认资料与递签领区")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "查看官网现场截图" })).toHaveAttribute("href", "https://example.test/evidence");
  });

  it("shows worker failure as an account checkpoint rather than no slots", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response(snapshot({
      job: { id: "job-1", status: "official_center_manual_checkpoint", mode: "live_assisted" },
      manualAction: {
        action_type: "official_center_manual_checkpoint",
        instruction: "Internal worker URL that must not be shown",
        expires_at: null,
        metadata_redacted_json: { workerUnavailable: true },
      },
    })));

    render(<KoreaAppointmentAssistant applicationId="application-1" />);

    expect(await screen.findByText("预约查询服务暂时不可用")).toBeInTheDocument();
    expectOnlyStage("account");
    expect(screen.queryByText("暂时没有开放的预约时间")).not.toBeInTheDocument();
    expect(screen.queryByText(/Internal worker URL/u)).not.toBeInTheDocument();
  });

  it("renders OTP as the only current task and can return to review", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(response(snapshot({
        job: { id: "job-1", status: "sms_verification_required", mode: "live_assisted" },
        manualAction: {
          action_type: "sms_verification_required",
          instruction: null,
          expires_at: "2026-09-03T09:35:00.000Z",
          metadata_redacted_json: { phoneMasked: "138****0000" },
        },
      })))
      .mockResolvedValueOnce(response(snapshot({ job: null, reviewConfirmed: false })));

    render(<KoreaAppointmentAssistant applicationId="application-1" />);

    expect(await screen.findByPlaceholderText("输入验证码")).toBeInTheDocument();
    expectOnlyStage("account");
    fireEvent.click(screen.getByRole("button", { name: "返回上一步" }));
    await waitFor(() => expect(requestedActions()).toContainEqual(expect.objectContaining({ action: "return-to-center-selection" })));
  });

  it("moves an observed official slot into the separate confirmation stage", async () => {
    const observed = {
      id: "slot-1",
      appointment_date: "2026-09-03",
      appointment_time: "09:30",
      appointment_location: "KVAC Beijing",
      status: "observed",
    };
    vi.mocked(fetch)
      .mockResolvedValueOnce(response(snapshot({
        job: { id: "job-1", status: "appointment_slots_observed" },
        slots: [observed],
      })))
      .mockResolvedValueOnce(response(snapshot({
        job: { id: "job-1", status: "slot_selected" },
        manualAction: { action_type: "final_booking_approval_required", instruction: null, expires_at: null },
        slots: [{ ...observed, status: "user_selected" }],
    })));

    render(<KoreaAppointmentAssistant applicationId="application-1" />);
    await screen.findByText("选择预约时间");
    expectOnlyStage("slots");
    fireEvent.click(await screen.findByRole("radio"));
    fireEvent.click(screen.getByRole("button", { name: "使用这个时间继续" }));

    expect(await screen.findByText("确认最终预约")).toBeInTheDocument();
    expectOnlyStage("confirm");
    expect(screen.queryByText("预约已确认")).not.toBeInTheDocument();
  });

  it("keeps final approval and official submission as two user gates", async () => {
    const selected = {
      id: "slot-1",
      appointment_date: "2026-09-03",
      appointment_time: "09:30",
      appointment_location: "KVAC Beijing",
      status: "user_selected",
    };
    const awaitingApproval = snapshot({
      job: { id: "job-1", status: "slot_selected" },
      manualAction: { action_type: "final_booking_approval_required", instruction: null, expires_at: null },
      slots: [selected],
    });
    vi.mocked(fetch)
      .mockResolvedValueOnce(response(awaitingApproval))
      .mockResolvedValueOnce(response(snapshot({
        job: { id: "job-1", status: "final_booking_approved" },
        slots: [selected],
      })));

    render(<KoreaAppointmentAssistant applicationId="application-1" />);
    const approve = await screen.findByRole("button", { name: "保存最终授权" });
    expect(approve).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(approve);

    expect(await screen.findByRole("button", { name: "提交官方预约" })).toBeInTheDocument();
    expect(requestedActions()).toContainEqual(expect.objectContaining({ action: "approve-final-booking" }));
    expect(requestedActions()).not.toContainEqual(expect.objectContaining({ action: "complete-final-booking" }));
  });

  it("keeps appointment management behind a secondary result-page sheet", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response(snapshot({
      job: { id: "job-1", status: "appointment_booked" },
      confirmation: {
        confirmation_number: "KR-OFFICIAL-1",
        appointment_date: "2026-09-03",
        appointment_time: "09:30",
        appointment_location: "KVAC Beijing",
        confirmation_pdf_url: "https://example.test/confirmation.pdf",
        raw_confirmation_redacted_json: { mode: "live_assisted" },
      },
      appointmentHistory: [{
        id: "history-1",
        confirmation_number: "KR-OLD-1",
        appointment_date: "2026-08-01",
        appointment_time: "10:00",
        appointment_location: "KVAC Beijing",
      }],
    })));

    render(<KoreaAppointmentAssistant applicationId="application-1" />);

    expect(await screen.findByText("预约已确认")).toBeInTheDocument();
    expectOnlyStage("result");
    expect(screen.queryByText("查看历史预约记录")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "管理预约" }));
    const sheet = await screen.findByRole("dialog");
    expect(within(sheet).getByRole("button", { name: "改约" })).toBeInTheDocument();
    expect(within(sheet).getByRole("button", { name: "取消预约" })).toBeInTheDocument();
    expect(within(sheet).getByText("查看历史预约记录")).toBeInTheDocument();
  });
});
