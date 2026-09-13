import type { HelpArticleSection } from "@/components/client/help-article";

export type StaticHelpArticleId =
  | "addPaymentMethod"
  | "completeProfile"
  | "exploreServices"
  | "accountSecurityTips"
  | "dataUsage"
  | "twoFactorSupport";

export interface StaticHelpArticleCopy {
  title: string;
  subtitle: string;
  sections: HelpArticleSection[];
}

const EN: Record<StaticHelpArticleId, StaticHelpArticleCopy> = {
  addPaymentMethod: {
    title: "Add a payment method",
    subtitle: "Learn how billing and payment work on the platform.",
    sections: [
      {
        heading: "How billing works",
        content: [
          {
            type: "paragraph",
            text: "VIZA uses secure checkout for eligible application, subscription, and agency-fee payments. Available payment methods are shown before you confirm a purchase.",
          },
        ],
      },
      {
        heading: "Setting up your payment method",
        content: [
          {
            type: "list",
            items: [
              "Open the application or subscription checkout you want to pay.",
              "Review the amount, currency, and payment description.",
              "Choose one of the payment methods offered at checkout and complete the provider's secure flow.",
            ],
          },
          {
            type: "tip",
            text: "VIZA does not ask you to send full card details through chat or email. Contact Support if a checkout does not show the payment method you expect.",
          },
        ],
      },
      {
        heading: "Using points",
        content: [
          {
            type: "paragraph",
            text: "Eligible VIZA Points and their redemption options are shown in Points Center. Availability and limits can vary by plan, promotion, and purchase type.",
          },
        ],
      },
      {
        heading: "Viewing past transactions",
        content: [
          {
            type: "paragraph",
            text: "Open Billing to view payment history, receipts, invoice requests, and refund status.",
          },
        ],
      },
    ],
  },
  completeProfile: {
    title: "Complete your profile",
    subtitle: "Keep reusable applicant information accurate across your visa applications.",
    sections: [
      {
        heading: "Why your profile matters",
        content: [
          {
            type: "paragraph",
            text: "Your Universal Information profile stores applicant details that can be reused across visa applications. Keeping it accurate reduces duplicate entry and helps prevent inconsistencies in official forms.",
          },
        ],
      },
      {
        heading: "How to update your profile",
        content: [
          {
            type: "list",
            items: [
              "Open Settings from the navigation menu.",
              "Select Open Universal Information.",
              "Review your identity, contact, passport, travel, and background details.",
              "Save each section after making changes.",
            ],
          },
          {
            type: "tip",
            text: "Enter names, dates, and passport details exactly as they appear on your travel documents.",
          },
        ],
      },
      {
        heading: "What information is collected",
        content: [
          {
            type: "list",
            items: [
              "Identity information, including your legal name, birth details, nationality, and gender.",
              "Contact information, including your email, phone number, and current address.",
              "Passport details and reusable supporting documents.",
              "Travel, family, education, employment, and background details used by visa forms.",
            ],
          },
        ],
      },
      {
        heading: "Updating your email or password",
        content: [
          {
            type: "paragraph",
            text: "Email and password changes are handled in the Security section of Settings. Go to Settings → Security and follow the prompts to update your login credentials.",
          },
        ],
      },
    ],
  },
  exploreServices: {
    title: "Explore VIZA",
    subtitle: "Discover the tools available throughout your visa journey.",
    sections: [
      {
        heading: "Visa applications",
        content: [
          {
            type: "paragraph",
            text: "Start or continue an application from Home or Application. VIZA keeps your application answers, supporting documents, payments, consent, and status in one workflow.",
          },
        ],
      },
      {
        heading: "Universal Information",
        content: [
          {
            type: "paragraph",
            text: "Save reusable personal, passport, contact, travel, and background information once, then reuse it across supported visa applications.",
          },
          {
            type: "list",
            items: [
              "Open Universal Information from Settings.",
              "Review each category and upload reusable documents.",
              "Save your changes before returning to an application.",
              "Confirm prefilled answers inside each visa form before submission.",
            ],
          },
        ],
      },
      {
        heading: "VIZA AI",
        content: [
          {
            type: "paragraph",
            text: "Use VIZA AI to understand visa routes, requirements, and next steps. Once your route is clear, continue detailed data entry in the Application area.",
          },
          {
            type: "tip",
            text: "For official requirements, rely on the source links shown by VIZA and ask support when information is uncertain.",
          },
        ],
      },
      {
        heading: "Travel AI",
        content: [
          {
            type: "paragraph",
            text: "Plan trips with Travel AI, including destinations, dates, travelers, preferences, and itinerary ideas. Travel planning stays separate from your official visa application.",
          },
        ],
      },
      {
        heading: "Support and status",
        content: [
          {
            type: "paragraph",
            text: "Use Status to follow application progress and Support for account, payment, document, or timing questions that require the customer-service team.",
          },
        ],
      },
    ],
  },
  accountSecurityTips: {
    title: "Account security tips",
    subtitle: "Best practices to keep your account and personal data safe.",
    sections: [
      {
        heading: "Use a strong, unique password",
        content: [
          {
            type: "paragraph",
            text: "Choose a password that is long, unique, and difficult to guess. Avoid reusing passwords from other services.",
          },
          {
            type: "list",
            items: [
              "Use at least 12 characters.",
              "Include uppercase, lowercase, numbers, and symbols.",
              "Store passwords in a trusted password manager if possible.",
            ],
          },
        ],
      },
      {
        heading: "Keep your credentials private",
        content: [
          {
            type: "paragraph",
            text: "Never share your login details. Official support will never ask for your password.",
          },
          {
            type: "tip",
            text: "If you suspect your password was exposed, change it immediately in Settings → Security.",
          },
        ],
      },
      {
        heading: "Use safe login habits",
        content: [
          {
            type: "list",
            items: [
              "Log out after using shared or public devices.",
              "Do not save passwords in public browsers.",
              "Avoid logging in from unknown networks when possible.",
            ],
          },
        ],
      },
      {
        heading: "Watch for suspicious activity",
        content: [
          {
            type: "paragraph",
            text: "If you notice unexpected account changes, failed login alerts, or unfamiliar activity, contact support through Concierge as soon as possible.",
          },
        ],
      },
    ],
  },
  dataUsage: {
    title: "Data usage",
    subtitle: "Learn what data we collect and how it is used.",
    sections: [
      {
        heading: "What data we collect",
        content: [
          {
            type: "list",
            items: [
              "Personal information: name, date of birth, phone number, and address.",
              "Application data: passport details, visa history, form answers, supporting documents, and consent records.",
              "Usage data: pages visited, features used, and session activity to improve the platform.",
              "Transaction data: payment status, invoices, refunds, and subscription records.",
            ],
          },
        ],
      },
      {
        heading: "How your data is used",
        content: [
          {
            type: "list",
            items: [
              "To prepare, review, and manage your visa applications.",
              "To let authorized visa staff review application materials and provide support.",
              "To process payments and track application service fulfillment.",
              "To send application, document, payment, and status notifications.",
            ],
          },
          {
            type: "tip",
            text: "Your personal data is handled with strict confidentiality and is not sold to third parties.",
          },
        ],
      },
      {
        heading: "Third-party services",
        content: [
          {
            type: "paragraph",
            text: "Some platform functions rely on trusted third-party providers for payments, document processing, communications, and official application submission.",
          },
          {
            type: "paragraph",
            text: "Only the minimum necessary information is shared with these providers to fulfill services on your behalf.",
          },
        ],
      },
      {
        heading: "Your data rights",
        content: [
          {
            type: "list",
            items: [
              "Request a copy of your account and personal data by contacting support.",
              "Request correction of inaccurate profile details.",
              "Request account deletion, subject to applicable visa and legal retention requirements.",
            ],
          },
        ],
      },
    ],
  },
  twoFactorSupport: {
    title: "Two-factor support",
    subtitle: "Add an extra layer of protection to your account.",
    sections: [
      {
        heading: "What is two-factor authentication",
        content: [
          {
            type: "paragraph",
            text: "Two-factor authentication (2FA) adds a second verification step during sign-in. This helps protect your account even if your password is compromised.",
          },
        ],
      },
      {
        heading: "How to enable 2FA",
        content: [
          {
            type: "paragraph",
            text: "2FA support is currently enabled with assistance from our team.",
          },
          {
            type: "list",
            items: [
              "Open Concierge and contact support.",
              "Request two-factor authentication for your account.",
              "Follow the setup instructions sent by support.",
            ],
          },
        ],
      },
      {
        heading: "If you lose access to your second factor",
        content: [
          {
            type: "paragraph",
            text: "If you can no longer access your second factor, contact support immediately. Our team will verify your identity and help restore access.",
          },
        ],
      },
      {
        heading: "Need help",
        content: [
          {
            type: "tip",
            text: "Use Concierge for the fastest response on account security requests.",
          },
        ],
      },
    ],
  },
};

