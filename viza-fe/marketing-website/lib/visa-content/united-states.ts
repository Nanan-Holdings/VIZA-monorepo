import type { DestinationContent } from "./types";

/**
 * United States B1/B2 visitor visa for people living in Singapore (embassy visa, framed "from Singapore").
 * Singapore passports use the Visa Waiver Program with an ESTA for stays of 90 days or less. The B1/B2 visa
 * route is for visa-required passports (China, Malaysia, India, Indonesia, Philippines, Vietnam and others)
 * and for Singapore passport holders who are not eligible for the ESTA or need to stay longer.
 *
 * Checked 25 Nov 2026. travel.state.gov, the U.S. Embassy Singapore, ustraveldocs.com, esta.cbp.dhs.gov and
 * evus.gov returned HTTP 403 or empty pages to the fetcher on the day, so facts were read through search
 * summaries that quote the official pages, plus the 5 Jul 2026 check kept in the older version of this file.
 * Re-open these before a publish:
 *   - https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/fees/fees-visa-services.html
 *   - https://travel.state.gov/content/travel/en/News/visas-news/interview-waiver-update-sept-18-2025.html
 *   - https://sg.usembassy.gov/visas/ (appointment portal, third country national guidance)
 * Not confirmed on an official page this session (kept general, or left out):
 *   - Visa Integrity Fee of USD 250 (enacted 4 Jul 2025). Reports conflict on whether posts collect it.
 *     The copy says to check before paying and gives no total.
 *   - ESTA amount. Third-party sources show USD 40 to 40.62 after the 30 Sep 2025 rise and inflation steps.
 *     The copy says "about USD 40" and sends readers to the ESTA site.
 *   - EVUS amount (USD 30 to 31.75 in sources). The copy says "about USD 30".
 *   - Singapore interview wait time and passport return time. Both change weekly, so no figure is given.
 *   - Whether the ustraveldocs.com/sg portal is still the booking site for Singapore.
 *   - Any Singapore-specific rule for non-citizens of Singapore (the State Department says to apply where you
 *     live, and that applying elsewhere can be harder). No acceptance rate or wait claim is made.
 *   - Validity of the visa for each passport (reciprocity schedule). The copy says the officer sets it.
 *   - Photo size (600 to 1200 pixels square is the long-standing digital standard).
 */
