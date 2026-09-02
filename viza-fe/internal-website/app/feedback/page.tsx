import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { ChatDots, ShieldCheck } from "@phosphor-icons/react/ssr";
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
    <main className="min-h-screen bg-[#fafafa] px-4 py-10 sm:py-16">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 text-center sm:mb-10">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-brand-50 text-brand-500"><ChatDots size={24} weight="duotone" aria-hidden="true" /></div>
          <p className="mt-5 text-sm font-semibold uppercase tracking-[0.16em] text-brand-500">{copy.eyebrow}</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{copy.title}</h1>
          <p className="mx-auto mt-4 max-w-xl leading-7 text-muted-foreground">{copy.intro}</p>
        </div>
        <FeedbackForm locale={locale} />
        <p className="mt-5 flex items-start gap-2 text-sm leading-6 text-muted-foreground"><ShieldCheck className="mt-0.5 shrink-0 text-brand-500" size={18} aria-hidden="true" />{copy.privacy}</p>
      </div>
    </main>
  );
}
