"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useLocale } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BarChart3,
  Bell,
  Bot,
  Calendar,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  CreditCard,
  DatabaseBackup,
  Globe2,
  Headphones,
  Languages,
  LayoutDashboard,
  LifeBuoy,
  ListTodo,
  LogOut,
  Map,
  Menu,
  MessageSquare,
  Package,
  ReceiptText,
  ScrollText,
  ServerCog,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Tags,
  Undo2,
  UserPlus,
  Users,
} from "lucide-react";
import { adminSignOut } from "@/app/actions/auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { LOCALE_COOKIE, normalizeInterfaceLocale } from "@/lib/i18n/locale";
import { cn } from "@/lib/utils";

interface Route {
  labelKey: AdminNavKey;
  icon: LucideIcon;
  href: string;
}

type AdminNavKey =
  | "dashboard" | "accounts" | "applications" | "coverage" | "billing"
  | "support" | "orders" | "products" | "cataloguePublication"
  | "consultations" | "work" | "takeovers" | "chat" | "revenue"
  | "pricing" | "metrics" | "portalHealth" | "notificationDlq" | "backups"
  | "costs" | "analytics" | "privacy" | "refunds" | "leads" | "audit" | "team";

type AdminNavSectionKey =
  | "control" | "cases" | "customers" | "commerce" | "platform" | "catalogue" | "administration";

interface AdminNavSection {
  labelKey: AdminNavSectionKey;
  routes: Route[];
}

const ADMIN_COPY = {
  en: {
    nav: {
      dashboard: "Dashboard", accounts: "Accounts", applications: "Applications", coverage: "Coverage",
      billing: "Billing", support: "Support", orders: "Orders", products: "Products",
      cataloguePublication: "Marketing publication", consultations: "Appointments", work: "Work queue",
      takeovers: "Takeovers", chat: "Live chat", revenue: "Revenue", pricing: "Pricing",
      metrics: "Runner metrics", portalHealth: "Portal health", notificationDlq: "Notification DLQ",
      backups: "Backups", costs: "Costs", analytics: "Analytics", privacy: "Privacy requests",
      refunds: "Refunds & disputes", leads: "Leads", audit: "Audit log", team: "Team & workload",
    },
    sections: {
      control: "Control tower", cases: "Cases", customers: "Customers", commerce: "Commerce",
      platform: "Platform", catalogue: "Catalogue", administration: "Administration",
    },
    admin: "Admin",
    logout: "Sign out",
    loggingOut: "Signing out",
    operationsLead: "Operations lead",
    language: "Language",
    english: "EN",
    chinese: "中文",
    openMenu: "Open navigation",
  },
  zh: {
    nav: {
      dashboard: "仪表盘", accounts: "账户", applications: "申请", coverage: "覆盖范围",
      billing: "账单", support: "客服", orders: "订单", products: "产品",
      cataloguePublication: "营销发布", consultations: "预约", work: "工作队列",
      takeovers: "人工接管", chat: "在线聊天", revenue: "收入", pricing: "定价",
      metrics: "自动化指标", portalHealth: "门户健康", notificationDlq: "通知死信队列",
      backups: "备份", costs: "成本", analytics: "分析", privacy: "隐私请求",
      refunds: "退款与争议", leads: "销售线索", audit: "审计日志", team: "团队与工作量",
    },
    sections: {
      control: "运营控制台", cases: "申请案件", customers: "客户", commerce: "交易",
      platform: "平台", catalogue: "产品目录", administration: "系统管理",
    },
    admin: "管理后台",
    logout: "退出登录",
    loggingOut: "正在退出",
    operationsLead: "运营负责人",
    language: "语言",
    english: "EN",
    chinese: "中文",
    openMenu: "打开导航",
  },
} as const;

