import type { VisaContent } from "./types";

/**
 * France Schengen short-stay visa (Type C).
 *
 * Application is completed online on the official France-Visas portal
 * (france-visas.gouv.fr), then biometrics + documents are lodged in person at
 * an outsourced centre: VFS Global in Singapore (for non-exempt residents) or
 * TLScontact in mainland China. Singapore passport holders are visa-exempt.
 * The visa is valid across all 29 Schengen states (90 days per 180-day period).
 *
 * Last fact-checked: 2026-07-05 against france-visas.gouv.fr,
 * service-public.gouv.fr, diplomatie.gouv.fr, travel-europe.europa.eu,
 * home-affairs.ec.europa.eu, visa.vfsglobal.com and mfa.gov.sg.
 * — Fee EUR 90 adult / EUR 45 child 6–11 / free under 6 (EU-wide since 11 Jun 2024).
 * — EES biometric entry/exit registration fully operational since 10 Apr 2026.
 * — ETIAS (EUR 20) for visa-exempt nationals expected last quarter of 2026.
 *
 * Items needing ops confirmation before publishing changes:
 * 1. Exact VFS Global Singapore service fee for France (~EUR 34 equivalent per
 *    third-party sources) — verify on visa.vfsglobal.com/sgp/en/fra.
 * 2. France overstay fine amounts are inconsistently reported (EUR 198 vs up to
 *    EUR 3,750 CESEDA); practice centres on removal orders + IRTF entry bans —
 *    we deliberately publish no per-day fine figure.
 * 3. Daily means-of-subsistence thresholds (EUR 65 / 32.50 / 120) are widely
 *    cited but not re-verified on a live official page.
 * 4. Exact ETIAS launch date within Q4 2026 not yet announced by the EU.
 * 5. IRTF ban length (commonly up to 3 years, extendable) not verified against
 *    current CESEDA text.
 */
