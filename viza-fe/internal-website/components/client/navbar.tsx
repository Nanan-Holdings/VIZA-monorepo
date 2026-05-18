"use client";

import Link from "next/link";
import Image from "next/image";
import { MotionConfig, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { MessageCircle, Plane } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AnimatedMenu } from "@/components/client/animated-menu";
import { LanguageSelector } from "@/components/client/language-selector";
import { useTranslations } from "next-intl";
import clsx from "clsx";
import { useEffect, useState } from "react";
import { svgPaths } from "@/components/client/constants";

interface NavBarProps {
  activeTab: string | null;
  setActiveTab: (tab: string) => void;
  onLogout: () => Promise<void>;
  isLoggingOut: boolean;
  menuReady: boolean;
}

const tabs = ["Home", "Application", "Chat", "Documents"];

const tabPaths: Record<string, string> = {
  Home: "/client/home",
  Application: "/client/application",
  Chat: "/client/chat?agent=visa",
  Documents: "/client/documents",
  Settings: "/client/settings",
};

const chatAgentOptions = [
  {
    id: "visa",
    labelKey: "visaConsultant",
    href: "/client/chat?agent=visa",
    icon: MessageCircle,
  },
  {
    id: "travel",
    labelKey: "travelAgent",
    href: "/client/chat?agent=travel",
    icon: Plane,
  },
] as const;

