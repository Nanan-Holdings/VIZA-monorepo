import type { VisaContent } from "./types";

/**
 * United Arab Emirates e-Visa content.
 * Last fact-checked: 2026-06-10 against icp.gov.ae, gdrfad.gov.ae, and u.ae.
 *
 * Visa specifics (fees, validity, document list, rejection reasons, entry
 * conditions) must be verified by ops/legal against the official ICP portal
 * (icp.gov.ae) and Dubai GDRFA (gdrfad.gov.ae) before publishing changes.
 * Stay duration and entry type vary by visa category — copy is intentionally
 * nationality-neutral.
 *
 * Ops confirmation needed:
 *   - Validity from issue: officially 58 days (per u.ae/GDRFA); displayed here as
 *     "approximately 60 days" for readability — confirm exact figure before updating.
 *   - Overstay fine: AED 50/day is the ICP-standardised federal rate as of Feb 2026;
 *     GDRFA Dubai historically listed AED 100/day — confirm which applies at checkout.
 *   - Extension: available online via ICP or GDRFA (Dubai); confirm current fee/process.
 */
export const unitedArabEmirates: VisaContent = {
  slug: "united-arab-emirates",

  heroTitle: "United Arab Emirates e-Visa",
  lede: "An official UAE e-Visa for tourism and short-term visits, granting 30 or 60 days of stay with optional extension. Apply online before travel — no embassy visit required.",
  heroImage: "/assets/heroes/united-arab-emirates.jpg",
  meta: [
    { k: "Type", v: "e-Visa (Tourist)" },
    { k: "Length of stay", v: "30 or 60 days" },
    { k: "Validity", v: "~58 days from issue" },
    { k: "Entry", v: "Single or Multiple" },
  ],
  tags: [
    { icon: "bolt", label: "Fast approval" },
    { icon: "shield", label: "On-time guarantee" },
    { icon: "doc", label: "Minimal documents" },
  ],

  overviewTitle: "United Arab Emirates, at a glance",
  overviewSub:
    "Futuristic skylines, golden deserts, luxury shopping, and year-round sunshine — the UAE is a gateway destination between East and West.",
  glance: [
    { icon: "globe", k: "Capital", v: "Abu Dhabi", sub: "UTC +4 (GST, no DST)" },
    { icon: "clock", k: "Best time to visit", v: "Oct – Apr", sub: "Cooler temperatures, outdoor-friendly" },
    { icon: "currency", k: "Currency", v: "UAE Dirham (AED)", sub: "Pegged to the USD since 1997" },
    { icon: "pin", k: "Top destinations", v: "Dubai · Abu Dhabi · Sharjah", sub: "Plus Ras Al Khaimah, Fujairah" },
  ],

  processTitle: "How the UAE e-Visa process works",
  processSub:
    "Submit once. We handle every step with the UAE Federal Authority ICP portal and notify you the moment your visa is ready.",
  steps: [
    {
      title: "Apply on VIZA",
      body: "Upload your passport, photo, and travel details. Pay only the government fee upfront — VIZA's processing fee is charged on approval.",
    },
    {
      title: "Your documents are verified",
      body: "Your VIZA consultant checks nationality eligibility, passport scan quality, and every required field, then submits directly to the ICP portal.",
    },
    {
      title: "Your e-Visa gets processed",
      body: "We monitor each stage in the UAE system and flag any delays so you always know where things stand.",
      statusRows: [
        { label: "Application submitted to ICP portal", ts: "15 Jun, 10:00 AM", onTime: true },
        { label: "Identity and travel document verified", ts: "15 Jun, 1:30 PM", onTime: true },
        { label: "Awaiting final e-Visa issuance", ts: "In progress" },
      ],
    },
    {
      title: "Get your e-Visa on 18 Jun, 12:00 PM",
      body: "The e-Visa PDF arrives in your inbox and your VIZA app. Print it or save it — UAE immigration scans it on arrival.",
      delivered: true,
    },
  ],

  docsTitle: "Required documents",
  docsSub:
    "Your VIZA consultant double-checks each document before submission. Re-uploads are unlimited and free.",
  documents: [
    { name: "Passport bio page", sub: "Valid 6+ months beyond stay · clean scan" },
    { name: "Recent photograph", sub: "White background · last 6 months" },
    { name: "Return or onward ticket", sub: "Departure within the approved stay window" },
    { name: "Accommodation proof", sub: "Hotel confirmation or host invitation letter" },
  ],

  rejectionTitle: "Why UAE e-Visas get rejected",
  rejectionSub:
    "The ICP system checks these automatically. VIZA reviews your application before submission to catch issues first.",
  rejectionReasons: [
    {
      title: "Incomplete or unclear passport scan",
      body: "The UAE system requires a fully legible, un-cropped bio page. Blurry or partially obscured scans are rejected automatically.",
    },
    {
      title: "Security or criminal record flags",
      body: "Applicants with flagged travel history, certain prior criminal convictions, or entry bans in the UAE are ineligible for an e-Visa.",
    },
    {
      title: "Prior immigration violations",
      body: "Overstaying a previous UAE visa or violating entry conditions creates a record that can block future applications.",
    },
  ],

  entryTitle: "Entry & exit regulations",
  entrySub:
    "Carry your e-Visa PDF and a valid return ticket. Stay within the permitted period — UAE immigration tracks departure dates closely.",
  entryExit: [
    { icon: "refresh", k: "Entry", v: "Single or Multiple", sub: "Depends on visa category selected at application" },
    { icon: "clock", k: "Activate within", v: "~58 days", sub: "From the e-Visa issue date — enter before this window closes" },
  ],

  extensionTitle: "Visa extension & overstays",
  extensionSub:
    "Tourist e-Visas can be extended online through the ICP portal or GDRFA (for Dubai) before expiry for a period matching the original visa duration. Overstaying triggers daily fines and can result in a travel ban.",
  extension: [
    { icon: "extend", k: "Extension", v: "Available online", sub: "Apply via ICP portal or GDRFA before expiry — duration matches original visa" },
    { icon: "alert", k: "Overstay fine", v: "AED 50 / day", sub: "Plus entry ban risk on departure" },
  ],

  reviews: {
    score: "4.7",
    outOf: "/ 5",
    sub: "Trusted by thousands of travellers · 8,932 reviews",
    platforms: [
      { rating: "4.7", name: "Trustpilot" },
      { rating: "4.8", name: "App Store" },
    ],
    items: [
      {
        initials: "NS",
        name: "Nadia Shah",
        source: "Trustpilot · 3 days ago",
        title: "Dubai visa in under 3 days",
        body: "First time applying for a UAE visa and I was nervous about the photo spec. The consultant flagged the background colour before submission and sorted it. No stress at all.",
      },
      {
        initials: "BL",
        name: "Bernard Lim",
        source: "App Store · 6 days ago",
        title: "Status updates made all the difference",
        body: "Watched my application move through each stage in real time. Knew exactly when the visa was issued — no refreshing emails. Would not apply any other way.",
      },
    ],
  },

  faqSub:
    "Can't find an answer? Ask the AI assistant at the bottom of this page or message your VIZA consultant.",
  faq: [
    {
      category: "General information",
      q: "What is the UAE Tourist e-Visa?",
      a: "The UAE Tourist e-Visa is an official electronic authorisation issued by the Federal Authority for Identity, Citizenship, Customs & Port Security (ICP). It allows eligible travellers to enter the UAE for tourism, leisure, family visits, or transit without attending an embassy.",
    },
    {
      category: "General information",
      q: "Can I travel to all seven emirates on one e-Visa?",
      a: "Yes. A UAE e-Visa is valid across all seven emirates — Dubai, Abu Dhabi, Sharjah, Ajman, Ras Al Khaimah, Fujairah, and Umm Al Quwain. There are no inter-emirate border checks.",
    },
    {
      category: "Application process",
      q: "How quickly will I receive my UAE e-Visa?",
      a: "Most approvals arrive within 2 – 4 business days through VIZA. Processing can be faster for straightforward cases. We back our timeline with an on-time guarantee — your money back if we're late.",
    },
    {
      category: "Application process",
      q: "Can I apply for multiple family members together?",
      a: "Yes. Add each traveller in your VIZA application — your consultant submits them together so they are processed on the same timeline and land with matching visas.",
    },
    {
      category: "Refunds, rejections & reapplications",
      q: "What happens if my UAE e-Visa is refused?",
      a: "The UAE government retains the application fee. VIZA's service fee is fully refunded. Your consultant will review the reason for refusal — often a document issue — and advise on reapplication or alternative entry options.",
    },
  ],

  sources: [
    {
      label: "UAE Federal Authority for Identity, Citizenship, Customs & Port Security (ICP)",
      url: "https://icp.gov.ae/en/services-details/?serviceid=64afe3c1035448005bd52e60",
      display: "icp.gov.ae",
    },
    {
      label: "Dubai General Directorate of Residency and Foreigners Affairs (GDRFA)",
      url: "https://www.gdrfad.gov.ae/en/services/f9e586fe-0642-11ec-0320-0050569629e8",
      display: "gdrfad.gov.ae",
    },
    {
      label: "UAE Official Government Portal — Tourist Visa",
      url: "https://u.ae/en/information-and-services/visa-and-emirates-id/tourist-visa",
      display: "u.ae",
    },
  ],

  price: {
    etaLabel: "Apply now, get it by",
    etaValue: "18 Jun 2026, 12:00 PM",
    title: "e-Visa · UAE Tourist",
    saving: "Faster than applying direct",
    sub: "All-inclusive of government fee, document review, and on-time guarantee.",
    foot: "Government fee and VIZA processing are collected together at checkout, backed by our on-time guarantee.",
  },

  aiPlaceholder: "Ask anything about UAE visas — entry rules, extensions, eligible nationalities…",
};

export default unitedArabEmirates;
