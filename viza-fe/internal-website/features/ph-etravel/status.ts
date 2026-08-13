type EnvLike = Record<string, string | undefined>;

export {
  classifyPhEtravelResultState,
  createPhEtravelResultRecoveryPresentation,
  hasPhEtravelAuthoritativePostSubmitReference,
  isPhEtravelDerivedQrReferenceConsistent,
  isPhEtravelSubmittedCandidate,
  createPhEtravelStoredResultRecoveryPresentation,
  PH_ETRAVEL_RESULT_CAPABILITY_EVIDENCE,
} from "./result-recovery";
export type {
  PhEtravelResultEvidence,
  PhEtravelResultRecoveryPresentation,
  PhEtravelResultState,
} from "./result-recovery";

export type PhEtravelTravelDirection = "arrival" | "departure";

export function isExplicitTrue(value: string | null | undefined): boolean {
  return value === "true";
}

export function isPhEtravelClientLiveSubmissionEnabled(
  env: EnvLike = process.env
): boolean {
  return isExplicitTrue(env.NEXT_PUBLIC_PH_ETRAVEL_LIVE_SUBMISSION_ENABLED);
}

export function isPhEtravelServerLiveSubmissionEnabled(
  env: EnvLike = process.env
): boolean {
  return (
    isExplicitTrue(env.PH_ETRAVEL_LIVE_SUBMISSION_ENABLED) &&
    isExplicitTrue(env.NEXT_PUBLIC_PH_ETRAVEL_LIVE_SUBMISSION_ENABLED)
  );
}

export function createPhEtravelScheduledPortalSummary(input: {
  travelDateLabel?: PhEtravelTravelDirection;
  earliestSubmissionDate: string;
  daysUntilOpen?: number | null;
}): string {
  const direction =
    input.travelDateLabel === "departure" ? "departure" : "arrival";
  const wait =
    typeof input.daysUntilOpen === "number" && input.daysUntilOpen > 0
      ? ` in ${input.daysUntilOpen} day${input.daysUntilOpen === 1 ? "" : "s"}`
      : "";
  return (
    `Philippines eTravel accepts official registration within 72 hours before ${direction}. ` +
    `This application is scheduled for ${input.earliestSubmissionDate}${wait}. ` +
    "Official eTravel registration is free, is not a visa, and does not guarantee admission at Philippine border control."
  );
}

export type PhEtravelUserState =
  | "scheduled"
  | "queued"
  | "processing"
  | "signature_required"
  | "family_gate"
  | "companion_confirmation"
  | "review_reached_not_submitted"
  | "sea_manual_customs_forms"
  | "sea_electronic_signature_required"
  | "action_required"
  | "failed"
  | "submitted_candidate"
  | "recovery_required";

