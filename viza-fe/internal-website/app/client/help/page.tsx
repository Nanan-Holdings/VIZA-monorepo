"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

const svgPaths = {
  plus: "M12 20.1667H28.3333M20.1667 12V28.3333",
};

function QuickLinksSection() {
  const t = useTranslations("help");

  const quickLinks = [
    { title: t("quickLinks.accountProfile.title"), href: "/client/settings", description: t("quickLinks.accountProfile.description") },
    { title: t("quickLinks.referrals.title"), href: "/client/invite-friends", description: t("quickLinks.referrals.description") },
    { title: t("quickLinks.payments.title"), href: "/client/billing", description: t("quickLinks.payments.description") },
  ];

  return (
    <motion.div
      className="content-stretch flex flex-col gap-4 sm:gap-6 lg:gap-8 items-start relative shrink-0 w-full"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.2 }}
    >
      <p className="font-medium leading-[1.3] not-italic relative shrink-0 text-[28px] text-black tracking-[-1.12px] w-full">
        {t("quickLinks.title")}
      </p>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 w-full">
        {quickLinks.map((link, index) => (
          <motion.div
            key={link.title}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 + index * 0.08 }}
          >
            <Link
              href={link.href}
              className="group relative flex flex-col gap-3 rounded-[16px] border border-[#efefef] bg-white p-5 transition-shadow hover:shadow-[0px_8px_24px_rgba(0,0,0,0.08)]"
            >
              <div className="flex items-center justify-between">
                <p className="text-[20px] lg:text-[24px] font-medium text-[#2b2b2b] tracking-[-0.72px]">
                  {link.title}
                </p>
                <span className="inline-flex size-9 items-center justify-center rounded-full bg-[#f5f3f2] text-[#3d3d3d] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5">
                  <ArrowUpRight className="size-4" />
                </span>
              </div>
              <p className="text-[16px] lg:text-[18px] leading-[1.6] tracking-[-0.24px] text-[#6f6f6f]">
                {link.description}
              </p>
            </Link>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

function GuidesSection() {
  const t = useTranslations("help");

  const guides = [
    {
      title: t("guides.gettingStarted.title"),
      items: [
        { label: t("guides.gettingStarted.completeProfile"), href: "/client/help/getting-started/complete-your-profile" },
        { label: t("guides.gettingStarted.addPayment"), href: "/client/help/getting-started/add-a-payment-method" },
        { label: t("guides.gettingStarted.exploreServices"), href: "/client/help/getting-started/explore-services" },
      ],
    },
    {
      title: t("guides.usingCredits.title"),
      items: [
        { label: t("guides.usingCredits.whereApply"), href: "/client/help/using-your-credits/where-credits-apply" },
        { label: t("guides.usingCredits.expiration"), href: "/client/help/using-your-credits/expiration-rules" },
        { label: t("guides.usingCredits.troubleshooting"), href: "/client/help/using-your-credits/troubleshooting" },
      ],
    },
    {
      title: t("guides.privacy.title"),
      items: [
        { label: t("guides.privacy.dataUsage"), href: "/client/help/privacy-and-security/data-usage" },
        { label: t("guides.privacy.securityTips"), href: "/client/help/privacy-and-security/account-security-tips" },
        { label: t("guides.privacy.twoFactor"), href: "/client/help/privacy-and-security/two-factor-support" },
      ],
    },
  ];

  return (
    <motion.div
      className="content-stretch flex flex-col gap-4 sm:gap-6 lg:gap-8 items-start relative shrink-0 w-full"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.35 }}
    >
      <p className="font-medium leading-[1.3] not-italic relative shrink-0 text-[28px] text-black tracking-[-1.12px] w-full">
        {t("guides.title")}
      </p>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 w-full">
        {guides.map((guide, index) => (
          <motion.div
            key={guide.title}
            className="rounded-[16px] border border-[#efefef] bg-white p-5"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.4 + index * 0.08 }}
          >
            <p className="text-[20px] lg:text-[24px] font-medium text-[#2b2b2b] tracking-[-0.72px]">
              {guide.title}
            </p>
            <ul className="mt-3 space-y-0 divide-y divide-[#f0f0f0]">
              {guide.items.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="group flex items-center justify-between py-3 text-[16px] lg:text-[18px] tracking-[-0.24px] text-[#6f6f6f] hover:text-[#2b2b2b] transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <span className="size-1.5 rounded-full bg-[#c1785d]" />
                      {item.label}
                    </span>
                    <ArrowUpRight className="size-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-[#c1785d]" />
                  </Link>
                </li>
              ))}
            </ul>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

function FAQSection() {
  const t = useTranslations("help");
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const FAQ_KEYS = ["resetPassword", "seeCredits", "referrals", "bookBloodTest", "labResults", "updateInfo", "updatePayment", "cancelReschedule", "dataPrivate", "contactSupport"] as const;
  const faqs = FAQ_KEYS.map(key => ({
    question: t(`faqs.${key}.question`),
    answer: t(`faqs.${key}.answer`),
  }));

  return (
    <motion.div
      className="content-stretch flex flex-col gap-4 sm:gap-6 lg:gap-8 items-start relative shrink-0 w-full"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.5 }}
    >
      <p className="font-medium leading-[1.3] not-italic relative shrink-0 text-[28px] text-black tracking-[-1.12px] w-full">
        {t("faqTitle")}
      </p>

      <div className="content-stretch flex flex-col items-start relative shrink-0 w-full">
        {faqs.map((faq, index) => (
          <motion.div
            key={faq.question}
            className="content-stretch flex flex-col items-start justify-center px-0 py-[24px] relative shrink-0 w-full cursor-pointer"
            onClick={() => setOpenIndex(openIndex === index ? null : index)}
            whileHover={{ backgroundColor: "rgba(0,0,0,0.01)" }}
          >
            <div
              aria-hidden="true"
              className="absolute border-[#dcdcdc] border-b border-solid inset-0 pointer-events-none"
            />

            <div className="content-stretch flex items-center justify-between relative shrink-0 w-full">
              <p className="font-medium leading-[1.3] text-[20px] text-black tracking-[-0.6px] flex-1">
                {faq.question}
              </p>
              <motion.div
                className="relative shrink-0 size-[40.333px] flex items-center justify-center"
                animate={{ rotate: openIndex === index ? 180 : 0 }}
                transition={{ duration: 0.3 }}
              >
                <svg className="size-full" fill="none" viewBox="0 0 40.3333 40.3333">
                  <rect
                    fill="rgba(0,0,0,0.04)"
                    height="40.3333"
                    rx="20.1667"
                    width="40.3333"
                  />
                  <path
                    d={openIndex === index ? "M12 20.165H28.3333" : svgPaths.plus}
                    stroke="black"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.75"
                  />
                </svg>
              </motion.div>
            </div>

            <AnimatePresence>
              {openIndex === index && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden w-full"
                >
                  <p className="font-normal leading-[1.6] mt-[24px] text-[16px] lg:text-[18px] tracking-[-0.24px] text-[rgba(0,0,0,0.55)]">
                    {faq.answer}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

export default function HelpPage() {
  const t = useTranslations("help");

  useEffect(() => {
    const handleScroll = () => {
      const scrollThreshold = 195;
      const isScrolled = window.scrollY > scrollThreshold;

      if (isScrolled) {
        document.documentElement.style.setProperty('--nav-text-color', '#000000');
        document.documentElement.style.setProperty('--nav-stroke-color', '#000000');
      } else {
        document.documentElement.style.setProperty('--nav-text-color', '#ffffff');
        document.documentElement.style.setProperty('--nav-stroke-color', '#ffffff');
      }
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Check initial state

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="bg-[#fbfbf9] relative min-h-screen overflow-x-hidden w-screen left-1/2 -translate-x-1/2 -mt-36 xl:-mt-32">
      <div className="absolute top-0 left-0 right-0 h-[220px] sm:h-[260px] lg:h-[320px] xl:h-[310px] overflow-hidden z-0">
        <div className="absolute inset-0 bg-gradient-to-b from-[#1f2a2e] to-[#a5b8b0]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.35),transparent_55%),radial-gradient(circle_at_80%_30%,rgba(255,255,255,0.2),transparent_45%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0.02)_40%,transparent_60%)]" />
      </div>

      <div className="relative z-10 w-full flex flex-col items-center px-4 sm:px-6 md:px-10 xl:px-20 pt-40 xl:pt-36 -mt-[130px]">
        <motion.div
          className="font-sofia-pro font-medium leading-[1.2] not-italic text-[34px] sm:text-[42px] lg:text-[48px] text-white mt-[160px] tracking-[-1.2px] sm:tracking-[-1.6px] lg:tracking-[-1.92px] w-full max-w-[1090px]"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <p className="mb-0">{t("heroTitle")}</p>
          <motion.p
            className="mt-3 sm:mt-4 text-[15px] lg:text-[18px] font-medium tracking-[-0.4px] text-[rgba(255,255,255,0.7)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
          >
            {t("heroSubtitle")}
          </motion.p>
        </motion.div>

        <div className="w-full max-w-[720px] mt-[20px] sm:mt-[72px] flex flex-col gap-8 sm:gap-12 lg:gap-[64px] pb-[80px] sm:pb-[100px]">
          <QuickLinksSection />
          <GuidesSection />
          <div className="mt-6 sm:mt-8 lg:mt-12 w-full">
            <FAQSection />
          </div>
        </div>
      </div>
    </div>
  );
}
