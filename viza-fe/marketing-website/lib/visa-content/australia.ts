import type { VisaContent } from "./types";

/**
 * Australia Visitor Visa (subclass 600) — Tourist stream content.
 * Fact-checked: 2026-06-10 against immi.homeaffairs.gov.au.
 *
 * Confirmed:
 *  - Tourist stream: multiple-entry, up to 12 months from grant date — correct.
 *  - Stay periods (3/6/12 months) are granted at officer discretion — correct.
 *  - There is NO daily monetary fine for overstaying in Australia.
 *    Consequences are: unlawful non-citizen status → visa cancellation →
 *    detention/deportation → 3-year re-entry ban (triggered after 28+ days
 *    overstay; waivable on compassionate grounds). Permanent exclusion is
 *    possible for egregious cases via PIC 4014.
 *  - Extension ("Further Stay"): apply in-country before current visa expires.
 *  - immi.homeaffairs.gov.au confirmed as official portal.
 *
 * OPS NOTE: Stay period actually granted varies by nationality and profile;
 * "up to 3/6/12 months" reflects what officers may grant, not a fixed term.
 */
export const australia: VisaContent = {
  slug: "australia",

  heroTitle: "Australia Visitor Visa",
  lede: "A multiple-entry Visitor visa (subclass 600) granting stays of up to 3, 6, or 12 months, valid for 1 year from grant. Applied for online and managed end-to-end by your VIZA consultant.",
  heroImage: "/assets/heroes/australia.jpg",
  meta: [
    { k: "Type", v: "Visitor 600" },
    { k: "Length of stay", v: "Up to 3 / 6 / 12 months" },
    { k: "Validity", v: "1 year" },
    { k: "Entry", v: "Multiple" },
  ],
  tags: [
    { icon: "bolt", label: "Expert-prepared application" },
    { icon: "shield", label: "On-time guarantee" },
    { icon: "doc", label: "Full document review" },
  ],

  overviewTitle: "Australia, at a glance",
  overviewSub:
    "The Visitor visa (subclass 600) is Australia's primary tourism and family-visit pathway, allowing eligible travellers to explore the country multiple times within the grant period.",
  glance: [
    { icon: "globe", k: "Capital", v: "Canberra", sub: "UTC +10 / +11 (AEST / AEDT)" },
    { icon: "clock", k: "Best time to visit", v: "Sep – Nov / Mar – May", sub: "Spring & autumn · 18 – 26°C" },
    { icon: "currency", k: "Currency", v: "Australian Dollar", sub: "SGD 1 ≈ AUD 1.10 (approx.)" },
    { icon: "pin", k: "Top destinations", v: "Sydney · Melbourne · Great Barrier Reef", sub: "Plus Gold Coast, Perth, Uluru" },
  ],

  processTitle: "How the Australia Visitor Visa process works",
  processSub:
    "Submit once. We handle every step with the Department of Home Affairs and notify you the moment your visa is granted.",
  steps: [
    {
      title: "Apply on VIZA",
      body: "Upload your passport, proof of funds, travel itinerary, and supporting documents. Your consultant tailors the package to your profile.",
    },
    {
      title: "Your documents are verified",
      body: "Your VIZA consultant reviews every field and supporting document against Department of Home Affairs requirements before lodging via ImmiAccount.",
    },
    {
      title: "Your visa gets processed",
      body: "We monitor your application status and liaise proactively if the case officer requests additional information.",
      statusRows: [
        { label: "Application lodged via ImmiAccount", ts: "10 Jun, 10:00 AM", onTime: true },
        { label: "Health and character checks initiated", ts: "10 Jun, 2:30 PM", onTime: true },
        { label: "Awaiting officer decision", ts: "In progress" },
      ],
    },
    {
      title: "Get your visa grant on 14 Jun, 02:15 PM",
      body: "Your visa grant notice arrives by email and in your VIZA app. The visa is electronically linked to your passport — no label required.",
      delivered: true,
    },
  ],

  docsTitle: "Required documents",
  docsSub:
    "Your VIZA consultant double-checks each document before submission. Re-uploads are unlimited and free.",
  documents: [
    { name: "Passport bio page", sub: "Valid for at least 6 months beyond intended stay" },
    { name: "Proof of funds", sub: "Bank statements · last 3 months" },
    { name: "Travel itinerary", sub: "Flight bookings and accommodation confirmation" },
    { name: "Supporting documents", sub: "Employment letter, ties to home country, or sponsor letter as applicable" },
  ],

  rejectionTitle: "Why Australia Visitor Visas get refused",
  rejectionSub:
    "The Department of Home Affairs may refuse an application for any of the following. VIZA flags these before you submit.",
  rejectionReasons: [
    { title: "Insufficient ties to home country", body: "Officers look for evidence — employment, property, family — that the applicant will return home before the visa expires." },
    { title: "Inadequate proof of funds", body: "Insufficient bank history or unexplained large deposits can raise concerns about the applicant's ability to support themselves during the visit." },
    { title: "Prior visa breaches or refusals", body: "A history of overstaying, previous visa refusals in Australia or other countries, or adverse character findings can lead to refusal." },
  ],

  entryTitle: "Entry & exit regulations",
  entrySub:
    "Your visa is electronically linked to your passport. Carry your grant notice email and return or onward flight evidence at the immigration counter.",
  entryExit: [
    { icon: "refresh", k: "Entry", v: "Multiple", sub: "Travel freely within the validity period" },
    { icon: "clock", k: "Validity", v: "1 year", sub: "From the date of grant" },
  ],

  extensionTitle: "Visa extension & overstays",
  extensionSub:
    "Visitor visa holders who need more time may apply for a further stay from within Australia before their visa expires. Overstaying is a serious breach and can result in a ban.",
  extension: [
    { icon: "extend", k: "Further Stay", v: "Apply in-country", sub: "Lodged before current visa expires" },
    { icon: "alert", k: "Overstay consequence", v: "3-year ban", sub: "Plus potential permanent exclusion" },
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
      a: "The subclass 600 Visitor visa is Australia's standard tourism and family-visit visa. It allows multiple entries during the validity period and stays of up to 3, 6, or 12 months depending on what the Department of Home Affairs grants based on your application.",
    },
    {
      category: "General information",
      q: "Do I need to attend a biometric appointment?",
      a: "Most applicants do not need to attend an appointment. However, the Department of Home Affairs may request a health examination or additional biometrics depending on your nationality and travel history.",
    },
    {
      category: "Application process",
      q: "How long does processing take?",
      a: "Processing times vary significantly by nationality and individual circumstances. Simple applications are often decided within a week; complex cases can take several weeks. VIZA prepares the strongest possible package to minimise delays.",
    },
    {
      category: "Application process",
      q: "Can I apply for family members in one order?",
      a: "Yes. Each traveller requires their own application, but your VIZA consultant can coordinate them so they are lodged together and reviewed on the same timeline.",
    },
    {
      category: "Refunds, rejections & reapplications",
      q: "What if my application is refused?",
      a: "The Department of Home Affairs retains the government application fee on refusal. VIZA's service fee is fully refunded. Your consultant will review the refusal reasons with you and advise on strengthening a future application or pursuing a review.",
    },
  ],

  sources: [
    { label: "Dept of Home Affairs — Visitor visa (subclass 600)", url: "https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/visitor-600", display: "immi.homeaffairs.gov.au" },
    { label: "ImmiAccount — Australian online visa lodgement", url: "https://online.immi.gov.au/lusc/login", display: "online.immi.gov.au" },
    { label: "Australian Border Force — Entering Australia", url: "https://www.abf.gov.au/entering-and-leaving-australia", display: "abf.gov.au" },
  ],

  price: {
    etaLabel: "Apply now, get it by",
    etaValue: "14 Jun 2026, 02:15 PM",
    title: "Visitor 600 · up to 12-month validity",
    saving: "2 days faster",
    sub: "All-inclusive of government fee, document preparation, and on-time guarantee.",
    foot: "Government fee and VIZA processing are collected together at checkout, backed by our on-time guarantee.",
  },

  aiPlaceholder: "Ask anything about Australia visas — fees, processing, documents…",
};

export default australia;
