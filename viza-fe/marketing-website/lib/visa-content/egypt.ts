import type { VisaContent } from "./types";

/**
 * Egypt Tourist e-Visa content.
 * Last fact-checked: 2026-07-05 against visa2egypt.gov.eg (official portal +
 * FAQ), egyptembassy.net (Embassy of Egypt, Washington DC), and cs.mfa.gov.cn
 * (Chinese MFA consular service).
 *
 * Confirmed:
 *  - Government fee: USD 30 single-entry / USD 65 multiple-entry (raised from
 *    USD 25/60 in April 2026, per the official portal fee display).
 *  - Visa on arrival: USD 30 since 1 March 2026.
 *  - Passport: valid 6+ months from arrival with a blank visa page (portal FAQ).
 *  - Portal instructs applying at least 7 days before departure; typical
 *    processing 5–7 business days. Consular route: 10+ business days.
 *  - Max stay 30 days per entry; single valid 90 days / multiple 180 days
 *    from issue.
 *  - Singapore and PRC ordinary passports are on the e-Visa eligible list;
 *    PRC diplomatic/service passports are visa-free for 30 days.
 *  - No digital arrival card — Egypt still uses a paper arrival card.
 *
 * Items needing ops confirmation:
 *  - Validity windows (90/180 days) and the 30-day stay limit are consistently
 *    reported but not displayed on the portal's public pages (only inside the
 *    logged-in application).
 *  - Embassy of Egypt (Washington) lists e-Visa fees as USD 32/67 vs the
 *    portal's USD 30/65 — likely a card surcharge or US-specific pricing.
 *  - Extension fee (~EGP 1,800) and overstay fine (from ~EGP 1,685 + admin
 *    fees) come from traveller/agency reports; Egypt publishes no official
 *    tariff online and amounts move with EGP inflation.
 *  - The traditional 14-day post-expiry grace period is inconsistently
 *    applied — do not advise clients to rely on it.
 *  - Chinese MFA still lists the VoA fee as USD 25 (pre-March-2026 figure).
 *  - The 5–7 business-day processing figure is typical experience, not an
 *    official SLA — the portal only says "apply at least 7 days before".
 */
