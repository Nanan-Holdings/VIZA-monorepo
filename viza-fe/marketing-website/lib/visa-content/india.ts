import type { VisaContent } from "./types";

/**
 * India e-Tourist Visa (e-TV) — 30-day Electronic Travel Authorization (ETA).
 *
 * Last fact-checked: 2026-07-05 against indianvisaonline.gov.in (evisa/tvoa.html,
 * evisa/, earrival/), cgisf.gov.in, hcisingapore.gov.in, eoibeijing.gov.in,
 * india.blscn.cn, and indianfrro.gov.in.
 *
 * Confirmed facts baked into this page:
 * — Three e-TV variants: 30-day (USD 25 Jul–Mar / USD 10 Apr–Jun arrivals),
 *   1-year multiple entry (USD 40), 5-year multiple entry (USD 80). All fees
 *   carry a 2.5% bank transaction charge. Bands unchanged since Aug 2019.
 * — 30-day e-TV: valid 30 days from first arrival; apply 4–120 days before
 *   travel; ETA typically emailed within 72 hours.
 * — 1-year/5-year variants: 180-day total-stay cap per calendar year.
 * — Non-extendable, non-convertible; exceptions only via e-FRRO.
 * — e-Arrival Card mandatory for all foreign nationals from 1 Apr 2026
 *   (submit within 72 hours pre-arrival; free; QR shown at immigration).
 * — Entry via 33 designated airports / 19 designated seaports; biometrics
 *   captured on first arrival; exit via any authorised immigration check post.
 * — Singapore passports are NOT visa-free for India (eVisa-eligible, item 144).
 * — PRC passports: eVisa SUSPENDED; regular paper tourist visas resumed
 *   24 Jul 2025 via BLS International IVACs (india.blscn.cn), ~7 working days,
 *   standard grant 3-month single entry per the India–China MOU.
 *
 * Items needing ops confirmation before publish:
 * — 30-day e-TV entries: portal page says "Multiple Entry, non-extendable";
 *   fee schedule and missions historically say DOUBLE entry. Verify on the
 *   live application form. This page follows the portal ("Multiple").
 * — Exact current FRRO overstay penalty slabs (official PDF unfetchable —
 *   legacy TLS). INR 500 / 10,000 / 50,000 slabs are from secondary summaries.
 * — 6-month e-T2V variant fee for Singapore (commonly USD 25) not confirmed.
 * — Whether the seasonal USD 10 Apr–Jun rate keys off application date or
 *   arrival date is not explicit on the portal.
 * — SGD conversions use ~1 USD = 1.28 SGD (Jul 2026) — confirm at publication.
 */
