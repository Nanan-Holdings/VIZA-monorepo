import type { VisaContent } from "./types";

/**
 * Indonesia (Bali) e-VOA for Singapore passports.
 *
 * Faithful port of the former bespoke page (app/[locale]/visa/indonesia/
 * page.tsx) into the shared data model — no content change, just relocated so
 * the dynamic route renders it like every other country.
 *
 * Visa specifics (fees, validity, document list, rejection reasons) should be
 * kept in sync with ops/government sources before publishing changes.
 */
export const indonesia: VisaContent = {
  slug: "indonesia",

  heroTitle: "Indonesia (Bali) e-VOA",
  heroTitleSuffix: "for Singapore passports",
  lede: "A single-entry electronic Visa on Arrival, valid 90 days from issue with a 30-day stay. Filed and tracked end-to-end by your VIZA consultant.",
  heroImage: "/assets/heroes/indonesia.jpg",
  meta: [
    { k: "Type", v: "e-VOA" },
    { k: "Length of stay", v: "30 days" },
    { k: "Validity", v: "90 days" },
    { k: "Entry", v: "Single" },
  ],
  tags: [
    { icon: "bolt", label: "Fast track · in 24 hrs" },
    { icon: "shield", label: "On-time guarantee" },
    { icon: "doc", label: "Minimal documents" },
  ],

  overviewTitle: "Indonesia, at a glance",
  overviewSub:
    "An e-VOA lets Singapore passport holders enter Indonesia for tourism, family visits, business meetings, or medical care.",
  glance: [
    { icon: "globe", k: "Capital", v: "Jakarta", sub: "UTC +7 (Western Indonesia)" },
    { icon: "clock", k: "Best time to visit", v: "Apr – Oct", sub: "Dry season · 27 – 32°C" },
    { icon: "currency", k: "Currency", v: "Indonesian Rupiah", sub: "SGD 1 ≈ IDR 12,250" },
    { icon: "pin", k: "Top destinations", v: "Bali · Jakarta · Lombok", sub: "Plus Yogyakarta, Mt. Bromo, Nusa Penida" },
  ],

  processTitle: "How the e-VOA process works",
  processSub:
    "Submit once. We handle every step with Indonesian Immigration and notify you the moment your visa is ready.",
  steps: [
    {
      title: "Apply on VIZA",
      body: "Upload your passport, a recent photo, and your travel dates. Pay only the government fee upfront — VIZA’s processing fee is charged on approval.",
    },
    {
      title: "Your documents are verified",
      body: "Your VIZA consultant cross-checks every field, then submits the application directly to Indonesian Immigration.",
    },
    {
      title: "Your e-VOA gets processed",
      body: "We track each handoff inside Immigration so we can flag delays before they affect your trip.",
      statusRows: [
        { label: "Application sent to Immigration supervisor", ts: "8 May, 5:45 AM", onTime: true },
        { label: "Forwarded to internal intelligence", ts: "8 May, 8:12 AM", onTime: true },
        { label: "Awaiting final approval", ts: "In progress" },
      ],
    },
    {
      title: "Get your e-VOA on 9 May, 3:03 PM",
      body: "The PDF arrives in your inbox and your VIZA app. Print it, or save it to your wallet for the entry kiosk.",
      delivered: true,
    },
  ],

  docsTitle: "Required documents",
  docsSub:
    "Your VIZA consultant double-checks each document before submission. Re-uploads are unlimited and free.",
  documents: [
    { name: "Passport bio page", sub: "Valid for 6+ months · clear scan" },
    { name: "Recent photograph", sub: "Plain background · last 6 months" },
    { name: "Return flight ticket", sub: "Departure within 30 days" },
    { name: "Hotel or accommodation proof", sub: "Booking confirmation · any platform" },
  ],

  rejectionTitle: "Why e-VOAs get rejected",
  rejectionSub:
    "Indonesian Immigration may refuse an application for any of the following. VIZA flags these before you submit.",
  rejectionReasons: [
    { title: "Expired passport", body: "Applying with a passport that has expired or expires within 6 months of arrival." },
    { title: "Criminal record", body: "Convictions or open cases that disqualify you from a tourist visa under Indonesian law." },
    { title: "Previous violations", body: "Overstaying or breaching the terms of a prior Indonesian visa within the last 5 years." },
  ],

  entryTitle: "Entry & exit regulations",
  entrySub:
    "Carry your e-VOA PDF, a valid return ticket, and proof of accommodation. The visa permits a single entry and a 30-day stay from your arrival date.",
  entryExit: [
    { icon: "refresh", k: "Entry", v: "Single", sub: "Re-entry needs a fresh visa" },
    { icon: "clock", k: "Activate within", v: "90 days", sub: "From the issue date" },
  ],

  extensionTitle: "Visa extension & overstays",
  extensionSub:
    "An e-VOA can be extended once for an additional 30 days at any Immigration office in Indonesia. Overstays incur a daily fine and can affect future applications.",
  extension: [
    { icon: "extend", k: "Extension", v: "+30 days", sub: "One-time, in-country" },
    { icon: "alert", k: "Overstay fine", v: "IDR 1,000,000 / day", sub: "≈ SGD 82 per day late" },
  ],

  reviews: {
    score: "4.5",
    outOf: "/ 5",
    sub: "Highest rated visa platform in Singapore · 12,841 reviews",
    platforms: [
      { rating: "4.6", name: "Trustpilot" },
      { rating: "4.7", name: "App Store" },
    ],
    items: [
      {
        initials: "PL",
        name: "Priya Lim",
        source: "Trustpilot · 3 days ago",
        title: "Bali e-VOA in under a day",
        body: "Submitted at 11pm, woke up to my visa PDF the next morning. The status updates inside the app made the whole thing feel transparent.",
      },
      {
        initials: "SK",
        name: "Samuel Koh",
        source: "App Store · 1 week ago",
        title: "Saved me from a refused photo",
        body: "The consultant flagged that my photo background was off and re-uploaded one for me. Wouldn’t have caught that if I filed direct.",
      },
    ],
  },

  faqSub:
    "Can’t find an answer? Ask the AI assistant at the bottom of this page or message your VIZA consultant.",
  faq: [
    {
      category: "General information",
      q: "What is an Indonesian e-VOA?",
      a: "An electronic Visa on Arrival is a 30-day, single-entry tourist visa issued by Indonesian Immigration before your trip. It replaces the paper VOA you used to get at the airport — you arrive with your visa already on file.",
    },
    {
      category: "General information",
      q: "Can I use the e-VOA for business meetings?",
      a: "Yes — the e-VOA covers tourism, family visits, transit, and short business meetings. For paid work or longer assignments, you’ll need a separate work visa.",
    },
    {
      category: "Application process",
      q: "How long does VIZA take to process an e-VOA?",
      a: "Most e-VOAs are delivered within 24 hours. Filing direct with Immigration typically takes 2 – 3 days. We back the timeline with an on-time guarantee — your money back if we’re late.",
    },
    {
      category: "Application process",
      q: "Can I apply for my whole family in one application?",
      a: "Yes. Add each traveller in the application — your consultant submits them together so they’re approved on the same timeline.",
    },
    {
      category: "Refunds, rejections & reapplications",
      q: "What happens if my e-VOA is rejected?",
      a: "Indonesian Immigration retains the government fee. VIZA’s processing fee is fully refunded, and your consultant will help you understand the rejection notice and reapply once eligible.",
    },
  ],

  sources: [
    { label: "Indonesia Official e-Visa portal", url: "https://evisa.imigrasi.go.id/", display: "evisa.imigrasi.go.id" },
    { label: "Directorate General of Immigration, Indonesia", url: "https://www.imigrasi.go.id/", display: "imigrasi.go.id" },
    { label: "Ministry of Foreign Affairs, Indonesia", url: "https://kemlu.go.id/", display: "kemlu.go.id" },
  ],

  price: {
    etaLabel: "Apply now, get it by",
    etaValue: "9 May 2026, 03:03 PM",
    title: "e-VOA · 30-day stay",
    saving: "21 hrs faster",
    sub: "All-inclusive of government fee, document review, and on-time guarantee.",
    foot: "Government fee and VIZA processing are collected together at checkout, backed by our on-time guarantee.",
  },

  aiPlaceholder: "Ask anything about Indonesia visas — fees, processing, documents…",
};

export default indonesia;
