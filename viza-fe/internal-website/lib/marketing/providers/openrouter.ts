import type { MarketingBlogLocale, MarketingSocialPlatform } from "../contracts";

export class MarketingProviderConfigError extends Error {}

function config() {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  const model = process.env.VIZA_MARKETING_OPENROUTER_MODEL?.trim();
  if (!apiKey) throw new MarketingProviderConfigError("OPENROUTER_API_KEY is not configured");
  if (!model) throw new MarketingProviderConfigError("VIZA_MARKETING_OPENROUTER_MODEL is not configured");
  return { apiKey, model };
}

function extractJson(value: string): Record<string, unknown> {
  const cleaned = value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const parsed: unknown = JSON.parse(cleaned);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Provider returned invalid JSON");
  return parsed as Record<string, unknown>;
}

async function generate(system: string, prompt: string, grounded = false): Promise<{ json: Record<string, unknown>; model: string }> {
  const { apiKey, model } = config();
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
  return { json: extractJson(content), model };
}

export async function generateBlogDraft(locale: MarketingBlogLocale, brief: string) {
  const language = locale === "zh-CN" ? "Simplified Chinese" : "English";
  return generate(
    `You are VIZA's visa and travel editorial assistant. Write only factual, cautious content in ${language}. Never invent official requirements; explicitly direct readers to official sources when facts may change. Return JSON only.`,
    `Create a publish-ready blog draft from this brief: ${brief}\nResearch current claims before writing. Prefer official government sources, include a Sources section with direct URLs, label uncertainty, and never invent requirements. Return keys: slug, title, excerpt, bodyMarkdown, category, seoTitle, seoDescription. The slug must be lowercase ASCII kebab-case.`,
    true,
  );
}

export async function generateSocialCopy(input: { brief: string; platforms: readonly MarketingSocialPlatform[]; destinationUrl?: string }) {
  return generate(
    "You are VIZA's social editor. Produce concise, accurate platform-specific copy. Never claim guaranteed visa outcomes. Return JSON only and do not include credentials or account identifiers.",
    `Brief: ${input.brief}\nPlatforms: ${input.platforms.join(", ")}\nDestination: ${input.destinationUrl ?? "none"}\nReturn an object with a platformContent object keyed exactly by each requested platform.`,
  );
}
