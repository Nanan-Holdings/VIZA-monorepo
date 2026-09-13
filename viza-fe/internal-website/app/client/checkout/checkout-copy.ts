import type { CheckoutNextStep, CheckoutReturnState, GovernmentFeeDisclosure } from "./data";

type CheckoutLocale = "en" | "zh";
type CheckoutReturnMessage = Exclude<CheckoutReturnState, null>;

export type CheckoutCopy = {
  metadataTitle: string;
  metadataDescription: string;
  title: string;
  intro: string;
  emptyTitle: string;
  emptyDescription: string;
  chooseRoute: string;
  stripeNeedsConfiguration: string;
  stripeDisabledDescription: string;
  cancelledTitle: string;
  cancelledDescription: string;
  agencyFee: string;
  application: string;
  payment: string;
  notConfigured: string;
  notStarted: string;
  paid: string;
  notPaid: string;
  officialFeePayment: string;
  officialFeeIntro: string;
  noGovernmentCard: string;
  orderSummary: string;
  package: string;
  destination: string;
  visaType: string;
  vizaAgencyFee: string;
  officialFee: string;
  officialFeePaid: string;
  dueToday: string;
  unavailable: string;
  stripeOnly: string;
  agencyFeeRecorded: string;
  paymentOnFile: string;
  latestConfirmation: (date: string) => string;
  afterPayment: string;
  payAgencyFee: string;
  openingStripe: string;
  checkoutDisabled: string;
  stripeHosted: string;
  returnToNextStep: string;
  nextStepDescription: string;
  loadError: string;
};

const COPY: Record<CheckoutLocale, CheckoutCopy> = {
  en: {
    metadataTitle: "Checkout | VIZA",
    metadataDescription: "Pay the VIZA agency fee through Stripe Checkout.",
    title: "Checkout",
    intro:
      "Confirm the visa application selected on your Home page and pay VIZA's agency fee through Stripe Checkout. When the official fee is due, VIZA creates a secure virtual card and pays the government portal for you.",
    emptyTitle: "No active package ready for checkout",
    emptyDescription:
      "Select a destination or ask the VIZA team to assign a package before starting agency-fee payment.",
    chooseRoute: "Choose a visa route",
    stripeNeedsConfiguration: "Stripe Checkout needs configuration",
    stripeDisabledDescription:
      "The page is safe to review, but payment is disabled until Stripe environment variables are configured.",
    cancelledTitle: "Stripe Checkout was cancelled",
    cancelledDescription:
      "No VIZA agency fee was recorded. You can review the package and restart Stripe Checkout.",
    agencyFee: "Agency fee",
    application: "Application",
    payment: "Payment",
    notConfigured: "Not configured",
    notStarted: "Not started",
    paid: "Paid",
    notPaid: "Not paid",
    officialFeePayment: "Official fee payment",
    officialFeeIntro:
      "VIZA pays the official portal on your behalf with a secure virtual card created for this application.",
    noGovernmentCard:
      "You will never need to enter card details on the government portal. When the official fee is due, VIZA creates a limited virtual card for this application, pays the portal, and records the result.",
    orderSummary: "Order summary",
    package: "Package",
    destination: "Destination",
    visaType: "Visa type",
    vizaAgencyFee: "VIZA agency fee",
    officialFee: "Official fee",
    officialFeePaid: "Paid by VIZA with a virtual card",
    dueToday: "Due today",
    unavailable: "Unavailable",
    stripeOnly: "Paid through Stripe-hosted Checkout for VIZA's agency fee only.",
    agencyFeeRecorded: "Agency fee recorded",
    paymentOnFile: "Payment is on file.",
    latestConfirmation: (date) => `Latest confirmation: ${date}`,
    afterPayment: "After payment",
    payAgencyFee: "Pay agency fee with Stripe",
    openingStripe: "Opening Stripe Checkout",
    checkoutDisabled: "Checkout is disabled because this package does not have an agency fee configured.",
    stripeHosted: "You will enter card details only on Stripe's hosted checkout page.",
    returnToNextStep: "Continue",
    nextStepDescription: "Continue to the next step for this visa application.",
    loadError: "Checkout could not load. Please refresh and try again.",
  },
  zh: {
    metadataTitle: "付款 | VIZA",
    metadataDescription: "通过 Stripe Checkout 支付 VIZA 服务费。",
    title: "付款",
    intro:
      "确认首页选择的签证申请，并通过 Stripe Checkout 支付 VIZA 服务费。官方费用到期后，VIZA 会创建安全的虚拟卡并代你向政府平台付款。",
    emptyTitle: "暂时没有可付款的有效方案",
    emptyDescription: "开始支付服务费前，请选择目的地，或联系 VIZA 团队分配方案。",
    chooseRoute: "选择签证路线",
    stripeNeedsConfiguration: "Stripe Checkout 尚未完成配置",
    stripeDisabledDescription: "页面可以安全查看，但 Stripe 环境变量配置完成前无法付款。",
    cancelledTitle: "Stripe Checkout 已取消",
    cancelledDescription: "没有记录 VIZA 服务费，你可以检查方案后重新开始 Stripe Checkout。",
    agencyFee: "服务费",
    application: "申请",
    payment: "支付",
    notConfigured: "未配置",
    notStarted: "未开始",
    paid: "已支付",
    notPaid: "未支付",
    officialFeePayment: "官方费用支付",
    officialFeeIntro: "官方平台费用到期后，VIZA 会使用为此申请创建的安全虚拟卡代你付款。",
    noGovernmentCard:
      "你无需在政府平台填写银行卡信息。官方费用到期后，VIZA 会为此申请创建限额虚拟卡，代付官方平台并记录结果。",
    orderSummary: "订单摘要",
    package: "方案",
    destination: "目的地",
    visaType: "签证类型",
    vizaAgencyFee: "VIZA 服务费",
    officialFee: "官方费用",
    officialFeePaid: "由 VIZA 使用虚拟卡支付",
    dueToday: "今日应付",
    unavailable: "暂不可用",
    stripeOnly: "仅通过 Stripe 托管 Checkout 支付 VIZA 服务费。",
    agencyFeeRecorded: "服务费已记录",
    paymentOnFile: "支付记录已保存。",
    latestConfirmation: (date) => `最近确认：${date}`,
    afterPayment: "付款后",
    payAgencyFee: "使用 Stripe 支付服务费",
    openingStripe: "正在打开 Stripe Checkout",
    checkoutDisabled: "此方案尚未配置服务费，因此无法付款。",
    stripeHosted: "你只需在 Stripe 托管的 Checkout 页面填写银行卡信息。",
    returnToNextStep: "继续",
    nextStepDescription: "继续此签证申请的下一步。",
    loadError: "付款页面加载失败，请刷新后重试。",
  },
};

