"use client";

import { Fragment, useEffect, type ReactNode } from "react";
import { motion } from "motion/react";
import { useLocale } from "next-intl";
import { ArrowLeft, ArrowSquareOut } from "@phosphor-icons/react";
import Link from "next/link";
import {
  heroGradientCss,
  type CountryHeroTheme,
} from "@/lib/client/country-hero-theme";

const LINKABLE_PATTERN =
  /([\w.+-]+@[\w-]+(?:\.[\w-]+)+)|((?:https?:\/\/)?(?:[a-z0-9-]+\.)+(?:com|gov|cn|org|net)(?:\/[\w\-./#?=&]*)?)/gi;

/** Turn bare domains, URLs and emails in article text into links. */
export function linkifyText(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(LINKABLE_PATTERN)) {
    const value = match[0];
    const index = match.index ?? 0;
    if (index > last) nodes.push(text.slice(last, index));
    const email = Boolean(match[1]);
    const href = email
      ? `mailto:${value}`
      : /^https?:\/\//i.test(value)
        ? value
        : `https://${value}`;
    nodes.push(
      <a
        key={`${index}-${value}`}
        href={href}
        {...(email ? {} : { target: "_blank", rel: "noopener noreferrer" })}
        className="font-medium text-[#c1785d] underline underline-offset-4 break-all hover:text-[#a5604a]"
      >
        {value}
      </a>
    );
    last = index + value.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export interface HelpArticleSection {
  heading: string;
  content: Array<
    | { type: "paragraph"; text: string }
    | { type: "list"; items: string[] }
    | { type: "tip"; text: string }
    | { type: "links"; items: Array<{ label: string; href: string }> }
  >;
}

interface HelpArticleProps {
  title: string;
  subtitle: string;
  sections: HelpArticleSection[];
  /** Where the back links go; defaults to the Help Center. */
  backHref?: string;
  /** Label for the top back link; defaults to "Help Center". */
  topBackLabel?: string;
  /** Label for the footer back link; defaults to "Back to Help Center". */
  backLabel?: string;
  /** Country hero (gradient + landmark) instead of the neutral help hero. */
  heroTheme?: CountryHeroTheme;
  /** Make bare domains, URLs and emails in the text clickable. */
  linkify?: boolean;
}

export function HelpArticle({
  title,
  subtitle,
  sections,
  backHref = "/client/help",
  topBackLabel,
  backLabel,
  heroTheme,
  linkify = false,
}: HelpArticleProps) {
  const renderText = (text: string): ReactNode =>
    linkify
      ? linkifyText(text).map((node, i) => <Fragment key={i}>{node}</Fragment>)
      : text;
  const locale = useLocale();
  const isZh = locale.toLowerCase().startsWith("zh");
  const defaults = isZh
    ? { helpCenter: "帮助中心", tip: "提示：", back: "返回帮助中心" }
    : { helpCenter: "Help Center", tip: "Tip: ", back: "Back to Help Center" };
  const copy = {
    ...defaults,
    helpCenter: topBackLabel ?? defaults.helpCenter,
    back: backLabel ?? defaults.back,
  };

  useEffect(() => {
    const handleScroll = () => {
      const scrollThreshold = 195;
      const isScrolled = window.scrollY > scrollThreshold;
      document.documentElement.style.setProperty(
        "--nav-text-color",
        isScrolled ? "#000000" : "#ffffff"
      );
      document.documentElement.style.setProperty(
        "--nav-stroke-color",
        isScrolled ? "#000000" : "#ffffff"
      );
    };
    window.addEventListener("scroll", handleScroll);
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const backLink = (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Link
        href={backHref}
        className="inline-flex min-h-11 items-center gap-1.5 text-[rgba(255,255,255,0.75)] hover:text-white text-[14px] font-medium transition-colors"
      >
        <ArrowLeft className="size-4" />
        {copy.helpCenter}
      </Link>
    </motion.div>
  );
  const heading = (
    <motion.div
      className="font-sofia-pro font-medium leading-[1.2] not-italic text-[30px] sm:text-[38px] lg:text-[44px] text-white tracking-[-1.2px] sm:tracking-[-1.4px] lg:tracking-[-1.76px]"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8 }}
    >
      <h1 className="mb-0 font-medium">{title}</h1>
      <motion.p
        className="mt-3 sm:mt-4 text-[rgba(255,255,255,0.72)] text-[16px] lg:text-[18px] leading-[1.6] tracking-[-0.3px] font-medium"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.3 }}
      >
        {subtitle}
      </motion.p>
    </motion.div>
  );

  return (
    <div className="bg-[#fbfbf9] relative min-h-screen overflow-x-hidden w-screen left-1/2 -translate-x-1/2 -mt-36 xl:-mt-32">
      {heroTheme ? (
        // Country hero laid out like the client home: the section sizes to its
        // content (no overlap with the body), with the home page's gutters and
        // 1090px content width.
        <section
          className="relative overflow-hidden"
          data-testid="help-article-hero"
        >
          <div
            className="absolute inset-0"
            style={{ backgroundImage: heroGradientCss(heroTheme) }}
          />
          <div className="absolute inset-0 bg-[rgba(0,0,0,0.05)] mix-blend-hard-light" />
          {heroTheme.image && (
            <div
              className="absolute bottom-0 left-1/2 h-[900px] w-[760px] -translate-x-1/2 blur-sm"
              aria-hidden="true"
            >
              <img
                alt=""
                className="h-full w-full object-contain object-bottom"
                src={heroTheme.image}
              />
            </div>
          )}
          <div className="absolute inset-0 bg-[rgba(0,0,0,0.12)]" />
          <div className="relative z-10 px-4 sm:px-6 md:px-10 xl:px-20 pt-[156px] xl:pt-[148px] pb-12 sm:pb-16">
            <div className="mx-auto flex w-full max-w-[1090px] flex-col gap-4">
              {backLink}
              <div className="max-w-[820px]">{heading}</div>
            </div>
          </div>
        </section>
      ) : (
        <div
          className="absolute top-0 left-0 right-0 h-[220px] sm:h-[260px] lg:h-[320px] xl:h-[310px] overflow-hidden z-0"
          data-testid="help-article-hero"
        >
          <div className="absolute inset-0 bg-gradient-to-b from-[#1f2a2e] to-[#a5b8b0]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.35),transparent_55%),radial-gradient(circle_at_80%_30%,rgba(255,255,255,0.2),transparent_45%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0.02)_40%,transparent_60%)]" />
        </div>
      )}

      <div
        className={
          heroTheme
            ? "relative z-10 px-4 sm:px-6 md:px-10 xl:px-20"
            : "relative z-10 w-full flex flex-col items-center px-4 sm:px-6 md:px-10 xl:px-20 pt-36 xl:pt-32 -mt-[130px]"
        }
      >
        {!heroTheme && (
          <>
            <div className="w-full max-w-[720px] mt-[140px]">{backLink}</div>
            <div className="w-full max-w-[720px] mt-5">{heading}</div>
          </>
        )}

        {/* Article body */}
        <div
          className={
            heroTheme
              ? "mx-auto w-full max-w-[1090px] pt-12 sm:pt-16 pb-[80px] sm:pb-[100px]"
              : "w-full max-w-[720px] mt-[20px] sm:mt-[72px] pb-[80px] sm:pb-[100px]"
          }
        >
          <div
            className={
              heroTheme
                ? "flex max-w-[820px] flex-col gap-10 sm:gap-12"
                : "flex flex-col gap-8 sm:gap-12"
            }
          >
            {sections.map((section, i) => (
              <motion.div
                key={section.heading}
                className="flex flex-col gap-4"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 + i * 0.08 }}
              >
                <h2 className="text-[22px] sm:text-[26px] font-medium text-[#2b2b2b] tracking-[-0.6px] leading-[1.3]">
                  {section.heading}
                </h2>
                <div className="flex flex-col gap-3">
                  {section.content.map((block, j) => {
                    if (block.type === "paragraph") {
                      return (
                        <p
                          key={j}
                          className="text-[16px] lg:text-[18px] leading-[1.7] tracking-[-0.24px] text-[#4a4a4a]"
                        >
                          {renderText(block.text)}
                        </p>
                      );
                    }
                    if (block.type === "list") {
                      return (
                        <ul key={j} className="flex flex-col gap-2">
                          {block.items.map((item) => (
                            <li
                              key={item}
                              className="flex items-start gap-2.5 text-[16px] lg:text-[18px] leading-[1.7] tracking-[-0.24px] text-[#4a4a4a]"
                            >
                              <span className="mt-[9px] size-1.5 shrink-0 rounded-full bg-[#c1785d]" />
                              <span className="min-w-0">
                                {renderText(item)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      );
                    }
                    if (block.type === "tip") {
                      return (
                        <div
                          key={j}
                          className="rounded-[12px] border border-[#efefef] bg-white px-5 py-4"
                        >
                          <p className="text-[16px] lg:text-[18px] leading-[1.6] tracking-[-0.24px] text-[#6f6f6f]">
                            <span className="font-medium text-[#2b2b2b]">
                              {copy.tip}
                            </span>
                            {renderText(block.text)}
                          </p>
                        </div>
                      );
                    }
                    if (block.type === "links") {
                      return (
                        <ul key={j} className="flex flex-col gap-2">
                          {block.items.map((item) => (
                            <li
                              key={item.href}
                              className="text-[16px] lg:text-[18px] leading-[1.7] tracking-[-0.24px]"
                            >
                              <a
                                href={item.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 break-all font-medium text-[#c1785d] underline-offset-4 hover:text-[#a5604a] hover:underline"
                              >
                                {item.label}
                                <ArrowSquareOut
                                  className="size-4 shrink-0"
                                  aria-hidden="true"
                                />
                              </a>
                            </li>
                          ))}
                        </ul>
                      );
                    }
                    return null;
                  })}
                </div>
              </motion.div>
            ))}

            {/* Back to help footer */}
            <motion.div
              className="pt-6 border-t border-[#e8e8e8]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.6 }}
            >
              <Link
                href={backHref}
                className="inline-flex items-center gap-1.5 text-[#c1785d] hover:text-[#a5604a] text-[15px] font-medium transition-colors"
              >
                <ArrowLeft className="size-4" />
                {copy.back}
              </Link>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
