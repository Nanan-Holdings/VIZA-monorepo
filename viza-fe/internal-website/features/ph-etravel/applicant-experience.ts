import {
  createPhEtravelResultRecoveryPresentation,
  createPhEtravelStoredResultRecoveryPresentation,
  readPhEtravelStoredResultEvidence,
  type PhEtravelResultEvidence,
} from "./result-recovery";
import {
  createPhEtravelUserStatusMessage,
  isPhEtravelClientLiveSubmissionEnabled,
  type PhEtravelUserState,
} from "./status";

type EnvLike = Record<string, string | undefined>;

export type PhEtravelApplicantLocale = "en" | "zh";

export type PhEtravelRuntimeState =
  | "scheduled"
  | "queued"
  | "processing"
  | "action_required"
  | "failed"
  | "recovery_required"
  | "submitted";

export type PhEtravelReturnTarget =
  | {
      kind: "field";
      stepId: string;
      fieldName: string;
    }
  | {
      kind: "documents";
      documentKey?: string;
    };

export type PhEtravelMissingItem = {
  id: string;
  label: string;
  target: PhEtravelReturnTarget;
};

export type PhEtravelOfficialReceipt = {
  available: boolean;
  label?: string;
};

export type PhEtravelApplicantAction = {
  id:
    | "request_official_processing"
    | "return_to_field"
    | "return_to_documents"
    | "refresh_status"
    | "reread_official_result";
  target?: PhEtravelReturnTarget;
  readOnly?: boolean;
};

export type PhEtravelFinalConfirmationPresentation = {
  title: string;
  boundaryCopy: string[];
  liveEnabled: boolean;
  canRequestOfficialProcessing: boolean;
  submitted: false;
  noQueueUntilRequested: true;
};

export type PhEtravelApplicantExperiencePresentation = {
  state: PhEtravelRuntimeState | "incomplete";
  title: string;
  message: string;
  finalConfirmation: PhEtravelFinalConfirmationPresentation;
  missingItems: PhEtravelMissingItem[];
  actions: PhEtravelApplicantAction[];
  submitted: boolean;
  noResubmit: boolean;
  result: {
    referenceNumber: string | null;
    qrVisible: boolean;
    qrMatchesReference: boolean;
    receipt: "available" | "not_available" | "unknown";
  };
};

export type PhEtravelStatusSnapshot = {
  status?: string | null;
  applicationStatus?: string | null;
  queueStatus?: string | null;
  result?: unknown;
};

function copy(locale: PhEtravelApplicantLocale, en: string, zh: string): string {
  return locale === "zh" ? zh : en;
}

function statusMessage(
  state: Exclude<PhEtravelRuntimeState, "submitted">,
  locale: PhEtravelApplicantLocale
): string {
  const statusByRuntimeState: Record<
    Exclude<PhEtravelRuntimeState, "submitted">,
    PhEtravelUserState
  > = {
    scheduled: "scheduled",
    queued: "queued",
    processing: "processing",
    action_required: "action_required",
    failed: "failed",
    recovery_required: "recovery_required",
  };
  return createPhEtravelUserStatusMessage(
    statusByRuntimeState[state],
    locale === "zh"
  );
}

function titleForState(
  state: PhEtravelApplicantExperiencePresentation["state"],
  locale: PhEtravelApplicantLocale
): string {
  const titles: Record<
    PhEtravelApplicantExperiencePresentation["state"],
    { en: string; zh: string }
  > = {
    incomplete: { en: "Complete your eTravel form", zh: "请完成 eTravel 表单" },
    scheduled: { en: "eTravel scheduled", zh: "eTravel 已安排" },
    queued: { en: "eTravel queued", zh: "eTravel 已排队" },
    processing: { en: "eTravel in progress", zh: "eTravel 正在处理" },
    action_required: { en: "eTravel needs attention", zh: "eTravel 需要处理" },
    failed: { en: "eTravel was not completed", zh: "eTravel 未完成" },
    recovery_required: { en: "Confirming the official result", zh: "正在确认官方结果" },
    submitted: { en: "eTravel result confirmed", zh: "eTravel 结果已确认" },
  };
  return locale === "zh" ? titles[state].zh : titles[state].en;
}

function createFinalConfirmation(
  locale: PhEtravelApplicantLocale,
  liveEnabled: boolean,
  hasMissingItems: boolean
): PhEtravelFinalConfirmationPresentation {
  return {
    title: copy(
      locale,
      "Before requesting official eTravel processing",
      "请求官方 eTravel 处理前"
    ),
    boundaryCopy: [
      copy(
        locale,
        "Official Philippines eTravel registration is free. VIZA does not collect an official eTravel fee.",
        "菲律宾官方 eTravel 登记免费，VIZA 不收取官方 eTravel 费用。"
      ),
      copy(
        locale,
        "eTravel is not a visa and does not replace visa eligibility.",
        "eTravel 不是签证，也不能替代签证资格。"
      ),
      copy(
        locale,
        "A submitted eTravel result does not guarantee admission at Philippine border control.",
        "已提交的 eTravel 结果不保证获准进入菲律宾边境。"
      ),
    ],
    liveEnabled,
    canRequestOfficialProcessing: liveEnabled && !hasMissingItems,
    submitted: false,
    noQueueUntilRequested: true,
  };
}

