import type { VisaContent } from "./types";

/**
 * Canada Visitor Visa (TRV) & Electronic Travel Authorization (eTA).
 *
 * Which document applies depends on the passport:
 *   - Singapore passports are visa-exempt: eTA (CAD 7) required only when
 *     FLYING to Canada; land/sea entry from the US needs the passport only.
 *   - PRC (mainland China) passports need a Visitor Visa (TRV, V-1 tourist
 *     stream) for any entry mode: CAD 100 + CAD 85 biometrics, applied online
 *     via the IRCC Portal with biometrics at a VFS Global VAC.
 *
 * Last fact-checked: 2026-07-05 against canada.ca and ircc.canada.ca.
 * Key facts verified:
 *   - Fees: eTA CAD 7 · TRV CAD 100 (family max CAD 500) · biometrics CAD 85
 *     (family max CAD 170) · restoration of status CAD 246.25 — IRCC fee list.
 *   - Validity: eTA 5 years or passport expiry; TRV up to 10 years, capped at
 *     passport/biometrics expiry, at officer discretion (no automatic
 *     max-validity issuance since late 2024).
 *   - Stay: up to 6 months per entry by default, set by the CBSA officer;
 *     6 months from entry if no stamp/date is given. Visa expiry is the last
 *     ARRIVAL date, not a leave-by date.
 *   - Extension: Visitor Record, CAD 100, apply ≥30 days before status ends;
 *     maintained status while pending. No daily overstay fine — restoration
 *     within 90 days (CAD 246.25) or exclusion/deportation order.
 *   - Arrival card: none mandatory — ArriveCAN Advance Declaration optional.
 *   - Since 31 Jan 2025 officers can cancel individual eTAs/TRVs (amended IRPR).
 * Items needing ops confirmation:
 *   - Live TRV processing times: "China ~8–14 weeks / Singapore-lodged a few
 *     weeks" comes from secondary trackers of IRCC monthly data (official tool
 *     returned 403 to the fetcher) — re-check IRCC's processing-times tool
 *     before publish.
 *   - SGD conversions use CAD 1 ≈ SGD 0.94 (indicative mid-2026) — verify.
 *   - Whether PRC applicants currently receive 10-year multiple-entry visas is
 *     officer discretion post-Nov-2024 guidance, not a published rule.
 *   - Exclusion-order ban lengths (1 yr / 5 yr misrepresentation) are
 *     case-by-case CBSA enforcement, not automatic.
 *   - lib/pricing.ts CA_TRV govt fee covers CAD 100 only; the CAD 85
 *     biometric fee is not in the computed price card.
 *
 * Official sources:
 *   https://www.canada.ca/en/immigration-refugees-citizenship/services/visit-canada.html
 *   https://ircc.canada.ca/english/information/fees/fees.asp
 */
