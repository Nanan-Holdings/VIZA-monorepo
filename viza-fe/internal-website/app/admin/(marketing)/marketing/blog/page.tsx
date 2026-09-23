import Link from "next/link";
import { getLocale } from "next-intl/server";
import { getMarketingOperationsDashboard, listMarketingBlogPosts } from "@/app/actions/admin-marketing";
import { AdminPage, AdminPageHeader, AdminSectionCard } from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";
import { normalizeInterfaceLocale } from "@/lib/i18n/locale";
import { requireRole } from "@/lib/rbac";
import { BlogList, MarketingBackLink } from "../_components/marketing-ui";
import { MARKETING_COPY } from "../copy";
import { RunNewsButton } from "../_components/run-news";

export const dynamic = "force-dynamic";
export default async function MarketingBlogPage() { const [localeValue, actor, posts, dashboard] = await Promise.all([getLocale(), requireRole("admin", "staff"), listMarketingBlogPosts(), getMarketingOperationsDashboard()]); const locale = normalizeInterfaceLocale(localeValue); const copy = MARKETING_COPY[locale]; return <AdminPage><MarketingBackLink href="/admin/marketing" label={copy.back} /><AdminPageHeader title={copy.blogTitle} description={copy.blogDescription} actions={<div className="flex flex-wrap items-start gap-2">{actor.role === "admin" ? <RunNewsButton locale={locale} connected={dashboard.providers.openrouter.connected} /> : null}<Button asChild><Link href="/admin/marketing/blog/new">{copy.newPost}</Link></Button></div>} /><AdminSectionCard title={`${copy.blogTitle} · ${posts.length}`}><BlogList posts={posts} copy={copy} /></AdminSectionCard></AdminPage>; }
