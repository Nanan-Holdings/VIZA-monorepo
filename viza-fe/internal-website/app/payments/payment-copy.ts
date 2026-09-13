export type PaymentLocale = "en" | "zh";

export type PaymentMethodId = "card" | "wechatpay_qrcode" | "alipaycn_qrcode";

export type PaymentErrorKey =
  | "missingOrder"
  | "createOrderFailed"
  | "scriptLoadFailed"
  | "cardOtherFlow"
  | "agreementRequired"
  | "cardComponentError"
  | "cardComponentLoadFailed"
  | "cardPaymentFailed"
  | "walletConfirmationFailed";

export type PaymentCopy = {
  backToSubscription: string;
  brand: string;
  checkoutTitle: string;
  checkoutDescription: string;
  amountDue: string;
  preparing: string;
  monthlyPlan: string;
  serviceFee: string;
  monthlyAgreement: string;
  chooseMethod: string;
  methods: Record<PaymentMethodId, { label: string; description: string }>;
  applePayUnavailable: string;
  chooseMethodPrompt: string;
  cardPreparing: string;
  progressPreparing: string;
  authorizeAndPay: string;
  pay: string;
  alipayQrAlt: string;
  wechatQrAlt: string;
  alipayScanPrompt: string;
  wechatScanPrompt: string;
  qrStatusHint: string;
  demoPaymentWarning: string;
  viewPaymentStatus: string;
  walletOpening: string;
  progressProcessing: string;
  errors: Record<PaymentErrorKey, string>;
  resultBackToSubscription: string;
  resultPaidTitle: string;
  resultFailedTitle: string;
  resultPendingTitle: string;
  resultPaidDescription: string;
  resultExpiredDescription: string;
  resultFailedDescription: string;
  resultPendingDescription: string;
  resultProgressComplete: string;
  resultProgressStopped: string;
  resultProgressPending: string;
  resultProviderStatus: string;
  resultAttemptStatus: string;
  statusSeparator: string;
  manageSubscription: string;
  providerStatuses: Record<string, string>;
  attemptStatuses: Record<string, string>;
  unknownStatus: string;
};

export function toPaymentLocale(locale: string): PaymentLocale {
  return locale.toLowerCase().startsWith("zh") ? "zh" : "en";
}

