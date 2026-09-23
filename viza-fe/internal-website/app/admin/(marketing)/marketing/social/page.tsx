import { Fragment } from "react";
import Link from "next/link";
import { getLocale } from "next-intl/server";
import { getMarketingOperationsDashboard, listMarketingSocialCompositions } from "@/app/actions/admin-marketing";
import { normalizeInterfaceLocale } from "@/lib/i18n/locale";
import { requireRole } from "@/lib/rbac";
import type { MarketingSocialCompositionRecord, MarketingSocialPlatform } from "@/lib/marketing/contracts";
import { MarketingBackLink, MarketingStatusBadge, statusTone } from "../_components/marketing-ui";
import { EmptyState, PortalHeader, PortalPage, PortalStack, StatusBadge, TablePanel } from "../_components/portal-ui";
import { SocialActions } from "../_components/social-actions";
import { MARKETING_COPY, marketingDateLocale } from "../copy";

export const dynamic = "force-dynamic";

const PLATFORM_LABELS: Record<MarketingSocialPlatform, string> = {
  x: "X",
  "google-business-sg": "Google Business",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  facebook: "Facebook",
  pinterest: "Pinterest",
  reddit: "Reddit",
};

/* One composition fans out to several platforms, and each lands or fails on
   its own. Resolve that per platform so the table can carry one row per
   delivery, the way the Volumet social board does. */
function delivery(row: MarketingSocialCompositionRecord, platform: MarketingSocialPlatform) {
  const image = platform === "instagram" || platform === "pinterest" ? row.uploadPostPosts[platform] : null;
  const zernioId = row.zernioPosts[platform];
  const url = image?.postUrl ?? row.zernioPostUrls[platform] ?? null;
  const status = image?.status ?? (zernioId ? row.status : "draft");
  return { url, status };
}

export default async function MarketingSocialPage() {
  const locale = normalizeInterfaceLocale(await getLocale());
  const copy = MARKETING_COPY[locale];
  const dateLocale = marketingDateLocale(copy);
  const zh = locale === "zh";
  const [rows, dashboard, actor] = await Promise.all([
    listMarketingSocialCompositions(),
    getMarketingOperationsDashboard(),
    requireRole("admin", "staff"),
  ]);

  return (
    <PortalPage>
      <MarketingBackLink href="/admin/marketing" label={copy.back} />
      <PortalHeader
        title={copy.socialTitle}
        desc={copy.socialPortalDescription}
        actions={
          <Link className="mkt-btn mkt-btn--primary" href="/admin/marketing/social/new">
            {copy.newSocial}
          </Link>
        }
      />

      <PortalStack>
        {!rows.length ? (
          <EmptyState
            glyph="◎"
            title={copy.noSocial}
            desc={
              zh
                ? "每篇文章都会生成对应的社媒文案，在文章页面编辑。"
                : "Captions are written alongside every article. Edit them on the composition itself."
            }
          />
        ) : (
          <TablePanel minWidth={940}>
            <thead>
              <tr>
                <th style={{ width: 130 }}>{copy.colPlatform}</th>
                <th>{copy.colCaption}</th>
                <th style={{ width: 130 }}>{copy.colDelivery}</th>
                <th style={{ width: 150 }}>{copy.colLink}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const canPublish =
                  ["draft", "failed", "partial", "cancelled"].includes(row.status) &&
                  row.platforms.length > 0 &&
                  row.platforms.every((platform) => dashboard.providers.zernio.configuredPlatforms.includes(platform));
                const canSync = Object.keys(row.zernioPosts).length > 0 || Object.keys(row.uploadPostPosts).length > 0;
                const canStop =
                  Object.keys(row.zernioPosts).length > 0 &&
                  ["scheduled", "publishing", "published", "partial"].includes(row.status);
                const canEdit = ["draft", "failed", "cancelled"].includes(row.status);
                const hasImagePosts = Object.values(row.uploadPostPosts).some((post) => post.status === "published");

                return (
                  <Fragment key={row.id}>
                    {/* The composition banner: everything that is true of the
                        whole post, and the controls that act on all of it. */}
                    <tr className="mkt-group-row">
                      <td colSpan={4}>
                        <div className="mkt-group">
                          <div className="mkt-group-main">
                            <div className="mkt-group-title">
                              {canEdit ? (
                                <Link href={`/admin/marketing/social/${row.id}`} className="mkt-group-title-link">
                                  {row.title}
                                </Link>
                              ) : (
                                row.title
                              )}
                              <MarketingStatusBadge status={row.status} copy={copy} />
                            </div>
                            <div className="mkt-sub">{row.brief}</div>
                            <div className="mkt-sub mkt-sub-mono">
                              {row.scheduledFor
                                ? new Date(row.scheduledFor).toLocaleString(dateLocale)
                                : copy.notScheduled}
                              {row.lastSyncedAt
                                ? ` · ${copy.synced} ${new Date(row.lastSyncedAt).toLocaleString(dateLocale)}`
                                : ""}
                            </div>
                            {hasImagePosts ? (
                              <div className="mkt-sub">
                                {zh
                                  ? "重新发布前请先在 Instagram 和 Pinterest 中删除旧的图片帖子。"
                                  : "Remove old Instagram and Pinterest posts in those platforms before reposting."}
                              </div>
                            ) : null}
                          </div>
                          <SocialActions
                            id={row.id}
                            locale={locale}
                            canManage={actor.role === "admin"}
                            canPublish={canPublish}
                            canSync={canSync}
                            canStop={canStop}
                            scheduled={row.status === "scheduled"}
                            hasImagePosts={hasImagePosts}
                          />
                        </div>
                      </td>
                    </tr>

                    {row.platforms.length ? (
                      row.platforms.map((platform) => {
                        const { url, status } = delivery(row, platform);
                        return (
                          <tr key={`${row.id}-${platform}`}>
                            <td>{PLATFORM_LABELS[platform]}</td>
                            <td>
                              <div className="mkt-clamp">{row.platformContent[platform] ?? row.brief}</div>
                            </td>
                            <td>
                              <StatusBadge label={status} tone={statusTone(status)} />
                            </td>
                            <td className="mkt-cell-tight">
                              {url ? (
                                <a href={url} target="_blank" rel="noopener noreferrer">
                                  {copy.viewPost}
                                </a>
                              ) : status === "published" ? (
                                <span style={{ color: "var(--mkt-muted-soft)" }}>{copy.noPublicUrl}</span>
                              ) : (
                                <span style={{ color: "var(--mkt-muted-soft)" }}>{copy.waitsForApproval}</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={4} style={{ color: "var(--mkt-muted-soft)" }}>
                          {zh ? "尚未选择平台。" : "No platforms selected yet."}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </TablePanel>
        )}
      </PortalStack>
    </PortalPage>
  );
}
