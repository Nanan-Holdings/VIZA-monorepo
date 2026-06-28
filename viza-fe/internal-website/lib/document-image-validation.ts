export type OfficialDocumentImageSlot = "portrait_photo" | "passport_data_page";

export type OfficialImageIssueCode =
  | "file_too_large"
  | "unsupported_format"
  | "passport_uploaded_as_portrait"
  | "portrait_uploaded_as_passport"
  | "too_many_faces"
  | "no_face_detected"
  | "passport_page_unreadable";

export interface DocumentImageSignals {
  mimeType?: string | null;
  sizeBytes: number;
  width?: number | null;
  height?: number | null;
  faceCount?: number | null;
  ocrText?: string | null;
  readablePassport?: boolean | null;
  passportFieldCount?: number | null;
}

export interface OfficialImageValidationIssue {
  stage: OfficialDocumentImageSlot | "file";
  code: OfficialImageIssueCode;
  messageZh: string;
  messageEn: string;
}

export interface OfficialImageValidationResult {
  ok: boolean;
  issues: OfficialImageValidationIssue[];
}

const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;
const DEFAULT_ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function normalizeText(value: string | null | undefined) {
  return (value ?? "").toUpperCase().replace(/\s+/g, " ").trim();
}

function aspectRatio(signals: DocumentImageSignals) {
  if (!signals.width || !signals.height || signals.width <= 0 || signals.height <= 0) return null;
  return signals.width / signals.height;
}

