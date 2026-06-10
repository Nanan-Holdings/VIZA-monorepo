import type { VisaContent } from "./types";

/**
 * Canada Electronic Travel Authorization (eTA).
 *
 * Required for visa-exempt foreign nationals travelling to Canada by air.
 * Linked directly to the passport; the traveller only needs to show their
 * passport at the airport. Valid 5 years or until passport expires.
 * Does NOT apply to U.S. citizens or to travellers entering by land/sea.
 *
 * Last fact-checked: 2026-06-10 against canada.ca and ircc.canada.ca.
 * Key facts verified:
 *   - Fee: CAD 7 — confirmed current (ircc.canada.ca/fees).
 *   - Validity: 5 years or until passport expires — confirmed.
 *   - Processing: most within minutes; referred cases up to 72 hours per
 *     IRCC official guidance (ircc.canada.ca helpcentre/answer q=1063).
 *   - Stay: up to 6 months per entry, as set by CBSA — confirmed.
 * Items needing ops confirmation:
 *   - Eligible nationalities list (IRCC updates periodically).
 *
 * Official source:
 *   https://www.canada.ca/en/immigration-refugees-citizenship/services/visit-canada/eta.html
 *   https://ircc.canada.ca/english/helpcentre/answer.asp?qnum=1063&top=16
 */
