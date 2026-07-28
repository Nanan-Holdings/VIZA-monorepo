"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  Calendar,
  ClipboardList,
  CreditCard,
  LogOut,
  Map,
  Menu,
  ChevronDown,
  Package,
  ShoppingCart,
  Bell,
  Settings,
  Headphones,
  Languages,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { adminSignOut } from "@/app/actions/auth";
import { useState, useEffect } from "react";
import type { LucideIcon } from "lucide-react";
import { LOCALE_COOKIE, normalizeInterfaceLocale } from "@/lib/i18n/locale";

interface RouteChild {
  labelKey: AdminNavKey;
  href: string;
  icon?: LucideIcon;
}

interface Route {
  labelKey: AdminNavKey;
  icon: LucideIcon;
  href: string;
  children?: RouteChild[];
}

type AdminNavKey =
  | "dashboard"
  | "accounts"
  | "applications"
  | "coverage"
  | "billing"
  | "support"
  | "orders"
  | "products"
  | "consultations";

const ADMIN_COPY = {
  en: {
    nav: {
      dashboard: "Dashboard",
      accounts: "Accounts",
      applications: "Applications",
      coverage: "Coverage",
      billing: "Billing",
      support: "Support",
      orders: "Orders",
      products: "Products",
      consultations: "Consultations",
    },
    logout: "Logout",
    loggingOut: "Logging out...",
    operationsLead: "Operations Lead",
    language: "Language",
    english: "English",
    chinese: "中文",
  },
  zh: {
    nav: {
      dashboard: "仪表盘",
      accounts: "账户",
      applications: "申请",
      coverage: "覆盖范围",
      billing: "账单",
      support: "客服",
      orders: "订单",
      products: "产品",
      consultations: "咨询",
    },
    logout: "退出登录",
    loggingOut: "正在退出...",
    operationsLead: "运营负责人",
    language: "语言",
    english: "English",
    chinese: "中文",
  },
} as const;

const adminRoutes: Route[] = [
  {
    labelKey: "dashboard",
    icon: LayoutDashboard,
    href: "/admin",
  },
  {
    labelKey: "accounts",
    icon: Users,
    href: "/admin/users",
  },
  {
    labelKey: "applications",
    icon: ClipboardList,
    href: "/admin/applications",
  },
  {
    labelKey: "coverage",
    icon: Map,
    href: "/admin/packages",
  },
  {
    labelKey: "billing",
    icon: CreditCard,
    href: "/admin/billing",
  },
  {
    labelKey: "support",
    icon: Headphones,
    href: "/admin/support",
  },
  {
    labelKey: "orders",
    icon: ShoppingCart,
    href: "/admin/orders",
  },
  {
    labelKey: "products",
    icon: Package,
    href: "/admin/products",
  },
  {
    labelKey: "consultations",
    icon: Calendar,
    href: "/admin/cal-bookings",
  },
];

