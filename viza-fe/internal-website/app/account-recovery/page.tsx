import Link from "next/link";
import { Lifebuoy as LifeBuoy, ShieldWarning as ShieldAlert } from "@phosphor-icons/react/ssr";
import { getTranslations } from "next-intl/server";

export default async function AccountRecoveryPage() {
  const t = await getTranslations("accountRecovery");
  return (
    <main className="min-h-screen bg-[#fafafa] px-6 py-10">
      <div className="mx-auto max-w-xl space-y-5">
        <header>
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50">
            <LifeBuoy className="h-6 w-6 text-brand-500" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("description")}
          </p>
        </header>

        <section className="rounded-xl border border-input bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-foreground">{t("steps")}</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
            <li>
              {t.rich("emailSupport", { link: (chunks) => <a className="font-medium text-brand-500 hover:underline" href="mailto:support@viza.app?subject=Account%20recovery">{chunks}</a> })}
            </li>
            <li>
              {t("details")}
            </li>
            <li>
              {t("response")}
            </li>
          </ol>
        </section>

        <section className="rounded-xl border border-input bg-white p-5 shadow-sm">
          <h2 className="inline-flex items-center gap-2 text-base font-semibold text-foreground">
            <ShieldAlert className="h-5 w-5 text-brand-500" /> {t("why")}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("whyDescription")}
          </p>
        </section>

        <p className="text-xs text-muted-foreground">
          {t.rich("alternative", { link: (chunks) => <Link href="/account/security" className="font-medium text-brand-500 hover:underline">{chunks}</Link> })}
        </p>
      </div>
    </main>
  );
}
