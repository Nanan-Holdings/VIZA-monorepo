import { getLocale } from "next-intl/server";
import { listMarketingShortLinks } from "@/app/actions/admin-marketing";
import { normalizeInterfaceLocale } from "@/lib/i18n/locale";
import { MarketingBackLink } from "../_components/marketing-ui";
import { EmptyState, PortalHeader, PortalPage, PortalSection, PortalStack, StatusBadge, TablePanel } from "../_components/portal-ui";
import { CreateTrackingLink, ToggleTrackingLink } from "../_components/tracking-actions";
import { MARKETING_COPY, marketingDateLocale } from "../copy";

export const dynamic = "force-dynamic";

export default async function MarketingTrackingPage() {
  const locale = normalizeInterfaceLocale(await getLocale());
  const copy = MARKETING_COPY[locale];
  const dateLocale = marketingDateLocale(copy);
  const links = await listMarketingShortLinks();
  const base = process.env.VIZA_MARKETING_PUBLIC_BASE_URL?.replace(/\/$/, "") ?? "https://viza.it.com";
  const number = new Intl.NumberFormat(dateLocale);

  return (
    <PortalPage>
      <MarketingBackLink href="/admin/marketing" label={copy.back} />
      <PortalHeader title={copy.trackingTitle} desc={copy.trackingDescription} />

      <PortalStack>
        <PortalSection title={copy.newTrackingLink}>
          <div className="mkt-panel">
            <div className="mkt-panel-body">
              <CreateTrackingLink locale={locale} />
            </div>
          </div>
        </PortalSection>

        {links.length === 0 ? (
          <EmptyState glyph="⇱" title={copy.noTrackingLinks} desc={copy.trackingDescription} />
        ) : (
          <TablePanel minWidth={940}>
            <thead>
              <tr>
                <th style={{ width: 230 }}>{copy.colShortLink}</th>
                <th>{copy.colDestination}</th>
                <th style={{ width: 150 }}>{copy.colCampaign}</th>
                <th style={{ width: 90 }}>{copy.colClicks}</th>
                <th style={{ width: 130 }}>{copy.colLastClick}</th>
                <th style={{ width: 200 }}>{copy.colStatus}</th>
              </tr>
            </thead>
            <tbody>
              {links.map((link) => (
                <tr key={link.id}>
                  <td>
                    <a href={`${base}/s/${link.code}`} target="_blank" rel="noreferrer" className="mkt-sub-mono">
                      /s/{link.code}
                    </a>
                  </td>
                  <td className="mkt-cell-tight" style={{ overflowWrap: "anywhere" }}>
                    {link.destinationUrl}
                  </td>
                  <td className="mkt-cell-tight">{link.campaign ?? "—"}</td>
                  <td className="mkt-mono">{number.format(link.clickCount)}</td>
                  <td className="mkt-mono" style={{ color: link.lastClickedAt ? undefined : "var(--mkt-muted-soft)" }}>
                    {link.lastClickedAt ? link.lastClickedAt.slice(0, 10) : "—"}
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <StatusBadge
                        dot
                        label={link.active ? copy.active : copy.inactive}
                        tone={link.active ? "up" : "off"}
                      />
                      <ToggleTrackingLink id={link.id} active={link.active} locale={locale} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </TablePanel>
        )}
      </PortalStack>
    </PortalPage>
  );
}
