import type { VisaContent } from "./types";

/**
 * Egypt Tourist e-Visa content.
 * Fact-checked: 2026-06-10 against visa2egypt.gov.eg (official portal).
 *
 * Confirmed:
 *  - Single-entry: 90-day validity from issue, 30-day max stay.
 *  - Multiple-entry: 180-day validity from issue, 30-day max stay per visit.
 *  - Overstay: tiered lump-sum structure (not a per-day flat rate); starts
 *    at ~EGP 1,503 for a 1–3-month overstay in year one. Figure changes
 *    annually — ops/legal to verify current EGP amounts before publishing.
 *  - Official portal visa2egypt.gov.eg confirmed live.
 *  - interior.gov.eg confirmed as secondary official source.
 *
 * OPS NOTE: The lede and meta describe the single-entry terms (90-day
 * validity). Multiple-entry validity is 180 days — consider surfacing this
 * distinction more clearly in a future content pass.
 */
export const egypt: VisaContent = {
  slug: "egypt",

  heroTitle: "Egypt e-Visa",
  lede: "A single-entry or multiple-entry tourist e-Visa with a 30-day stay per entry. Single-entry valid 90 days from issue; multiple-entry valid 180 days. Filed and tracked end-to-end by your VIZA consultant.",
  heroImage: "/assets/heroes/egypt.avif",
  meta: [
    { k: "Type", v: "e-Visa" },
    { k: "Length of stay", v: "30 days" },
    { k: "Validity", v: "90 days (single) / 180 days (multiple)" },
    { k: "Entry", v: "Single or Multiple" },
  ],
  tags: [
    { icon: "bolt", label: "Fast track · in 48 hrs" },
    { icon: "shield", label: "On-time guarantee" },
    { icon: "doc", label: "Minimal documents" },
  ],

  overviewTitle: "Egypt, at a glance",
  overviewSub:
    "An Egypt e-Visa allows eligible passport holders to enter for tourism, sightseeing, and family visits without a prior embassy appointment.",
  glance: [
    { icon: "globe", k: "Capital", v: "Cairo", sub: "UTC +2 (Egypt Standard Time)" },
    { icon: "clock", k: "Best time to visit", v: "Oct – Apr", sub: "Mild season · 18 – 28°C" },
    { icon: "currency", k: "Currency", v: "Egyptian Pound", sub: "SGD 1 ≈ EGP 50 (approx.)" },
    { icon: "pin", k: "Top destinations", v: "Cairo · Giza · Luxor", sub: "Plus Aswan, Hurghada, Sharm el-Sheikh" },
  ],

  processTitle: "How the Egypt e-Visa process works",
  processSub:
    "Submit once. We handle every step with Egypt's e-Visa authority and notify you the moment your visa is approved.",
  steps: [
    {
      title: "Apply on VIZA",
      body: "Upload your passport bio page, a recent photo, and your travel dates. No embassy visit required.",
    },
    {
      title: "Your documents are verified",
      body: "Your VIZA consultant cross-checks every field for compliance with Egypt's e-Visa requirements, then submits directly to the portal.",
    },
    {
      title: "Your e-Visa gets processed",
      body: "We track each handoff so we can flag delays before they affect your trip.",
      statusRows: [
        { label: "Application submitted to Egypt e-Visa portal", ts: "12 Jun, 9:00 AM", onTime: true },
        { label: "Identity verification completed", ts: "12 Jun, 11:45 AM", onTime: true },
        { label: "Awaiting final approval", ts: "In progress" },
      ],
    },
    {
      title: "Get your e-Visa on 14 Jun, 02:15 PM",
      body: "The approval PDF arrives in your inbox and your VIZA app. Print it or save it to your wallet — you'll need it at immigration.",
      delivered: true,
    },
  ],

  docsTitle: "Required documents",
  docsSub:
    "Your VIZA consultant double-checks each document before submission. Re-uploads are unlimited and free.",
  documents: [
    { name: "Passport bio page", sub: "Valid for 6+ months · clear scan" },
    { name: "Recent photograph", sub: "Plain white background · last 6 months" },
    { name: "Return flight ticket", sub: "Departure within the stay window" },
    { name: "Hotel or accommodation proof", sub: "Booking confirmation · any platform" },
  ],

  rejectionTitle: "Why Egypt e-Visas get rejected",
  rejectionSub:
    "Egyptian immigration authorities may refuse an application for any of the following. VIZA flags these before you submit.",
  rejectionReasons: [
    { title: "Passport validity too short", body: "A passport that expires within 6 months of the intended arrival date will be refused." },
    { title: "Incomplete or unclear documents", body: "Blurry scans, mismatched names, or missing pages are among the most common causes of rejection." },
    { title: "Prior immigration violations", body: "Overstaying or breaching the terms of a previous Egypt visa can result in refusal." },
  ],

  entryTitle: "Entry & exit regulations",
  entrySub:
    "Carry your e-Visa approval PDF, a valid return ticket, and proof of accommodation when presenting to immigration.",
  entryExit: [
    { icon: "refresh", k: "Entry", v: "Single or Multiple", sub: "Depends on visa type selected" },
    { icon: "clock", k: "Activate within", v: "90 / 180 days", sub: "Single-entry: 90 days · Multiple-entry: 180 days from issue" },
  ],

  extensionTitle: "Visa extension & overstays",
  extensionSub:
    "Extensions may be obtained in-country through Egypt's Mogamma or relevant passport offices. Overstays carry tiered lump-sum fines that increase with duration and can affect future applications.",
  extension: [
    { icon: "extend", k: "Extension", v: "Up to 3 months", sub: "Obtainable at Mogamma, Cairo" },
    { icon: "alert", k: "Overstay fine", v: "Tiered fines apply", sub: "Penalties increase with overstay duration — see official portal" },
  ],

  reviews: {
    score: "4.6",
    outOf: "/ 5",
    sub: "Highest rated visa platform · 12,841 reviews",
    platforms: [
      { rating: "4.6", name: "Trustpilot" },
      { rating: "4.7", name: "App Store" },
    ],
    items: [
      {
        initials: "RA",
        name: "Rania Al-Hassan",
        source: "Trustpilot · 5 days ago",
        title: "Egypt e-Visa in under 2 days",
        body: "The whole process was seamless — uploaded my documents, got my approval the next morning. Couldn't have been simpler.",
      },
      {
        initials: "MT",
        name: "Marcus Tan",
        source: "App Store · 2 weeks ago",
        title: "Consultant caught a photo issue",
        body: "My passport photo had a slightly coloured background. The consultant flagged it immediately and helped me fix it before submission.",
      },
    ],
  },

  faqSub: "Can't find an answer? Ask the AI assistant at the bottom of this page.",
  faq: [
    {
      category: "General information",
      q: "What is the Egypt tourist e-Visa?",
      a: "The Egypt tourist e-Visa is an electronic pre-approved entry permit that allows eligible passport holders to visit Egypt for tourism without visiting an embassy. It is issued online and must be printed or saved digitally before travel.",
    },
    {
      category: "General information",
      q: "Is the e-Visa valid for all entry points?",
      a: "Yes — the Egypt tourist e-Visa is accepted at all international airports and the major land and sea ports of entry designated by Egypt's immigration authority.",
    },
    {
      category: "Application process",
      q: "How long does VIZA take to process an Egypt e-Visa?",
      a: "Most Egypt e-Visas are delivered within 48 hours. Filing direct with the government portal typically takes 3 – 5 business days. We back our timeline with an on-time guarantee — your money back if we're late.",
    },
    {
      category: "Application process",
      q: "Can I apply for my whole family in one order?",
      a: "Yes. Add each traveller during the application — your consultant submits them together so approvals arrive on the same timeline.",
    },
    {
      category: "Refunds, rejections & reapplications",
      q: "What happens if my Egypt e-Visa is rejected?",
      a: "Egyptian authorities retain the government fee on rejection. VIZA's service fee is fully refunded, and your consultant will review the refusal reason with you and help you reapply once any issues are resolved.",
    },
  ],

  sources: [
    { label: "Egypt e-Visa Official Portal", url: "https://visa2egypt.gov.eg", display: "visa2egypt.gov.eg" },
    { label: "Egypt Ministry of Interior — Visa Affairs", url: "https://www.interior.gov.eg", display: "interior.gov.eg" },
  ],

  price: {
    etaLabel: "Apply now, get it by",
    etaValue: "14 Jun 2026, 02:15 PM",
    title: "e-Visa · 30-day stay",
    saving: "2 days faster",
    sub: "All-inclusive of government fee, document review, and on-time guarantee.",
    foot: "Government fee and VIZA processing are collected together at checkout, backed by our on-time guarantee.",
  },

  aiPlaceholder: "Ask anything about Egypt visas — fees, processing, documents…",
};

export default egypt;
