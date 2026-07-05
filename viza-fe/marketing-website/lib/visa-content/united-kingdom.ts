import type { VisaContent } from "./types";

/**
 * United Kingdom Standard Visitor Visa.
 *
 * Last fact-checked: 2026-07-05 against gov.uk, visa-fees.homeoffice.gov.uk,
 * visas-immigration.service.gov.uk, and homeofficemedia.blog.gov.uk:
 *   - Standard Visitor 6-month fee GBP 135 (SGD 240) · 2 yr GBP 506 (SGD 900)
 *     · 5 yr GBP 903 (SGD 1,607) · 10 yr GBP 1,128 (SGD 2,007) — 8 Apr 2026 rates.
 *   - Singapore passports are ETA-only (GBP 20, required since 8 Jan 2025);
 *     PRC passports are visa nationals and NOT ETA-eligible.
 *   - Decision usually within 3 weeks of biometrics; priority ~5 working days
 *     (+GBP 500), super priority ~1 working day (+GBP 1,000) where offered.
 *   - In-country extension only up to 6 months total stay, fee GBP 1,172.
 *   - Overstay: no daily fine — re-entry bans under Part Suitability (SUI 12.1,
 *     since 11 Nov 2025); ≤30-day voluntary own-expense departure disregarded.
 *
 * Items needing ops confirmation:
 *   - The 2016 UK–China 2-year-visa-for-6-month-fee arrangement no longer
 *     appears on the Home Office fee calculator — treat as discontinued
 *     unless UKVI confirms otherwise.
 *   - SGD ≈ 35 for the ETA is derived from the Home Office's implied SGD/GBP
 *     rate (240/135); the ETA itself is charged in GBP.
 *   - 6-month visas are listed "single or multiple entry" — issuance is at
 *     Home Office discretion.
 *   - Priority / super-priority availability varies by country — confirm with
 *     VFS for Singapore/China at time of application.
 */
