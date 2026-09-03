import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { getMarketingOperationsDashboard, getMarketingSocialComposition } from "@/app/actions/admin-marketing";
import { AdminPage, AdminPageHeader } from "@/components/admin/admin-ui";
import { normalizeInterfaceLocale } from "@/lib/i18n/locale";
import { MarketingBackLink, MarketingStatusBadge } from "../../_components/marketing-ui";
import { SocialEditor } from "../../_components/social-editor";
import { MARKETING_COPY } from "../../copy";

export const dynamic = "force-dynamic";

export default async function EditMarketingSocialPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, localeValue] = await Promise.all([params, getLocale()]);
  const [composition, dashboard] = await Promise.all([getMarketingSocialComposition(id), getMarketingOperationsDashboard()]);
  if (!composition) notFound();
  const locale = normalizeInterfaceLocale(localeValue); const copy = MARKETING_COPY[locale];
  return <AdminPage><MarketingBackLink href="/admin/marketing/social" label={copy.back} /><AdminPageHeader title={<span className="flex flex-wrap items-center gap-2">{composition.title}<MarketingStatusBadge status={composition.status} copy={copy} /></span>} description={copy.socialDescription} /><SocialEditor locale={locale} connectedPlatforms={dashboard.providers.zernio.configuredPlatforms} openrouterConnected={dashboard.providers.openrouter.connected} initial={composition} /></AdminPage>;
}