function passportTextScore(text: string) {
  let score = 0;
  if (/\bPASSPORT\b/.test(text) || text.includes("护照")) score += 2;
  if (text.includes("P<") || /[A-Z0-9<]{20,}/.test(text)) score += 2;
  if (/\bNATIONALITY\b|\bDATE OF BIRTH\b|\bPLACE OF BIRTH\b|\bAUTHORITY\b|\bEXPIRY\b/.test(text)) score += 1;
  if (/\bPEOPLE'?S REPUBLIC\b|\bREPUBLIC\b|\bIMMIGRATION\b/.test(text)) score += 1;
  return score;
}

export function looksLikePassportDataPage(signals: DocumentImageSignals): boolean {
  if (signals.readablePassport === true) return true;
  if ((signals.passportFieldCount ?? 0) >= 2) return true;
  if (passportTextScore(normalizeText(signals.ocrText)) >= 2) return true;

  const ratio = aspectRatio(signals);
  return Boolean(ratio && ratio >= 1.25 && (signals.faceCount ?? 0) !== 1);
}

function looksLikePortraitOnly(signals: DocumentImageSignals): boolean {
  if (looksLikePassportDataPage(signals)) return false;
  const ratio = aspectRatio(signals);
  return signals.faceCount === 1 && Boolean(!ratio || (ratio >= 0.65 && ratio <= 1.25));
}

function issue(code: OfficialImageIssueCode, stage: OfficialImageValidationIssue["stage"]): OfficialImageValidationIssue {
  const messages: Record<OfficialImageIssueCode, Pick<OfficialImageValidationIssue, "messageZh" | "messageEn">> = {
    file_too_large: {
      messageZh: "文件大小：图片超过 2MB。请压缩后重新上传。",
      messageEn: "File size: the image is over 2MB. Please compress it and upload again.",
    },
    unsupported_format: {
      messageZh: "文件格式：仅支持 JPG/JPEG、PNG 或 WEBP 图片。请转换格式后重新上传。",
      messageEn: "File format: only JPG/JPEG, PNG, or WEBP images are supported. Please convert and upload again.",
    },
    passport_uploaded_as_portrait: {
      messageZh: "证件照环节：这张图片看起来是护照资料页，不是本人证件照。请在证件照位置上传近期正面免冠照片；护照资料页请上传到“护照资料页图片”。",
      messageEn: "Portrait photo: this image looks like a passport data page, not a portrait photo. Upload a recent front-facing portrait here and put the passport data page in the passport upload slot.",
    },
    portrait_uploaded_as_passport: {
      messageZh: "护照资料页环节：这张图片看起来是单人证件照，不是护照资料页。请上传包含姓名、护照号、出生日期和 MRZ 机读码的整张护照资料页。",
      messageEn: "Passport data page: this image looks like a single portrait, not a passport data page. Upload the full passport page with name, passport number, date of birth, and MRZ.",
    },
    too_many_faces: {
      messageZh: "证件照环节：检测到多张人脸。请上传只有申请人本人一张脸的证件照。",
      messageEn: "Portrait photo: multiple faces were detected. Please upload a portrait containing only the applicant.",
    },
    no_face_detected: {
      messageZh: "证件照环节：没有检测到清晰人脸。请上传正面、无遮挡、光线充足的证件照。",
      messageEn: "Portrait photo: no clear face was detected. Please upload a front-facing, unobstructed, well-lit portrait.",
    },
    passport_page_unreadable: {
      messageZh: "护照资料页环节：无法确认这是清晰护照资料页。请上传整页护照资料页，确保文字、头像和底部 MRZ 机读码清楚可见。",
      messageEn: "Passport data page: this does not look like a readable passport data page. Upload the full page with text, portrait, and MRZ clearly visible.",
    },
  };

  return { stage, code, ...messages[code] };
}

export function validateOfficialDocumentImage(input: {
  expected: OfficialDocumentImageSlot;
  signals: DocumentImageSignals;
  maxBytes?: number;
  allowedMimeTypes?: ReadonlySet<string>;
}): OfficialImageValidationResult {
  const issues: OfficialImageValidationIssue[] = [];
  const maxBytes = input.maxBytes ?? DEFAULT_MAX_BYTES;
  const allowedMimeTypes = input.allowedMimeTypes ?? DEFAULT_ALLOWED_MIME_TYPES;
  const mimeType = input.signals.mimeType?.toLowerCase();

  if (input.signals.sizeBytes > maxBytes) issues.push(issue("file_too_large", "file"));
  if (mimeType && !allowedMimeTypes.has(mimeType)) issues.push(issue("unsupported_format", "file"));

  if (input.expected === "portrait_photo") {
    if (looksLikePassportDataPage(input.signals)) {
      issues.push(issue("passport_uploaded_as_portrait", "portrait_photo"));
    } else if ((input.signals.faceCount ?? 1) > 1) {
      issues.push(issue("too_many_faces", "portrait_photo"));
    } else if (input.signals.faceCount === 0) {
      issues.push(issue("no_face_detected", "portrait_photo"));
    }
  }

  if (input.expected === "passport_data_page") {
    if (looksLikePortraitOnly(input.signals)) {
      issues.push(issue("portrait_uploaded_as_passport", "passport_data_page"));
    } else if (input.signals.readablePassport === false && (input.signals.passportFieldCount ?? 0) === 0) {
      issues.push(issue("passport_page_unreadable", "passport_data_page"));
    }
  }

  return { ok: issues.length === 0, issues };
}

export function buildOfficialImageValidationMessage(
  issues: OfficialImageValidationIssue[],
  locale: "zh" | "en" = "zh",
): string {
  if (issues.length === 0) return "";
  const title = locale === "zh" ? "上传的图片需要修改：" : "Please fix the uploaded image:";
  const lines = issues.map((item) => `- ${locale === "zh" ? item.messageZh : item.messageEn}`);
  return [title, ...lines].join("\n");
}

export function translateOfficialImagePortalError(
  errorMessage: string | null | undefined,
  locale: "zh" | "en" = "zh",
): string | null {
  const normalized = (errorMessage ?? "").toLowerCase();
  if (!normalized) return null;

  if (normalized.includes("too many faces") && normalized.includes("portrait")) {
    return locale === "zh"
      ? [
          "官网提示证件照需要修改：",
          "- 证件照环节：官网检测到多张人脸。常见原因是把护照资料页、含证件头像的整页照片，或多人照片上传到了证件照位置。",
          "- 请返回材料步骤，在“本人证件照片 / 证件照”上传近期正面免冠单人证件照。",
          "- 在“护照资料页图片”位置上传整张护照资料页，确保姓名、护照号、头像和底部 MRZ 机读码清楚可见。",
          "- 修改后重新提交。",
        ].join("\n")
      : [
          "The official portal needs the portrait photo fixed:",
          "- Portrait photo: the portal detected multiple faces. This often happens when a passport data page, an ID page with an embedded portrait, or a group photo is uploaded in the portrait slot.",
          "- Go back to documents and upload a recent front-facing single-person portrait in the portrait photo slot.",
          "- Upload the full passport data page in the passport data page slot, with the name, passport number, portrait, and MRZ clearly visible.",
          "- Submit again after replacing the image.",
        ].join("\n");
  }

  if (normalized.includes("no face") && normalized.includes("portrait")) {
    return locale === "zh"
      ? [
          "官网提示证件照需要修改：",
          "- 证件照环节：官网没有检测到清晰人脸。",
          "- 请上传正面、无遮挡、光线充足的近期单人证件照，然后重新提交。",
        ].join("\n")
      : [
          "The official portal needs the portrait photo fixed:",
          "- Portrait photo: the portal did not detect a clear face.",
          "- Upload a recent front-facing, unobstructed, well-lit single-person portrait and submit again.",
        ].join("\n");
  }

  return null;
}
