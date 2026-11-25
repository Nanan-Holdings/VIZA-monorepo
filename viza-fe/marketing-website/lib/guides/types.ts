/**
 * Evergreen guides (SEO plan, Phase D). One GuideContent per guide per language, written natively.
 * Chrome (headings, labels) lives in the `guides` messages namespace.
 *
 * Body strings may carry inline links in the form [label](/visa/japan) (internal, unprefixed English path)
 * or [label](https://...) (external). components/GuideText.tsx renders them.
 */
export interface GuideTable {
  head: string[];
  rows: string[][];
}

export interface GuideSection {
  id: string;
  heading: string;
  body: string[];
  list?: string[];
  table?: GuideTable;
}

export interface GuideContent {
  /** Finished title, 60 characters or fewer, ends in " | VIZA". */
  title: string;
  /** 160 characters or fewer, aim for about 155. */
  description: string;
  h1: string;
  lead: string;
  /** Quick answer box: three to five short key facts. */
  glance: Array<{ k: string; v: string }>;
  /** 1,500 to 2,500 words of English across lead, sections and FAQ (Chinese: natively written, similar depth). */
  sections: GuideSection[];
  faq: Array<{ q: string; a: string }>;
  sources: Array<{ label: string; url: string }>;
  /** "Checked on 25 November 2026 against ..." line. */
  reviewed: string;
}

export interface GuideMeta {
  slug: string;
  /** Short name used on cards and breadcrumbs, per language. */
  name: { en: string; zh: string };
  /** Short topic tag on the hub card, per language. */
  tag: { en: string; zh: string };
  /** One-sentence hub card summary, per language. */
  summary: { en: string; zh: string };
  /** /visa slugs this guide links to; each of those destination pages links back. */
  visa: string[];
  /** /arrival-cards slugs this guide links to. */
  arrival: string[];
  /** Words that tie a news post to this guide when the post names no matching destination (lower case). */
  topics: string[];
  /** Date the guide was first published and last reviewed (ISO). */
  published: string;
  modified: string;
}
