import type { VisaContent } from "./types";

/**
 * Saudi Arabia Tourist eVisa content.
 * Last fact-checked: 2026-07-05 against visa.visitsaudi.com (portal, Terms &
 * Conditions, photo specifications), visitsaudi.com, ksavisa.sa and spa.gov.sa.
 *
 * Confirmed:
 *  - 1-year multiple-entry tourist eVisa (Ministry of Tourism), up to 90 days
 *    per visit; NOT extendable (official T&C 7.4).
 *  - Fee: SAR 535 online all-in (≈ SGD 183, incl. mandatory bundled medical
 *    insurance + VAT); visa on arrival SAR 480 (≈ SGD 164). Non-refundable
 *    even if refused (T&C 5.3–5.4).
 *  - Passport: 6+ months validity from date of entry; must arrive on the same
 *    passport used to apply. Photo: 200x200 px, 5–100 KB, white background.
 *  - Overstay (Jawazat/MOI): 1st offence SAR 15,000; 2nd SAR 25,000 + 3 months
 *    jail; 3rd SAR 50,000 + 6 months jail, deportation and re-entry bans.
 *    (The widely cited SAR 100/day figure is NOT officially documented.)
 *  - Singapore and China (incl. HK/Macau) are both on the eligible-country
 *    list — neither is visa-exempt.
 *
 * Items needing ops confirmation:
 *  - Live checkout fee amount (one early-2026 secondary source claimed
 *    ~SAR 395 after an insurance-premium cut — unverified officially).
 *  - Processing time has no published SLA; "minutes to 24 hours" is from
 *    portal marketing snippets + consistent secondary reporting.
 *  - Visa-on-arrival fee (SAR 480) and VOA counter availability for SG/CN
 *    passports not confirmed on an official page.
 *  - Jawazat/Absher "extension" announcements are exit-regularisation
 *    mechanisms, not routine tourist extensions — confirm for edge cases.
 *  - Official-portal facts captured via Wayback snapshots (portal blocks
 *    automated access) — do a manual live check before publishing.
 */
