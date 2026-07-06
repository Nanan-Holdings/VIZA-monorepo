import type { VisaContent } from "./types";

/**
 * Thailand eVisa (Tourist Visa TR) content.
 * Last fact-checked: 2026-07-05 against thaievisa.go.th,
 * singapore.thaiembassy.org, tdac.immigration.go.th, tatnews.org,
 * bangkok.immigration.go.th, and washingtondc.thaiembassy.org.
 *
 * Facts baked in: fully online eVisa since 1 Jan 2025; SGD 50 single-entry TR
 * / SGD 250 METV when lodged from Singapore; 3-month validity, 60-day stay;
 * 5–10 working-day processing (embassy advises applying 21 working days ahead
 * and remaining in Singapore during processing); mandatory free TDAC within
 * 72 h before arrival (since 1 May 2025); one-time 30-day extension via TM.7
 * at THB 1,900; overstay THB 500/day capped at THB 20,000. Singapore and PRC
 * passport holders are currently visa-exempt for tourist stays up to 60 days.
 *
 * Items needing ops confirmation:
 *   - 60→30-day exemption rollback (Cabinet approved 19/21 May 2026) is NOT
 *     yet in the Royal Gazette as of 2026-07-05 — re-check weekly against
 *     tatnews.org / MFA and update the exemption copy when it takes effect.
 *   - SGD 50 / SGD 250 government fee is confirmed only for applications
 *     lodged in Singapore; other jurisdictions charge local-currency
 *     equivalents.
 *   - Photo pixel/file-size spec on thaievisa.go.th unverified (JS-rendered);
 *     3.5 × 4.5 cm / white background is from embassy guidance.
 *   - Whether the 90-days-per-180 cumulative cap for PRC nationals is
 *     enforced while the 60-day scheme runs is unconfirmed officially.
 */