export function NavBar({
  activeTab,
  setActiveTab,
  onLogout,
  isLoggingOut,
  menuReady,
}: NavBarProps) {
  const router = useRouter();
  const t = useTranslations("nav");
  const [navColor, setNavColor] = useState<string>("#000000");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [chatMenuOpen, setChatMenuOpen] = useState(false);
  const [mobileChatMenuOpen, setMobileChatMenuOpen] = useState(false);
  const transitionDuration = 0.6;

  const tabLabels: Record<string, string> = {
    Home: t("home"),
    Application: t("application"),
    Chat: t("chat"),
    Documents: t("documents"),
  };

  useEffect(() => {
    const readCssVar = (name: string, fallback: string) => {
      const value = getComputedStyle(document.documentElement)
        .getPropertyValue(name)
        .trim();
      return value || fallback;
    };

    const syncNavColors = () => {
      const nextNavColor = readCssVar("--nav-text-color", "#000000");
      setNavColor((prev) => (prev === nextNavColor ? prev : nextNavColor));
    };

    syncNavColors();

    const observer = new MutationObserver(syncNavColors);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["style"],
    });

    window.addEventListener("scroll", syncNavColors, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", syncNavColors);
    };
  }, []);

  const isDark = navColor.toLowerCase().startsWith("#fff") || navColor.toLowerCase().includes("255");

  // 鈹€鈹€ Logo size controls 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
  const LOGO_DARK_DESKTOP  = { w: 144, h: 27 };  // dark logo, desktop
  const LOGO_WHITE_DESKTOP = { w: 144, h: 27 };  // white logo, desktop
  const LOGO_DARK_MOBILE   = { w: 117, h: 23 };  // dark logo, mobile
  const LOGO_WHITE_MOBILE  = { w: 117, h: 23 };  // white logo, mobile
  // 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

  const activeTabColor = isDark ? "#FFFFFF" : "#03346E";
  const inactiveColor = isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)";

  const leftTabs = ["Home", "Application"];
  const rightTabs = ["Chat", "Documents"];

  const openChatAgent = (href: string) => {
    setActiveTab("Chat");
    setChatMenuOpen(false);
    setMobileChatMenuOpen(false);
    router.push(href);
  };

  const renderChatAgentMenu = () => (
    <div className="w-[210px] rounded-2xl border border-[#dbe4f0] bg-white p-2 shadow-[0_18px_45px_rgba(3,52,110,0.18)]">
      {chatAgentOptions.map((option) => {
        const Icon = option.icon;
        return (
          <button
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left font-switzer text-sm font-medium text-[#03346E] transition-colors hover:bg-[#eef5ff]"
            key={option.id}
            onClick={() => openChatAgent(option.href)}
            type="button"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#03346E]/10 text-[#03346E]">
              <Icon className="h-4 w-4" />
            </span>
            <span>{t(option.labelKey)}</span>
          </button>
        );
      })}
    </div>
  );

  const renderTab = (tab: string) => {
    const isActive = activeTab === tab;

    if (tab === "Chat") {
      return (
        <Popover key={tab} open={chatMenuOpen} onOpenChange={setChatMenuOpen}>
          <PopoverTrigger asChild>
            <motion.button
              className="px-5 py-1.5 font-switzer font-medium text-lg whitespace-nowrap transition-colors duration-300"
              type="button"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <motion.span
                className="relative transition-colors duration-600"
                style={{ color: isActive ? activeTabColor : inactiveColor }}
              >
                {tabLabels[tab] ?? tab}
              </motion.span>
            </motion.button>
          </PopoverTrigger>
          <PopoverContent
            align="center"
            className="w-auto border-0 bg-transparent p-0 shadow-none"
            sideOffset={10}
          >
            {renderChatAgentMenu()}
          </PopoverContent>
        </Popover>
      );
    }

    return (
      <motion.button
        key={tab}
        onClick={() => {
          setActiveTab(tab);
          const path = tabPaths[tab];
          if (path) router.push(path);
        }}
        className="px-5 py-1.5 font-switzer font-medium text-lg whitespace-nowrap transition-colors duration-300"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <motion.span
          className="relative transition-colors duration-600"
          style={{ color: isActive ? activeTabColor : inactiveColor }}
        >
          {tabLabels[tab] ?? tab}
        </motion.span>
      </motion.button>
    );
  };

  // Desktop header
  const DesktopHeader = () => (
    <motion.header
      className="client-navbar hidden xl:block backdrop-blur backdrop-filter w-full fixed top-0 left-0 z-50"
    >
      <div className="mx-auto w-full px-4 sm:px-6 md:px-10 xl:px-20 py-4 md:py-7">
        <div className="flex items-center justify-between">
          {/* Far left: Hamburger */}
          <div className="shrink-0">
            {menuReady ? (
              <Popover>
                <PopoverTrigger asChild>
                  <motion.button
                    className="p-2.5 cursor-pointer rounded-md"
                    type="button"
                    whileHover={{ scale: 1.1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  >
                    <svg className="w-8 h-8" viewBox="0 0 32 32" fill="none">
                      <motion.path
                        d={svgPaths.p2cedaac0}
                        style={{ stroke: "var(--nav-stroke-color)" }}
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                  </motion.button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  className="w-auto p-0 border-0 bg-transparent shadow-none"
                >
                  <AnimatedMenu
                    onLogout={onLogout}
                    isLoggingOut={isLoggingOut}
                    showInviteFriends
                  />
                </PopoverContent>
              </Popover>
            ) : (
              <motion.button
                className="p-2.5 cursor-pointer rounded-md transition-all"
                type="button"
                animate={{ opacity: 1 }}
                transition={{ duration: transitionDuration, ease: "easeInOut" }}
              >
                <svg className="w-8 h-8" viewBox="0 0 32 32" fill="none">
                  <motion.path
                    d={svgPaths.p2cedaac0}
                    style={{ stroke: "var(--nav-stroke-color)" }}
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </motion.button>
            )}
          </div>

          {/* Center block: Left tabs + Logo + Right tabs */}
          <motion.div
            className="flex items-center gap-1"
            animate={{ opacity: 1 }}
            transition={{ duration: 1.3 }}
          >
            {leftTabs.map(renderTab)}

            {/* Logo */}
            <Link
              href="/client/home"
              className="block transition-transform duration-200 ml-3 pr-[16px]"
            >
              <Image
                src={isDark ? "/logo/viza-logo-white.svg" : "/logo/viza-logo-black.svg"}
                alt="VIZA"
                width={isDark ? LOGO_WHITE_DESKTOP.w : LOGO_DARK_DESKTOP.w}
                height={isDark ? LOGO_WHITE_DESKTOP.h : LOGO_DARK_DESKTOP.h}
                style={{ width: isDark ? LOGO_WHITE_DESKTOP.w : LOGO_DARK_DESKTOP.w, height: isDark ? LOGO_WHITE_DESKTOP.h : LOGO_DARK_DESKTOP.h }}
                className="object-contain"
                priority
              />
            </Link>

            {rightTabs.map(renderTab)}
          </motion.div>

          {/* Far right: Globe */}
          <div className="shrink-0">
            <LanguageSelector size="desktop" />
          </div>
        </div>
      </div>
    </motion.header>
  );

  // Mobile header - logo + hamburger top row, scrollable tab pills below
  const MobileHeader = () => (
    <motion.header
      className="client-navbar xl:hidden backdrop-blur backdrop-filter w-full fixed top-0 left-0 z-50"
    >
      <div className="flex flex-col pt-3 gap-4">
        {/* Row 1: Logo + Hamburger */}
        <div className="px-4 flex items-center justify-between">
          {/* Logo - sized to ~160脳30px per Figma spec */}
          <Link href="/client/data">
            <Image
              src={isDark ? "/logo/viza-logo-white.svg" : "/logo/viza-logo-black.svg"}
              alt="VIZA"
              width={isDark ? LOGO_WHITE_MOBILE.w : LOGO_DARK_MOBILE.w}
              height={isDark ? LOGO_WHITE_MOBILE.h : LOGO_DARK_MOBILE.h}
              style={{ width: isDark ? LOGO_WHITE_MOBILE.w : LOGO_DARK_MOBILE.w, height: isDark ? LOGO_WHITE_MOBILE.h : LOGO_DARK_MOBILE.h }}
              className="object-contain object-left"
              priority
            />
          </Link>

          {/* Language Selector + Hamburger Menu */}
          <div className="flex items-center gap-1">
            <LanguageSelector size="mobile" />

            {/* Hamburger Menu */}
            {menuReady ? (
              <Popover open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <PopoverTrigger asChild>
                  <motion.button
                    className="w-9 h-9 flex items-center justify-center cursor-pointer"
                    type="button"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 32 32" fill="none">
                      <motion.path
                        d={svgPaths.p2cedaac0}
                        style={{ stroke: "var(--nav-stroke-color)" }}
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                  </motion.button>
                </PopoverTrigger>
                <PopoverContent
                  align="end"
                  className="w-auto p-0 border-0 bg-transparent shadow-none"
                >
                  <AnimatedMenu
                    onLogout={onLogout}
                    isLoggingOut={isLoggingOut}
                    showInviteFriends
                    onClose={() => setMobileMenuOpen(false)}
                  />
                </PopoverContent>
              </Popover>
            ) : (
              <motion.button
                className="w-9 h-9 flex items-center justify-center"
                type="button"
              >
                <svg className="w-5 h-5" viewBox="0 0 32 32" fill="none">
                  <motion.path
                    d={svgPaths.p2cedaac0}
                    style={{ stroke: "var(--nav-stroke-color)" }}
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </motion.button>
            )}
          </div>
        </div>

        {/* Row 2: Scrollable tab pills */}
        <div className="overflow-x-auto pb-3">
          <div className="flex gap-[8px] pl-4">
            {tabs.map((tab) => {
              const isActive = activeTab === tab;
              if (tab === "Chat") {
                return (
                  <Popover
                    key={tab}
                    open={mobileChatMenuOpen}
                    onOpenChange={setMobileChatMenuOpen}
                  >
                    <PopoverTrigger asChild>
                      <button
                        className={clsx(
                          "px-[16px] py-[6px] rounded-full text-[16px] leading-[1.6] font-medium whitespace-nowrap shrink-0 transition-colors duration-200 border border-solid",
                          isActive
                            ? "bg-transparent border-transparent text-[#03346E]"
                            : isDark
                              ? "bg-transparent border-[rgba(255,255,255,0.3)] text-[rgba(255,255,255,0.6)]"
                              : "bg-white border-[#ececec] text-black"
                        )}
                        type="button"
                      >
                        {tabLabels[tab] ?? tab}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="start"
                      className="w-auto border-0 bg-transparent p-0 shadow-none"
                      sideOffset={8}
                    >
                      {renderChatAgentMenu()}
                    </PopoverContent>
                  </Popover>
                );
              }

              return (
                <button
                  key={tab}
                  onClick={() => {
                    setActiveTab(tab);
                    const path = tabPaths[tab];
                    if (path) router.push(path);
                  }}
                  className={clsx(
                    "px-[16px] py-[6px] rounded-full text-[16px] leading-[1.6] font-medium whitespace-nowrap shrink-0 transition-colors duration-200 border border-solid",
                    isActive
                      ? "bg-transparent border-transparent text-[#03346E]"
                      : isDark
                        ? "bg-transparent border-[rgba(255,255,255,0.3)] text-[rgba(255,255,255,0.6)]"
                        : "bg-white border-[#ececec] text-black"
                  )}
                >
                  {tabLabels[tab] ?? tab}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </motion.header>
  );

  return (
    <MotionConfig reducedMotion="never">
      <DesktopHeader />
      <MobileHeader />
    </MotionConfig>
  );
}
