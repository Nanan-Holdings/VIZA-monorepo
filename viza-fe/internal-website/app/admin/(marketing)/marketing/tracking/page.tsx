import { getLocale } from "next-intl/server";
import { listMarketingShortLinks } from "@/app/actions/admin-marketing";
import { AdminPage, AdminPageHeader, AdminSectionCard } from "@/components/admin/admin-ui";
import { Card, CardContent } from "@/components/ui/card";
import { normalizeInterfaceLocale } from "@/lib/i18n/locale";
import { MarketingBackLink } from "../_components/marketing-ui";
import { CreateTrackingLink, ToggleTrackingLink } from "../_components/tracking-actions";
import { MARKETING_COPY } from "../copy";

export const dynamic = "force-dynamic";

export default async function MarketingTrackingPage() {
  const locale = normalizeInterfaceLocale(await getLocale()); const copy = MARKETING_COPY[locale]; const links = await listMarketingShortLinks();
  const base = process.env.VIZA_MARKETING_PUBLIC_BASE_URL?.replace(/\/$/, "") ?? "https://viza.it.com";
  const number = new Intl.NumberFormat(locale === "zh" ? "zh-CN" : "en-SG");
  return <AdminPage><MarketingBackLink href="/admin/marketing" label={copy.back} /><AdminPageHeader title={copy.trackingTitle} description={copy.trackingDescription} /><AdminSectionCard title={copy.newTrackingLink}><CardContent className="p-5"><CreateTrackingLink locale={locale} /></CardContent></AdminSectionCard>{links.length === 0 ? <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">{copy.noTrackingLinks}</CardContent></Card> : <div className="grid gap-4">{links.map((link) => <Card key={link.id}><CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between"><div className="min-w-0 space-y-1"><div className="flex flex-wrap items-center gap-2"><a href={`${base}/s/${link.code}`} target="_blank" rel="noreferrer" className="font-medium text-primary underline">{base}/s/{link.code}</a><span className={link.active ? "text-xs text-emerald-700" : "text-xs text-muted-foreground"}>{link.active ? copy.active : copy.inactive}</span></div><p className="truncate text-sm text-muted-foreground">{link.destinationUrl}</p><p className="text-xs text-muted-foreground">{link.campaign ?? "—"} · {number.format(link.clickCount)} {copy.clicks}{link.lastClickedAt ? ` · ${new Date(link.lastClickedAt).toLocaleString(locale === "zh" ? "zh-CN" : "en-SG")}` : ""}</p></div><ToggleTrackingLink id={link.id} active={link.active} locale={locale} /></CardContent></Card>)}</div>}</AdminPage>;
}
