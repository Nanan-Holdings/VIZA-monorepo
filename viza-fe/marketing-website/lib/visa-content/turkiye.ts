import type { VisaContent } from "./types";

/**
 * Türkiye entry content — e-Visa + visa-free exemptions.
 * Last fact-checked: 2026-07-05 against mfa.gov.tr, evisa.gov.tr,
 * en.goc.gov.tr and mfa.gov.sg.
 *
 * Key facts baked in: Singapore AND PRC ordinary passport holders are
 * visa-exempt for 90 days per 180 (PRC exemption effective 2 Jan 2026 per
 * mfa.gov.tr). The e-Visa (evisa.gov.tr) applies only to ~50 other
 * nationalities: 180-day validity from the selected travel date, 30- or
 * 90-day stay, single or multiple entry by nationality, data-only form
 * (no photo upload), issued near-instantly. Passport rule: valid 60+ days
 * beyond the authorised stay. No ETA / digital arrival card exists.
 *
 * Items needing ops confirmation:
 * - e-Visa fee table is hidden until a nationality is selected in the portal;
 *   the commonly cited USD 20–90 range is not confirmed on an official page.
 * - Exact overstay fine tariff (TRY first-month amount + monthly increment)
 *   is not published on goc.gov.tr; only the entry-ban schedule is official.
 * - mfa.gov.tr page footer is dated 2022 despite the Jan 2026 China update —
 *   re-check periodically.
 * - Whether the PRC exemption is single-stay-90 vs cumulative-90/180 has no
 *   official clarification beyond the MFA one-liner.
 * - Residence-permit fee figures come from secondary 2026 guides, not
 *   goc.gov.tr directly.
 */
