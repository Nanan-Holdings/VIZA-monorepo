import Link from "next/link";
import { getLocale } from "next-intl/server";
import { getMarketingOperationsDashboard, listMarketingSocialCompositions } from "@/app/actions/admin-marketing";
import { AdminPage, AdminPageHeader } from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { normalizeInterfaceLocale } from "@/lib/i18n/locale";
import { requireRole } from "@/lib/rbac";
import type { MarketingSocialCompositionRecord, MarketingSocialPlatform } from "@/lib/marketing/contracts";
import { MarketingStatusBadge, MarketingBackLink } from "../_components/marketing-ui";
import { SocialActions } from "../_components/social-actions";
import { MARKETING_COPY } from "../copy";

export const dynamic = "force-dynamic";

const LABELS: Record<MarketingSocialPlatform, string> = {
  x: "X", "google-business-sg": "Google Business", instagram: "Instagram", linkedin: "LinkedIn", facebook: "Facebook", pinterest: "Pinterest", reddit: "Reddit",
};

function DeliveryTile({ row, platform, zh }: { row: MarketingSocialCompositionRecord; platform: MarketingSocialPlatform; zh: boolean }) {
  const image = platform === "instagram" || platform === "pinterest" ? row.uploadPostPosts[platform] : null;
  const zernioId = row.zernioPosts[platform];
  const url = image?.postUrl ?? row.zernioPostUrls[platform];
  const status = image?.status ?? (zernioId ? row.status : "draft");
  const text = status === "published" ? (zh ? "已发布" : "Live") : status === "pending" || status === "publishing" ? (zh ? "处理中" : "Processing") : status === "failed" ? (zh ? "失败" : "Failed") : status === "partial" ? (zh ? "请检查" : "Check provider") : (zh ? "草稿" : "Draft");
  return <div className="rounded-lg border bg-muted/10 p-3">
    <div className="flex items-center justify-between gap-2"><span className="text-sm font-medium">{LABELS[platform]}</span><span className="text-xs text-muted-foreground">{text}</span></div>
    {url ? <a href={url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs text-primary underline">{zh ? "查看帖子" : "View post"}</a> : null}
    {image?.status === "published" && !url ? <p className="mt-2 text-xs text-muted-foreground">{zh ? "平台未返回公开链接" : "Provider did not return a public URL"}</p> : null}
  </div>;
}

export default async function MarketingSocialPage() {
  const locale = normalizeInterfaceLocale(await getLocale());
  const copy = MARKETING_COPY[locale];
  const [rows, dashboard, actor] = await Promise.all([listMarketingSocialCompositions(), getMarketingOperationsDashboard(), requireRole("admin", "staff")]);
  return <AdminPage>
    <MarketingBackLink href="/admin/marketing" label={copy.back} />
    <AdminPageHeader title={copy.socialTitle} description={copy.socialDescription} actions={<Button asChild><Link href="/admin/marketing/social/new">{copy.newSocial}</Link></Button>} />
    {!rows.length ? <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">{copy.noSocial}</CardContent></Card> : <div className="grid gap-4">
      {rows.map((row) => {
        const canPublish = ["draft", "failed", "partial", "cancelled"].includes(row.status) && row.platforms.length > 0 && row.platforms.every((platform) => dashboard.providers.zernio.configuredPlatforms.includes(platform));
        const canSync = Object.keys(row.zernioPosts).length > 0 || Object.keys(row.uploadPostPosts).length > 0;
        const canStop = Object.keys(row.zernioPosts).length > 0 && ["scheduled", "publishing", "published", "partial"].includes(row.status);
        const canEdit = ["draft", "failed", "cancelled"].includes(row.status);
        const hasImagePosts = Object.values(row.uploadPostPosts).some((post) => post.status === "published");
        return <Card key={row.id}><CardContent className="space-y-4 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold">{canEdit ? <Link className="hover:underline" href={`/admin/marketing/social/${row.id}`}>{row.title}</Link> : row.title}</h2><MarketingStatusBadge status={row.status} copy={copy} /></div>
              <p className="text-sm text-muted-foreground">{row.brief}</p>
              <p className="text-xs text-muted-foreground">{row.scheduledFor ? new Date(row.scheduledFor).toLocaleString(locale === "zh" ? "zh-CN" : "en-SG") : copy.notScheduled}</p>
            </div>
            <SocialActions id={row.id} locale={locale} canManage={actor.role === "admin"} canPublish={canPublish} canSync={canSync} canStop={canStop} scheduled={row.status === "scheduled"} hasImagePosts={hasImagePosts} />
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{row.platforms.map((platform) => <DeliveryTile key={platform} row={row} platform={platform} zh={locale === "zh"} />)}</div>
          {hasImagePosts ? <p className="text-xs text-muted-foreground">{locale === "zh" ? "Instagram 和 Pinterest 的旧帖子需要在平台内手动删除。" : "Remove old Instagram and Pinterest posts in those platforms before reposting."}</p> : null}
        </CardContent></Card>;
      })}
    </div>}
  </AdminPage>;
}
