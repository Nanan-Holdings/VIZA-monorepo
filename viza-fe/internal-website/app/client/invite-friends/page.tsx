"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Copy, Mail, Gift, UserRound, ShoppingBag, Loader2 } from 'lucide-react';
import { InviteHistory } from '@/components/client/invite-history';
import { toast } from 'sonner';
import { useLocale, useTranslations } from "next-intl";
import { createClient } from '@/lib/supabase/client';
import { sendReferralInvite } from "@/app/actions/referrals";

// Stubs — referral system removed during domain migration
async function getReferralCode() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false as const, code: undefined };

  return { success: true as const, code: `VIZA-${user.id.toUpperCase()}` };
}
// SVG paths from Figma
const svgPaths = {
  p10c3c700: "M12 20.1667H28.3333M20.1667 12V28.3333",
};

function ReferralSection() {
  const t = useTranslations("inviteFriends");
  const locale = useLocale();
  const [copied, setCopied] = useState(false);
  const [email, setEmail] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [loadingLink, setLoadingLink] = useState(true);
  const [sendingInvite, setSendingInvite] = useState(false);

  // Load referral code on mount
  useEffect(() => {
    async function loadCode() {
      const result = await getReferralCode();
      if (result.success && result.code) {
        setReferralCode(result.code);
      }
      setLoadingLink(false);
    }
    loadCode();
  }, []);

  const handleCopyCode = () => {
    if (!referralCode) return;
    navigator.clipboard.writeText(referralCode);
    setCopied(true);
    toast.success(t("codeCopiedToast"));
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendInvite = async () => {
    if (!email) return;

    setSendingInvite(true);
    const result = await sendReferralInvite(email, referralCode, locale);
    setSendingInvite(false);

    if (result.success) {
      toast.success(t("inviteSentToast", { email }));
      setEmail('');
    } else {
      toast.error(t(`errors.${result.error}`));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSendInvite();
    }
  };

  return (
    <motion.div
      className="invite-friends-shell content-stretch flex flex-col gap-8 sm:gap-12 lg:gap-[64px] items-start relative shrink-0 w-full"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.2 }}
    >
      <div className="content-stretch flex flex-col gap-[8px] items-start relative shrink-0 w-full">
        <p className="font-medium leading-[1.3] relative shrink-0 text-[28px] text-black tracking-[-1.12px] w-full">
          {t("referHeading")}
        </p>
        <p className="font-medium leading-[1.5] not-italic relative shrink-0 text-[#989898] text-[16px] tracking-[-0.24px] w-full">
          {t("referDescription")}
        </p>
      </div>

      <div className="content-stretch flex flex-col gap-[16px] items-end justify-end relative shrink-0 w-full">
        <div className="relative shrink-0 w-full">
          <p className="font-medium leading-[1.5] not-italic pl-[8px] text-[#989898] text-[16px] tracking-[-0.24px]">
            {t("referralCode")}
          </p>
        </div>

        <motion.div
          className="relative rounded-[12px] shrink-0 w-full bg-white"
          whileHover={{ scale: 1.01 }}
          transition={{ duration: 0.2 }}
        >
          <div aria-hidden="true" className="absolute border border-[#efefef] border-solid inset-0 pointer-events-none rounded-[12px]" />
          <div className="flex flex-row items-center size-full">
            <div className="content-stretch flex flex-col items-start justify-between gap-2 px-[16px] py-[16px] sm:flex-row sm:items-center sm:px-[24px] sm:py-[20px] relative w-full">
              {loadingLink ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-[#989898]" />
                  <span className="text-[14px] text-[#989898]">{t("loadingLink")}</span>
                </div>
              ) : (
                <p className="font-heading font-semibold leading-[1.15] not-italic relative min-w-0 max-w-full text-[26px] text-[#03346E] tracking-normal break-all sm:text-[32px]">
                  {referralCode}
                </p>
              )}
              <motion.button
                onClick={handleCopyCode}
                disabled={loadingLink || !referralCode}
                className="content-stretch flex min-h-11 gap-[8px] items-center relative shrink-0 cursor-pointer rounded-full bg-brand-50 px-4 text-brand-500 border-0 disabled:opacity-50"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <p className="font-medium leading-[1.5] not-italic relative shrink-0 text-[16px] tracking-normal">
                  {copied ? t("copied") : t("copyCode")}
                </p>
                <Copy className="size-[16px]" />
              </motion.button>
            </div>
          </div>
        </motion.div>

        <div className="grid w-full gap-3 rounded-[12px] border border-brand-100 bg-brand-50/70 p-4 sm:grid-cols-2">
          <div>
            <p className="text-[13px] font-semibold uppercase tracking-normal text-brand-500">
              {t("rewardForYouLabel")}
            </p>
            <p className="mt-1 text-[24px] font-semibold text-brand-900">{t("pointsAmount")}</p>
          </div>
          <div>
            <p className="text-[13px] font-semibold uppercase tracking-normal text-brand-500">
              {t("rewardForFriendLabel")}
            </p>
            <p className="mt-1 text-[24px] font-semibold text-brand-900">{t("pointsAmount")}</p>
          </div>
        </div>

        <div className="relative shrink-0 w-full">
          <p className="font-medium leading-[1.5] not-italic pl-[8px] text-[#989898] text-[16px] tracking-[-0.24px]">
            {t("orInviteViaEmail")}
          </p>
        </div>

        <div className="content-stretch flex flex-col gap-[16px] items-end relative shrink-0 w-full">
          <motion.div
            className="relative rounded-[12px] shrink-0 w-full"
            whileFocus={{ scale: 1.01 }}
          >
            <div aria-hidden="true" className="absolute border border-[#efefef] border-solid inset-0 pointer-events-none rounded-[12px]" />
            <div className="flex flex-row items-center size-full">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t("emailPlaceholder")}
                disabled={sendingInvite}
                className="font-normal leading-[1.3] px-[16px] py-[16px] sm:px-[24px] sm:py-[20px] w-full bg-transparent border-0 outline-none text-[16px] text-black tracking-[-0.48px] disabled:opacity-60"
              />
            </div>
          </motion.div>

          <motion.button
            onClick={handleSendInvite}
            disabled={sendingInvite || !email}
            className="bg-[#03346E] content-stretch flex gap-[8px] items-center justify-center px-[24px] py-[12px] relative rounded-[999px] shrink-0 cursor-pointer border-0 disabled:opacity-60 disabled:cursor-not-allowed"
            whileHover={!sendingInvite && email ? { scale: 1.05, backgroundColor: '#022B5C' } : {}}
            whileTap={!sendingInvite && email ? { scale: 0.95 } : {}}
            transition={{ duration: 0.2 }}
          >
            {sendingInvite ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-white" />
                <p className="font-medium leading-[1.5] not-italic relative shrink-0 text-[16px] text-white tracking-[-0.24px]">
                  {t("sending")}
                </p>
              </span>
            ) : (
              <p className="font-medium leading-[1.5] not-italic relative shrink-0 text-[16px] text-white tracking-[-0.24px]">
                {t("sendInvite")}
              </p>
            )}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

