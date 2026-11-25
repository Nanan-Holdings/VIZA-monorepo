/** One legal document in one language. Inline links use the [label](href) form that components/GuideText.tsx renders. */
export type LegalBlock =
  | { t: "p"; text: string }
  | { t: "ul"; items: string[] }
  | { t: "facts"; rows: Array<[string, string]> }
  | { t: "note"; text: string };

export interface LegalSection {
  id: string;
  /** Heading including its number, for example "1. Who we are". */
  heading: string;
  blocks: LegalBlock[];
}

export interface LegalDoc {
  /** The page H1. */
  title: string;
  /** Short line beside the title. */
  lede: string;
  sections: LegalSection[];
}

export type LegalSlug = "terms" | "privacy" | "refunds" | "business-information";
export const LEGAL_UPDATED = "2026-11-26";

export const p = (text: string): LegalBlock => ({ t: "p", text });
export const ul = (...items: string[]): LegalBlock => ({ t: "ul", items });
export const facts = (...rows: Array<[string, string]>): LegalBlock => ({ t: "facts", rows });
export const note = (text: string): LegalBlock => ({ t: "note", text });
