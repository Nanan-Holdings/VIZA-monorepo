"use server";

import { searchHelpArticles, type LoadedArticle } from "@/lib/help";

/**
 * Help-search server action (CS-004).
 *
 * Used by the chat-client `/client/chat` to surface suggested
 * replies when the applicant types a question. The chat layer
 * shows the top matching articles with a one-line snippet and a
 * link out to /client/help/articles for the full content.
 */

export interface HelpSuggestion {
  country: string;
  visaType?: string;
  title: string;
  /** First non-empty paragraph of the body, capped at ~240 chars. */
  snippet: string;
}

function snippetOf(body: string): string {
  const lines = body.split(/\r?\n/);
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    return t.slice(0, 240) + (t.length > 240 ? "…" : "");
  }
  return "";
}

export async function searchHelp(query: string): Promise<HelpSuggestion[]> {
  const hits: LoadedArticle[] = searchHelpArticles(query);
  return hits.slice(0, 3).map((a) => ({
    country: a.country,
    visaType: a.visaType,
    title: a.title,
    snippet: snippetOf(a.body),
  }));
}
