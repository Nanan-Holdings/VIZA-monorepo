import { Link } from "@/navigation";

export type Tab = { label: string; href: string; count?: number; current?: boolean };

/** Framer filter chips: white pills, the current one navy. Real links, so every topic page is crawlable. */
export default function FilterTabs({ tabs, label }: { tabs: Tab[]; label: string }) {
  if (tabs.length === 0) return null;
  return (
    <nav aria-label={label}>
      <ul className="ds-tabs">
        {tabs.map((t) => (
          <li key={t.href}>
            <Link href={t.href} className="ds-tab" aria-current={t.current ? "page" : undefined}>
              {t.label}
              {typeof t.count === "number" ? <small>{t.count}</small> : null}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
