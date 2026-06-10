import type { Page } from "@playwright/test";

export type VietnamPortalStateId =
  | "landing_page_loaded"
  | "note_modal_visible"
  | "language_switch_visible"
  | "apply_now_visible"
  | "application_form_visible"
  | "captcha_visible"
  | "upload_passport_visible"
  | "upload_portrait_visible"
  | "payment_page_visible"
  | "registration_code_visible"
  | "white_screen"
  | "portal_error"
  | "network_blocked"
  | "layout_changed";

export interface VietnamPortalSnapshot {
  url: string;
  title: string;
  bodyText: string;
  bodyHtmlLength: number;
  buttonTexts: string[];
  linkHrefs: string[];
  antFormItemCount: number;
  inputCount: number;
  hasBody: boolean;
  hasVisibleModal: boolean;
  modalText: string;
  hasApplyEntry: boolean;
  hasLanguageSwitch: boolean;
  hasCaptcha: boolean;
  hasPassportUpload: boolean;
  hasPortraitUpload: boolean;
  hasPayment: boolean;
  registrationCode: string | null;
  failedRequestCount: number;
  mainRequestFailed: boolean;
}

const REGISTRATION_CODE_PATTERN =
  /(?:mã hồ sơ|ma ho so|registration\s*(?:code|number)|application\s*(?:code|number))[:\s#-]*([A-Z0-9]{8,})/i;

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function extractVietnamRegistrationCode(text: string): string | null {
  const match = text.match(REGISTRATION_CODE_PATTERN);
  return match?.[1] ?? null;
}

export function classifyVietnamPortalSnapshot(snapshot: VietnamPortalSnapshot): VietnamPortalStateId {
  const text = normalizeText(snapshot.bodyText);
  const lowerText = text.toLowerCase();
  const lowerModal = normalizeText(snapshot.modalText).toLowerCase();
  const hasControls = snapshot.inputCount > 0 || snapshot.buttonTexts.length > 0 || snapshot.linkHrefs.length > 0;

  if (snapshot.mainRequestFailed) return "network_blocked";
  if (!snapshot.hasBody || (text.length < 20 && snapshot.bodyHtmlLength < 2_000 && !hasControls)) {
    return "white_screen";
  }
  if (
    /\b(maintenance|temporarily unavailable|service unavailable|access denied|forbidden|bad gateway|gateway timeout|internal server error)\b/i.test(text)
  ) {
    return "portal_error";
  }
  if (snapshot.registrationCode) return "registration_code_visible";
  if (snapshot.hasPayment) return "payment_page_visible";
  if (snapshot.hasCaptcha) return "captcha_visible";
  if (
    (snapshot.hasVisibleModal &&
      (/\b(note|notice|attention|important|warning)\b/i.test(lowerModal) ||
        /lưu ý|thông báo|chú ý/i.test(lowerModal))) ||
    /\bnote\b\s+declaration instructions|confirmation of reading carefully instructions|confirm compliance with vietnamese laws/i.test(text)
  ) {
    return "note_modal_visible";
  }
  if (snapshot.antFormItemCount > 10) return "application_form_visible";
  if (snapshot.hasPassportUpload) return "upload_passport_visible";
  if (snapshot.hasPortraitUpload) return "upload_portrait_visible";
  if (snapshot.hasApplyEntry) return "apply_now_visible";
  if (snapshot.hasLanguageSwitch) return "language_switch_visible";
  if (/e-visa|electronic visa|vietnam|viet nam|immigration/i.test(lowerText)) {
    return "landing_page_loaded";
  }
  return "layout_changed";
}

export async function readVietnamPortalSnapshot(
  page: Page,
  failedRequestCount = 0,
  mainRequestFailed = false,
): Promise<VietnamPortalSnapshot> {
  const evaluated = await page.evaluate(() => {
    const visibleText = (element: Element | null): string => {
      if (!element) return "";
      const style = globalThis.getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
        return "";
      }
      return (element.textContent ?? "").trim();
    };

    const body = document.body;
    const bodyText = body?.innerText ?? "";
    const buttons = Array.from(document.querySelectorAll("button, [role='button']"))
      .map((button) => visibleText(button))
      .filter(Boolean)
      .slice(0, 40);
    const links = Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"))
      .map((anchor) => anchor.href || anchor.getAttribute("href") || "")
      .filter(Boolean)
      .slice(0, 80);
    const modal = document.querySelector(".ant-modal, [role='dialog'], .modal");
    const modalText = visibleText(modal);
    const combinedText = `${bodyText}\n${modalText}\n${buttons.join("\n")}`;
    const normalizedText = combinedText.toLowerCase();
    const hasApplyEntry =
      links.some((href) => /\/e-visa\/foreigners/i.test(href)) ||
      /for foreigners outside viet ?nam applying personally|apply now|e-visa for foreigners/i.test(combinedText);
    const registrationMatch = combinedText.match(
      /(?:mã hồ sơ|ma ho so|registration\s*(?:code|number)|application\s*(?:code|number))[:\s#-]*([A-Z0-9]{8,})/i,
    );

    return {
      bodyText,
      bodyHtmlLength: body?.innerHTML.length ?? 0,
      buttonTexts: buttons,
      linkHrefs: links,
      antFormItemCount: document.querySelectorAll(".ant-form-item").length,
      inputCount: document.querySelectorAll("input, select, textarea").length,
      hasBody: Boolean(body),
      hasVisibleModal: Boolean(modal && modalText),
      modalText,
      hasApplyEntry,
      hasLanguageSwitch: /english|tiếng việt|vietnamese/i.test(combinedText),
      hasCaptcha:
        /captcha|security code|mã xác nhận|verification code/i.test(normalizedText) ||
        Boolean(document.querySelector("img[src*='captcha' i], input[name*='captcha' i], input[id*='captcha' i]")),
      hasPassportUpload:
        /upload\s+(?:your\s+)?passport|passport\s+(?:photo|scan|upload)|tải.*hộ chiếu/i.test(normalizedText) ||
        Boolean(document.querySelector("input[type='file'][name*='passport' i], input[type='file'][id*='passport' i]")),
      hasPortraitUpload:
        /upload\s+(?:your\s+)?(?:portrait|photo)|portrait\s+(?:photo|upload)|ảnh chân dung/i.test(normalizedText) ||
        Boolean(document.querySelector("input[type='file'][name*='portrait' i], input[type='file'][id*='portrait' i]")),
      hasPayment:
        /\/(?:payment|pay)(?:\/|$)/i.test(location.pathname) ||
        buttons.some((text) => /^(pay|pay now|make payment|thanh toán|submit payment)$/i.test(text)) ||
        /payment gateway\s*[:#-]|transaction\s*(?:reference|id)|card number|payment amount/i.test(normalizedText),
      registrationCode: registrationMatch?.[1] ?? null,
    };
  });

  return {
    url: page.url(),
    title: await page.title().catch(() => ""),
    bodyText: evaluated.bodyText,
    bodyHtmlLength: evaluated.bodyHtmlLength,
    buttonTexts: evaluated.buttonTexts,
    linkHrefs: evaluated.linkHrefs,
    antFormItemCount: evaluated.antFormItemCount,
    inputCount: evaluated.inputCount,
    hasBody: evaluated.hasBody,
    hasVisibleModal: evaluated.hasVisibleModal,
    modalText: evaluated.modalText,
    hasApplyEntry: evaluated.hasApplyEntry,
    hasLanguageSwitch: evaluated.hasLanguageSwitch,
    hasCaptcha: evaluated.hasCaptcha,
    hasPassportUpload: evaluated.hasPassportUpload,
    hasPortraitUpload: evaluated.hasPortraitUpload,
    hasPayment: evaluated.hasPayment,
    registrationCode: evaluated.registrationCode ?? extractVietnamRegistrationCode(evaluated.bodyText),
    failedRequestCount,
    mainRequestFailed,
  };
}
