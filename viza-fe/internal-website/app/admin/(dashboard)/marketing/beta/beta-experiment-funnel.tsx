import type { BetaOperatorState } from "@/app/actions/admin-beta";

export function BetaExperimentFunnel({ locale, state }: {
  locale: "en" | "zh";
  state: BetaOperatorState;
}) {
  const zh = locale === "zh";
  const pct = (value: number, total: number) => total ? `${((value / total) * 100).toFixed(1)}%` : "—";
  return <div>
    <div className="border-b bg-muted/20 px-4 py-3 text-sm font-medium">
      {zh
        ? `社交内测组：已生成 ${state.issued}/${state.targetCount}，已送达 ${state.delivered}，可发放 ${state.remainingIssuable}`
        : `Social cohort: ${state.issued}/${state.targetCount} issued, ${state.delivered} delivered, ${state.remainingIssuable} issuable`}
    </div>
    <div className="overflow-x-auto">
      <table className="w-full min-w-[680px] text-sm">
        <thead className="border-b bg-muted/30 text-left"><tr>
          <th className="p-3">{zh ? "方式" : "Method"}</th>
          <th className="p-3">{zh ? "已发放" : "Delivered"}</th>
          <th className="p-3">{zh ? "开始结账" : "Checkout"}</th>
          <th className="p-3">{zh ? "完成付款" : "Paid"}</th>
          <th className="p-3">{zh ? "最终提交" : "Submitted"}</th>
          <th className="p-3">{zh ? "提交转化率" : "Submit rate"}</th>
        </tr></thead>
        <tbody>{state.metrics.map((row) => <tr key={row.deliveryMethod} className="border-b last:border-0">
          <td className="p-3">{row.deliveryMethod === "promo_code" ? (zh ? "优惠码" : "Promo") : (zh ? "专属链接" : "Link")}</td>
          <td className="p-3 tabular-nums">{row.delivered}</td>
          <td className="p-3 tabular-nums">{row.checkoutStarted}</td>
          <td className="p-3 tabular-nums">{row.converted}</td>
          <td className="p-3 tabular-nums">{row.submitted}</td>
          <td className="p-3 font-medium tabular-nums">{pct(row.submitted, row.delivered)}</td>
        </tr>)}</tbody>
      </table>
    </div>
  </div>;
}
