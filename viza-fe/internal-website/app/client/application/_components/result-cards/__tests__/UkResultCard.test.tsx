import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { UkSubmissionResult } from "@/lib/submission-result";
import { UkResultCard } from "../UkResultCard";

const i18n = vi.hoisted(() => ({ locale: "zh" as "en" | "zh" }));

vi.mock("next-intl", () => {
  const translations = {
    en: {
      "status.title.registration": "Your UKVI account step needs attention",
      "status.title.registration_ready": "Your UKVI application account is ready",
      "status.title.registration_attention": "Your UKVI account step needs attention",
      "status.title.form_incomplete": "Your UK application still needs information",
      "status.title.payment": "Your UK visa application needs attention",
      "status.badge.registration": "Account step",
      "status.badge.registration_ready": "Account ready",
      "status.badge.registration_attention": "Account step",
      "status.badge.form_incomplete": "Needs information",
      "status.badge.payment": "Needs attention",
      "status.description.registration": "The UKVI account step needs attention before the application can continue.",
      "status.description.registration_ready": "Your UKVI application account is ready.",
      "status.description.registration_attention": "The UKVI account step needs attention before the application can continue.",
      "status.description.form_incomplete": "The official form still needs information.",
      "status.description.payment": "The application has reached an official fee checkpoint. VIZA does not collect or process the UK government fee.",
      "retry.body": "The saved UK application can be sent through the official continuation flow again.",
      "retry.confirm": "Continue the saved UK application through the official portal now?",
      "retry.button": "Continue UK application",
      "retry.loading": "Starting…",
      "retry.error": "Could not start the UK application continuation.",
      "progress": "Prefill progress: about {pagesFilled}/{totalPages} pages saved.",
      "reference.label": "Application reference",
      "credentials.title": "UKVI application account",
      "credentials.body": "These credentials are for the UKVI visa application account only.",
      "credentials.reveal": "Reveal account credentials",
      "credentials.revealing": "Loading credentials…",
      "credentials.hide": "Hide and clear credentials",
      "credentials.resume": "Open official application",
      "credentials.email": "Email",
      "credentials.password": "Password",
      "credentials.resumeUrl": "Official resume link",
      "credentials.copy": "Copy value",
      "credentials.copied": "Copied",
      "credentials.notBound": "No UKVI credentials are bound to this application yet.",
      "credentials.timeout": "The credential request timed out.",
      "credentials.error": "The UKVI credentials could not be loaded.",
      "credentials.copyUnavailable": "Copy is unavailable in this browser.",
      "credentials.copyError": "The value could not be copied.",
      "officialLinks.title": "Application and biometrics links",
      "officialLinks.body": "A UK Standard Visitor applicant normally completes the online application first.",
      "officialLinks.signIn": "Continue UK visa application",
      "officialLinks.signInDescription": "Open the official GOV.UK sign-in page.",
      "officialLinks.findCentre": "Find a visa application centre",
      "officialLinks.findCentreDescription": "Use the official directory.",
      "evisa.title": "After a visa decision",
      "evisa.body": "eVisa is for setting up or accessing your UKVI account.",
      "evisa.setup": "Set up a UKVI/eVisa account",
      "evisa.setupDescription": "Open the official GOV.UK setup page.",
      "evisa.view": "View or prove immigration status",
      "evisa.viewDescription": "Open the official service.",
      "evisa.update": "Update UKVI account details",
      "evisa.updateDescription": "Use the official service to update details.",
    },
    zh: {
      "status.title.registration": "英国签证申请账户步骤需要处理",
      "status.title.registration_ready": "英国签证申请账户已准备好",
      "status.title.registration_attention": "英国签证申请账户步骤需要处理",
      "status.title.form_incomplete": "英国签证申请仍需要补充信息",
      "status.title.payment": "英国签证申请需要处理",
      "status.badge.registration": "账户步骤",
      "status.badge.registration_ready": "账户已准备",
      "status.badge.registration_attention": "账户步骤",
      "status.badge.form_incomplete": "需要补充信息",
      "status.badge.payment": "需要处理",
      "status.description.registration": "英国 UKVI 账户步骤需要处理后，申请才能继续。",
      "status.description.registration_ready": "英国 UKVI 申请账户已经准备好",
      "status.description.registration_attention": "英国 UKVI 账户步骤需要处理后，申请才能继续。",
      "status.description.form_incomplete": "官网表格在进入核对前仍需要信息或材料。",
      "status.description.payment": "申请已到达官网费用检查点。VIZA 不收取或处理英国政府签证费用",
      "retry.body": "可以重新沿着官网继续流程处理已保存的英国申请。",
      "retry.confirm": "现在通过官网继续这份已保存的英国申请吗？",
      "retry.button": "继续英国签证申请",
      "retry.loading": "正在启动…",
      "retry.error": "无法启动英国申请继续流程，请稍后重试。",
      "progress": "自动填写进度：约 {pagesFilled}/{totalPages} 页已保存。",
      "reference.label": "申请参考号",
      "credentials.title": "UKVI 申请账户",
      "credentials.body": "这些凭据仅用于 UKVI 签证申请账户",
      "credentials.reveal": "显示申请账户凭据",
      "credentials.revealing": "正在读取凭据…",
      "credentials.hide": "隐藏并清除凭据",
      "credentials.resume": "打开官方申请",
      "credentials.email": "邮箱",
      "credentials.password": "密码",
      "credentials.resumeUrl": "官方继续申请链接",
      "credentials.copy": "复制值",
      "credentials.copied": "已复制",
      "credentials.notBound": "这份申请暂时没有绑定 UKVI 凭据。",
      "credentials.timeout": "读取凭据超时，请重试。",
      "credentials.error": "暂时无法读取 UKVI 凭据，请稍后重试。",
      "credentials.copyUnavailable": "当前浏览器不支持复制，请手动选择并复制。",
      "credentials.copyError": "复制失败，请手动选择并复制。",
      "officialLinks.title": "申请与生物信息采集入口",
      "officialLinks.body": "英国标准访客签证通常先完成在线申请",
      "officialLinks.signIn": "继续英国签证申请",
      "officialLinks.signInDescription": "打开 GOV.UK 官方入口",
      "officialLinks.findCentre": "查找签证申请中心",
      "officialLinks.findCentreDescription": "使用官方目录查找所在地区的中心",
      "evisa.title": "获得签证决定后",
      "evisa.body": "eVisa 用于设置或访问 UKVI 账户",
      "evisa.setup": "设置 UKVI/eVisa 账户",
      "evisa.setupDescription": "打开 GOV.UK 官方设置页面",
      "evisa.view": "查看或证明移民身份",
      "evisa.viewDescription": "打开官方服务查看 eVisa 状态",
      "evisa.update": "更新 UKVI 账户信息",
      "evisa.updateDescription": "使用官方服务更新信息",
    },
  } as const;

  return {
    useTranslations: () => (key: string, values?: Record<string, string | number>) => {
      const template = translations[i18n.locale][key as keyof (typeof translations)["en"]] ?? key;
      return Object.entries(values ?? {}).reduce<string>(
        (text, [name, value]) => text.replace(`{${name}}`, String(value)),
        template,
      );
    },
  };
});

