import type { DestinationContent } from "./types";

/**
 * Canada visitor visa (TRV) and eTA for people living in Singapore (embassy visa, framed "from Singapore").
 * Singapore passports are visa exempt and need an eTA when flying. Chinese, Malaysian, Indian, Indonesian and
 * Vietnamese passports need a visitor visa. Philippine passports need a visa unless they meet the eTA rule for
 * some visa-required nationals (a Canadian visitor visa in the last 10 years, or a valid US non-immigrant visa).
 *
 * Checked 25 Nov 2026 against canada.ca pages read on the day: apply for a visitor visa (fees CAD 100 and
 * CAD 85, documents, online portal, validity up to 10 years), the eTA "citizens from some visa-required
 * countries" page (Philippines eligible with conditions, Malaysia and Indonesia not), and the eTA apply page
 * (CAD 7, flying only, most approved within minutes). The IRCC entry requirements tool, the processing times
 * tool and the VFS Global Singapore pages were not readable, so some points come from the 5 Jul 2026 check
 * kept in the older version of this file.
 * Not confirmed on an official page this session (kept general or left out):
 *   - Singapore listed as visa exempt (the IRCC lists page was not readable; stable rule)
 *   - eTA validity of 5 years (older version; the page read did not state it)
 *   - processing times for visas lodged from Singapore (copy sends readers to the IRCC tool, no figure)
 *   - VFS Global Singapore as the biometrics centre and its service fee and appointment rule
 *   - how IRCC treats applicants who live in Singapore but hold another passport (the copy says to apply with
 *     your passport and show your Singapore status, and gives no promise)
 *   - extension fee of CAD 100 and restoration fee of CAD 246.25 (older version only)
 *   - rule that a visa's expiry is the last arrival date
 */
