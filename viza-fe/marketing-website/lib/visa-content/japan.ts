import type { VisaContent } from "./types";

/**
 * Japan short-stay tourist visa (also available as Japan eVISA for eligible
 * nationalities via the MOFA eVISA portal).
 *
 * Content is nationality-neutral. Ops/legal must verify fee-free status,
 * document requirements, and supported nationalities before publishing.
 *
 * Last fact-checked: 2026-06-10 against mofa.go.jp and moj.go.jp.
 * Items needing ops confirmation:
 *   - Photo dimensions: 45×45 mm is the widely-cited standard; some posts
 *     accept 35×45 mm. Verify with the specific consulate before publishing.
 *   - Overstay re-entry ban: 1 year (voluntary departure order) / 5 years
 *     (first deportation) / 10 years (repeat deportation) per Immigration
 *     Control and Refugee Recognition Act. Wording uses accurate range.
 *
 * Official sources:
 *   https://www.mofa.go.jp/j_info/visit/visa/
 *   https://www.evisa.mofa.go.jp
 *   https://www.moj.go.jp (Immigration Services Agency — deportation rules)
 */
export const japan: VisaContent = {
  slug: "japan",

  heroTitle: "Japan Tourist Visa",
  lede: "A single-entry short-stay visa granting up to 90 days in Japan, now available as a Japan eVISA for eligible travellers — end-to-end managed by your VIZA consultant.",
  heroImage: "/assets/heroes/japan.jpg",
  meta: [
    { k: "Type", v: "Tourist" },
    { k: "Length of stay", v: "Up to 90 days" },
    { k: "Validity", v: "90 days" },
    { k: "Entry", v: "Single" },
  ],
  tags: [
    { icon: "bolt", label: "Fast track" },
    { icon: "shield", label: "On-time guarantee" },
    { icon: "doc", label: "Expert document review" },
  ],

  overviewTitle: "Japan, at a glance",
  overviewSub:
    "Japan's short-stay visa covers tourism, family visits, cultural exchange, and short business trips — one of the world's most visited destinations.",
  glance: [
    { icon: "globe", k: "Capital", v: "Tokyo", sub: "UTC +9 (JST)" },
    { icon: "clock", k: "Best time to visit", v: "Mar – May · Oct – Nov", sub: "Cherry blossom & autumn foliage" },
    { icon: "currency", k: "Currency", v: "Japanese Yen (JPY)", sub: "Widely cash-preferred" },
    { icon: "pin", k: "Top destinations", v: "Tokyo · Kyoto · Osaka", sub: "Plus Hiroshima, Nara, Hokkaido" },
  ],

  processTitle: "How the Japan visa process works",
  processSub:
    "Submit your documents once. Your VIZA consultant handles preparation, submission, and real-time tracking at every embassy step.",
  steps: [
    {
      title: "Apply on VIZA",
      body: "Upload your passport, photo, travel itinerary, and supporting documents. Tell us your departure date and we'll set the timeline.",
    },
    {
      title: "Documents verified & submitted",
      body: "Your VIZA consultant cross-checks every field against the Japanese embassy checklist, then submits the complete package on your behalf.",
    },
    {
      title: "Visa processed at the embassy",
      body: "We track your application through each consular stage and flag any requests for additional documents immediately.",
      statusRows: [
        { label: "Application lodged at Japanese consulate", ts: "12 Jun, 9:00 AM", onTime: true },
        { label: "Documents accepted — under review", ts: "12 Jun, 11:30 AM", onTime: true },
        { label: "Awaiting consular decision", ts: "In progress" },
      ],
    },
    {
      title: "Get your visa on 17 Jun, 2:00 PM",
      body: "Your passport with the visa sticker (or eVISA PDF for eligible nationalities) is returned via courier or collected in person — your consultant guides you.",
      delivered: true,
    },
  ],

  docsTitle: "Required documents",
  docsSub:
    "Your VIZA consultant reviews every document before submission. Re-uploads are unlimited and free.",
  documents: [
    { name: "Passport bio page", sub: "Valid 6+ months beyond intended stay · clean, unobstructed scan" },
    { name: "Recent photograph", sub: "45 × 45 mm · plain white background · last 6 months" },
    { name: "Travel itinerary", sub: "Confirmed or provisional flight bookings" },
    { name: "Accommodation proof", sub: "Hotel booking or invitation letter" },
  ],

  rejectionTitle: "Why Japan visa applications get rejected",
  rejectionSub:
    "The Japanese consulate reviews every application carefully. VIZA flags these common blockers before you submit.",
  rejectionReasons: [
    { title: "Insufficient ties to home country", body: "Applications that don't demonstrate employment, family, or property ties — suggesting an intent to overstay — are commonly refused." },
    { title: "Incomplete or inconsistent documents", body: "Missing itinerary details, mismatched names, or unclear financial proof are leading causes of outright rejection." },
    { title: "Prior immigration violations", body: "A previous overstay, visa breach, or deportation record from Japan or any country can result in refusal." },
  ],

  entryTitle: "Entry & exit regulations",
  entrySub:
    "Carry your visa and passport at all times. Japan's immigration counters cross-check biometrics on arrival — ensure all details match your application exactly.",
  entryExit: [
    { icon: "refresh", k: "Entry", v: "Single", sub: "Re-entry requires a new visa" },
    { icon: "clock", k: "Use within", v: "90 days", sub: "From the visa issue date" },
  ],

  extensionTitle: "Visa extension & overstays",
  extensionSub:
    "Short-stay tourist visas generally cannot be extended inside Japan. Overstays carry severe penalties: deportation and a re-entry ban of 1–5 years (up to 10 years for repeat violations), depending on the circumstances.",
  extension: [
    { icon: "extend", k: "Extension", v: "Not available", sub: "Tourist stays cannot be extended" },
    { icon: "alert", k: "Overstay penalty", v: "Deportation + ban", sub: "1–5 year re-entry ban (up to 10 years for repeat violations)" },
  ],

  reviews: {
    score: "4.6",
    outOf: "/ 5",
    sub: "Trusted by travellers worldwide · 14,203 reviews",
    platforms: [
      { rating: "4.7", name: "Trustpilot" },
      { rating: "4.6", name: "App Store" },
    ],
    items: [
      {
        initials: "MH",
        name: "Maya Hassan",
        source: "Trustpilot · 5 days ago",
        title: "Japan visa on first attempt",
        body: "The checklist was crystal-clear and my consultant caught a photo that didn't meet the 45mm spec. Approved in 4 working days.",
      },
      {
        initials: "RT",
        name: "Ricardo Torres",
        source: "App Store · 2 weeks ago",
        title: "Stress-free itinerary prep",
        body: "I had no idea I needed a day-by-day itinerary. VIZA provided a template and reviewed mine before submission. Smooth process.",
      },
    ],
  },

  faqSub:
    "Can't find your answer? Ask the AI assistant below or message your VIZA consultant directly.",
  faq: [
    {
      category: "General information",
      q: "What is the Japan short-stay tourist visa?",
      a: "It is a single-entry visa issued by Japanese embassies and consulates worldwide, permitting stays of up to 90 days for tourism, family visits, or short business trips. Eligible nationalities can apply online via the Japan eVISA system at evisa.mofa.go.jp.",
    },
    {
      category: "General information",
      q: "Can I use the tourist visa for business meetings?",
      a: "Yes — attending conferences, exploratory meetings, or trade shows is permitted under the short-stay category. You may not receive salary or payment from a Japanese entity during your stay.",
    },
    {
      category: "Application process",
      q: "How long does a Japan visa take to process?",
      a: "Consular processing typically takes 5 – 7 working days once a complete application is lodged. VIZA submits a fully prepared file to minimise back-and-forth requests and keep you on schedule.",
    },
    {
      category: "Application process",
      q: "Can my family apply together?",
      a: "Yes. Each family member requires their own visa, but your VIZA consultant submits them as a linked group so approvals arrive on the same timeline.",
    },
    {
      category: "Refunds, rejections & reapplications",
      q: "What happens if my application is refused?",
      a: "Japanese embassies do not disclose specific refusal reasons. VIZA will analyse your file, advise on strengthening ties documentation, and guide you through a reapplication once the required wait period has passed.",
    },
  ],

  sources: [
    { label: "Japan Ministry of Foreign Affairs — Visa information", url: "https://www.mofa.go.jp/j_info/visit/visa/", display: "mofa.go.jp" },
    { label: "Japan eVISA official portal (MOFA)", url: "https://www.evisa.mofa.go.jp/message", display: "evisa.mofa.go.jp" },
    { label: "Immigration Services Agency — Entry/Residence procedures", url: "https://www.moj.go.jp/isa/", display: "moj.go.jp" },
  ],

  price: {
    etaLabel: "Apply now, get it by",
    etaValue: "17 Jun 2026, 02:00 PM",
    title: "Japan Tourist Visa · up to 90 days",
    saving: "Faster than going direct",
    sub: "All-inclusive of document review, preparation, and on-time guarantee.",
    foot: "Consular fees and VIZA processing are collected together at checkout, backed by our on-time guarantee.",
  },

  aiPlaceholder: "Ask anything about Japan visas — requirements, processing times, eVISA eligibility…",
};

export default japan;
