import { isChineseLocale } from "@/lib/i18n/locale";

export type SecurityCopy = {
  title: string;
  description: string;
  errors: {
    loadFactors: string;
    enroll: string;
    challenge: string;
    verify: string;
    disable: string;
  };
  enabled: string;
  factorStatus: (id: string, status: string) => string;
  disable: string;
  setup: string;
  setupDescription: string;
  cannotScan: string;
  copy: string;
  codeLabel: string;
  recoveryCodes: string;
  cancel: string;
  verifyEnable: string;
  notConfigured: string;
  notConfiguredDescription: string;
  enable: string;
  recoveryHelp: string;
  recoveryLink: string;
};

const ENGLISH_COPY: SecurityCopy = {
  title: "Account security",
  description: "Two-factor authentication via a TOTP authenticator app (Google Authenticator, 1Password, Authy).",
  errors: {
    loadFactors: "We could not load your authenticator settings. Please try again.",
    enroll: "We could not start authenticator setup. Please try again.",
    challenge: "We could not start verification. Please try again.",
    verify: "The code could not be verified. Check it and try again.",
    disable: "We could not disable this authenticator. Please try again.",
  },
  enabled: "TOTP enabled",
  factorStatus: (id, status) => `Factor ${id}… · status ${status}`,
  disable: "Disable",
  setup: "Set up authenticator",
  setupDescription: "Scan the QR code with your authenticator app, then enter the 6-digit code below to confirm.",
  cannotScan: "Can't scan? Use this secret",
  copy: "Copy",
  codeLabel: "6-digit code",
  recoveryCodes: "Recovery codes (shown once — save them now)",
  cancel: "Cancel",
  verifyEnable: "Verify & enable",
  notConfigured: "TOTP not configured",
  notConfiguredDescription: "Add a second factor to protect your account.",
  enable: "Enable TOTP",
  recoveryHelp: "Lost both your device and your recovery codes?",
  recoveryLink: "Account recovery",
};

const CHINESE_COPY: SecurityCopy = {
  title: "账户安全",
  description: "使用 TOTP 验证器应用开启双重身份验证（支持 Google Authenticator、1Password、Authy）。",
  errors: {
    loadFactors: "暂时无法读取验证器设置，请稍后再试。",
    enroll: "暂时无法开始设置验证器，请稍后再试。",
    challenge: "暂时无法开始验证，请稍后再试。",
    verify: "验证码验证失败，请检查后重试。",
    disable: "暂时无法停用该验证器，请稍后再试。",
  },
  enabled: "TOTP 已启用",
  factorStatus: (id, status) => {
    const statusLabel = status === "verified" ? "已验证" : status === "unverified" ? "未验证" : "待确认";
    return `验证器 ${id}… · 状态：${statusLabel}`;
  },
  disable: "停用",
  setup: "设置验证器",
  setupDescription: "用验证器应用扫描二维码，然后输入下方的 6 位验证码完成确认。",
  cannotScan: "无法扫描？改用密钥",
  copy: "复制",
  codeLabel: "6 位验证码",
  recoveryCodes: "恢复码（只显示一次，请立即保存）",
  cancel: "取消",
  verifyEnable: "验证并启用",
  notConfigured: "尚未设置 TOTP",
  notConfiguredDescription: "添加第二重验证，进一步保护您的账户。",
  enable: "启用 TOTP",
  recoveryHelp: "如果设备和恢复码均已遗失：",
  recoveryLink: "账户恢复",
};

export function getSecurityCopy(locale?: string | null): SecurityCopy {
  return isChineseLocale(locale) ? CHINESE_COPY : ENGLISH_COPY;
}