export const egypt: VisaContent = {
  slug: "egypt",

  heroTitle: "Egypt Tourist e-Visa",
  lede: "A single-entry or multiple-entry tourist e-Visa issued through the official visa2egypt portal, with a 30-day stay per entry. Single-entry is valid 90 days from issue; multiple-entry 180 days. Filed and tracked end-to-end by your VIZA consultant.",
  heroImage: "/assets/heroes/egypt.avif",
  meta: [
    { k: "Type", v: "Tourist e-Visa" },
    { k: "Length of stay", v: "30 days per entry" },
    { k: "Validity", v: "90 days (single) / 180 days (multiple)" },
    { k: "Entry", v: "Single or Multiple" },
  ],
  tags: [
    { icon: "bolt", label: "Filed within 24 hrs" },
    { icon: "shield", label: "On-time guarantee" },
    { icon: "doc", label: "Minimal documents" },
  ],

  overviewTitle: "Egypt, at a glance",
  overviewSub:
    "The Egypt tourist e-Visa lets eligible passport holders — including Singapore and Chinese ordinary passports — enter for tourism and sightseeing without an embassy appointment. Government fee: USD 30 single-entry, USD 65 multiple-entry.",
  glance: [
    { icon: "globe", k: "Capital", v: "Cairo", sub: "UTC +2 (Egypt Standard Time)" },
    { icon: "clock", k: "Best time to visit", v: "Oct – Apr", sub: "Mild season · 18 – 28°C" },
    { icon: "currency", k: "Currency", v: "Egyptian Pound", sub: "SGD 1 ≈ EGP 50 (approx.)" },
    { icon: "pin", k: "Top destinations", v: "Cairo · Giza · Luxor", sub: "Plus Aswan, Hurghada, Sharm el-Sheikh" },
  ],

  processTitle: "How the Egypt e-Visa process works",
  processSub:
    "Submit once. We file directly on the official visa2egypt.gov.eg portal and notify you the moment your visa is approved. Egypt asks applicants to file at least 7 days before departure — we handle the lead time for you.",
  steps: [
    {
      title: "Apply on VIZA",
      body: "Upload your passport bio page, a passport-style photo, and your travel dates. The government fee is USD 30 (single-entry) or USD 65 (multiple-entry) — no embassy visit required.",
    },
    {
      title: "Your documents are verified",
      body: "Your VIZA consultant checks your name, passport number, and dates character-by-character against your passport — the single most common cause of refusal — then submits directly to the official portal.",
    },
    {
      title: "Your e-Visa gets processed",
      body: "Approvals typically take 5 – 7 business days (longer in peak season). We track the application so we can flag delays before they affect your trip.",
      statusRows: [
        { label: "Application submitted to visa2egypt.gov.eg", ts: "5 Jul, 9:00 AM", onTime: true },
        { label: "Payment confirmed by the portal", ts: "5 Jul, 11:45 AM", onTime: true },
        { label: "Awaiting final approval", ts: "In progress" },
      ],
    },
    {
      title: "Get your e-Visa on 12 Jul, 02:15 PM",
      body: "The approval PDF arrives in your inbox and your VIZA app. Print it — Egyptian border officers expect a printed e-Visa alongside your passport.",
      delivered: true,
    },
  ],

  docsTitle: "Required documents",
  docsSub:
    "Your VIZA consultant double-checks each document before submission. Re-uploads are unlimited and free.",
  documents: [
    { name: "Passport bio page", sub: "Valid 6+ months from arrival · 1 blank visa page · clear colour scan" },
    { name: "Passport-style photo", sub: "White background · no glasses or hats · JPEG" },
    { name: "Travel itinerary", sub: "Flight details or travel plan" },
    { name: "Accommodation details", sub: "Hotel booking or the tourist destinations you'll visit" },
  ],

  rejectionTitle: "Why Egypt e-Visas get rejected",
  rejectionSub:
    "Egyptian immigration authorities may refuse an application for any of the following. VIZA flags these before you submit.",
  rejectionReasons: [
    { title: "Passport data mismatch", body: "A name, passport number, or date that doesn't match your passport exactly — including reversed given and family names — is the most common cause of refusal, and can even void an approved e-Visa at the border." },
    { title: "Poor-quality passport scan", body: "Blurry, cropped, or glared bio-page uploads that can't be read lead to automatic denial." },
    { title: "Passport validity too short", body: "A passport with less than 6 months' validity from the arrival date will be refused." },
    { title: "Prior immigration violations", body: "Previous overstays or breaches of an earlier Egypt visa can trigger refusal." },
    { title: "Ineligible nationality or document", body: "Applying online with a passport that isn't on the e-Visa eligible list — those travellers must apply through an embassy. Note that port authorities retain the right to refuse entry without explanation, even with an approved e-Visa." },
  ],

  entryTitle: "Entry & exit regulations",
  entrySub:
    "Print your e-Visa and present it with your passport. Egypt still uses a paper arrival card — handed out on the flight or in the immigration hall — with no digital arrival card or biometric enrolment for tourists. A yellow fever certificate is required only if arriving from an endemic country.",
  entryExit: [
    { icon: "refresh", k: "Entry", v: "Single or Multiple", sub: "30 days per entry, per your visa type" },
    { icon: "clock", k: "Activate within", v: "90 / 180 days", sub: "Single-entry: 90 days · Multiple-entry: 180 days from issue" },
    { icon: "doc", k: "Arrival card", v: "Paper form", sub: "Handed out on the flight — no digital arrival card" },
    { icon: "plane", k: "At the border", v: "Printed e-Visa", sub: "Onward ticket sometimes requested by officers" },
  ],

  extensionTitle: "Visa extension & overstays",
  extensionSub:
    "Tourist stays are extended in-country at the Passports, Emigration and Nationality Administration in Abbassia, Cairo — the successor to the old Mogamma office. Overstay fines are paid in cash at the airport before departure, and the traditional 14-day grace period is no longer reliably honoured.",
  extension: [
    { icon: "extend", k: "Extension", v: "3 – 6 months", sub: "Abbassia passport office, Cairo · closed Fridays" },
    { icon: "currency", k: "Extension fee", v: "≈ EGP 1,800", sub: "≈ SGD 50 · confirmed on-site, changes with inflation" },
    { icon: "alert", k: "Overstay fine", v: "From EGP 1,685", sub: "Plus admin fees · escalates after 3 months · cash at the airport" },
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
      a: "An electronic tourist visa issued through Egypt's official visa2egypt.gov.eg portal. It comes in two versions: single-entry (USD 30, valid 90 days from issue) and multiple-entry (USD 65, valid 180 days), each allowing stays of up to 30 days per entry. The approval arrives by email and must be printed for the border.",
    },
    {
      category: "General information",
      q: "Do Singapore passport holders need a visa for Egypt?",
      a: "Yes — there is no visa-free entry for Singapore passports. You can get the e-Visa in advance (USD 30 single / USD 65 multiple) or a visa on arrival (USD 30, single-entry, cash). The e-Visa is the safer option: you're pre-cleared before flying and skip the arrival-hall payment queue. VIZA files it end-to-end.",
    },
    {
      category: "General information",
      q: "Do Chinese passport holders need a visa for Egypt?",
      a: "Holders of PRC diplomatic and service passports enter visa-free for 30 days. Ordinary (普通) passport holders need a visa — they're on the e-Visa eligible list, which VIZA files for you. The visa-on-arrival route exists but carries strict conditions per the Chinese MFA: a round-trip ticket, a confirmed 4/5-star hotel booking, and USD 2,000 in cash. The e-Visa in advance avoids all of that.",
    },
    {
      category: "Application process",
      q: "How long does the Egypt e-Visa take?",
      a: "Approvals typically take 5 – 7 business days, longer in peak season, and the official portal asks applicants to file at least 7 days before departure. The embassy route takes 10+ business days. VIZA files your application within 24 hours, tracks it daily, and backs the timeline with an on-time guarantee — your money back if we're late.",
    },
    {
      category: "Application process",
      q: "Can I apply for my whole family in one order?",
      a: "Yes. Add each traveller during the application — your consultant submits them together so approvals arrive on the same timeline.",
    },
    {
      category: "Refunds, rejections & reapplications",
      q: "What happens if my Egypt e-Visa is rejected?",
      a: "Egyptian authorities retain the government fee on rejection. VIZA's service fee is fully refunded, and your consultant will review the refusal reason with you — usually a passport-data mismatch or an unreadable scan — and help you reapply once it's fixed.",
    },
  ],

  sources: [
    { label: "Egypt e-Visa Official Portal", url: "https://visa2egypt.gov.eg/eVisa/Home", display: "visa2egypt.gov.eg" },
    { label: "Egypt e-Visa Official FAQ (fees, eligibility, requirements)", url: "https://visa2egypt.gov.eg/eVisa/FAQ?lang=en", display: "visa2egypt.gov.eg" },
    { label: "Embassy of Egypt, Washington DC — Visa Requirements", url: "https://egyptembassy.net/consular-services/visas-travel/visa-requirements/", display: "egyptembassy.net" },
    { label: "Chinese MFA Consular Service — Egypt entry rules for PRC citizens", url: "https://cs.mfa.gov.cn/zggmcg/ljmdd/fz_648564/aj_648628/rjjl_648638/", display: "cs.mfa.gov.cn" },
  ],

  price: {
    etaLabel: "Apply now, get it by",
    etaValue: "12 Jul 2026, 02:15 PM",
    title: "Tourist e-Visa · 30-day stay",
    saving: "5+ days faster than embassy",
    sub: "All-inclusive of government fee, document review, and on-time guarantee.",
    foot: "Government fee and VIZA processing are collected together at checkout, backed by our on-time guarantee.",
  },

  aiPlaceholder: "Ask anything about Egypt visas — fees, processing, documents…",
};

export default egypt;
