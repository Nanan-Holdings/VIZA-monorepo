import { isChineseLocale } from "@/lib/i18n/locale";

export type BillingCopy = {
  metadataTitle: string;
  dateNotRecorded: string;
  statuses: {
    paid: string;
    noPaidRecords: string;
    paymentFailed: string;
    pending: string;
    invoiceNotRequested: string;
    invoiceNotRequestedDescription: string;
    invoiceGenerated: string;
    invoiceGeneratedDescription: string;
    invoiceFollowUp: string;
    invoiceFollowUpDescription: string;
    invoiceRequested: string;
    invoiceRequestedDescription: string;
    refundedLabel: string;
    refunded: (amount: string, date: string) => string;
    refundApproved: string;
    refundApprovedDescription: string;
    refundRejected: string;
    refundRejectedDescription: string;
    refundRequested: string;
    refundRequestedDescription: string;
    refundReviewUnavailable: string;
    refundReviewUnavailableDescription: string;
    notNormallyEligible: string;
    notNormallyEligibleDescription: string;
    staffReviewRequired: string;
    staffReviewRequiredDescription: string;
    eligibleForStaffReview: string;
    eligibleForStaffReviewDescription: string;
    unknown: (status: string) => string;
    mode: (mode: string) => string;
  };
  government: {
    officialSource: string;
    notCollected: string;
    officialFeeConfirmed: string;
    separateFromAgency: string;
    shownAfterSelection: string;
  };
  paymentCard: {
    agencyFeeOnly: string;
    paidRecordCreated: (date: string) => string;
    downloadReceipt: string;
    receiptPending: string;
    caseStatus: string;
    invoice: string;
    requestedFor: string;
    requestedOn: string;
    billingNamePending: string;
    refundVisibility: string;
  };
  empty: {
    title: string;
    description: string;
    checkout: string;
  };
  errors: {
    unavailableTitle: string;
    loadRecords: string;
    temporaryUnavailable: string;
  };
  page: {
    eyebrow: string;
    title: string;
    description: string;
    governmentDescription: string;
    viewCaseStatus: string;
    checkout: string;
    paidAgencyFees: string;
    receiptLinksLabel: string;
    invoiceRequestsLabel: string;
    refundRecordsLabel: string;
    receiptLinks: (count: number) => string;
    invoiceRequests: (count: number) => string;
    refundRecords: (count: number) => string;
    agencyFeeAttention: string;
    agencyFeeAttentionDescription: string;
    payAgencyFee: string;
    paymentHistory: string;
    paymentHistoryDescription: string;
    viewProgress: string;
    governmentDisclosure: string;
    governmentDisclosureDescription: string;
  };
  actions: {
    requestInvoice: string;
    requestInvoiceTitle: string;
    requestInvoiceDescription: string;
    invoiceName: string;
    invoiceNamePlaceholder: string;
    billingEmail: string;
    billingEmailPlaceholder: string;
    taxIdentifier: string;
    taxIdentifierHint: string;
    taxIdentifierPlaceholder: string;
    notes: string;
    notesPlaceholder: string;
    cancel: string;
    submitRequest: string;
    submittingRequest: string;
  };
  actionErrors: {
    signIn: string;
    choosePayment: string;
    invoiceName: string;
    billingEmail: string;
    paymentNotFound: string;
    paymentNotPaid: string;
    submit: string;
    unavailable: string;
    alreadyGenerated: string;
    alreadyRequested: string;
    received: string;
  };
};