export const paymentCopy: Record<PaymentLocale, PaymentCopy> = {
  en: {
    backToSubscription: "Back to subscription",
    brand: "VIZA online payment",
    checkoutTitle: "Choose a payment method",
    checkoutDescription:
      "This page collects the VIZA service fee. Card, WeChat Pay, and Alipay are confirmed in a secure payment environment.",
    amountDue: "Amount due",
    preparing: "Preparing",
    monthlyPlan: "Monthly plan",
    serviceFee: "VIZA service fee",
    monthlyAgreement:
      "I have read and agree to monthly auto-renewal. This plan will be charged each month and can be cancelled in subscription management; cancellation takes effect after the current billing period.",
    chooseMethod: "Choose a payment method",
    methods: {
      card: {
        label: "Bank card",
        description: "Pay securely through the hosted card component.",
      },
      wechatpay_qrcode: {
        label: "WeChat Pay",
        description: "Generate a QR code and scan it with WeChat.",
      },
      alipaycn_qrcode: {
        label: "Alipay",
        description: "Generate a QR code and scan it with Alipay.",
      },
    },
    applePayUnavailable: "Apple Pay is currently unavailable. Please choose another payment method.",
    chooseMethodPrompt: "Choose a payment method to continue.",
    cardPreparing: "Preparing the secure card component",
    progressPreparing: "Preparation progress",
    authorizeAndPay: "Enable auto-renewal and pay",
    pay: "Pay",
    alipayQrAlt: "Alipay QR code",
    wechatQrAlt: "WeChat Pay QR code",
    alipayScanPrompt: "Scan with Alipay to pay",
    wechatScanPrompt: "Scan with WeChat Pay to pay",
    qrStatusHint: "After scanning, return to this page or the result page to refresh the status.",
    demoPaymentWarning:
      "This payment environment is for demonstration. Scanning the QR code will not complete a real charge.",
    viewPaymentStatus: "View payment status",
    walletOpening: "Opening the secure payment page",
    progressProcessing: "Processing progress",
    errors: {
      missingOrder: "The payment order is missing. Please return to subscription and choose a plan again.",
      createOrderFailed: "We could not prepare this payment. Please return to subscription and try again.",
      scriptLoadFailed: "The secure payment component could not load. Please try again or choose another method.",
      cardOtherFlow: "This order is already using another payment flow. Please return to subscription and create a new order.",
      agreementRequired: "Please accept the monthly auto-renewal authorization before choosing a payment method.",
      cardComponentError: "The secure card component returned an error. Please try again or choose another method.",
      cardComponentLoadFailed: "The secure card component could not load. Please try again or choose another method.",
      cardPaymentFailed: "Card payment was not completed. Please check your card details and try again.",
      walletConfirmationFailed: "We could not start this payment method. Please try again or choose another method.",
    },
    resultBackToSubscription: "Back to subscription",
    resultPaidTitle: "Payment confirmed",
    resultFailedTitle: "Payment not completed",
    resultPendingTitle: "Confirming payment",
    resultPaidDescription:
      "VIZA has recorded this service payment. Your monthly plan will be reflected in subscription status.",
    resultExpiredDescription:
      "This QR payment was not completed before the code expired. Return to subscription to create a new order.",
    resultFailedDescription:
      "The online payment service could not confirm this payment. Return to subscription to choose another method.",
    resultPendingDescription: "If you just scanned or verified the payment, this page will refresh automatically.",
    resultProgressComplete: "Confirmation complete",
    resultProgressStopped: "Confirmation stopped",
    resultProgressPending: "Confirmation progress",
    resultProviderStatus: "Payment service status",
    resultAttemptStatus: "Payment attempt status",
    statusSeparator: ": ",
    manageSubscription: "Manage subscription",
    providerStatuses: {
      INITIAL: "Preparing payment",
      PENDING: "Processing",
      REQUIRES_PAYMENT_METHOD: "Waiting for payment method",
      REQUIRES_CUSTOMER_ACTION: "Action required",
      REQUIRES_CAPTURE: "Completing payment",
      SUCCEEDED: "Paid",
      FAILED: "Payment failed",
      CANCELLED: "Cancelled",
      EXPIRED: "Expired",
    },
    attemptStatuses: {
      INITIAL: "Preparing",
      INITIATED: "Started",
      PENDING: "Processing",
      REQUIRES_PAYMENT_METHOD: "Waiting for payment method",
      REQUIRES_CUSTOMER_ACTION: "Action required",
      SUCCEEDED: "Paid",
      CAPTURED: "Paid",
      FAILED: "Failed",
      CANCELLED: "Cancelled",
      EXPIRED: "Expired",
    },
    unknownStatus: "Status unavailable",
  },
  zh: {
    backToSubscription: "返回订阅页面",
    brand: "VIZA 在线支付",
    checkoutTitle: "选择付款方式",
    checkoutDescription: "本页仅收取 VIZA 服务费。银行卡、微信支付和支付宝会在安全支付环境中完成确认。",
    amountDue: "应付金额",
    preparing: "准备中",
    monthlyPlan: "月付方案",
    serviceFee: "VIZA 服务费",
    monthlyAgreement: "我已阅读并同意开通月付自动续费。当前方案将按月扣费，可在订阅管理中取消；取消后将在当前计费周期结束时生效。",
    chooseMethod: "选择支付方式",
    methods: {
      card: { label: "银行卡", description: "使用托管卡组件完成安全支付。" },
      wechatpay_qrcode: { label: "微信支付", description: "生成二维码后使用微信扫码支付。" },
      alipaycn_qrcode: { label: "支付宝", description: "生成二维码后使用支付宝扫码支付。" },
    },
    applePayUnavailable: "Apple Pay 当前暂不可用，请选择其他支付方式。",
    chooseMethodPrompt: "请选择一种支付方式继续。",
    cardPreparing: "正在准备银行卡安全组件",
    progressPreparing: "准备进度",
    authorizeAndPay: "开通并同意自动续费",
    pay: "支付",
    alipayQrAlt: "支付宝二维码",
    wechatQrAlt: "微信支付二维码",
    alipayScanPrompt: "请使用支付宝扫码支付",
    wechatScanPrompt: "请使用微信扫码支付",
    qrStatusHint: "扫码后返回本页或结果页刷新状态，VIZA 会查询最终结果。",
    demoPaymentWarning: "当前支付环境正在进行演示，扫码不会完成真实扣款。",
    viewPaymentStatus: "查看支付状态",
    walletOpening: "正在打开安全支付页面",
    progressProcessing: "处理进度",
    errors: {
      missingOrder: "缺少支付订单，请返回订阅页面重新选择方案。",
      createOrderFailed: "暂时无法准备这笔支付，请返回订阅页面重试。",
      scriptLoadFailed: "安全支付组件加载失败，请重试或选择其他支付方式。",
      cardOtherFlow: "当前订单已进入其他支付流程，请返回订阅页面重新生成订单。",
      agreementRequired: "请先勾选自动续费授权，再选择支付方式。",
      cardComponentError: "银行卡安全组件返回错误，请重试或选择其他支付方式。",
      cardComponentLoadFailed: "银行卡安全组件加载失败，请重试或选择其他支付方式。",
      cardPaymentFailed: "银行卡支付未完成，请检查卡信息后重试。",
      walletConfirmationFailed: "暂时无法启动该支付方式，请重试或选择其他支付方式。",
    },
    resultBackToSubscription: "返回订阅页面",
    resultPaidTitle: "支付已确认",
    resultFailedTitle: "支付未完成",
    resultPendingTitle: "正在确认支付",
    resultPaidDescription: "VIZA 已记录这笔服务费，月付方案会同步到你的订阅状态。",
    resultExpiredDescription: "这次扫码支付没有在二维码有效期内完成，你可以返回订阅页面重新生成订单。",
    resultFailedDescription: "在线支付服务未能确认本次支付，你可以返回订阅页面重新选择支付方式。",
    resultPendingDescription: "如果你刚完成扫码或验证，页面会自动刷新最终状态。",
    resultProgressComplete: "确认完成",
    resultProgressStopped: "确认已停止",
    resultProgressPending: "确认进度",
    resultProviderStatus: "支付服务状态",
    resultAttemptStatus: "支付尝试状态",
    statusSeparator: "：",
    manageSubscription: "管理订阅方案",
    providerStatuses: {
      INITIAL: "准备支付",
      PENDING: "处理中",
      REQUIRES_PAYMENT_METHOD: "等待选择支付方式",
      REQUIRES_CUSTOMER_ACTION: "需要完成验证",
      REQUIRES_CAPTURE: "正在完成支付",
      SUCCEEDED: "已支付",
      FAILED: "支付失败",
      CANCELLED: "已取消",
      EXPIRED: "已过期",
    },
    attemptStatuses: {
      INITIAL: "准备中",
      INITIATED: "已启动",
      PENDING: "处理中",
      REQUIRES_PAYMENT_METHOD: "等待选择支付方式",
      REQUIRES_CUSTOMER_ACTION: "需要完成验证",
      SUCCEEDED: "已支付",
      CAPTURED: "已支付",
      FAILED: "失败",
      CANCELLED: "已取消",
      EXPIRED: "已过期",
    },
    unknownStatus: "状态暂不可用",
  },
};

export function getPaymentCopy(locale: string): PaymentCopy {
  return paymentCopy[toPaymentLocale(locale)];
}

function normalizedStatus(value: string): string {
  return value.trim().toUpperCase();
}

export function getProviderStatusLabel(value: string, locale: string): string {
  const copy = getPaymentCopy(locale);
  return copy.providerStatuses[normalizedStatus(value)] ?? copy.unknownStatus;
}

export function getAttemptStatusLabel(value: string, locale: string): string {
  const copy = getPaymentCopy(locale);
  return copy.attemptStatuses[normalizedStatus(value)] ?? copy.unknownStatus;
}

export function formatPaymentCny(amountFen: number, locale: string): string {
  return new Intl.NumberFormat(toPaymentLocale(locale) === "zh" ? "zh-CN" : "en-US", {
    style: "currency",
    currency: "CNY",
    maximumFractionDigits: amountFen % 100 === 0 ? 0 : 2,
  }).format(amountFen / 100);
}
