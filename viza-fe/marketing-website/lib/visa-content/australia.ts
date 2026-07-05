import type { VisaContent } from "./types";

/**
 * Australia Visitor Visa (subclass 600) — Tourist stream, plus ETA (subclass
 * 601) guidance for eligible passports (incl. Singapore).
 *
 * Last fact-checked: 2026-07-05 against immi.homeaffairs.gov.au, abf.gov.au,
 * singapore.highcommission.gov.au, china.embassy.gov.au and
 * minister.agriculture.gov.au.
 *
 * Confirmed:
 *  - Fees from 1 July 2026: subclass 600 Tourist stream AUD 250 offshore /
 *    AUD 630 onshore; Frequent Traveller stream AUD 1,845. ETA (601): no visa
 *    charge, AUD 20 app service fee. Fee is locked at lodgement date.
 *  - Stay per entry: 3, 6 or 12 months as granted (3 months most common for
 *    tourism); travel validity typically up to 12 months from grant.
 *  - Entries: single or multiple at the Department's discretion
 *    (multiple-entry over 12 months is common). ETA (601): multiple, 12
 *    months, up to 3 months per visit, app-only application.
 *  - No daily overstay fine in Australia. Overstaying 28+ days triggers a
 *    3-year re-entry exclusion (PIC 4014); overstayers are unlawful
 *    non-citizens liable to detention/removal with costs recoverable as a
 *    Commonwealth debt. Leaving voluntarily within 28 days generally avoids
 *    the ban.
 *  - No "extension": a fresh onshore subclass 600 is lodged via ImmiAccount
 *    before expiry (blocked by condition 8503 unless waived).
 *  - Processing (early-2026 snapshot): tourist stream ~50% in 11 days, 90% in
 *    28-45 days; ETA usually minutes to 12 hours.
 *
 * Items needing ops confirmation:
 *  1. Exact 1 July 2026 fee figures (AUD 250 / 630 / 1,845) verified via
 *     secondary migration-law sources only — confirm on the official visa
 *     pricing estimator before publishing.
 *  2. Processing-time percentiles change monthly; refresh from the Home
 *     Affairs global processing times tool.
 *  3. 45 x 35 mm photo spec is the long-standing Form 1419 standard — not
 *     re-verified on the current form.
 *  4. China checklist source is a DIBP-era embassy PDF — confirm current AVAC
 *     checklist wording (esp. "financial evidence only for first visit").
 *  5. Home Affairs has no formal 6-month passport-validity rule, but airlines
 *     may apply their own — we advise 6 months as best practice.
 *  6. Frequent Traveller 12-months-in-any-24 cumulative-stay cap taken from
 *     secondary sources — verify on the official stream page.
 */
