import type { VisaContent } from "./types";

/**
 * United States B1/B2 Visitor Visa.
 *
 * This is NOT the ESTA/Visa Waiver Program. B1/B2 is a consular-issued visa
 * requiring DS-160 completion and an in-person embassy interview.
 * Validity is up to 10 years for many nationalities but varies by reciprocity
 * schedule — some nationalities receive shorter validities. Multiple entry,
 * up to 6 months per stay (determined by CBP at the port of entry).
 *
 * Last fact-checked: 2026-06-10 against travel.state.gov and uscis.gov.
 * Items needing ops confirmation:
 *   - Visa validity: stated as "up to 10 years (varies by nationality)" —
 *     the actual period is set by the State Dept reciprocity schedule per
 *     country. Ops must verify for each target market before publishing.
 *   - Interview waivers: age-based exemptions (under 14 / over 79) were
 *     eliminated effective 1 Sep 2025. The file now reflects current policy
 *     (all first-time applicants must interview; limited renewal waiver only).
 *   - DS-160 fee and interview wait times.
 *
 * Official sources:
 *   https://travel.state.gov (U.S. Department of State — Visitor Visas)
 *   https://ceac.state.gov (DS-160 Online Nonimmigrant Visa Application)
 *   https://www.uscis.gov (Unlawful Presence and I-539 extension)
 */
