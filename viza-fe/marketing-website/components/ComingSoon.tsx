"use client";

import { useTranslations } from "next-intl";
import SiteNav from "@/components/SiteNav";
import { portalUrl } from "@/lib/utils";
import "./visa-template.css";

/**
 * Coming-soon state for visa destinations not yet launched (MKT-003).
 * Localized via the `visa` message namespace (en + zh-CN).
 */
export default function ComingSoon({ name }: { name: string }) {
  const t = useTranslations("visa");
  return (
    <>
      <SiteNav />
      <main className="vt-soon">
        <h1>{t("comingSoonTitle", { country: name })}</h1>
        <p>{t("comingSoonBody", { country: name })}</p>
        <div className="vt-soon-cta">
          <a className="vt-btn" href="/">{t("browseDestinations")}</a>
          <a className="vt-btn secondary" href={portalUrl("/signup")}>{t("notifyMe")}</a>
        </div>
      </main>
    </>
  );
}