const adminNavSections: AdminNavSection[] = [
  { labelKey: "control", routes: [
    { labelKey: "dashboard", icon: LayoutDashboard, href: "/admin" },
    { labelKey: "work", icon: ListTodo, href: "/admin/work" },
    { labelKey: "analytics", icon: BarChart3, href: "/admin/analytics" },
  ] },
  { labelKey: "cases", routes: [
    { labelKey: "applications", icon: ClipboardList, href: "/admin/applications" },
    { labelKey: "takeovers", icon: Bot, href: "/admin/takeovers" },
    { labelKey: "consultations", icon: Calendar, href: "/admin/cal-bookings" },
  ] },
  { labelKey: "customers", routes: [
    { labelKey: "leads", icon: UserPlus, href: "/admin/leads" },
    { labelKey: "accounts", icon: Users, href: "/admin/users" },
    { labelKey: "support", icon: Headphones, href: "/admin/support" },
    { labelKey: "chat", icon: MessageSquare, href: "/admin/chat" },
    { labelKey: "privacy", icon: ShieldCheck, href: "/admin/privacy" },
  ] },
  { labelKey: "commerce", routes: [
    { labelKey: "orders", icon: ShoppingCart, href: "/admin/orders" },
    { labelKey: "billing", icon: CreditCard, href: "/admin/billing" },
    { labelKey: "refunds", icon: Undo2, href: "/admin/refunds" },
    { labelKey: "revenue", icon: CircleDollarSign, href: "/admin/revenue" },
  ] },
  { labelKey: "platform", routes: [
    { labelKey: "portalHealth", icon: Activity, href: "/admin/portal-health" },
    { labelKey: "metrics", icon: ServerCog, href: "/admin/metrics" },
    { labelKey: "notificationDlq", icon: LifeBuoy, href: "/admin/notifications/dlq" },
    { labelKey: "backups", icon: DatabaseBackup, href: "/admin/storage-backups" },
    { labelKey: "costs", icon: ReceiptText, href: "/admin/costs" },
  ] },
  { labelKey: "catalogue", routes: [
    { labelKey: "coverage", icon: Map, href: "/admin/packages" },
    { labelKey: "pricing", icon: Tags, href: "/admin/pricing" },
    { labelKey: "products", icon: Package, href: "/admin/products" },
    { labelKey: "cataloguePublication", icon: Globe2, href: "/admin/catalogue-publication" },
  ] },
  { labelKey: "administration", routes: [
    { labelKey: "team", icon: Users, href: "/admin/team" },
    { labelKey: "audit", icon: ScrollText, href: "/admin/audit" },
  ] },
];

const adminRoutes = adminNavSections.flatMap((section) => section.routes);

function initialsFor(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "VA";
}

function AdminNavigation({ onNavigate }: { onNavigate?: () => void }) {
  const locale = normalizeInterfaceLocale(useLocale());
  const copy = ADMIN_COPY[locale];
  const pathname = usePathname();

  return (
    <nav className="space-y-5 px-3 py-4" aria-label={copy.admin}>
      {adminNavSections.map((section) => (
        <section key={section.labelKey}>
          <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">
            {copy.sections[section.labelKey]}
          </p>
          <div className="space-y-0.5">
            {section.routes.map((route) => {
              const active = pathname === route.href || (route.href !== "/admin" && pathname.startsWith(`${route.href}/`));
              return (
                <Button
                  key={route.href}
                  asChild
                  variant="ghost"
                  className={cn(
                    "h-9 w-full justify-start gap-3 px-2.5 font-normal text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    active && "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
                  )}
                >
                  <Link href={route.href} onClick={onNavigate} aria-current={active ? "page" : undefined}>
                    <route.icon className="size-4" />
                    <span className="truncate">{copy.nav[route.labelKey]}</span>
                    {active ? <ChevronRight className="ml-auto size-3.5" /> : null}
                  </Link>
                </Button>
              );
            })}
          </div>
        </section>
      ))}
    </nav>
  );
}

function AdminIdentity({ userName, userRole, compact = false }: { userName: string; userRole: string; compact?: boolean }) {
  const locale = normalizeInterfaceLocale(useLocale());
  const copy = ADMIN_COPY[locale];
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <Avatar className="size-9 border bg-primary/10">
        <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">{initialsFor(userName)}</AvatarFallback>
      </Avatar>
      {!compact ? <div className="min-w-0"><p className="truncate text-sm font-medium">{userName}</p><p className="truncate text-xs text-muted-foreground">{userRole === "admin" ? copy.operationsLead : userRole}</p></div> : null}
    </div>
  );
}

