import type { InterfaceLocale } from "@/lib/i18n/locale";
import type {
  AdminApplicationModel,
  ConsentState,
  DocumentState,
  ExternalState,
  LifecycleState,
  PacketState,
  PaymentState,
  ResultState,
} from "./data";
import { shortenId } from "./data";

export interface AdminApplicationCopy {
  status: {
    lifecycle: Record<LifecycleState, string>;
    payment: Record<PaymentState, string>;
    consent: Record<ConsentState, string>;
    documents: Record<DocumentState, string>;
    packet: Record<PacketState, string>;
    external: Record<ExternalState, string>;
    result: Record<ResultState, string>;
  };
  common: {
    all: string;
    unnamedApplicant: string;
    noEmail: string;
    noDestination: string;
    noApplication: string;
    noPackage: string;
    noPackageLinked: string;
    noPackageAssigned: string;
    noExpiry: string;
    noBlockingItems: string;
    noBlockingItemsLong: string;
    notProvided: string;
    notRecorded: string;
    notSet: string;
    masked: string;
    applicationSingular: string;
    applicationPlural: string;
    active: string;
    total: string;
    expires: string;
    latest: string;
    updated: string;
    progress: string;
    complete: string;
    bestApplication: string;
    viewOverview: string;
    backToUsers: string;
    backToCards: string;
    supportItems: string;
  };
  list: {
    title: string;
    subtitle: string;
    badge: string;
    metrics: {
      users: string;
      applications: string;
      needSupport: string;
      avgProgress: string;
    };
    filtersTitle: string;
    search: string;
    searchPlaceholder: string;
    lifecycle: string;
    payment: string;
    consent: string;
    missingDocuments: string;
    packet: string;
    externalStatus: string;
    result: string;
    apply: string;
    reset: string;
    cardsTitle: string;
    showingUsers: (shown: number, total: number) => string;
    noUsersTitle: string;
    noUsersBody: string;
    noMatchesTitle: string;
    noMatchesBody: string;
    package: string;
    applications: string;
    supportNotes: string;
    needsSupport: (count: number) => string;
  };
  detail: {
    queued: string;
    actionError: string;
    userOverview: string;
    userOverviewDescription: string;
    packages: string;
    packagesDescription: string;
    noPackagesTitle: string;
    noPackagesBody: string;
    supportItemsDescription: string;
    assigned: string;
    price: string;
    applications: string;
    applicationsDescription: string;
    recentEvents: string;
    recentEventsDescription: string;
    noEventsTitle: string;
    noEventsBody: string;
    userNotFoundTitle: string;
    userNotFoundBody: string;
    metrics: {
      applications: string;
      packages: string;
      earliestExpiry: string;
      latestUpdate: string;
      overallProgress: string;
    };
    profile: {
      name: string;
      email: string;
      phone: string;
      nationality: string;
      passport: string;
      passportExpiry: string;
      language: string;
      created: string;
    };
    applicationCard: {
      package: string;
      paymentConsent: string;
      documentsPacket: string;
      externalResult: string;
    };
    diagnostics: {
      title: string;
      runnerTimeline: string;
      noRunnerJobs: string;
      attempts: string;
      app: string;
      paymentOrders: string;
      noRecords: string;
      inboundEmail: string;
      noAlias: string;
      noMail: string;
      noSubject: string;
      from: string;
      processed: string;
      alias: string;
    };
  };
  actions: {
    queueing: string;
    queueEmail: string;
    copied: string;
    copySummary: string;
    draftEmail: string;
    emailSubject: string;
  };
  errors: {
    applicationLoadTitle: string;
  };
}