const ZH: Record<StaticHelpArticleId, StaticHelpArticleCopy> = {
  addPaymentMethod: {
    title: "添加支付方式",
    subtitle: "了解平台上的账单和支付方式。",
    sections: [
      {
        heading: "账单如何运作",
        content: [
          {
            type: "paragraph",
            text: "对于符合条件的申请、订阅和代理服务费支付，VIZA 使用安全结账流程。确认购买前，你会看到当前可用的支付方式。",
          },
        ],
      },
      {
        heading: "设置支付方式",
        content: [
          {
            type: "list",
            items: [
              "打开你要支付的申请或订阅结账页面。",
              "核对金额、币种和支付说明。",
              "选择结账页面提供的支付方式，并完成支付服务商的安全流程。",
            ],
          },
          {
            type: "tip",
            text: "VIZA 不会要求你通过聊天或电子邮件发送完整的银行卡信息。如果结账页面没有显示你预期的支付方式，请联系支持团队。",
          },
        ],
      },
      {
        heading: "使用积分",
        content: [
          {
            type: "paragraph",
            text: "符合条件的 VIZA 积分及其兑换方式会显示在积分中心。可用性和使用限制可能因方案、促销活动和购买类型而异。",
          },
        ],
      },
      {
        heading: "查看历史交易",
        content: [
          {
            type: "paragraph",
            text: "打开账单即可查看支付记录、收据、发票申请和退款状态。",
          },
        ],
      },
    ],
  },
  completeProfile: {
    title: "完善你的资料",
    subtitle: "保持可复用的申请人信息准确，并用于你的签证申请。",
    sections: [
      {
        heading: "为什么资料很重要",
        content: [
          {
            type: "paragraph",
            text: "你的通用信息资料会保存可在多个签证申请中复用的申请人信息。保持资料准确可以减少重复填写，也有助于避免官方表格中的信息不一致。",
          },
        ],
      },
      {
        heading: "如何更新资料",
        content: [
          {
            type: "list",
            items: [
              "从导航菜单打开设置。",
              "选择打开通用信息。",
              "检查你的身份、联系方式、护照、旅行和背景信息。",
              "修改后保存每个部分。",
            ],
          },
          {
            type: "tip",
            text: "姓名、日期和护照信息请严格按照旅行证件上的内容填写。",
          },
        ],
      },
      {
        heading: "会收集哪些信息",
        content: [
          {
            type: "list",
            items: [
              "身份信息，包括法定姓名、出生信息、国籍和性别。",
              "联系信息，包括电子邮箱、电话号码和当前地址。",
              "护照信息和可复用的证明文件。",
              "签证表格使用的旅行、家庭、教育、工作和背景信息。",
            ],
          },
        ],
      },
      {
        heading: "更新电子邮箱或密码",
        content: [
          {
            type: "paragraph",
            text: "电子邮箱和密码可以在设置的安全部分修改。前往设置 → 安全，并按照提示更新登录凭证。",
          },
        ],
      },
    ],
  },
  exploreServices: {
    title: "探索 VIZA",
    subtitle: "了解签证过程中可以使用的各项工具。",
    sections: [
      {
        heading: "签证申请",
        content: [
          {
            type: "paragraph",
            text: "你可以从首页或申请页面开始或继续申请。VIZA 会在同一流程中保存申请答案、证明文件、支付、同意记录和状态。",
          },
        ],
      },
      {
        heading: "通用信息",
        content: [
          {
            type: "paragraph",
            text: "一次保存个人、护照、联系、旅行和背景信息，然后在支持的签证申请中重复使用。",
          },
          {
            type: "list",
            items: [
              "从设置打开通用信息。",
              "检查每个类别，并上传可复用的文件。",
              "返回申请前保存修改。",
              "提交前在每个签证表格中确认预填答案。",
            ],
          },
        ],
      },
      {
        heading: "VIZA AI",
        content: [
          {
            type: "paragraph",
            text: "使用 VIZA AI 了解签证路线、要求和下一步。确定申请路线后，请在申请区域继续填写详细资料。",
          },
          {
            type: "tip",
            text: "关于官方要求，请以 VIZA 显示的来源链接为准；如果信息不确定，请联系支持团队。",
          },
        ],
      },
      {
        heading: "Travel AI",
        content: [
          {
            type: "paragraph",
            text: "使用 Travel AI 规划目的地、日期、同行人、偏好和行程想法。旅行规划与正式签证申请相互独立。",
          },
        ],
      },
      {
        heading: "支持与状态",
        content: [
          {
            type: "paragraph",
            text: "使用状态页面跟进申请进度；如有账户、支付、文件或时间方面需要客服团队处理的问题，请使用支持服务。",
          },
        ],
      },
    ],
  },
  accountSecurityTips: {
    title: "账户安全提示",
    subtitle: "保护账户和个人数据的实用建议。",
    sections: [
      {
        heading: "使用强度高且独立的密码",
        content: [
          {
            type: "paragraph",
            text: "选择长度足够、专属且难以猜测的密码。避免重复使用其他服务的密码。",
          },
          {
            type: "list",
            items: [
              "至少使用 12 个字符。",
              "同时包含大写字母、小写字母、数字和符号。",
              "如有可能，请使用可信的密码管理器保存密码。",
            ],
          },
        ],
      },
      {
        heading: "保护登录凭证",
        content: [
          {
            type: "paragraph",
            text: "不要分享登录信息。官方支持团队绝不会要求你提供密码。",
          },
          {
            type: "tip",
            text: "如果怀疑密码已经泄露，请立即前往设置 → 安全修改密码。",
          },
        ],
      },
      {
        heading: "养成安全的登录习惯",
        content: [
          {
            type: "list",
            items: [
              "使用共享或公共设备后退出登录。",
              "不要在公共浏览器中保存密码。",
              "如有可能，避免通过未知网络登录。",
            ],
          },
        ],
      },
      {
        heading: "留意可疑活动",
        content: [
          {
            type: "paragraph",
            text: "如果发现账户出现意外变更、登录失败提醒或陌生活动，请尽快通过 Concierge 联系支持团队。",
          },
        ],
      },
    ],
  },
  dataUsage: {
    title: "数据使用",
    subtitle: "了解我们收集哪些数据以及如何使用这些数据。",
    sections: [
      {
        heading: "我们收集哪些数据",
        content: [
          {
            type: "list",
            items: [
              "个人信息：姓名、出生日期、电话号码和地址。",
              "申请数据：护照信息、签证记录、表格答案、证明文件和同意记录。",
              "使用数据：访问的页面、使用的功能和会话活动，用于改进平台。",
              "交易数据：支付状态、发票、退款和订阅记录。",
            ],
          },
        ],
      },
      {
        heading: "我们如何使用你的数据",
        content: [
          {
            type: "list",
            items: [
              "准备、审核和管理你的签证申请。",
              "让获授权的签证工作人员查看申请材料并提供支持。",
              "处理支付并跟进申请服务的履行情况。",
              "发送申请、文件、支付和状态通知。",
            ],
          },
          {
            type: "tip",
            text: "我们会严格保密处理你的个人数据，不会将其出售给第三方。",
          },
        ],
      },
      {
        heading: "第三方服务",
        content: [
          {
            type: "paragraph",
            text: "平台的部分功能依赖可信的第三方服务商来处理支付、文件、通信和官方申请提交。",
          },
          {
            type: "paragraph",
            text: "我们只会向这些服务商分享代表你完成服务所必需的最少信息。",
          },
        ],
      },
      {
        heading: "你的数据权利",
        content: [
          {
            type: "list",
            items: [
              "联系支持团队，索取账户和个人数据副本。",
              "要求更正不准确的资料信息。",
              "要求删除账户，但须遵守适用的签证和法律留存要求。",
            ],
          },
        ],
      },
    ],
  },
  twoFactorSupport: {
    title: "双重验证支持",
    subtitle: "为账户增加额外的保护层。",
    sections: [
      {
        heading: "什么是双重验证",
        content: [
          {
            type: "paragraph",
            text: "双重验证（2FA）会在登录时增加第二步验证。即使密码泄露，也能帮助保护你的账户。",
          },
        ],
      },
      {
        heading: "如何启用双重验证",
        content: [
          {
            type: "paragraph",
            text: "目前需要在团队协助下启用双重验证。",
          },
          {
            type: "list",
            items: [
              "打开 Concierge 并联系支持团队。",
              "申请为账户启用双重验证。",
              "按照支持团队发送的设置说明操作。",
            ],
          },
        ],
      },
      {
        heading: "无法使用第二验证因素时",
        content: [
          {
            type: "paragraph",
            text: "如果你无法再使用第二验证因素，请立即联系支持团队。团队会验证你的身份并协助恢复账户访问。",
          },
        ],
      },
      {
        heading: "需要帮助",
        content: [
          {
            type: "tip",
            text: "账户安全问题请通过 Concierge 联系支持团队，以便更快获得回复。",
          },
        ],
      },
    ],
  },
};

export function getStaticHelpArticleCopy(
  id: StaticHelpArticleId,
  locale: string,
): StaticHelpArticleCopy {
  return (locale.toLowerCase().startsWith("zh") ? ZH : EN)[id];
}
