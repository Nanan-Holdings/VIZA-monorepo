import type { ReactNode } from "react";

export type TocItem = { id: string; label: string };

/** Contents column (sticky on desktop, a card above the text on tablet and phone) and the readable text column. */
export default function ArticleShell({ toc, tocTitle, children, id = "article" }: { toc: TocItem[]; tocTitle: string; children: ReactNode; id?: string }) {
  return (
    <div className="ds-container ds-art" id={id}>
      {toc.length > 1 ? (
        <aside className="ds-toc" aria-label={tocTitle}>
          <p className="ds-toc-title">{tocTitle}</p>
          <ol>
            {toc.map((t) => (
              <li key={t.id}>
                <a href={`#${t.id}`}>{t.label}</a>
              </li>
            ))}
          </ol>
        </aside>
      ) : (
        <div />
      )}
      <div className="ds-art-body">{children}</div>
    </div>
  );
}
