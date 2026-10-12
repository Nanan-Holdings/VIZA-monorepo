import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { getMarketingBlogPostAdmin, getMarketingOperationsDashboard } from "@/app/actions/admin-marketing";
import { normalizeInterfaceLocale } from "@/lib/i18n/locale";
import { requireRole } from "@/lib/rbac";
import { BlogEditor } from "../../_components/blog-editor";
import { MarketingBackLink, MarketingStatusBadge } from "../../_components/marketing-ui";
import { PortalHeader, PortalPage } from "../../_components/portal-ui";
import { MARKETING_COPY } from "../../copy";

export const dynamic = "force-dynamic";

export default async function EditMarketingBlogPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, localeValue, actor] = await Promise.all([params, getLocale(), requireRole("admin", "staff")]);
  const [post, dashboard] = await Promise.all([getMarketingBlogPostAdmin(id), getMarketingOperationsDashboard()]);
  if (!post) notFound();
  const locale = normalizeInterfaceLocale(localeValue);
  const copy = MARKETING_COPY[locale];
  const canPublish = actor.role === "admin";
  const publicUrl = new URL(
    `${post.locale === "zh-CN" ? "/zh-CN" : ""}/blog/${post.slug}`,
    process.env.VIZA_MARKETING_PUBLIC_BASE_URL ?? "https://viza.it.com",
  ).toString();

  return (
    <PortalPage>
      <MarketingBackLink href="/admin/marketing/blog" label={copy.back} />
      <PortalHeader
        title={
          <>
            {post.title}
            <MarketingStatusBadge status={post.status} copy={copy} />
          </>
        }
        desc={
          post.editorial.sourceUrl
            ? `${post.locale} · /${post.slug} · v${post.version}${post.generatedByModel ? ` · ${post.generatedByModel}` : ""}`
            : `${post.locale} · /${post.slug} · v${post.version}`
        }
        actions={
          <>
            {post.status === "published" ? (
              <a className="mkt-btn mkt-btn--secondary" href={publicUrl} target="_blank" rel="noopener noreferrer">
                {locale === "zh" ? "查看公开文章" : "View public article"}
              </a>
            ) : null}
            <Link className="mkt-btn mkt-btn--secondary" href={`/admin/marketing/social/new?blogPostId=${post.id}`}>
              {copy.createSocialFromBlog}
            </Link>
            <Link className="mkt-btn mkt-btn--secondary" href="/admin/marketing/blog">
              {copy.blogTitle}
            </Link>
          </>
        }
      />
      {canPublish || post.status === "draft" ? (
        <BlogEditor locale={locale} post={post} openrouterConnected={dashboard.providers.openrouter.connected} canPublish={canPublish} />
      ) : (
        <div className="mkt-panel">
          <div className="mkt-panel-body mkt-note">
            {locale === "zh" ? "仅管理员可以编辑已发布或归档的文章。" : "Only admins can edit published or archived articles."}
          </div>
        </div>
      )}
    </PortalPage>
  );
}