export const canada: DestinationContent = {
  slug: "canada",

  heroTitle: "Canada visa from Singapore",
  lede: "A Canada visa from Singapore depends on your passport. Singapore passports are visa exempt and need only an eTA when flying. If you live in Singapore on a Chinese, Malaysian, Indian, Indonesian or Vietnamese passport, you need a Canada tourist visa, which is a visitor visa applied for online with biometrics. This page covers the Canada visa application from Singapore: who needs a visa, fees, documents by pass type and the usual reasons for refusal.",
  heroImage: "/assets/heroes/canada.jpg",
  meta: [
    { k: "Singapore passport", v: "eTA when flying, CAD 7" },
    { k: "Visitor visa fee", v: "CAD 100 plus CAD 85 biometrics" },
    { k: "Apply", v: "Online, then biometrics" },
    { k: "Checked", v: "25 Nov 2026" },
  ],
  tags: [
    { icon: "shield", label: "Free VIZA service" },
    { icon: "doc", label: "Document check" },
    { icon: "bolt", label: "Visa and eTA" },
  ],

  page: {
    framing: "singapore",

    glance: {
      needVisa: "Not for Singapore passports (eTA when flying). Yes for Chinese, Malaysian, Indian, Indonesian and Vietnamese passports",
      govFee: "Visitor visa CAD 100 plus CAD 85 biometrics. eTA CAD 7",
      processing: "Set by IRCC and shown in its processing times tool. It varies by where your file is handled",
      maxStay: "Usually up to 6 months per visit, set by the border officer",
      checked: "25 November 2026",
    },

    passports: {
      intro: "The passport decides the rule. Singapore PR and pass holders follow the rules for the passport they hold. IRCC publishes the lists of visa exempt and visa required countries, and the table shows the ones most common in Singapore.",
      rows: [
        { passport: "Singapore", status: "No visa, eTA when flying", note: "Apply for an eTA before you fly. It costs CAD 7 and most applications are approved within minutes. Arriving by land or sea generally needs only a valid passport." },
        { passport: "China (PRC)", status: "Visitor visa required", note: "Chinese passport holders living in Singapore apply for a visitor visa and give biometrics." },
        { passport: "Malaysia", status: "Visitor visa required", note: "Malaysia is not on the list of countries whose citizens can use an eTA instead of a visa, so Malaysians apply for a visitor visa." },
        { passport: "India", status: "Visitor visa required", note: "Apply online for the visitor visa and give biometrics. IRCC publishes processing times by country." },
        { passport: "Indonesia", status: "Visitor visa required", note: "Indonesia is not on the eTA list for visa-required countries. Apply for a visitor visa." },
        { passport: "Philippines", status: "Visa, or eTA if you qualify", note: "Philippine passport holders can use an eTA instead of a visa when flying, if they held a Canadian visitor visa in the last 10 years or hold a valid US non-immigrant visa." },
        { passport: "Vietnam", status: "Visitor visa required", note: "Vietnam is not on the eTA list for visa-required countries. Apply for a visitor visa." },
        { passport: "Other passports", status: "Check the IRCC tool", note: "IRCC has an entry requirements tool that tells you whether you need a visa or an eTA for your passport." },
      ],
    },

    visaTypes: {
      intro: "Canada issues visitor documents by passport and purpose. Most people in Singapore travelling for a holiday, a family visit or a short business trip need one of the first two.",
      items: [
        { title: "Visitor visa (TRV)", body: "For tourism, family visits and short business trips. A visa can be valid for up to 10 years or until your passport or biometrics expire, whichever is first, and the officer may set a shorter date. Each visit is usually up to 6 months." },
        { title: "eTA", body: "An electronic travel authorisation for visa-exempt passports and some visa-required passports, when you fly to or through a Canadian airport. It costs CAD 7 and is linked to your passport." },
        { title: "Super Visa", body: "For parents or grandparents of a Canadian citizen or permanent resident. It allows stays of up to 5 years at a time, with multiple entries over up to 10 years." },
        { title: "Study, work and other permits", body: "Studying, working or living in Canada needs a different permit. Business visitors can stay for less than 6 months. Paid work and study are separate applications." },
      ],
    },

    residents: {
      intro: "You apply online with the passport you hold, and you give biometrics at a visa application centre in Singapore. Your pass shows that you live here, which helps the officer see your ties and your plan to return.",
      rows: [
        { pass: "Employment Pass", body: "Bring your EP card, an employment letter with your role, salary and approved leave, and 6 months of bank statements. This is the most common route for Chinese, Indian and Malaysian passport holders working in Singapore." },
        { pass: "S Pass", body: "Bring your S Pass card, the employment letter and 6 months of bank statements. The checklist matches the Employment Pass." },
        { pass: "Dependant's Pass", body: "Bring your Dependant's Pass and a copy of the main holder's pass. Add the marriage or birth certificate and the main holder's bank statements with a support letter." },
        { pass: "Permanent Resident", body: "Bring your PR card or re-entry permit and proof of your work or business in Singapore. You apply with the passport of your own country, and the Singapore eTA rule does not apply to you." },
        { pass: "Singapore citizen", body: "No visa. Apply for an eTA before you fly, and keep the passport you used. Entry by land or sea generally needs only a valid passport." },
        { pass: "Student's Pass", body: "Bring your Student's Pass and a school letter with your term dates. A parent can support the trip with a letter and their bank statements." },
      ],
    },

    fees: {
      intro: "IRCC sets every fee below and you pay it to IRCC. VIZA's help is free. Some applicants are exempt from part of the fees, so check the IRCC page for your case.",
      rows: [
        { item: "Visitor visa", amount: "CAD 100", note: "Per person. A family of 5 or more pays CAD 500 in total." },
        { item: "Biometrics", amount: "CAD 85", note: "Per person. A family pays up to CAD 170. First-time applicants pay it when they submit." },
        { item: "eTA", amount: "CAD 7", note: "Paid online right after you complete the form. Not refundable." },
        { item: "Visitor record (extension)", amount: "CAD 100", note: "Apply online before your stay ends. Check the IRCC page for the current fee." },
        { item: "Visa centre service fee", amount: "Set by the centre", note: "The centre in Singapore lists its own service fee when you book." },
      ],
      processing: "IRCC publishes processing times in an online tool, and the time depends on where your file is handled. Wait for your biometrics instruction letter, then book your appointment as soon as you can, because that avoids delays. Apply well before you book flights. An eTA is usually approved within minutes, and if IRCC asks for documents it emails you within 72 hours.",
    },

    apply: {
      intro: "Choose the route first. Singapore passports use the eTA. Every other passport uses the IRCC online portal and a biometrics appointment.",
      guided: {
        title: "Guided",
        body: "VIZA's AI walks you through the IRCC forms and the document list for your pass type. You submit on the IRCC portal and book the biometrics appointment yourself.",
      },
      fullService: {
        title: "Full-service",
        body: "A VIZA consultant prepares your forms, checks that your bank statements, letters and itinerary agree and prepares the file for upload.",
      },
      steps: [
        { title: "Check your route", body: "We confirm whether your passport needs a visa or an eTA, and whether your biometrics are still valid." },
        { title: "Prepare the file", body: "Gather your passport scan, photo, forms, itinerary, bank statements and employer letter. You need a scanner or a camera." },
        { title: "Submit on the IRCC portal", body: "Pay the visa fee and the biometrics fee online. Read the guide for the form before you start." },
        { title: "Give biometrics and wait", body: "After you get the biometrics letter, book the appointment in Singapore. IRCC decides, and your passport returns with the visa label if approved." },
      ],
    },

    checklist: {
      intro: "IRCC builds a personal checklist in the portal. The list below is the common core. Local visa offices can ask for more.",
      groups: [
        {
          applicant: "Everyone",
          items: [
            "Passport valid at least 6 months beyond your planned travel date",
            "Digital photo that meets the IRCC rules",
            "Itinerary with flights, accommodation or event registration",
            "Travel history",
            "Bank statements for the last 6 months",
          ],
        },
        {
          applicant: "Employment Pass and S Pass",
          items: [
            "Pass card, copy of both sides",
            "Employer letter with role, salary and approved leave",
            "Payslips and personal bank statements",
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
            "Personal bank statements",
          ],
        },
        {
          applicant: "Student",
          items: [
            "Student's Pass and a school letter with term dates",
            "Parent's support letter with their bank statements",
            "Letter authorising a minor to travel, if the child travels alone",
          ],
        },
      ],
    },

    travel: {
      intro: "The visa or eTA lets you travel. The border officer decides at the airport whether you can enter and for how long.",
      items: [
        { title: "eTA is for flying", body: "An eTA covers arrival by air. You do not need one to arrive by car, bus, train or boat, and you need a valid passport. A visa-required passport needs a visa for every mode of entry." },
        { title: "Border questions", body: "The officer may ask for your return ticket, funds and where you stay, and sets how long you can stay. A visa or eTA does not guarantee entry." },
        { title: "Length of stay", body: "Visits are usually up to 6 months. You can extend by applying online for a visitor record, ideally well before your stay ends." },
        { title: "Passport validity", body: "Your visa or eTA ends when your passport does. A longer passport gives you a longer visa." },
        { title: "Overstaying", body: "Leave within the time you were given. Losing status goes on your record and makes later visits harder." },
      ],
    },

    reviewed: {
      date: "25 November 2026",
      note: "Checked against canada.ca and IRCC. Fees and rules change, so look at the links under Sources before you pay.",
    },

    related: {
      destinations: ["united-states", "united-kingdom", "france", "japan"],
      guides: [
        { label: "Visas for Chinese passport holders in Singapore", href: "/guides/visas-chinese-passport-holders-singapore" },
        { label: "ETA vs visa: UK, Australia, Korea and Canada", href: "/guides/eta-vs-visa" },
        { label: "Visa refused: why it happens and how to reapply", href: "/guides/visa-refused-reapply" },
        { label: "Visa photo requirements by country", href: "/guides/visa-photo-requirements" },
        { label: "IRCC: entry requirements by country", href: "https://www.canada.ca/en/immigration-refugees-citizenship/services/visit-canada/entry-requirements-country.html" },
        { label: "VIZA visa news", href: "/blog" },
      ],
    },
  },

  rejectionTitle: "Common rejection reasons",
  rejectionSub: "IRCC officers decide each visitor application on its own file. These are the points a consultant checks first.",
  rejectionReasons: [
    { title: "Not clear you will leave", body: "The most common ground. Weak ties to Singapore or your home country, such as a short pass or no employment letter, make it harder to show you will go home." },
    { title: "Funds that are unexplained", body: "Statements that do not cover the trip, or large deposits just before you apply, raise questions about who pays and why." },
    { title: "Vague purpose of the visit", body: "No itinerary, dates that do not agree or an invitation letter without the host's status and address in Canada make the purpose unclear." },
    { title: "Incomplete application", body: "Missing forms, blank fields, documents that are not translated or skipped biometrics cause delays and refusals." },
    { title: "Wrong information", body: "A false statement or an undisclosed earlier refusal can lead to a ban on applying. Answer every question honestly." },
    { title: "Other grounds", body: "A criminal record, earlier immigration problems or medical or security grounds can also lead to refusal." },
  ],

  faqSub: "Can't find your answer? Ask the AI assistant below or message a VIZA consultant.",
  faq: [
    { category: "Do I need a visa", q: "Do Singaporeans need a visa for Canada?", a: "No. Singapore passport holders need only an eTA when flying to Canada, which costs CAD 7 and is usually approved within minutes. Arriving by land or sea generally needs only a valid passport." },
    { category: "Do I need a visa", q: "Do Chinese passport holders living in Singapore need a Canada visa?", a: "Yes. You apply for a visitor visa online and give biometrics. This is the Canada tourist visa from Singapore for Chinese passport holders." },
    { category: "Do I need a visa", q: "Do Malaysians in Singapore need a Canada visa?", a: "Yes. Malaysia is not on the list of countries whose citizens can use an eTA instead of a visa, so Malaysians apply for a visitor visa." },
    { category: "Do I need a visa", q: "Can Filipinos use an eTA for Canada?", a: "Sometimes. A Philippine passport holder can use an eTA when flying if they held a Canadian visitor visa in the last 10 years or hold a valid US non-immigrant visa. Otherwise a visitor visa is needed." },
    { category: "Applying in Singapore", q: "How do I apply for a Canada visa from Singapore?", a: "Apply online on the IRCC portal, pay the fees, wait for the biometrics letter and book your appointment in Singapore. Upload your documents with the application." },
    { category: "Applying in Singapore", q: "Where do I give biometrics in Singapore?", a: "At a visa application centre in Singapore. IRCC sends an instruction letter, and you book as soon as you can to avoid delays." },
    { category: "Applying in Singapore", q: "Do I need an invitation letter?", a: "Only for a visit to family or friends. IRCC lists an invitation letter among its recommended papers, and a family visit also needs proof of your relationship." },
    { category: "Fees and time", q: "How much is a Canada visitor visa?", a: "The visa costs CAD 100 per person and biometrics cost CAD 85 per person. A family of 5 or more pays CAD 500 for the visa and up to CAD 170 for biometrics." },
    { category: "Fees and time", q: "How long does a Canada visa take?", a: "IRCC publishes processing times in its online tool, and the time depends on where your file is handled. Check the tool before you plan your trip and wait for a decision before you book flights." },
    { category: "Fees and time", q: "How long is a Canada visitor visa valid?", a: "Up to 10 years, or until your passport or biometrics expire, whichever is first. The officer may set a shorter date, and each visit is usually up to 6 months." },
    { category: "Rejections", q: "What happens if my Canada visa is refused?", a: "IRCC sends a letter with the reason. The most common one is that the officer was not sure you would leave. Review it with a consultant before you apply again." },
    { category: "Before you travel", q: "Do I need an arrival card for Canada?", a: "No arrival card is needed. Be ready to show your return ticket, funds and where you stay at the border." },
    { category: "Before you travel", q: "How much does VIZA charge?", a: "Nothing. VIZA's help is free. You pay the IRCC fees directly." },
  ],

  sources: [
    { label: "IRCC, apply for a visitor visa", url: "https://www.canada.ca/en/immigration-refugees-citizenship/services/visit-canada/apply-visitor-visa.html", display: "canada.ca" },
    { label: "IRCC, entry requirements by country", url: "https://www.canada.ca/en/immigration-refugees-citizenship/services/visit-canada/entry-requirements-country.html", display: "canada.ca" },
    { label: "IRCC, eTA: how to apply", url: "https://www.canada.ca/en/immigration-refugees-citizenship/services/visit-canada/eta/apply.html", display: "canada.ca" },
    { label: "IRCC, eTA for citizens of some visa-required countries", url: "https://www.canada.ca/en/immigration-refugees-citizenship/services/visit-canada/eta/eligibility/eta-x.html", display: "canada.ca" },
    { label: "IRCC, check processing times", url: "https://www.canada.ca/en/immigration-refugees-citizenship/services/application/check-processing-times.html", display: "canada.ca" },
    { label: "IRCC, biometrics", url: "https://www.canada.ca/biometrics", display: "canada.ca" },
    { label: "IRCC, fee list", url: "https://ircc.canada.ca/english/information/fees/fees.asp", display: "ircc.canada.ca" },
    { label: "VFS Global, Canada visa in Singapore", url: "https://visa.vfsglobal.com/sgp/en/can/", display: "visa.vfsglobal.com" },
  ],

  price: {
    etaLabel: "Processing time",
    etaValue: "Set by IRCC",
    title: "Visitor visa · up to 10 years",
    sub: "VIZA's help is free: form preparation and document review. The visa and biometrics fees are paid to IRCC.",
    foot: "VIZA's service is free. Any Canada visa fee is paid directly to IRCC.",
  },

  aiPlaceholder: "Ask anything about a Canada visa from Singapore: eTA, fees, biometrics, documents…",
};

export default canada;