export const ADMIN_APPLICATION_COPY: Record<InterfaceLocale, AdminApplicationCopy> = {
  en: {
    status: {
      lifecycle: {
        intake: "Intake",
        payment_pending: "Payment pending",
        consent_pending: "Consent pending",
        document_collection: "Document collection",
        packet_generation: "Packet generation",
        ready_for_external_handoff: "Ready for external handoff",
        external_submission: "External submission",
        result_delivery: "Result delivery",
        completed: "Completed",
        attention: "Needs attention",
      },
      payment: {
        missing: "Missing",
        pending: "Pending",
        paid: "Paid",
        failed: "Failed",
        refunded: "Refunded",
      },
      consent: {
        missing: "Missing consent",
        missing_signature: "Missing signature",
        complete: "Complete",
        declined: "Declined",
      },
      documents: {
        not_started: "Not started",
        missing: "Missing items",
        complete: "Complete",
        rejected: "Rejected",
      },
      packet: {
        not_started: "Not started",
        generating: "Generating",
        ready: "Ready",
        failed: "Failed",
      },
      external: {
        not_handed_off: "Not handed off",
        ready_for_handoff: "Ready for handoff",
        in_progress: "In progress",
        submitted: "Submitted",
        approved: "Approved",
        rejected: "Rejected",
        attention: "Needs attention",
      },
      result: {
        none: "No result yet",
        pending: "Pending",
        received: "Received",
        delivered: "Delivered",
        approved: "Approved",
        rejected: "Rejected",
      },
    },
    common: {
      all: "All",
      unnamedApplicant: "Unnamed applicant",
      noEmail: "No email recorded",
      noDestination: "No destination",
      noApplication: "No application",
      noPackage: "No package",
      noPackageLinked: "No package linked",
      noPackageAssigned: "No package assigned",
      noExpiry: "No expiry set",
      noBlockingItems: "No blocking support items",
      noBlockingItemsLong: "No blocking support items detected across this user's applications.",
      notProvided: "Not provided",
      notRecorded: "Not recorded",
      notSet: "Not set",
      masked: "Masked",
      applicationSingular: "application",
      applicationPlural: "applications",
      active: "active",
      total: "total",
      expires: "Expires",
      latest: "Latest",
      updated: "Updated",
      progress: "Progress",
      complete: "complete",
      bestApplication: "Best app",
      viewOverview: "View overview",
      backToUsers: "Back to users",
      backToCards: "Back to user cards",
      supportItems: "Support items",
    },
    list: {
      title: "Application Monitoring",
      subtitle:
        "One card per user with package, expiry, application count, progress, and support status.",
      badge: "Monitor and support only",
      metrics: {
        users: "Users",
        applications: "Applications",
        needSupport: "Need support",
        avgProgress: "Avg progress",
      },
      filtersTitle: "User filters",
      search: "Search applicant",
      searchPlaceholder: "Search by ID, name, or email...",
      lifecycle: "Lifecycle",
      payment: "Payment",
      consent: "Consent",
      missingDocuments: "Missing documents",
      packet: "Packet",
      externalStatus: "External status",
      result: "Result",
      apply: "Apply",
      reset: "Reset",
      cardsTitle: "User overview cards",
      showingUsers: (shown, total) => `Showing ${shown} of ${total} users`,
      noUsersTitle: "No users with applications",
      noUsersBody: "Users will appear here once an applicant starts a visa workflow.",
      noMatchesTitle: "No matching users",
      noMatchesBody: "Adjust the filters or search term to see more user overview cards.",
      package: "Package",
      applications: "Applications",
      supportNotes: "Support notes",
      needsSupport: (count) => `${count} needs support`,
    },
    detail: {
      queued: "Status notification queued and logged to the application timeline.",
      actionError:
        "The support action could not be completed. Try again after checking the user overview.",
      userOverview: "User overview",
      userOverviewDescription:
        "Support contact and identity summary. Sensitive document numbers are masked.",
      packages: "Packages",
      packagesDescription: "Assigned packages and expiry visibility for this user.",
      noPackagesTitle: "No packages",
      noPackagesBody: "No package assignment is linked to this user yet.",
      supportItemsDescription: "Aggregated blockers across all applications for this user.",
      assigned: "Assigned",
      price: "Price",
      applications: "Applications",
      applicationsDescription: "All visa applications linked to this user.",
      recentEvents: "Recent events",
      recentEventsDescription: "Latest lifecycle and support events across this user's applications.",
      noEventsTitle: "No events yet",
      noEventsBody: "Lifecycle events will appear here as automation and support actions run.",
      userNotFoundTitle: "User not found",
      userNotFoundBody: "This applicant does not exist or has no application records.",
      metrics: {
        applications: "Applications",
        packages: "Packages",
        earliestExpiry: "Earliest expiry",
        latestUpdate: "Latest update",
        overallProgress: "Overall progress",
      },
      profile: {
        name: "Name",
        email: "Email",
        phone: "Phone",
        nationality: "Nationality",
        passport: "Passport",
        passportExpiry: "Passport expiry",
        language: "Language",
        created: "Profile created",
      },
      applicationCard: {
        package: "Package",
        paymentConsent: "Payment / Consent",
        documentsPacket: "Documents / Packet",
        externalResult: "External / Result",
      },
      diagnostics: {
        title: "System Diagnostics & Logs",
        runnerTimeline: "Runner pipeline timeline",
        noRunnerJobs: "No runner jobs yet.",
        attempts: "attempts",
        app: "app",
        paymentOrders: "Payment orders & transactions",
        noRecords: "No records found.",
        inboundEmail: "Inbound email communications",
        noAlias: "no email alias allocated",
        noMail: "No external mail recorded for this user alias.",
        noSubject: "(no subject)",
        from: "from",
        processed: "processed",
        alias: "alias",
      },
    },
    actions: {
      queueing: "Queueing...",
      queueEmail: "Queue status email",
      copied: "Copied",
      copySummary: "Copy status summary",
      draftEmail: "Draft support email",
      emailSubject: "VIZA application status update",
    },
    errors: {
      applicationLoadTitle: "Unable to load application monitoring",
    },
  },
  zh: {
    status: {
      lifecycle: {
        intake: "资料填写",
        payment_pending: "等待付款",
        consent_pending: "等待授权",
        document_collection: "材料收集中",
        packet_generation: "材料包生成中",
        ready_for_external_handoff: "可外部交接",
        external_submission: "外部处理中",
        result_delivery: "结果交付",
        completed: "已完成",
        attention: "需要关注",
      },
      payment: {
        missing: "缺少付款",
        pending: "付款待处理",
        paid: "已付款",
        failed: "付款失败",
        refunded: "已退款",
      },
      consent: {
        missing: "缺少授权",
        missing_signature: "缺少签名",
        complete: "已完成",
        declined: "已拒绝",
      },
      documents: {
        not_started: "未开始",
        missing: "缺少材料",
        complete: "已完成",
        rejected: "已拒绝",
      },
      packet: {
        not_started: "未开始",
        generating: "生成中",
        ready: "已就绪",
        failed: "生成失败",
      },
      external: {
        not_handed_off: "未交接",
        ready_for_handoff: "可交接",
        in_progress: "处理中",
        submitted: "已提交",
        approved: "已批准",
        rejected: "已拒绝",
        attention: "需要关注",
      },
      result: {
        none: "暂无结果",
        pending: "结果待处理",
        received: "已收到",
        delivered: "已交付",
        approved: "已批准",
        rejected: "已拒绝",
      },
    },
    common: {
      all: "全部",
      unnamedApplicant: "未命名申请人",
      noEmail: "未记录邮箱",
      noDestination: "暂无目的地",
      noApplication: "暂无申请",
      noPackage: "暂无套餐",
      noPackageLinked: "未关联套餐",
      noPackageAssigned: "未分配套餐",
      noExpiry: "未设置到期时间",
      noBlockingItems: "暂无阻塞项",
      noBlockingItemsLong: "该用户的所有申请暂无阻塞性客服事项。",
      notProvided: "未提供",
      notRecorded: "未记录",
      notSet: "未设置",
      masked: "已脱敏",
      applicationSingular: "个申请",
      applicationPlural: "个申请",
      active: "启用",
      total: "总计",
      expires: "到期",
      latest: "最近",
      updated: "更新于",
      progress: "进度",
      complete: "完成",
      bestApplication: "最高进度申请",
      viewOverview: "查看概览",
      backToUsers: "返回用户",
      backToCards: "返回用户卡片",
      supportItems: "客服事项",
    },
    list: {
      title: "申请监控",
      subtitle: "每个用户一张卡片，展示套餐、到期时间、申请数量、进度和客服状态。",
      badge: "仅监控和支持",
      metrics: {
        users: "用户",
        applications: "申请",
        needSupport: "需要支持",
        avgProgress: "平均进度",
      },
      filtersTitle: "用户筛选",
      search: "搜索申请人",
      searchPlaceholder: "按 ID、姓名或邮箱搜索...",
      lifecycle: "生命周期",
      payment: "付款",
      consent: "授权",
      missingDocuments: "缺少材料",
      packet: "材料包",
      externalStatus: "外部状态",
      result: "结果",
      apply: "应用",
      reset: "重置",
      cardsTitle: "用户概览卡片",
      showingUsers: (shown, total) => `显示 ${shown} / ${total} 个用户`,
      noUsersTitle: "暂无有申请的用户",
      noUsersBody: "申请人开始签证流程后，会出现在这里。",
      noMatchesTitle: "没有匹配的用户",
      noMatchesBody: "调整筛选条件或搜索词以查看更多用户卡片。",
      package: "套餐",
      applications: "申请",
      supportNotes: "客服备注",
      needsSupport: (count) => `${count} 项需支持`,
    },
    detail: {
      queued: "状态通知已排队，并已记录到申请时间线。",
      actionError: "客服操作未完成。请检查用户概览后重试。",
      userOverview: "用户概览",
      userOverviewDescription: "客服联系方式和身份摘要。敏感证件号码已脱敏。",
      packages: "套餐",
      packagesDescription: "展示该用户已分配套餐和到期时间。",
      noPackagesTitle: "暂无套餐",
      noPackagesBody: "该用户尚未关联任何套餐分配。",
      supportItemsDescription: "汇总该用户所有申请中的阻塞性事项。",
      assigned: "分配时间",
      price: "价格",
      applications: "申请",
      applicationsDescription: "该用户关联的所有签证申请。",
      recentEvents: "最近事件",
      recentEventsDescription: "该用户所有申请中的最新生命周期和客服事件。",
      noEventsTitle: "暂无事件",
      noEventsBody: "自动化或客服操作运行后，生命周期事件会显示在这里。",
      userNotFoundTitle: "未找到用户",
      userNotFoundBody: "该申请人不存在，或没有任何申请记录。",
      metrics: {
        applications: "申请",
        packages: "套餐",
        earliestExpiry: "最早到期",
        latestUpdate: "最近更新",
        overallProgress: "整体进度",
      },
      profile: {
        name: "姓名",
        email: "邮箱",
        phone: "电话",
        nationality: "国籍",
        passport: "护照",
        passportExpiry: "护照到期日",
        language: "语言",
        created: "档案创建时间",
      },
      applicationCard: {
        package: "套餐",
        paymentConsent: "付款 / 授权",
        documentsPacket: "材料 / 材料包",
        externalResult: "外部状态 / 结果",
      },
      diagnostics: {
        title: "系统诊断与日志",
        runnerTimeline: "Runner 流水线时间线",
        noRunnerJobs: "暂无 runner 任务。",
        attempts: "尝试次数",
        app: "申请",
        paymentOrders: "付款订单与交易",
        noRecords: "暂无记录。",
        inboundEmail: "入站邮件通信",
        noAlias: "未分配邮箱别名",
        noMail: "该用户别名暂无外部邮件记录。",
        noSubject: "（无主题）",
        from: "来自",
        processed: "已处理",
        alias: "别名",
      },
    },
    actions: {
      queueing: "排队中...",
      queueEmail: "发送状态邮件",
      copied: "已复制",
      copySummary: "复制状态摘要",
      draftEmail: "起草客服邮件",
      emailSubject: "VIZA 申请状态更新",
    },
    errors: {
      applicationLoadTitle: "无法加载申请监控",
    },
  },
};

