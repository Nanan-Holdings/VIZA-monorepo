/**
 * Rich, data-driven visa page content model.
 *
 * This is the content layer the package CLAUDE.md describes (`lib/visa-content/
 * {country}.ts`). Every launched country supplies one `VisaContent` object;
 * `components/VisaCountryRich.tsx` renders all 9 sections + sticky price card
 * from it, so every `/visa/<slug>` page is the same polished layout with its
 * own information (replaces the old bespoke Indonesia page + thin template
 * split).
 *
 * Structural section labels (the section-tab strip) come from the `visa` i18n
 * namespace; the per-country prose below is authored English-first. A localized
 * (zh-CN) variant can be layered on later without changing this schema.
 *
 * Icon names map to the registry in `components/VisaCountryRich.tsx` (`ICONS`).
 * Keep new icon names in sync with that map.
 */

export type IconName =
  | "globe"
  | "clock"
  | "currency"
  | "pin"
  | "refresh"
  | "extend"
  | "alert"
  | "calendar"
  | "ban"
  | "doc"
  | "photo"
  | "plane"
  | "hotel"
  | "bolt"
  | "shield";

/** Hero key/value chip (Type / Length of stay / Validity / Entry). */
export interface MetaItem {
  k: string;
  v: string;
}

/** Hero trust tag (icon + short label). */
export interface HeroTag {
  icon: IconName;
  label: string;
}

/** "At a glance" / entry-exit / extension card (icon + key/value + sub). */
export interface GlanceItem {
  icon: IconName;
  k: string;
  v: string;
  sub?: string;
}

/** A live-tracking sub-row shown under a process step. */
export interface StatusRow {
  label: string;
  /** Display timestamp or "In progress". */
  ts: string;
  /** Show the green "On time" badge. */
  onTime?: boolean;
}

/** A numbered step in the "how it works" timeline. */
export interface ProcessStep {
  title: string;
  body: string;
  /** Marks the final delivered step (green number). */
  delivered?: boolean;
  statusRows?: StatusRow[];
}

/** Required-document row. */
export interface DocItem {
  name: string;
  sub: string;
}

/** Rejection reason / eligibility blocker. */
export interface Reason {
  title: string;
  body: string;
}

/** A single testimonial. */
export interface Review {
  /** Avatar initials, e.g. "PL". */
  initials: string;
  name: string;
  /** e.g. "Trustpilot · 3 days ago". */
  source: string;
  title: string;
  body: string;
}

/** Aggregate reviews block. */
export interface ReviewsBlock {
  score: string;
  outOf?: string;
  sub: string;
  platforms: { rating: string; name: string }[];
  items: Review[];
}

/** FAQ entry, grouped by `category` in render order. */
export interface FaqItem {
  category: string;
  q: string;
  a: string;
}

/** Official source link. */
export interface Source {
  label: string;
  url: string;
  /** Display host, e.g. "evisa.imigrasi.go.id". */
  display: string;
}

/**
 * Sticky price card copy. The numeric government / VIZA / total rows are NOT
 * stored here — they are computed from `lib/pricing.ts` (`priceBreakdownSgd`)
 * via the country's visa type, so displayed prices always match the canonical
 * pricing mirror and never drift per country.
 */
export interface PriceCard {
  etaLabel: string;
  etaValue: string;
  title: string;
  saving?: string;
  sub: string;
  foot: string;
}

export interface VisaContent {
  /** Must match `CountryMeta.slug` in lib/countries.ts. */
  slug: string;

  // ---- Hero ----
  heroTitle: string;
  /** e.g. "for Singapore passports" — rendered on its own line. */
  heroTitleSuffix?: string;
  lede: string;
  /** Local image path under /public, e.g. "/assets/heroes/indonesia.jpg". */
  heroImage: string;
  meta: MetaItem[];
  tags: HeroTag[];

  // ---- Overview ----
  overviewTitle: string;
  overviewSub: string;
  glance: GlanceItem[];

  // ---- Process ----
  processTitle: string;
  processSub: string;
  steps: ProcessStep[];

  // ---- Documents ----
  docsTitle: string;
  docsSub: string;
  documents: DocItem[];

  // ---- Rejection reasons ----
  rejectionTitle: string;
  rejectionSub: string;
  rejectionReasons: Reason[];

  // ---- Entry & exit ----
  entryTitle: string;
  entrySub: string;
  entryExit: GlanceItem[];

  // ---- Extension ----
  extensionTitle: string;
  extensionSub: string;
  extension: GlanceItem[];

  // ---- Reviews ----
  reviews: ReviewsBlock;

  // ---- FAQ ----
  faqSub: string;
  faq: FaqItem[];

  // ---- Sources ----
  sources: Source[];

  // ---- Price card ----
  price: PriceCard;

  /** AI helper bar placeholder, e.g. "Ask anything about Indonesia visas…". */
  aiPlaceholder: string;
}