afterEach(() => {
  i18n.locale = "zh";
  vi.unstubAllGlobals();
});

const legacySecretBearingResult = {
  country: "UK" as const,
  status: "stopped_at_pay" as const,
  portalUrl: "https://visas-immigration.service.gov.uk/forceResume/private-token",
  portalUsername: "private@example.com",
  generatedPasswordCipher: "salt:iv:ciphertext:tag",
  applicationReference: "GWF123456789",
} satisfies UkSubmissionResult;

describe("UkResultCard", () => {
  it("does not request credentials on mount and keeps the legacy fee state truthful", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<UkResultCard applicationId="application-id" result={legacySecretBearingResult} />);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText("需要处理")).toBeInTheDocument();
    expect(screen.getByText(/VIZA 不收取或处理英国政府签证费用/u)).toBeInTheDocument();
    expect(screen.getByText("GWF123456789")).toBeInTheDocument();
    expect(screen.queryByText("private@example.com")).not.toBeInTheDocument();
    expect(screen.queryByText("salt:iv:ciphertext:tag")).not.toBeInTheDocument();
    expect(screen.queryByText("已支付")).not.toBeInTheDocument();
  });

  it("renders the form checkpoint in English without calling the credentials endpoint", () => {
    i18n.locale = "en";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(
      <UkResultCard
        applicationId="application-id"
        result={{ country: "UK", status: "registered", checkpoint: "form_incomplete" }}
      />,
    );

    expect(screen.getByText("Your UK application still needs information")).toBeInTheDocument();
    expect(screen.getByText("The official form still needs information.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not describe a registration checkpoint as ready when attention is required", () => {
    i18n.locale = "en";
    render(
      <UkResultCard
        applicationId="application-id"
        result={{ country: "UK", status: "needs_attention", checkpoint: "registration" }}
      />,
    );

    expect(screen.getByText("Your UKVI account step needs attention")).toBeInTheDocument();
    expect(screen.queryByText("Your UKVI application account is ready")).not.toBeInTheDocument();
  });

  it("allows a parent save-aware continuation for a retryable needs-attention checkpoint", async () => {
    const fetchMock = vi.fn();
    const onContinue = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("confirm", vi.fn(() => true));

    render(
      <UkResultCard
        applicationId="application-id"
        onContinue={onContinue}
        result={{ country: "UK", status: "needs_attention", checkpoint: "form_incomplete" }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "继续英国签证申请" }));
    await waitFor(() => expect(onContinue).toHaveBeenCalledTimes(1));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falls back safely when a stored checkpoint is no longer recognized", () => {
    i18n.locale = "en";
    render(<UkResultCard applicationId="application-id" result={{
      country: "UK", status: "needs_attention",
      checkpoint: "old_unknown_checkpoint" as UkSubmissionResult["checkpoint"],
    }} />);
    expect(screen.getByText("Your UK application still needs information")).toBeInTheDocument();
  });

  it("reveals credentials only after an explicit click, supports copy, and clears on hide", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        email: "ukvi@example.com",
        password: "one-time-password",
        resumeUrl: "https://visas-immigration.service.gov.uk/forceResume/resume-token",
        revealedAt: "2026-11-20T10:00:00.000Z",
      }),
    });
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("fetch", fetchMock);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });

    render(<UkResultCard applicationId="application-id" result={{ country: "UK", status: "registered" }} />);

    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "显示申请账户凭据" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/applications/application-id/uk-portal-credentials",
      expect.objectContaining({ method: "POST", cache: "no-store" }),
    ));
    expect(await screen.findByText("ukvi@example.com")).toBeInTheDocument();
    expect(screen.getByText("one-time-password")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /打开官方申请/u })).toHaveAttribute(
      "href",
      "https://visas-immigration.service.gov.uk/forceResume/resume-token",
    );

    fireEvent.click(screen.getAllByRole("button", { name: "复制值" })[0]);
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("ukvi@example.com"));
    fireEvent.click(screen.getByRole("button", { name: "隐藏并清除凭据" }));
    expect(screen.queryByText("ukvi@example.com")).not.toBeInTheDocument();
    expect(screen.queryByText("one-time-password")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "显示申请账户凭据" })).toBeInTheDocument();
  });

  it("shows a localized safe error when credentials are not bound", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: "internal credential detail" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<UkResultCard applicationId="application-id" result={{ country: "UK", status: "registered" }} />);
    fireEvent.click(screen.getByRole("button", { name: "显示申请账户凭据" }));

    expect(await screen.findByText("这份申请暂时没有绑定 UKVI 凭据。")).toBeInTheDocument();
    expect(screen.queryByText("internal credential detail")).not.toBeInTheDocument();
  });

  it("clears revealed credentials when the page is hidden or the application changes", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        email: "hidden@example.com",
        password: "hidden-password",
        resumeUrl: "https://apply-uk-visa.service.gov.uk/forceResume?token=hidden-token",
        revealedAt: "2026-11-20T10:00:00.000Z",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const view = render(<UkResultCard applicationId="application-a" result={{ country: "UK", status: "registered" }} />);
    fireEvent.click(screen.getByRole("button", { name: "显示申请账户凭据" }));
    expect(await screen.findByText("hidden@example.com")).toBeInTheDocument();

    fireEvent(window, new Event("pagehide"));
    expect(screen.queryByText("hidden@example.com")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "显示申请账户凭据" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "显示申请账户凭据" }));
    expect(await screen.findByText("hidden@example.com")).toBeInTheDocument();
    view.rerender(<UkResultCard applicationId="application-b" result={{ country: "UK", status: "registered" }} />);
    expect(screen.queryByText("hidden@example.com")).not.toBeInTheDocument();
  });

  it("uses the official application, VAC directory, and eVisa links", () => {
    render(<UkResultCard applicationId="application-id" result={{ country: "UK", status: "registered" }} />);

    const hrefs = screen.getAllByRole("link").map((link) => link.getAttribute("href"));
    expect(hrefs).toEqual(expect.arrayContaining([
      "https://www.gov.uk/sign-in-visa",
      "https://www.gov.uk/find-a-visa-application-centre",
      "https://www.gov.uk/evisa/set-up-ukvi-account",
      "https://www.gov.uk/view-prove-immigration-status",
      "https://www.gov.uk/update-uk-visas-immigration-account-details",
    ]));
  });

  it("keeps ordinary gov.uk continuation retry available", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("confirm", vi.fn(() => true));

    render(
      <UkResultCard
        applicationId="application-id"
        applicationCountry="UK"
        applicationVisaType="UK_STANDARD_VISITOR"
        result={{ country: "UK", status: "registered" }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "继续英国签证申请" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/applications/application-id/retry-submission",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });
});