function AdminLanguageSwitcher() {
  const locale = normalizeInterfaceLocale(useLocale());
  const router = useRouter();
  const copy = ADMIN_COPY[locale];
  const setLocale = (nextLocale: "en" | "zh") => {
    document.cookie = `${LOCALE_COOKIE}=${nextLocale}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    router.refresh();
  };

  return (
    <div className="inline-flex items-center rounded-md border bg-background p-0.5" aria-label={copy.language}>
      <Languages className="mx-1.5 size-3.5 text-muted-foreground" />
      {(["en", "zh"] as const).map((code) => (
        <Button
          key={code}
          type="button"
          variant="ghost"
          size="sm"
          aria-pressed={locale === code}
          onClick={() => setLocale(code)}
          className={cn("h-7 rounded px-2 text-xs", locale === code && "bg-accent text-accent-foreground hover:bg-accent")}
        >
          {code === "en" ? copy.english : copy.chinese}
        </Button>
      ))}
    </div>
  );
}

function AdminSidebar({ userName, userRole }: { userName: string; userRole: string }) {
  const locale = normalizeInterfaceLocale(useLocale());
  const copy = ADMIN_COPY[locale];
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const handleLogout = async () => { setIsLoggingOut(true); await adminSignOut(); };

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 flex-col border-r border-sidebar-border bg-[hsl(var(--sidebar-background))] text-sidebar-foreground lg:flex">
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-5">
        <Image src="/logo/viza-logo-black.svg" alt="VIZA" width={88} height={25} priority />
        <Badge variant="secondary" className="font-medium">{copy.admin}</Badge>
      </div>
      <ScrollArea className="min-h-0 flex-1"><AdminNavigation /></ScrollArea>
      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-2 rounded-lg p-2">
          <AdminIdentity userName={userName} userRole={userRole} />
          <Button variant="ghost" size="icon" className="ml-auto shrink-0 text-muted-foreground hover:text-destructive" onClick={handleLogout} disabled={isLoggingOut} aria-label={isLoggingOut ? copy.loggingOut : copy.logout}>
            <LogOut className="size-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
}

function AdminTopBar({ userName, userRole }: { userName: string; userRole: string }) {
  const locale = normalizeInterfaceLocale(useLocale());
  const copy = ADMIN_COPY[locale];
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const route = adminRoutes.find((item) => pathname === item.href || (item.href !== "/admin" && pathname.startsWith(`${item.href}/`)));
  const pageTitle = route ? copy.nav[route.labelKey] : copy.nav.dashboard;

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:px-8">
      {mounted ? (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="lg:hidden" aria-label={copy.openMenu}><Menu className="size-4" /></Button>
          </SheetTrigger>
          <SheetContent side="left" className="admin-theme flex w-[300px] flex-col p-0 sm:max-w-[300px]">
            <SheetTitle className="sr-only">{copy.admin}</SheetTitle>
            <div className="flex h-16 items-center gap-3 border-b px-5">
              <Image src="/logo/viza-logo-black.svg" alt="VIZA" width={88} height={25} />
              <Badge variant="secondary">{copy.admin}</Badge>
            </div>
            <ScrollArea className="min-h-0 flex-1"><AdminNavigation onNavigate={() => setOpen(false)} /></ScrollArea>
            <Separator />
            <div className="p-4"><AdminIdentity userName={userName} userRole={userRole} /></div>
          </SheetContent>
        </Sheet>
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold sm:text-base">{pageTitle}</p>
        <p className="hidden text-xs text-muted-foreground sm:block">{copy.admin}</p>
      </div>
      <AdminLanguageSwitcher />
      <Button asChild variant="ghost" size="icon" className="hidden sm:inline-flex">
        <Link href="/admin/notifications/dlq" aria-label={copy.nav.notificationDlq}><Bell className="size-4" /></Link>
      </Button>
      <Button asChild variant="ghost" size="icon" className="hidden sm:inline-flex">
        <Link href="/admin/team" aria-label={copy.nav.team}><Settings className="size-4" /></Link>
      </Button>
      <Separator orientation="vertical" className="hidden h-8 sm:block" />
      <AdminIdentity userName={userName} userRole={userRole} compact />
    </header>
  );
}

export default function AdminLayoutContent({
  children,
  userName = "VIZA Admin",
  userRole = "admin",
}: {
  children: React.ReactNode;
  userName?: string;
  userRole?: string;
}) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <AdminSidebar userName={userName} userRole={userRole} />
      <div className="min-w-0 lg:pl-72">
        <AdminTopBar userName={userName} userRole={userRole} />
        <main className="min-h-[calc(100dvh-4rem)] bg-background">{children}</main>
      </div>
    </div>
  );
}
