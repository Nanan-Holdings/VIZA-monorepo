import type { VisaContent } from "./types";

/**
 * United Arab Emirates tourist visa content.
 * Last fact-checked: 2026-07-05 against u.ae, gdrfad.gov.ae, icp.gov.ae,
 * smartservices.icp.gov.ae, ae.china-embassy.gov.cn, mofa.gov.ae.
 *
 * Key facts baked in:
 *   - UAE tourist visas are sponsor-filed (airline, licensed agent, or UAE
 *     hotel) via GDRFA Dubai or federal ICP — embassies do NOT issue them.
 *   - GDRFA fees: 30-day AED 252 + 5% VAT + AED 20 dirhams (≈ SGD 100);
 *     60-day AED 352 + VAT (≈ SGD 130). Processing: 48 hours (GDRFA stated).
 *   - Singapore & PRC passports need NO visa: free entry on arrival, 90 days
 *     within any 180-day period (SG since Sep 2024; PRC per Apr 2025 embassy
 *     confirmation under the 2018 mutual-exemption agreement).
 *   - Extension: up to 120 days total, fully online via ICP since Dec 2025
 *     (AED 100 + AED 500 ≈ SGD 210, ~2 days). Overstay: AED 50/day unified
 *     rate since Feb 2026, no grace period, fines block future approvals.
 *
 * Items needing ops confirmation:
 *   - u.ae visa-on-arrival country-list pages 404 as of 2026-07-05; Singapore's
 *     90-day placement rests on Emirates airline + Fragomen, not a live gov page.
 *   - Entry-validity window of the pre-arranged visa (~60 days from issue is the
 *     commonly cited figure) is not stated on the GDRFA service page.
 *   - Whether the old 10-day grace on the 30-day VOA survives the Feb 2026 fine
 *     unification, and whether the 90/180 arrival stay is single- or multi-entry.
 *   - Third-party sources cite ~AED 1,130 all-in for an ICP extension vs AED 600
 *     official line items; exit-permit fee (AED 250–300) for 30+ day overstays is
 *     secondary-source only.
 *   - SGD conversions use 1 AED ≈ 0.35 SGD (AED pegged at USD 3.6725) — verify at
 *     publication.
 */
