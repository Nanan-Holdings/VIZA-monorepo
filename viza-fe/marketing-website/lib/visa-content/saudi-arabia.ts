import type { VisaContent } from "./types";

/**
 * Saudi Arabia Tourist e-Visa content.
 * Fact-checked: 2026-06-10 against visa.visitsaudi.com and moi.gov.sa.
 *
 * Confirmed:
 *  - 1-year (365-day) multiple-entry, 90-day stay per visit — correct.
 *  - Travel insurance: still mandatory and bundled (SAR ~180 included in
 *    total fee of ~SAR 535); coverage up to SAR 100,000 emergency medical.
 *  - Overstay fine: SAR 100/day (corrected from incorrect SAR 10,000/day);
 *    maximum penalty up to SAR 50,000 + up to 6 months imprisonment.
 *    A 30-day grace period introduced June 2025 (via Absher/Tawasul).
 *  - visa.visitsaudi.com confirmed as official e-Visa portal.
 *
 * OPS NOTE: Grace period extension (post-June 2025) and exact current daily
 * rate should be re-verified against moi.gov.sa before each content refresh.
 */
export const saudiArabia: VisaContent = {
  slug: "saudi-arabia",

  heroTitle: "Saudi Arabia e-Visa",
  lede: "A multiple-entry tourist e-Visa, valid 365 days from issue with stays of up to 90 days per visit. Applied for online and tracked end-to-end by your VIZA consultant.",
  heroImage: "/assets/heroes/saudi-arabia.jpg",
  meta: [
    { k: "Type", v: "e-Visa" },
    { k: "Length of stay", v: "90 days per visit" },
    { k: "Validity", v: "365 days" },
    { k: "Entry", v: "Multiple" },
  ],
  tags: [
    { icon: "bolt", label: "Fast track · in 24 hrs" },
    { icon: "shield", label: "On-time guarantee" },
    { icon: "doc", label: "Minimal documents" },
  ],

  overviewTitle: "Saudi Arabia, at a glance",
  overviewSub:
    "Saudi Arabia's tourist e-Visa opens the Kingdom to eligible travellers for leisure, heritage tourism, and cultural exploration — no sponsor or prior embassy visit required.",
  glance: [
    { icon: "globe", k: "Capital", v: "Riyadh", sub: "UTC +3 (Arabia Standard Time)" },
    { icon: "clock", k: "Best time to visit", v: "Nov – Mar", sub: "Cooler season · 18 – 27°C" },
    { icon: "currency", k: "Currency", v: "Saudi Riyal", sub: "SGD 1 ≈ SAR 2.80 (approx.)" },
    { icon: "pin", k: "Top destinations", v: "Riyadh · Jeddah · AlUla", sub: "Plus Diriyah, NEOM, Red Sea coast" },
  ],

  processTitle: "How the Saudi Arabia e-Visa process works",
  processSub:
    "Submit once. We handle every step with Saudi Arabia's e-Visa authority and notify you the moment your visa is approved.",
  steps: [
    {
      title: "Apply on VIZA",
      body: "Upload your passport bio page, a recent photo, and your travel dates. No embassy appointment required.",
    },
    {
      title: "Your documents are verified",
      body: "Your VIZA consultant cross-checks every field for compliance with Saudi e-Visa requirements, then submits directly to the official portal.",
    },
    {
      title: "Your e-Visa gets processed",
      body: "We track each handoff so we can flag delays before they affect your travel plans.",
      statusRows: [
        { label: "Application submitted to Saudi e-Visa portal", ts: "13 Jun, 8:30 AM", onTime: true },
        { label: "Identity and passport verification completed", ts: "13 Jun, 11:15 AM", onTime: true },
        { label: "Awaiting final approval", ts: "In progress" },
      ],
    },
    {
      title: "Get your e-Visa on 14 Jun, 02:15 PM",
      body: "Your visa approval arrives in your inbox and VIZA app. Print it or save it digitally — you will need it at Saudi immigration.",
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

  rejectionTitle: "Why Saudi e-Visas get rejected",
  rejectionSub:
    "Saudi Arabia's e-Visa authority may refuse an application for any of the following. VIZA flags these before you submit.",
  rejectionReasons: [
    { title: "Passport validity too short", body: "A passport expiring within 6 months of the intended arrival date will not be accepted." },
    { title: "Nationality not eligible", body: "The Saudi tourist e-Visa is available to passport holders of approximately 50 eligible countries. Ineligible nationalities must apply through an embassy." },
    { title: "Prior violations or security concerns", body: "Overstaying a previous Saudi visa, prior deportation, or adverse security checks can result in an automatic refusal." },
  ],

  entryTitle: "Entry & exit regulations",
  entrySub:
    "Carry your e-Visa approval document, a valid return ticket, and hotel confirmation at all Saudi entry points. The visa is linked electronically to your passport.",
  entryExit: [
    { icon: "refresh", k: "Entry", v: "Multiple", sub: "Travel freely within the 365-day validity" },
    { icon: "clock", k: "Activate within", v: "365 days", sub: "From the date of issue" },
  ],

  extensionTitle: "Visa extension & overstays",
  extensionSub:
    "Extensions beyond the 90-day stay limit may be requested through the Absher platform or the Ministry of Interior. Overstays carry daily fines (SAR 100/day) up to a maximum of SAR 50,000, plus potential imprisonment and deportation.",
  extension: [
    { icon: "extend", k: "Extension", v: "Apply via Absher", sub: "Ministry of Interior platform" },
    { icon: "alert", k: "Overstay fine", v: "SAR 100 / day", sub: "Max SAR 50,000 · imprisonment possible — see moi.gov.sa" },
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
        initials: "FN",
        name: "Fatima Noor",
        source: "Trustpilot · 4 days ago",
        title: "Saudi e-Visa approved overnight",
        body: "Applied in the evening, woke up to my visa approval. The process was completely straightforward — all status updates were visible in the VIZA app.",
      },
      {
        initials: "KL",
        name: "Kevin Lim",
        source: "App Store · 2 weeks ago",
        title: "Consultant made it stress-free",
        body: "I wasn't sure which documents were required. The consultant walked me through everything step by step and handled the submission for me.",
      },
    ],
  },

  faqSub: "Can't find an answer? Ask the AI assistant at the bottom of this page.",
  faq: [
    {
      category: "General information",
      q: "What is the Saudi Arabia tourist e-Visa?",
      a: "Saudi Arabia's tourist e-Visa is a multiple-entry, electronically issued permit that allows eligible passport holders to visit the Kingdom for leisure, culture, and heritage tourism. No embassy visit or sponsor is required.",
    },
    {
      category: "General information",
      q: "Does the e-Visa include travel insurance?",
      a: "Yes — Saudi Arabia's tourist e-Visa includes mandatory travel insurance as part of the visa fee. The policy covers emergency medical expenses during the stay.",
    },
    {
      category: "Application process",
      q: "How long does VIZA take to process a Saudi e-Visa?",
      a: "Most Saudi tourist e-Visas are approved within 24 hours. Applying direct through the government portal typically takes 1 – 3 business days. We back our timeline with an on-time guarantee — your money back if we're late.",
    },
    {
      category: "Application process",
      q: "Can I apply for my whole family in one order?",
      a: "Yes. Add each traveller during the application — your consultant submits them together so approvals arrive on the same timeline.",
    },
    {
      category: "Refunds, rejections & reapplications",
      q: "What happens if my Saudi e-Visa is rejected?",
      a: "Saudi authorities retain the government fee on rejection. VIZA's service fee is fully refunded. Your consultant will review the refusal reason with you and help you assess whether a reapplication or embassy application is the right next step.",
    },
  ],

  sources: [
    { label: "Saudi eVisa Official Portal", url: "https://visa.visitsaudi.com", display: "visa.visitsaudi.com" },
    { label: "Visit Saudi — Tourism & Visa Information", url: "https://www.visitsaudi.com", display: "visitsaudi.com" },
    { label: "Saudi Ministry of Interior — Absher Platform", url: "https://absher.sa", display: "absher.sa" },
  ],

  price: {
    etaLabel: "Apply now, get it by",
    etaValue: "14 Jun 2026, 02:15 PM",
    title: "e-Visa · 365-day validity · 90-day stays",
    saving: "1 day faster",
    sub: "All-inclusive of government fee, travel insurance, document review, and on-time guarantee.",
    foot: "Government fee and VIZA processing are collected together at checkout, backed by our on-time guarantee.",
  },

  aiPlaceholder: "Ask anything about Saudi Arabia visas — fees, processing, documents…",
};

export default saudiArabia;
