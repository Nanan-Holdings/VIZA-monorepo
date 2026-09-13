import type { CurrentSubscriptionState } from "./commercial-records";
import { isChineseLocale } from "@/lib/i18n/locale";

/** Derive display text at render time so stored subscription state can change language. */
export function localizeSubscriptionState(
  state: CurrentSubscriptionState,
  locale: string,
): CurrentSubscriptionState {
  const zh = isChineseLocale(locale);
  const statuses = {
    free: zh ? "预览中" : "Preview",
    active: zh ? "自动续费中" : "Auto-renewing",
    cancelled: zh ? "已取消，到期失效" : "Cancelled; active until expiry",
    expired: zh ? "已到期" : "Expired",
    incomplete: zh ? "待确认" : "Awaiting confirmation",
  };
  const periodEnd = state.currentPeriodEnd ? new Date(state.currentPeriodEnd) : null;
  const end = periodEnd && Number.isFinite(periodEnd.getTime())
    ? new Intl.DateTimeFormat(zh ? "zh-CN" : "en", { year: "numeric", month: "short", day: "numeric" }).format(periodEnd)
    : null;
  const renewalLabel = state.status === "free"
    ? zh ? "暂未启用" : "Not enabled"
    : state.status === "expired"
      ? zh ? "已到期，请重新选择方案" : "Expired. Please select a plan."
      : state.status === "incomplete"
        ? zh ? "支付确认后启用" : "Starts after payment is confirmed"
        : state.status === "cancelled"
          ? end ? zh ? `已取消，将于 ${end} 到期` : `Cancelled; expires on ${end}` : statuses.cancelled
          : end ? zh ? `将于 ${end} 自动续费` : `Renews automatically on ${end}` : statuses.active;
  // Accept old API snapshots as well as newly generated English snapshots.
  const method = state.paymentMethodLabel;
  const paymentMethodLabel = state.status === "free" || ["暂未设置", "Not set"].includes(method)
    ? zh ? "暂未设置" : "Not set"
    : ["微信支付", "WeChat Pay"].includes(method)
      ? zh ? "微信支付" : "WeChat Pay"
      : ["支付宝", "Alipay"].includes(method)
        ? zh ? "支付宝" : "Alipay"
        : ["银行卡", "Bank card"].includes(method)
          ? zh ? "银行卡" : "Bank card"
          : zh ? "在线支付" : "Online payment";
  return {
    ...state,
    planName: state.planCode === "free" ? zh ? "VIZA 申请体验版" : "VIZA application preview" : state.planName,
    statusLabel: statuses[state.status],
    renewalLabel,
    paymentMethodLabel,
  };
}
