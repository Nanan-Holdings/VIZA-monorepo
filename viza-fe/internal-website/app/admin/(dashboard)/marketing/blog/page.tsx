import Link from "next/link";
import { getLocale } from "next-intl/server";
import { listMarketingBlogPosts } from "@/app/actions/admin-marketing";
import { AdminPage, AdminPageHeader, AdminSectionCard } from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";
import { normalizeInterfaceLocale } from "@/lib/i18n/locale";
import { BlogList, MarketingBackLink } from "../_components/marketing-ui";
import { MARKETING_COPY } from "../copy";

export const dynamic = "force-dynamic";
export default async function MarketingBlogPage() { const locale = normalizeInterfaceLocale(await getLocale()); const copy = MARKETING_COPY[locale]; const posts = await listMarketingBlogPosts(); return <AdminPage><MarketingBackLink href="/admin/marketing" label={copy.back} /><AdminPageHeader title={copy.blogTitle} description={copy.blogDescription} actions={<Button asChild><Link href="/admin/marketing/blog/new">{copy.newPost}</Link></Button>} /><AdminSectionCard title={`${copy.blogTitle} · ${posts.length}`}><BlogList posts={posts} copy={copy} /></AdminSectionCard></AdminPage>; }
