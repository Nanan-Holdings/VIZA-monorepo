import type { NotificationTemplate } from "./index.js";
import { renderText } from "./index.js";

function isChinese(payload: Record<string, unknown>): boolean {
  return String(payload.locale ?? "en").toLowerCase().startsWith("zh");
}

export const vietnamStatusUpdateTemplate: NotificationTemplate = {
  key: "vietnam_status_update",
  schema: {
    applicant_name: "string",
    country: "string",
    decision: "string",
    application_url: "url",
    locale: "string",
  },
  subject: (payload) =>
    isChinese(payload)
      ? `您的越南 e‑Visa 状态已更新：${String(payload.decision)}`
      : `Your Vietnam e-Visa status: ${String(payload.decision)}`,
  emailHtml: (payload) =>
    renderText(
      isChinese(payload)
        ? `<p>{{applicant_name}}，您好：</p>
           <p>您的越南 e‑Visa 状态已更新：<strong>{{decision}}</strong>。</p>
           <p>请前往 VIZA 状态中心查看详情；文件就绪后可在该页面查看、打印或下载。</p>
           <p><a href="{{application_url}}">打开 VIZA 状态中心</a></p>
           <p>VIZA</p>`
        : `<p>Hi {{applicant_name}},</p>
           <p>Your Vietnam e-Visa status has changed: <strong>{{decision}}</strong>.</p>
           <p>Open the VIZA status center for details. When the official file is ready, you can view, print, or download it there.</p>
           <p><a href="{{application_url}}">Open the VIZA status center</a></p>
           <p>VIZA</p>`,
      payload,
    ),
  emailText: (payload) =>
    renderText(
      isChinese(payload)
        ? `{{applicant_name}}，您好：\n您的越南 e‑Visa 状态已更新：{{decision}}。\n请在 VIZA 状态中心查看详情：{{application_url}}\n\nVIZA`
        : `Hi {{applicant_name}},\nYour Vietnam e-Visa status has changed: {{decision}}.\nView details in the VIZA status center: {{application_url}}\n\nVIZA`,
      payload,
    ),
  smsText: (payload) =>
    renderText(
      isChinese(payload)
        ? `VIZA：越南 e‑Visa 状态已更新：{{decision}}。{{application_url}}`
        : `VIZA: Vietnam e-Visa status: {{decision}}. {{application_url}}`,
      payload,
    ),
};
