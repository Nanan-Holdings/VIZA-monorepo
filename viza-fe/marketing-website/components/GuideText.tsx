import { Link } from "@/navigation";
import { LINK_RE } from "@/lib/guides/text";

/** Renders a guide string, turning [label](href) into a link (internal paths use the locale-aware Link). */
export default function GuideText({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  let n = 0;
  for (const m of text.matchAll(LINK_RE)) {
    const at = m.index ?? 0;
    if (at > last) parts.push(text.slice(last, at));
    const [, label, href] = m;
    if (href.startsWith("/") && !href.startsWith("//")) {
      parts.push(<Link key={n++} href={href}>{label}</Link>);
    } else if (/^https?:\/\//.test(href)) {
      parts.push(<a key={n++} href={href} target="_blank" rel="noreferrer">{label}</a>);
    } else if (/^mailto:/.test(href)) {
      parts.push(<a key={n++} href={href}>{label}</a>);
    } else {
      parts.push(label);
    }
    last = at + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}
