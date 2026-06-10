import type { VisaContent } from "./types";

/**
 * India e-Tourist Visa (e-Visa).
 *
 * Content reflects the Indian e-Tourist Visa (30-day, double-entry) applied
 * through the Indian government's official e-Visa portal. The system processes
 * applications entirely online — no in-person appointment is required for the
 * standard tourist e-Visa.
 *
 * Date-checked: 2026-06-10 against indianvisaonline.gov.in (evisa/tvoa.html).
 * — No 60-day variant exists. Corrected to the 30-day double-entry variant (e-T1V).
 * — Other variants confirmed: 1-year multiple-entry (max 180 days/yr), 5-year
 *   multiple-entry (max 180 days/yr), 6-month single-entry.
 * — Photo background: "plain light colored or white background" per official portal.
 * — Earliest application: minimum 4 days before arrival; no stated outer limit for
 *   30-day variant (120-day advance window applies to 1-year/5-year only).
 *   Ops/legal should confirm the advance-application window for 30-day before publish.
 *
 * IMPORTANT: India offers multiple e-Tourist Visa variants (30-day double-entry,
 * 1-year multiple-entry, 5-year multiple-entry, 6-month single-entry). This file
 * covers the 30-day double-entry variant. Fees, validity windows, and processing
 * times change periodically. Ops/legal must verify all specifics against
 * indianvisaonline.gov.in before publishing.
 */
