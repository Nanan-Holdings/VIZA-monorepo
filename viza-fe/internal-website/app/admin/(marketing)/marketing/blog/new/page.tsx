import { getLocale } from "next-intl/server";
import { getMarketingOperationsDashboard } from "@/app/actions/admin-marketing";
import { AdminPage, AdminPageHeader } from "@/components/admin/admin-ui";
import { normalizeInterfaceLocale } from "@/lib/i18n/locale";
import { requireRole } from "@/lib/rbac";
import { BlogEditor } from "../../_components/blog-editor";
import { MarketingBackLink } from "../../_components/marketing-ui";
import { MARKETING_COPY } from "../../copy";

export const dynamic = "force-dynamic";
export default async function NewMarketingBlogPage() { const [localeValue, actor, dashboard] = await Promise.all([getLocale(), requireRole("admin", "staff"), getMarketingOperationsDashboard()]); const locale = normalizeInterfaceLocale(localeValue); const copy = MARKETING_COPY[locale]; return <AdminPage><MarketingBackLink href="/admin/marketing/blog" label={copy.back} /><AdminPageHeader title={copy.newPost} description={copy.blogDescription} /><BlogEditor locale={locale} openrouterConnected={dashboard.providers.openrouter.connected} canPublish={actor.role === "admin"} /></AdminPage>; }
