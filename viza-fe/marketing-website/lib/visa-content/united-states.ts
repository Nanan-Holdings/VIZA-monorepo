import type { VisaContent } from "./types";

/**
 * United States B1/B2 Visitor Visa.
 *
 * This is NOT the ESTA/Visa Waiver Program. B1/B2 is a consular-issued visa
 * requiring a DS-160 (ceac.state.gov/genniv) and an in-person embassy
 * interview booked via ustraveldocs.com/sg. Singapore and PRC (mainland
 * China) passports both receive 10-year, multiple-entry B1/B2 visas under
 * the reciprocity schedule, with no issuance fee beyond the USD 185 MRV fee.
 * Singapore passports can usually skip the visa entirely: VWP/ESTA covers
 * stays of 90 days or less (USD 40, valid 2 years). PRC 10-year visa holders
 * must additionally enrol in EVUS (USD 30) before each period of travel.
 *
 * Last fact-checked: 2026-07-05 against travel.state.gov, ceac.state.gov,
 * esta.cbp.dhs.gov, cbp.gov, evus.gov, uscis.gov, federalregister.gov and
 * ustraveldocs.com.
 *
 * Items needing ops confirmation:
 *   - USD 250 "Visa Integrity Fee": enacted 4 Jul 2025 (PL 119-21) but NOT
 *     yet collected and absent from the travel.state.gov fee schedule as of
 *     mid-2026. Monitor before quoting total costs.
 *   - CPI-adjusted 2026 amounts for ESTA (USD 40.27) and EVUS (USD 30.75)
 *     come from secondary sources — the official checkout is authoritative.
 *   - Post-interview passport return in Singapore ("about 1 week") is
 *     ustraveldocs guidance and varies case by case.
 *   - SGD conversions use ≈ 1.30 SGD/USD (mid-2026) — refresh periodically.
 *   - Whether the temporary USD 750 expedited-interview service (1 Jul –
 *     31 Dec 2026, interview within 10 business days at selected posts)
 *     is offered at the Singapore post was not confirmed.
 */
