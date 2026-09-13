import type { SubscriptionReturnState } from "./data";

type SubscriptionPageLocale = "en" | "zh";

type SubscriptionPageCopy = {
  onlinePay: string;
  manageTitle: string;
  manageDescription: string;
};

type ReturnMessage = Exclude<SubscriptionReturnState, null>;

const COPY: Record<SubscriptionPageLocale, SubscriptionPageCopy> = {
  en: {
    onlinePay: "Pay online",
    manageTitle: "Manage subscription",
    manageDescription: "Review your monthly plan, renewal date, or cancellation status.",
  },
  zh: {
    onlinePay: "在线支付",
    manageTitle: "管理订阅方案",
    manageDescription: "查看当前月付方案、续费日期或取消状态。",
  },
};

const ERROR_MESSAGES: Record<SubscriptionPageLocale, Record<string, ReturnMessage>> = {
  en: {
    invalid_product: {
      tone: "error",
      title: "We couldn't identify that plan",
      description: "Choose one of the monthly or pay-per-application plans shown on this page before starting payment.",
    },
    payment_record_failed: {
      tone: "error",
      title: "We couldn't create the payment record",
      description: "VIZA could not prepare the order. Please try again later or contact support.",
    },
    stripe_unconfigured: {
      tone: "warning",
      title: "Card payment is temporarily unavailable",
      description: "Choose another payment method or contact support.",
    },
    wechat_unconfigured: {
      tone: "warning",
      title: "WeChat Pay is temporarily unavailable",
      description: "Choose another payment method or contact support.",
    },
    alipay_unconfigured: {
      tone: "warning",
      title: "Alipay is temporarily unavailable",
      description: "Choose another payment method or contact support.",
    },
    airwallex_unconfigured: {
      tone: "warning",
      title: "Online payment is temporarily unavailable",
      description: "Choose another payment method or contact support.",
    },
    app_url_missing: {
      tone: "error",
      title: "Online payment is temporarily unavailable",
      description: "Choose another payment method or contact support.",
    },
  },
  zh: {
    invalid_product: {
      tone: "error",
      title: "无法识别该方案",
      description: "请选择页面上展示的月付或次付方案后再发起支付。",
    },
    payment_record_failed: {
      tone: "error",
      title: "支付记录创建失败",
      description: "VIZA 未能准备订单，请稍后重试或联系客服。",
    },
    stripe_unconfigured: {
      tone: "warning",
      title: "银行卡支付暂时不可用",
      description: "请选择其他支付方式或联系客服。",
    },
    wechat_unconfigured: {
      tone: "warning",
      title: "微信支付暂时不可用",
      description: "请选择其他支付方式或联系客服。",
    },
    alipay_unconfigured: {
      tone: "warning",
      title: "支付宝暂时不可用",
      description: "请选择其他支付方式或联系客服。",
    },
    airwallex_unconfigured: {
      tone: "warning",
      title: "在线支付暂时不可用",
      description: "请选择其他支付方式或联系客服。",
    },
    app_url_missing: {
      tone: "error",
      title: "在线支付暂时不可用",
      description: "请选择其他支付方式或联系客服。",
    },
  },
};

const FALLBACK_MESSAGES: Record<SubscriptionPageLocale, ReturnMessage> = {
  en: {
    tone: "error",
    title: "Payment is temporarily unavailable",
    description: "The payment page could not be opened. Please try again later.",
  },
  zh: {
    tone: "error",
    title: "支付暂时不可用",
    description: "支付页面未能打开，请稍后重试。",
  },
};

function normalizeLocale(locale: string): SubscriptionPageLocale {
  return locale.toLowerCase().startsWith("zh") ? "zh" : "en";
}

export function getSubscriptionPageCopy(locale: string): SubscriptionPageCopy {
  return COPY[normalizeLocale(locale)];
}

export function getErrorReturnState(error: string | null, locale: string): SubscriptionReturnState {
  if (!error) return null;
  const language = normalizeLocale(locale);
  return ERROR_MESSAGES[language][error] ?? FALLBACK_MESSAGES[language];
}

export function getCancelledReturnState(locale: string): Exclude<SubscriptionReturnState, null> {
  return normalizeLocale(locale) === "zh"
    ? {
        tone: "warning",
        title: "支付已取消",
        description: "当前方案没有扣费，你可以重新选择在线支付。",
      }
    : {
        tone: "warning",
        title: "Payment cancelled",
        description: "You were not charged. You can choose online payment again when you are ready.",
      };
}

export function getAlipayReturnState(locale: string): Exclude<SubscriptionReturnState, null> {
  return normalizeLocale(locale) === "zh"
    ? {
        tone: "warning",
        title: "支付宝已返回",
        description: "最终支付状态以支付宝异步通知为准。如已付款，请稍后刷新页面。",
      }
    : {
        tone: "warning",
        title: "Returned from Alipay",
        description: "The final payment status will follow Alipay's asynchronous notification. If you paid, refresh the page later.",
      };
}