const ENGLISH_COPY: BillingCopy = {
  metadataTitle: "Billing | VIZA",
  dateNotRecorded: "Not recorded",
  statuses: {
    paid: "Paid",
    noPaidRecords: "No paid records",
    paymentFailed: "Payment failed",
    pending: "Pending",
    invoiceNotRequested: "Invoice not requested",
    invoiceNotRequestedDescription: "B2B invoices are generated after a request is reviewed.",
    invoiceGenerated: "Invoice generated",
    invoiceGeneratedDescription: "The VIZA team has generated an invoice for this agency-fee payment.",
    invoiceFollowUp: "Invoice request needs follow-up",
    invoiceFollowUpDescription: "The request could not be completed as submitted. Contact support for next steps.",
    invoiceRequested: "Invoice requested",
    invoiceRequestedDescription: "The VIZA team will generate the invoice after billing review.",
    refundedLabel: "Refunded",
    refunded: (amount, date) => `${amount} was marked refunded on ${date}.`,
    refundApproved: "Refund approved",
    refundApprovedDescription: "The refund has been approved. Provider settlement timing can still vary.",
    refundRejected: "Refund rejected",
    refundRejectedDescription: "The refund request was reviewed and not approved.",
    refundRequested: "Refund requested",
    refundRequestedDescription: "The VIZA team is reviewing this refund request.",
    refundReviewUnavailable: "Refund review unavailable",
    refundReviewUnavailableDescription: "Refund review starts after an agency-fee payment has settled.",
    notNormallyEligible: "Not normally eligible",
    notNormallyEligibleDescription: "The application has already reached official submission or result tracking.",
    staffReviewRequired: "Staff review required",
    staffReviewRequiredDescription: "Preparation has started, so support must review policy details before any refund decision.",
    eligibleForStaffReview: "Eligible for staff review",
    eligibleForStaffReviewDescription: "This payment can be reviewed before official submission work begins. Refunds are not automatic.",
    unknown: (status) => status.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase()),
    mode: (mode) => mode.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase()),
  },
  government: {
    officialSource: "Shown by official source",
    notCollected: "Managed by VIZA",
    officialFeeConfirmed: "Official fee is confirmed by the government portal.",
    separateFromAgency: "Official fee payment is managed separately with a VIZA virtual card.",
    shownAfterSelection: "Government fee information will appear after an application or visa package is selected.",
  },
  paymentCard: {
    agencyFeeOnly: "Agency fee only",
    paidRecordCreated: (date) => `Paid record created ${date}`,
    downloadReceipt: "Download receipt",
    receiptPending: "Receipt pending",
    caseStatus: "Case status",
    invoice: "Invoice",
    requestedFor: "Requested for",
    requestedOn: "Requested on",
    billingNamePending: "Billing name pending",
    refundVisibility: "Refund visibility",
  },
  empty: {
    title: "No agency-fee payments yet",
    description: "Paid VIZA agency-fee records, receipt links, invoice requests, and refund status will appear here. Official fees use separate VIZA-managed virtual-card records.",
    checkout: "Go to checkout",
  },
  errors: {
    unavailableTitle: "Billing data unavailable",
    loadRecords: "We could not load billing records right now. Please try again later.",
    temporaryUnavailable: "Billing records are temporarily unavailable.",
  },
  page: {
    eyebrow: "Billing",
    title: "Payments, receipts, invoices, and refund status",
    description: "Review VIZA agency-fee history, download hosted receipts, request B2B invoices, and see refund status. Official-fee payments are shown separately because VIZA pays them with application-scoped virtual cards.",
    governmentDescription: "These amounts stay separate from agency-fee receipts. When due, VIZA creates a limited virtual card and pays the official portal on your behalf.",
    viewCaseStatus: "View case status",
    checkout: "Checkout",
    paidAgencyFees: "Paid agency fees",
    receiptLinksLabel: "Receipt links",
    invoiceRequestsLabel: "Invoice requests",
    refundRecordsLabel: "Refund records",
    receiptLinks: (count) => `${count} available`,
    invoiceRequests: (count) => `${count} tracked`,
    refundRecords: (count) => `${count} tracked`,
    agencyFeeAttention: "Agency fee still needs attention",
    agencyFeeAttentionDescription: "These applications do not have a settled VIZA agency-fee record yet. Checkout covers the VIZA agency fee; VIZA manages the later official payment with a virtual card.",
    payAgencyFee: "Pay agency fee",
    paymentHistory: "Payment history",
    paymentHistoryDescription: "Agency-fee records are grouped by application or visa package.",
    viewProgress: "View progress",
    governmentDisclosure: "Government fee disclosure",
    governmentDisclosureDescription: "These amounts stay separate from agency-fee receipts. VIZA pays the official portal with an application-scoped virtual card when the fee is due.",
  },
  actions: {
    requestInvoice: "Request invoice",
    requestInvoiceTitle: "Request agency-fee invoice",
    requestInvoiceDescription: "Tell us the invoice details for this paid VIZA agency fee. Government portal fees are not included here.",
    invoiceName: "Invoice name",
    invoiceNamePlaceholder: "Legal name or company name",
    billingEmail: "Billing email",
    billingEmailPlaceholder: "billing@example.com",
    taxIdentifier: "Tax identifier",
    taxIdentifierHint: "Optional. Add a GST, VAT, UEN, or company tax reference if your organization needs one.",
    taxIdentifierPlaceholder: "Optional tax reference",
    notes: "Notes",
    notesPlaceholder: "Optional billing instructions",
    cancel: "Cancel",
    submitRequest: "Submit request",
    submittingRequest: "Submitting request",
  },
  actionErrors: {
    signIn: "Please sign in again before requesting an invoice.",
    choosePayment: "Choose a paid agency-fee record before requesting an invoice.",
    invoiceName: "Enter the legal name that should appear on the invoice.",
    billingEmail: "Enter a valid billing email address.",
    paymentNotFound: "We could not find a matching agency-fee payment for this account.",
    paymentNotPaid: "Invoices can be requested after the agency-fee payment is marked paid.",
    submit: "We could not submit the invoice request. Please try again later.",
    unavailable: "Invoice requests are temporarily unavailable.",
    alreadyGenerated: "An invoice has already been generated for this payment.",
    alreadyRequested: "Your invoice request is already with the VIZA team.",
    received: "Invoice request received. The VIZA team will generate it after review.",
  },
};

