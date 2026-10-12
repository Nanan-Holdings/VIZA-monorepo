import type { NewsStory, RankedNewsStory } from "./types";

export type CompleteRanking = (system: string, user: string) => Promise<unknown>;

function rankings(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object" && "rankings" in value && Array.isArray(value.rankings)) return value.rankings;
  throw new Error("News ranking model returned no rankings");
}

/** Keep late-arriving trade and Reddit feeds in the ranker's bounded prompt. */
function balancedCandidates(stories: NewsStory[], limit: number): NewsStory[] {
  const byFeed = new Map<string, NewsStory[]>();
  for (const story of stories) {
    const group = byFeed.get(story.feed);
    if (group) group.push(story);
    else byFeed.set(story.feed, [story]);
  }
  const candidates: NewsStory[] = [];
  let depth = 0;
  while (candidates.length < limit) {
    let added = false;
    for (const group of byFeed.values()) {
      if (candidates.length >= limit) break;
      const story = group[depth];
      if (!story) continue;
      candidates.push(story);
      added = true;
    }
    if (!added) break;
    depth++;
  }
  return candidates;
}

/** The model ranks candidates; this function validates every returned ID and score. */
export async function rankNewsStories(
  stories: NewsStory[],
  options: { coveredTitles: string[]; relevanceRules: string[]; businessDescription: string },
  completeJson: CompleteRanking,
): Promise<RankedNewsStory[]> {
  if (!stories.length) return [];
  const candidates = balancedCandidates(stories, 120);
  const system = [
    "You are VIZA's visa and travel news editor. Score source stories for usefulness to visa applicants and international travellers.",
    options.businessDescription,
    "Use the headline and summary only for selection. Do not infer official requirements from them.",
    "Score near duplicates of already covered stories 0. A Reddit discussion is a popularity signal, not an official source.",
    ...options.relevanceRules.map((rule) => `- ${rule}`),
  ].join("\n");
  const user = [
    "ALREADY COVERED:",
    ...options.coveredTitles.map((title) => `- ${title}`),
    "CANDIDATES:",
    ...candidates.map((story, index) => `[${index + 1}] ${story.title} | ${story.source} | ${story.publishedAt?.slice(0, 10) ?? "undated"} | ${story.summary.slice(0, 220)}`),
    'Return JSON only: {"rankings":[{"id":1,"score":75,"reason":"one sentence"}]}. Rank the 10 strongest candidates, best first. Scores are integers from 0 to 100.',
  ].join("\n");
  const raw = rankings(await completeJson(system, user));
  const seen = new Set<number>();
  const ranked: RankedNewsStory[] = [];
  for (const value of raw) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const row = value as Record<string, unknown>;
    const id = Number(row.id);
    const score = Number(row.score);
    if (!Number.isInteger(id) || id < 1 || id > candidates.length || seen.has(id) || !Number.isFinite(score)) continue;
    seen.add(id);
    ranked.push({
      story: candidates[id - 1],
      score: Math.max(0, Math.min(100, Math.round(score))),
      reason: typeof row.reason === "string" ? row.reason.slice(0, 400) : "",
    });
  }
  return ranked.sort((a, b) => b.score - a.score);
}
