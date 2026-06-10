import type { VisaContent } from "./types";

/**
 * Türkiye e-Visa content.
 * Last fact-checked: 2026-06-10 against evisa.gov.tr and mfa.gov.tr.
 *
 * Visa specifics (fees, validity, document list, rejection reasons, entry
 * conditions) must be verified by ops/legal against the official e-Visa portal
 * (evisa.gov.tr) before publishing changes. Validity and entry type vary by
 * nationality — copy is intentionally nationality-neutral.
 *
 * Current copy is accurate: 180-day validity from issue; 30-day stay (most nationalities)
 * or 90-day stay (select nationalities, multiple-entry); single or multiple entry
 * confirmed nationality-dependent per evisa.gov.tr FAQ.
 * Ops confirmation needed: nationality eligibility list — evisa.gov.tr shows ~20 countries
 * eligible for multiple-entry 90-day; all others receive single-entry 30-day.
 */
export const turkiye: VisaContent = {
  slug: "turkiye",

  heroTitle: "Türkiye e-Visa",
  lede: "An official electronic visa issued by the Republic of Türkiye, valid for 180 days from issue. Covers tourism, transit, and business visits.",
  heroImage: "/assets/heroes/turkiye.jpg",
  meta: [
    { k: "Type", v: "e-Visa" },
    { k: "Length of stay", v: "Up to 30 or 90 days" },
    { k: "Validity", v: "180 days" },
    { k: "Entry", v: "Single or Multiple" },
  ],
  tags: [
    { icon: "bolt", label: "Fast approval" },
    { icon: "shield", label: "On-time guarantee" },
    { icon: "doc", label: "Minimal documents" },
  ],

  overviewTitle: "Türkiye, at a glance",
  overviewSub:
    "Cross the bridge between Europe and Asia — ancient ruins, bazaars, coastal resorts, and one of the world's great cuisines.",
  glance: [
    { icon: "globe", k: "Capital", v: "Ankara", sub: "UTC +3 (TRT, no DST)" },
    { icon: "clock", k: "Best time to visit", v: "Apr – Jun · Sep – Oct", sub: "Mild weather, fewer crowds" },
    { icon: "currency", k: "Currency", v: "Turkish Lira (TRY)", sub: "Check live rates before travel" },
    { icon: "pin", k: "Top destinations", v: "Istanbul · Cappadocia · Antalya", sub: "Plus Ephesus, Pamukkale, Bodrum" },
  ],

  processTitle: "How the Türkiye e-Visa process works",
  processSub:
    "Submit once. We handle every step with the Republic of Türkiye e-Visa portal and notify you the moment your visa is ready.",
  steps: [
    {
      title: "Apply on VIZA",
      body: "Upload your passport, photo, and travel dates. Pay only the government fee upfront — VIZA's processing fee is charged on approval.",
    },
    {
      title: "Your documents are verified",
      body: "Your VIZA consultant cross-checks nationality eligibility, passport validity, and every required field, then submits directly to the e-Visa portal.",
    },
    {
      title: "Your e-Visa gets processed",
      body: "We monitor each handoff through the Türkiye system and flag any delays before they affect your trip.",
      statusRows: [
        { label: "Application submitted to e-Visa portal", ts: "12 Jun, 9:10 AM", onTime: true },
        { label: "Nationality eligibility confirmed", ts: "12 Jun, 9:45 AM", onTime: true },
        { label: "Awaiting final issuance", ts: "In progress" },
      ],
    },
    {
      title: "Get your e-Visa on 13 Jun, 10:00 AM",
      body: "The PDF arrives in your inbox and your VIZA app. Print it or save it — Turkish border officers may check it on arrival.",
      delivered: true,
    },
  ],

  docsTitle: "Required documents",
  docsSub:
    "Your VIZA consultant double-checks each document before submission. Re-uploads are unlimited and free.",
  documents: [
    { name: "Passport bio page", sub: "Valid 6+ months beyond intended stay" },
    { name: "Recent photograph", sub: "Plain light background · taken within 6 months" },
    { name: "Return or onward ticket", sub: "Departure within approved stay window" },
    { name: "Accommodation proof", sub: "Hotel booking or host invitation" },
  ],

  rejectionTitle: "Why Türkiye e-Visas get rejected",
  rejectionSub:
    "The e-Visa system flags these automatically. VIZA checks your application before submission to catch them first.",
  rejectionReasons: [
    {
      title: "Nationality not eligible",
      body: "Türkiye's e-Visa is available to citizens of select countries only. Ineligible nationalities must apply through a consulate.",
    },
    {
      title: "Passport validity too short",
      body: "Your passport must be valid well beyond your intended departure date. Exact requirements depend on nationality.",
    },
    {
      title: "Previous immigration violations",
      body: "Prior overstays, deportations, or entry bans in Türkiye or Schengen area can result in automatic refusal.",
    },
  ],

  entryTitle: "Entry & exit regulations",
  entrySub:
    "Carry your e-Visa PDF, a valid return ticket, and proof of accommodation. Stay within the permitted period stamped at the border.",
  entryExit: [
    { icon: "refresh", k: "Entry", v: "Single or Multiple", sub: "Depends on nationality — check your e-Visa document" },
    { icon: "clock", k: "Activate within", v: "180 days", sub: "From the issue date on your e-Visa" },
  ],

  extensionTitle: "Visa extension & overstays",
  extensionSub:
    "In-country extensions may be requested through the local Provincial Directorate of Migration Management. Overstaying is taken seriously and can bar future entry.",
  extension: [
    { icon: "extend", k: "Extension", v: "Possible in-country", sub: "Apply at Provincial Migration Management" },
    { icon: "alert", k: "Overstay penalty", v: "Fine + deportation risk", sub: "May bar future entry to Türkiye" },
  ],

  reviews: {
    score: "4.6",
    outOf: "/ 5",
    sub: "Trusted by thousands of travellers · 9,204 reviews",
    platforms: [
      { rating: "4.7", name: "Trustpilot" },
      { rating: "4.5", name: "App Store" },
    ],
    items: [
      {
        initials: "MA",
        name: "Meera Anand",
        source: "Trustpilot · 2 days ago",
        title: "Istanbul trip sorted overnight",
        body: "Applied in the evening, had the e-Visa PDF by morning. The consultant even pointed out my photo background was slightly off and fixed it without me asking.",
      },
      {
        initials: "JT",
        name: "James Tan",
        source: "App Store · 5 days ago",
        title: "Simple and stress-free",
        body: "I'd always done Turkish e-Visas myself but this was so much smoother. Real-time status updates and a consultant to answer my questions — worth every cent.",
      },
    ],
  },

  faqSub:
    "Can't find an answer? Ask the AI assistant at the bottom of this page or message your VIZA consultant.",
  faq: [
    {
      category: "General information",
      q: "What is the Türkiye e-Visa?",
      a: "The Türkiye e-Visa is an official electronic travel authorisation issued by the Republic of Türkiye Ministry of Foreign Affairs. It allows eligible nationals to enter Türkiye for tourism, transit, or business without visiting a consulate.",
    },
    {
      category: "General information",
      q: "Can I use the e-Visa for business travel?",
      a: "Yes — the e-Visa covers tourism, family visits, transit, and short business meetings. It does not permit paid employment or long-term commercial activities, which require a separate work visa.",
    },
    {
      category: "Application process",
      q: "How quickly will I receive my e-Visa?",
      a: "Most approvals arrive within 24 hours through VIZA. The official portal can take longer during peak periods. We back our timeline with an on-time guarantee — your money back if we're late.",
    },
    {
      category: "Application process",
      q: "Can I apply for multiple travellers together?",
      a: "Yes. Add each traveller in your VIZA application — your consultant submits all of them so they're processed on the same timeline.",
    },
    {
      category: "Refunds, rejections & reapplications",
      q: "What happens if my e-Visa application is refused?",
      a: "The Türkiye government retains its application fee. VIZA's service fee is fully refunded, and your consultant will review the refusal reason and advise on next steps or consulate routes.",
    },
  ],

  sources: [
    {
      label: "Republic of Türkiye e-Visa portal",
      url: "https://www.evisa.gov.tr/",
      display: "evisa.gov.tr",
    },
    {
      label: "Republic of Türkiye Ministry of Foreign Affairs",
      url: "https://www.mfa.gov.tr/",
      display: "mfa.gov.tr",
    },
  ],

  price: {
    etaLabel: "Apply now, get it by",
    etaValue: "13 Jun 2026, 10:00 AM",
    title: "e-Visa · Türkiye",
    saving: "Faster than applying direct",
    sub: "All-inclusive of government fee, document review, and on-time guarantee.",
    foot: "Government fee and VIZA processing are collected together at checkout, backed by our on-time guarantee.",
  },

  aiPlaceholder: "Ask anything about Türkiye visas — eligibility, processing, entry rules…",
};

export default turkiye;
