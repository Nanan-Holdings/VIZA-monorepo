import type { MarketingBlogLocale, MarketingSocialPlatform } from "../contracts";

export class MarketingProviderConfigError extends Error {}

export type MarketingTextProvider = "deepseek" | "openrouter";

function openRouterConfig() {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  const model = process.env.VIZA_MARKETING_OPENROUTER_MODEL?.trim();
  if (!apiKey) throw new MarketingProviderConfigError("OPENROUTER_API_KEY is not configured");
  if (!model) throw new MarketingProviderConfigError("VIZA_MARKETING_OPENROUTER_MODEL is not configured");
  return { apiKey, model };
}

function deepSeekConfig() {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) throw new MarketingProviderConfigError("DEEPSEEK_API_KEY is not configured");
  return { apiKey, model: process.env.VIZA_MARKETING_DEEPSEEK_MODEL?.trim() || "deepseek-chat" };
}

export function contentGenerationReadiness(): { connected: boolean; provider: MarketingTextProvider | null; model: string | null } {
  if (process.env.DEEPSEEK_API_KEY?.trim()) {
    const { model } = deepSeekConfig();
    return { connected: true, provider: "deepseek", model };
  }
  if (process.env.OPENROUTER_API_KEY?.trim() && process.env.VIZA_MARKETING_OPENROUTER_MODEL?.trim()) {
    const { model } = openRouterConfig();
    return { connected: true, provider: "openrouter", model };
  }
  return { connected: false, provider: null, model: null };
}

function extractJson(value: string): Record<string, unknown> {
  const cleaned = value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const parsed: unknown = JSON.parse(cleaned);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Provider returned invalid JSON");
  return parsed as Record<string, unknown>;
}

async function generateWithOpenRouter(system: string, prompt: string, grounded: boolean): Promise<{ json: Record<string, unknown>; model: string; provider: MarketingTextProvider }> {
  const { apiKey, model } = openRouterConfig();
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "X-Title": "VIZA Marketing Operations" },
    body: JSON.stringify({ model, temperature: 0.5, response_format: { type: "json_object" }, ...(grounded ? { tools: [{ type: "openrouter:web_search", parameters: { max_total_results: 8 } }] } : {}), messages: [{ role: "system", content: system }, { role: "user", content: prompt }] }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) throw new Error(`OpenRouter request failed (${response.status})`);
  const body = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = body.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenRouter returned no content");
  return { json: extractJson(content), model, provider: "openrouter" };
}

async function generateWithDeepSeek(system: string, prompt: string): Promise<{ json: Record<string, unknown>; model: string; provider: MarketingTextProvider }> {
  const { apiKey, model } = deepSeekConfig();
  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      max_tokens: 8_192,
      temperature: 0.5,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
    }),
    signal: AbortSignal.timeout(280_000),
  });
  const raw = await response.text();
  if (!response.ok) throw new Error(`DeepSeek request failed (${response.status})`);
  const body = JSON.parse(raw) as { choices?: Array<{ message?: { content?: string }; finish_reason?: string }> };
  const choice = body.choices?.[0];
  const content = choice?.message?.content;
  if (!content) throw new Error("DeepSeek returned no content");
  if (choice?.finish_reason === "length") throw new Error("DeepSeek response was truncated");
  return { json: extractJson(content), model, provider: "deepseek" };
}

async function generate(system: string, prompt: string, grounded = false): Promise<{ json: Record<string, unknown>; model: string; provider: MarketingTextProvider }> {
  if (process.env.DEEPSEEK_API_KEY?.trim()) return generateWithDeepSeek(system, prompt);
  return generateWithOpenRouter(system, prompt, grounded);
}

export async function completeMarketingJson(system: string, prompt: string): Promise<Record<string, unknown>> {
  return (await generate(system, prompt)).json;
}

export async function generateBlogDraft(locale: MarketingBlogLocale, brief: string) {
  const language = locale === "zh-CN" ? "Simplified Chinese" : "English";
  return generate(
    `You are VIZA's visa and travel editorial assistant. Write only factual, cautious content in ${language}. Never invent official requirements; explicitly direct readers to official sources when facts may change. Return JSON only.`,
    `Create a publish-ready blog draft from this brief: ${brief}\nUse only facts supplied in the brief or stable, non-specific editorial guidance. Do not claim to have verified a changing visa requirement; instead label it as subject to official confirmation and direct readers to official sources. Include a Sources section only for URLs supplied in the brief. Return keys: slug, title, excerpt, bodyMarkdown, category, topics (array of 2-4 short topics), seoKeyword, seoTitle, seoDescription. Prefer a relevant measured keyword option in the brief. If none fits, write a useful keyword without claiming any search volume. The slug must be lowercase ASCII kebab-case.`,
    true,
  );
}

export async function generateSocialCopy(input: { brief: string; platforms: readonly MarketingSocialPlatform[]; destinationUrl?: string }) {
  return generate(
    "You are VIZA's social editor. Produce concise, accurate platform-specific copy. Never claim guaranteed visa outcomes. Return JSON only and do not include credentials or account identifiers.",
    `Brief: ${input.brief}\nPlatforms: ${input.platforms.join(", ")}\nDestination: ${input.destinationUrl ?? "none"}\nReturn an object with a platformContent object keyed exactly by each requested platform.`,
  );
}