export function localizeMissingItem(item: string, copy: AdminApplicationCopy): string {
  if (copy === ADMIN_APPLICATION_COPY.en) return item;

  const documentNeeded = item.match(/^Document needed: (.+)$/);
  if (documentNeeded) return `需要补充材料：${documentNeeded[1]}`;

  const moreDocuments = item.match(/^(\d+) more document items$/);
  if (moreDocuments) return `还有 ${moreDocuments[1]} 项材料`;

  const translations: Record<string, string> = {
    "Application answers not started": "申请表尚未开始填写",
    "Agency fee payment missing": "缺少 VIZA 服务费付款",
    "Agency fee payment pending": "VIZA 服务费付款待处理",
    "Payment needs customer support": "付款需要客服跟进",
    "Consent not accepted": "授权尚未接受",
    "Signature not captured": "签名尚未采集",
    "Consent was declined": "授权已被拒绝",
    "Packet generation failed": "材料包生成失败",
    "Packet not generated yet": "材料包尚未生成",
    "External status needs follow-up": "外部状态需要跟进",
  };

  return translations[item] ?? item;
}

export function formatAdminDateTime(
  value: string | null | undefined,
  locale: InterfaceLocale,
  fallback: string,
): string {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;

  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-SG", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Singapore",
  }).format(date);
}