export const australia: VisaContent = {
  slug: "australia",

  heroTitle: "Australia Visitor Visa",
  lede: "The Visitor visa (subclass 600, Tourist stream) grants stays of 3, 6 or 12 months per entry, with travel typically allowed for 12 months from grant. Singapore passport holders qualify for the faster ETA (subclass 601). Either way, your VIZA consultant prepares, lodges, and tracks the application end-to-end.",
  heroImage: "/assets/heroes/australia.jpg",
  meta: [
    { k: "Type", v: "Visitor 600 / ETA 601" },
    { k: "Length of stay", v: "3 / 6 / 12 months per entry" },
    { k: "Validity", v: "Up to 12 months" },
    { k: "Entry", v: "Multiple (typical)" },
  ],
  tags: [
    { icon: "bolt", label: "Expert-prepared application" },
    { icon: "shield", label: "On-time guarantee" },
    { icon: "doc", label: "Full document review" },
  ],

  overviewTitle: "Australia, at a glance",
  overviewSub:
    "The Visitor visa (subclass 600) is Australia's primary tourism and family-visit pathway. Singapore and other eligible passports can instead use the app-only ETA (subclass 601) — multiple entries over 12 months, up to 3 months per visit.",
  glance: [
    { icon: "globe", k: "Capital", v: "Canberra", sub: "UTC +10 / +11 (AEST / AEDT)" },
    { icon: "clock", k: "Best time to visit", v: "Sep – Nov / Mar – May", sub: "Spring & autumn · 18 – 26°C" },
    { icon: "currency", k: "Currency", v: "Australian Dollar", sub: "SGD 1 ≈ AUD 1.10 (approx.)" },
    { icon: "pin", k: "Top destinations", v: "Sydney · Melbourne · Great Barrier Reef", sub: "Plus Gold Coast, Perth, Uluru" },
  ],

  processTitle: "How the Australia Visitor Visa process works",
  processSub:
    "Submit once. We lodge via ImmiAccount, handle every step with the Department of Home Affairs, and notify you the moment your visa is granted. Home Affairs decides ~50% of tourist-stream cases in about 11 days and 90% within 28 – 45 days — lodge 1 – 2 months before travel.",
  steps: [
    {
      title: "Apply on VIZA",
      body: "Upload your passport, a 45 × 35 mm photo, proof of funds, and supporting documents. Your consultant tailors the package to your profile — and tells you exactly what a genuine-visitor assessment looks for.",
    },
    {
      title: "Your documents are verified",
      body: "Your VIZA consultant reviews every field and supporting document against Department of Home Affairs requirements, then lodges the application online via ImmiAccount.",
    },
    {
      title: "Your visa gets processed",
      body: "We monitor your ImmiAccount status daily and respond fast if the case officer requests more information — the single biggest cause of blown timelines. Don't book flights yet: Home Affairs advises waiting for the grant.",
      statusRows: [
        { label: "Application lodged via ImmiAccount", ts: "10 Jun, 10:00 AM", onTime: true },
        { label: "Health and character checks initiated", ts: "10 Jun, 2:30 PM", onTime: true },
        { label: "Awaiting officer decision", ts: "In progress" },
      ],
    },
    {
      title: "Get your visa grant on 21 Jun, 02:15 PM",
      body: "Your visa grant notice arrives by email and in your VIZA app. The visa is electronically linked to your passport — no label required.",
      delivered: true,
    },
  ],

  docsTitle: "Required documents",
  docsSub:
    "Your VIZA consultant double-checks each document before submission. Re-uploads are unlimited and free.",
  documents: [
    { name: "Passport bio page", sub: "Colour scan · valid for your whole stay (we advise 6+ months)" },
    { name: "Passport photograph", sub: "One recent colour photo · 45 × 35 mm · plain background" },
    { name: "Proof of funds", sub: "Bank statements (3 – 6 months), payslips, or tax records" },
    { name: "Employment or study evidence", sub: "Employer letter with approved leave · business licence · enrolment proof" },
    { name: "Travel intent evidence", sub: "Itinerary + ties to home — do not buy flights before the grant" },
    { name: "Invitation documents", sub: "Visiting family/friends: inviter's details, passport/visa copy, support letter" },
    { name: "Documents for minors (under 18)", sub: "Birth certificate naming both parents · Form 1229 consent if one parent stays behind" },
    { name: "PRC applicants", sub: "National ID (both sides), hukou, Form 54 in English and Chinese" },
  ],

  rejectionTitle: "Why Australia Visitor Visas get refused",
  rejectionSub:
    "The Department of Home Affairs may refuse an application for any of the following. VIZA flags these before you submit.",
  rejectionReasons: [
    { title: "Not a genuine visitor", body: "Weak ties to home — no stable job, family, or assets — a vague travel purpose, or immigration history suggesting intent to stay. The most common subclass 600 refusal ground." },
    { title: "Insufficient funds", body: "Statements that don't show a steady savings or income history, or large unexplained recent deposits, fail to prove you can support yourself for the whole stay." },
    { title: "Incomplete or poor-quality documents", body: "A missing employment letter, illegible scans, or missing PRC identity documents (ID card, hukou, Form 54) cause delays and refusals." },
    { title: "False or misleading information", body: "Any fraudulent document or inconsistency can trigger refusal under PIC 4020 — plus a 3-year ban on further applications." },
    { title: "Previous visa non-compliance", body: "Prior overstays, breaches of visa conditions, or an unresolved re-entry exclusion (PIC 4013/4014) lead to refusal." },
    { title: "Health or character concerns", body: "Failing health requirements (relevant for older applicants and long stays) or character grounds such as a criminal record under s501." },
  ],

  entryTitle: "Entry & exit regulations",
  entrySub:
    "Your visa is electronically linked to your passport — nothing is issued on arrival, so hold your ETA or subclass 600 before boarding. Every arrival completes an Incoming Passenger Card (a digital Australia Travel Declaration is rolling out on select Qantas routes), and biosecurity rules are strictly enforced.",
  entryExit: [
    { icon: "refresh", k: "Entry", v: "Multiple (typical)", sub: "Travel freely within the grant's validity" },
    { icon: "doc", k: "Arrival card", v: "Incoming Passenger Card", sub: "Paper IPC · digital ATD pilot on select Qantas flights to BNE/SYD/MEL" },
    { icon: "bolt", k: "SmartGate", v: "All ePassports", sub: "Singapore and PRC ePassports both eligible" },
    { icon: "alert", k: "Biosecurity", v: "Declare food, plant & animal goods", sub: "Heavy on-the-spot fines for false declarations" },
  ],

  extensionTitle: "Visa extension & overstays",
  extensionSub:
    "Australian visitor visas can't be extended — instead, you lodge a fresh onshore subclass 600 via ImmiAccount before your current visa expires (AUD 630, unless condition 8503 'No Further Stay' applies). A bridging visa keeps you lawful while it's decided. There is no daily overstay fine: overstaying 28+ days triggers a 3-year re-entry ban, and overstayers face detention and removal at their own cost.",
  extension: [
    { icon: "extend", k: "Staying longer", v: "New onshore 600", sub: "AUD 630 · lodge 2 – 3 weeks before expiry · blocked by condition 8503" },
    { icon: "ban", k: "Overstay 28+ days", v: "3-year re-entry ban", sub: "PIC 4014 · leave within 28 days to avoid it" },
    { icon: "alert", k: "Overstay fine", v: "None — but removal costs billed", sub: "Unlawful status · detention risk · debt to the Australian Government" },
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
        initials: "JW",
        name: "Jessica Wong",
        source: "Trustpilot · 1 week ago",
        title: "Grant came through in 5 days",
        body: "Incredibly smooth process. The consultant built the whole document package for me and I barely had to do anything beyond uploading my passport.",
      },
      {
        initials: "DA",
        name: "Daniel Ang",
        source: "App Store · 3 weeks ago",
        title: "Consultant saved my application",
        body: "The bank statements I originally sent weren't going to be enough. The consultant guided me on what to include and we got the grant first time.",
      },
    ],
  },

  faqSub: "Can't find an answer? Ask the AI assistant at the bottom of this page.",
  faq: [
    {
      category: "General information",
      q: "What is the Australia Visitor visa (subclass 600)?",
      a: "The subclass 600 Visitor visa (Tourist stream) is Australia's standard tourism and family-visit visa. The Department of Home Affairs sets your stay at 3, 6, or 12 months per entry — 3 months is most common for tourism — with travel typically allowed for 12 months from grant, and single or multiple entries at the officer's discretion.",
    },
    {
      category: "General information",
      q: "Do Singapore passport holders need a visa for Australia?",
      a: "Yes — Singapore is not visa-free, but qualifies for the ETA (subclass 601): multiple entries over 12 months, up to 3 months per visit, approved usually within minutes to 12 hours. It's app-only (the official Australian ETA app, AUD 20 service fee, NFC passport scan and live photo required) — VIZA walks you through it end-to-end. For stays over 3 months, or after an ETA refusal, we lodge a subclass 600 instead.",
    },
    {
      category: "General information",
      q: "What about Chinese (PRC) passport holders?",
      a: "PRC passports are not ETA-eligible, so the subclass 600 via ImmiAccount is the route — including for PRC applicants residing in Singapore. Expect extra checklist items: both sides of your national ID, hukou, and Form 54 in English and Chinese. Frequent travellers can opt for the Frequent Traveller stream — a 10-year multiple-entry visa (3 months per stay), AUD 1,845 from 1 July 2026.",
    },
    {
      category: "Application process",
      q: "How much does the visa cost?",
      a: "From 1 July 2026, the subclass 600 Tourist stream government charge is AUD 250 (≈ SGD 220) applying from outside Australia, or AUD 630 (≈ SGD 555) onshore. The ETA (601) has no visa charge — just a AUD 20 (≈ SGD 18) app service fee. The fee is locked at the rate on your lodgement date.",
    },
    {
      category: "Application process",
      q: "How long does processing take?",
      a: "ETAs are usually approved within minutes to 12 hours. For the subclass 600 Tourist stream, Home Affairs decides about half of applications in 11 days and 90% within 28 – 45 days (early-2026 figures). Lodge 1 – 2 months before travel, and hold off booking flights until the grant — that's official Home Affairs advice.",
    },
    {
      category: "Application process",
      q: "Can I apply for family members in one order?",
      a: "Yes. Each traveller requires their own application, but your VIZA consultant coordinates them so they are lodged together and reviewed on the same timeline. Children under 18 need extra documents — a birth certificate naming both parents and Form 1229 consent if a parent isn't travelling.",
    },
    {
      category: "Refunds, rejections & reapplications",
      q: "What if my application is refused?",
      a: "The Department of Home Affairs retains the government application fee on refusal. VIZA's service fee is fully refunded. Your consultant will review the refusal reasons with you — most commonly the genuine-visitor requirement — and advise on strengthening a future application.",
    },
  ],

  sources: [
    { label: "Dept of Home Affairs — Visitor visa (subclass 600), Tourist stream", url: "https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/visitor-600/tourist-stream-overseas", display: "immi.homeaffairs.gov.au" },
    { label: "Dept of Home Affairs — Electronic Travel Authority (subclass 601)", url: "https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/electronic-travel-authority-601", display: "immi.homeaffairs.gov.au" },
    { label: "Dept of Home Affairs — Current visa pricing", url: "https://immi.homeaffairs.gov.au/visas/getting-a-visa/fees-and-charges/current-visa-pricing", display: "immi.homeaffairs.gov.au" },
    { label: "Dept of Home Affairs — Global visa processing times", url: "https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-processing-times/global-visa-processing-times", display: "immi.homeaffairs.gov.au" },
    { label: "ImmiAccount — Australian online visa lodgement", url: "https://online.immi.gov.au/lusc/login", display: "online.immi.gov.au" },
    { label: "Australian Border Force — Incoming Passenger Card", url: "https://www.abf.gov.au/entering-and-leaving-australia/crossing-the-border/at-the-border/incoming-passenger-card-(ipc)", display: "abf.gov.au" },
    { label: "Australian High Commission Singapore — Visas and Migration", url: "https://singapore.highcommission.gov.au/sing/Visas_and_Migration.html", display: "singapore.highcommission.gov.au" },
    { label: "Australian Embassy China — Visitor visa (600) Tourist stream checklist", url: "https://china.embassy.gov.au/files/bjng/Visitor%20Visa%20-%20Tourist%20Stream%20(Subclass%20600).pdf", display: "china.embassy.gov.au" },
  ],

  price: {
    etaLabel: "Apply now, get it by",
    etaValue: "21 Jun 2026, 02:15 PM",
    title: "Visitor 600 · Tourist stream · up to 12-month validity",
    saving: "Decision-ready first time",
    sub: "All-inclusive of government fee, document preparation, and on-time guarantee.",
    foot: "Government fee and VIZA processing are collected together at checkout, backed by our on-time guarantee.",
  },

  aiPlaceholder: "Ask anything about Australia visas — fees, processing, documents…",
};

export default australia;