export function createPhEtravelUserStatusMessage(
  state: PhEtravelUserState,
  isZh = false
): string {
  const messages: Record<PhEtravelUserState, { en: string; zh: string }> = {
    scheduled: {
      en: "Your eTravel form is saved. VIZA will only submit it on the official Philippines eTravel site inside the 72-hour window.",
      zh: "你的 eTravel 表单已保存。VIZA 只会在菲律宾官方 eTravel 72 小时窗口内提交。",
    },
    queued: {
      en: "Your Philippines eTravel submission is queued. Refreshing this page checks status only and does not create another official submission job.",
      zh: "你的菲律宾 eTravel 提交任务已排队。刷新本页只会查询状态，不会创建另一个官网提交任务。",
    },
    processing: {
      en: "VIZA is preparing the official Philippines eTravel flow. This is not a visa approval and does not guarantee border admission.",
      zh: "VIZA 正在处理菲律宾官方 eTravel 流程。这不是签证批准，也不保证边检准入。",
    },
    signature_required: {
      en: "The official eTravel site is stopped at a signature step for this path. This is not submitted yet. Signature is not shown on every verified SEA path.",
      zh: "官网 eTravel 当前停在此路径的签名步骤。本次尚未提交。已验证的 SEA 路径并非每次都会出现签名页。",
    },
    family_gate: {
      en: "The official eTravel flow is at the Family Member(s) step. Family members generate separate travel declarations, and this is not submitted yet.",
      zh: "官方 eTravel 流程停在 Family Member(s) 步骤。家庭成员会生成独立旅行申报，本次尚未提交。",
    },
    companion_confirmation: {
      en: "The official eTravel flow asks for confirmation that you are not travelling with a companion. This is not submitted yet.",
      zh: "官方 eTravel 正在确认你是否没有同行人。本次尚未提交。",
    },
    review_reached_not_submitted: {
      en: "The official eTravel Summary has been reached, but the final Submit button has not been used. This is not submitted yet.",
      zh: "已到官方 eTravel Summary，但尚未点击最终 Submit。本次还没有提交。",
    },
    sea_manual_customs_forms: {
      en: "This verified SEA path shows manual Baggage and Currency declaration forms before Review. It is action-required and not submitted until VIZA recovers an authoritative reference and can render a QR from it.",
      zh: "已验证的 SEA 路径在 Review 前显示手工 Baggage 和 Currency 申报表。本状态需要人工处理；只有从权威记录恢复参考号并可据此渲染 QR 后，才能进入结果复核。",
    },
    sea_electronic_signature_required: {
      en: "The official SEA electronic customs path is stopped at the signature page. This path is not submitted yet; after signature it still goes through Family Member(s), no-companion confirmation when applicable, and Summary before final Submit.",
      zh: "官方 SEA 电子海关路径停在签名页。本路径尚未提交；签名后仍会经过 Family Member(s)、适用时的无同行确认，以及 Summary，之后才是最终 Submit。",
    },
    action_required: {
      en: "The official eTravel flow needs review before it can be treated as submitted. VIZA will not show a submitted candidate until it recovers an authoritative reference and renders a consistent QR from it.",
      zh: "官方 eTravel 流程需要复核；只有从权威记录恢复参考号并据此渲染一致 QR 后，VIZA 才会显示提交候选状态。",
    },
    failed: {
      en: "This Philippines eTravel submission was not completed. Your saved answers remain available for review or retry.",
      zh: "本次菲律宾 eTravel 提交未完成。你保存的答案仍可用于检查或重试。",
    },
    submitted_candidate: {
      en: "VIZA recovered an authoritative eTravel reference and rendered a QR from it. This is a result candidate; QR scanability and official recovery behavior still need verification.",
      zh: "VIZA 已从权威 eTravel 记录恢复参考号并据此渲染 QR。这是结果候选；QR 可扫描性和官方恢复行为仍需核实。",
    },
    recovery_required: {
      en: "VIZA cannot confirm the official eTravel result yet. It will recover the authoritative registration state and will not send another official Submit.",
      zh: "VIZA 暂时无法确认官方 eTravel 结果。系统会恢复读取权威登记状态，不会再次发送官网 Submit。",
    },
  };
  const message = messages[state];
  return isZh ? message.zh : message.en;
}

const ERROR_MESSAGES: Record<string, { en: string; zh: string }> = {
  phetravel_missing_date: {
    en: "Philippines eTravel needs both the travel departure date and arrival date before VIZA can schedule official submission.",
    zh: "菲律宾 eTravel 需要行程出发日期和抵达日期，VIZA 才能安排官网提交。",
  },
  phetravel_invalid_date: {
    en: "Use YYYY-MM-DD travel dates for Philippines eTravel.",
    zh: "菲律宾 eTravel 旅行日期请使用 YYYY-MM-DD 格式。",
  },
  phetravel_departure_after_arrival: {
    en: "The flight departure date cannot be later than the flight arrival date.",
    zh: "航班起飞日期不能晚于抵达日期。",
  },
  phetravel_arrival_date_past: {
    en: "The Philippines eTravel arrival date is already in the past. Update the travel dates before submitting.",
    zh: "菲律宾 eTravel 抵达日期已过去。请先更新旅行日期再提交。",
  },
  live_disabled: {
    en: "Philippines eTravel live submission is currently disabled. You can still prepare and save the form.",
    zh: "菲律宾 eTravel 官网提交当前未启用。你仍可提前填写并保存表单。",
  },
  runner_contract_unavailable: {
    en: "Philippines eTravel live processing is not available yet. Your form remains saved and will not be submitted automatically.",
    zh: "菲律宾 eTravel 官网处理尚未可用。表单会继续保存，系统不会自动提交。",
  },
  application_incomplete: {
    en: "Complete the listed eTravel information and documents before VIZA can prepare the official flow.",
    zh: "请先完成列出的 eTravel 信息和材料，VIZA 才能准备官网流程。",
  },
  active_job_exists: {
    en: "An eTravel job is already active. Refreshing checks that job and will not create another official submission.",
    zh: "已有 eTravel 任务正在处理。刷新只会查询该任务，不会创建另一个官网提交。",
  },
};

export function phEtravelUserFacingError(input: {
  code?: string | null;
  message?: string | null;
  isZh?: boolean;
}): string {
  const normalizedCode = input.code?.trim().toLowerCase();
  const mapped = normalizedCode ? ERROR_MESSAGES[normalizedCode] : null;
  if (mapped) return input.isZh ? mapped.zh : mapped.en;

  return input.isZh
    ? "菲律宾 eTravel 提交流程未完成。你的资料已保存，请稍后重试或联系支持。"
    : "The Philippines eTravel submission was not completed. Your answers are saved; retry later or contact support.";
}

export const PH_ETRAVEL_REFRESH_POLICY = {
  statusPollingCreatesQueue: false,
  retryEndpointCreatesQueue: true,
} as const;
