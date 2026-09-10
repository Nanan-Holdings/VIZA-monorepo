import { getLocale } from "next-intl/server";
import { getBetaOperatorState } from "@/app/actions/admin-beta";
import { BetaInviteManager } from "@/app/admin/(dashboard)/marketing/beta/beta-invite-manager";
import { BetaExperimentFunnel } from "@/app/admin/(dashboard)/marketing/beta/beta-experiment-funnel";
import { AdminPage, AdminPageHeader, AdminSectionCard } from "@/components/admin/admin-ui";
import { CardContent } from "@/components/ui/card";
import { normalizeInterfaceLocale } from "@/lib/i18n/locale";

export const dynamic = "force-dynamic";

export default async function CustomerServiceBetaPage() {
  const locale = normalizeInterfaceLocale(await getLocale());
  const zh = locale === "zh";
  const state = await getBetaOperatorState();

  return <AdminPage>
    <a href="/admin/cs" className="text-sm font-medium text-brand-500 hover:underline">
      {zh ? "← 返回客服工作台" : "← Back to support"}
    </a>
    <AdminPageHeader
      title={zh ? "内测资格与 A/B 转化" : "Beta invites & A/B conversion"}
      description={zh ? "凭平台、用户标识、预定申请邮箱和互动凭证逐位生成随机分配的社交内测资格，并在实际发送后单独确认送达；朋友邀请码单独发放。折扣不包含政府官方费用。" : "Issue randomized social beta access using platform, recipient, intended applicant email, and proof evidence, then confirm actual delivery separately. Friend invitations are separate. Government fees are never discounted."}
    />
    <AdminSectionCard title={zh ? "发放资格" : "Issue invitations"}>
      <CardContent className="p-5"><BetaInviteManager locale={locale} state={state} /></CardContent>
    </AdminSectionCard>
    <AdminSectionCard title={zh ? "社交内测实验漏斗" : "Social beta experiment funnel"}>
      <CardContent className="p-0"><BetaExperimentFunnel locale={locale} state={state} /></CardContent>
    </AdminSectionCard>
  </AdminPage>;
}