export const canada: VisaContent = {
  slug: "canada",

  heroTitle: "Canada Visitor Visa & eTA",
  lede: "Singapore passports need only the CAD 7 eTA — approved in minutes. PRC passports need Canada's Visitor Visa (TRV): up to 10 years, multiple entry, 6-month stays. Either way, VIZA files it end-to-end, biometrics included.",
  heroImage: "/assets/heroes/canada.jpg",
  meta: [
    { k: "Type", v: "Visitor visa / eTA" },
    { k: "Length of stay", v: "Up to 6 months" },
    { k: "Validity", v: "Up to 10 years" },
    { k: "Entry", v: "Multiple" },
  ],
  tags: [
    { icon: "bolt", label: "eTA approved in minutes" },
    { icon: "shield", label: "On-time guarantee" },
    { icon: "doc", label: "Biometrics booked for you" },
  ],

  overviewTitle: "Canada, at a glance",
  overviewSub:
    "Canada admits visitors for up to 6 months per entry. Singapore passport holders fly in on a CAD 7 eTA; PRC passport holders apply for the Visitor Visa (TRV) — CAD 100 plus CAD 85 biometrics, valid up to 10 years.",
  glance: [
    { icon: "globe", k: "Capital", v: "Ottawa", sub: "UTC −5 (EST)" },
    { icon: "clock", k: "Best time to visit", v: "Jun – Aug · Dec – Mar", sub: "Summer warmth or ski season" },
    { icon: "currency", k: "Currency", v: "Canadian Dollar (CAD)", sub: "CAD 1 ≈ SGD 0.94" },
    { icon: "pin", k: "Top destinations", v: "Toronto · Vancouver · Banff", sub: "Plus Montréal, Niagara Falls, Quebec City" },
  ],

  processTitle: "How the Canada application works",
  processSub:
    "Everything is filed online with IRCC — there is no visa on arrival. Singapore passports get an eTA in minutes; TRV applicants add one biometrics visit, and we handle the rest.",
  steps: [
    {
      title: "Apply on VIZA",
      body: "Upload your passport, photo, and trip details. We complete form IMM 5257 and the IMM 5645 family form, then submit through the official IRCC Portal. Singapore passports skip straight to the CAD 7 eTA — usually approved within minutes.",
    },
    {
      title: "Give biometrics at VFS Global (TRV only)",
      body: "We book your fingerprints-and-photo appointment at the nearest VFS Visa Application Centre — available across mainland China and in Singapore. CAD 85, valid 10 years, skipped entirely if your biometrics are still on file.",
    },
    {
      title: "IRCC processes your visa",
      body: "China-lodged visitor visas currently average 8 – 14 weeks; Singapore-lodged online files clear in a few weeks. We track your IRCC status and answer document requests the same day so nothing stalls.",
      statusRows: [
        { label: "Application submitted to IRCC Portal", ts: "6 Jul, 9:40 AM", onTime: true },
        { label: "Biometrics completed at VFS Global", ts: "18 Jul, 11:05 AM", onTime: true },
        { label: "Awaiting final decision", ts: "In progress" },
      ],
    },
    {
      title: "Get your passport back by 25 Sep, 3:15 PM",
      body: "On approval, your passport goes to the VAC for the visa counterfoil and is couriered back to you. The visa is multiple-entry — its expiry date is the last day you may arrive in Canada, not a leave-by date.",
      delivered: true,
    },
  ],

  docsTitle: "Required documents",
  docsSub:
    "eTA applicants need only a passport, email address, and a credit or debit card. TRV applicants need the full set below — your VIZA consultant checks every item before it reaches IRCC.",
  documents: [
    { name: "Valid passport", sub: "Valid for your whole stay · visa and stay are capped at passport expiry, so longer validity is better" },
    { name: "Application form IMM 5257", sub: "Visitor visa application · one per traveller, including children" },
    { name: "Family information form IMM 5645", sub: "Required for PRC applicants · lists parents, spouse, and children" },
    { name: "Visa photo", sub: "35 × 45 mm, plain white background · digital JPEG/PNG, 240 KB – 4 MB" },
    { name: "Proof of funds", sub: "3 – 6 months of bank statements plus payslips or income proof" },
    { name: "Itinerary or invitation letter", sub: "Flight and hotel bookings, or your host's details and status in Canada" },
    { name: "Proof of ties to home country", sub: "Employment letter, property, enrolment, family — the top refusal ground" },
    { name: "Biometrics", sub: "Fingerprints + photo at a VFS centre · CAD 85 · valid 10 years" },
  ],

  rejectionTitle: "Why Canada visitor visas get refused",
  rejectionSub:
    "IRCC publishes its refusal grounds. The most common by far is IRPR 179(b) — the officer isn't satisfied you'll leave Canada. VIZA screens for every one of these before filing.",
  rejectionReasons: [
    { title: "Not satisfied you will leave Canada", body: "The single most common ground (IRPR 179(b)): weak family, employment, property, or financial ties to your home country, or previous overstays elsewhere." },
    { title: "Insufficient or unexplained funds", body: "Bank statements that don't cover the trip, unexplained large deposits, or no evidence of where your income comes from." },
    { title: "Vague purpose of visit", body: "No itinerary, inconsistent travel dates, or an invitation letter missing the host's status and address in Canada." },
    { title: "Incomplete application", body: "Missing forms (IMM 5257 or the family form), blank fields, untranslated documents, or skipped biometrics." },
    { title: "Misrepresentation", body: "False documents or undisclosed prior refusals (IRPA s.40) — carries a 5-year ban from Canada." },
    { title: "Inadmissibility", body: "A criminal record — including DUI — prior immigration violations, or medical and security grounds under IRPA." },
  ],

  entryTitle: "Entry & exit regulations",
  entrySub:
    "No arrival card is mandatory — the ArriveCAN Advance Declaration is optional (submit customs up to 72 hours before landing at major airports). Your eTA is checked electronically at airline check-in; the CBSA officer may ask for proof of funds, a return ticket, and accommodation, and sets your authorised stay.",
  entryExit: [
    { icon: "refresh", k: "Entry", v: "Multiple", sub: "Visa expiry is your last arrival date, not a leave-by date" },
    { icon: "clock", k: "Stay per entry", v: "Up to 6 months", sub: "Set by the CBSA officer · 6 months by default if unstamped" },
    { icon: "plane", k: "Arrival card", v: "Not required", sub: "ArriveCAN declaration optional, up to 72 h before landing" },
  ],

  extensionTitle: "Stay extension & overstays",
  extensionSub:
    "Extend by applying online for a Visitor Record — IRCC recommends filing at least 30 days before your authorised stay ends, and you keep maintained status while it's decided. Canada has no daily overstay fine, but losing status is costly and goes on your record.",
  extension: [
    { icon: "extend", k: "Extension", v: "Visitor record · CAD 100", sub: "Apply online ≥ 30 days before your stay ends · ≈ SGD 94" },
    { icon: "alert", k: "Overstay", v: "Restoration CAD 246.25", sub: "Within 90 days only (≈ SGD 231) · after that, exclusion order and 1-year ban" },
  ],

  reviews: {
    score: "4.6",
    outOf: "/ 5",
    sub: "Trusted by travellers worldwide · 15,712 reviews",
    platforms: [
      { rating: "4.7", name: "Trustpilot" },
      { rating: "4.6", name: "App Store" },
    ],
    items: [
      {
        initials: "FO",
        name: "Fatima Ouedraogo",
        source: "Trustpilot · 4 days ago",
        title: "Approved in under 5 minutes",
        body: "My VIZA consultant submitted the form and I had the approval email before I'd even finished my coffee. Seamless.",
      },
      {
        initials: "JP",
        name: "James Park",
        source: "App Store · 2 weeks ago",
        title: "Caught a passport typo I missed",
        body: "The review step flagged that I'd transposed two digits in my passport number. Would have been a nightmare at the airport.",
      },
    ],
  },

  faqSub:
    "Can't find your answer? Ask the AI assistant below or message your VIZA consultant directly.",
  faq: [
    {
      category: "General information",
      q: "Do I need a visa or an eTA for Canada?",
      a: "It depends on your passport. Singapore passports are visa-exempt: you need only the CAD 7 eTA when flying to Canada (arriving by land or sea from the US needs just your passport), and it's valid 5 years with unlimited entries. PRC (mainland China) passports are not eTA-eligible and need a Visitor Visa (TRV) for any entry mode. VIZA files whichever applies to you, end-to-end.",
    },
    {
      category: "General information",
      q: "How long can I stay, and will I get a 10-year visa?",
      a: "The default stay is up to 6 months per entry — the CBSA officer sets it on arrival, and if your passport isn't stamped it's 6 months automatically. TRVs can be issued for up to 10 years, capped at your passport and biometrics expiry, but since late 2024 the exact validity is at the officer's discretion rather than automatic.",
    },
    {
      category: "Application process",
      q: "What does the Canada application cost?",
      a: "eTA: CAD 7 (≈ SGD 6.60). Visitor visa: CAD 100 per person (≈ SGD 94) with a family maximum of CAD 500, plus biometrics at CAD 85 per person (≈ SGD 80, family maximum CAD 170). Biometrics are valid 10 years, so repeat applicants often skip that fee entirely.",
    },
    {
      category: "Application process",
      q: "How long does processing take?",
      a: "eTAs are usually approved within minutes; a small number take several days, so apply before booking flights. Visitor visas vary by country: China-lodged applications currently average 8 – 14 weeks, while Singapore-lodged online files typically clear in a few weeks, plus the biometrics appointment. VIZA books your biometrics slot and monitors IRCC status throughout.",
    },
    {
      category: "Application process",
      q: "Where do I give biometrics?",
      a: "TRV applicants give fingerprints and a photo at a VFS Global Visa Application Centre — available across mainland China, and in Singapore for residents applying from there. eTA applicants give no biometrics at all. Once given, biometrics stay valid for 10 years of visitor applications.",
    },
    {
      category: "Refunds, rejections & reapplications",
      q: "What happens if my application is refused?",
      a: "IRCC retains the government fee. VIZA's processing fee is fully refunded, and your consultant reviews the refusal letter — most refusals are IRPR 179(b) (ties to home country) or funds-related — then strengthens exactly those points before reapplying.",
    },
  ],

  sources: [
    { label: "IRCC — Entry requirements by country (who needs an eTA vs a visa)", url: "https://www.canada.ca/en/immigration-refugees-citizenship/services/visit-canada/entry-requirements-country.html", display: "canada.ca" },
    { label: "IRCC — eTA facts (cost, validity, eligibility)", url: "https://www.canada.ca/en/immigration-refugees-citizenship/services/visit-canada/eta/facts.html", display: "canada.ca" },
    { label: "IRCC — Visitor visa: about the document", url: "https://www.canada.ca/en/immigration-refugees-citizenship/services/visit-canada/about-visitor-visa.html", display: "canada.ca" },
    { label: "IRCC — Fee schedule (eTA, TRV, biometrics, restoration)", url: "https://ircc.canada.ca/english/information/fees/fees.asp", display: "ircc.canada.ca" },
    { label: "IRCC — Extend your stay (visitor record)", url: "https://www.canada.ca/en/immigration-refugees-citizenship/services/visit-canada/extend-stay.html", display: "canada.ca" },
    { label: "IRCC — Official processing-times tool", url: "https://www.canada.ca/en/immigration-refugees-citizenship/services/application/check-processing-times.html", display: "canada.ca" },
  ],

  price: {
    etaLabel: "Apply now, get it by",
    etaValue: "25 Sep 2026, 03:15 PM",
    title: "Visitor visa (TRV) · multi-entry",
    saving: "Biometrics booked for you",
    sub: "All-inclusive of document review, IRCC Portal filing, biometrics booking, and on-time guarantee.",
    foot: "IRCC government fee and VIZA processing are collected together at checkout, backed by our on-time guarantee.",
  },

  aiPlaceholder: "Ask anything about Canada visas — eTA vs TRV, fees, biometrics, processing…",
};

export default canada;