export function createPhEtravelApplicantExperience(input: {
  locale?: PhEtravelApplicantLocale;
  env?: EnvLike;
  runtimeState?: PhEtravelRuntimeState | null;
  missingItems?: readonly PhEtravelMissingItem[];
  resultEvidence?: PhEtravelResultEvidence | null;
  officialReceipt?: PhEtravelOfficialReceipt | null;
}): PhEtravelApplicantExperiencePresentation {
  const locale = input.locale ?? "en";
  const missingItems = [...(input.missingItems ?? [])];
  const liveEnabled = isPhEtravelClientLiveSubmissionEnabled(input.env);
  const finalConfirmation = createFinalConfirmation(
    locale,
    liveEnabled,
    missingItems.length > 0
  );
  const fieldActions = missingItems.map<PhEtravelApplicantAction>((item) => ({
    id: item.target.kind === "documents" ? "return_to_documents" : "return_to_field",
    target: item.target,
  }));

  if (missingItems.length > 0) {
    return {
      state: "incomplete",
      title: titleForState("incomplete", locale),
      message: copy(
        locale,
        "Complete the listed information or documents before requesting official processing.",
        "请先完成列出的信息或材料，再请求官方处理。"
      ),
      finalConfirmation,
      missingItems,
      actions: fieldActions,
      submitted: false,
      noResubmit: true,
      result: {
        referenceNumber: null,
        qrVisible: false,
        qrMatchesReference: false,
        receipt: "unknown",
      },
    };
  }

  const recovery = input.resultEvidence
    ? createPhEtravelResultRecoveryPresentation(input.resultEvidence)
    : null;

  if (recovery?.state === "submitted_candidate") {
    return {
      state: "submitted",
      title: titleForState("submitted", locale),
      message: copy(
        locale,
        "The official result has a stable reference and a QR rendered from that same reference.",
        "官方结果已有稳定参考号，并已显示由同一参考号生成的 QR。"
      ),
      finalConfirmation,
      missingItems: [],
      actions: [],
      submitted: true,
      noResubmit: true,
      result: {
        referenceNumber:
          input.resultEvidence?.authoritativeReferenceNumber?.trim() || null,
        qrVisible: true,
        qrMatchesReference: true,
        receipt: input.officialReceipt?.available
          ? "available"
          : input.officialReceipt
            ? "not_available"
            : "unknown",
      },
    };
  }

  const isAmbiguousResult =
    recovery?.state === "recovery_required" ||
    input.runtimeState === "submitted" ||
    input.runtimeState === "recovery_required";
  const state: Exclude<PhEtravelRuntimeState, "submitted"> = isAmbiguousResult
    ? "recovery_required"
    : input.runtimeState === "scheduled" ||
        input.runtimeState === "queued" ||
        input.runtimeState === "processing" ||
        input.runtimeState === "action_required" ||
        input.runtimeState === "failed"
      ? input.runtimeState
      : "action_required";
  const actions: PhEtravelApplicantAction[] =
    state === "recovery_required"
      ? [{ id: "reread_official_result", readOnly: true }]
      : state === "scheduled" || state === "queued" || state === "processing"
        ? [{ id: "refresh_status", readOnly: true }]
        : [];

  return {
    state,
    title: titleForState(state, locale),
    message: statusMessage(state, locale),
    finalConfirmation,
    missingItems: [],
    actions,
    submitted: false,
    noResubmit: true,
    result: {
      referenceNumber: null,
      qrVisible: false,
      qrMatchesReference: false,
      receipt: "unknown",
    },
  };
}

function normalizedStatus(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

export function resolvePhEtravelRuntimeState(
  input: PhEtravelStatusSnapshot,
): PhEtravelRuntimeState {
  const statuses = [
    normalizedStatus(input.status),
    normalizedStatus(input.applicationStatus),
    normalizedStatus(input.queueStatus),
  ];

  if (statuses.some((value) => /(?:failed|stalled|cancelled|blocked|portal_error)/.test(value))) {
    return "failed";
  }
  if (statuses.some((value) => value.includes("scheduled"))) return "scheduled";
  if (statuses.some((value) => /(?:queued|pending|waiting)/.test(value))) {
    return "queued";
  }
  if (statuses.some((value) => /(?:processing|running)/.test(value))) {
    return "processing";
  }

  if (input.result) {
    const recovery = createPhEtravelStoredResultRecoveryPresentation(input.result);
    if (recovery.state === "submitted_candidate") return "submitted";
    if (recovery.state === "recovery_required") return "recovery_required";
    return "action_required";
  }

  if (
    statuses.some((value) =>
      /(?:action_required|needs_user_action|stopped_at_|review)/.test(value),
    )
  ) {
    return "action_required";
  }
  if (statuses.some((value) => /(?:completed|submitted)/.test(value))) {
    return "recovery_required";
  }
  return "action_required";
}

export function createPhEtravelApplicantExperienceFromStatus(input: {
  locale?: PhEtravelApplicantLocale;
  env?: EnvLike;
  status: PhEtravelStatusSnapshot;
  officialReceipt?: PhEtravelOfficialReceipt | null;
}): PhEtravelApplicantExperiencePresentation {
  return createPhEtravelApplicantExperience({
    locale: input.locale,
    env: input.env,
    runtimeState: resolvePhEtravelRuntimeState(input.status),
    resultEvidence: input.status.result
      ? readPhEtravelStoredResultEvidence(input.status.result)
      : null,
    officialReceipt: input.officialReceipt,
  });
}