export const france: VisaContent = {
  slug: "france",

  heroTitle: "France Schengen Visa",
  lede: "The short-stay Type C Schengen visa — up to 90 days in any 180-day period across all 29 Schengen states. Applied for on France-Visas, lodged at VFS Global or TLScontact, and managed end-to-end by your VIZA consultant. Singapore passports skip the visa entirely.",
  heroImage: "/assets/heroes/france.jpg",
  meta: [
    { k: "Type", v: "Schengen short-stay (Type C)" },
    { k: "Length of stay", v: "90 days / 180-day period" },
    { k: "Validity", v: "Trip dates up to 5 years" },
    { k: "Entry", v: "Single · double · multiple" },
  ],
  tags: [
    { icon: "shield", label: "On-time guarantee" },
    { icon: "doc", label: "Full dossier review" },
    { icon: "globe", label: "29-country Schengen access" },
  ],

  overviewTitle: "France, at a glance",
  overviewSub:
    "A Schengen visa issued by France covers tourism, family visits, and short business trips — and lets you move freely across the entire Schengen Area.",
  glance: [
    { icon: "globe", k: "Capital", v: "Paris", sub: "UTC +1 (CET) / +2 (CEST)" },
    { icon: "clock", k: "Best time to visit", v: "Apr – Jun, Sep – Oct", sub: "Mild weather, fewer crowds" },
    { icon: "currency", k: "Currency", v: "Euro (EUR)", sub: "SGD 1 ≈ EUR 0.69" },
    { icon: "pin", k: "Top destinations", v: "Paris · Nice · Lyon", sub: "Plus Bordeaux, Strasbourg, Mont-Saint-Michel" },
  ],

  processTitle: "How the Schengen visa process works",
  processSub:
    "Submit once. We complete your France-Visas application, prepare the full dossier, book your biometrics slot, and track the consulate decision until the visa is in your passport.",
  steps: [
    {
      title: "Apply on VIZA",
      body: "Upload your passport, photos, itinerary, and supporting documents. Your consultant completes the official France-Visas online form and checks every item against the consulate checklist before anything is lodged.",
    },
    {
      title: "Your dossier is verified",
      body: "We cross-check insurance cover (EUR 30,000 minimum), bank statements, bookings, and ties documentation, then confirm your appointment — VFS Global in Singapore or TLScontact in mainland China.",
    },
    {
      title: "Biometrics & consulate review",
      body: "You attend the appointment in person to give fingerprints and submit the dossier. Standard processing is 15 calendar days under the EU Visa Code, extendable to 45 days in complex cases — we track the queue and flag any information requests.",
      statusRows: [
        { label: "Biometrics appointment completed", ts: "12 Jun, 9:00 AM", onTime: true },
        { label: "Dossier lodged with the consulate", ts: "12 Jun, 11:30 AM", onTime: true },
        { label: "Awaiting consulate decision", ts: "In progress" },
      ],
    },
    {
      title: "Collect your visa on 26 Jun",
      body: "The visa sticker is affixed to your passport — from your exact trip dates up to a 1 – 5 year multi-entry circulation visa for strong travel histories. We notify you the moment it's ready for collection or courier.",
      delivered: true,
    },
  ],

  docsTitle: "Required documents",
  docsSub:
    "French consulates apply the France-Visas checklist strictly. Your VIZA consultant verifies every item before submission — re-uploads are unlimited and free.",
  documents: [
    { name: "France-Visas application form", sub: "Completed online · printed with the CERFA receipt/barcode" },
    { name: "Passport", sub: "Valid 3+ months beyond Schengen departure · issued within 10 years · 2 blank pages" },
    { name: "Two photos", sub: "ICAO-standard · 35 × 45 mm · colour · light plain background" },
    { name: "Travel medical insurance", sub: "EUR 30,000 minimum · all Schengen states · full stay" },
    { name: "Proof of accommodation", sub: "Hotel bookings for the full itinerary, rental, or attestation d'accueil" },
    { name: "Proof of funds", sub: "3 months of bank statements · ~EUR 65/day with hotel, ~EUR 32.50/day if hosted" },
    { name: "Return or onward transport", sub: "Round-trip flight reservation out of the Schengen Area" },
    { name: "Proof of socio-economic ties", sub: "Employment letter with approved leave, business licence, enrolment, or retirement income" },
  ],

  rejectionTitle: "Why Schengen applications get rejected",
  rejectionSub:
    "The consulate screens for these issues — the most common refusal grounds across Schengen. VIZA flags them before you submit.",
  rejectionReasons: [
    {
      title: "Purpose of stay not established",
      body: "The most common refusal code: documents don't convincingly show the purpose and conditions of the stay, or the stated purpose contradicts the paperwork.",
    },
    {
      title: "Insufficient means of subsistence",
      body: "Bank statements below France's daily reference thresholds (~EUR 65/day with hotel, ~EUR 32.50/day if hosted), or large unexplained deposits.",
    },
    {
      title: "Doubtful intention to leave",
      body: "Weak home-country ties — no stable job, income, property, or family obligations — leaving the consulate unconvinced you'll depart before the visa expires.",
    },
    {
      title: "Unreliable bookings or documents",
      body: "Unconfirmed or fake hotel and flight reservations, or falsified supporting documents — which also trigger future bans.",
    },
    {
      title: "Non-compliant travel insurance",
      body: "Cover under EUR 30,000, not valid across the whole Schengen Area, or not spanning the full travel dates.",
    },
    {
      title: "Prior Schengen record",
      body: "A previous overstay, a SIS alert, or inconsistencies with earlier applications on file.",
    },
  ],

  entryTitle: "Entry & exit regulations",
  entrySub:
    "France has no arrival card, paper or digital. Since 10 April 2026 the EU Entry/Exit System (EES) registers you biometrically at the border — facial image plus fingerprints — replacing passport stamps. Carry proof of funds, accommodation, insurance, and your return ticket; border police may ask.",
  entryExit: [
    { icon: "refresh", k: "Entry", v: "As granted", sub: "Single, double, or multiple — set by the consulate" },
    { icon: "clock", k: "90 / 180 rule", v: "Max 90 days", sub: "Per rolling 180-day window across all Schengen states" },
    { icon: "shield", k: "EES registration", v: "Photo + fingerprints", sub: "First entry since 10 Apr 2026 · children under 12 skip fingerprints" },
    { icon: "calendar", k: "ETIAS", v: "Not yet required", sub: "Expected Q4 2026 for visa-exempt nationals · EUR 20" },
  ],

  extensionTitle: "Visa extension & overstays",
  extensionSub:
    "A French prefecture can extend a Type C visa only for force majeure, humanitarian reasons, or serious unforeseen events arising after issue — never for tourist convenience, and never beyond 90 days total. EES now logs every overstay automatically, even a single day.",
  extension: [
    { icon: "extend", k: "Extension", v: "Exceptional only", sub: "EUR 30 (≈ SGD 44) fee · free for force majeure or humanitarian grounds" },
    { icon: "alert", k: "Overstay consequences", v: "Removal + entry ban", sub: "Schengen-wide IRTF ban · flagged by EES · damages future visa and ETIAS applications" },
  ],

  reviews: {
    score: "4.6",
    outOf: "/ 5",
    sub: "Highest rated visa platform · 12,841 reviews",
    platforms: [
      { rating: "4.7", name: "Trustpilot" },
      { rating: "4.6", name: "App Store" },
    ],
    items: [
      {
        initials: "MC",
        name: "Marie Chen",
        source: "Trustpilot · 5 days ago",
        title: "First Schengen visa — stress-free",
        body: "The checklist was overwhelming when I tried to do it myself. VIZA's consultant caught two issues with my insurance policy before I submitted. Visa came back clean.",
      },
      {
        initials: "RT",
        name: "Rajan Tan",
        source: "App Store · 2 weeks ago",
        title: "Appointment reminders were a lifesaver",
        body: "Got alerts for every step — appointment confirmation, document lodge, and collection. I didn't have to chase the consulate once.",
      },
    ],
  },

  faqSub:
    "Can't find an answer? Ask the AI assistant at the bottom of this page or message your VIZA consultant.",
  faq: [
    {
      category: "General information",
      q: "Do Singapore passport holders need a visa for France?",
      a: "No. Singapore passports are visa-exempt for France and the whole Schengen Area — up to 90 days in any 180-day period for tourism, family visits, or business, with no visa and no fee. Since 10 April 2026 you register in EES (photo + fingerprints) at first entry, and from ETIAS launch (expected Q4 2026) you'll need a EUR 20 (≈ SGD 29) travel authorisation valid 3 years. VIZA tracks these changes so your trip never hits a surprise at the border.",
    },
    {
      category: "General information",
      q: "Do China (PRC) passport holders need a visa?",
      a: "Yes, always — a Type C Schengen visa, applied for via France-Visas then TLScontact in mainland China, or VFS Global Singapore for PRC nationals legally resident in Singapore. The good news: France approved about 93.9% of Chinese applications in 2024, and repeat travellers with clean visa history are regularly granted 1 – 5 year multi-entry visas. VIZA prepares the ties and income documentation that decides these outcomes.",
    },
    {
      category: "General information",
      q: "Can I travel to other Schengen countries on a French visa?",
      a: "Yes. A Type C visa issued by France is valid across all 29 Schengen states for the duration and entries granted. France must be your main destination or first port of entry, and the 90/180 rule counts days in every Schengen country combined.",
    },
    {
      category: "Application process",
      q: "How much does the visa cost?",
      a: "The government fee is EUR 90 (≈ SGD 131) per adult, EUR 45 (≈ SGD 66) for children 6 – 11, and free under 6 — EU-wide rates since 11 June 2024, non-refundable even if refused. The application centre (VFS Global or TLScontact) charges a service fee of roughly EUR 30 – 40 on top.",
    },
    {
      category: "Application process",
      q: "How long does processing take, and when should I apply?",
      a: "The EU Visa Code sets 15 calendar days as standard, extendable to 45 days in complex cases. Applications open 6 months before travel and close 15 days before. From mainland China in peak season, allow 30 – 45 days. We recommend applying 4 – 6 weeks out to cover appointment availability.",
    },
    {
      category: "Application process",
      q: "Do I have to attend the appointment in person?",
      a: "Yes. Fingerprints and the paper dossier must be lodged in person — at VFS Global in Singapore (180 Clemenceau Avenue, Haw Par Centre) or a TLScontact centre in mainland China. Biometrics are then reusable for 59 months, so repeat applicants within that window may be able to skip the appointment.",
    },
    {
      category: "Refunds, rejections & reapplications",
      q: "What happens if my visa application is refused?",
      a: "The consulate issues a refusal notice stating the ground; under French rules, no answer after 2 months also counts as an implicit refusal. The EUR 90 government fee is not refunded. VIZA's processing fee is fully refunded, and your consultant will analyse the refusal ground and rebuild the dossier before reapplying or appealing.",
    },
  ],

  sources: [
    { label: "France-Visas — official French government visa portal", url: "https://www.france-visas.gouv.fr/en/visa-de-court-sejour", display: "france-visas.gouv.fr" },
    { label: "France-Visas — official visa fee schedule", url: "https://france-visas.gouv.fr/documents/d/france-visas/frais-de-visa-anglais", display: "france-visas.gouv.fr" },
    { label: "Service-Public.fr — Schengen short-stay visa rules", url: "https://www.service-public.gouv.fr/particuliers/vosdroits/F16146?lang=en", display: "service-public.gouv.fr" },
    { label: "France Diplomatie — EES entry/exit system", url: "https://www.diplomatie.gouv.fr/en/services-to-foreigners/visiting-france/ees-the-new-european-border-entryexit-system-goes-live-on-10-april-2026", display: "diplomatie.gouv.fr" },
    { label: "EU — ETIAS official information site", url: "https://travel-europe.europa.eu/etias", display: "travel-europe.europa.eu" },
    { label: "VFS Global — France visa applications in Singapore", url: "https://visa.vfsglobal.com/sgp/en/fra", display: "visa.vfsglobal.com" },
    { label: "MFA Singapore — France travel information", url: "https://www.mfa.gov.sg/travelling-overseas/travel-advisories-notices-and-visa-information/france/", display: "mfa.gov.sg" },
  ],

  price: {
    etaLabel: "Apply now, target collection by",
    etaValue: "26 Jun 2026, 03:00 PM",
    title: "Schengen Visa (Type C) · 90-day stay",
    saving: "Full dossier review included",
    sub: "All-inclusive of document review, France-Visas form preparation, and on-time guarantee.",
    foot: "Government visa fee (EUR 90 ≈ SGD 131) is collected at checkout and paid to the consulate; the application centre's service fee applies at your appointment. VIZA's fee covers preparation, review, and appointment support.",
  },

  aiPlaceholder: "Ask anything about France Schengen visas — fees, documents, the 90/180 rule…",
};

export default france;
