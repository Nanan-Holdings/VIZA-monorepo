import type { MarketingAutomationRunRecord, MarketingBlogAdminRecord, MarketingBlogPost, MarketingBlogSummary, MarketingShortLinkRecord, MarketingSocialCompositionRecord, MarketingSocialPlatform } from "./contracts";

export type DbError = { code?: string; message: string };
export type DbResult = { data: unknown; error: DbError | null };

export interface MarketingQuery extends PromiseLike<DbResult> {
  select(columns?: string): MarketingQuery;
  insert(values: Record<string, unknown>): MarketingQuery;
  update(values: Record<string, unknown>): MarketingQuery;
  eq(column: string, value: unknown): MarketingQuery;
  in(column: string, values: readonly unknown[]): MarketingQuery;
  order(column: string, options?: { ascending?: boolean }): MarketingQuery;
  limit(count: number): MarketingQuery;
  maybeSingle(): Promise<DbResult>;
  single(): Promise<DbResult>;
}

export interface MarketingDb {
  from(table: string): MarketingQuery;
  rpc(name: string, args: Record<string, unknown>): Promise<DbResult>;
}

export function asMarketingDb(client: unknown): MarketingDb {
  return client as MarketingDb;
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid marketing record");
  return value as Record<string, unknown>;
}

function text(row: Record<string, unknown>, key: string): string {
  if (typeof row[key] !== "string") throw new Error(`Invalid marketing record field: ${key}`);
  return row[key];
}

function nullableText(row: Record<string, unknown>, key: string): string | null {
  return typeof row[key] === "string" ? row[key] as string : null;
}

export function mapBlogSummary(value: unknown): MarketingBlogSummary {
  const row = record(value);
  const locale = text(row, "locale");
  if (locale !== "en" && locale !== "zh-CN") throw new Error("Invalid blog locale");
  return {
    id: text(row, "id"), locale, slug: text(row, "slug"), title: text(row, "title"),
    excerpt: text(row, "excerpt"), coverImageUrl: nullableText(row, "cover_image_url"),
    category: nullableText(row, "category"), authorName: text(row, "author_name"),
    publishedAt: text(row, "published_at"),
  };
}

export function mapBlogPost(value: unknown): MarketingBlogPost {
  const row = record(value);
  return {
    ...mapBlogSummary(row), bodyMarkdown: text(row, "body_markdown"),
    seoTitle: nullableText(row, "seo_title"), seoDescription: nullableText(row, "seo_description"),
    updatedAt: text(row, "updated_at"),
  };
}

export function mapBlogAdminRecord(value: unknown): MarketingBlogAdminRecord {
  const row = record(value);
  const locale = text(row, "locale");
  const status = text(row, "status");
  if (locale !== "en" && locale !== "zh-CN") throw new Error("Invalid blog locale");
  if (status !== "draft" && status !== "published" && status !== "archived") throw new Error("Invalid blog status");
  return {
    id: text(row, "id"), locale, slug: text(row, "slug"), status,
    title: text(row, "title"), excerpt: text(row, "excerpt"), bodyMarkdown: text(row, "body_markdown"),
    coverImageUrl: nullableText(row, "cover_image_url"), category: nullableText(row, "category"),
    authorName: text(row, "author_name"), seoTitle: nullableText(row, "seo_title"),
    seoDescription: nullableText(row, "seo_description"), generationBrief: nullableText(row, "generation_brief"),
    generatedByModel: nullableText(row, "generated_by_model"), version: typeof row.version === "number" ? row.version : 1,
    publishedAt: nullableText(row, "published_at"), createdAt: text(row, "created_at"), updatedAt: text(row, "updated_at"),
  };
}

export function mapSocialComposition(value: unknown): MarketingSocialCompositionRecord {
  const row = record(value);
  const validStatuses = ["draft", "scheduled", "publishing", "published", "partial", "failed", "cancelled"] as const;
  const status = text(row, "status") as MarketingSocialCompositionRecord["status"];
  if (!validStatuses.includes(status)) throw new Error("Invalid social composition status");
  const platforms = Array.isArray(row.platforms) ? row.platforms.filter((item): item is MarketingSocialPlatform => typeof item === "string") : [];
  return {
    id: text(row, "id"), blogPostId: nullableText(row, "blog_post_id"), shortLinkId: nullableText(row, "short_link_id"), title: text(row, "title"),
    brief: text(row, "brief"), destinationUrl: nullableText(row, "destination_url"), mediaUrl: nullableText(row, "media_url"),
    documentUrl: nullableText(row, "document_url"), status, platforms, platformContent: platformContent(row.platform_content),
    zernioPosts: platformContent(row.zernio_posts), scheduledFor: nullableText(row, "scheduled_for"),
    lastSyncedAt: nullableText(row, "last_synced_at"), createdAt: text(row, "created_at"), updatedAt: text(row, "updated_at"),
  };
}

export function mapShortLink(value: unknown): MarketingShortLinkRecord {
  const row = record(value);
  return {
    id: text(row, "id"), code: text(row, "code"), destinationUrl: text(row, "destination_url"),
    source: text(row, "source"), campaign: nullableText(row, "campaign"), contentKey: nullableText(row, "content_key"),
    active: row.active === true, clickCount: typeof row.click_count === "number" ? row.click_count : 0,
    lastClickedAt: nullableText(row, "last_clicked_at"), createdAt: text(row, "created_at"),
  };
}

export function mapAutomationRun(value: unknown): MarketingAutomationRunRecord {
  const row = record(value); const status = text(row, "status");
  if (status !== "running" && status !== "succeeded" && status !== "failed" && status !== "skipped") throw new Error("Invalid automation status");
  return { id: text(row, "id"), jobType: text(row, "job_type"), idempotencyKey: text(row, "idempotency_key"), status, outputEntityId: nullableText(row, "output_entity_id"), errorMessage: nullableText(row, "error_message"), startedAt: text(row, "started_at"), completedAt: nullableText(row, "completed_at") };
}

export function recordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item)) : [];
}

export function platformContent(value: unknown): Partial<Record<MarketingSocialPlatform, string>> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Partial<Record<MarketingSocialPlatform, string>> : {};
}
