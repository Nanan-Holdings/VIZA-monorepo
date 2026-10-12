import { getLocale } from "next-intl/server";
import { getBetaOperatorState } from "@/app/actions/admin-beta";
import { AdminPage, AdminPageHeader, AdminSectionCard } from "@/components/admin/admin-ui";
import { CardContent } from "@/components/ui/card";
import { normalizeInterfaceLocale } from "@/lib/i18n/locale";
import { MarketingBackLink } from "@/app/admin/(marketing)/marketing/_components/marketing-ui";
import { BetaInviteManager } from "./beta-invite-manager";
import { BetaExperimentFunnel } from "./beta-experiment-funnel";

export const dynamic = "force-dynamic";

export default async function BetaLaunchPage() {
  const locale = normalizeInterfaceLocale(await getLocale());
  const zh = locale === "zh";
  const state = await getBetaOperatorState();
  return <AdminPage>
    <MarketingBackLink href="/admin/marketing" label={zh ? "返回营销控制台" : "Back to marketing"} />
    <AdminPageHeader title={zh ? "内测资格与 A/B 转化" : "Beta invites & A/B conversion"} description={zh ? "按随机分配的方式逐位生成社交内测资格，以预定申请邮箱绑定身份，并在实际发送后确认送达，再比较送达到最终提交的转化率。朋友邀请码单独发放。政府官方费用不参与折扣。" : "Issue randomized social beta access bound to the intended applicant email, confirm actual delivery separately, and compare conversion from delivery through final submission. Friend invitations are issued separately. Official government fees are not discounted."} />
    <AdminSectionCard title={zh ? "发放资格" : "Issue invitations"}><CardContent className="p-5"><BetaInviteManager locale={locale} state={state} /></CardContent></AdminSectionCard>
    <AdminSectionCard title={zh ? "社交内测实验漏斗" : "Social beta experiment funnel"}><CardContent className="p-0"><BetaExperimentFunnel locale={locale} state={state} /></CardContent></AdminSectionCard>
  </AdminPage>;
}
