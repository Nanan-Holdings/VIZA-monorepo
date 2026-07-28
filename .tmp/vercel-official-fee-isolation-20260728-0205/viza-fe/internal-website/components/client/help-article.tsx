"use client";

import { useEffect } from "react";
import { motion } from "motion/react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export interface HelpArticleSection {
  heading: string;
  content: Array<
    | { type: "paragraph"; text: string }
    | { type: "list"; items: string[] }
    | { type: "tip"; text: string }
  >;
}

interface HelpArticleProps {
  title: string;
  subtitle: string;
  sections: HelpArticleSection[];
}

export function HelpArticle({ title, subtitle, sections }: HelpArticleProps) {
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

  return (
    <div className="bg-[#fbfbf9] relative min-h-screen overflow-x-hidden w-screen left-1/2 -translate-x-1/2 -mt-36 xl:-mt-32">
      {/* Hero */}
      <div className="absolute top-0 left-0 right-0 h-[220px] sm:h-[260px] lg:h-[320px] xl:h-[310px] overflow-hidden z-0">
        <div className="absolute inset-0 bg-gradient-to-b from-[#1f2a2e] to-[#a5b8b0]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.35),transparent_55%),radial-gradient(circle_at_80%_30%,rgba(255,255,255,0.2),transparent_45%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0.02)_40%,transparent_60%)]" />
      </div>

      <div className="relative z-10 w-full flex flex-col items-center px-4 sm:px-6 md:px-10 xl:px-20 pt-36 xl:pt-32 -mt-[130px]">
        {/* Back link */}
        <motion.div
          className="w-full max-w-[720px] mt-[140px]"
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Link
            href="/client/help"
            className="inline-flex items-center gap-1.5 text-[rgba(255,255,255,0.75)] hover:text-white text-[14px] font-medium transition-colors"
          >
            <ArrowLeft className="size-4" />
            Help Center
          </Link>
        </motion.div>

        {/* Hero title */}
        <motion.div
          className="font-sofia-pro font-medium leading-[1.2] not-italic text-[30px] sm:text-[38px] lg:text-[44px] text-white mt-5 tracking-[-1.2px] sm:tracking-[-1.4px] lg:tracking-[-1.76px] w-full max-w-[720px]"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <p className="mb-0">{title}</p>
          <motion.p
            className="mt-3 sm:mt-4 text-[rgba(255,255,255,0.7)] text-[16px] lg:text-[18px] tracking-[-0.3px] font-medium"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
          >
            {subtitle}
          </motion.p>
        </motion.div>

        {/* Article body */}
        <div className="w-full max-w-[720px] mt-[20px] sm:mt-[72px] flex flex-col gap-8 sm:gap-12 pb-[80px] sm:pb-[100px]">
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
                        {block.text}
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
                            {item}
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
                          <span className="font-medium text-[#2b2b2b]">Tip: </span>
                          {block.text}
                        </p>
                      </div>
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
              href="/client/help"
              className="inline-flex items-center gap-1.5 text-[#c1785d] hover:text-[#a5604a] text-[15px] font-medium transition-colors"
            >
              <ArrowLeft className="size-4" />
              Back to Help Center
            </Link>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
