import type { VisaContent } from "./types";

/**
 * Japan Short-Term Stay (Temporary Visitor) visa for tourism — single-entry,
 * also issuable online as the JAPAN eVISA (evisa.mofa.go.jp). Singapore
 * passport holders are visa-exempt (90 days on arrival); the paid visa route
 * applies to visa-required foreign residents of Singapore (e.g. PRC nationals)
 * via eVISA or VFS Global Singapore under the Embassy of Japan.
 *
 * Last fact-checked: 2026-07-05 against mofa.go.jp, evisa.mofa.go.jp,
 * sg.emb-japan.go.jp, visa.vfsglobal.com and services.digital.go.jp.
 *
 * Items needing ops confirmation:
 *   - Post-1-Jul-2026 fee table (single JPY 15,000 / multiple JPY 30,000) was
 *     verified via consulate pages + industry advisories, not read directly on
 *     MOFA (geo-blocked). Confirm the exact new SGD amounts VFS Singapore
 *     charges — its one-pager still showed the old S$26/S$53 on 5 Jul 2026.
 *   - No official confirmation yet that the JPY 15,000 rate applies
 *     identically to eVISA card payments (expected — same visa).
 *   - Nationality-specific reciprocal fee reductions after the revision
 *     unconfirmed for PRC nationals.
 *   - Embassy-of-Japan-in-Singapore "Sightseeing" checklist for Chinese
 *     nationals not read directly; document list below is the standard
 *     MOFA/VFS set — check against the live checklist PDF.
 *   - SGD conversions use ≈ JPY 100 = SGD 0.87 (mid-2026); refresh before
 *     publishing.
 */
