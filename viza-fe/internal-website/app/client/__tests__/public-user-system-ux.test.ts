import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { maskSensitiveText } from "@/lib/client/mask-sensitive-text";
import {
  getVisaPackageTitle,
  getVisaPackageTitleZh,
  getVisaTypeDisplayName,
  getVisaTypeDisplayNameZh,
} from "@/lib/visa-destinations";

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

function readMessages(locale: "en" | "zh") {
  return JSON.parse(
    readSource(`messages/${locale}.json`)
  ) as Record<string, unknown>;
}

function getNestedString(source: Record<string, unknown>, path: string): string {
  const value = path.split(".").reduce<unknown>((current, key) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[key];
  }, source);
  return typeof value === "string" ? value : "";
}

describe("public user system UX", () => {
  it("keeps top navigation focused on Home, Application, Concierge, and Settings", () => {
    const navbar = readSource("components/client/navbar.tsx");

    expect(navbar).toContain('const leftTabs = ["Home", "Application"]');
    expect(navbar).toContain('const mobileTabs = ["Home", "Application", "Settings"]');
    expect(navbar).toContain("renderStandaloneChatTab(false)");
    expect(navbar).toContain("renderStandaloneChatTab(true)");
    expect(navbar).toContain('router.push("/client/application")');
    expect(navbar).not.toContain('const leftTabs = ["Home", "Application", "Status"]');
    expect(navbar).not.toContain('const mobileTabs = ["Home", "Application", "Status", "Settings"]');
  });

  it("keeps Application as a real center with all applications above the reusable catalogue", () => {
    const applicationPage = readSource("app/client/application/page.tsx");
    const en = readMessages("en");
    const zh = readMessages("zh");

    expect(applicationPage).not.toContain("router.replace");
    expect(applicationPage).toContain("AddDestinationSection");
    expect(applicationPage).toContain("getClientStatusData");
    expect(applicationPage).toContain("toApplicationListItem");
    expect(applicationPage).toContain("getRecentApplicationTarget");
    expect(applicationPage).toContain("BackButton");
    expect(applicationPage).toContain('mode="manage"');
    expect(applicationPage).toContain("StatusGuide");
    expect(applicationPage).not.toContain("getRecentApplicationFormHref");
    expect(applicationPage).toContain('fallbackHref="/client/home"');
    expect(applicationPage).toContain('href="#my-applications"');
    expect(applicationPage).toContain('href="#application-status-guide"');
    expect(applicationPage).toContain('href="#start-new-application"');
    expect(applicationPage).toContain('id="application-status-guide"');
    expect(applicationPage).toContain("primaryCtaLabel");
    expect(applicationPage).not.toContain("t(\"eyebrow\")");
    expect(applicationPage).toContain("border-y border-[#dce5f0] bg-[#eef4fb]");
    expect(applicationPage).toContain("sm:inline-grid sm:grid-cols-3");
    expect(getNestedString(en, "applicationCenter.myApplicationsTitle")).toBe("My applications");
    expect(getNestedString(zh, "applicationCenter.myApplicationsTitle")).toBe("我的申请");
    expect(getNestedString(en, "applicationCenter.primaryCta.continue")).toBe("Continue latest application");
    expect(getNestedString(zh, "applicationCenter.primaryCta.continue")).toBe("继续最新的申请");
  });

  it("keeps status focused on application management and sends empty state to Application center", () => {
    const statusPage = readSource("app/client/status/page.tsx");

    expect(statusPage).not.toContain('from "./add-destination-section"');
    expect(statusPage).not.toContain("<AddDestinationSection");
    expect(statusPage).toContain('href="/client/application"');
    expect(statusPage).toContain('from "./status-guide"');
  });

  it("keeps Application content and start-new anchor below the fixed navbar", () => {
    const applicationPage = readSource("app/client/application/page.tsx");
    const addDestination = readSource("app/client/status/add-destination-section.tsx");
    const layout = readSource("app/client/layout.tsx");

    expect(applicationPage).not.toContain("-mt-6");
    expect(applicationPage).toContain('id="my-applications"');
    expect(applicationPage).toContain('id="application-status-guide"');
    expect(applicationPage).toContain('id="start-new-application"');
    expect(applicationPage).toContain("scroll-mt-[152px] sm:scroll-mt-36 xl:scroll-mt-32");
    expect(addDestination).toContain("id?: string");
    expect(addDestination).toContain("className?: string");
    expect(addDestination).toContain("id={id}");
    expect(layout).toContain('pathname.startsWith("/client/application/")');
    expect(layout).toContain('isApplicationFlow && "lg:h-dvh lg:overflow-hidden"');
    expect(layout).not.toContain('pathname === "/client/application" || pathname.startsWith("/client/application/")');
  });

  it("documents status semantics without treating queued or official filling as submitted", () => {
    const statusGuide = readSource("app/client/status/status-guide.tsx");
    const en = readMessages("en");
    const zh = readMessages("zh");

    expect(statusGuide).toContain("queued");
    expect(statusGuide).toContain("officialFilling");
    expect(statusGuide).toContain("submitted");
    expect(statusGuide).toContain("STATUS_GUIDE_ITEMS.map");
    expect(statusGuide).toContain("md:grid-cols-2");
    expect(statusGuide).not.toContain("StatusGuideClient");
    expect(statusGuide).not.toContain("<details");
    expect(statusGuide).not.toContain("aria-expanded");
    expect(getNestedString(en, "clientStatus.statusGuide.expand")).toBe("");
    expect(getNestedString(en, "clientStatus.statusGuide.collapse")).toBe("");
    expect(getNestedString(zh, "clientStatus.statusGuide.expand")).toBe("");
    expect(getNestedString(zh, "clientStatus.statusGuide.collapse")).toBe("");
    expect(getNestedString(en, "clientStatus.statusGuide.items.queued.description")).toContain("not necessarily started");
    expect(getNestedString(en, "clientStatus.statusGuide.items.officialFilling.description")).toContain("still not submitted");
    expect(getNestedString(en, "clientStatus.statusGuide.items.submitted.description")).toContain("official receipt");
    expect(getNestedString(zh, "clientStatus.statusGuide.items.queued.description")).toContain("不代表官网填写已经开始");
    expect(getNestedString(zh, "clientStatus.statusGuide.items.officialFilling.description")).toContain("仍未提交");
    expect(getNestedString(zh, "clientStatus.statusGuide.items.submitted.description")).toContain("官方回执");
  });

  it("deduplicates Settings profile entry, removes Settings language row, and masks account snapshot identifiers", () => {
    const settings = readSource("app/client/settings/settings-content.tsx");

    expect(settings).toContain('title={t("rows.universalInfo.title")}');
    expect(settings).not.toContain('title={t("rows.account.title")}');
    expect(settings).not.toContain('title={t("rows.language.title")}');
    expect(maskSensitiveText("+65 9123 4567")).toBe("•••• 4567");
    expect(maskSensitiveText("E12345678")).toBe("•••• 5678");
    expect(maskSensitiveText(null)).toBeNull();
  });

  it("labels the top language selector and keeps Philippines eTravel out of visa wording", () => {
    const languageSelector = readSource("components/client/language-selector.tsx");
    const en = readMessages("en");
    const zh = readMessages("zh");

    expect(languageSelector).toContain("Language/语言");
    expect(getVisaTypeDisplayName("PH_ETRAVEL_ARRIVAL_CARD")).toContain("eTravel");
    expect(getVisaTypeDisplayName("PH_ETRAVEL_ARRIVAL_CARD")).toContain("Declaration");
    expect(getVisaTypeDisplayName("PH_ETRAVEL_ARRIVAL_CARD")).not.toContain("Visa");
    expect(getVisaTypeDisplayNameZh("PH_ETRAVEL_ARRIVAL_CARD")).toContain("eTravel");
    expect(getVisaTypeDisplayNameZh("PH_ETRAVEL_ARRIVAL_CARD")).toContain("申报");
    expect(getVisaPackageTitle("philippines", "PH_ETRAVEL_ARRIVAL_CARD", "en")).toContain("eTravel");
    expect(getVisaPackageTitle("philippines", "PH_ETRAVEL_ARRIVAL_CARD", "en")).toContain("Declaration");
    expect(getVisaPackageTitleZh("philippines", "PH_ETRAVEL_ARRIVAL_CARD")).toContain("eTravel");
    expect(getVisaPackageTitleZh("philippines", "PH_ETRAVEL_ARRIVAL_CARD")).toContain("申报");
  });
});
