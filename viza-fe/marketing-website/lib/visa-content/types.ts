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
  /** Platform name only, for example "Trustpilot". No relative dates. */
  source: string;
  title: string;
  body: string;
}

/** Reviews block. Only individual testimonials: no aggregate score or review totals. */
export interface ReviewsBlock {
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

/** Fields every destination page has, in both layouts. */
export interface VisaContentCore {
  /** Must match `CountryMeta.slug` in lib/countries.ts. */
  slug: string;

  // ---- Hero ----
  /** The H1. Destination pages use the keyword wording, e.g. "Japan visa from Singapore". */
  heroTitle: string;
  /** e.g. "for Singapore passports", rendered on its own line. */
  heroTitleSuffix?: string;
  /** First paragraph. Carries the primary keyword and answers "do I need a visa". */
  lede: string;
  /** Local image path under /public, e.g. "/assets/heroes/indonesia.jpg". */
  heroImage: string;
  meta: MetaItem[];
  tags: HeroTag[];

  // ---- Rejection reasons ----
  rejectionTitle: string;
  rejectionSub: string;
  rejectionReasons: Reason[];

  // ---- FAQ ----
  faqSub: string;
  /** Destination pages: 10 to 15 questions. The FAQPage JSON-LD is built from this list. */
  faq: FaqItem[];

  // ---- Sources ----
  /** Official sources actually used. Shown as links at the foot of the page. */
  sources: Source[];

  // ---- Price card ----
  price: PriceCard;

  /** AI helper bar placeholder, e.g. "Ask anything about Indonesia visas…". */
  aiPlaceholder: string;
}

/** The older 9-section layout (Indonesia, Egypt and the countries not yet moved to `DestinationContent`). */
export interface LegacyVisaContent extends VisaContentCore {
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
}

// ---------------------------------------------------------------------------------------------------------
// Destination page template (SEO plan, Phase B). Section order on the page:
//   1 At a glance          page.glance
//   2 Do you need a visa?  page.passports
//   3 Visa types           page.visaTypes
//   4 Residents            page.residents      (Singapore pass types)
//   5 Fees and time        page.fees
//   6 How to apply         page.apply          (+ steps)
//   7 Documents            page.checklist      (by applicant type)
//   8 Rejection reasons    rejectionReasons    (core)
//   9 Before you travel    page.travel
//  10 Reviewed by          page.reviewed
//  11 FAQ                  faq                 (core)
//  12 Related              page.related
//  13 Start application    CTA, from CountryMeta (checkout) or /contact (consultOnly)
// Section headings and chrome strings live in messages (`visa.dest.*`), so a country file holds only content.
// ---------------------------------------------------------------------------------------------------------

/** Box 1. The VIZA fee is always "Free" and comes from messages, so it is not stored. */
export interface DestinationGlance {
  /** e.g. "Not for Singapore passports. Yes for most other passports." */
  needVisa: string;
  /** Government fee in words, or "Set by the embassy" when it could not be confirmed. */
  govFee: string;
  processing: string;
  maxStay: string;
  /** Date the facts were last checked, written out, e.g. "25 November 2026". */
  checked: string;
}

/** A row of the passport table. The last row should be "Other passports". */
export interface PassportRow {
  passport: string;
  /** Short verdict, e.g. "Visa free, 30 days" or "Visa required". */
  status: string;
  note: string;
}

export interface TitledText {
  title: string;
  body: string;
  /** Optional internal link shown under the body (unprefixed path, for example "/arrival-cards/malaysia-mdac"). */
  href?: string;
  linkLabel?: string;
}

/** Requirements for residents of Singapore, one row per pass type (EP, S Pass, Dependant's Pass, PR, citizen). */
export interface ResidentRow {
  pass: string;
  body: string;
}

export interface FeeRow {
  item: string;
  amount: string;
  note?: string;
}

/** A checklist for one type of applicant. */
export interface ChecklistGroup {
  applicant: string;
  items: string[];
}

export interface RelatedGuide {
  label: string;
  /** Unprefixed internal path ("/blog") or an absolute URL. */
  href: string;
}

export interface DestinationPage {
  /** Global products (e-visa, ETA) are framed for any passport; embassy visas "from Singapore". Drives the title pattern. */
  framing: "global" | "singapore";
  glance: DestinationGlance;
  passports: { intro: string; rows: PassportRow[] };
  visaTypes: { intro: string; items: TitledText[] };
  residents: { intro: string; rows: ResidentRow[] };
  fees: { intro: string; rows: FeeRow[]; processing: string };
  apply: { intro: string; guided: TitledText; fullService: TitledText; steps: TitledText[] };
  checklist: { intro: string; groups: ChecklistGroup[] };
  travel: { intro: string; items: TitledText[] };
  /** "Reviewed by a VIZA consultant" line. No person's name unless one exists in the repo. */
  reviewed: { date: string; note: string };
  related: { destinations: string[]; guides: RelatedGuide[] };
}

export interface DestinationContent extends VisaContentCore {
  page: DestinationPage;
}

export type VisaContent = LegacyVisaContent | DestinationContent;

export function isDestinationContent(content: VisaContent): content is DestinationContent {
  return "page" in content;
}
