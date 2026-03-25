"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  Calendar,
  LogOut,
  Menu,
  ChevronDown,
  Package,
  ShoppingCart,
  Bell,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { signOut } from "@/app/actions/auth";
import { useState, useEffect } from "react";
import type { LucideIcon } from "lucide-react";

interface RouteChild {
  label: string;
  href: string;
  icon?: LucideIcon;
}

interface Route {
  label: string;
  icon: LucideIcon;
  href: string;
  children?: RouteChild[];
}

const adminRoutes: Route[] = [
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    href: "/admin",
  },
  {
    label: "Accounts",
    icon: Users,
    href: "/admin/users",
  },
  {
    label: "Orders",
    icon: ShoppingCart,
    href: "/admin/orders",
  },
  {
    label: "Products",
    icon: Package,
    href: "/admin/products",
  },
  {
    label: "Consultations",
    icon: Calendar,
    href: "/admin/cal-bookings",
  },
];

function AdminSidebar() {
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
    await signOut();
  };

  const toggleMenu = (href: string) => {
    setExpandedMenus((prev) =>
      prev.includes(href) ? prev.filter((h) => h !== href) : [...prev, href]
    );
  };

  const isMenuExpanded = (href: string) => expandedMenus.includes(href);

  const renderNavItem = (route: Route, index: number) => {
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
              "w-full justify-start transition-all duration-200 relative h-[41.654px] rounded-[10px] gap-[11.992px] px-[12.825px] py-[0.833px]",
              isActive &&
                "bg-[rgba(194,120,95,0.1)] text-[#0f172b] hover:bg-[rgba(194,120,95,0.1)] hover:text-[#0f172b] shadow-none border-[0.833px] border-[rgba(194,120,95,0.3)]",
              !isActive && "hover:bg-transparent text-[#45556c]"
            )}
            onClick={() => toggleMenu(route.href)}
          >
            <route.icon className={cn("h-5 w-5 shrink-0", "stroke-[2]")} />
            <span className="flex-1 text-left font-['Sofia_Pro',sans-serif] text-[16px] leading-[24px]">{route.label}</span>
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform duration-200",
                isExpanded && "rotate-180"
              )}
            />
          </Button>
          {isExpanded && (
            <div className="ml-4 mt-1 space-y-1 border-l-2 border-gray-100 pl-2">
              {route.children?.map((child) => (
                <Link key={child.href} href={child.href} className="block">
                  <Button
                    variant={pathname === child.href ? "secondary" : "ghost"}
                    size="sm"
                    className={cn(
                      "w-full justify-start transition-all duration-200",
                      pathname === child.href &&
                        "bg-[rgba(194,120,95,0.1)] text-[#0f172b] hover:bg-[rgba(194,120,95,0.1)] shadow-sm border-[0.833px] border-[rgba(194,120,95,0.3)]"
                    )}
                  >
                    {child.label}
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
            "w-full justify-start transition-all duration-200 relative h-[39.991px] rounded-[10px] gap-[11.998px] px-[11.998px] font-['Sofia_Pro',sans-serif] text-[16px] leading-[24px]",
            isActive &&
              "bg-[rgba(194,120,95,0.1)] text-[#0f172b] hover:bg-[rgba(194,120,95,0.1)] hover:text-[#0f172b] shadow-none border-[0.833px] border-[rgba(194,120,95,0.3)]",
            !isActive && "hover:bg-transparent text-[#45556c]"
          )}
        >
          <route.icon className={cn("h-5 w-5 shrink-0", "stroke-[2]")} />
          <span>{route.label}</span>
        </Button>
      </Link>
    );
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden md:flex h-[calc(100vh-88.011px)] w-64 flex-col fixed left-0 top-[88.011px] border-r bg-white z-40">
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="space-y-[3.996px] px-[15.994px] py-[15.994px]">
              {adminRoutes.map((route, index) => renderNavItem(route, index))}
            </div>
          </ScrollArea>
        </div>
        <div className="p-4 border-t">
          <Button
            variant="outline"
            className="w-full hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50"
            onClick={handleLogout}
            disabled={isLoggingOut}
          >
            <LogOut className="mr-2 h-4 w-4" />
            {isLoggingOut ? "Logging out..." : "Logout"}
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
              className="md:hidden fixed top-4 left-4 z-40"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <div className="h-full overflow-hidden">
              <ScrollArea className="h-full">
                <div className="space-y-[3.996px] px-[15.994px] py-[15.994px]">
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

function AdminTopBar() {
  const pathname = usePathname();
  
  // Get the current page title from the pathname
  const getPageTitle = () => {
    const route = adminRoutes.find(r => pathname === r.href);
    return route?.label || "Dashboard";
  };

  return (
    <div className="hidden md:flex fixed top-0 left-0 right-0 bg-white border-b border-[#ececec] px-[24px] py-[20px] z-50 h-[88.011px]">
      <div className="grid grid-cols-[75.218px,1fr,auto] items-center w-full">
        <div className="w-[75.218px] h-[31.439px]">
          <img
            src="/logo/logo1.png"
            alt="VIZA"
            className="w-full h-full object-contain"
          />
        </div>

        <div className="flex items-center justify-center pl-[150px]">
          <p className="font-['Sofia_Pro',sans-serif] text-[16px] leading-[24px] text-[#111827]">
            {getPageTitle()}
          </p>
        </div>

        <div className="flex items-center gap-[16px]">
          {/* Notification Bell */}
          <button className="relative rounded-[10px] p-[7.99px] hover:bg-gray-50 transition-colors">
            <Bell className="h-5 w-5 text-[#4b5563]" strokeWidth={2} />
            <div className="absolute top-[5.99px] right-[5.99px] w-[7.992px] h-[7.992px] bg-[#dc2626] rounded-full" />
          </button>

          {/* Settings */}
          <button className="rounded-[10px] p-[7.99px] hover:bg-gray-50 transition-colors">
            <Settings className="h-5 w-5 text-[#4b5563]" strokeWidth={2} />
          </button>

          {/* Divider */}
          <div className="border-l border-[#e2e8f0] h-[48.011px]" />

          {/* User Info */}
          <div className="flex items-center gap-[11.998px]">
            <div className="flex flex-col gap-[4px] items-end">
              <p className="font-['Sofia_Pro',sans-serif] text-[16px] leading-[normal] text-[#111827]">
                Amir Wong
              </p>
              <div className="bg-[#f1f5f9] px-[7px] py-[2px] rounded-full">
                <p className="font-['Sofia_Pro',sans-serif] text-[12px] leading-[16px] text-[#62748e]">
                  Operations Lead
                </p>
              </div>
            </div>
            
            {/* Avatar */}
            <div className="w-[40px] h-[40px] rounded-full bg-gradient-to-b from-[#c2785f] to-[#a86450] flex items-center justify-center">
              <span className="font-['Sofia_Pro',sans-serif] text-[16px] leading-[normal] text-white font-semibold">
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
    <div className="min-h-screen bg-background">
      <AdminTopBar />
      <AdminSidebar />
      <div className="md:pl-64 md:pt-[88.011px]">
        <main className="min-h-[calc(100vh-88.011px)] p-2 bg-[#F9FAFB]">
          {children}
        </main>
      </div>
    </div>
  );
}
