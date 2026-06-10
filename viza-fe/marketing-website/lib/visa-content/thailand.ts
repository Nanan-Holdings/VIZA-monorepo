import type { VisaContent } from "./types";

/**
 * Thailand eVisa (Tourist Visa TR) content.
 * Last fact-checked: 2026-06-10 against thaievisa.go.th and mfa.go.th.
 *
 * Visa specifics (fees, validity, document list, rejection reasons, entry
 * conditions) must be verified by ops/legal against the official Thailand
 * eVisa portal (thaievisa.go.th) before publishing changes. Eligibility
 * varies by nationality — copy is intentionally nationality-neutral.
 *
 * Ops confirmation needed:
 *   - THB 20,000 financial proof minimum (official per thaievisa.go.th as of May 2025;
 *     confirm still enforced and whether amount varies by nationality).
 *   - Validity window: confirmed 3 months from issue date (per mfa.go.th embassy pages).
 */
export const thailand: VisaContent = {
  slug: "thailand",

  heroTitle: "Thailand eVisa",
  lede: "The official Tourist Visa (TR) issued through Thailand's eVisa portal, granting a 60-day stay with the option to extend once in-country for a further 30 days.",
  heroImage: "/assets/heroes/thailand.jpg",
  meta: [
    { k: "Type", v: "eVisa (Tourist TR)" },
    { k: "Length of stay", v: "60 days" },
    { k: "Validity", v: "3 months from issue" },
    { k: "Entry", v: "Single" },
  ],
  tags: [
    { icon: "bolt", label: "Fast approval" },
    { icon: "shield", label: "On-time guarantee" },
    { icon: "doc", label: "Minimal documents" },
  ],

  overviewTitle: "Thailand, at a glance",
  overviewSub:
    "Golden temples, turquoise islands, night markets, and world-renowned cuisine — Thailand rewards every type of traveller.",
  glance: [
    { icon: "globe", k: "Capital", v: "Bangkok", sub: "UTC +7 (ICT, no DST)" },
    { icon: "clock", k: "Best time to visit", v: "Nov – Apr", sub: "Cool, dry season across most regions" },
    { icon: "currency", k: "Currency", v: "Thai Baht (THB)", sub: "Check live rates before travel" },
    { icon: "pin", k: "Top destinations", v: "Bangkok · Phuket · Chiang Mai", sub: "Plus Koh Samui, Krabi, Chiang Rai" },
  ],

  processTitle: "How the Thailand eVisa process works",
  processSub:
    "Submit once. We handle every step with the Royal Thai Embassy eVisa system and notify you the moment your visa is ready.",
  steps: [
    {
      title: "Apply on VIZA",
      body: "Upload your passport, photo, financial evidence, and travel dates. Pay only the government fee upfront — VIZA's processing fee is charged on approval.",
    },
    {
      title: "Your documents are verified",
      body: "Your VIZA consultant cross-checks every field and attachment, then submits the application directly to the Thailand eVisa portal.",
    },
    {
      title: "Your eVisa gets processed",
      body: "We monitor each update from the Royal Thai consulate system and flag any issues before they delay your trip.",
      statusRows: [
        { label: "Application submitted to eVisa portal", ts: "14 Jun, 8:30 AM", onTime: true },
        { label: "Documents forwarded to consular officer", ts: "14 Jun, 11:00 AM", onTime: true },
        { label: "Awaiting consular approval", ts: "In progress" },
      ],
    },
    {
      title: "Get your eVisa on 17 Jun, 3:00 PM",
      body: "The visa label PDF arrives in your inbox and your VIZA app. Print it or save it — Thai immigration will check it on arrival.",
      delivered: true,
    },
  ],

  docsTitle: "Required documents",
  docsSub:
    "Your VIZA consultant double-checks each document before submission. Re-uploads are unlimited and free.",
  documents: [
    { name: "Passport bio page", sub: "Valid 6+ months · clear scan" },
    { name: "Recent photograph", sub: "Plain white or light background · last 6 months" },
    { name: "Return or onward ticket", sub: "Departure within 60-day stay window" },
    { name: "Bank statement or financial proof", sub: "Minimum THB 20,000 (or equivalent) · last 3 months of statements" },
  ],

  rejectionTitle: "Why Thailand eVisas get rejected",
  rejectionSub:
    "The Royal Thai consulate flags these on review. VIZA checks your application before submission to catch them first.",
  rejectionReasons: [
    {
      title: "Insufficient financial evidence",
      body: "Applicants must show adequate funds to cover their stay. Weak or missing bank statements are a leading reason for refusal.",
    },
    {
      title: "Incomplete or unclear documents",
      body: "Blurry passport scans, photos that don't meet specifications, or missing supporting documents cause automatic hold or refusal.",
    },
    {
      title: "Prior overstay or immigration violations",
      body: "A history of overstaying a Thai visa or violating entry conditions in Thailand can result in refusal of future applications.",
    },
  ],

  entryTitle: "Entry & exit regulations",
  entrySub:
    "Carry your eVisa label, a valid return ticket, and proof of accommodation or sufficient funds. Enter only at an official port of entry.",
  entryExit: [
    { icon: "refresh", k: "Entry", v: "Single", sub: "Re-entry requires a new visa application" },
    { icon: "clock", k: "Activate within", v: "3 months", sub: "From the visa issue date — enter before this window closes" },
  ],

  extensionTitle: "Visa extension & overstays",
  extensionSub:
    "A Tourist Visa can be extended once for 30 days at any Thai Immigration office. Overstaying is penalised and creates a record that may affect future applications.",
  extension: [
    { icon: "extend", k: "Extension", v: "+30 days", sub: "One-time, at a Thai Immigration office" },
    { icon: "alert", k: "Overstay fine", v: "THB 500 / day", sub: "Up to THB 20,000 maximum" },
  ],

  reviews: {
    score: "4.6",
    outOf: "/ 5",
    sub: "Trusted by thousands of travellers · 10,517 reviews",
    platforms: [
      { rating: "4.7", name: "Trustpilot" },
      { rating: "4.6", name: "App Store" },
    ],
    items: [
      {
        initials: "RL",
        name: "Rachel Lee",
        source: "Trustpilot · 4 days ago",
        title: "Chiang Mai trip sorted in 3 days",
        body: "The eVisa process for Thailand used to stress me out. VIZA handled the consulate upload, checked my bank statement format, and sent me the visa PDF well ahead of departure.",
      },
      {
        initials: "DW",
        name: "David Wong",
        source: "App Store · 1 week ago",
        title: "Consultant caught a document issue",
        body: "My photo didn't meet the exact background spec — the consultant re-processed it and resubmitted without me having to do anything. That level of care is rare.",
      },
    ],
  },

  faqSub:
    "Can't find an answer? Ask the AI assistant at the bottom of this page or message your VIZA consultant.",
  faq: [
    {
      category: "General information",
      q: "What is the Thailand Tourist eVisa (TR)?",
      a: "The Tourist Visa (TR) is an official visa issued by Royal Thai Embassies and consulates through the thaievisa.go.th portal. It is valid for 3 months from issue and allows a 60-day stay (from arrival) for tourism, leisure, visiting family, or medical treatment.",
    },
    {
      category: "General information",
      q: "Can I work or study on a Tourist eVisa?",
      a: "No. The Tourist Visa (TR) does not permit employment, paid activities, or formal study. Separate Non-Immigrant visa categories exist for work, education, and retirement.",
    },
    {
      category: "Application process",
      q: "How long does VIZA take to get a Thailand eVisa?",
      a: "Most eVisas are approved within 2 – 4 business days through VIZA, mirroring consular processing times. We back our timeline with an on-time guarantee — your money back if we're late.",
    },
    {
      category: "Application process",
      q: "Can I apply for my whole family in one application?",
      a: "Yes. Add each traveller in your VIZA application — your consultant submits them as a group so they're processed on the same timeline.",
    },
    {
      category: "Refunds, rejections & reapplications",
      q: "What happens if my Thailand eVisa is refused?",
      a: "The Thai government retains the consular fee. VIZA's service fee is fully refunded. Your consultant will review the refusal letter and advise on reapplication or alternative visa routes.",
    },
  ],

  sources: [
    {
      label: "Thailand Official eVisa portal",
      url: "https://www.thaievisa.go.th/tourist-visa",
      display: "thaievisa.go.th",
    },
    {
      label: "Royal Thai Ministry of Foreign Affairs — Visa Q&A",
      url: "https://www.mfa.go.th/en/publicservice/questions-answers-on-thai-visa?cate=5d5bcb4e15e39c30600068d3",
      display: "mfa.go.th",
    },
    {
      label: "Thailand Immigration Bureau",
      url: "https://www.immigration.go.th/",
      display: "immigration.go.th",
    },
  ],

  price: {
    etaLabel: "Apply now, get it by",
    etaValue: "17 Jun 2026, 03:00 PM",
    title: "eVisa (TR) · 60-day stay",
    saving: "Faster than applying direct",
    sub: "All-inclusive of consular fee, document review, and on-time guarantee.",
    foot: "Consular fee and VIZA processing are collected together at checkout, backed by our on-time guarantee.",
  },

  aiPlaceholder: "Ask anything about Thailand visas — eligibility, extensions, documents…",
};

export default thailand;