const RETURN_MESSAGES: Record<CheckoutLocale, Record<string, CheckoutReturnMessage>> = {
  en: {
    checkout_unavailable: {
      tone: "error",
      title: "Checkout is temporarily unavailable",
      description: "Stripe Checkout could not be opened. Please try again or contact support.",
    },
    missing_package: {
      tone: "error",
      title: "Choose a visa package first",
      description: "We need an active package before starting agency-fee payment.",
    },
    package_not_found: {
      tone: "error",
      title: "Package not found",
      description: "This package is not active on your account. Please choose another package.",
    },
    payment_record_failed: {
      tone: "error",
      title: "Payment record was not created",
      description: "VIZA did not start Stripe Checkout because the payment record could not be prepared.",
    },
    pricing_missing: {
      tone: "warning",
      title: "Agency fee is not configured",
      description: "This package needs a VIZA agency fee before Stripe Checkout can be started.",
    },
    stripe_unconfigured: {
      tone: "warning",
      title: "Stripe Checkout is not configured",
      description:
        "Production payment requires Stripe secrets and an app URL. No card details are collected here.",
    },
  },
  zh: {
    checkout_unavailable: {
      tone: "error",
      title: "付款暂时不可用",
      description: "Stripe Checkout 无法打开，请重试或联系客服。",
    },
    missing_package: {
      tone: "error",
      title: "请先选择签证方案",
      description: "开始支付服务费前需要有有效方案。",
    },
    package_not_found: {
      tone: "error",
      title: "未找到方案",
      description: "此方案在你的账户中未启用，请选择其他方案。",
    },
    payment_record_failed: {
      tone: "error",
      title: "支付记录创建失败",
      description: "支付记录准备失败，VIZA 没有启动 Stripe Checkout。",
    },
    pricing_missing: {
      tone: "warning",
      title: "尚未配置服务费",
      description: "开始 Stripe Checkout 前，需要为此方案配置 VIZA 服务费。",
    },
    stripe_unconfigured: {
      tone: "warning",
      title: "Stripe Checkout 尚未配置",
      description: "正式付款需要配置 Stripe 密钥和应用地址，此页面不会收集银行卡信息。",
    },
  },
};

