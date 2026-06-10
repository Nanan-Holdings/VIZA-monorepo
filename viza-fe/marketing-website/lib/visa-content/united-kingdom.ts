import type { VisaContent } from "./types";

/**
 * United Kingdom Standard Visitor Visa.
 *
 * Visa specifics (fees, validity, permitted activities, document requirements,
 * and rejection criteria) should be verified by ops/legal against the UKVI
 * official guidance before publishing changes.
 *
 * Fact-checked 2026-06-10 against:
 *   - gov.uk/standard-visitor
 *   - gov.uk/guidance/visa-decision-waiting-times-applications-outside-the-uk
 *   - gov.uk/faster-decision-visa-settlement
 * Key findings (no content corrections required):
 *   - Up to 6 months stay ✓
 *   - Extension "not normally permitted" for tourism — confirmed correct; only medical,
 *     academic, and PLAB retake cases qualify for in-country extension.
 *   - Standard processing 3 weeks (≈15 working days) ✓
 *   - Priority (~5 working days) and super-priority (~next working day) services exist
 *     but availability for Visitor visas from outside the UK varies by location ✓
 *   - Long-term variants (2 / 5 / 10 years) referenced in overviewSub ✓
 *   - Sources (gov.uk URLs) verified correct ✓
 */
export const unitedKingdom: VisaContent = {
  slug: "united-kingdom",

  heroTitle: "United Kingdom Standard Visitor Visa",
  lede: "The Standard Visitor visa lets eligible passport holders enter the UK for tourism, family visits, or short business activities — typically for up to 6 months per entry.",
  heroImage: "/assets/heroes/united-kingdom.jpg",
  meta: [
    { k: "Type", v: "Standard Visitor" },
    { k: "Length of stay", v: "Up to 6 months" },
    { k: "Validity", v: "6 months" },
    { k: "Entry", v: "Single / Multiple" },
  ],
  tags: [
    { icon: "bolt", label: "Fast track · consultant-guided" },
    { icon: "shield", label: "On-time guarantee" },
    { icon: "doc", label: "Full document check" },
  ],

  overviewTitle: "United Kingdom, at a glance",
  overviewSub:
    "A Standard Visitor visa covers tourism, family visits, short business meetings, and certain permitted activities. Long-term variants (2, 5, or 10 years) are also available from UKVI.",
  glance: [
    { icon: "globe", k: "Capital", v: "London", sub: "UTC +0 / BST in summer" },
    { icon: "clock", k: "Best time to visit", v: "May – Sep", sub: "Mild weather · longest daylight" },
    { icon: "currency", k: "Currency", v: "Pound Sterling (GBP)", sub: "Check live rates before travelling" },
    { icon: "pin", k: "Top destinations", v: "London · Edinburgh · Manchester", sub: "Plus the Cotswolds, Bath, and the Lake District" },
  ],

  processTitle: "How the application process works",
  processSub:
    "Submit once. We handle every step with UK Visas and Immigration (UKVI) and notify you when a decision is ready.",
  steps: [
    {
      title: "Apply on VIZA",
      body: "Enter your travel details, upload your passport and supporting documents, and confirm your biometric appointment slot if required.",
    },
    {
      title: "Your documents are verified",
      body: "Your VIZA consultant reviews every field for completeness and accuracy, then submits the application to UKVI on your behalf.",
    },
    {
      title: "Your application gets processed",
      body: "We monitor the UKVI queue and flag any requests for further information before they delay your decision.",
      statusRows: [
        { label: "Application submitted to UKVI", ts: "12 Jun, 9:00 AM", onTime: true },
        { label: "Biometrics enrolled · application under review", ts: "13 Jun, 11:30 AM", onTime: true },
        { label: "Awaiting UKVI decision", ts: "In progress" },
      ],
    },
    {
      title: "Get your visa decision on 20 Jun, 2:00 PM",
      body: "Your vignette or BRP collection letter is sent to your inbox and the VIZA app. Your consultant walks you through next steps.",
      delivered: true,
    },
  ],

  docsTitle: "Required documents",
  docsSub:
    "Your VIZA consultant double-checks every document before submission. Re-uploads are unlimited and free.",
  documents: [
    { name: "Valid passport", sub: "Original + scan of bio page · valid for the duration of stay" },
    { name: "Proof of financial means", sub: "Bank statements covering the last 3–6 months" },
    { name: "Travel itinerary", sub: "Confirmed return flight and accommodation details" },
    { name: "Supporting letter", sub: "Purpose of visit · employment or sponsorship letter as applicable" },
  ],

  rejectionTitle: "Why Standard Visitor applications get refused",
  rejectionSub:
    "UKVI may refuse for any of the following reasons. VIZA flags these before you submit.",
  rejectionReasons: [
    { title: "Insufficient financial evidence", body: "UKVI requires credible proof that you can fund your trip and intend to leave the UK at the end of your visit." },
    { title: "Ties to home country not established", body: "Applications are refused when UKVI is not satisfied the applicant will return home — employment, family, and property evidence helps." },
    { title: "Incomplete or inconsistent documentation", body: "Mismatched dates, blurry scans, or missing supporting letters are among the most common refusal triggers." },
  ],

  entryTitle: "Entry & exit regulations",
  entrySub:
    "Carry your vignette (or digital status), return ticket, accommodation details, and financial evidence. Border Force may ask to see these at arrival.",
  entryExit: [
    { icon: "refresh", k: "Entry", v: "Single or Multiple", sub: "Depends on visa granted by UKVI" },
    { icon: "clock", k: "Use within", v: "Validity period", sub: "Check the start and end dates on your vignette" },
  ],

  extensionTitle: "Visa extension & overstays",
  extensionSub:
    "In-country extensions for Standard Visitor visas are not generally permitted. Overstaying is a serious immigration offence and can affect future applications.",
  extension: [
    { icon: "extend", k: "Extension", v: "Not normally permitted", sub: "Re-apply from home country for a fresh visit" },
    { icon: "alert", k: "Overstay consequence", v: "Immigration ban", sub: "May result in removal and a re-entry ban" },
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
        initials: "WL",
        name: "Wei Ling T.",
        source: "Trustpilot · 2 weeks ago",
        title: "Approval came faster than expected",
        body: "The consultant caught that my bank statement was missing a page — fixed it before submission. Visa approved within the standard window, no stress.",
      },
      {
        initials: "RN",
        name: "Rohan N.",
        source: "App Store · 1 month ago",
        title: "Clear guidance on what UKVI needs",
        body: "I'd tried before and got confused by the financial evidence requirements. VIZA walked me through exactly what to upload. Approved first time.",
      },
    ],
  },

  faqSub:
    "Can't find an answer? Ask the AI assistant at the bottom of this page or message your VIZA consultant.",
  faq: [
    {
      category: "General information",
      q: "What is the UK Standard Visitor visa?",
      a: "The Standard Visitor visa is issued by UK Visas and Immigration (UKVI) and allows eligible travellers to visit the UK for up to 6 months for tourism, family visits, or permitted short-term business activities such as meetings and conferences.",
    },
    {
      category: "General information",
      q: "Can I work or study on a Standard Visitor visa?",
      a: "No. The Standard Visitor visa does not permit paid employment. Short-term study (up to 30 days) for recreational purposes may be allowed, but any paid work requires a separate UK work visa. Check the UKVI official guidance for the full list of permitted activities.",
    },
    {
      category: "Application process",
      q: "How long does UK visa processing take?",
      a: "UKVI targets a decision within 15 working days for standard applications. Priority and super-priority services (where available at your location) can shorten this to 5 working days or the next working day respectively. Processing times can vary — apply well ahead of your travel date.",
    },
    {
      category: "Application process",
      q: "Do I need to attend a biometric appointment?",
      a: "Most first-time applicants are required to enrol biometrics at a Visa Application Centre (VAC). Your VIZA consultant will confirm whether a biometric appointment is needed for your nationality and help you book the correct VAC.",
    },
    {
      category: "Refunds, rejections & reapplications",
      q: "What happens if my UK visa application is refused?",
      a: "UKVI retains the application fee on refusal. You will receive a refusal notice explaining the grounds. VIZA's processing fee is fully refunded, and your consultant will review the refusal reasons to advise on strengthening a new application.",
    },
  ],

  sources: [
    { label: "UK Standard Visitor visa — GOV.UK", url: "https://www.gov.uk/standard-visitor", display: "gov.uk/standard-visitor" },
    { label: "Apply to come to the UK — GOV.UK", url: "https://www.gov.uk/apply-to-come-to-the-uk", display: "gov.uk/apply-to-come-to-the-uk" },
    { label: "UK Visas and Immigration (UKVI)", url: "https://www.gov.uk/government/organisations/uk-visas-and-immigration", display: "gov.uk/ukvi" },
  ],

  price: {
    etaLabel: "Apply now, target decision by",
    etaValue: "20 Jun 2026, 02:00 PM",
    title: "Standard Visitor Visa · up to 6 months",
    saving: "Consultant-guided · fewer delays",
    sub: "All-inclusive of UKVI application fee, document review, biometric appointment guidance, and on-time guarantee.",
    foot: "UKVI application fee and VIZA processing are collected together at checkout, backed by our on-time guarantee.",
  },

  aiPlaceholder: "Ask anything about UK visitor visas — documents, processing times, eligibility…",
};

export default unitedKingdom;
