import { setRequestLocale } from "next-intl/server";
import SiteFooter from "@/components/SiteFooter";
import SiteNav from "@/components/SiteNav";
import { getPublicStatusSnapshot } from "@/lib/public-status";
import StatusClient from "./status-client";
import "./status.css";

export default async function StatusPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const snapshot = await getPublicStatusSnapshot();

  return (
    <>
      <SiteNav />
      <StatusClient initialSnapshot={snapshot} locale={locale} />
      <SiteFooter />
    </>
  );
}
