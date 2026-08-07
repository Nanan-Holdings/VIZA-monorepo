import { isChineseLocale } from "@/lib/i18n/locale";

export type NotificationsCopy = {
  title: string;
  description: string;
  fields: {
    channelEmail: { label: string; hint: string };
    channelPush: { label: string; hint: string };
    submissionStarted: string;
    submissionComplete: string;
    visaDocumentReady: string;
    marketing: string;
  };
  savedAt: (time: string) => string;
};

const ENGLISH_COPY: NotificationsCopy = {
  title: "Notifications",
  description:
    "We always send essential transactional updates (payment received, input needed, decision issued). The rest you can opt out of below.",
  fields: {
    channelEmail: {
      label: "Email notifications",
      hint: "Always on for essential events; toggling off only mutes optional ones.",
    },
    channelPush: {
      label: "Mobile push notifications",
      hint: "Requires the VIZA mobile app.",
    },
    submissionStarted: "Submission started",
    submissionComplete: "Submission complete",
    visaDocumentReady: "Visa document ready",
    marketing: "Product news + offers (opt-in)",
  },
  savedAt: (time) => `Saved at ${time}.`,
};

const CHINESE_COPY: NotificationsCopy = {
  title: "通知设置",
  description: "付款到账、需要补充信息、签证结果等重要事务通知会始终发送；其他通知可在下方按需关闭。",
  fields: {
    channelEmail: {
      label: "邮件通知",
      hint: "重要事务通知始终保留；关闭后只会停止接收可选通知。",
    },
    channelPush: {
      label: "手机推送通知",
      hint: "需要安装 VIZA 手机应用。",
    },
    submissionStarted: "已开始提交",
    submissionComplete: "已完成提交",
    visaDocumentReady: "签证文件已准备好",
    marketing: "产品动态和优惠（自愿订阅）",
  },
  savedAt: (time) => `已于 ${time} 保存。`,
};

export function getNotificationsCopy(locale?: string | null): NotificationsCopy {
  return isChineseLocale(locale) ? CHINESE_COPY : ENGLISH_COPY;
}