export const india: VisaContent = {
  slug: "india",

  heroTitle: "India e-Tourist Visa",
  lede: "An online e-Tourist Visa granting 30 days of stay from first arrival, with double entry and no in-person appointment required.",
  heroImage: "/assets/heroes/india.jpg",
  meta: [
    { k: "Type", v: "e-Visa (Tourist)" },
    { k: "Length of stay", v: "30 days" },
    { k: "Validity", v: "30 days from first arrival" },
    { k: "Entry", v: "Double" },
  ],
  tags: [
    { icon: "bolt", label: "Fully online" },
    { icon: "shield", label: "On-time guarantee" },
    { icon: "doc", label: "Minimal documents" },
  ],

  overviewTitle: "India, at a glance",
  overviewSub:
    "The e-Tourist Visa lets you visit India for tourism, casual business visits, short medical treatment, and attending conferences — entirely online.",
  glance: [
    { icon: "globe", k: "Capital", v: "New Delhi", sub: "UTC +5:30 (IST)" },
    { icon: "clock", k: "Best time to visit", v: "Oct – Mar", sub: "Cool, dry season across most regions" },
    { icon: "currency", k: "Currency", v: "Indian Rupee (INR)", sub: "Widely accepted; cards available in cities" },
    { icon: "pin", k: "Top destinations", v: "Delhi · Mumbai · Jaipur", sub: "Plus Agra, Kerala, Varanasi, Goa" },
  ],

  processTitle: "How the e-Visa process works",
  processSub:
    "Submit once. We verify your documents and submit directly to the Indian government portal, tracking the decision and delivering your ETA to your inbox.",
  steps: [
    {
      title: "Apply on VIZA",
      body: "Upload your passport, photo, and travel dates. Your consultant checks all fields against India's e-Visa requirements before submission — no consulate visit needed.",
    },
    {
      title: "Your documents are verified",
      body: "Your VIZA consultant cross-checks every field against the government portal's requirements, then submits the application on your behalf.",
    },
    {
      title: "Application processed by Indian Immigration",
      body: "The Bureau of Immigration reviews the application. We monitor the portal for updates and flag any requests for additional information.",
      statusRows: [
        { label: "Application submitted to portal", ts: "20 Jun, 10:15 AM", onTime: true },
        { label: "Forwarded for background check", ts: "20 Jun, 2:30 PM", onTime: true },
        { label: "Awaiting final approval", ts: "In progress" },
      ],
    },
    {
      title: "Receive your e-Visa on 23 Jun",
      body: "Your Electronic Travel Authorisation (ETA) arrives by email and in your VIZA app. Print it or save it — you'll need it at the immigration counter.",
      delivered: true,
    },
  ],

  docsTitle: "Required documents",
  docsSub:
    "The Indian government portal has strict photo and passport scan requirements. Your VIZA consultant verifies every item — re-uploads are unlimited and free.",
  documents: [
    { name: "Passport bio page", sub: "Valid for 6+ months from the date of arrival · clear scan" },
    { name: "Recent photograph", sub: "Plain white background · last 6 months · square format" },
    { name: "Return or onward ticket", sub: "Must show departure within the visa validity period" },
    { name: "Proof of sufficient funds", sub: "Bank statement or equivalent showing adequate funds for the stay" },
  ],

  rejectionTitle: "Why e-Visa applications get rejected",
  rejectionSub:
    "The Indian Bureau of Immigration screens for these issues. VIZA flags them before you submit.",
  rejectionReasons: [
    {
      title: "Non-compliant photograph",
      body: "Photos that do not meet the strict white-background, full-face, square-format requirements are among the most common rejection causes.",
    },
    {
      title: "Passport validity",
      body: "Passports that expire within 6 months of the intended date of arrival in India, or that do not have at least two blank pages.",
    },
    {
      title: "Previous visa violations",
      body: "Prior overstays, deportations, or visa violations from any country that are flagged during the background clearance process.",
    },
  ],

  entryTitle: "Entry & exit regulations",
  entrySub:
    "Carry your e-Visa ETA printout or digital copy, return ticket, and accommodation details. Entry is permitted only at designated airports and seaports listed on the e-Visa.",
  entryExit: [
    { icon: "refresh", k: "Entry", v: "Double", sub: "Valid at designated e-Visa airports & seaports" },
    { icon: "clock", k: "Stay up to", v: "30 days", sub: "From the date of first arrival in India" },
  ],

  extensionTitle: "Visa extension & overstays",
  extensionSub:
    "e-Tourist Visas are generally not extendable. Any extension requires applying to the Foreigners Regional Registration Office (FRRO) in India and is granted only in exceptional circumstances.",
  extension: [
    { icon: "extend", k: "Extension", v: "Via FRRO only", sub: "Exceptional circumstances; not guaranteed" },
    { icon: "alert", k: "Overstay penalty", v: "Deportation & ban", sub: "Future visa refusals likely; legal action possible" },
  ],

  reviews: {
    score: "4.6",
    outOf: "/ 5",
    sub: "Highest rated visa platform · 12,841 reviews",
    platforms: [
      { rating: "4.7", name: "Trustpilot" },
      { rating: "4.6", name: "App Store" },
    ],
    items: [
      {
        initials: "DK",
        name: "David Kwan",
        source: "Trustpilot · 6 days ago",
        title: "India e-Visa in 3 days, done right",
        body: "The government portal is confusing on its own. VIZA handled the photo formatting and submitted everything — ETA arrived in under 72 hours.",
      },
      {
        initials: "SR",
        name: "Siti Rahman",
        source: "App Store · 1 week ago",
        title: "Photo issue caught before it was a problem",
        body: "My photo had the wrong background and the consultant flagged it immediately. Resubmitted the same day, visa came through without a hitch.",
      },
    ],
  },

  faqSub:
    "Can't find an answer? Ask the AI assistant at the bottom of this page or message your VIZA consultant.",
  faq: [
    {
      category: "General information",
      q: "What can I do on an India e-Tourist Visa?",
      a: "The e-Tourist Visa permits tourism, sightseeing, casual business visits (no paid work), short yoga/wellness programmes, and attending conferences. Medical visits require a separate e-Medical Visa.",
    },
    {
      category: "General information",
      q: "Does the e-Visa cover all entry ports in India?",
      a: "No. The e-Tourist Visa is valid only at designated airports and seaports approved for e-Visa entry. The full list is published on indianvisaonline.gov.in. Land border crossings are generally not included.",
    },
    {
      category: "Application process",
      q: "How long does the e-Visa take to process?",
      a: "Standard processing takes 72 hours from submission, though approvals can arrive sooner. Apply at least 4 days before your intended arrival date. The 30-day double-entry e-Tourist Visa is non-extendable and non-convertible once issued.",
    },
    {
      category: "Application process",
      q: "Can I apply for my whole family at once?",
      a: "Each traveller requires a separate e-Visa application with their own passport and photograph. VIZA can manage multiple applications simultaneously so your family travels on the same timeline.",
    },
    {
      category: "Refunds, rejections & reapplications",
      q: "What happens if my e-Visa application is rejected?",
      a: "The Indian government fee is non-refundable. VIZA's processing fee is fully refunded. Your consultant will review the rejection reason and advise on correcting any issues before you reapply. Reapplication is generally permitted after resolving the flagged issue.",
    },
  ],

  sources: [
    { label: "India e-Visa — official government portal", url: "https://indianvisaonline.gov.in/", display: "indianvisaonline.gov.in" },
    { label: "Bureau of Immigration, India — Ministry of Home Affairs", url: "https://boi.gov.in/", display: "boi.gov.in" },
  ],

  price: {
    etaLabel: "Apply now, get it by",
    etaValue: "23 Jun 2026, 03:00 PM",
    title: "e-Tourist Visa · 30-day stay",
    saving: "Fully online — no consulate visit",
    sub: "All-inclusive of document review, photo check, and on-time guarantee.",
    foot: "Government visa fee is collected at checkout and submitted to indianvisaonline.gov.in; VIZA's service fee covers document preparation, photo compliance, and status monitoring.",
  },

  aiPlaceholder: "Ask anything about India e-Visas — documents, photo requirements, entry ports…",
};

export default india;
