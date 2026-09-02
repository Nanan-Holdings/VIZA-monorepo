import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { CheckCircle, ShieldCheck } from "@phosphor-icons/react/ssr";
import { FeedbackForm } from "./feedback-form";
import { feedbackCopy } from "./feedback-copy";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const copy = feedbackCopy[locale === "en" ? "en" : "zh"];
  return { title: `${copy.title} | VIZA`, description: copy.intro };
}

export default async function FeedbackPage() {
  const locale = await getLocale();
  const copy = feedbackCopy[locale === "en" ? "en" : "zh"];

  return (
    <main className="min-h-screen bg-[#fafafa] px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-[1080px]">
        <header className="border-b border-border-hairline pb-8 sm:pb-10">
          <p className="text-[13px] font-medium uppercase tracking-[0.1em] text-brand-500">{copy.eyebrow}</p>
          <h1 className="mt-3 font-heading text-[28px] font-medium tracking-[-0.8px] text-foreground sm:text-[34px]">
            {copy.title}
          </h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-7 text-muted-foreground">{copy.intro}</p>
        </header>

        <div className="mt-8 grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-10">
          <aside className="h-fit border-b border-border-hairline pb-6 lg:sticky lg:top-8 lg:border-b-0 lg:border-r lg:pr-8">
            <p className="text-[13px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
              {copy.feedbackGuideTitle}
            </p>
            <p className="mt-3 text-[15px] leading-7 text-muted-foreground">{copy.feedbackGuideBody}</p>
            <ul className="mt-5 space-y-3">
              {copy.feedbackGuidePoints.map((point) => (
                <li key={point} className="flex gap-2.5 text-sm leading-6 text-foreground">
                  <CheckCircle className="mt-0.5 shrink-0 text-brand-500" size={16} weight="fill" aria-hidden="true" />
                  {point}
                </li>
              ))}
            </ul>
            <p className="mt-6 flex items-start gap-2.5 text-sm leading-6 text-muted-foreground">
              <ShieldCheck className="mt-0.5 shrink-0 text-brand-500" size={17} aria-hidden="true" />
              {copy.privacy}
            </p>
          </aside>

          <FeedbackForm locale={locale} />
        </div>
      </div>
    </main>
  );
}
