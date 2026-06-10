import type { VisaContent } from "./types";

/**
 * Vietnam e-Visa.
 *
 * Visa specifics (fees, validity, permitted activities, document requirements,
 * and rejection criteria) should be verified by ops/legal against the Vietnam
 * Immigration Department's official guidance before publishing changes.
 *
 * Fact-checked 2026-06-10 against:
 *   - evisa.gov.vn (canonical portal since Nov 2024)
 *   - evisa.immigration.gov.vn (official FAQ)
 * Key findings:
 *   - 90-day validity, up to 90-day stay, single or multiple entry — confirmed correct.
 *   - Canonical portal is now evisa.gov.vn (migrated 11 Nov 2024 from evisa.xuatnhapcanh.gov.vn).
 *   - In-country e-Visa extension is NOT possible via the portal; a new visa must be
 *     applied for through a Vietnamese sponsor/guarantor (Law on Entry, Exit, Transit
 *     and Residence of Foreigners, Article 16 §1). Extension sub-text corrected.
 */
export const vietnam: VisaContent = {
  slug: "vietnam",

  heroTitle: "Vietnam e-Visa",
  lede: "The Vietnam e-Visa is a government-issued electronic visa valid for up to 90 days. Available as single or multiple entry, it covers tourism, business, and family visits across all international entry points.",
  heroImage: "/assets/heroes/vietnam.jpg",
  meta: [
    { k: "Type", v: "e-Visa" },
    { k: "Length of stay", v: "Up to 90 days" },
    { k: "Validity", v: "90 days" },
    { k: "Entry", v: "Single or Multiple" },
  ],
  tags: [
    { icon: "bolt", label: "Fast track · in 72 hrs" },
    { icon: "shield", label: "On-time guarantee" },
    { icon: "doc", label: "Minimal documents" },
  ],

  overviewTitle: "Vietnam, at a glance",
  overviewSub:
    "The Vietnam e-Visa is accepted at all international airports, land border crossings, and seaports. It covers tourism, business, and family visits for stays of up to 90 days per entry.",
  glance: [
    { icon: "globe", k: "Capital", v: "Hanoi", sub: "UTC +7 (Indochina Time)" },
    { icon: "clock", k: "Best time to visit", v: "Nov – Apr", sub: "Dry season in most regions" },
    { icon: "currency", k: "Currency", v: "Vietnamese Dong (VND)", sub: "Check live rates before travelling" },
    { icon: "pin", k: "Top destinations", v: "Hanoi · Ho Chi Minh City · Hoi An", sub: "Plus Ha Long Bay, Da Nang, and Sapa" },
  ],

  processTitle: "How the Vietnam e-Visa process works",
  processSub:
    "Submit once. We handle every step with the Vietnam Immigration Department and notify you the moment your e-Visa is ready.",
  steps: [
    {
      title: "Apply on VIZA",
      body: "Upload your passport bio page, a recent portrait photo, and your intended entry and exit details. Select single or multiple entry based on your itinerary.",
    },
    {
      title: "Your documents are verified",
      body: "Your VIZA consultant checks every field for accuracy, confirms your photo meets the official specification, and submits the application to the Vietnam Immigration Department.",
    },
    {
      title: "Your e-Visa gets processed",
      body: "We monitor the portal queue and flag any requests for further information before they delay your approval.",
      statusRows: [
        { label: "Application submitted to Vietnam Immigration", ts: "3 Jul, 10:15 AM", onTime: true },
        { label: "Application under review", ts: "4 Jul, 9:00 AM", onTime: true },
        { label: "Awaiting final approval", ts: "In progress" },
      ],
    },
    {
      title: "Get your e-Visa on 6 Jul, 11:00 AM",
      body: "Your e-Visa PDF is sent to your inbox and the VIZA app. Print it or save it to your phone — present it at immigration alongside your passport.",
      delivered: true,
    },
  ],

  docsTitle: "Required documents",
  docsSub:
    "Your VIZA consultant double-checks each document before submission. Re-uploads are unlimited and free.",
  documents: [
    { name: "Passport bio page", sub: "Valid for 6+ months beyond intended exit date · clear scan" },
    { name: "Recent portrait photograph", sub: "Plain light background · full face · last 6 months" },
    { name: "Intended entry & exit dates", sub: "Must fall within the 90-day validity window" },
    { name: "Entry point details", sub: "Airport, land crossing, or seaport you plan to use" },
  ],

  rejectionTitle: "Why Vietnam e-Visa applications get rejected",
  rejectionSub:
    "The Vietnam Immigration Department may refuse for any of the following. VIZA flags these before you submit.",
  rejectionReasons: [
    { title: "Passport validity too short", body: "The passport must remain valid for at least 6 months beyond your intended exit date from Vietnam." },
    { title: "Photo does not meet specifications", body: "Blurry images, photos with glasses, or non-plain backgrounds are frequently rejected." },
    { title: "Incorrect or inconsistent travel dates", body: "Requested stay dates that exceed 90 days, or dates that conflict with other information in the application, will result in refusal." },
  ],

  entryTitle: "Entry & exit regulations",
  entrySub:
    "Present your e-Visa PDF alongside your passport at the immigration counter. Single-entry e-Visas cannot be used to re-enter after you have exited Vietnam.",
  entryExit: [
    { icon: "refresh", k: "Entry", v: "Single or Multiple", sub: "Declared at application — choose based on your itinerary" },
    { icon: "clock", k: "Activate within", v: "90 days", sub: "From the issue date on the e-Visa" },
  ],

  extensionTitle: "Visa extension & overstays",
  extensionSub:
    "Vietnam e-Visas cannot be extended directly via the portal. If you need to stay longer, a Vietnamese sponsor must apply for a new visa on your behalf before your current visa expires. Overstaying is a serious offence and can result in fines and a future entry ban.",
  extension: [
    { icon: "extend", k: "Extension", v: "Not directly extendable", sub: "Cannot extend an e-Visa via the portal; a sponsor in Vietnam must apply for a new visa on your behalf before expiry" },
    { icon: "alert", k: "Overstay consequence", v: "Fine + entry ban risk", sub: "Exact penalties set by immigration authorities" },
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
        initials: "JT",
        name: "Jamie T.",
        source: "Trustpilot · 5 days ago",
        title: "e-Visa in my inbox before my flight",
        body: "Applied three days before travelling — the consultant got it through in time. Clear communication throughout and the PDF was exactly what immigration wanted.",
      },
      {
        initials: "AN",
        name: "Aisha N.",
        source: "App Store · 2 weeks ago",
        title: "Photo issue fixed without any hassle",
        body: "I uploaded a photo that didn't meet the spec and the consultant sorted it immediately. No delays, visa approved on schedule.",
      },
    ],
  },

  faqSub:
    "Can't find an answer? Ask the AI assistant at the bottom of this page or message your VIZA consultant.",
  faq: [
    {
      category: "General information",
      q: "What is the Vietnam e-Visa?",
      a: "The Vietnam e-Visa is an official electronic visa issued by the Vietnam Immigration Department. It allows eligible passport holders to enter Vietnam for tourism, business, or family visits for up to 90 days per entry, and is accepted at all international airports, land crossings, and seaports.",
    },
    {
      category: "General information",
      q: "Should I choose single or multiple entry?",
      a: "Choose multiple entry if your itinerary includes side trips to neighbouring countries (e.g. Laos or Cambodia) with a return to Vietnam. Single entry is sufficient if you enter and exit Vietnam only once.",
    },
    {
      category: "Application process",
      q: "How long does processing take?",
      a: "Vietnam Immigration typically processes e-Visa applications within 3 business days. VIZA monitors your application throughout and backs the timeline with an on-time guarantee — your processing fee is refunded if we're late.",
    },
    {
      category: "Application process",
      q: "Can I apply for multiple travellers together?",
      a: "Yes. Each traveller needs their own e-Visa, but you can add all members of your group in a single VIZA application. Your consultant submits them together so approvals arrive on the same timeline.",
    },
    {
      category: "Refunds, rejections & reapplications",
      q: "What happens if my Vietnam e-Visa is refused?",
      a: "Vietnam Immigration retains the government fee on refusal. VIZA's processing fee is fully refunded. Your consultant will review the refusal reason and advise on correcting and resubmitting your application.",
    },
  ],

  sources: [
    { label: "Vietnam National e-Visa Portal (official portal since Nov 2024)", url: "https://evisa.gov.vn", display: "evisa.gov.vn" },
    { label: "Vietnam Immigration Department — National Portal on Immigration", url: "https://immigration.gov.vn", display: "immigration.gov.vn" },
  ],

  price: {
    etaLabel: "Apply now, get it by",
    etaValue: "6 Jul 2026, 11:00 AM",
    title: "e-Visa · up to 90 days",
    saving: "2 days faster than filing direct",
    sub: "All-inclusive of government fee, document review, and on-time guarantee.",
    foot: "Government fee and VIZA processing are collected together at checkout, backed by our on-time guarantee.",
  },

  aiPlaceholder: "Ask anything about Vietnam e-Visas — single vs. multiple entry, processing time, documents…",
};

export default vietnam;