export const unitedStates: VisaContent = {
  slug: "united-states",

  heroTitle: "U.S. B1/B2 Visitor Visa",
  lede: "The consular U.S. visitor visa for tourism, family visits, and business trips — 10-year validity and multiple entry for Singapore and Chinese passport holders, up to 6 months per stay. VIZA prepares your DS-160, books the interview, and coaches you end-to-end. Staying under 90 days on a Singapore passport? We'll file your ESTA instead.",
  heroImage: "/assets/heroes/united-states.jpg",
  meta: [
    { k: "Type", v: "B1/B2" },
    { k: "Length of stay", v: "Up to 6 months per entry" },
    { k: "Validity", v: "10 years" },
    { k: "Entry", v: "Multiple" },
  ],
  tags: [
    { icon: "shield", label: "Interview prep included" },
    { icon: "doc", label: "DS-160 review" },
    { icon: "bolt", label: "Priority scheduling" },
  ],

  overviewTitle: "United States, at a glance",
  overviewSub:
    "The B1/B2 visa covers tourism, family or friend visits, medical treatment, and short-term business activities — no work authorisation included. Singapore passports staying 90 days or less qualify for ESTA (USD 40) instead; Chinese passports always need the visa, plus EVUS enrolment before travel.",
  glance: [
    { icon: "globe", k: "Capital", v: "Washington, D.C.", sub: "UTC −5 to −10 (varies by state)" },
    { icon: "clock", k: "Best time to visit", v: "May – Sep", sub: "Varies widely by region" },
    { icon: "currency", k: "Government fee", v: "USD 185 (≈ SGD 240)", sub: "MRV fee · non-refundable · no reciprocity fee for SG or PRC" },
    { icon: "pin", k: "Top destinations", v: "New York · Los Angeles · San Francisco", sub: "Plus Chicago, Las Vegas, Miami, Hawaii" },
  ],

  processTitle: "How the B1/B2 visa process works",
  processSub:
    "A DS-160 online application plus an in-person interview at the U.S. Embassy Singapore. Interview slots are currently under 2 weeks out and passports return in about a week — VIZA prepares every form and tracks each step. The embassy advises applying at least 3 months before travel.",
  steps: [
    {
      title: "Apply on VIZA",
      body: "Share your travel history, employment details, and purpose of visit. We build your DS-160 draft — including the mandatory social-media disclosure — and check every answer against consular guidance.",
    },
    {
      title: "DS-160 submitted & interview booked",
      body: "Your VIZA consultant finalises the DS-160 on ceac.state.gov, arranges the USD 185 MRV fee payment via ustraveldocs.com, and secures the earliest interview slot at the U.S. Embassy Singapore — currently under 2 weeks' wait.",
    },
    {
      title: "Interview preparation & tracking",
      body: "We send personalised interview coaching, likely question sets, and a document checklist. Ten-print fingerprints and a photo are taken at the interview. On the day, we're on standby for any last-minute queries.",
      statusRows: [
        { label: "DS-160 confirmed & interview booked", ts: "3 Jul, 10:15 AM", onTime: true },
        { label: "Interview coaching pack delivered", ts: "3 Jul, 2:00 PM", onTime: true },
        { label: "Interview scheduled — 10 Jul", ts: "In progress" },
      ],
    },
    {
      title: "Passport returned with visa on 17 Jul",
      body: "After a successful interview, processing typically takes about 1 week before your passport is returned with the 10-year B1/B2 visa. Your VIZA consultant confirms delivery and explains entry conditions — and handles EVUS enrolment for Chinese passport holders.",
      delivered: true,
    },
  ],

  docsTitle: "Required documents",
  docsSub:
    "Your VIZA consultant reviews every document for completeness and consistency before interview day. Re-uploads are unlimited and free.",
  documents: [
    { name: "Valid passport", sub: "Singapore & PRC passports: valid for the duration of stay (Six-Month Club exemption) · at least one blank page" },
    { name: "DS-160 confirmation page", sub: "Barcode page printed or saved · completed via ceac.state.gov · includes social-media disclosure" },
    { name: "Digital photo", sub: "600×600 to 1200×1200 px · white background · taken within 6 months · no eyeglasses" },
    { name: "MRV fee receipt & appointment letter", sub: "USD 185 paid via ustraveldocs.com/sg · interview confirmation for the U.S. Embassy Singapore" },
    { name: "Financial evidence (recommended)", sub: "Bank statements, payslips, or sponsorship letter showing funds for the trip" },
    { name: "Ties to home country (recommended)", sub: "Employment letter, property, or family documentation proving intent to return — the key §214(b) factor" },
  ],

  rejectionTitle: "Why B1/B2 applications get refused",
  rejectionSub:
    "U.S. consular officers apply a presumption of immigrant intent. VIZA coaches you to address these risk factors before interview day.",
  rejectionReasons: [
    { title: "Failure to demonstrate non-immigrant intent — INA §214(b)", body: "The most common refusal: the officer isn't convinced you'll return home. Strong employment, property, family, and financial ties are essential. Not permanent — you can reapply when circumstances change, but the USD 185 fee is forfeited." },
    { title: "Incomplete application / administrative processing — INA §221(g)", body: "Missing documents or extra security vetting. You have one year to supply the requested items before a fresh application and fee are required. VIZA's pre-submission review prevents most 221(g) holds." },
    { title: "Fraud or misrepresentation — INA §212(a)(6)(C)(i)", body: "Any false statement or fake document triggers a permanent inadmissibility bar that requires a waiver. Never guess or embellish on the DS-160." },
    { title: "Prior unlawful presence — INA §212(a)(9)(B)", body: "A previous U.S. overstay of 180+ days triggers a 3-year re-entry bar; 1 year or more triggers a 10-year bar." },
    { title: "Insufficient funds / public charge — INA §212(a)(4)", body: "Inability to show funds for the trip — a particular focus for medical-treatment visits. Clear financial evidence resolves this." },
  ],

  entryTitle: "Entry & exit regulations",
  entrySub:
    "No arrival card is needed for the U.S. — an electronic I-94 record is created automatically for air and sea arrivals (check it at i94.cbp.dhs.gov). A visa doesn't guarantee entry: CBP officers photograph you, decide your admission length, and may ask for onward tickets, funds, and accommodation details.",
  entryExit: [
    { icon: "refresh", k: "Entry", v: "Multiple", sub: "10-year validity from issue for SG and PRC passports" },
    { icon: "clock", k: "Stay per entry", v: "Up to 6 months", sub: "Set by CBP on arrival · recorded on your electronic I-94" },
    { icon: "plane", k: "ESTA (SG passports)", v: "90 days max", sub: "Return/onward ticket required · not extendable" },
    { icon: "alert", k: "EVUS (PRC passports)", v: "Required before boarding", sub: "USD 30 at evus.gov · valid 2 years · airlines deny boarding without it" },
  ],

  extensionTitle: "Visa extension & overstays",
  extensionSub:
    "B1/B2 entrants can extend with USCIS by filing Form I-539 before the I-94 expires — USCIS recommends filing at least 45 days ahead. There's no daily overstay fine in the U.S.; the consequences are far heavier: your visa is automatically voided after even one day, and long overstays trigger multi-year re-entry bars. ESTA stays cannot be extended.",
  extension: [
    { icon: "extend", k: "Extension", v: "+ up to 6 months", sub: "Form I-539 · USD 420 online (≈ SGD 545) or USD 470 paper (≈ SGD 610)" },
    { icon: "alert", k: "Overstay penalty", v: "Visa void + entry bar", sub: "No daily fine · 180+ days → 3-year bar · 1+ year → 10-year bar · ESTA eligibility lost" },
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
      q: "Do Singapore passport holders even need a B1/B2 visa?",
      a: "Usually not. Singapore is a Visa Waiver Program member, so tourism or business stays of 90 days or less only need ESTA — USD 40 (≈ SGD 52) at esta.cbp.dhs.gov, valid 2 years, approved usually within minutes (allow 72 hours). You need the B1/B2 if you'll stay beyond 90 days, or if you're VWP-ineligible — for example travel to Cuba since 12 Jan 2021, to Iran, Iraq, North Korea, Libya, Somalia, Sudan, Syria or Yemen since 1 Mar 2011, or a prior ESTA denial or overstay. VIZA files whichever route fits your trip.",
    },
    {
      category: "General information",
      q: "What about Chinese (PRC) passport holders?",
      a: "Mainland Chinese passports always need a visa — there's no ESTA option. The good news: B1/B2 visas are issued with 10-year validity and multiple entry, with no reciprocity fee beyond the USD 185 MRV fee. Two PRC-specific rules apply: 10-year visa holders must enrol in EVUS (USD 30 at evus.gov, valid 2 years) before each period of travel, and PRC nationals residing in Singapore can interview at the U.S. Embassy Singapore with proof of residence status. VIZA handles both the application and EVUS enrolment.",
    },
    {
      category: "General information",
      q: "Can I work in the U.S. on a B1/B2 visa?",
      a: "No. The B1/B2 does not authorise employment or any form of paid work in the United States. B1 covers business meetings, conferences, and negotiations; B2 covers tourism, family visits, and medical treatment. Anyone receiving payment from a U.S. employer requires a different visa category.",
    },
    {
      category: "Application process",
      q: "How much does the B1/B2 visa cost?",
      a: "The government MRV fee is USD 185 (≈ SGD 240), non-refundable, with no extra issuance fee for Singapore or Chinese nationals. A USD 250 'Visa Integrity Fee' was enacted in July 2025 but is not yet being collected — VIZA monitors this and will flag any change before you pay. From July to December 2026 an optional USD 750 expedite fee guarantees an interview within 10 business days at selected posts.",
    },
    {
      category: "Application process",
      q: "How long does the entire B1/B2 process take?",
      a: "In Singapore the numbers are unusually good: interview slots are currently available in under 2 weeks (per travel.state.gov's Global Visa Wait Times), and passports are typically returned about 1 week after a successful interview — longer only if §221(g) administrative processing applies. The embassy still advises applying at least 3 months before travel. VIZA monitors slots daily and books the earliest one.",
    },
    {
      category: "Application process",
      q: "Do children need to attend the interview?",
      a: "Yes. Since September–October 2025, the U.S. State Department has eliminated nearly all interview waivers, including the age-based ones: children under 14 and applicants over 79 must now interview in person. The main surviving waiver is renewing a full-validity B1/B2 within 12 months of its expiry, for applicants who were 18 or older when it was issued. VIZA confirms whether your renewal qualifies.",
    },
    {
      category: "Refunds, rejections & reapplications",
      q: "What happens if I'm refused at the interview?",
      a: "The USD 185 MRV fee is non-refundable. The officer will cite the refusal ground — most commonly §214(b). VIZA reviews your file, identifies the weakness, and helps you build a stronger application; most applicants can reapply immediately once their circumstances have materially changed.",
    },
  ],

  sources: [
    { label: "U.S. Department of State — Visitor Visa (B1/B2)", url: "https://travel.state.gov/content/travel/en/us-visas/tourism-visit/visitor.html", display: "travel.state.gov" },
    { label: "DS-160 Online Nonimmigrant Visa Application (CEAC)", url: "https://ceac.state.gov/genniv/", display: "ceac.state.gov" },
    { label: "Apply for a U.S. Visa — Singapore (appointments)", url: "https://www.ustraveldocs.com/sg/sg-niv-appointmentschedule.asp", display: "ustraveldocs.com" },
    { label: "Fees for Visa Services (MRV USD 185)", url: "https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/fees/fees-visa-services.html", display: "travel.state.gov" },
    { label: "Visa Waiver Program & ESTA (Singapore, 90 days)", url: "https://travel.state.gov/content/travel/en/us-visas/tourism-visit/visa-waiver-program.html", display: "travel.state.gov" },
    { label: "Official ESTA Application", url: "https://esta.cbp.dhs.gov/", display: "esta.cbp.dhs.gov" },
    { label: "Official EVUS Enrollment (PRC 10-year visa holders)", url: "https://www.evus.gov/", display: "evus.gov" },
    { label: "USCIS — Form I-539 Extension of Stay", url: "https://www.uscis.gov/i-539", display: "uscis.gov" },
    { label: "USCIS — Unlawful Presence and Inadmissibility", url: "https://www.uscis.gov/laws-and-policy/other-resources/unlawful-presence-and-inadmissibility", display: "uscis.gov" },
    { label: "Visa Denials (§214(b), §221(g), §212(a))", url: "https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/visa-denials.html", display: "travel.state.gov" },
  ],

  price: {
    etaLabel: "Interview date target",
    etaValue: "10 Jul 2026, 09:00 AM",
    title: "U.S. B1/B2 Visa · 10-year validity",
    saving: "Expert prep included",
    sub: "All-inclusive of DS-160 review, interview coaching, and on-time guarantee.",
    foot: "MRV application fee and VIZA service fee are collected together at checkout.",
  },

  aiPlaceholder: "Ask anything about the U.S. B1/B2 visa — DS-160, ESTA, interviews, processing times…",
};

export default unitedStates;
