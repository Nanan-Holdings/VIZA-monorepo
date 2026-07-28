"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ClipboardList, FileText, FolderOpen, Headphones, Home, LogOut } from "lucide-react";
import { signOut } from "@/app/actions/auth";
import { useState } from "react";

const navigation = [
  { name: "Home", href: "/client/home", icon: Home },
  { name: "Application", href: "/client/application", icon: FolderOpen },
  { name: "Status", href: "/client/status", icon: ClipboardList },
  { name: "Documents", href: "/client/documents", icon: FileText },
  { name: "Support", href: "/client/support", icon: Headphones },
];

function isActiveRoute(pathname: string, href: string): boolean {
  const routePath = href.split("?")[0];
  return pathname === routePath || (routePath !== "/client/home" && pathname.startsWith(routePath));
}

export function ClientSidebar() {
  const pathname = usePathname();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await signOut();
  };

  return (
    <div className="hidden md:flex h-screen w-64 flex-col fixed left-0 top-0 border-r bg-white">
      <div className="p-6">
        <Link
          href="/client/home"
          className="block transition-transform duration-200"
        >
          <h1 className="text-2xl font-bold text-black transition-colors duration-200">
            VIZA
          </h1>
        </Link>
      </div>
      <ScrollArea className="flex-1 px-3">
        <div className="space-y-1">
          {navigation.map((route, index) => (
            <Link key={route.href} href={route.href} className="block group">
              <Button
                variant={isActiveRoute(pathname, route.href) ? "secondary" : "ghost"}
                className={cn(
                  "w-full justify-start transition-all duration-200 relative",
                  isActiveRoute(pathname, route.href) &&
                    "bg-brand-50 text-brand hover:bg-brand-100 hover:text-brand shadow-sm",
                  !isActiveRoute(pathname, route.href) &&
                    "hover:bg-accent/50 hover:translate-x-1"
                )}
                style={{
                  animationDelay: `${index * 50}ms`,
                }}
              >
                <route.icon
                  className={cn(
                    "mr-3 h-5 w-5",
                    isActiveRoute(pathname, route.href) ? "" : "group-hover:text-brand"
                  )}
                />
                <span className="transition-all duration-200 group-hover:font-medium">
                  {route.name}
                </span>
                {isActiveRoute(pathname, route.href) && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-brand rounded-r-full animate-in slide-in-from-left-2 duration-300" />
                )}
              </Button>
            </Link>
          ))}
        </div>
      </ScrollArea>
      <div className="p-4 border-t">
        <Button
          variant="outline"
          className="w-full transition-all duration-200 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50 hover:shadow-sm"
          onClick={handleLogout}
          disabled={isLoggingOut}
        >
          <LogOut
            className={cn(
              "mr-2 h-4 w-4 transition-transform duration-200",
              !isLoggingOut && "group-hover:translate-x-0.5"
            )}
          />
          {isLoggingOut ? "Logging out..." : "Logout"}
        </Button>
      </div>
    </div>
  );
}