export const saudiArabia: VisaContent = {
  slug: "saudi-arabia",

  heroTitle: "Saudi Arabia Tourist eVisa",
  lede: "A one-year, multiple-entry tourist eVisa issued by the Ministry of Tourism, with stays of up to 90 days per visit and medical insurance bundled in. Filed on the official visa.visitsaudi.com portal and tracked end-to-end by your VIZA consultant.",
  heroImage: "/assets/heroes/saudi-arabia.jpg",
  meta: [
    { k: "Type", v: "Tourist eVisa" },
    { k: "Length of stay", v: "90 days per visit" },
    { k: "Validity", v: "1 year" },
    { k: "Entry", v: "Multiple" },
  ],
  tags: [
    { icon: "bolt", label: "Fast track · in 24 hrs" },
    { icon: "shield", label: "On-time guarantee" },
    { icon: "doc", label: "Minimal documents" },
  ],

  overviewTitle: "Saudi Arabia, at a glance",
  overviewSub:
    "The tourist eVisa opens the Kingdom to passport holders of 66 eligible countries — including Singapore and China — for tourism, events, family visits, leisure and Umrah (excluding Hajj). No sponsor or embassy visit required.",
  glance: [
    { icon: "globe", k: "Capital", v: "Riyadh", sub: "UTC +3 (Arabia Standard Time)" },
    { icon: "clock", k: "Best time to visit", v: "Nov – Mar", sub: "Cooler season · 18 – 27°C" },
    { icon: "currency", k: "Currency", v: "Saudi Riyal", sub: "SGD 1 ≈ SAR 2.90 (approx.)" },
    { icon: "pin", k: "Top destinations", v: "Riyadh · Jeddah · AlUla", sub: "Plus Diriyah, NEOM, Red Sea coast" },
  ],

  processTitle: "How the Saudi tourist eVisa process works",
  processSub:
    "Submit once. We file directly on the Ministry of Tourism's official portal (visa.visitsaudi.com) and notify you the moment your eVisa is issued.",
  steps: [
    {
      title: "Apply on VIZA",
      body: "Upload your passport bio page, a compliant digital photo (200 × 200 px, white background), and your travel dates. No embassy appointment, no sponsor.",
    },
    {
      title: "Your documents are verified",
      body: "Your VIZA consultant cross-checks every field — passport validity, photo spec, name spelling — then submits the application on visa.visitsaudi.com. Mandatory medical insurance is auto-assigned and bundled into the government fee.",
    },
    {
      title: "Your eVisa gets processed",
      body: "The Ministry of Tourism typically issues eVisas within minutes to 24 hours. We track the application and flag any delay well before your departure — we recommend applying at least 72 hours before travel.",
      statusRows: [
        { label: "Application submitted to visa.visitsaudi.com", ts: "13 Jun, 8:30 AM", onTime: true },
        { label: "Payment confirmed · insurance policy assigned", ts: "13 Jun, 8:42 AM", onTime: true },
        { label: "Awaiting final approval", ts: "In progress" },
      ],
    },
    {
      title: "Get your eVisa on 14 Jun, 02:15 PM",
      body: "The eVisa arrives as an email attachment and in your VIZA app. Carry a printed or electronic copy on your first arrival — immigration will link it to your passport and capture your biometrics.",
      delivered: true,
    },
  ],

  docsTitle: "Required documents",
  docsSub:
    "Your VIZA consultant double-checks each document before submission. Re-uploads are unlimited and free.",
  documents: [
    { name: "Passport bio page", sub: "Eligible-country passport · valid 6+ months from your entry date · arrive on the same passport" },
    { name: "Digital photograph", sub: "200 × 200 px · 5 – 100 KB · plain white background · taken within 6 months" },
    { name: "Travel & accommodation details", sub: "Entered on the online application — must be accurate; false information leads to rejection" },
    { name: "Payment card & valid email", sub: "Fee paid online by credit/debit card · eVisa delivered as an email attachment" },
    { name: "Medical insurance", sub: "Mandatory — auto-assigned from a Saudi-approved insurer and bundled into the fee, nothing to buy separately" },
    { name: "For travellers under 18", sub: "A parent or guardian must apply on the minor's behalf" },
  ],

  rejectionTitle: "Why Saudi eVisas get rejected",
  rejectionSub:
    "The Ministry of Tourism may refuse an application for any of the following — and the SAR 535 government fee is not refunded on refusal. VIZA flags these before you submit.",
  rejectionReasons: [
    { title: "False or misleading information", body: "Any application containing false or misleading details is rejected outright, and may be shared with Saudi authorities." },
    { title: "Passport validity too short", body: "A passport with less than 6 months remaining from your date of entry into Saudi Arabia will not be accepted." },
    { title: "Non-compliant photo", body: "Photos that miss the official spec — 200 × 200 px, 5 – 100 KB, plain white background, face filling 70 – 80% of the frame — are a leading cause of failed applications." },
    { title: "Payment failure", body: "The application is suspended if payment isn't completed — and paying the fee does not by itself guarantee approval." },
    { title: "Prior violations or security grounds", body: "Approval is at the sole discretion of the Ministry of Tourism. Previous overstays, deportations, or adverse security checks can trigger refusal." },
    { title: "Wrong visa for your purpose", body: "The eVisa covers tourism, events, family visits, leisure and Umrah only. Work, study, or Hajj requires a different visa — as does any passport outside the 66 eligible countries." },
  ],

  entryTitle: "Entry & exit regulations",
  entrySub:
    "No arrival card is required. Carry a printed or electronic copy of your eVisa on first arrival and travel on the passport you applied with — immigration captures your fingerprints and photo at the border, and may ask for proof of funds or an onward ticket. The eVisa is valid at all Saudi air and sea ports.",
  entryExit: [
    { icon: "refresh", k: "Entry", v: "Multiple", sub: "Travel freely within the 1-year validity" },
    { icon: "clock", k: "Enter within", v: "1 year", sub: "If it expires unused, you must reapply and pay again" },
    { icon: "doc", k: "On arrival", v: "eVisa copy + biometrics", sub: "Fingerprints and photo taken at immigration" },
    { icon: "ban", k: "Makkah in Hajj season", v: "Off-limits", sub: "Visit-visa holders barred 18 Apr – 1 Jun 2026 · holy mosque premises are for Muslims only" },
  ],

  extensionTitle: "Visa extension & overstays",
  extensionSub:
    "The tourist eVisa cannot be extended — the 90-day stay and 1-year validity are fixed by the official terms. For a longer trip, exit and re-enter on the same multiple-entry visa. Overstaying triggers heavy Jawazat penalties, settled via Absher before you can exit.",
  extension: [
    { icon: "ban", k: "Extension", v: "Not possible", sub: "Fixed 90-day stay · exit and re-enter instead" },
    { icon: "alert", k: "Overstay fine", v: "SAR 15,000", sub: "≈ SGD 5,200 · repeat offences SAR 25,000 – 50,000 + jail, deportation and re-entry bans" },
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
      q: "What is the Saudi Arabia tourist eVisa?",
      a: "A one-year, multiple-entry electronic travel authorization issued by the Ministry of Tourism via visa.visitsaudi.com. It allows stays of up to 90 days per visit for tourism, events, family visits, leisure and Umrah (excluding Hajj). No embassy visit or sponsor is required.",
    },
    {
      category: "General information",
      q: "Do Singapore passport holders need a visa for Saudi Arabia?",
      a: "Yes. Singapore has no visa-exemption or ETA arrangement with Saudi Arabia, but it is on the 66-country eVisa eligible list. Apply online for the eVisa (SAR 535 all-in) or get a visa on arrival (SAR 480) at Saudi international airports. VIZA files the eVisa for you end-to-end — it's cheaper to arrive with the visa already issued.",
    },
    {
      category: "General information",
      q: "Can Chinese passport holders apply?",
      a: "Yes — China (including Hong Kong and Macau) is on the official eligible list, and the portal is available in Simplified Chinese. The same 1-year multiple-entry, 90-day terms apply. Note: China's trial visa-free entry for Saudi citizens works in the reverse direction only — Chinese citizens still need a Saudi visa.",
    },
    {
      category: "General information",
      q: "How much does the eVisa cost, and is insurance included?",
      a: "SAR 535 online, all-in (≈ SGD 183) — that covers the visa fee, mandatory medical insurance auto-assigned from a Saudi-approved insurer, and VAT. There is nothing to buy separately. Note the government fee is non-refundable even if the application is refused.",
    },
    {
      category: "Application process",
      q: "How long does VIZA take to process a Saudi eVisa?",
      a: "The Ministry of Tourism typically issues eVisas within minutes to 24 hours, delivered as an email attachment. We back our 24-hour timeline with an on-time guarantee — your money back if we're late — and recommend applying at least 72 hours before travel as a buffer.",
    },
    {
      category: "Application process",
      q: "Can I apply for my whole family in one order?",
      a: "Yes. Add each traveller during the application — your consultant submits them together so approvals arrive on the same timeline. For children under 18, a parent or guardian applies on their behalf, as the official terms require.",
    },
    {
      category: "Refunds, rejections & reapplications",
      q: "What happens if my Saudi eVisa is rejected?",
      a: "Under the official terms, Saudi authorities retain the full government fee on refusal. VIZA's service fee is fully refunded, and your consultant will review the refusal with you and advise whether a corrected reapplication or an embassy application is the right next step.",
    },
    {
      category: "Refunds, rejections & reapplications",
      q: "Can I extend my stay beyond 90 days?",
      a: "No — the official terms state the tourist eVisa cannot be extended. Since it's multiple-entry, the practical route for a longer trip is to exit and re-enter. Never overstay: Jawazat fines start at SAR 15,000 for a first offence, rising to SAR 50,000 plus imprisonment and deportation for repeat offences.",
    },
  ],

  sources: [
    { label: "Saudi eVisa Official Portal (Ministry of Tourism)", url: "https://visa.visitsaudi.com", display: "visa.visitsaudi.com" },
    { label: "Official eVisa Terms & Conditions", url: "https://visa.visitsaudi.com/Home/TermsConditions", display: "visa.visitsaudi.com" },
    { label: "Visit Saudi — Visa Regulations", url: "https://www.visitsaudi.com/en/plan-your-trip/visa-regulations", display: "visitsaudi.com" },
    { label: "KSA Visa Unified Platform — Tourism Visa", url: "https://ksavisa.sa/visa/tourism/details", display: "ksavisa.sa" },
    { label: "Saudi Press Agency — Overstay Penalties (MOI)", url: "https://www.spa.gov.sa/en/N2303510", display: "spa.gov.sa" },
  ],

  price: {
    etaLabel: "Apply now, get it by",
    etaValue: "14 Jun 2026, 02:15 PM",
    title: "Tourist eVisa · 1-year multiple entry · 90-day stays",
    saving: "1 day faster",
    sub: "All-inclusive of government fee, mandatory medical insurance, document review, and on-time guarantee.",
    foot: "Government fee and VIZA processing are collected together at checkout, backed by our on-time guarantee.",
  },

  aiPlaceholder: "Ask anything about Saudi Arabia visas — fees, processing, documents…",
};

export default saudiArabia;