export const turkiye: VisaContent = {
  slug: "turkiye",

  heroTitle: "Türkiye e-Visa",
  heroTitleSuffix: "visa-free for Singapore & China passports",
  lede: "Singapore and Chinese passport holders enter Türkiye visa-free for up to 90 days — no e-Visa, no arrival card, just a valid passport. Other eligible nationalities get the official e-Visa in minutes, filed and verified end-to-end by VIZA.",
  heroImage: "/assets/heroes/turkiye.jpg",
  meta: [
    { k: "Type", v: "Visa-free (SG · CN) / e-Visa" },
    { k: "Length of stay", v: "Up to 90 days" },
    { k: "Validity", v: "180 days" },
    { k: "Entry", v: "Multiple" },
  ],
  tags: [
    { icon: "bolt", label: "e-Visa issued in minutes" },
    { icon: "shield", label: "On-time guarantee" },
    { icon: "photo", label: "No photo required" },
  ],

  overviewTitle: "Türkiye, at a glance",
  overviewSub:
    "Cross the bridge between Europe and Asia — ancient ruins, bazaars, coastal resorts, and one of the world's great cuisines. Singaporeans and Chinese citizens land visa-free for 90 days in any 180-day period.",
  glance: [
    { icon: "globe", k: "Capital", v: "Ankara", sub: "UTC +3 (TRT, no DST)" },
    { icon: "clock", k: "Best time to visit", v: "Apr – Jun · Sep – Oct", sub: "Mild weather, fewer crowds" },
    { icon: "currency", k: "Currency", v: "Turkish Lira (TRY)", sub: "Check live rates before travel" },
    { icon: "pin", k: "Top destinations", v: "Istanbul · Cappadocia · Antalya", sub: "Plus Ephesus, Pamukkale, Bodrum" },
  ],

  processTitle: "How Türkiye entry works with VIZA",
  processSub:
    "One check-up covers everything. Visa-exempt passports get an entry-readiness review; e-Visa nationalities are filed directly on the official portal, evisa.gov.tr.",
  steps: [
    {
      title: "Tell us your passport",
      body: "Singapore and PRC ordinary passports need no visa at all — we confirm your passport meets Türkiye's 60-days-beyond-stay validity rule and you're done. Other nationalities continue to the e-Visa.",
    },
    {
      title: "We file your e-Visa on evisa.gov.tr",
      body: "The official form is data-only — passport details and travel date, no photo or document uploads. Your VIZA consultant enters every field exactly as printed in your passport; one typo invalidates the visa at the border.",
    },
    {
      title: "Near-instant issuance",
      body: "The portal issues most e-Visas within minutes of payment. The government advises filing at least 48 hours before departure — we build that buffer in.",
      statusRows: [
        { label: "Application submitted to evisa.gov.tr", ts: "12 Jun, 9:10 AM", onTime: true },
        { label: "Government fee paid · issuance confirmed", ts: "12 Jun, 9:14 AM", onTime: true },
        { label: "Final document check", ts: "In progress" },
      ],
    },
    {
      title: "Get your e-Visa on 12 Jun, 9:32 AM",
      body: "The PDF arrives in your inbox and your VIZA app — valid 180 days from your selected travel date, for a 30- or 90-day stay depending on nationality.",
      delivered: true,
    },
  ],

  docsTitle: "Required documents",
  docsSub:
    "Türkiye's e-Visa is a data-only application — no photo, no uploads. Your VIZA consultant verifies every entry against your passport before submission.",
  documents: [
    {
      name: "Passport",
      sub: "Valid 60+ days beyond your authorised stay (≈150 days from arrival for 90 days) · blank pages · the only document Singapore & China passport holders need",
    },
    {
      name: "e-Visa application details",
      sub: "Passport data and travel date, entered at evisa.gov.tr · card payment · no photo or document uploads",
    },
    {
      name: "Return or onward ticket",
      sub: "Formally required only for conditional e-Visa nationalities · airlines may ask any traveller",
    },
    {
      name: "Hotel booking + funds of USD 50/day",
      sub: "Conditional e-Visa nationalities only · border officers can ask any traveller about means of stay",
    },
  ],

  rejectionTitle: "Why travellers get refused",
  rejectionSub:
    "Most Türkiye refusals happen at the border, not in the e-Visa system. VIZA screens every one of these before you fly.",
  rejectionReasons: [
    {
      title: "Passport validity too short",
      body: "A travel document expiring less than 60 days beyond your authorised stay is grounds for refusal of entry — that's roughly 150 days of validity from arrival for a 90-day visit.",
    },
    {
      title: "Passport / application mismatch",
      body: "The e-Visa is electronically tied to the exact passport number entered. A typo, or travelling on a renewed passport, invalidates it.",
    },
    {
      title: "90/180-day allowance exhausted",
      body: "If you've already spent 90 days in Türkiye within the past 180, you'll be refused entry or fined at the border.",
    },
    {
      title: "Conditional requirements not shown",
      body: "Conditional e-Visa nationalities must present a return ticket, hotel booking and USD 50/day — or the required valid Schengen/USA/UK/Ireland visa or residence permit — even with an e-Visa in hand.",
    },
    {
      title: "Prior entry ban or unpaid fines",
      body: "An existing prohibition-of-entry record, or an unpaid overstay fine from a previous trip, blocks re-entry until settled.",
    },
  ],

  entryTitle: "Entry & exit regulations",
  entrySub:
    "Türkiye has no digital arrival card, no ETA, and no pre-registration for visa-exempt visitors — Singapore and Chinese travellers simply present their passport at immigration.",
  entryExit: [
    { icon: "doc", k: "Arrival card", v: "None", sub: "No ETA or online form — passport only at the border" },
    { icon: "refresh", k: "Entry", v: "Multiple", sub: "Re-enter freely within the 90-days-per-180 rule" },
    { icon: "clock", k: "e-Visa window", v: "180 days", sub: "Enter within 180 days of your selected travel date" },
  ],

  extensionTitle: "Staying longer & overstays",
  extensionSub:
    "Tourist stays can't be simply extended. To stay beyond 90 days, apply online for a short-term residence permit via e-İkamet before your allowance runs out — tourism-based renewals are increasingly hard to get approved.",
  extension: [
    { icon: "extend", k: "Beyond 90 days", v: "Residence permit", sub: "Apply online at e-ikamet.goc.gov.tr · issuable up to 2 years" },
    { icon: "alert", k: "Overstay penalty", v: "Fine + entry ban", sub: "Fine payable at the airport on exit · bans from 1 month (3–6 mo overstay) up to 5 years" },
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
      q: "Do Singapore passport holders need a visa for Türkiye?",
      a: "No. Singapore ordinary and official passport holders are visa-exempt for up to 90 days within any 180-day period — no e-Visa, no ETA, no arrival card. Your passport just needs to be valid at least 60 days beyond your stay, with blank pages for stamps. VIZA runs this entry-readiness check for you before you fly.",
    },
    {
      category: "General information",
      q: "Do Chinese passport holders need a visa for Türkiye?",
      a: "Not anymore. Since 2 January 2026, PRC ordinary passport holders are visa-exempt for up to 90 days in any 180-day period (official passports: 30 days). Older Chinese-language guides saying an e-Visa or consular visa is required are outdated — China was never on the e-Visa list.",
    },
    {
      category: "General information",
      q: "Who actually needs the Türkiye e-Visa, and what does it allow?",
      a: "Citizens of roughly 50 e-Visa-eligible countries, for tourism or business. It's valid 180 days from the travel date you select, allows a 30- or 90-day stay, and is issued single- or multiple-entry depending on nationality. Ineligible nationalities apply through a Turkish consulate instead.",
    },
    {
      category: "Application process",
      q: "How much does the e-Visa cost?",
      a: "Free for Singapore and Chinese passport holders — there's nothing to apply for. For e-Visa nationalities the government fee varies by nationality and travel document (commonly USD 20–90, shown during the application), and is officially cheaper than the visa-on-arrival counters at Turkish airports. VIZA confirms your exact fee before you pay.",
    },
    {
      category: "Application process",
      q: "How quickly will I receive my e-Visa?",
      a: "The official portal issues most e-Visas within minutes — the form takes about 3 minutes and the PDF downloads right after payment. The government still advises applying at least 48 hours before departure, and VIZA files with that buffer, backed by our on-time guarantee.",
    },
    {
      category: "Refunds, rejections & reapplications",
      q: "What happens if my e-Visa application is refused?",
      a: "The Türkiye government retains its fee. VIZA's service fee is fully refunded, and your consultant will review the refusal reason and advise on next steps, including the consulate route if your nationality needs it.",
    },
  ],

  sources: [
    {
      label: "Türkiye MFA — Visa Information for Foreigners",
      url: "https://www.mfa.gov.tr/visa-information-for-foreigners.en.mfa",
      display: "mfa.gov.tr",
    },
    {
      label: "Republic of Türkiye e-Visa portal — eligibility",
      url: "https://www.evisa.gov.tr/en/info/who-is-eligible-for-e-visa/",
      display: "evisa.gov.tr",
    },
    {
      label: "Presidency of Migration Management — entry-ban schedule for overstays",
      url: "https://en.goc.gov.tr/statement-regarding-the-prohibition-of-entry-that-shall-be-applied-to-the-foreigners-who-violate-the-right-to-legal-stay",
      display: "en.goc.gov.tr",
    },
    {
      label: "e-İkamet — online residence permit applications",
      url: "https://e-ikamet.goc.gov.tr",
      display: "e-ikamet.goc.gov.tr",
    },
    {
      label: "Singapore MFA — Türkiye travel information",
      url: "https://www.mfa.gov.sg/travelling-overseas/travel-advisories-notices-and-visa-information/turkiye/",
      display: "mfa.gov.sg",
    },
  ],

  price: {
    etaLabel: "Apply now, get it by",
    etaValue: "12 Jun 2026, 09:32 AM",
    title: "e-Visa · Türkiye",
    saving: "Issued in minutes",
    sub: "All-inclusive of government fee, document review, and on-time guarantee.",
    foot: "Government fee and VIZA processing are collected together at checkout, backed by our on-time guarantee.",
  },

  aiPlaceholder: "Ask anything about Türkiye entry — visa-free rules, e-Visa fees, the 90/180 rule…",
};

export default turkiye;
