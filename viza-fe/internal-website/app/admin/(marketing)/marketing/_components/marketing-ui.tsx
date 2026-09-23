import Link from "next/link";
import { ArrowLeft, ArrowRight } from "@phosphor-icons/react/ssr";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { AdminEmptyState, AdminSectionCard } from "@/components/admin/admin-ui";
import { cn } from "@/lib/utils";
import type { MarketingBlogAdminRecord, MarketingSocialCompositionRecord } from "@/lib/marketing/contracts";
import { marketingDateLocale, marketingStatusLabel, type MarketingCopy } from "../copy";

const STATUS_TONES: Record<string, string> = {
  published: "border-emerald-200 bg-emerald-50 text-emerald-700",
  draft: "border-slate-200 bg-slate-50 text-slate-700",
  archived: "border-slate-200 bg-slate-100 text-slate-500",
  scheduled: "border-blue-200 bg-blue-50 text-blue-700",
  publishing: "border-blue-200 bg-blue-50 text-blue-700",
  partial: "border-amber-200 bg-amber-50 text-amber-800",
  failed: "border-red-200 bg-red-50 text-red-700",
  cancelled: "border-slate-200 bg-slate-100 text-slate-500",
};

export function MarketingStatusBadge({ status, copy }: { status: string; copy: MarketingCopy }) {
  return <Badge variant="outline" className={cn(STATUS_TONES[status])}>{marketingStatusLabel(copy, status)}</Badge>;
}

export function ConnectionBadge({ connected, copy }: { connected: boolean; copy: MarketingCopy }) {
  return (
    <Badge variant="outline" className={connected ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-800"}>
      <span className={cn("mr-1.5 size-1.5 rounded-full", connected ? "bg-emerald-500" : "bg-amber-500")} />
      {connected ? copy.connected : copy.notConnected}
    </Badge>
  );
}

export function MarketingBackLink({ href, label }: { href: string; label: string }) {
  return <Button asChild variant="ghost" size="sm" className="-ml-3 w-fit"><Link href={href}><ArrowLeft className="size-4" />{label}</Link></Button>;
}

export function BlogList({ posts, copy, compact = false }: { posts: MarketingBlogAdminRecord[]; copy: MarketingCopy; compact?: boolean }) {
  if (!posts.length) return <AdminEmptyState>{copy.noPosts}</AdminEmptyState>;
  return (
    <CardContent className="divide-y p-0">
      {posts.map((post) => (
        <Link key={post.id} href={`/admin/marketing/blog/${post.id}`} className="flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2"><p className="truncate font-medium">{post.title}</p><MarketingStatusBadge status={post.status} copy={copy} /></div>
            <p className="mt-1 truncate text-xs text-muted-foreground">/{post.locale}/{post.slug} · v{post.version}</p>
          </div>
          <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground"><span>{new Date(post.updatedAt).toLocaleString(marketingDateLocale(copy))}</span>{!compact && <ArrowRight className="size-4" />}</div>
        </Link>
      ))}
    </CardContent>
  );
}

export function SocialList({ rows, copy, compact = false }: { rows: MarketingSocialCompositionRecord[]; copy: MarketingCopy; compact?: boolean }) {
  if (!rows.length) return <AdminEmptyState>{copy.noSocial}</AdminEmptyState>;
  return (
    <CardContent className="divide-y p-0">
      {rows.map((row) => (
        <div key={row.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2"><p className="truncate font-medium">{row.title}</p><MarketingStatusBadge status={row.status} copy={copy} /></div>
            <p className="mt-1 truncate text-xs text-muted-foreground">{row.platforms.join(", ") || "—"}</p>
          </div>
          <div className="shrink-0 text-xs text-muted-foreground">{row.scheduledFor ? new Date(row.scheduledFor).toLocaleString(marketingDateLocale(copy)) : copy.notScheduled}{!compact && row.lastSyncedAt ? ` · ${copy.synced} ${new Date(row.lastSyncedAt).toLocaleString(marketingDateLocale(copy))}` : ""}</div>
        </div>
      ))}
    </CardContent>
  );
}

export function RecentBlogCard({ posts, copy }: { posts: MarketingBlogAdminRecord[]; copy: MarketingCopy }) {
  return <AdminSectionCard title={copy.recentBlog} actionHref="/admin/marketing/blog" actionLabel={copy.edit}><BlogList posts={posts} copy={copy} compact /></AdminSectionCard>;
}

export function RecentSocialCard({ rows, copy }: { rows: MarketingSocialCompositionRecord[]; copy: MarketingCopy }) {
  return <AdminSectionCard title={copy.recentSocial} actionHref="/admin/marketing/social" actionLabel={copy.edit}><SocialList rows={rows} copy={copy} compact /></AdminSectionCard>;
}