function AdminSidebar() {
  const locale = normalizeInterfaceLocale(useLocale());
  const copy = ADMIN_COPY[locale];
  const pathname = usePathname();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<string[]>([]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    adminRoutes.forEach((route) => {
      if (route.children && pathname.startsWith(route.href)) {
        setExpandedMenus((prev) =>
          prev.includes(route.href) ? prev : [...prev, route.href]
        );
      }
    });
  }, [pathname]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await adminSignOut();
  };

  const toggleMenu = (href: string) => {
    setExpandedMenus((prev) =>
      prev.includes(href) ? prev.filter((h) => h !== href) : [...prev, href]
    );
  };

  const isMenuExpanded = (href: string) => expandedMenus.includes(href);

  const renderNavItem = (route: Route, _index: number) => {
    const hasChildren = route.children && route.children.length > 0;
    const isExpanded = isMenuExpanded(route.href);
    const isActive =
      pathname === route.href ||
      (pathname.startsWith(route.href) && route.href !== "/admin") ||
      (hasChildren && route.children?.some((child) => pathname === child.href));

    if (hasChildren) {
      return (
        <div key={route.href}>
          <Button
            variant="ghost"
            className={cn(
              "w-full justify-start transition-all duration-200 relative h-[42px] rounded-[10px] gap-3 px-3 py-0.5",
              isActive &&
                "bg-brand-50 text-brand-500 hover:bg-brand-50 hover:text-brand-500 shadow-none border border-brand-200",
              !isActive && "hover:bg-brand-50/50 text-[#45556c]"
            )}
            onClick={() => toggleMenu(route.href)}
          >
            <route.icon className={cn("h-5 w-5 shrink-0", "stroke-[2]")} />
            <span className="flex-1 text-left font-sans text-[15px] leading-[24px]">
              {copy.nav[route.labelKey]}
            </span>
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform duration-200",
                isExpanded && "rotate-180"
              )}
            />
          </Button>
          {isExpanded && (
            <div className="ml-4 mt-1 space-y-1 border-l-2 border-brand-100 pl-2">
              {route.children?.map((child) => (
                <Link key={child.href} href={child.href} className="block">
                  <Button
                    variant={pathname === child.href ? "secondary" : "ghost"}
                    size="sm"
                    className={cn(
                      "w-full justify-start transition-all duration-200",
                      pathname === child.href &&
                        "bg-brand-50 text-brand-500 hover:bg-brand-50 shadow-sm border border-brand-200"
                    )}
                  >
                    {copy.nav[child.labelKey]}
                  </Button>
                </Link>
              ))}
            </div>
          )}
        </div>
      );
    }

    return (
      <Link key={route.href} href={route.href} className="block">
        <Button
          variant="ghost"
          className={cn(
            "w-full justify-start transition-all duration-200 relative h-[40px] rounded-[10px] gap-3 px-3 font-sans text-[15px] leading-[24px]",
            isActive &&
              "bg-brand-50 text-brand-500 hover:bg-brand-50 hover:text-brand-500 shadow-none border border-brand-200",
            !isActive && "hover:bg-brand-50/50 text-[#45556c]"
          )}
        >
          <route.icon className={cn("h-5 w-5 shrink-0", "stroke-[2]")} />
          <span>{copy.nav[route.labelKey]}</span>
        </Button>
      </Link>
    );
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden md:flex h-[calc(100vh-72px)] w-64 flex-col fixed left-0 top-[72px] border-r border-[#efefef] bg-white z-40">
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="space-y-1 px-4 py-4">
              {adminRoutes.map((route, index) => renderNavItem(route, index))}
            </div>
          </ScrollArea>
        </div>
        <div className="p-4 border-t border-[#efefef]">
          <Button
            variant="outline"
            className="w-full border-[#efefef] text-[#45556c] hover:bg-red-50 hover:text-red-600 hover:border-red-200"
            onClick={handleLogout}
            disabled={isLoggingOut}
          >
            <LogOut className="mr-2 h-4 w-4" />
            {isLoggingOut ? copy.loggingOut : copy.logout}
          </Button>
        </div>
      </div>

      {/* Mobile Sidebar */}
      {isMounted && (
        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="md:hidden fixed top-4 left-4 z-40 border-[#efefef]"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <div className="h-full overflow-hidden">
              <ScrollArea className="h-full">
                <div className="space-y-1 px-4 py-4">
                  {adminRoutes.map((route, index) => renderNavItem(route, index))}
                </div>
              </ScrollArea>
            </div>
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}

function AdminLanguageSwitcher() {
  const locale = normalizeInterfaceLocale(useLocale());
  const router = useRouter();
  const copy = ADMIN_COPY[locale];

  function setLocale(nextLocale: "en" | "zh") {
    document.cookie = `${LOCALE_COOKIE}=${nextLocale}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    router.refresh();
  }

  return (
    <div className="flex items-center rounded-full border border-[#efefef] bg-white p-1">
      <span className="sr-only">{copy.language}</span>
      <Languages className="mx-2 h-4 w-4 text-[#45556c]" />
      {(["en", "zh"] as const).map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => setLocale(code)}
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-semibold transition-colors",
            locale === code
              ? "bg-brand-50 text-brand-500"
              : "text-[#64748b] hover:bg-[#f5f7fb] hover:text-[#3d3d3d]",
          )}
        >
          {code === "en" ? copy.english : copy.chinese}
        </button>
      ))}
    </div>
  );
}

function AdminTopBar() {
  const locale = normalizeInterfaceLocale(useLocale());
  const copy = ADMIN_COPY[locale];
  const pathname = usePathname();

  const getPageTitle = () => {
    const route = adminRoutes.find(
      (r) => pathname === r.href || (r.href !== "/admin" && pathname.startsWith(`${r.href}/`))
    );
    return route ? copy.nav[route.labelKey] : copy.nav.dashboard;
  };

  return (
    <div className="hidden md:flex fixed top-0 left-0 right-0 bg-white border-b border-[#efefef] px-6 z-50 h-[72px]">
      <div className="flex items-center justify-between w-full">
        {/* Logo */}
        <div className="shrink-0">
          <Image
            src="/logo/viza-logo-black.svg"
            alt="VIZA"
            width={100}
            height={28}
            className="object-contain"
            priority
          />
        </div>

        {/* Page Title */}
        <div className="flex items-center justify-center flex-1 pl-16">
          <p className="font-heading text-[16px] font-medium leading-[24px] text-[#3d3d3d] tracking-[-0.24px]">
            {getPageTitle()}
          </p>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          <AdminLanguageSwitcher />

          {/* Notification Bell */}
          <button className="relative rounded-lg p-2 hover:bg-brand-50/50 transition-colors">
            <Bell className="h-5 w-5 text-[#45556c]" strokeWidth={2} />
            <div className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
          </button>

          {/* Settings */}
          <button className="rounded-lg p-2 hover:bg-brand-50/50 transition-colors">
            <Settings className="h-5 w-5 text-[#45556c]" strokeWidth={2} />
          </button>

          {/* Divider */}
          <div className="border-l border-[#efefef] h-10" />

          {/* User Info */}
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end">
              <p className="font-sans text-[14px] leading-[20px] font-medium text-[#3d3d3d]">
                Amir Wong
              </p>
              <div className="bg-brand-50 px-2 py-0.5 rounded-full">
                <p className="font-sans text-[11px] leading-[16px] text-brand-500">
                  {copy.operationsLead}
                </p>
              </div>
            </div>

            {/* Avatar */}
            <div className="w-9 h-9 rounded-full bg-gradient-to-b from-brand-400 to-brand-500 flex items-center justify-center">
              <span className="font-sans text-[14px] text-white font-semibold">
                AW
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminLayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#fafafa]">
      <AdminTopBar />
      <AdminSidebar />
      <div className="md:pl-64 md:pt-[72px]">
        <main className="min-h-[calc(100vh-72px)] p-2 bg-[#fafafa]">
          {children}
        </main>
      </div>
    </div>
  );
}