const RETURN_FALLBACK: Record<CheckoutLocale, CheckoutReturnMessage> = {
  en: {
    tone: "error",
    title: "Checkout needs attention",
    description: "Something interrupted checkout. Please try again or contact support.",
  },
  zh: {
    tone: "error",
    title: "付款需要处理",
    description: "付款流程被中断，请重试或联系客服。",
  },
};

function normalizeLocale(locale: string): CheckoutLocale {
  return locale.toLowerCase().startsWith("zh") ? "zh" : "en";
}

export function getCheckoutCopy(locale: string): CheckoutCopy {
  return COPY[normalizeLocale(locale)];
}

export function getCheckoutReturnState(error: string | null, locale: string): CheckoutReturnState {
  if (!error) return null;
  const language = normalizeLocale(locale);
  return RETURN_MESSAGES[language][error] ?? RETURN_FALLBACK[language];
}

export function localizeCheckoutStatus(value: string | null | undefined, locale: string, fallback: string) {
  if (!value) return fallback;
  const zh = normalizeLocale(locale) === "zh";
  const key = value.trim().toLowerCase();
  const labels: Record<string, [string, string]> = {
    draft: ["Draft", "草稿"],
    pending: ["Pending", "处理中"],
    paid: ["Paid", "已支付"],
    failed: ["Failed", "失败"],
    cancelled: ["Cancelled", "已取消"],
    submitted: ["Submitted", "已提交"],
    in_progress: ["In progress", "处理中"],
  };
  return labels[key]?.[zh ? 1 : 0] ?? (zh ? "处理中" : value.replace(/_/g, " "));
}

export function localizeGovernmentFee(
  disclosure: GovernmentFeeDisclosure,
  locale: string,
): GovernmentFeeDisclosure {
  if (normalizeLocale(locale) !== "zh") return disclosure;

  const copy: Record<GovernmentFeeDisclosure["mode"], Pick<GovernmentFeeDisclosure, "label" | "description" | "detail">> = {
    included: {
      label: "官方费用支付",
      description: "VIZA 会管理此申请的官方费用支付。",
      detail: "官方费用到期后，VIZA 会为此申请创建限额虚拟卡并代付官方平台。",
    },
    estimated: {
      label: "预计官方费用",
      description: "此估算费用与今日的 VIZA 服务费 Checkout 分开管理。",
      detail: "官方金额可能变化，VIZA 会在创建专用虚拟卡并代付前进行确认。",
    },
    external: {
      label: "由 VIZA 管理的官方费用",
      description: "申请进入支付步骤后，VIZA 会代你向官方平台付款。",
      detail: "虚拟卡仅为此申请和官方费用创建，你无需在政府平台填写银行卡信息。",
    },
    separate: {
      label: "由 VIZA 管理的官方费用",
      description: "此费用与今日的 Stripe 服务费 Checkout 分开管理。",
      detail: "官方费用到期后，VIZA 会创建申请专用虚拟卡并代你向官方平台付款。",
    },
    unknown: {
      label: "待确认官方费用",
      description: "VIZA 会在代付此申请前确认官方金额。",
      detail: "VIZA 会确认金额，创建限额虚拟卡并代你向政府平台付款。",
    },
  };

  return { ...disclosure, ...copy[disclosure.mode] };
}

export function localizeCheckoutNextStep(nextStep: CheckoutNextStep, locale: string): CheckoutNextStep {
  if (normalizeLocale(locale) !== "zh") return nextStep;
  if (nextStep.href.includes("/consent")) {
    return { ...nextStep, label: "继续授权", description: "查看 VIZA 条款、隐私声明和此申请的服务授权。" };
  }
  if (nextStep.href.includes("/documents")) {
    return { ...nextStep, label: "继续准备材料", description: "上传并检查此签证方案所需的支持材料。" };
  }
  return { ...nextStep, label: "开始申请", description: "开始填写申请表，VIZA 会准备后续步骤。" };
}
