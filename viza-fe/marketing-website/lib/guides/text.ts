/** Inline link syntax used in guide strings: [label](/visa/japan) or [label](https://...). */
export const LINK_RE = /\[([^\]]+)\]\(([^)\s]+)\)/g;

/** Plain text of a guide string, for JSON-LD and meta: the label stays, the URL goes. */
export function stripLinks(text: string): string {
  return text.replace(LINK_RE, "$1");
}