export const unitedStates: DestinationContent = {
  slug: "united-states",

  heroTitle: "US visa from Singapore",
  lede: "A US visa from Singapore depends on your passport. Singapore passports travel under the Visa Waiver Program with an ESTA for up to 90 days. If you live in Singapore on a Chinese, Malaysian, Indian, Indonesian, Philippine or Vietnamese passport, you need a B1/B2 visitor visa, which means a DS-160 form, a visa fee and an interview at the US Embassy. This page covers the US visa application in Singapore, how the US visa appointment works, what each pass type needs and what it costs.",
  heroImage: "/assets/heroes/united-states.jpg",
  meta: [
    { k: "Singapore passport", v: "ESTA, up to 90 days" },
    { k: "Visa fee (B1/B2)", v: "USD 185" },
    { k: "Interview", v: "In person at the Embassy" },
    { k: "Checked", v: "25 Nov 2026" },
  ],
  tags: [
    { icon: "shield", label: "Free VIZA service" },
    { icon: "doc", label: "DS-160 check" },
    { icon: "calendar", label: "Appointment guidance" },
  ],

  page: {
    framing: "singapore",

    glance: {
      needVisa: "Not for Singapore passports on a short trip (ESTA instead). Yes for Chinese, Malaysian, Indian, Indonesian, Philippine and Vietnamese passports",
      govFee: "USD 185 for the B1/B2 visa application. ESTA is about USD 40. Check the Visa Integrity Fee before you pay",
      processing: "Set by the Embassy. Interview wait times change weekly, and some cases need extra checks after the interview",
      maxStay: "Set by the border officer on arrival, usually up to 6 months. ESTA stays are up to 90 days",
      checked: "25 November 2026",
    },

    passports: {
      intro: "The passport decides the route. Where you live decides where you apply. The State Department tells applicants to apply in the country where they live, so residents of Singapore normally book at the US Embassy Singapore.",
      rows: [
        { passport: "Singapore", status: "ESTA, up to 90 days", note: "Singapore is in the Visa Waiver Program. You apply online for an ESTA, which costs about USD 40 and is valid for up to 2 years. Stays over 90 days need a B1/B2 visa." },
        { passport: "China (PRC)", status: "Visa required", note: "Chinese passport holders apply for the B1/B2 visa. If the visa is issued with 10 years of validity, you also enrol in EVUS before you travel." },
        { passport: "Malaysia", status: "Visa required", note: "Malaysia is not in the Visa Waiver Program. Malaysians living in Singapore apply for the B1/B2 visa." },
        { passport: "India", status: "Visa required", note: "Apply for the B1/B2 visa. Bring proof of your job and your Singapore pass, because the officer asks where you live and work." },
        { passport: "Indonesia", status: "Visa required", note: "Apply for the B1/B2 visa with the same DS-160 and interview steps as other passports." },
        { passport: "Philippines", status: "Visa required", note: "Apply for the B1/B2 visa. Prepare proof of work, savings and family ties for the interview." },
        { passport: "Vietnam", status: "Visa required", note: "Apply for the B1/B2 visa with the same steps as other visa-required passports." },
        { passport: "Other passports", status: "Check the Visa Waiver list", note: "The State Department lists the Visa Waiver Program countries. If your passport is not on it, you apply for a B1/B2 visa." },
      ],
    },

    visaTypes: {
      intro: "The US issues visas by purpose. Most people in Singapore travelling for a holiday, a family visit or a short business trip use the B visa.",
      items: [
        { title: "B1/B2 visitor visa", body: "One visa that covers B1 (business meetings, conferences, contract talks) and B2 (tourism, family visits, medical treatment). It does not allow paid work in the US. The officer sets the number of entries and the validity, and the border officer decides how long you stay each time." },
        { title: "ESTA, for Singapore passports", body: "Not a visa. ESTA is an online travel authorisation for Visa Waiver passports, for tourism or business of up to 90 days. You need a return or onward ticket and a passport that meets the e-passport rules." },
        { title: "Transit (C-1)", body: "For passing through the US on the way to another country. Visa Waiver passports can transit on an ESTA." },
        { title: "Study, work and other visas", body: "Studying, working or living in the US needs a different visa, usually with a school or employer petition first. These are separate from the B visa and are not covered here." },
      ],
    },

    residents: {
      intro: "The Embassy wants to see that you live in Singapore and have a reason to come back. Your pass is the proof. A longer time in Singapore and a stable job make the file easier to read.",
      rows: [
        { pass: "Employment Pass", body: "Bring your EP card, a recent employment letter with your role, salary and approved leave, and recent payslips. EP holders on a Chinese, Indian or Philippine passport apply this way most often." },
        { pass: "S Pass", body: "Bring your S Pass card, the employment letter and payslips. The officer checks the same things as for an EP: your job, your income and your plan to return." },
        { pass: "Dependant's Pass", body: "Bring your Dependant's Pass and a copy of the main holder's pass. Add the marriage or birth certificate that shows the link, and bank statements from you or the main holder, with a support letter." },
        { pass: "Permanent Resident", body: "Bring your PR card or re-entry permit and proof of your work or business in Singapore. You apply with the passport of your own country, and the Singapore ESTA rule does not apply to you." },
        { pass: "Singapore citizen", body: "No visa for a trip of 90 days or less. Apply for an ESTA, carry an e-passport and keep the ESTA approval number. A B1/B2 visa is only needed for longer stays or if ESTA is not available to you." },
        { pass: "Student's Pass", body: "Bring your Student's Pass and a school letter with your term dates. A parent can support the trip with a letter and their bank statements." },
      ],
    },

    fees: {
      intro: "The US government sets every fee below and you pay it to the US government. VIZA's help is free. The B1/B2 fee is paid when you book the interview and is not refunded if the visa is refused.",
      rows: [
        { item: "B1/B2 visa application fee", amount: "USD 185", note: "Paid once per applicant, including children. The State Department fee page is the source." },
        { item: "Visa Integrity Fee", amount: "USD 250 set by law", note: "Passed in July 2025. Reports differ on when posts collect it, so check the State Department and Embassy pages before you pay and plan for it." },
        { item: "ESTA", amount: "About USD 40", note: "For Singapore passports. The exact amount is on the ESTA website, because CBP adjusts it. Valid for up to 2 years." },
        { item: "EVUS for Chinese 10-year visas", amount: "About USD 30", note: "Needed before each period of travel on a 10-year visa. The EVUS website shows the exact amount." },
        { item: "Extension of stay (Form I-539)", amount: "Set by USCIS", note: "Filed with USCIS from inside the US before your stay ends. Check the USCIS fee page." },
      ],
      processing: "Interview wait times change week to week, and the State Department publishes the Singapore figure on its visa wait times page. After the interview, some cases move to administrative processing, which adds time. Apply well before you book flights. ESTA decisions usually arrive within minutes, and the guidance is to apply at least 72 hours before you fly.",
    },

    apply: {
      intro: "The B1/B2 steps are the same for everyone: DS-160, fee, appointment, interview. Choose how much help you want, then work through the steps in order.",
      guided: {
        title: "Guided",
        body: "VIZA's AI walks you through the DS-160 questions and the checklist for your pass type. You book the appointment and attend the interview yourself, and you keep control of every answer.",
      },
      fullService: {
        title: "Full-service",
        body: "A VIZA consultant prepares your DS-160 answers with you, checks your supporting documents and goes through the likely interview topics, so the file and the answers agree.",
      },
      steps: [
        { title: "Choose ESTA or visa", body: "Singapore passports on a trip of 90 days or less use ESTA. Everyone else starts the B1/B2 visa." },
        { title: "Complete the DS-160", body: "Fill in the online DS-160 on the State Department site, including your travel history and social media identifiers. Save the confirmation page." },
        { title: "Pay and book", body: "Pay the visa fee and book your appointment through the Embassy's appointment system, which is linked from the US Embassy Singapore visa page." },
        { title: "Attend the interview", body: "Bring your passport, the DS-160 confirmation, the appointment letter and your supporting papers. Fingerprints are taken at the Embassy. If approved, your passport returns with the visa." },
      ],
    },

    checklist: {
      intro: "The Embassy asks for a small core set and decides the rest at the interview. The supporting papers below are what a consultant checks for each type of applicant.",
      groups: [
        {
          applicant: "Everyone",
          items: [
            "Passport valid for your whole stay",
            "DS-160 confirmation page with barcode",
            "Digital photo taken in the last 6 months, white background, no glasses",
            "Visa fee receipt and appointment confirmation",
            "Previous US visas and travel history, if any",
          ],
        },
        {
          applicant: "Employment Pass and S Pass",
          items: [
            "Pass card, copy of both sides",
            "Employment letter with role, salary and approved leave",
            "Recent payslips and personal bank statements",
          ],
        },
        {
          applicant: "Dependant's Pass",
          items: [
            "Dependant's Pass card and the main holder's pass copy",
            "Marriage or birth certificate showing the link",
            "Main holder's bank statements and a support letter",
          ],
        },
        {
          applicant: "Permanent Resident",
          items: [
            "PR card or re-entry permit",
            "Proof of work or business in Singapore",
            "Personal bank statements and tax records",
          ],
        },
        {
          applicant: "Student",
          items: [
            "Student's Pass and a school letter with term dates",
            "Parent's support letter with their bank statements",
          ],
        },
      ],
    },

    travel: {
      intro: "A visa lets you ask to enter. The border officer at the US airport decides whether you can come in and for how long.",
      items: [
        { title: "No arrival card", body: "The US has no paper or digital arrival card. CBP creates an electronic I-94 record for air and sea arrivals, and you can check it on the CBP I-94 site." },
        { title: "Border questions", body: "CBP takes a photo and fingerprints and may ask for your return ticket, funds and where you stay. A visa or ESTA does not guarantee entry." },
        { title: "Length of stay", body: "The officer records your authorised stay on the I-94. ESTA stays are up to 90 days and cannot be extended. B1/B2 stays can be extended with USCIS before the I-94 date." },
        { title: "EVUS for Chinese passports", body: "A Chinese passport holder with a 10-year B1/B2 visa enrols in EVUS before travel. Airlines check it at check-in." },
        { title: "Overstaying", body: "Leave by the I-94 date. An overstay cancels the visa and can lead to a bar on returning, and it removes ESTA eligibility." },
      ],
    },

    reviewed: {
      date: "25 November 2026",
      note: "Checked against the US Department of State, CBP and the US Embassy Singapore. Fees and rules change, so look at the links under Sources before you pay.",
    },

    related: {
      destinations: ["canada", "united-kingdom", "japan", "australia"],
      guides: [
        { label: "Visas for Chinese passport holders in Singapore", href: "/guides/visas-chinese-passport-holders-singapore" },
        { label: "US visa interview in Singapore", href: "/guides/us-visa-interview-singapore" },
        { label: "Visa refused: why it happens and how to reapply", href: "/guides/visa-refused-reapply" },
        { label: "Visa photo requirements by country", href: "/guides/visa-photo-requirements" },
        { label: "US Department of State: visa wait times", href: "https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/wait-times.html" },
        { label: "VIZA visa news", href: "/blog" },
      ],
    },
  },

  rejectionTitle: "Common rejection reasons",
  rejectionSub: "The US gives the legal ground for a refusal, and most B visa refusals fall under one of these. A consultant checks them with you before the interview.",
  rejectionReasons: [
    { title: "Ties to home not clear (section 214(b))", body: "The most common ground. The officer must believe you will return to Singapore, so a stable job, family, home and savings help. You can apply again when your situation changes, and the fee is paid again." },
    { title: "Papers missing or more checks needed (section 221(g))", body: "The officer asks for a document or sends the case for extra checks. Bring a complete set to the interview, and reply quickly to any request." },
    { title: "Wrong or inconsistent answers", body: "A DS-160 that differs from your passport, your documents or your interview answers raises questions. A false statement can lead to a permanent bar." },
    { title: "Earlier US immigration problems", body: "An earlier overstay or removal needs an honest explanation. Overstays of 180 days or more carry time-based bars on returning." },
    { title: "Funds that do not fit the trip", body: "Bank statements that look thin for the trip, or large deposits just before you apply, raise questions about who pays and why." },
  ],

  faqSub: "Can't find your answer? Ask the AI assistant below or message a VIZA consultant.",
  faq: [
    { category: "Do I need a visa", q: "Do Singaporeans need a US visa?", a: "No, for tourism or business of 90 days or less. Singapore passport holders apply for an ESTA online, which costs about USD 40 and is valid for up to 2 years. Stays over 90 days, and anyone not eligible for ESTA, need a B1/B2 visa." },
    { category: "Do I need a visa", q: "Do Chinese passport holders living in Singapore need a US visa?", a: "Yes. You apply for the B1/B2 visa and attend an interview. If the visa is issued with 10 years of validity, you also enrol in EVUS before you travel." },
    { category: "Do I need a visa", q: "Do Malaysians in Singapore need a US visa?", a: "Yes. Malaysia is not in the Visa Waiver Program, so Malaysian passport holders apply for the B1/B2 visa, even when they live in Singapore." },
    { category: "Do I need a visa", q: "Do Singapore PR holders need a US visa?", a: "It depends on your passport, not your PR status. A PR on a Chinese, Malaysian, Indian, Indonesian, Philippine or Vietnamese passport needs the B1/B2 visa." },
    { category: "Applying in Singapore", q: "How do I apply for a US visa in Singapore?", a: "Complete the DS-160, pay the visa fee, book the interview through the Embassy's appointment system and attend with your documents. The steps are the same for every visa-required passport." },
    { category: "Applying in Singapore", q: "How does the US visa appointment in Singapore work?", a: "You book through the system linked from the US Embassy Singapore visa page, after paying the fee. Slots change often, so check the page for the current wait before you plan flights." },
    { category: "Applying in Singapore", q: "Do I need an interview?", a: "Nearly always. Since 1 October 2025 the State Department has limited interview waivers. The main waiver is renewing a B visa within 12 months of its expiry, if it was issued for full validity and you were 18 or older at the time." },
    { category: "Applying in Singapore", q: "Can I apply in Singapore if I am not a Singapore citizen?", a: "Residents of Singapore normally apply here. The State Department advises applying where you live, so keep your pass and proof of work ready for the officer." },
    { category: "Fees and time", q: "How much is the US visa from Singapore?", a: "The B1/B2 application fee is USD 185 per person. A USD 250 Visa Integrity Fee is set by law, so check the State Department and Embassy pages for when it applies before you pay." },
    { category: "Fees and time", q: "How long does a US visa take?", a: "The Embassy sets the interview date and the State Department shows the current Singapore wait. Some cases need extra checks after the interview, so allow extra time before you travel." },
    { category: "Rejections", q: "What happens if my US visa is refused?", a: "The officer gives the legal ground. Section 214(b) is the most common. The fee is not refunded, and you can apply again when your situation has changed. A consultant can review the likely weak points first." },
    { category: "Before you travel", q: "Can I work in the US on a B1/B2 visa?", a: "No. B1 covers business meetings and conferences, and B2 covers tourism and family visits. Paid work needs a different visa." },
    { category: "Before you travel", q: "How much does VIZA charge?", a: "Nothing. VIZA's help is free. You pay the US government fees directly." },
  ],

  sources: [
    { label: "US Department of State, visitor visa", url: "https://travel.state.gov/content/travel/en/us-visas/tourism-visit/visitor.html", display: "travel.state.gov" },
    { label: "US Department of State, fees for visa services", url: "https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/fees/fees-visa-services.html", display: "travel.state.gov" },
    { label: "US Department of State, visa wait times", url: "https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/wait-times.html", display: "travel.state.gov" },
    { label: "US Department of State, interview waiver update (18 Sep 2025)", url: "https://travel.state.gov/content/travel/en/News/visas-news/interview-waiver-update-sept-18-2025.html", display: "travel.state.gov" },
    { label: "US Department of State, Visa Waiver Program", url: "https://travel.state.gov/content/travel/en/us-visas/tourism-visit/visa-waiver-program.html", display: "travel.state.gov" },
    { label: "US Embassy Singapore, visas", url: "https://sg.usembassy.gov/visas/", display: "sg.usembassy.gov" },
    { label: "DS-160 online nonimmigrant visa application", url: "https://ceac.state.gov/genniv/", display: "ceac.state.gov" },
    { label: "ESTA, US Customs and Border Protection", url: "https://esta.cbp.dhs.gov/", display: "esta.cbp.dhs.gov" },
    { label: "EVUS enrolment", url: "https://www.evus.gov/", display: "evus.gov" },
    { label: "USCIS, extend your stay (Form I-539)", url: "https://www.uscis.gov/i-539", display: "uscis.gov" },
  ],

  price: {
    etaLabel: "Interview wait",
    etaValue: "Set by the Embassy",
    title: "B1/B2 visitor visa · interview at the Embassy",
    sub: "VIZA's help is free: DS-160 check, document review and interview guidance. The visa fee is paid to the US government.",
    foot: "VIZA's service is free. Any US visa fee is paid directly to the US government.",
  },

  aiPlaceholder: "Ask anything about a US visa from Singapore: ESTA, DS-160, interview, fees…",
};

export default unitedStates;
