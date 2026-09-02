export type FeedbackCopy = {
  eyebrow: string;
  title: string;
  intro: string;
  privacy: string;
  identityTitle: string;
  identityDescription: string;
  login: string;
  anonymous: string;
  experience: string;
  ease: string;
  ratingHint: string;
  task: string;
  feedbackType: string;
  description: string;
  descriptionHint: string;
  reproduce: string;
  expected: string;
  environment: string;
  contact: string;
  contactYes: string;
  email: string;
  submit: string;
  submitting: string;
  required: string;
  error: string;
  successTitle: string;
  successBody: string;
  sendAnother: string;
  tasks: Record<string, string>;
  types: Record<string, string>;
};

export const feedbackCopy: Record<"en" | "zh", FeedbackCopy> = {
  en: {
    eyebrow: "VIZA beta",
    title: "Help us improve VIZA",
    intro: "Your candid feedback helps us make visa applications simpler, clearer, and more reliable.",
    privacy: "Please do not include passport numbers, passwords, payment details, or other sensitive personal information.",
    identityTitle: "How would you like to share feedback?",
    identityDescription: "Sign in if you would like us to see your VIZA account context, or continue without identifying yourself.",
    login: "Log in",
    anonymous: "Continue anonymously",
    experience: "Overall, how was your experience?",
    ease: "How easy was VIZA to use?",
    ratingHint: "1 is poor and 5 is excellent.",
    task: "What were you trying to do?",
    feedbackType: "What kind of feedback is this?",
    description: "Tell us what happened or what we should improve",
    descriptionHint: "The more specific you can be, the easier it is for our team to act on it.",
    reproduce: "Steps to reproduce (optional)",
    expected: "What did you expect to happen? (optional)",
    environment: "Device and browser (optional)",
    contact: "May we contact you about this feedback?",
    contactYes: "Yes, you can contact me.",
    email: "Your email address",
    submit: "Send feedback",
    submitting: "Sending…",
    required: "Please complete the required fields before sending.",
    error: "We could not send your feedback. Please try again shortly.",
    successTitle: "Thank you for helping shape VIZA.",
    successBody: "Your feedback is with our beta team.",
    sendAnother: "Send more feedback",
    tasks: {
      "sign-up": "Sign up or log in",
      "choose-visa": "Choose a visa or destination",
      application: "Complete an application",
      documents: "Upload documents",
      assistant: "Use the AI assistant",
      payment: "Pay for a service",
      status: "Track an application",
      travel: "Plan a trip",
      other: "Something else",
    },
    types: {
      bug: "Something is broken",
      confusing: "Something is confusing",
      missing: "A feature is missing",
      idea: "I have an idea",
      praise: "Something worked well",
    },
  },
  zh: {
    eyebrow: "VIZA 测试版",
    title: "帮助我们改进 VIZA",
    intro: "您的真实反馈能帮助我们让签证申请更简单、更清晰、更可靠。",
    privacy: "请勿填写护照号码、密码、付款信息或其他敏感个人资料。",
    identityTitle: "您想如何提交反馈？",
    identityDescription: "登录后，我们可以结合您的 VIZA 账户背景查看反馈；您也可以匿名继续。",
    login: "登录",
    anonymous: "匿名继续",
    experience: "整体而言，您的使用体验如何？",
    ease: "您觉得 VIZA 使用起来有多容易？",
    ratingHint: "1 分代表很差，5 分代表非常好。",
    task: "您当时想完成什么？",
    feedbackType: "这是什么类型的反馈？",
    description: "请告诉我们发生了什么，或我们可以如何改进",
    descriptionHint: "描述得越具体，我们的团队越容易采取行动。",
    reproduce: "复现步骤（选填）",
    expected: "您原本期待发生什么？（选填）",
    environment: "设备和浏览器（选填）",
    contact: "我们可以就这条反馈联系您吗？",
    contactYes: "可以，您可以联系我。",
    email: "您的邮箱地址",
    submit: "提交反馈",
    submitting: "正在提交…",
    required: "请先完成所有必填项。",
    error: "暂时无法提交反馈，请稍后重试。",
    successTitle: "感谢您帮助 VIZA 变得更好。",
    successBody: "您的反馈已发送给我们的测试团队。",
    sendAnother: "提交另一条反馈",
    tasks: {
      "sign-up": "注册或登录",
      "choose-visa": "选择签证或目的地",
      application: "填写申请",
      documents: "上传材料",
      assistant: "使用 AI 助手",
      payment: "支付服务费用",
      status: "查看申请进度",
      travel: "规划旅行",
      other: "其他事项",
    },
    types: {
      bug: "遇到了故障",
      confusing: "有些地方不清楚",
      missing: "缺少某项功能",
      idea: "我有一个想法",
      praise: "有些地方做得很好",
    },
  },
};

export const feedbackTasks = [
  "sign-up",
  "choose-visa",
  "application",
  "documents",
  "assistant",
  "payment",
  "status",
  "travel",
  "other",
] as const;

export const feedbackTypes = ["bug", "confusing", "missing", "idea", "praise"] as const;