export const canada: VisaContent = {
  slug: "canada",

  heroTitle: "Canada eTA",
  lede: "Canada's Electronic Travel Authorization for eligible visa-exempt travellers arriving by air — valid 5 years, multiple entry, linked directly to your passport. Filed and confirmed by your VIZA consultant.",
  heroImage: "/assets/heroes/canada.jpg",
  meta: [
    { k: "Type", v: "eTA" },
    { k: "Length of stay", v: "Up to 6 months" },
    { k: "Validity", v: "5 years" },
    { k: "Entry", v: "Multiple" },
  ],
  tags: [
    { icon: "bolt", label: "Usually approved in minutes" },
    { icon: "shield", label: "On-time guarantee" },
    { icon: "doc", label: "Simple process" },
  ],

  overviewTitle: "Canada, at a glance",
  overviewSub:
    "Canada's eTA is required for eligible visa-exempt nationals flying into Canada — covering tourism, family visits, and short business trips.",
  glance: [
    { icon: "globe", k: "Capital", v: "Ottawa", sub: "UTC −5 (EST)" },
    { icon: "clock", k: "Best time to visit", v: "Jun – Aug · Dec – Mar", sub: "Summer warmth or ski season" },
    { icon: "currency", k: "Currency", v: "Canadian Dollar (CAD)", sub: "Cards widely accepted" },
    { icon: "pin", k: "Top destinations", v: "Toronto · Vancouver · Banff", sub: "Plus Montréal, Niagara Falls, Quebec City" },
  ],

  processTitle: "How the Canada eTA process works",
  processSub:
    "Most eTAs are approved automatically within minutes. VIZA ensures your application is error-free so there are no delays on travel day.",
  steps: [
    {
      title: "Apply on VIZA",
      body: "Provide your passport details, nationality, and travel purpose. We pre-fill the IRCC eTA form from your profile to eliminate manual errors.",
    },
    {
      title: "Application reviewed & submitted",
      body: "Your VIZA consultant verifies every field — name spelling, passport number, nationality — against IRCC requirements before submission.",
    },
    {
      title: "eTA processed by IRCC",
      body: "Most applications are approved within minutes; a small number are referred for additional review which can take a few days. We monitor your status in real time.",
      statusRows: [
        { label: "Application submitted to IRCC", ts: "20 Jun, 3:10 PM", onTime: true },
        { label: "Automatic eligibility check passed", ts: "20 Jun, 3:11 PM", onTime: true },
        { label: "Final approval pending", ts: "In progress" },
      ],
    },
    {
      title: "eTA approved on 20 Jun, 3:15 PM",
      body: "Approval is linked electronically to your passport — no printout needed. VIZA sends you a confirmation and reminds you to travel with the approved passport.",
      delivered: true,
    },
  ],

  docsTitle: "Required documents",
  docsSub:
    "The Canada eTA requires minimal documentation. Your VIZA consultant checks every field for accuracy before submission.",
  documents: [
    { name: "Valid passport", sub: "The passport you will use to fly into Canada · must be valid throughout your stay" },
    { name: "Email address", sub: "For IRCC correspondence and your eTA confirmation" },
    { name: "Payment method", sub: "CAD 7 government fee · credit or debit card" },
    { name: "Travel history (if referred)", sub: "IRCC may request additional details for manual review cases" },
  ],

  rejectionTitle: "Why eTA applications get refused",
  rejectionSub:
    "Most eTAs are approved instantly, but certain factors can trigger refusal or referral. VIZA flags these before you submit.",
  rejectionReasons: [
    { title: "Ineligible nationality", body: "The eTA is only available to nationals of designated visa-exempt countries. Travellers from visa-required countries must apply for a Temporary Resident Visa instead." },
    { title: "Criminal or immigration history", body: "Convictions for serious offences, previous removals from Canada, or misrepresentation on a prior application can result in refusal." },
    { title: "Passport errors or expired document", body: "Any discrepancy between the application and passport data — including an expired passport — causes automatic rejection. VIZA's review catches these before submission." },
  ],

  entryTitle: "Entry & exit regulations",
  entrySub:
    "Your eTA is electronically linked to your passport. Present the same passport at check-in and at the Canadian border. A CBSA officer sets the authorised length of stay on arrival.",
  entryExit: [
    { icon: "refresh", k: "Entry", v: "Multiple", sub: "Valid for 5 years or until passport expires" },
    { icon: "clock", k: "Stay per entry", v: "Up to 6 months", sub: "As set by CBSA officer on arrival" },
  ],

  extensionTitle: "Stay extension & overstays",
  extensionSub:
    "Visitors wishing to stay longer than authorised must apply to extend their status from inside Canada before their allowed period ends.",
  extension: [
    { icon: "extend", k: "Extension", v: "Apply online to IRCC", sub: "Before your authorised stay expires" },
    { icon: "alert", k: "Overstay penalty", v: "Removal + future bar", sub: "May affect eligibility for future visits or immigration" },
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
      q: "What is a Canada eTA?",
      a: "An Electronic Travel Authorization is a pre-entry requirement for eligible visa-exempt foreign nationals flying to Canada. It is linked electronically to your passport and does not require a separate stamp or document — you simply show the same passport used for the application when you check in and at the Canadian border.",
    },
    {
      category: "General information",
      q: "Does the eTA cover travel by land or sea?",
      a: "No. The eTA is required only for air travel into Canada. Eligible visa-exempt travellers entering by land or sea border crossing do not need an eTA, though other entry requirements still apply.",
    },
    {
      category: "Application process",
      q: "How quickly is an eTA approved?",
      a: "The majority of eTAs are approved within minutes of submission by IRCC's automated system. A smaller number are referred for manual review, which can take a few days. VIZA monitors your application status and alerts you to any change immediately.",
    },
    {
      category: "Application process",
      q: "What if I renew my passport after getting an eTA?",
      a: "Your eTA is tied to the specific passport used during the application. If you renew your passport, you must apply for a new eTA and link it to the new document before travelling.",
    },
    {
      category: "Refunds, rejections & reapplications",
      q: "What happens if my eTA is refused?",
      a: "The CAD 7 government fee is non-refundable. IRCC provides limited details on eTA refusals; however, VIZA will review your case, check eligibility, and advise whether you need to apply for a full Temporary Resident Visa instead.",
    },
  ],

  sources: [
    { label: "IRCC — Electronic Travel Authorization (eTA)", url: "https://www.canada.ca/en/immigration-refugees-citizenship/services/visit-canada/eta.html", display: "canada.ca" },
    { label: "IRCC — eTA application portal", url: "https://www.canada.ca/en/immigration-refugees-citizenship/services/visit-canada/eta/apply.html", display: "canada.ca" },
    { label: "IRCC — How long does eTA processing take?", url: "https://ircc.canada.ca/english/helpcentre/answer.asp?qnum=1063&top=16", display: "ircc.canada.ca" },
  ],

  price: {
    etaLabel: "Apply now, get it by",
    etaValue: "20 Jun 2026, 03:15 PM",
    title: "Canada eTA · 5-year validity",
    saving: "Usually approved in minutes",
    sub: "All-inclusive of document review, submission, and on-time guarantee.",
    foot: "IRCC government fee and VIZA service fee are collected together at checkout.",
  },

  aiPlaceholder: "Ask anything about the Canada eTA — eligibility, processing, renewals…",
};

export default canada;