export const japan: VisaContent = {
  slug: "japan",

  heroTitle: "Japan Tourist Visa",
  lede: "Japan's single-entry Temporary Visitor visa grants up to 90 days for tourism, with a 3-month window to enter after issue. Available online as the JAPAN eVISA — prepared, filed, and tracked end-to-end by your VIZA consultant. Singapore passport holders skip it entirely: 90 days visa-free.",
  heroImage: "/assets/heroes/japan.jpg",
  meta: [
    { k: "Type", v: "Temporary Visitor" },
    { k: "Length of stay", v: "Up to 90 days" },
    { k: "Validity", v: "3 months to enter" },
    { k: "Entry", v: "Single" },
  ],
  tags: [
    { icon: "bolt", label: "Fast track" },
    { icon: "shield", label: "On-time guarantee" },
    { icon: "doc", label: "Expert document review" },
  ],

  overviewTitle: "Japan, at a glance",
  overviewSub:
    "The Temporary Visitor visa covers tourism, family visits, and short business trips. Singapore citizens enter visa-free for 90 days; visa-required nationals residing in Singapore apply via the JAPAN eVISA or VFS Global.",
  glance: [
    { icon: "globe", k: "Capital", v: "Tokyo", sub: "UTC +9 (JST)" },
    { icon: "clock", k: "Best time to visit", v: "Mar – May · Oct – Nov", sub: "Cherry blossom & autumn foliage" },
    { icon: "currency", k: "Currency", v: "Japanese Yen (JPY)", sub: "SGD 1 ≈ JPY 115" },
    { icon: "pin", k: "Top destinations", v: "Tokyo · Kyoto · Osaka", sub: "Plus Hiroshima, Nara, Hokkaido" },
  ],

  processTitle: "How the Japan visa process works",
  processSub:
    "Submit your documents once. Your VIZA consultant prepares the full MOFA package, files it through the JAPAN eVISA portal or VFS Global Singapore, and tracks every stage. Allow a minimum of 10 business days — Japan accepts no expedite requests.",
  steps: [
    {
      title: "Apply on VIZA",
      body: "Upload your passport, photo, Singapore residence pass, flight booking, and bank statement. Apply within 3 months of your travel date — we set the timeline from your departure.",
    },
    {
      title: "Documents verified & submitted",
      body: "Your consultant builds the MOFA application form and day-by-day Schedule of Stay (Taizai Yoteihyo), cross-checks every field against the Embassy of Japan in Singapore checklist, then files via the eVISA portal or VFS Global.",
    },
    {
      title: "Visa processed by the embassy",
      body: "MOFA's standard is 5 working days from a complete application, but the Embassy in Singapore advises allowing at least 10 business days. We track each consular stage and flag any document requests immediately.",
      statusRows: [
        { label: "Application lodged with the Embassy of Japan", ts: "12 Jun, 9:00 AM", onTime: true },
        { label: "Documents accepted — under consular review", ts: "12 Jun, 11:30 AM", onTime: true },
        { label: "Awaiting consular decision", ts: "In progress" },
      ],
    },
    {
      title: "Get your visa on 17 Jun, 2:00 PM",
      body: "eVISA applicants receive a Visa Issuance Notice by email — show it on your phone screen at check-in (printouts aren't accepted). Paper applicants get their passport back with the visa sticker via VFS.",
      delivered: true,
    },
  ],

  docsTitle: "Required documents",
  docsSub:
    "Your VIZA consultant reviews every document before submission. Re-uploads are unlimited and free.",
  documents: [
    { name: "Passport bio page", sub: "Valid for your whole stay · 2 blank pages · no 6-month rule" },
    { name: "Visa application form", sub: "Official MOFA form — completed and prepared by your consultant" },
    { name: "Recent photograph", sub: "45 × 35 mm · white background · last 6 months · no glasses" },
    { name: "Proof of Singapore residence", sub: "PR, Work Pass, Student Pass, Dependant's Pass, or LTVP" },
    { name: "Flight itinerary", sub: "Confirmed or reserved round-trip booking" },
    { name: "Schedule of stay (Taizai Yoteihyo)", sub: "Day-by-day plan with hotel names & contacts, MOFA format" },
    { name: "Proof of funds", sub: "Recent bank statement covering the full trip" },
  ],

  rejectionTitle: "Why Japan visa applications get rejected",
  rejectionSub:
    "MOFA never discloses the specific ground for refusal — and a refused applicant is barred from reapplying for the same purpose for 6 months. VIZA flags these blockers before you submit.",
  rejectionReasons: [
    { title: "Insufficient proof of funds", body: "Bank statements that don't credibly cover the trip, or unexplained large deposits shortly before applying." },
    { title: "Incomplete or inconsistent documents", body: "A missing Schedule of Stay, or dates that don't match between your itinerary, bookings, and application form — the leading cause of refusal." },
    { title: "Doubt over purpose of visit", body: "Weak ties to your country of residence or a suspected intention to work or overstay in Japan." },
    { title: "Prior immigration violations", body: "A previous overstay or deportation from Japan, a criminal record, or other landing-denial grounds under Article 5 of the Immigration Control Act." },
    { title: "Applying at the wrong mission", body: "Foreign nationals without a valid Singapore PR or long-term pass cannot apply through the Embassy of Japan in Singapore or VFS Singapore." },
  ],

  entryTitle: "Entry & exit regulations",
  entrySub:
    "All visitors give fingerprints and a facial photo at immigration. Pre-register on Visit Japan Web (vjw.digital.go.jp) for QR-code immigration and customs — optional but strongly recommended, with single-QR joint kiosks now at Haneda, Narita, and Kansai. Carry proof of onward travel and funds.",
  entryExit: [
    { icon: "refresh", k: "Entry", v: "Single", sub: "Multiple-entry only for qualifying applicants" },
    { icon: "clock", k: "Enter within", v: "3 months", sub: "From the visa issue date" },
    { icon: "doc", k: "Visit Japan Web", v: "Optional QR", sub: "Pre-registers immigration + customs" },
    { icon: "currency", k: "Departure tax", v: "JPY 3,000", sub: "≈ SGD 26 · collected in your ticket" },
  ],

  extensionTitle: "Visa extension & overstays",
  extensionSub:
    "Temporary Visitor stays are extended only in exceptional, unavoidable circumstances such as illness — routine tourist extensions are refused. Overstaying is a criminal offence in Japan, not a fine-per-day matter.",
  extension: [
    { icon: "extend", k: "Extension", v: "Exceptional only", sub: "JPY 6,000 in person / JPY 5,500 online, if approved" },
    { icon: "alert", k: "Overstay penalty", v: "Up to JPY 3,000,000", sub: "≈ SGD 26,000 fine or up to 3 years' imprisonment" },
    { icon: "ban", k: "Re-entry ban", v: "1 – 10 years", sub: "1 yr if you self-report · 5 yrs deported · 10 yrs repeat" },
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
      q: "What is the Japan Temporary Visitor visa?",
      a: "It's Japan's short-term stay visa for tourism, family visits, and short business trips — single-entry, granted for 15, 30, or 90 days, and valid 3 months from issue to enter Japan. Eligible applicants can obtain it fully online as the JAPAN eVISA at evisa.mofa.go.jp; VIZA handles either route end-to-end.",
    },
    {
      category: "General information",
      q: "Do Singapore passport holders need a visa for Japan?",
      a: "No. Singapore citizens enter visa-free as Temporary Visitors for up to 90 days — no fee, no pre-registration. From FY2028 Singaporeans will need JESTA electronic travel authorization before boarding; until then, just a valid passport (Visit Japan Web QR optional).",
    },
    {
      category: "General information",
      q: "I hold a Chinese passport and live in Singapore — how do I apply?",
      a: "PRC ordinary-passport holders always need a visa. As a Singapore PR or long-term pass holder (EP, SP, Student, DP, LTVP), you apply via the JAPAN eVISA or on paper through VFS Global Singapore — VIZA manages the whole file. If you reside in mainland China instead, applications go through Japan-accredited travel agencies.",
    },
    {
      category: "Application process",
      q: "How much does the Japan visa cost?",
      a: "For applications lodged from 1 July 2026, the government fee is JPY 15,000 (≈ SGD 130) single-entry or JPY 30,000 (≈ SGD 260) multiple-entry — Japan's first fee revision since 1978. VFS Global Singapore adds a SGD 22 service fee for paper filings. The government fee is payable only if the visa is issued.",
    },
    {
      category: "Application process",
      q: "How long does a Japan visa take to process?",
      a: "MOFA's official standard is 5 working days from the day after a complete application is received, but the Embassy of Japan in Singapore advises allowing a minimum of 10 business days — and Japan accepts no expedite requests. Apply within 3 months of your travel date; VIZA files a complete package to avoid the back-and-forth that stretches complex cases past a month.",
    },
    {
      category: "Refunds, rejections & reapplications",
      q: "What happens if my application is refused?",
      a: "MOFA does not disclose refusal reasons, and a new application for the same purpose isn't accepted for 6 months from the refusal date. VIZA refunds its processing fee in full, analyses your file for the likely weak points, and prepares a stronger reapplication the moment the 6-month bar lifts.",
    },
  ],

  sources: [
    { label: "JAPAN eVISA portal (MOFA)", url: "https://www.evisa.mofa.go.jp/", display: "evisa.mofa.go.jp" },
    { label: "MOFA — JAPAN eVISA system", url: "https://www.mofa.go.jp/j_info/visit/visa/visaonline.html", display: "mofa.go.jp" },
    { label: "MOFA — Exemption of Visa (Short-Term Stay)", url: "https://www.mofa.go.jp/j_info/visit/visa/short/novisa.html", display: "mofa.go.jp" },
    { label: "MOFA — Visa fees", url: "https://www.mofa.go.jp/j_info/visit/visa/procedure/pagewe_000001_00391.html", display: "mofa.go.jp" },
    { label: "Embassy of Japan in Singapore — Visa to Japan", url: "https://www.sg.emb-japan.go.jp/itpr_en/visit.html", display: "sg.emb-japan.go.jp" },
    { label: "VFS Global — Japan visas, Singapore", url: "https://visa.vfsglobal.com/sgp/en/jpn/", display: "visa.vfsglobal.com" },
    { label: "Visit Japan Web (Digital Agency)", url: "https://services.digital.go.jp/en/visit-japan-web/", display: "services.digital.go.jp" },
  ],

  price: {
    etaLabel: "Apply now, get it by",
    etaValue: "17 Jun 2026, 02:00 PM",
    title: "Temporary Visitor visa · up to 90 days",
    saving: "Faster than going direct",
    sub: "All-inclusive of document review, preparation, and on-time guarantee.",
    foot: "Government fee and VIZA processing are collected together at checkout, backed by our on-time guarantee.",
  },

  aiPlaceholder: "Ask anything about Japan visas — eVISA eligibility, fees, Singapore exemption…",
};

export default japan;
