"use client";

import { useMemo, useState } from "react";
import { renderHelpMarkdown } from "@/lib/help/render";
import type { LoadedArticle } from "@/lib/help";

export function HelpClient({ articles }: { articles: LoadedArticle[] }) {
  const [query, setQuery] = useState("");
  const [activeKey, setActiveKey] = useState<string>(
    articles[0] ? `${articles[0].country}|${articles[0].visaType ?? ""}` : "",
  );

  const visible = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (q.length < 2) return articles;
    return articles.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.body.toLowerCase().includes(q),
    );
  }, [articles, query]);

  const active =
    visible.find((a) => `${a.country}|${a.visaType ?? ""}` === activeKey) ??
    visible[0] ??
    null;

  return (
    <div className="space-y-4">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search FAQs"
        className="w-full px-3 py-2 border rounded text-sm"
      />
      <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-4">
        <ul className="space-y-1">
          {visible.map((a) => {
            const k = `${a.country}|${a.visaType ?? ""}`;
            const sel = active && `${active.country}|${active.visaType ?? ""}` === k;
            return (
              <li key={k}>
                <button
                  type="button"
                  onClick={() => setActiveKey(k)}
                  className={`w-full text-left px-3 py-2 rounded text-sm ${
                    sel ? "bg-black text-white" : "hover:bg-[#fafafa]"
                  }`}
                >
                  {a.title}
                </button>
              </li>
            );
          })}
        </ul>
        <article className="bg-white rounded-lg border border-[#efefef] shadow-sm p-5 prose prose-sm max-w-none text-[#232323]">
          {active ? (
            <div
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: renderHelpMarkdown(active.body) }}
            />
          ) : (
            <p className="text-sm text-[#9ca3af]">No matching articles.</p>
          )}
        </article>
      </div>
    </div>
  );
}
