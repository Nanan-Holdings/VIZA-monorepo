import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { getMarketingOperationsDashboard, getMarketingSocialComposition } from "@/app/actions/admin-marketing";
import { normalizeInterfaceLocale } from "@/lib/i18n/locale";
import { requireRole } from "@/lib/rbac";
import { MarketingBackLink, MarketingStatusBadge } from "../../_components/marketing-ui";
import { PortalHeader, PortalPage } from "../../_components/portal-ui";
import { SocialEditor } from "../../_components/social-editor";
import { MARKETING_COPY } from "../../copy";

export const dynamic = "force-dynamic";

export default async function EditMarketingSocialPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, localeValue] = await Promise.all([params, getLocale()]);
  const [composition, dashboard, actor] = await Promise.all([
    getMarketingSocialComposition(id),
    getMarketingOperationsDashboard(),
    requireRole("admin", "staff"),
  ]);
  if (!composition) notFound();
  const locale = normalizeInterfaceLocale(localeValue);
  const copy = MARKETING_COPY[locale];

  return (
    <PortalPage>
      <MarketingBackLink href="/admin/marketing/social" label={copy.back} />
      <PortalHeader
        title={
          <>
            {composition.title}
            <MarketingStatusBadge status={composition.status} copy={copy} />
          </>
        }
        desc={copy.socialDescription}
      />
      <SocialEditor
        locale={locale}
        connectedPlatforms={dashboard.providers.zernio.configuredPlatforms}
        openrouterConnected={dashboard.providers.openrouter.connected}
        canPublish={actor.role === "admin"}
        initial={composition}
      />
    </PortalPage>
  );
}
