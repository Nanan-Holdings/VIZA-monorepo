import { createAdminClient } from "@/lib/supabase/admin";
import { mapBlogAdminRecord, mapSocialComposition } from "./db";
import { generateBlogDraft } from "./providers/openrouter";
import { getZernioPost } from "./providers/zernio";
import { normalizeMarketingSlug, validateBlogDraft } from "./validation";
import type { MarketingBlogAdminRecord, MarketingBlogLocale } from "./contracts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function automationConfig() {
  const actorId = process.env.VIZA_MARKETING_AUTOMATION_ACTOR_ID?.trim();
  const localeValue = process.env.VIZA_MARKETING_AUTOMATION_LOCALE?.trim() || "en";
  if (!actorId || !UUID.test(actorId)) throw new Error("VIZA_MARKETING_AUTOMATION_ACTOR_ID is not configured");
  if (localeValue !== "en" && localeValue !== "zh-CN") throw new Error("VIZA_MARKETING_AUTOMATION_LOCALE is invalid");
  return { actorId, locale: localeValue as MarketingBlogLocale };
}

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export async function runScheduledBlogGeneration(now = new Date()): Promise<{ skipped: boolean; post?: MarketingBlogAdminRecord }> {
  const { actorId, locale } = automationConfig();
  const admin = createAdminClient({ requestTimeoutMs: 30_000 });
  const actor = await admin.from("users").select("id, role, deleted_at").eq("id", actorId).maybeSingle();
  if (actor.error || !actor.data || actor.data.deleted_at || actor.data.role !== "admin") throw new Error("Marketing automation actor must be an active VIZA admin");
  const idempotencyKey = `blog-generation:${locale}:${dayKey(now)}`;
  const claimed = await admin.from("marketing_automation_runs").insert({ job_type: "blog_generation", idempotency_key: idempotencyKey, status: "running", actor_user_id: actorId, metadata: { locale, trigger: "vercel-cron" } }).select("id").single();
  if (claimed.error?.code === "23505") return { skipped: true };
  if (claimed.error || !claimed.data) throw new Error(claimed.error?.message ?? "Unable to claim marketing automation run");
  const runId = claimed.data.id;
  try {
    const recent = await admin.from("marketing_blog_posts").select("title, slug, status, category, updated_at").eq("locale", locale).order("updated_at", { ascending: false }).limit(60);
    if (recent.error) throw new Error(recent.error.message);
    const existing = (recent.data ?? []).map((row) => `${row.status}: ${row.title} (/${row.slug})`).join("\n");
    const generated = await generateBlogDraft(locale, `Select and write one useful, timely VIZA editorial topic for visa applicants or international travellers. It must be materially distinct from every existing topic below. Prefer a question users are currently searching for, verify changing claims against official sources, and avoid duplicating country guides unless a recent official change makes an update necessary.\n\nExisting and in-flight topics:\n${existing || "None yet."}`);
    const json = generated.json;
    const slug = normalizeMarketingSlug(typeof json.slug === "string" ? json.slug : typeof json.title === "string" ? json.title : "");
    const clean = validateBlogDraft({ locale, slug, title: String(json.title ?? ""), excerpt: String(json.excerpt ?? ""), bodyMarkdown: String(json.bodyMarkdown ?? ""), category: typeof json.category === "string" ? json.category : undefined, authorName: "VIZA Editorial", seoTitle: typeof json.seoTitle === "string" ? json.seoTitle : undefined, seoDescription: typeof json.seoDescription === "string" ? json.seoDescription : undefined, reason: `Scheduled generation ${idempotencyKey}` });
    const inserted = await admin.from("marketing_blog_posts").insert({ locale: clean.locale, slug: clean.slug, status: "draft", title: clean.title, excerpt: clean.excerpt, body_markdown: clean.bodyMarkdown, category: clean.category ?? null, author_name: clean.authorName, seo_title: clean.seoTitle ?? null, seo_description: clean.seoDescription ?? null, generation_brief: "Scheduled topic selection with duplicate avoidance", generated_by_model: generated.model, metadata: { automation_run_id: runId, idempotency_key: idempotencyKey }, created_by: actorId, updated_by: actorId }).select("*").single();
    if (inserted.error || !inserted.data) throw new Error(inserted.error?.message ?? "Unable to save scheduled blog draft");
    const post = mapBlogAdminRecord(inserted.data);
    await admin.from("marketing_automation_runs").update({ status: "succeeded", output_entity_type: "marketing_blog_post", output_entity_id: post.id, completed_at: new Date().toISOString(), heartbeat_at: new Date().toISOString(), updated_at: new Date().toISOString(), metadata: { locale, trigger: "vercel-cron", model: generated.model, slug: post.slug } }).eq("id", runId);
    await admin.from("marketing_provider_activity").insert({ provider: "openrouter", operation: "blog.generate.scheduled", status: "succeeded", entity_type: "marketing_blog_post", entity_id: post.id, actor_user_id: actorId, request_metadata: { reason: "Scheduled generation", idempotencyKey }, response_metadata: { model: generated.model, outputLength: post.bodyMarkdown.length } });
    return { skipped: false, post };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scheduled blog generation failed";
    await admin.from("marketing_automation_runs").update({ status: "failed", error_message: message.slice(0, 1000), completed_at: new Date().toISOString(), heartbeat_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", runId);
    await admin.from("marketing_provider_activity").insert({ provider: "openrouter", operation: "blog.generate.scheduled", status: "failed", actor_user_id: actorId, request_metadata: { reason: "Scheduled generation", idempotencyKey }, response_metadata: {}, error_code: error instanceof Error ? error.name.slice(0, 100) : null, error_message: message.slice(0, 500) });
    throw error;
  }
}

export async function failStuckMarketingRuns(now = new Date()) {
  const admin = createAdminClient({ requestTimeoutMs: 30_000 });
  const cutoff = new Date(now.getTime() - 20 * 60_000).toISOString();
  const stuck = await admin.from("marketing_automation_runs").select("id, job_type, idempotency_key").eq("status", "running").lt("heartbeat_at", cutoff);
  if (stuck.error) throw new Error(stuck.error.message);
  const ids = (stuck.data ?? []).map((run) => run.id);
  if (ids.length) {
    const updated = await admin.from("marketing_automation_runs").update({ status: "failed", error_message: "Run exceeded the 20-minute heartbeat window", completed_at: now.toISOString(), updated_at: now.toISOString() }).in("id", ids);
    if (updated.error) throw new Error(updated.error.message);
  }
  return { failedRunCount: ids.length };
}

export async function runSocialReconciliation(now = new Date()) {
  const { actorId } = automationConfig(); const admin = createAdminClient({ requestTimeoutMs: 30_000 });
  const bucket = now.toISOString().slice(0, 13); const idempotencyKey = `social-reconcile:${bucket}`;
  const claimed = await admin.from("marketing_automation_runs").insert({ job_type: "social_reconcile", idempotency_key: idempotencyKey, status: "running", actor_user_id: actorId, metadata: { trigger: "vercel-cron" } }).select("id").single();
  if (claimed.error?.code === "23505") return { skipped: true, reconciled: 0, failed: 0 };
  if (claimed.error || !claimed.data) throw new Error(claimed.error?.message ?? "Unable to claim social reconciliation run");
  const runId = claimed.data.id;
  try {
    const rows = await admin.from("marketing_social_compositions").select("*").in("status", ["scheduled", "publishing", "published", "partial"]).order("updated_at", { ascending: true }).limit(100);
    if (rows.error) throw new Error(rows.error.message);
    let reconciled = 0; let failed = 0;
    for (const value of rows.data ?? []) {
      const composition = mapSocialComposition(value); const ids = Object.values(composition.zernioPosts).filter((id): id is string => Boolean(id));
      if (!ids.length) { failed += 1; continue; }
      try {
        const posts = await Promise.all(ids.map(getZernioPost));
        const statuses = posts.map((body) => { const post = body.post && typeof body.post === "object" && !Array.isArray(body.post) ? body.post as Record<string, unknown> : body; return typeof post.status === "string" ? post.status : "publishing"; });
        const status = statuses.every((item) => item === "published") ? "published" : statuses.some((item) => item === "failed") ? "failed" : statuses.every((item) => item === "scheduled") ? "scheduled" : "publishing";
        const updated = await admin.from("marketing_social_compositions").update({ status, last_synced_at: now.toISOString(), updated_at: now.toISOString(), updated_by: actorId }).eq("id", composition.id);
        if (updated.error) throw new Error(updated.error.message);
        reconciled += 1;
      } catch { failed += 1; }
    }
    await admin.from("marketing_automation_runs").update({ status: failed ? "failed" : "succeeded", error_message: failed ? `${failed} composition(s) could not be reconciled` : null, completed_at: now.toISOString(), heartbeat_at: now.toISOString(), updated_at: now.toISOString(), metadata: { trigger: "vercel-cron", reconciled, failed } }).eq("id", runId);
    return { skipped: false, reconciled, failed };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Social reconciliation failed";
    await admin.from("marketing_automation_runs").update({ status: "failed", error_message: message.slice(0, 1000), completed_at: now.toISOString(), heartbeat_at: now.toISOString(), updated_at: now.toISOString() }).eq("id", runId);
    throw error;
  }
}
