"use client";

import Link from "next/link";
import Image from "next/image";
import { MotionConfig, motion } from "motion/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Airplane as Plane, CaretDown as ChevronDown, ChatCircle as MessageCircle, Check, CircleNotch as Loader2, List, Microphone as Mic } from "@phosphor-icons/react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AnimatedMenu } from "@/components/client/animated-menu";
import { LanguageSelector } from "@/components/client/language-selector";
import { AnimatedTabPill } from "@/components/ui/animated-tab-pill";
import { NavDropdown, type NavDropdownItem } from "@/components/client/nav-dropdown";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import {
  buildApplicationFormHref,
  getRecentApplicationFormHref,
  readApplicationFormTarget,
  RECENT_APPLICATION_FORM_EVENT,
  RECENT_APPLICATION_FORM_STORAGE_KEY,
  type ApplicationFormTarget,
} from "@/lib/client/recent-application-form";

interface NavBarProps {
  activeTab: string | null;
  setActiveTab: (tab: string) => void;
  onLogout: () => Promise<void>;
  isLoggingOut: boolean;
  menuReady: boolean;
}

const tabPaths: Record<string, string> = {
  Home: "/client/home",
  Application: "/client/application",
  Status: "/client/status",
  Chat: "/client/chat?agent=visa",
  Documents: "/client/documents",
  Support: "/client/help",
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
  {
    id: "interview",
    labelKey: "mockInterview",
    href: "/client/interview-practice",
    icon: Mic,
  },
] as const;

type LiveSaveStatus = "idle" | "saving" | "saved";

const LIVE_SAVE_STATUS_EVENT = "viza:live-save-status";
function LiveSaveStatusIcon({
  color,
  size,
  status,
}: {
  color: string;
  size: "desktop" | "mobile";
  status: LiveSaveStatus;
}) {
  const t = useTranslations("nav");
  const isSaving = status === "saving";
  const label = t(isSaving ? "saving" : "saved");

  return (
    <div
      aria-atomic="true"
      aria-label={label}
      aria-live="polite"
      className={cn(
        "flex shrink-0 items-center justify-center gap-1.5 font-sans font-medium",
        size === "desktop" ? "h-8 text-[13px]" : "h-7 text-xs",
        "transition-colors duration-[600ms] ease-in-out",
      )}
      role="status"
      style={{ color }}
    >
      {isSaving ? (
        <Loader2
          aria-hidden="true"
          className={cn(
            "animate-spin motion-reduce:animate-none",
            size === "desktop" ? "h-5 w-5" : "h-[18px] w-[18px]",
          )}
        />
      ) : (
        <Check
          aria-hidden="true"
          className={cn(
            size === "desktop" ? "h-5 w-5" : "h-[18px] w-[18px]",
          )}
        />
      )}
      <span className="whitespace-nowrap">{label}</span>
    </div>
  );
}

function hasApplicationIdentity(target: ApplicationFormTarget | null): target is ApplicationFormTarget {
  return Boolean(target?.applicationId || (target?.country && target?.visaType));
}

