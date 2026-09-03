import { getLocale } from "next-intl/server";
import { getMarketingOperationsDashboard } from "@/app/actions/admin-marketing";
import { AdminPage, AdminPageHeader } from "@/components/admin/admin-ui";
import { normalizeInterfaceLocale } from "@/lib/i18n/locale";
import { BlogEditor } from "../../_components/blog-editor";
import { MarketingBackLink } from "../../_components/marketing-ui";
import { MARKETING_COPY } from "../../copy";

export const dynamic = "force-dynamic";
export default async function NewMarketingBlogPage() { const locale = normalizeInterfaceLocale(await getLocale()); const copy = MARKETING_COPY[locale]; const dashboard = await getMarketingOperationsDashboard(); return <AdminPage><MarketingBackLink href="/admin/marketing/blog" label={copy.back} /><AdminPageHeader title={copy.newPost} description={copy.blogDescription} /><BlogEditor locale={locale} openrouterConnected={dashboard.providers.openrouter.connected} /></AdminPage>; }
