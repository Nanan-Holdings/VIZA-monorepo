import type { VisaContent } from "./types";

/**
 * Malaysia e-Visa (Tourist).
 *
 * Visa specifics (fees, validity, permitted activities, document requirements,
 * and rejection criteria) should be verified by ops/legal against the Malaysian
 * Immigration Department's official guidance before publishing changes.
 * Note: many nationalities enter Malaysia visa-free; this content applies to
 * nationalities that require a visa to visit.
 *
 * Fact-checked 2026-06-10 against:
 *   - malaysiavisa.imi.gov.my (official eVisa portal — confirmed by imi.gov.my notice)
 *   - imi.gov.my (Immigration Department of Malaysia)
 * Key findings:
 *   - Stay: 30 days ✓  Entry: Single ✓
 *   - Validity: 3 MONTHS from issue date (was incorrectly listed as "30 days" in meta).
 *     Corrected meta Validity field to "3 months".
 *   - Official portal URL is malaysiavisa.imi.gov.my — old imigresen-online.imi.gov.my/evisa
 *     source URL corrected in sources[].
 *   - Overstay penalty: fine up to RM 10,000 or imprisonment up to 5 years; compound
 *     settlement RM 3,000. Overstay sub-text updated to reflect official wording.
 */
export const malaysia: VisaContent = {
  slug: "malaysia",

  heroTitle: "Malaysia e-Visa",
  lede: "The Malaysia Tourist e-Visa is a single-entry electronic visa for stays of up to 30 days. Approved online before travel, it is presented at any international entry point alongside your passport.",
  heroImage: "/assets/heroes/malaysia.jpg",
  meta: [
    { k: "Type", v: "e-Visa (Tourist)" },
    { k: "Length of stay", v: "30 days" },
    { k: "Validity", v: "3 months" },
    { k: "Entry", v: "Single" },
  ],
  tags: [
    { icon: "bolt", label: "Fast track · in 48 hrs" },
    { icon: "shield", label: "On-time guarantee" },
    { icon: "doc", label: "Minimal documents" },
  ],

  overviewTitle: "Malaysia, at a glance",
  overviewSub:
    "The Malaysia Tourist e-Visa covers leisure, sightseeing, and family visits for up to 30 days. It is processed online by the Immigration Department of Malaysia (Jabatan Imigresen Malaysia) and accepted at all international entry points.",
  glance: [
    { icon: "globe", k: "Capital", v: "Kuala Lumpur", sub: "UTC +8 (Malaysia Standard Time)" },
    { icon: "clock", k: "Best time to visit", v: "Mar – Oct", sub: "West coast dry season · east coast Nov – Feb" },
    { icon: "currency", k: "Currency", v: "Malaysian Ringgit (MYR)", sub: "Check live rates before travelling" },
    { icon: "pin", k: "Top destinations", v: "Kuala Lumpur · Penang · Langkawi", sub: "Plus Sabah, Sarawak, and the Cameron Highlands" },
  ],

  processTitle: "How the Malaysia e-Visa process works",
  processSub:
    "Submit once. We handle every step with the Malaysian Immigration Department and notify you when your e-Visa is ready.",
  steps: [
    {
      title: "Apply on VIZA",
      body: "Upload your passport bio page, a recent portrait photo, and your travel dates. Confirm your intended port of entry — airport, land crossing, or seaport.",
    },
    {
      title: "Your documents are verified",
      body: "Your VIZA consultant reviews every field for accuracy and completeness, then submits to the Malaysian Immigration Department via the official eVISA portal.",
    },
    {
      title: "Your e-Visa gets processed",
      body: "We monitor the application queue and alert you immediately if any additional information is requested.",
      statusRows: [
        { label: "Application submitted to Malaysian Immigration", ts: "15 Aug, 8:30 AM", onTime: true },
        { label: "Application under review", ts: "15 Aug, 2:00 PM", onTime: true },
        { label: "Awaiting final approval", ts: "In progress" },
      ],
    },
    {
      title: "Get your e-Visa on 17 Aug, 10:00 AM",
      body: "Your approval letter is sent to your inbox and the VIZA app. Print it or save it to your phone — present it at immigration alongside your passport.",
      delivered: true,
    },
  ],

  docsTitle: "Required documents",
  docsSub:
    "Your VIZA consultant double-checks each document before submission. Re-uploads are unlimited and free.",
  documents: [
    { name: "Passport bio page", sub: "Valid for 6+ months beyond your intended exit date · clear scan" },
    { name: "Recent portrait photograph", sub: "Plain white or light background · full face · last 6 months" },
    { name: "Return flight ticket", sub: "Departure from Malaysia within 30 days of arrival" },
    { name: "Accommodation proof", sub: "Hotel booking or host invitation letter" },
  ],

  rejectionTitle: "Why Malaysia e-Visa applications get rejected",
  rejectionSub:
    "The Malaysian Immigration Department may refuse for any of the following. VIZA flags these before you submit.",
  rejectionReasons: [
    { title: "Passport validity too short", body: "Your passport must be valid for at least 6 months beyond your intended exit date from Malaysia." },
    { title: "Incomplete travel documentation", body: "Missing a confirmed return ticket or accommodation proof are among the most common grounds for refusal." },
    { title: "Prior immigration violations", body: "Previous overstays, deportations, or entry bans relating to Malaysia or other countries can lead to refusal." },
  ],

  entryTitle: "Entry & exit regulations",
  entrySub:
    "Present your e-Visa approval letter and passport at the immigration counter. The 30-day stay begins on the date of arrival, not the date of issue.",
  entryExit: [
    { icon: "refresh", k: "Entry", v: "Single", sub: "Re-entry requires a new e-Visa application" },
    { icon: "clock", k: "Stay period", v: "30 days", sub: "Counted from arrival date" },
  ],

  extensionTitle: "Visa extension & overstays",
  extensionSub:
    "Short extensions may be possible in-country at an Immigration office, subject to approval. Overstaying is an offence under the Immigration Act 1959/63 and can result in a fine of up to RM 10,000 or imprisonment of up to 5 years, or both.",
  extension: [
    { icon: "extend", k: "Extension", v: "Subject to approval", sub: "Apply in-person at an Immigration office before expiry" },
    { icon: "alert", k: "Overstay consequence", v: "Fine up to RM 10,000 or imprisonment", sub: "Up to 5 years imprisonment; compound settlement RM 3,000 (Immigration Act 1959/63, s.15)" },
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
        initials: "DM",
        name: "Divya M.",
        source: "Trustpilot · 1 week ago",
        title: "Seamless — approved in under 2 days",
        body: "The consultant checked everything and flagged that my photo background wasn't quite right before submission. Got the approval letter well ahead of my trip.",
      },
      {
        initials: "CW",
        name: "Calvin W.",
        source: "App Store · 3 weeks ago",
        title: "Took the stress out of it",
        body: "I wasn't sure which documents Malaysia needed. VIZA gave me a clear list, reviewed my uploads, and the e-Visa came through faster than expected.",
      },
    ],
  },

  faqSub:
    "Can't find an answer? Ask the AI assistant at the bottom of this page or message your VIZA consultant.",
  faq: [
    {
      category: "General information",
      q: "What is the Malaysia Tourist e-Visa?",
      a: "The Malaysia Tourist e-Visa is an electronic visa issued by the Immigration Department of Malaysia (Jabatan Imigresen Malaysia). It allows eligible passport holders to visit Malaysia for tourism or family purposes for up to 30 days on a single entry.",
    },
    {
      category: "General information",
      q: "Is the e-Visa accepted at all entry points?",
      a: "Yes — the Malaysia eVISA is accepted at all international airports, major land border crossings, and seaports. Confirm your intended port of entry when you apply so it is recorded correctly.",
    },
    {
      category: "Application process",
      q: "How long does Malaysian Immigration take to process an e-Visa?",
      a: "Processing typically takes 1–3 business days once all documents are submitted correctly. VIZA monitors the application and backs the timeline with an on-time guarantee — your processing fee is refunded if we miss the target.",
    },
    {
      category: "Application process",
      q: "Can I apply for my whole family together?",
      a: "Yes. Each traveller requires their own e-Visa, but you can include all members of your group in a single VIZA application. Your consultant submits them together to align approval timelines.",
    },
    {
      category: "Refunds, rejections & reapplications",
      q: "What happens if my Malaysia e-Visa is refused?",
      a: "The Malaysian Immigration Department retains the government fee on refusal. VIZA's processing fee is fully refunded. Your consultant will review the refusal notice and advise on what to correct before reapplying.",
    },
  ],

  sources: [
    { label: "MyVISA — Official Malaysia eVisa Portal (Jabatan Imigresen Malaysia)", url: "https://malaysiavisa.imi.gov.my/evisa/", display: "malaysiavisa.imi.gov.my" },
    { label: "Immigration Department of Malaysia", url: "https://www.imi.gov.my", display: "imi.gov.my" },
  ],

  price: {
    etaLabel: "Apply now, get it by",
    etaValue: "17 Aug 2026, 10:00 AM",
    title: "Tourist e-Visa · 30-day stay",
    saving: "1 day faster than filing direct",
    sub: "All-inclusive of government fee, document review, and on-time guarantee.",
    foot: "Government fee and VIZA processing are collected together at checkout, backed by our on-time guarantee.",
  },

  aiPlaceholder: "Ask anything about Malaysia e-Visas — eligibility, documents, processing time…",
};

export default malaysia;