export const unitedStates: VisaContent = {
  slug: "united-states",

  heroTitle: "U.S. B1/B2 Visitor Visa",
  lede: "The standard U.S. visitor visa for tourism, family visits, and short business trips — up to 10-year validity for most nationalities, multiple entry, up to 6 months per stay. VIZA guides you through DS-160 preparation and interview readiness end-to-end.",
  heroImage: "/assets/heroes/united-states.jpg",
  meta: [
    { k: "Type", v: "B1/B2" },
    { k: "Length of stay", v: "Up to 6 months" },
    { k: "Validity", v: "Up to 10 years (varies by nationality)" },
    { k: "Entry", v: "Multiple" },
  ],
  tags: [
    { icon: "shield", label: "Interview prep included" },
    { icon: "doc", label: "DS-160 review" },
    { icon: "bolt", label: "Priority scheduling" },
  ],

  overviewTitle: "United States, at a glance",
  overviewSub:
    "The B1/B2 visa covers tourism, family or friend visits, medical treatment, and short-term business activities — no work authorisation included.",
  glance: [
    { icon: "globe", k: "Capital", v: "Washington, D.C.", sub: "UTC −5 to −10 (varies by state)" },
    { icon: "clock", k: "Best time to visit", v: "May – Sep", sub: "Varies widely by region" },
    { icon: "currency", k: "Currency", v: "U.S. Dollar (USD)", sub: "Cards accepted almost everywhere" },
    { icon: "pin", k: "Top destinations", v: "New York · Los Angeles · San Francisco", sub: "Plus Chicago, Las Vegas, Miami, Hawaii" },
  ],

  processTitle: "How the B1/B2 visa process works",
  processSub:
    "The U.S. visa requires a DS-160 online application plus an in-person interview. VIZA prepares every form, coaches you for the interview, and tracks your appointment.",
  steps: [
    {
      title: "Apply on VIZA",
      body: "Share your travel history, employment details, and purpose of visit. We build your DS-160 draft and check every answer against consular guidance.",
    },
    {
      title: "DS-160 reviewed & submitted",
      body: "Your VIZA consultant finalises the DS-160, books your MRV fee payment, and secures the earliest available interview slot at your nearest U.S. embassy or consulate.",
    },
    {
      title: "Interview preparation & tracking",
      body: "We send personalised interview coaching, likely question sets, and a document checklist. On interview day, we're on standby for any last-minute queries.",
      statusRows: [
        { label: "DS-160 confirmed & interview booked", ts: "3 Jul, 10:15 AM", onTime: true },
        { label: "Interview coaching pack delivered", ts: "3 Jul, 2:00 PM", onTime: true },
        { label: "Interview scheduled — 10 Jul", ts: "In progress" },
      ],
    },
    {
      title: "Passport returned with visa on 14 Jul",
      body: "After a successful interview, your passport is couriered back with the B1/B2 visa stamp. Your VIZA consultant confirms delivery and explains entry conditions.",
      delivered: true,
    },
  ],

  docsTitle: "Required documents",
  docsSub:
    "Your VIZA consultant reviews every document for completeness and consistency before interview day. Re-uploads are unlimited and free.",
  documents: [
    { name: "Valid passport", sub: "Valid 6+ months beyond intended stay · all previous passports" },
    { name: "DS-160 confirmation page", sub: "Barcode page printed or saved · completed via ceac.state.gov" },
    { name: "Financial evidence", sub: "Bank statements, payslips, or sponsorship letter (last 3 months)" },
    { name: "Ties to home country", sub: "Employment letter, property deed, or family documentation proving intent to return" },
  ],

  rejectionTitle: "Why B1/B2 applications get refused",
  rejectionSub:
    "U.S. consular officers apply a presumption of immigrant intent. VIZA coaches you to address these risk factors before interview day.",
  rejectionReasons: [
    { title: "Failure to demonstrate non-immigrant intent", body: "The most common refusal ground (INA §214(b)): the officer isn't convinced you intend to return home. Strong employment, family, and financial ties are essential." },
    { title: "Inconsistent or incomplete DS-160", body: "Errors, omissions, or answers that contradict your supporting documents raise red flags during the interview. VIZA's review catches these before submission." },
    { title: "Prior U.S. visa violations or overstays", body: "Any history of overstaying, working without authorisation, or misrepresentation on a prior application can result in a multi-year bar or permanent ineligibility." },
  ],

  entryTitle: "Entry & exit regulations",
  entrySub:
    "A B1/B2 visa stamp does not guarantee entry. Final admission and authorised length of stay are determined by U.S. Customs and Border Protection (CBP) at the port of entry.",
  entryExit: [
    { icon: "refresh", k: "Entry", v: "Multiple", sub: "Validity up to 10 years from issue date (nationality-dependent)" },
    { icon: "clock", k: "Stay per entry", v: "Up to 6 months", sub: "As authorised by CBP on arrival" },
  ],

  extensionTitle: "Visa extension & overstays",
  extensionSub:
    "A stay extension can be requested from USCIS before the I-94 expiry date. Overstaying — even by a single day — carries serious long-term consequences.",
  extension: [
    { icon: "extend", k: "Extension", v: "Apply to USCIS", sub: "File Form I-539 before I-94 expires" },
    { icon: "alert", k: "Overstay penalty", v: "Visa void + future bar", sub: "180+ days unlawful presence → 3-year bar; 1+ year → 10-year bar" },
  ],

  reviews: {
    score: "4.7",
    outOf: "/ 5",
    sub: "Trusted by travellers worldwide · 18,540 reviews",
    platforms: [
      { rating: "4.8", name: "Trustpilot" },
      { rating: "4.6", name: "App Store" },
    ],
    items: [
      {
        initials: "AW",
        name: "Amina Wanjiru",
        source: "Trustpilot · 1 week ago",
        title: "Interview prep made the difference",
        body: "I'd been refused once before. VIZA's mock interview questions and DS-160 review gave me the confidence I needed — approved first visit.",
      },
      {
        initials: "DC",
        name: "Daniel Chung",
        source: "App Store · 3 weeks ago",
        title: "DS-160 done in an afternoon",
        body: "The form is intimidating but the consultant walked me through every section. Appointment secured for the following week.",
      },
    ],
  },

  faqSub:
    "Can't find your answer? Ask the AI assistant below or message your VIZA consultant directly.",
  faq: [
    {
      category: "General information",
      q: "What is the B1/B2 visitor visa?",
      a: "The B1/B2 is a non-immigrant U.S. visa for temporary visits: B1 covers business activities (meetings, conferences, negotiations) and B2 covers tourism, leisure, and family visits. Most applicants receive a combined B1/B2 visa. This is separate from ESTA, which applies only to Visa Waiver Program countries.",
    },
    {
      category: "General information",
      q: "Can I work in the U.S. on a B1/B2 visa?",
      a: "No. The B1/B2 does not authorise employment or any form of paid work in the United States. Volunteers, interns, or anyone receiving payment from a U.S. employer requires a different visa category.",
    },
    {
      category: "Application process",
      q: "How long does the entire B1/B2 process take?",
      a: "The DS-160 takes 1 – 2 hours to complete accurately. Interview wait times vary by embassy from a few days to several weeks. After a successful interview, passport return typically takes 3 – 10 working days. VIZA monitors wait times and books the earliest available slot.",
    },
    {
      category: "Application process",
      q: "Do children need to attend the interview?",
      a: "As of September 2025, the U.S. State Department eliminated age-based interview waivers. All first-time B1/B2 applicants — including children under 14 and applicants over 79 — are now required to attend an in-person interview. A limited waiver may apply for certain visa renewals (within 12 months of the prior visa's expiry for applicants who were 18+ when the prior visa was issued). VIZA advises on the specific rules for your embassy and whether you qualify for a renewal waiver.",
    },
    {
      category: "Refunds, rejections & reapplications",
      q: "What happens if I'm refused at the interview?",
      a: "The MRV application fee is non-refundable. The officer will cite the refusal ground (commonly §214(b)). VIZA will review your file, identify the weakness, and help you build a stronger application — most applicants can reapply immediately unless given a specific waiting period.",
    },
  ],

  sources: [
    { label: "U.S. Department of State — Visitor Visa (B1/B2)", url: "https://travel.state.gov/content/travel/en/us-visas/tourism-visit/visitor.html", display: "travel.state.gov" },
    { label: "DS-160 Online Nonimmigrant Visa Application (CEAC)", url: "https://ceac.state.gov/genniv/", display: "ceac.state.gov" },
    { label: "USCIS — Unlawful Presence and Inadmissibility", url: "https://www.uscis.gov/laws-and-policy/other-resources/unlawful-presence-and-inadmissibility", display: "uscis.gov" },
  ],

  price: {
    etaLabel: "Interview date target",
    etaValue: "10 Jul 2026, 09:00 AM",
    title: "U.S. B1/B2 Visa · up to 10-year validity",
    saving: "Expert prep included",
    sub: "All-inclusive of DS-160 review, interview coaching, and on-time guarantee.",
    foot: "MRV application fee and VIZA service fee are collected together at checkout.",
  },

  aiPlaceholder: "Ask anything about the U.S. B1/B2 visa — DS-160, interviews, processing times…",
};

export default unitedStates;