export function maskPassportForLocale(
  passportNumber: string | null,
  copy: AdminApplicationCopy,
): string {
  if (!passportNumber) return copy.common.notProvided;
  const visible = passportNumber.slice(-4);
  return visible ? `**** ${visible}` : copy.common.masked;
}

export function buildLocalizedStatusSummary(
  application: AdminApplicationModel,
  copy: AdminApplicationCopy,
): string {
  const applicantName = application.profile?.full_name || copy.common.unnamedApplicant;
  const missingItems =
    application.missingItems.length > 0
      ? application.missingItems.map((item) => localizeMissingItem(item, copy)).join("; ")
      : copy.common.noBlockingItems;

  return [
    `Application ${shortenId(application.id)} for ${applicantName}`,
    `${application.countryLabel} - ${application.visaTypeLabel}`,
    `Lifecycle: ${copy.status.lifecycle[application.lifecycleState]}`,
    `Payment: ${copy.status.payment[application.payment.state]}`,
    `Consent: ${copy.status.consent[application.consent.state]}`,
    `Documents: ${copy.status.documents[application.documents.state]}`,
    `Packet: ${copy.status.packet[application.packet.state]}`,
    `External: ${copy.status.external[application.external.state]}`,
    `Result: ${copy.status.result[application.result.state]}`,
    `Missing/support items: ${missingItems}`,
  ].join("\n");
}
