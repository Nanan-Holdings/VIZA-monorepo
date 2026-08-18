import type { ComponentType, ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/ssr";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type AdminIcon = ComponentType<{ className?: string }>;

export function AdminPage({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("mx-auto w-full max-w-[1600px] space-y-6 px-4 py-6 lg:px-8 lg:py-8", className)}>
      {children}
    </div>
  );
}

export function AdminPageHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground lg:text-3xl">{title}</h1>
        {description ? <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function AdminMetricCard({
  label,
  value,
  href,
  icon: Icon,
  tone = "default",
  helper,
}: {
  label: string;
  value: number | string;
  href?: string;
  icon: AdminIcon;
  tone?: "default" | "warning" | "critical" | "success";
  helper?: string;
}) {
  const content = (
    <Card className="h-full border-border/80 shadow-sm transition-colors hover:border-primary/30 hover:shadow-md">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-5 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <span className={cn(
          "flex size-9 items-center justify-center rounded-lg",
          tone === "critical" && "bg-destructive/10 text-destructive",
          tone === "warning" && "bg-amber-100 text-amber-700",
          tone === "success" && "bg-emerald-100 text-emerald-700",
          tone === "default" && "bg-primary/10 text-primary",
        )}>
          <Icon className="size-4" />
        </span>
      </CardHeader>
      <CardContent className="p-5 pt-1">
        <p className={cn("text-3xl font-semibold tracking-tight", tone === "critical" && "text-destructive")}>{value}</p>
        {helper ? <p className="mt-1 text-xs text-muted-foreground">{helper}</p> : null}
      </CardContent>
    </Card>
  );

  return href ? <Link href={href} className="block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{content}</Link> : content;
}

export function AdminSectionCard({
  title,
  description,
  actionHref,
  actionLabel,
  children,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actionHref?: string;
  actionLabel?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("overflow-hidden border-border/80 shadow-sm", className)}>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 border-b bg-muted/20 px-5 py-4">
        <div className="space-y-1">
          <CardTitle className="text-base">{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </div>
        {actionHref && actionLabel ? (
          <Button asChild variant="ghost" size="sm" className="-mr-2 text-primary hover:text-primary">
            <Link href={actionHref}>{actionLabel}<ArrowRight className="size-3.5" /></Link>
          </Button>
        ) : null}
      </CardHeader>
      {children}
    </Card>
  );
}

export function AdminEmptyState({ children }: { children: ReactNode }) {
  return <div className="px-5 py-10 text-center text-sm text-muted-foreground">{children}</div>;
}

export function AdminPriorityBadge({ priority }: { priority: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "uppercase",
        priority === "p0" && "border-destructive/30 bg-destructive/10 text-destructive",
        priority === "p1" && "border-amber-300 bg-amber-50 text-amber-800",
        !["p0", "p1"].includes(priority) && "border-border bg-muted text-muted-foreground",
      )}
    >
      {priority}
    </Badge>
  );
}