export function NavBar({
  activeTab,
  setActiveTab,
  onLogout,
  isLoggingOut,
  menuReady,
}: NavBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations("nav");
  const [navColor, setNavColor] = useState<string>("#000000");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [chatMenuOpen, setChatMenuOpen] = useState(false);
  const [mobileChatMenuOpen, setMobileChatMenuOpen] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
  const [liveSaveStatus, setLiveSaveStatus] = useState<LiveSaveStatus>("idle");
  const [recentApplicationHref, setRecentApplicationHref] = useState<string | null>(null);
  const transitionDuration = 0.6;
  const showLiveSaveStatus =
    pathname === "/client/application" ||
    pathname.startsWith("/client/application/") ||
    pathname === "/client/universal-info" ||
    pathname.startsWith("/client/universal-info/");

  const tabLabels: Record<string, string> = {
    Home: t("home"),
    Application: t("application"),
    Status: t("status"),
    Chat: t("chat"),
    Documents: t("documents"),
    Support: t("support"),
    Settings: t("settings"),
  };

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    const handleLiveSaveStatus = (event: Event) => {
      const nextStatus = (event as CustomEvent<{ status?: LiveSaveStatus }>).detail?.status;
      if (nextStatus === "idle" || nextStatus === "saving" || nextStatus === "saved") {
        setLiveSaveStatus(nextStatus);
      }
    };

    window.addEventListener(LIVE_SAVE_STATUS_EVENT, handleLiveSaveStatus);
    return () => window.removeEventListener(LIVE_SAVE_STATUS_EVENT, handleLiveSaveStatus);
  }, []);

  useEffect(() => {
    const syncRecentApplicationHref = () => {
      setRecentApplicationHref(getRecentApplicationFormHref());
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key === RECENT_APPLICATION_FORM_STORAGE_KEY) {
        syncRecentApplicationHref();
      }
    };

    syncRecentApplicationHref();

    window.addEventListener(RECENT_APPLICATION_FORM_EVENT, syncRecentApplicationHref);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(RECENT_APPLICATION_FORM_EVENT, syncRecentApplicationHref);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

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

  const LOGO_DARK_DESKTOP  = { w: 144, h: 27 };
  const LOGO_WHITE_DESKTOP = { w: 144, h: 27 };
  const LOGO_DARK_MOBILE   = { w: 117, h: 23 };
  const LOGO_WHITE_MOBILE  = { w: 117, h: 23 };

  // Status and Help are reached through the account menu, not top-level tabs.
  const leftTabs = ["Home", "Application"];
  const rightTabs = ["Settings"];
  const mobileTabs = ["Home", "Application", "Settings"];

  const currentApplicationTarget = useMemo(() => {
    const currentFormTarget = readApplicationFormTarget(
      buildApplicationFormHref(pathname, searchParams.toString()),
    );
    if (hasApplicationIdentity(currentFormTarget)) return currentFormTarget;

    const applicationPageTarget = readApplicationFormTarget(
      `/client/application/long-form?${searchParams.toString()}`,
    );
    if (pathname.startsWith("/client/application") && hasApplicationIdentity(applicationPageTarget)) {
      return applicationPageTarget;
    }

    const recentTarget = readApplicationFormTarget(recentApplicationHref);
    return hasApplicationIdentity(recentTarget) ? recentTarget : null;
  }, [pathname, recentApplicationHref, searchParams]);

  const applicationMenuHref = currentApplicationTarget?.href ?? "/client/application";

  const activeTabColor = isDark ? "#FFFFFF" : "#03346E";
  const inactiveColor = isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)";
  const liveSaveColor = isDark
    ? "#FFFFFF"
    : liveSaveStatus === "saving"
      ? activeTabColor
      : "#000000";

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (tab === "Application") {
      router.push(applicationMenuHref);
      return;
    }

    const path = tabPaths[tab];
    if (path) router.push(path);
  };

  const openChatAgent = (href: string) => {
    setActiveTab("Chat");
    setChatMenuOpen(false);
    setMobileChatMenuOpen(false);
    router.push(href);
  };

  const openChatAgentById = (id: string) => {
    const option = chatAgentOptions.find((item) => item.id === id);
    if (option) openChatAgent(option.href);
  };

  const toItems = (ids: string[]) =>
    ids.map((id) => ({ id, label: tabLabels[id] ?? id }));

  const renderStandaloneChatTab = (isMobile: boolean = false) => {
    const isActive = activeTab === "Chat";
    const setOpenDropdown = isMobile ? setMobileChatMenuOpen : setChatMenuOpen;
    const openDropdown = isMobile ? mobileChatMenuOpen : chatMenuOpen;
    const chatAgentItems: NavDropdownItem[] = chatAgentOptions.map((option) => ({
      id: option.id,
      icon: option.icon,
      label: t(option.labelKey),
      selected:
        (option.id === "visa" && pathname === "/client/chat" && searchParams.get("agent") !== "travel") ||
        (option.id === "travel" && pathname === "/client/chat" && searchParams.get("agent") === "travel") ||
        (option.id === "interview" && pathname.startsWith("/client/interview-practice")),
      tone: "default",
    }));

    if (!hasMounted) {
      return (
        <motion.button
          onClick={() => openChatAgent(tabPaths.Chat)}
          className={cn(
            "font-switzer font-medium whitespace-nowrap transition-colors duration-300",
            isMobile 
              ? "px-4 py-1.5 text-base rounded-full border border-solid bg-white border-[#ececec] text-black" 
              : "px-5 py-1.5 text-lg"
          )}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          type="button"
        >
          <motion.span style={{ color: isActive ? activeTabColor : inactiveColor }}>
            {t("chat")}
          </motion.span>
        </motion.button>
      );
    }

    return (
      <NavDropdown
        align={isMobile ? "start" : "center"}
        items={chatAgentItems}
        onOpenChange={setOpenDropdown}
        onSelect={openChatAgentById}
        open={openDropdown}
        widthClassName="w-64 max-w-[calc(100vw-2rem)]"
        trigger={
          <motion.button
            className={cn(
              "font-switzer font-medium whitespace-nowrap transition-all duration-300 cursor-pointer text-ellipsis overflow-hidden inline-flex items-center gap-1.5",
              isMobile
                ? cn(
                    "px-4 py-1.5 text-base rounded-full border border-solid",
                    isActive
                      ? "bg-transparent border-transparent text-[#03346E]"
                      : isDark
                        ? "bg-transparent border-[rgba(255,255,255,0.3)] text-[rgba(255,255,255,0.6)]"
                        : "bg-white border-[#ececec] text-black"
                  )
                : "px-5 py-1.5 text-lg"
            )}
            type="button"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <motion.span
              className="relative transition-colors duration-600"
              style={isMobile ? undefined : { color: isActive ? activeTabColor : inactiveColor }}
            >
              {t("chat")}
            </motion.span>
            <ChevronDown
              className={cn("h-4 w-4 shrink-0 transition-transform duration-200", openDropdown && "rotate-180")}
              style={isMobile ? undefined : { color: isActive ? activeTabColor : inactiveColor }}
            />
          </motion.button>
        }
      />
    );
  };

  // Desktop Header
  const DesktopHeader = () => (
    <motion.header
      className="client-navbar hidden xl:block backdrop-blur backdrop-filter w-full fixed top-0 left-0 z-50"
    >
      <div className="mx-auto w-full px-4 sm:px-6 md:px-10 xl:px-20 py-4 md:py-7">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center">
          {/* Hamburger */}
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
                    <List className="size-8" style={{ color: "var(--nav-stroke-color)" }} />
                  </motion.button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-auto p-0 border-0 bg-transparent shadow-none">
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
                <List className="size-8" style={{ color: "var(--nav-stroke-color)" }} />
              </motion.button>
            )}
          </div>

          {/* Center links */}
          <motion.div className="flex items-center gap-1" animate={{ opacity: 1 }} transition={{ duration: 1.3 }}>
            <AnimatedTabPill tabs={toItems(leftTabs)} activeTab={activeTab} onTabChange={handleTabChange} isDark={isDark} />

            {/* Logo */}
            <Link href="/client/home" className="block transition-transform duration-200 ml-3 pr-[16px]">
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

            {/* Chat Trigger Popover */}
            {renderStandaloneChatTab(false)}

            <AnimatedTabPill tabs={toItems(rightTabs)} activeTab={activeTab} onTabChange={handleTabChange} isDark={isDark} />
          </motion.div>

          {/* Live save status and language */}
          <div className="flex shrink-0 items-center justify-self-end gap-2">
            {showLiveSaveStatus && liveSaveStatus !== "idle" && (
              <LiveSaveStatusIcon color={liveSaveColor} size="desktop" status={liveSaveStatus} />
            )}
            <LanguageSelector size="desktop" />
          </div>
        </div>
      </div>
    </motion.header>
  );

  // Mobile Header
  const MobileHeader = () => (
    <motion.header
      className="client-navbar xl:hidden backdrop-blur backdrop-filter w-full fixed top-0 left-0 z-50"
    >
      <div className="flex flex-col pt-3 gap-4">
        <div className="px-4 flex items-center justify-between">
          <Link href="/client/home">
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

          <div className="flex items-center gap-1">
            {showLiveSaveStatus && liveSaveStatus !== "idle" && (
              <LiveSaveStatusIcon color={liveSaveColor} size="mobile" status={liveSaveStatus} />
            )}
            <LanguageSelector size="mobile" />
            {menuReady ? (
              <Popover open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <PopoverTrigger asChild>
                  <motion.button className="w-9 h-9 flex items-center justify-center cursor-pointer" type="button">
                    <List className="size-5" style={{ color: "var(--nav-stroke-color)" }} />
                  </motion.button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-auto p-0 border-0 bg-transparent shadow-none">
                  <AnimatedMenu
                    onLogout={onLogout}
                    isLoggingOut={isLoggingOut}
                    showInviteFriends
                    onClose={() => setMobileMenuOpen(false)}
                  />
                </PopoverContent>
              </Popover>
            ) : (
              <motion.button className="w-9 h-9 flex items-center justify-center" type="button">
                <List className="size-5" style={{ color: "var(--nav-stroke-color)" }} />
              </motion.button>
            )}
          </div>
        </div>

        {/* Mobile Row 2: Scrollable Pills */}
        <div className="overflow-x-auto pb-3 flex items-center gap-1.5 no-scrollbar">
          <AnimatedTabPill variant="pill" tabs={toItems(mobileTabs.slice(0, 3))} activeTab={activeTab} onTabChange={handleTabChange} isDark={isDark} className="pl-4" />
          {renderStandaloneChatTab(true)}
          <AnimatedTabPill variant="pill" tabs={toItems(mobileTabs.slice(3))} activeTab={activeTab} onTabChange={handleTabChange} isDark={isDark} className="pr-4" />
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
