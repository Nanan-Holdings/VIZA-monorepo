import type { VisaContent } from "./types";

/**
 * France Schengen Visa (Type C).
 *
 * Content reflects the short-stay Schengen visa process for France: application
 * via France-Visas, appointment at VFS Global or the French consulate, biometrics
 * in person, decision by the consulate. Visa is valid across the Schengen Area
 * (90 days per any 180-day period).
 *
 * Date-checked: 2026-06-10 against france-visas.gouv.fr and ec.europa.eu.
 * — Schengen member count updated to 29 (Bulgaria & Romania joined land borders 1 Jan 2025).
 * — Extension / force majeure wording verified against EU Visa Code Regulation 810/2009.
 *
 * IMPORTANT: Fees, processing times, and document requirements change periodically.
 * Ops/legal must verify all specifics against france-visas.gouv.fr before publishing.
 */
export const france: VisaContent = {
  slug: "france",

  heroTitle: "France Schengen Visa",
  lede: "A short-stay Type C Schengen visa, valid for up to 90 days within any 180-day period and accepted across all 29 Schengen member states.",
  heroImage: "/assets/heroes/france.jpg",
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

  overviewTitle: "France, at a glance",
  overviewSub:
    "A Schengen visa issued for France lets you travel for tourism, family visits, or short business trips — and move freely across the entire Schengen Area.",
  glance: [
    { icon: "globe", k: "Capital", v: "Paris", sub: "UTC +1 (CET) / +2 (CEST)" },
    { icon: "clock", k: "Best time to visit", v: "Apr – Jun, Sep – Oct", sub: "Mild weather, fewer crowds" },
    { icon: "currency", k: "Currency", v: "Euro (EUR)", sub: "Widely accepted across the EU" },
    { icon: "pin", k: "Top destinations", v: "Paris · Nice · Lyon", sub: "Plus Bordeaux, Strasbourg, Mont-Saint-Michel" },
  ],

  processTitle: "How the Schengen visa process works",
  processSub:
    "Submit once. We prepare and review your complete dossier, help you book the consulate appointment, and track every step until your visa arrives.",
  steps: [
    {
      title: "Apply on VIZA",
      body: "Upload your passport, photo, travel itinerary, and supporting documents. Your consultant checks everything against the France-Visas checklist before it leaves your hands.",
    },
    {
      title: "Your documents are verified",
      body: "Your VIZA consultant cross-checks every field for the France-Visas requirements, prepares the application form, and confirms your appointment slot at the consulate or VFS Global centre.",
    },
    {
      title: "Biometrics & consulate review",
      body: "You attend the appointment in person to submit biometrics. We track the consulate's decision queue and alert you to any missing information requests.",
      statusRows: [
        { label: "Biometrics appointment confirmed", ts: "12 Jun, 9:00 AM", onTime: true },
        { label: "Application lodged with consulate", ts: "12 Jun, 11:30 AM", onTime: true },
        { label: "Awaiting consulate decision", ts: "In progress" },
      ],
    },
    {
      title: "Collect your visa on 26 Jun",
      body: "The visa sticker is affixed to your passport. Your VIZA consultant notifies you the moment it is ready for collection or courier delivery.",
      delivered: true,
    },
  ],

  docsTitle: "Required documents",
  docsSub:
    "French consulates follow the France-Visas checklist. Your VIZA consultant verifies every item before submission — re-uploads are unlimited and free.",
  documents: [
    { name: "Passport bio page", sub: "Valid for 3+ months beyond intended stay · issued within 10 years" },
    { name: "Biometric photograph", sub: "35 × 45 mm · plain light background · last 6 months" },
    { name: "Travel itinerary & return ticket", sub: "Outbound and return flights within the stay window" },
    { name: "Accommodation proof & travel insurance", sub: "Hotel bookings · insurance covering €30,000 across Schengen" },
  ],

  rejectionTitle: "Why Schengen applications get rejected",
  rejectionSub:
    "France-Visas and the consulate screen for these issues. VIZA flags them before you submit.",
  rejectionReasons: [
    {
      title: "Insufficient travel insurance",
      body: "Insurance that does not meet the mandatory €30,000 minimum cover across the full Schengen Area and the entire stay period.",
    },
    {
      title: "Incomplete financial proof",
      body: "Inability to demonstrate sufficient funds to cover accommodation, daily expenses, and the return journey for the duration of the stay.",
    },
    {
      title: "Itinerary inconsistencies",
      body: "Booked travel dates that conflict with the stated purpose of visit, or accommodation not matching the declared destination.",
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
    "Schengen short-stay visas are generally not extendable except in exceptional circumstances (force majeure or humanitarian reasons). Overstaying triggers serious consequences.",
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
      q: "Can I travel to other Schengen countries on a French visa?",
      a: "Yes. A short-stay Schengen Type C visa issued by France is valid for travel across all 29 Schengen Area member states for the duration and number of entries granted. France must be your main destination or first port of entry.",
    },
    {
      category: "General information",
      q: "What is the 90/180-day rule?",
      a: "You may stay a maximum of 90 days in any rolling 180-day window across the entire Schengen Area — not per country. Days spent in any Schengen country count toward the total.",
    },
    {
      category: "Application process",
      q: "How early should I apply?",
      a: "France-Visas recommends applying at least 15 days before your trip, and no earlier than 6 months in advance. We recommend applying 4 – 6 weeks before travel to allow for appointment availability and processing time.",
    },
    {
      category: "Application process",
      q: "Do I have to attend the appointment in person?",
      a: "Yes. Biometric data (fingerprints and photograph) must be submitted in person at the French consulate or an authorised VFS Global application centre. There is no way to bypass this step.",
    },
    {
      category: "Refunds, rejections & reapplications",
      q: "What happens if my visa application is refused?",
      a: "The consulate will issue a refusal notice stating the reason. The government fee is non-refundable. VIZA's processing fee is fully refunded, and your consultant will review the refusal grounds and advise on reapplying or appealing.",
    },
  ],

  sources: [
    { label: "France-Visas — official French government visa portal", url: "https://france-visas.gouv.fr/", display: "france-visas.gouv.fr" },
    { label: "French Ministry of Europe and Foreign Affairs — consular information", url: "https://www.diplomatie.gouv.fr/en/coming-to-france/", display: "diplomatie.gouv.fr" },
  ],

  price: {
    etaLabel: "Apply now, target collection by",
    etaValue: "26 Jun 2026, 03:00 PM",
    title: "Schengen Visa · up to 90 days",
    saving: "Full dossier review included",
    sub: "All-inclusive of document review, form preparation, and on-time guarantee.",
    foot: "Government visa fee is collected at checkout and paid directly to the consulate; VIZA's service fee covers preparation, review, and appointment support.",
  },

  aiPlaceholder: "Ask anything about France Schengen visas — documents, appointments, the 90/180 rule…",
};

export default france;