function HowItWorks() {
  const t = useTranslations("inviteFriends");
  const steps = [
    {
      icon: Mail,
      title: t("steps.share.title"),
      description: t("steps.share.description")
    },
    {
      icon: Gift,
      title: t("steps.give.title"),
      description: t("steps.give.description")
    },
    {
      icon: UserRound,
      title: t("steps.earn.title"),
      description: t("steps.earn.description")
    },
    {
      icon: ShoppingBag,
      title: t("steps.redeem.title"),
      description: t("steps.redeem.description")
    }
  ];

  return (
    <motion.div
      className="invite-friends-shell content-stretch flex flex-col gap-4 sm:gap-6 lg:gap-8 items-start relative shrink-0 w-full"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.4 }}
    >
      <p className="font-medium leading-[1.3] not-italic relative shrink-0 text-[28px] text-black tracking-[-1.12px] w-full">
        {t("howItWorks")}
      </p>

      <div className="content-stretch flex flex-col gap-4 sm:gap-[24px] items-start relative shrink-0 max-w-[584px]">
        {steps.map((step, index) => (
          <motion.div
            key={index}
            className="content-stretch flex gap-[24px] items-start relative shrink-0 w-full"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.5 + index * 0.1 }}
            whileHover={{ x: 5 }}
          >
            <step.icon className="relative shrink-0 size-[32px] text-[#03346E]" strokeWidth={2} />
            <div className="content-stretch flex flex-[1_0_0] flex-col font-medium gap-[8px] items-start min-h-px min-w-px not-italic relative">
              <p className="leading-[1.3] relative shrink-0 text-[#3d3d3d] text-[20px] tracking-[-0.6px]">
                {step.title}
              </p>
              <p className="leading-[1.5] relative text-[#989898] text-[16px] tracking-[-0.24px] w-full">
                {step.description}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

function FAQ() {
  const t = useTranslations("inviteFriends");
  const [openIndex, setOpenIndex] = useState<number | null>(2);

  const FAQ_KEYS = ["whenReward", "howUseCredit", "whoEligible"] as const;
  const faqs = FAQ_KEYS.map(key => ({
    question: t(`faqs.${key}.question`),
    answer: t(`faqs.${key}.answer`),
  }));

  return (
    <motion.div
      className="invite-friends-shell content-stretch flex flex-col gap-4 sm:gap-6 lg:gap-8 items-start relative shrink-0 w-full"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.6 }}
    >
      <p className="font-medium leading-[1.3] not-italic relative shrink-0 text-[28px] text-black tracking-[-1.12px] w-full">
        {t("faqTitle")}
      </p>

      <div className="content-stretch flex flex-col items-start relative shrink-0 w-full">
        {faqs.map((faq, index) => (
          <motion.div
            key={index}
            className="content-stretch flex flex-col items-start justify-center px-0 py-[24px] relative shrink-0 w-full cursor-pointer"
            onClick={() => setOpenIndex(openIndex === index ? null : index)}
            whileHover={{ backgroundColor: 'rgba(0,0,0,0.01)' }}
          >
            <div aria-hidden="true" className="absolute border-[#dcdcdc] border-b border-solid inset-0 pointer-events-none" />

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
                  <rect fill="rgba(0,0,0,0.04)" height="40.3333" rx="20.1667" width="40.3333" />
                  <path
                    d={openIndex === index ? "M12 20.165H28.3333" : svgPaths.p10c3c700}
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
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden w-full"
                >
                  <p className="font-normal leading-[1.6] mt-[24px] text-[16px] text-[rgba(0,0,0,0.55)]">
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

export default function InviteFriendsPage() {
  const t = useTranslations("inviteFriends");

  useEffect(() => {
    const handleScroll = () => {
      // Background height is 300px, detect when scrolled past it
      const scrollThreshold = 270;
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
    <div className="bg-[#fcfcfc] relative min-h-screen overflow-x-hidden w-screen left-1/2 -translate-x-1/2 -mt-36 xl:-mt-32">
      {/* Hero Background - matches home page pattern */}
      <div className="absolute top-0 left-0 right-0 h-[275px] sm:h-[260px] lg:h-[320px] xl:h-[310px] overflow-hidden z-0">
        <div className="absolute inset-0 bg-gradient-to-b from-[#03346E] to-[#3D6DAD]" />
        <div className="absolute inset-0 bg-[rgba(0,0,0,0.03)] mix-blend-hard-light" />
        <motion.div
          className="absolute h-[496px] left-1/2 -translate-x-1/2 top-[52px] w-[744px]"
          animate={{
            y: [0, -10, 0],
            scale: [1, 1.02, 1]
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        >
          <img
            alt=""
            className="w-full h-full object-cover"
            src="/images/invite-friends/hero-globe.png"
          />
        </motion.div>
      </div>

      {/* Content Container */}
      <div className="relative z-10 w-full flex flex-col items-center px-4 sm:px-6 md:px-10 xl:px-20 pt-36 xl:pt-32 -mt-[130px]">
        {/* Hero Title */}
        <motion.div
          className="font-heading font-medium leading-[1.2] not-italic text-[34px] sm:text-[42px] lg:text-[48px] text-white mt-[147px] tracking-[-1.2px] sm:tracking-[-1.6px] lg:tracking-[-1.92px] w-full max-w-[1090px]"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <p className="mb-0">{t("heroTitle")}</p>
          <motion.p
            className="mt-3 sm:mt-4 text-[rgba(255,255,255,0.65)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
          >
            {t("heroSubtitle")}
          </motion.p>
        </motion.div>

        {/* Content Sections */}
        <div className="w-full max-w-[648px] mt-[48px] sm:mt-[72px] flex flex-col gap-8 sm:gap-12 lg:gap-[64px] pb-[80px] sm:pb-[100px]">
          <ReferralSection />

          {/* Invite History - shows between referral section and how it works */}
          <InviteHistory />

          <HowItWorks />

          <div className="mt-6 sm:mt-8 lg:mt-12 w-full">
            <FAQ />
          </div>
        </div>
      </div>
    </div>
  );
}