export const unitedKingdom: VisaContent = {
  slug: "united-kingdom",

  heroTitle: "United Kingdom Standard Visitor Visa",
  lede: "The Standard Visitor visa admits visa nationals to the UK for up to 6 months for tourism, family visits, or business meetings. Singapore passport holders skip the visa entirely — they need only the GBP 20 UK ETA, and VIZA handles both routes end-to-end.",
  heroImage: "/assets/heroes/united-kingdom.jpg",
  meta: [
    { k: "Type", v: "Standard Visitor" },
    { k: "Length of stay", v: "Up to 6 months" },
    { k: "Validity", v: "6 months · 2–10 yr options" },
    { k: "Entry", v: "Multiple" },
  ],
  tags: [
    { icon: "bolt", label: "Fast track · consultant-guided" },
    { icon: "shield", label: "On-time guarantee" },
    { icon: "doc", label: "Full document check" },
  ],

  overviewTitle: "United Kingdom, at a glance",
  overviewSub:
    "The Standard Visitor visa (GBP 135 / SGD 240 for 6 months) covers tourism, family visits, and business meetings, with long-term multi-entry options of 2, 5, or 10 years. Singapore passport holders don't need it — they travel on the UK Electronic Travel Authorisation (ETA) instead.",
  glance: [
    { icon: "globe", k: "Capital", v: "London", sub: "UTC +0 / BST in summer" },
    { icon: "clock", k: "Best time to visit", v: "May – Sep", sub: "Mild weather · longest daylight" },
    { icon: "currency", k: "Currency", v: "Pound Sterling (GBP)", sub: "GBP 1 ≈ SGD 1.78 (Home Office rate)" },
    { icon: "pin", k: "Top destinations", v: "London · Edinburgh · Manchester", sub: "Plus the Cotswolds, Bath, and the Lake District" },
  ],

  processTitle: "How the application process works",
  processSub:
    "Submit once. We prepare your UKVI online application, book your biometric appointment, and track the decision — usually issued within 3 weeks of biometrics.",
  steps: [
    {
      title: "Apply on VIZA",
      body: "Share your travel dates, passport, and supporting documents up to 3 months before travel. We complete the official UKVI form at visas-immigration.service.gov.uk — including accommodation, trip cost, address history, and income details.",
    },
    {
      title: "Your documents are verified",
      body: "Your VIZA consultant cross-checks that bank statements, employer letters, and home-ties evidence all match the figures declared on the form — the discrepancy check UKVI caseworkers run first.",
    },
    {
      title: "Biometrics & UKVI processing",
      body: "You attend a short VFS Global appointment for fingerprints and a facial photo — no photo upload needed. We then monitor the UKVI queue; priority (~5 working days, +GBP 500) and super priority (~1 working day, +GBP 1,000) are available where offered.",
      statusRows: [
        { label: "Application submitted to UKVI", ts: "12 Jun, 9:00 AM", onTime: true },
        { label: "Biometrics enrolled at VFS Global", ts: "13 Jun, 11:30 AM", onTime: true },
        { label: "Awaiting UKVI decision", ts: "In progress" },
      ],
    },
    {
      title: "Get your visa decision on 3 Jul, 2:00 PM",
      body: "Your passport comes back with the visa vignette inside. Your consultant confirms the start and end dates and briefs you on what Border Force may ask at arrival.",
      delivered: true,
    },
  ],

  docsTitle: "Required documents",
  docsSub:
    "Your VIZA consultant double-checks every document against UKVI's supporting-documents guide before submission. Re-uploads are unlimited and free.",
  documents: [
    { name: "Valid passport", sub: "Valid for your entire UK stay · one blank page for the vignette" },
    { name: "Completed UKVI online application", sub: "Travel dates, UK accommodation, trip cost, address history, income — we fill it for you" },
    { name: "Bank statements / proof of funds", sub: "Must show origin of funds and match declared income · nothing over 1 year old, no credit card statements" },
    { name: "Proof of employment or study", sub: "Employer letter on letterhead with role, salary, and start date · or enrolment letter · or business registration if self-employed" },
    { name: "Evidence of ties to home country", sub: "Employment, property, family — supports the genuine-visitor requirement (V4.2)" },
    { name: "Travel history", sub: "Previous passports showing past trips · do NOT include hotel or flight bookings" },
    { name: "Certified translations", sub: "Any non-English document needs a signed, dated translator's confirmation" },
    { name: "Biometrics appointment", sub: "Fingerprints + photo captured at a VFS Global centre — no photo upload" },
  ],

  rejectionTitle: "Why Standard Visitor applications get refused",
  rejectionSub:
    "UKVI caseworkers assess every application against the genuine-visitor rules. VIZA flags these risks before you submit.",
  rejectionReasons: [
    { title: "Not a genuine visitor", body: "The most common refusal: weak family, social, or economic ties to home, or vague travel plans, leave the caseworker unconvinced you'll depart the UK (Visitor rules V4.2)." },
    { title: "Insufficient or unexplained funds", body: "Statements that don't show where the money came from, large unexplained recent deposits, or balances inconsistent with your declared income and trip cost." },
    { title: "Documents contradict the form", body: "Supporting documents must correlate with the finances, employment, and income written on the online application — any discrepancy triggers refusal." },
    { title: "Poor immigration history", body: "Previous refusals, overstays, or breaches anywhere — including frequent back-to-back UK visits that suggest you're living in the UK through visits." },
    { title: "False documents or deception", body: "Any deception results in refusal and normally a 10-year re-entry ban." },
    { title: "Prohibited activities", body: "Evidence of intent to work, access private medical treatment without permission, or marry without a Marriage Visitor visa." },
  ],

  entryTitle: "Entry & exit regulations",
  entrySub:
    "The UK has no arrival card — digital or paper. Carriers check your visa or ETA before boarding, and a visa or ETA does not guarantee entry: Border Force makes the final call at the desk.",
  entryExit: [
    { icon: "refresh", k: "Entry", v: "Multiple", sub: "Up to 6 months per entry — including on long-term visas and ETAs" },
    { icon: "doc", k: "Arrival card", v: "None required", sub: "No digital arrival card and no paper landing card" },
    { icon: "plane", k: "At the border", v: "eGates or officer", sub: "Singapore ETA holders use ePassport eGates (age 10+, no stamp); visa nationals see a Border Force officer" },
    { icon: "shield", k: "Carry evidence", v: "Funds · stay · return travel", sub: "No fixed amount is set, but officers can ask and refuse entry if unsatisfied" },
  ],

  extensionTitle: "Visa extension & overstays",
  extensionSub:
    "You can extend online from inside the UK before your permission expires, but only up to 6 months' total stay as a general visitor (longer only for medical, academic, or clinical cases). There is no daily overstay fine — the penalty is a re-entry ban.",
  extension: [
    { icon: "extend", k: "Extension", v: "Up to 6 months total", sub: "GBP 1,172 (≈ SGD 2,080) · biometrics at UKVCAS · decision usually within 8 weeks" },
    { icon: "alert", k: "Overstay penalty", v: "Re-entry ban, 1–10 years", sub: "No ban if you leave voluntarily within 30 days at your own expense; 10 years for deception or enforced removal" },
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
      q: "Do Singapore passport holders need a UK visa?",
      a: "No. Singapore is a non-visa national country — you can visit for up to 6 months without a visa. Since 8 January 2025, however, every Singaporean traveller (including infants) needs a UK Electronic Travel Authorisation (ETA): GBP 20 (≈ SGD 35), approved usually within 1 day, valid 2 years or until your passport expires, with unlimited trips of up to 6 months each. VIZA files the ETA for you and checks the details before you fly.",
    },
    {
      category: "General information",
      q: "Who needs the Standard Visitor visa, and can I work on it?",
      a: "Visa nationals — including PRC (mainland China) passport holders, who are not ETA-eligible — must obtain a Standard Visitor visa before travel. It covers tourism, family visits, and business meetings for up to 6 months per entry, but does not permit paid work, private medical treatment without permission, or marrying without a Marriage Visitor visa.",
    },
    {
      category: "Application process",
      q: "How much does the UK visa cost?",
      a: "From 8 April 2026: GBP 135 (SGD 240 at the Home Office's official Singapore price) for the 6-month Standard Visitor visa. Long-term multi-entry visas cost GBP 506 (SGD 900) for 2 years, GBP 903 (SGD 1,607) for 5 years, and GBP 1,128 (SGD 2,007) for 10 years — each still limited to 6 months per stay. The ETA for Singapore passports is GBP 20.",
    },
    {
      category: "Application process",
      q: "How long does UK visa processing take?",
      a: "A decision usually arrives within 3 weeks of your biometric appointment. Where offered, priority service cuts this to about 5 working days (+GBP 500) and super priority to about 1 working day (+GBP 1,000). ETAs are usually decided within 1 day — allow up to 3 working days, and you must receive the approval email before travelling.",
    },
    {
      category: "Application process",
      q: "Do I need to attend a biometric appointment?",
      a: "Yes — visa applicants give fingerprints and a facial photo at a VFS Global visa application centre; there's no photo upload. Mainland Chinese applicants can attend any of 15 VFS centres in China (including Beijing, Shanghai, Guangzhou, and Shenzhen), and China-passport residents of Singapore can use the VFS Global UK centre in Singapore. ETA applicants skip this entirely — just a passport scan and selfie in the UK ETA app.",
    },
    {
      category: "Refunds, rejections & reapplications",
      q: "What happens if my UK visa application is refused?",
      a: "UKVI retains the application fee on refusal, and you receive a notice explaining the grounds. VIZA's processing fee is fully refunded, and your consultant reviews the refusal — most commonly the genuine-visitor or funds grounds — to strengthen a reapplication.",
    },
  ],

  sources: [
    { label: "Visit the UK as a Standard Visitor — GOV.UK", url: "https://www.gov.uk/standard-visitor", display: "gov.uk" },
    { label: "Apply for a Standard Visitor visa — GOV.UK", url: "https://www.gov.uk/standard-visitor/apply-standard-visitor-visa", display: "gov.uk" },
    { label: "Guide to supporting documents — GOV.UK", url: "https://www.gov.uk/government/publications/visitor-visa-guide-to-supporting-documents/guide-to-supporting-documents-visiting-the-uk", display: "gov.uk" },
    { label: "Get an ETA to visit the UK — GOV.UK", url: "https://www.gov.uk/eta/apply", display: "gov.uk" },
    { label: "Official visa fee calculator (Singapore, SGD)", url: "https://visa-fees.homeoffice.gov.uk/y/singapore/sgd/visit/all", display: "visa-fees.homeoffice.gov.uk" },
    { label: "Online visa application portal", url: "https://visas-immigration.service.gov.uk/apply-visa-type/visit", display: "visas-immigration.service.gov.uk" },
  ],

  price: {
    etaLabel: "Apply now, target decision by",
    etaValue: "3 Jul 2026, 02:00 PM",
    title: "Standard Visitor Visa · up to 6 months",
    saving: "Consultant-guided · fewer delays",
    sub: "All-inclusive of UKVI application fee, document review, biometric appointment booking, and on-time guarantee.",
    foot: "UKVI application fee and VIZA processing are collected together at checkout, backed by our on-time guarantee.",
  },

  aiPlaceholder: "Ask anything about UK visitor visas — documents, processing times, eligibility…",
};

export default unitedKingdom;