export const india: VisaContent = {
  slug: "india",

  heroTitle: "India e-Tourist Visa",
  lede: "An online Electronic Travel Authorization granting a 30-day stay from first arrival — no consulate visit, decision typically emailed within 72 hours. Filed and tracked end-to-end by your VIZA consultant.",
  heroImage: "/assets/heroes/india.jpg",
  meta: [
    { k: "Type", v: "e-Tourist Visa (ETA)" },
    { k: "Length of stay", v: "30 days" },
    { k: "Validity", v: "30 days from first arrival" },
    { k: "Entry", v: "Multiple" },
  ],
  tags: [
    { icon: "bolt", label: "Fully online" },
    { icon: "shield", label: "On-time guarantee" },
    { icon: "doc", label: "Minimal documents" },
  ],

  overviewTitle: "India, at a glance",
  overviewSub:
    "The e-Tourist Visa covers tourism, sightseeing, visiting friends and family, short yoga programmes, and casual business visits. Singapore passport holders are not visa-free for India — every trip needs one. Longer-term travellers can opt for the 1-year (USD 40) or 5-year (USD 80) multiple-entry variants, capped at 180 days per calendar year.",
  glance: [
    { icon: "globe", k: "Capital", v: "New Delhi", sub: "UTC +5:30 (IST)" },
    { icon: "clock", k: "Best time to visit", v: "Oct – Mar", sub: "Cool, dry season across most regions" },
    { icon: "currency", k: "Currency", v: "Indian Rupee (INR)", sub: "SGD 1 ≈ INR 65 · cards widely accepted in cities" },
    { icon: "pin", k: "Top destinations", v: "Delhi · Mumbai · Jaipur", sub: "Plus Agra, Kerala, Varanasi, Goa" },
  ],

  processTitle: "How the e-Visa process works",
  processSub:
    "Submit once. We verify your documents, file directly on indianvisaonline.gov.in, and track the decision until your ETA lands in your inbox. Apply 4 to 120 days before arrival — the government does not process applications paid less than 4 days before travel.",
  steps: [
    {
      title: "Apply on VIZA",
      body: "Upload your passport, photo, and travel dates. Your consultant checks every field against the government portal's strict file-size and format rules before anything is submitted.",
    },
    {
      title: "Your documents are verified",
      body: "We reformat your photo to the square white-background spec and your passport scan to the required PDF, then file the application and pay the government fee (plus its 2.5% bank charge) on your behalf.",
    },
    {
      title: "Application processed by the Bureau of Immigration",
      body: "Decisions are typically emailed within 72 hours. We monitor the portal and act immediately on any re-upload request — unanswered requests are a leading cause of rejection.",
      statusRows: [
        { label: "Application submitted to portal", ts: "20 Jun, 10:15 AM", onTime: true },
        { label: "Forwarded for background check", ts: "20 Jun, 2:30 PM", onTime: true },
        { label: "Awaiting final approval", ts: "In progress" },
      ],
    },
    {
      title: "Receive your ETA on 23 Jun",
      body: "Your Electronic Travel Authorization arrives by email and in your VIZA app. Print it — immigration expects a paper copy at the eVisa counter, where your fingerprints and photo are captured on first arrival.",
      delivered: true,
    },
  ],

  docsTitle: "Required documents",
  docsSub:
    "The Indian government portal enforces exact file sizes and formats. Your VIZA consultant verifies every item — re-uploads are unlimited and free.",
  documents: [
    { name: "Passport bio page", sub: "Ordinary passport only · valid 6+ months from arrival · 2+ blank pages · PDF, 10 KB – 300 KB" },
    { name: "Digital photograph", sub: "White background · square JPEG, 10 KB – 1 MB · full face, no glasses · recent" },
    { name: "Return or onward ticket", sub: "Required under eVisa conditions · may be checked at immigration" },
    { name: "Proof of sufficient funds", sub: "Enough money for your stay · may be checked at immigration" },
    { name: "e-Arrival Card QR code", sub: "Mandatory from 1 Apr 2026 · submit free online within 72 hrs before arrival" },
  ],

  rejectionTitle: "Why e-Visa applications get rejected",
  rejectionSub:
    "The Bureau of Immigration screens for these issues. VIZA flags every one before you submit.",
  rejectionReasons: [
    {
      title: "Poor-quality or wrong uploads",
      body: "Blurry scans, non-white photo backgrounds, or files outside the 10 KB – 300 KB / 10 KB – 1 MB limits — the most common cause. Ignoring the re-upload email leads to rejection.",
    },
    {
      title: "Data mismatch",
      body: "Name, passport number, date of birth, or nationality on the form not matching the passport bio page exactly.",
    },
    {
      title: "Insufficient passport validity",
      body: "Less than 6 months validity from your arrival date, or fewer than 2 blank pages for stamping.",
    },
    {
      title: "Ineligible passport",
      body: "Diplomatic or official passports and international travel documents cannot use the eVisa route and must apply at a mission.",
    },
    {
      title: "Applying too late",
      body: "Applications or payments completed less than 4 days before travel are not processed by the government.",
    },
    {
      title: "Adverse immigration history",
      body: "Previous overstays, visa violations, or blacklisting in India surfaced during background clearance.",
    },
  ],

  entryTitle: "Entry & exit regulations",
  entrySub:
    "Carry a printed ETA, your return ticket, and proof of funds. eVisa holders must enter via one of 33 designated airports or 19 designated seaports (exit is allowed through any authorised immigration check post). From 1 April 2026, all foreign nationals must also submit India's free digital e-Arrival Card within 72 hours before arrival and show the QR code at immigration — it replaces the paper disembarkation card.",
  entryExit: [
    { icon: "refresh", k: "Entry", v: "Multiple", sub: "Within the 30-day validity window" },
    { icon: "clock", k: "Stay up to", v: "30 days", sub: "From the date of first arrival in India" },
    { icon: "plane", k: "Entry points", v: "33 airports · 19 seaports", sub: "Biometrics captured on first arrival" },
    { icon: "doc", k: "e-Arrival Card", v: "Within 72 hrs pre-arrival", sub: "Free · mandatory from 1 Apr 2026" },
  ],

  extensionTitle: "Visa extension & overstays",
  extensionSub:
    "The e-Tourist Visa is non-extendable and non-convertible. Extensions are entertained only in genuine emergencies via the e-FRRO portal — if you need longer, apply for the 1-year or 5-year variant instead. Overstaying requires an Exit Permit from the FRRO before you can depart, plus a slab-based fine, and is prosecutable with blacklisting from future entry.",
  extension: [
    { icon: "ban", k: "Extension", v: "Not permitted", sub: "Emergencies only, via e-FRRO" },
    { icon: "alert", k: "Overstay fine", v: "INR 500 – 50,000", sub: "INR 500 ≤15 days · INR 10,000 16–90 days · INR 50,000 beyond" },
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
      q: "Do Singapore passport holders need a visa for India?",
      a: "Yes. Singapore is on India's eVisa-eligible list, not its visa-free list — every trip requires an eVisa (or a regular visa from the High Commission of India). VIZA files the eVisa for you end-to-end.",
    },
    {
      category: "General information",
      q: "What does the India e-Tourist Visa cost?",
      a: "The government fee for the 30-day e-Tourist Visa is USD 25 (≈ SGD 32) for July–March arrivals, reduced to USD 10 (≈ SGD 13) for April–June, plus a 2.5% bank transaction charge. The 1-year multiple-entry visa is USD 40 (≈ SGD 51) and the 5-year is USD 80 (≈ SGD 102).",
    },
    {
      category: "General information",
      q: "Can Chinese passport holders apply for the India eVisa?",
      a: "No — India's eVisa remains suspended for PRC passports. Since 24 July 2025, Chinese nationals can obtain a regular paper tourist visa (standard grant: 3-month single entry) through BLS International visa centres in Beijing, Shanghai, or Guangzhou, at USD 100 / RMB 716 all-in with ~7 working days' processing. VIZA manages the paper-visa route end-to-end.",
    },
    {
      category: "Application process",
      q: "How long does the e-Visa take to process?",
      a: "Decisions are typically emailed within 72 hours of submission. You can apply up to 120 days before arrival, and the government requires application and payment at least 4 days before travel — anything later is not processed. VIZA backs the timeline with an on-time guarantee.",
    },
    {
      category: "Application process",
      q: "What if I want to stay longer than 30 days?",
      a: "The 30-day e-Tourist Visa cannot be extended. Choose the 1-year (USD 40) or 5-year (USD 80) multiple-entry variant instead — both allow repeat trips with total stays of up to 180 days per calendar year.",
    },
    {
      category: "Application process",
      q: "Can I apply for my whole family at once?",
      a: "Each traveller requires a separate e-Visa application with their own passport and photograph. VIZA manages multiple applications simultaneously so your family travels on the same timeline.",
    },
    {
      category: "Refunds, rejections & reapplications",
      q: "What happens if my e-Visa application is rejected?",
      a: "The Indian government fee is non-refundable. VIZA's processing fee is fully refunded. Your consultant reviews the rejection reason — most stem from upload quality or data mismatches we correct — and refiles once the issue is resolved.",
    },
  ],

  sources: [
    { label: "India eVisa portal — e-Tourist Visa details", url: "https://indianvisaonline.gov.in/evisa/tvoa.html", display: "indianvisaonline.gov.in" },
    { label: "Country-wise e-Tourist Visa fee schedule (official PDF)", url: "https://indianvisaonline.gov.in/evisa/images/Etourist_fee_final.pdf", display: "indianvisaonline.gov.in" },
    { label: "e-Arrival Card — official portal", url: "https://indianvisaonline.gov.in/earrival/", display: "indianvisaonline.gov.in" },
    { label: "High Commission of India, Singapore — e-Tourist Visa", url: "https://www.hcisingapore.gov.in/eTourist", display: "hcisingapore.gov.in" },
    { label: "BLS International — India visas for Chinese nationals", url: "https://india.blscn.cn/touristvisa.php", display: "india.blscn.cn" },
    { label: "FRRO — overstay financial penalty schedule", url: "https://indianfrro.gov.in/frro/Financial_Penalty.pdf", display: "indianfrro.gov.in" },
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