const CHINESE_COPY: BillingCopy = {
  metadataTitle: "账单 | VIZA",
  dateNotRecorded: "暂无记录",
  statuses: {
    paid: "已付款",
    noPaidRecords: "暂无已付款记录",
    paymentFailed: "付款失败",
    pending: "处理中",
    invoiceNotRequested: "尚未申请发票",
    invoiceNotRequestedDescription: "企业发票会在申请审核后开具。",
    invoiceGenerated: "发票已开具",
    invoiceGeneratedDescription: "VIZA 团队已为这笔服务费付款开具发票。",
    invoiceFollowUp: "发票申请需要跟进",
    invoiceFollowUpDescription: "这次申请未能按提交内容完成，请联系客服了解下一步。",
    invoiceRequested: "已申请发票",
    invoiceRequestedDescription: "VIZA 团队会在账单审核后开具发票。",
    refundedLabel: "已退款",
    refunded: (amount, date) => `${amount} 已于 ${date} 标记为退款。`,
    refundApproved: "退款已批准",
    refundApprovedDescription: "退款已获批准，实际到账时间仍取决于支付服务商。",
    refundRejected: "退款未获批准",
    refundRejectedDescription: "退款申请已审核，暂未获批准。",
    refundRequested: "已申请退款",
    refundRequestedDescription: "VIZA 团队正在审核这笔退款申请。",
    refundReviewUnavailable: "暂无法审核退款",
    refundReviewUnavailableDescription: "服务费付款完成后才会开始退款审核。",
    notNormallyEligible: "通常不符合退款条件",
    notNormallyEligibleDescription: "申请已经进入官方提交或结果跟踪阶段。",
    staffReviewRequired: "需要人工审核",
    staffReviewRequiredDescription: "资料准备已经开始，退款决定前需由客服根据政策审核。",
    eligibleForStaffReview: "可提交人工审核",
    eligibleForStaffReviewDescription: "可在官方提交前审核这笔付款；退款不会自动处理。",
    unknown: (status) => {
      const labels: Record<string, string> = {
        pending: "处理中",
        processing: "处理中",
        canceled: "已取消",
        cancelled: "已取消",
        refunded: "已退款",
        partially_refunded: "部分退款",
      };
      return labels[status] ?? "状态待确认";
    },
    mode: (mode) => (mode === "display_only" ? "仅供参考" : mode === "unknown" ? "待官方确认" : "方式待确认"),
  },
  government: {
    officialSource: "以官方来源为准",
    notCollected: "由 VIZA 代付",
    officialFeeConfirmed: "具体官方费用以政府门户显示为准。",
    separateFromAgency: "官方费用由 VIZA 使用申请专属虚拟卡另行支付。",
    shownAfterSelection: "选择申请或签证套餐后，这里会显示政府费用信息。",
  },
  paymentCard: {
    agencyFeeOnly: "仅含服务费",
    paidRecordCreated: (date) => `付款记录创建于 ${date}`,
    downloadReceipt: "下载收据",
    receiptPending: "收据待生成",
    caseStatus: "案件状态",
    invoice: "发票",
    requestedFor: "开票名称",
    requestedOn: "申请日期",
    billingNamePending: "开票名称待补充",
    refundVisibility: "退款状态",
  },
  empty: {
    title: "暂时没有服务费付款记录",
    description: "已付款的 VIZA 服务费、收据链接、发票申请和退款状态都会显示在这里。官方费用使用由 VIZA 管理的虚拟卡记录另行显示。",
    checkout: "前往结账",
  },
  errors: {
    unavailableTitle: "暂时无法获取账单数据",
    loadRecords: "暂时无法加载账单记录，请稍后再试。",
    temporaryUnavailable: "账单记录暂时不可用。",
  },
  page: {
    eyebrow: "账单",
    title: "付款、收据、发票与退款状态",
    description: "查看 VIZA 服务费付款记录、下载收据、申请企业发票并了解退款状态。官方费用由 VIZA 使用申请专属虚拟卡代付，因此会单独列出。",
    governmentDescription: "以下金额与服务费收据分开显示。费用到期时，VIZA 会创建限额虚拟卡并代表你向政府门户付款。",
    viewCaseStatus: "查看案件状态",
    checkout: "结账",
    paidAgencyFees: "已付服务费",
    receiptLinksLabel: "收据链接",
    invoiceRequestsLabel: "发票申请",
    refundRecordsLabel: "退款记录",
    receiptLinks: (count) => `${count} 个可用`,
    invoiceRequests: (count) => `${count} 条申请记录`,
    refundRecords: (count) => `${count} 条退款记录`,
    agencyFeeAttention: "仍需支付服务费",
    agencyFeeAttentionDescription: "这些申请还没有已结算的 VIZA 服务费记录。结账支付 VIZA 服务费；后续官方费用由 VIZA 使用虚拟卡代付。",
    payAgencyFee: "支付服务费",
    paymentHistory: "付款记录",
    paymentHistoryDescription: "服务费记录按申请或签证套餐归类。",
    viewProgress: "查看进度",
    governmentDisclosure: "政府费用说明",
    governmentDisclosureDescription: "以下金额与服务费收据分开显示。费用到期时，VIZA 会使用申请专属虚拟卡向政府门户付款。",
  },
  actions: {
    requestInvoice: "申请发票",
    requestInvoiceTitle: "申请服务费发票",
    requestInvoiceDescription: "请填写这笔 VIZA 服务费付款的开票信息。政府门户费用不包含在内。",
    invoiceName: "开票名称",
    invoiceNamePlaceholder: "法定姓名或公司名称",
    billingEmail: "账单邮箱",
    billingEmailPlaceholder: "billing@example.com",
    taxIdentifier: "税务识别号",
    taxIdentifierHint: "可选。如果公司需要，请填写 GST、VAT、UEN 或其他税务编号。",
    taxIdentifierPlaceholder: "可选税务编号",
    notes: "备注",
    notesPlaceholder: "可选的开票说明",
    cancel: "取消",
    submitRequest: "提交申请",
    submittingRequest: "正在提交…",
  },
  actionErrors: {
    signIn: "请重新登录后再申请发票。",
    choosePayment: "请先选择一笔已支付的服务费记录。",
    invoiceName: "请填写发票上的法定名称。",
    billingEmail: "请输入有效的账单邮箱。",
    paymentNotFound: "找不到与此账户匹配的服务费付款记录。",
    paymentNotPaid: "服务费付款标记为已支付后才能申请发票。",
    submit: "暂时无法提交发票申请，请稍后再试。",
    unavailable: "发票申请暂时不可用。",
    alreadyGenerated: "这笔付款已经开具过发票。",
    alreadyRequested: "你的发票申请已交由 VIZA 团队处理。",
    received: "已收到发票申请，VIZA 团队审核后会为你开具。",
  },
};

export function getBillingCopy(locale?: string | null): BillingCopy {
  return isChineseLocale(locale) ? CHINESE_COPY : ENGLISH_COPY;
}
