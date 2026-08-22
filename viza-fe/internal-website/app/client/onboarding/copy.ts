import { isChineseLocale } from "@/lib/i18n/locale";

export type OnboardingCopy = {
  steps: {
    personal: string;
    passport: string;
    travel: string;
    contact: string;
  };
  titles: {
    personal: string;
    passport: string;
    travel: string;
    contact: string;
  };
  subtitles: {
    personal: string;
    passport: string;
    travel: string;
    contact: string;
  };
  fields: {
    fullName: string;
    fullNamePlaceholder: string;
    dateOfBirth: string;
    nationality: string;
    nationalityPlaceholder: string;
    passportNumber: string;
    passportNumberPlaceholder: string;
    issueDate: string;
    expiryDate: string;
    issuingCountry: string;
    issuingCountryPlaceholder: string;
    arrivalDate: string;
    departureDate: string;
    purpose: string;
    purposePlaceholder: string;
    email: string;
    emailPlaceholder: string;
    phone: string;
    phonePlaceholder: string;
    wechat: string;
    wechatPlaceholder: string;
  };
  purposes: {
    tourism: string;
    business: string;
    socialCultural: string;
    familyVisit: string;
  };
  actions: {
    back: string;
    saving: string;
    submit: string;
    next: string;
  };
  errors: {
    stepRequired: string;
    saveFailed: string;
  };
};

const ENGLISH_COPY: OnboardingCopy = {
  steps: {
    personal: "Personal",
    passport: "Passport",
    travel: "Travel",
    contact: "Contact",
  },
  titles: {
    personal: "Tell us about yourself",
    passport: "Your passport details",
    travel: "Your travel plans",
    contact: "How to reach you",
  },
  subtitles: {
    personal: "This information will be used in your visa application.",
    passport: "Enter your passport details exactly as they appear.",
    travel: "Enter your planned travel dates to Indonesia.",
    contact: "We will use these to send you application updates.",
  },
  fields: {
    fullName: "Full name (as on passport)",
    fullNamePlaceholder: "e.g. John Smith",
    dateOfBirth: "Date of birth",
    nationality: "Nationality",
    nationalityPlaceholder: "e.g. Australian",
    passportNumber: "Passport number",
    passportNumberPlaceholder: "e.g. PA1234567",
    issueDate: "Issue date",
    expiryDate: "Expiry date",
    issuingCountry: "Issuing country",
    issuingCountryPlaceholder: "e.g. Australia",
    arrivalDate: "Planned arrival date",
    departureDate: "Planned departure date",
    purpose: "Purpose of visit",
    purposePlaceholder: "Select purpose...",
    email: "Email address",
    emailPlaceholder: "your@email.com",
    phone: "Phone number",
    phonePlaceholder: "+61 400 000 000",
    wechat: "WeChat ID (optional)",
    wechatPlaceholder: "WeChat ID",
  },
  purposes: {
    tourism: "Tourism",
    business: "Business",
    socialCultural: "Social / Cultural",
    familyVisit: "Family Visit",
  },
  actions: {
    back: "Go back",
    saving: "Saving...",
    submit: "Submit",
    next: "Next",
  },
  errors: {
    stepRequired: "Please fill in at least one field before continuing.",
    saveFailed: "We could not save your details. Please try again.",
  },
};

const CHINESE_COPY: OnboardingCopy = {
  steps: {
    personal: "个人信息",
    passport: "护照信息",
    travel: "行程信息",
    contact: "联系方式",
  },
  titles: {
    personal: "先介绍一下自己",
    passport: "填写护照信息",
    travel: "填写出行计划",
    contact: "留下联系方式",
  },
  subtitles: {
    personal: "这些信息将用于准备您的签证申请。",
    passport: "请按照护照上的内容准确填写。",
    travel: "请填写您计划前往印度尼西亚的日期。",
    contact: "我们会通过这些方式向您发送申请进展。",
  },
  fields: {
    fullName: "姓名（与护照一致）",
    fullNamePlaceholder: "例如：张三",
    dateOfBirth: "出生日期",
    nationality: "国籍",
    nationalityPlaceholder: "例如：中国",
    passportNumber: "护照号码",
    passportNumberPlaceholder: "例如：PA1234567",
    issueDate: "签发日期",
    expiryDate: "有效期至",
    issuingCountry: "签发国家或地区",
    issuingCountryPlaceholder: "例如：中国",
    arrivalDate: "计划入境日期",
    departureDate: "计划离境日期",
    purpose: "访问目的",
    purposePlaceholder: "请选择访问目的",
    email: "电子邮箱",
    emailPlaceholder: "your@email.com",
    phone: "电话号码",
    phonePlaceholder: "+86 138 0000 0000",
    wechat: "微信号（可选）",
    wechatPlaceholder: "请输入微信号",
  },
  purposes: {
    tourism: "旅游",
    business: "商务",
    socialCultural: "社交或文化交流",
    familyVisit: "探亲访友",
  },
  actions: {
    back: "返回",
    saving: "正在保存…",
    submit: "提交",
    next: "下一步",
  },
  errors: {
    stepRequired: "请至少填写一项信息后再继续。",
    saveFailed: "暂时无法保存信息，请稍后再试。",
  },
};

export function getOnboardingCopy(locale?: string | null): OnboardingCopy {
  return isChineseLocale(locale) ? CHINESE_COPY : ENGLISH_COPY;
}
