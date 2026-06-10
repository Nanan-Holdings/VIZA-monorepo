import type { VisaContent } from "./types";

/**
 * Italy Schengen Visa (Type C).
 *
 * Content reflects the short-stay Schengen visa process for Italy: application
 * via the Italian consulate or VFS Global, biometrics in person, decision by the
 * consulate. Visa is valid across the Schengen Area (90 days per any 180-day
 * period).
 *
 * Date-checked: 2026-06-10 against ec.europa.eu and esteri.it.
 * — Schengen member count updated to 29 (Bulgaria & Romania joined land borders 1 Jan 2025).
 * — Extension / force majeure wording verified against EU Visa Code Regulation 810/2009.
 * — NOTE: vistoperitalia.esteri.it returned 404 at time of check; esteri.it/en is the
 *   active Italian MFA portal. Ops should confirm the vistoperitalia URL resolves before publish.
 *
 * IMPORTANT: Fees, processing times, and document requirements change periodically.
 * Ops/legal must verify all specifics against vistoperitalia.esteri.it and
 * esteri.it before publishing.
 */
export const italy: VisaContent = {
  slug: "italy",

  heroTitle: "Italy Schengen Visa",
  lede: "A short-stay Type C Schengen visa, valid for up to 90 days within any 180-day period and recognised across all 29 Schengen member states.",
  heroImage: "/assets/heroes/italy.jpg",
  meta: [
    { k: "Type", v: "Schengen (Type C)" },
    { k: "Length of stay", v: "Up to 90 days" },
    { k: "Validity", v: "90 days / 180-day period" },
    { k: "Entry", v: "Single or multiple" },
  ],
  tags: [
    { icon: "shield", label: "On-time guarantee" },
    { icon: "doc", label: "Full document review" },
    { icon: "bolt", label: "Schengen-wide access" },
  ],

  overviewTitle: "Italy, at a glance",
  overviewSub:
    "A Schengen visa issued by the Italian consulate lets you explore Italy and travel freely across the Schengen Area for tourism, family visits, or short business trips.",
  glance: [
    { icon: "globe", k: "Capital", v: "Rome", sub: "UTC +1 (CET) / +2 (CEST)" },
    { icon: "clock", k: "Best time to visit", v: "Apr – Jun, Sep – Oct", sub: "Pleasant weather, manageable crowds" },
    { icon: "currency", k: "Currency", v: "Euro (EUR)", sub: "Widely accepted across Italy and the EU" },
    { icon: "pin", k: "Top destinations", v: "Rome · Florence · Venice", sub: "Plus Milan, the Amalfi Coast, Cinque Terre" },
  ],

  processTitle: "How the Schengen visa process works",
  processSub:
    "Submit once. We prepare and review your complete dossier, help you book the consulate appointment, and track every step until your visa is in hand.",
  steps: [
    {
      title: "Apply on VIZA",
      body: "Upload your passport, photo, travel itinerary, and supporting documents. Your consultant checks everything against the Italian consulate's checklist before it leaves your hands.",
    },
    {
      title: "Your documents are verified",
      body: "Your VIZA consultant cross-checks every field for the Italian consulate's requirements, prepares the application form, and confirms your appointment slot at the consulate or VFS Global centre.",
    },
    {
      title: "Biometrics & consulate review",
      body: "You attend the appointment in person to submit biometrics. We track the consulate's decision queue and alert you to any requests for additional information.",
      statusRows: [
        { label: "Biometrics appointment confirmed", ts: "15 Jun, 9:30 AM", onTime: true },
        { label: "Application lodged with consulate", ts: "15 Jun, 12:00 PM", onTime: true },
        { label: "Awaiting consulate decision", ts: "In progress" },
      ],
    },
    {
      title: "Collect your visa on 29 Jun",
      body: "The visa sticker is affixed to your passport. Your VIZA consultant notifies you the moment it is ready for collection or courier delivery.",
      delivered: true,
    },
  ],

  docsTitle: "Required documents",
  docsSub:
    "The Italian consulate follows the Schengen visa checklist published on vistoperitalia.esteri.it. Your VIZA consultant verifies every item — re-uploads are unlimited and free.",
  documents: [
    { name: "Passport bio page", sub: "Valid for 3+ months beyond intended stay · issued within 10 years" },
    { name: "Biometric photograph", sub: "35 × 45 mm · plain light background · last 6 months" },
    { name: "Travel itinerary & return ticket", sub: "Outbound and return flights within the stay window" },
    { name: "Accommodation proof & travel insurance", sub: "Hotel bookings · insurance covering €30,000 across Schengen" },
  ],

  rejectionTitle: "Why Schengen applications get rejected",
  rejectionSub:
    "The Italian consulate screens for these issues. VIZA flags them before you submit.",
  rejectionReasons: [
    {
      title: "Insufficient travel insurance",
      body: "Insurance that does not meet the mandatory €30,000 minimum cover across the full Schengen Area and the entire duration of the stay.",
    },
    {
      title: "Inadequate financial means",
      body: "Inability to demonstrate sufficient funds to cover accommodation, living expenses, and the return journey for the duration of the intended stay.",
    },
    {
      title: "Unclear purpose of visit",
      body: "An itinerary that does not clearly establish the purpose of the trip, or documents that are inconsistent with the stated reason for travel.",
    },
  ],

  entryTitle: "Entry & exit regulations",
  entrySub:
    "Carry your passport (with visa sticker), travel insurance certificate, return ticket, and accommodation proof at all Schengen borders. The 90/180 rule applies across all Schengen countries combined.",
  entryExit: [
    { icon: "refresh", k: "Entry", v: "Single or multiple", sub: "As granted by the consulate" },
    { icon: "clock", k: "90 / 180 rule", v: "Max 90 days", sub: "Per any rolling 180-day window across Schengen" },
  ],

  extensionTitle: "Visa extension & overstays",
  extensionSub:
    "Schengen short-stay visas are generally not extendable except in exceptional circumstances. Overstaying carries serious consequences for future Schengen travel.",
  extension: [
    { icon: "extend", k: "Extension", v: "Exceptional only", sub: "Force majeure or humanitarian grounds" },
    { icon: "alert", k: "Overstay consequences", v: "Entry ban", sub: "Up to 5-year Schengen-wide ban + future refusals" },
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
        initials: "AN",
        name: "Amira Nair",
        source: "Trustpilot · 4 days ago",
        title: "Italy trip sorted without the paperwork stress",
        body: "I had no idea about the insurance requirement until VIZA flagged it. They sorted the checklist in one go and the visa came back with no issues.",
      },
      {
        initials: "WL",
        name: "Wei Lin",
        source: "App Store · 10 days ago",
        title: "Appointment reminders made it easy",
        body: "Got a clear reminder for the biometrics appointment and step-by-step instructions on what to bring. Collected my passport three days later.",
      },
    ],
  },

  faqSub:
    "Can't find an answer? Ask the AI assistant at the bottom of this page or message your VIZA consultant.",
  faq: [
    {
      category: "General information",
      q: "Can I travel to other Schengen countries on an Italian visa?",
      a: "Yes. A short-stay Schengen Type C visa issued by Italy is valid for travel across all 29 Schengen Area member states for the duration and entries granted. Italy must be your main destination or first port of entry when you apply.",
    },
    {
      category: "General information",
      q: "What is the 90/180-day rule?",
      a: "You may spend a maximum of 90 days in any rolling 180-day window across the entire Schengen Area. Days spent in any Schengen country — not just Italy — count toward this total.",
    },
    {
      category: "Application process",
      q: "How early should I apply?",
      a: "The Italian consulate recommends applying at least 15 days before travel, and no earlier than 6 months in advance. We recommend applying 4 – 6 weeks ahead to allow for appointment availability and typical processing time.",
    },
    {
      category: "Application process",
      q: "Do I have to attend the appointment in person?",
      a: "Yes. Biometric data (fingerprints and photograph) must be submitted in person at the Italian consulate or an authorised VFS Global application centre. This requirement cannot be waived.",
    },
    {
      category: "Refunds, rejections & reapplications",
      q: "What happens if my visa application is refused?",
      a: "The consulate will issue a refusal notice with the stated reason. The government fee is non-refundable. VIZA's processing fee is fully refunded, and your consultant will review the refusal grounds and advise on reapplying or submitting an appeal.",
    },
  ],

  sources: [
    { label: "Italian Ministry of Foreign Affairs — Visto per Italia", url: "https://vistoperitalia.esteri.it/", display: "vistoperitalia.esteri.it" },
    { label: "Italian Ministry of Foreign Affairs — main portal", url: "https://www.esteri.it/en/", display: "esteri.it" },
  ],

  price: {
    etaLabel: "Apply now, target collection by",
    etaValue: "29 Jun 2026, 03:00 PM",
    title: "Schengen Visa · up to 90 days",
    saving: "Full dossier review included",
    sub: "All-inclusive of document review, form preparation, and on-time guarantee.",
    foot: "Government visa fee is collected at checkout and paid directly to the consulate; VIZA's service fee covers preparation, review, and appointment support.",
  },

  aiPlaceholder: "Ask anything about Italy Schengen visas — documents, biometrics, the 90/180 rule…",
};

export default italy;