export const unitedArabEmirates: VisaContent = {
  slug: "united-arab-emirates",

  heroTitle: "United Arab Emirates Tourist Visa",
  lede: "A sponsor-filed UAE tourist visa granting a 30- or 60-day stay, processed by GDRFA Dubai in 48 hours. Singapore and Chinese passport holders skip it entirely — 90 days visa-free on arrival. VIZA confirms which applies to you and handles the rest.",
  heroImage: "/assets/heroes/united-arab-emirates.jpg",
  meta: [
    { k: "Type", v: "Tourist visa (sponsor-filed)" },
    { k: "Length of stay", v: "30 or 60 days" },
    { k: "Validity", v: "~60 days to enter" },
    { k: "Entry", v: "Single or Multiple" },
  ],
  tags: [
    { icon: "bolt", label: "48-hr government processing" },
    { icon: "shield", label: "On-time guarantee" },
    { icon: "doc", label: "Minimal documents" },
  ],

  overviewTitle: "United Arab Emirates, at a glance",
  overviewSub:
    "Futuristic skylines, golden deserts, luxury shopping, and year-round sunshine. Singapore and Chinese passports enter visa-free for 90 days; most other nationalities need this sponsor-arranged tourist visa.",
  glance: [
    { icon: "globe", k: "Capital", v: "Abu Dhabi", sub: "UTC +4 (GST, no DST)" },
    { icon: "clock", k: "Best time to visit", v: "Oct – Apr", sub: "Cooler temperatures, outdoor-friendly" },
    { icon: "currency", k: "Currency", v: "UAE Dirham (AED)", sub: "Pegged to the USD · SGD 1 ≈ AED 2.85" },
    { icon: "pin", k: "Top destinations", v: "Dubai · Abu Dhabi · Sharjah", sub: "Plus Ras Al Khaimah, Fujairah" },
  ],

  processTitle: "How the UAE tourist visa process works",
  processSub:
    "UAE embassies don't issue tourist visas — applications go through a licensed sponsor to GDRFA Dubai or the federal ICP. VIZA files through its licensed channel and tracks every stage.",
  steps: [
    {
      title: "Apply on VIZA",
      body: "Upload your passport, one white-background photo, travel dates, and onward ticket. Pay only the government fee upfront — VIZA's processing fee is charged on approval.",
    },
    {
      title: "Eligibility check & document verification",
      body: "Your VIZA consultant first confirms you actually need a visa — Singapore and Chinese passports don't — then verifies your MRZ scan, photo, insurance, and onward ticket before filing through our licensed sponsor channel to GDRFA Dubai.",
    },
    {
      title: "Your visa gets processed",
      body: "GDRFA Dubai's stated processing time is 48 hours. We monitor each stage and flag any delays so you always know where things stand.",
      statusRows: [
        { label: "Application filed with GDRFA Dubai", ts: "15 Jun, 10:00 AM", onTime: true },
        { label: "Identity and travel document verified", ts: "15 Jun, 1:30 PM", onTime: true },
        { label: "Awaiting final visa issuance", ts: "In progress" },
      ],
    },
    {
      title: "Get your visa on 18 Jun, 12:00 PM",
      body: "The visa PDF arrives in your inbox and your VIZA app. Print it or save it — UAE immigration scans it on arrival, then captures your biometrics at the border.",
      delivered: true,
    },
  ],

  docsTitle: "Required documents",
  docsSub:
    "Your VIZA consultant double-checks each document before submission. Re-uploads are unlimited and free.",
  documents: [
    { name: "Passport bio page", sub: "Valid 6+ months · clear scan with readable MRZ" },
    { name: "One colour photograph", sub: "White background · recent" },
    { name: "Onward or return ticket", sub: "GDRFA condition — showing your journey out of the UAE" },
    { name: "Health insurance", sub: "Valid in the UAE for your stay — a stated visa condition" },
    { name: "National ID card", sub: "Only for Iraq, Pakistan, Iran, and Afghanistan nationals" },
  ],

  rejectionTitle: "Why UAE tourist visas get rejected",
  rejectionSub:
    "The GDRFA/ICP systems check these automatically. VIZA reviews your application before submission to catch issues first.",
  rejectionReasons: [
    {
      title: "Passport validity under 6 months",
      body: "GDRFA rejects applications outright when the passport has less than 6 months remaining. The same 6-month rule applies to visa-free entry.",
    },
    {
      title: "Blurry photo or unreadable passport scan",
      body: "A low-resolution photo, wrong background, or obscured MRZ zone prevents identity verification and triggers automatic rejection.",
    },
    {
      title: "Previous overstay or unpaid fines",
      body: "Overstay records and outstanding fines stay on the ICP/GDRFA systems permanently. New applications are refused until fines are cleared — compliance history is now linked to future approvals.",
    },
    {
      title: "An old visa still open in the system",
      body: "An active prior entry permit or uncancelled residence visa blocks a new tourist visa until it's cancelled or expires.",
    },
    {
      title: "Data mismatch",
      body: "Name, passport number, or date-of-birth inconsistencies between the application and passport — or travel dates that don't match the visa requested.",
    },
    {
      title: "Nationality-specific document gaps",
      body: "Missing home-country ID card for Iraq, Pakistan, Iran, or Afghanistan nationals, or missing financial documents where required.",
    },
  ],

  entryTitle: "Entry & exit regulations",
  entrySub:
    "No arrival card is needed — the UAE has no equivalent of Thailand's TDAC or Malaysia's MDAC. Biometrics (face and iris) are captured at immigration, and airlines can ask for your onward ticket at check-in — it's a formal visa condition.",
  entryExit: [
    { icon: "refresh", k: "Entry", v: "Single or Multiple", sub: "Chosen at application — both exist for 30- and 60-day visas" },
    { icon: "clock", k: "Activate within", v: "~60 days", sub: "From the issue date — enter before the window closes" },
    { icon: "plane", k: "Arrival card", v: "Not required", sub: "Biometrics captured at the border instead" },
  ],

  extensionTitle: "Visa extension & overstays",
  extensionSub:
    "Since December 2025, 30- and 60-day visit visas extend fully online through ICP Smart Services — no more exiting and re-entering. Extensions run up to 120 days total and must be filed before expiry; fines start the day after.",
  extension: [
    { icon: "extend", k: "Extension", v: "Up to 120 days", sub: "Once or multiple times · fully online via ICP · ~2 days" },
    { icon: "currency", k: "Extension fee", v: "AED 600", sub: "AED 100 application + AED 500 extension ≈ SGD 210" },
    { icon: "alert", k: "Overstay fine", v: "AED 50 / day", sub: "≈ SGD 17.50 per day · unified rate, no grace period" },
  ],

  reviews: {
    score: "4.7",
    outOf: "/ 5",
    sub: "Trusted by thousands of travellers · 8,932 reviews",
    platforms: [
      { rating: "4.7", name: "Trustpilot" },
      { rating: "4.8", name: "App Store" },
    ],
    items: [
      {
        initials: "NS",
        name: "Nadia Shah",
        source: "Trustpilot · 3 days ago",
        title: "Dubai visa in under 3 days",
        body: "First time applying for a UAE visa and I was nervous about the photo spec. The consultant flagged the background colour before submission and sorted it. No stress at all.",
      },
      {
        initials: "BL",
        name: "Bernard Lim",
        source: "App Store · 6 days ago",
        title: "Status updates made all the difference",
        body: "Watched my application move through each stage in real time. Knew exactly when the visa was issued — no refreshing emails. Would not apply any other way.",
      },
    ],
  },

  faqSub:
    "Can't find an answer? Ask the AI assistant at the bottom of this page or message your VIZA consultant.",
  faq: [
    {
      category: "General information",
      q: "What is the UAE tourist visa and who issues it?",
      a: "A 30- or 60-day tourist visa issued by GDRFA Dubai or the federal ICP. Unusually, you can't apply direct or at an embassy — applications must be filed by a licensed sponsor such as an airline, a UAE hotel, or a licensed travel agent. VIZA files through its licensed channel, so for you it works like any online visa.",
    },
    {
      category: "General information",
      q: "Do Singapore or Chinese passport holders need this visa?",
      a: "No. Singapore passports get free visa on arrival for 90 days within any 180-day period (since September 2024). Chinese ordinary passports are visa-free for the same 90-in-180 stay under the 2018 China–UAE mutual exemption. Both need 6+ months' passport validity. VIZA confirms your eligibility before you pay a cent.",
    },
    {
      category: "General information",
      q: "Can I travel to all seven emirates on one visa?",
      a: "Yes. A UAE tourist visa is valid across all seven emirates — Dubai, Abu Dhabi, Sharjah, Ajman, Ras Al Khaimah, Fujairah, and Umm Al Quwain. There are no inter-emirate border checks.",
    },
    {
      category: "Application process",
      q: "How quickly will I receive my UAE tourist visa?",
      a: "GDRFA Dubai's stated processing time is 48 hours once filed. Through VIZA, most visas are delivered within 2 – 3 business days end-to-end, backed by our on-time guarantee — your money back if we're late.",
    },
    {
      category: "Application process",
      q: "How much is the government fee?",
      a: "For the 30-day visa, GDRFA charges AED 252 + 5% VAT + AED 20 in knowledge/innovation dirhams (≈ SGD 100). The 60-day visa is AED 352 + VAT (≈ SGD 130). A 5-year multi-entry tourist visa also exists at AED 713.50 in fees plus a refundable AED 3,000 guarantee deposit, with a USD 4,000 bank-balance requirement.",
    },
    {
      category: "Refunds, rejections & reapplications",
      q: "What happens if my UAE tourist visa is refused?",
      a: "The UAE government retains its fee; VIZA's service fee is fully refunded. Your consultant reviews the refusal — the most common causes are unpaid fines from a previous stay or an old visa still open in the system — and helps you clear the blocker and reapply.",
    },
  ],

  sources: [
    {
      label: "UAE Official Government Portal — Tourist visa",
      url: "https://u.ae/en/information-and-services/visa-and-emirates-id/tourist-visa",
      display: "u.ae",
    },
    {
      label: "GDRFA Dubai — Issuance of a single-entry tourist visa",
      url: "https://www.gdrfad.gov.ae/en/services/f9e586fe-0642-11ec-0320-0050569629e8",
      display: "gdrfad.gov.ae",
    },
    {
      label: "ICP — Visa extension service",
      url: "https://icp.gov.ae/en/services-details/?serviceid=64afe3c1035448005bd52e62",
      display: "icp.gov.ae",
    },
    {
      label: "ICP Smart Services portal",
      url: "https://smartservices.icp.gov.ae",
      display: "smartservices.icp.gov.ae",
    },
    {
      label: "Chinese Embassy in the UAE — Entry & exit requirements",
      url: "https://ae.china-embassy.gov.cn/chn//faxz/crjyq/",
      display: "ae.china-embassy.gov.cn",
    },
  ],

  price: {
    etaLabel: "Apply now, get it by",
    etaValue: "18 Jun 2026, 12:00 PM",
    title: "Tourist visa · 30 or 60-day stay",
    saving: "Faster than applying direct",
    sub: "All-inclusive of government fee, document review, and on-time guarantee.",
    foot: "Government fee and VIZA processing are collected together at checkout, backed by our on-time guarantee.",
  },

  aiPlaceholder: "Ask anything about UAE visas — visa-free entry, fees, extensions…",
};

export default unitedArabEmirates;