export const thailand: VisaContent = {
  slug: "thailand",

  heroTitle: "Thailand eVisa",
  lede: "The official Tourist Visa (TR), issued fully online through thaievisa.go.th — valid 3 months from issue, granting a 60-day stay you can extend once in-country for a further 30 days. Singapore and China passport holders are currently visa-exempt for tourist stays up to 60 days; VIZA covers both routes, including the mandatory TDAC arrival card.",
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
    { icon: "currency", k: "Currency", v: "Thai Baht (THB)", sub: "SGD 1 ≈ THB 25" },
    { icon: "pin", k: "Top destinations", v: "Bangkok · Phuket · Chiang Mai", sub: "Plus Koh Samui, Krabi, Chiang Rai" },
  ],

  processTitle: "How the Thailand eVisa process works",
  processSub:
    "Thailand's visa system has been fully online since 1 January 2025 — no embassy visit, no passport hand-in. We file on thaievisa.go.th, track every consular update, and prepare your TDAC arrival card before you fly.",
  steps: [
    {
      title: "Apply on VIZA",
      body: "Upload your passport, photo, bank statements, and confirmed bookings. Start at least 21 working days before travel — the Royal Thai Embassy's own guidance — and stay in Singapore while the application is under review.",
    },
    {
      title: "Your documents are verified",
      body: "Your VIZA consultant checks funds thresholds (SGD 800 for single-entry), photo spec, and residence proof, then submits directly to the official eVisa portal handled by the Royal Thai Embassy in Singapore.",
    },
    {
      title: "Your eVisa gets processed",
      body: "Consular processing typically takes 5 – 10 working days after payment. We monitor each update and flag any request for extra documents before it delays your trip.",
      statusRows: [
        { label: "Application submitted to eVisa portal", ts: "8 Jul, 8:30 AM", onTime: true },
        { label: "Documents forwarded to consular officer", ts: "8 Jul, 11:00 AM", onTime: true },
        { label: "Awaiting consular approval", ts: "In progress" },
      ],
    },
    {
      title: "Get your eVisa on 17 Jul, 3:00 PM",
      body: "The approved eVisa PDF arrives in your inbox and your VIZA app. We then file your free Thailand Digital Arrival Card (TDAC) within 72 hours of departure — mandatory for every traveller.",
      delivered: true,
    },
  ],

  docsTitle: "Required documents",
  docsSub:
    "The Royal Thai Embassy Singapore's official checklist. Your VIZA consultant double-checks each document before submission — re-uploads are unlimited and free.",
  documents: [
    { name: "Passport bio page", sub: "Valid 6+ months from application date · blank pages · clear colour scan" },
    { name: "Recent photograph", sub: "White background · 3.5 × 4.5 cm passport style · taken within 6 months" },
    { name: "Round-trip travel booking", sub: "Confirmed flights (or cruise itinerary) in and out of Thailand" },
    { name: "Proof of accommodation", sub: "Hotel bookings covering the full stay, or a host invitation letter" },
    { name: "Bank statements", sub: "Last 3 months · at least SGD 800 per person (METV: 6 months · SGD 8,000 + employment letter)" },
    { name: "Singapore residence proof", sub: "Non-Singaporeans: long-term pass (front and back) valid 2+ more months" },
  ],

  rejectionTitle: "Why Thailand eVisas get rejected",
  rejectionSub:
    "The Royal Thai Embassy reserves the right to request extra documents, call an interview, or refuse without stating reasons. VIZA screens for every known trigger before submission.",
  rejectionReasons: [
    {
      title: "Insufficient or unclear proof of funds",
      body: "Bank statements below the SGD 800 (single-entry) or SGD 8,000 (METV) threshold, or statements that are incomplete or don't show the applicant's name.",
    },
    {
      title: "Applying outside your country of residence",
      body: "The eVisa must be lodged from where you legally reside — the Singapore embassy requires a long-term pass valid 2+ months and for you to remain in Singapore during processing.",
    },
    {
      title: "Incomplete or illegible documents",
      body: "Blurry passport scans, missing flight or hotel bookings, or documents in languages other than Thai or English that haven't been translated and notarised.",
    },
    {
      title: "Non-compliant photo",
      body: "A photo older than 6 months, on the wrong background, or otherwise failing passport-photo standards.",
    },
    {
      title: "Immigration history issues",
      body: "Previous Thai overstays, blacklisting, or prior refusals weigh against the application.",
    },
    {
      title: "Suspected non-tourist intent",
      body: "Signs of intended work or long-term stay on a tourist visa — frequent back-to-back tourist entries are also screened at the border.",
    },
  ],

  entryTitle: "Entry & exit regulations",
  entrySub:
    "Every traveller — visa holder or visa-exempt — must submit the free Thailand Digital Arrival Card (TDAC) online within 72 hours before arrival. Carry your eVisa PDF, return ticket, and proof of funds: immigration officers can spot-check THB 20,000 per person (≈ SGD 785) in cash or equivalent.",
  entryExit: [
    { icon: "refresh", k: "Entry", v: "Single", sub: "Re-entry requires a new visa — or the METV for multiple trips" },
    { icon: "clock", k: "Activate within", v: "3 months", sub: "From the visa issue date — enter before this window closes" },
    { icon: "plane", k: "TDAC arrival card", v: "Within 72 hrs", sub: "Free, at tdac.immigration.go.th · mandatory since 1 May 2025" },
    { icon: "currency", k: "Funds spot-check", v: "THB 20,000 / person", sub: "≈ SGD 785 · THB 40,000 per family, checked at officers' discretion" },
  ],

  extensionTitle: "Visa extension & overstays",
  extensionSub:
    "Tourist visa holders and visa-exempt entrants can extend once for 30 days at any Thai Immigration office (form TM.7) — usually issued the same day. Apply before your current permission to stay expires; overstaying is fined daily and long overstays trigger re-entry bans of 1 – 10 years.",
  extension: [
    { icon: "extend", k: "Extension", v: "+30 days", sub: "One-time · form TM.7 · THB 1,900 (≈ SGD 75) · usually same day" },
    { icon: "alert", k: "Overstay fine", v: "THB 500 / day", sub: "≈ SGD 20 per day · capped at THB 20,000 (≈ SGD 785)" },
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
      a: "The Tourist Visa (TR) is the official single-entry visa issued by Royal Thai Embassies through the thaievisa.go.th portal — fully online since 1 January 2025. It is valid 3 months from issue and allows a 60-day stay (from arrival) for tourism, leisure, visiting family, or medical treatment. A multiple-entry variant, the METV, is valid 6 months with 60 days per entry.",
    },
    {
      category: "General information",
      q: "Do Singapore or China passport holders need this visa?",
      a: "Not for short tourist trips — both are currently visa-exempt for stays up to 60 days per entry (extendable once by 30 days in-country). A Cabinet-approved change would reduce this to 30 days but is not yet in force. Even visa-exempt travellers must file the free TDAC arrival card within 72 hours before arrival — VIZA handles it end-to-end, and files the TR eVisa when you need the full 60 days plus extension headroom.",
    },
    {
      category: "General information",
      q: "What is the Thailand Digital Arrival Card (TDAC)?",
      a: "Since 1 May 2025, every foreign national entering Thailand by air, land, or sea must submit the free TDAC at tdac.immigration.go.th within 72 hours before arrival — it replaced the paper TM.6 card. Only pure transit passengers and Border Pass holders are exempt. VIZA files it for you as part of every Thailand order.",
    },
    {
      category: "General information",
      q: "Can I work or study on a Tourist eVisa?",
      a: "No. The Tourist Visa (TR) does not permit employment, paid activities, or formal study. Separate Non-Immigrant visa categories exist for work, education, and retirement.",
    },
    {
      category: "Application process",
      q: "How much does the Thailand eVisa cost?",
      a: "The government fee for applications lodged from Singapore is SGD 50 for the single-entry TR and SGD 250 for the multiple-entry METV — non-refundable once paid. VIZA's service fee is shown upfront at checkout, and the free TDAC filing is included.",
    },
    {
      category: "Application process",
      q: "How long does the Thailand eVisa take?",
      a: "Consular processing typically takes 5 – 10 working days after payment. The Royal Thai Embassy Singapore advises applying at least 21 working days before travel and remaining in Singapore until the eVisa is approved — so start early. We back our timeline with an on-time guarantee.",
    },
    {
      category: "Application process",
      q: "Can I apply for my whole family in one application?",
      a: "Yes. Add each traveller in your VIZA application — your consultant submits them as a group so they're processed on the same timeline. Note the funds requirement is per person: SGD 800 each for the single-entry TR.",
    },
    {
      category: "Refunds, rejections & reapplications",
      q: "What happens if my Thailand eVisa is refused?",
      a: "The Thai government retains its fee — official policy is that visa fees are non-refundable. VIZA's service fee is fully refunded. Your consultant will review the refusal, fix the weak point (usually funds evidence or document quality), and advise on reapplication.",
    },
  ],

  sources: [
    {
      label: "Thailand E-Visa Official Portal (MFA)",
      url: "https://www.thaievisa.go.th/",
      display: "thaievisa.go.th",
    },
    {
      label: "Royal Thai Embassy Singapore — Tourist Visa (TR)",
      url: "https://singapore.thaiembassy.org/en/page/tourist-visa",
      display: "singapore.thaiembassy.org",
    },
    {
      label: "Thailand Digital Arrival Card (TDAC) — official, free",
      url: "https://tdac.immigration.go.th/",
      display: "tdac.immigration.go.th",
    },
    {
      label: "Immigration Division 1 Bangkok — visa extension (TM.7)",
      url: "https://bangkok.immigration.go.th/en/visa-extension/",
      display: "bangkok.immigration.go.th",
    },
    {
      label: "Royal Thai Embassy Washington DC — overstay regulations",
      url: "https://washingtondc.thaiembassy.org/en/page/advice-on-thailand-visa-overstay-regulations",
      display: "washingtondc.thaiembassy.org",
    },
    {
      label: "TAT Newsroom — visa-exemption scheme revision (May 2026)",
      url: "https://www.tatnews.org/2026/05/thai-cabinet-approves-revision-of-60-day-visa-exemption-scheme-pending-royal-gazette-publication/",
      display: "tatnews.org",
    },
  ],

  price: {
    etaLabel: "Apply now, get it by",
    etaValue: "17 Jul 2026, 03:00 PM",
    title: "eVisa (TR) · 60-day stay",
    saving: "Faster than applying direct",
    sub: "All-inclusive of the SGD 50 government fee, document review, TDAC filing, and on-time guarantee.",
    foot: "Government fee and VIZA processing are collected together at checkout, backed by our on-time guarantee.",
  },

  aiPlaceholder: "Ask anything about Thailand visas — exemptions, TDAC, extensions, documents…",
};

export default thailand;
