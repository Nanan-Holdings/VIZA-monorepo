import type { DestinationContent } from "./types";

/**
 * United Kingdom Standard Visitor visa for people living in Singapore (embassy visa, framed "from Singapore").
 * Singapore and Malaysian passports do not need a visa and use the UK Electronic Travel Authorisation (ETA).
 * Chinese, Indian, Indonesian, Philippine and Vietnamese passports are not ETA eligible and apply for the visa
 * online with UKVI, then give biometrics at a visa application centre.
 *
 * Checked 25 Nov 2026 against gov.uk (Standard Visitor, apply for a Standard Visitor visa, ETA eligibility).
 * The fee calculator, the VFS Global pages and the Home Office media blog were not readable on the day, so
 * those figures come from the 5 Jul 2026 check kept in the older version of this file.
 * Confirmed on gov.uk this session: GBP 135 for 6 months, GBP 506 / 903 / 1,128 for 2 / 5 / 10 years,
 * GBP 234 medical (11 months) and academic (12 months), GBP 74.50 transit, apply at most 3 months ahead,
 * decision usually within 3 weeks, ETA stay up to 6 months, Singapore and Malaysia ETA eligible, China, India,
 * Indonesia, Philippines and Vietnam not on the ETA list.
 * Not confirmed on an official page this session (kept general or left out):
 *   - ETA fee of GBP 20 from 8 Apr 2026 and the 2 year ETA validity (search summaries of gov.uk only)
 *   - SGD price for the 6 month visa (the older version quoted SGD 240 from the Home Office calculator)
 *   - priority and super priority fees and where they are offered, so none is quoted
 *   - VFS Global Singapore as a choice for UK visa biometrics for residents, and its service fees
 *   - the Home Office rule on applying from a country other than your own (gov.uk says the centre "could be in
 *     another country", so the copy tells residents to choose Singapore when they book)
 *   - current ETA decision time (copy says "usually quick")
 */
export const unitedKingdom: DestinationContent = {
  slug: "united-kingdom",

  heroTitle: "UK visa from Singapore",
  lede: "A UK visa from Singapore depends on your passport. Singapore and Malaysian passports do not need a visa and travel on an ETA for up to 6 months. If you live in Singapore on a Chinese, Indian, Indonesian, Philippine or Vietnamese passport, you need a Standard Visitor visa. This page covers the UK visa application in Singapore: the online form, the biometrics appointment, fees, documents by pass type and the usual reasons for refusal.",
  heroImage: "/assets/heroes/united-kingdom.jpg",
  meta: [
    { k: "Singapore passport", v: "ETA, up to 6 months" },
    { k: "Visa fee", v: "GBP 135 for 6 months" },
    { k: "Apply", v: "Online, then biometrics" },
    { k: "Checked", v: "25 Nov 2026" },
  ],
  tags: [
    { icon: "shield", label: "Free VIZA service" },
    { icon: "doc", label: "Document check" },
    { icon: "bolt", label: "Visa and ETA" },
  ],

  page: {
    framing: "singapore",

    glance: {
      needVisa: "Not for Singapore or Malaysian passports (ETA instead). Yes for Chinese, Indian, Indonesian, Philippine and Vietnamese passports",
      govFee: "GBP 135 for the 6 month Standard Visitor visa. The ETA is about GBP 20",
      processing: "Usually a decision within 3 weeks of applying, giving biometrics and sending your documents",
      maxStay: "Up to 6 months per visit",
      checked: "25 November 2026",
    },

    passports: {
      intro: "The passport decides the rule. Singapore PR and pass holders follow the rules for the passport they hold. The UK keeps one list of nationalities that can get an ETA, and everyone else applies for a visa.",
      rows: [
        { passport: "Singapore", status: "No visa, ETA needed", note: "Apply for an ETA in the UK ETA app before you fly. It lets you visit for up to 6 months." },
        { passport: "China (PRC)", status: "Visa required", note: "Chinese passports cannot get an ETA. Chinese passport holders living in Singapore apply for the Standard Visitor visa." },
        { passport: "Malaysia", status: "No visa, ETA needed", note: "Malaysia is on the ETA list, so Malaysians living in Singapore apply for an ETA, not a visa." },
        { passport: "India", status: "Visa required", note: "Apply online for the Standard Visitor visa and give biometrics at a visa application centre." },
        { passport: "Indonesia", status: "Visa required", note: "Indonesia is not on the ETA list. Apply for the Standard Visitor visa." },
        { passport: "Philippines", status: "Visa required", note: "The Philippines is not on the ETA list. Apply for the Standard Visitor visa." },
        { passport: "Vietnam", status: "Visa required", note: "Vietnam is not on the ETA list. Apply for the Standard Visitor visa." },
        { passport: "Other passports", status: "Check GOV.UK", note: "GOV.UK has a tool that tells you whether you need a visa or an ETA. If your nationality cannot get an ETA, you need a visa." },
      ],
    },

    visaTypes: {
      intro: "The UK has several visitor visas. Most people in Singapore travelling for a holiday or to see family use the Standard Visitor visa.",
      items: [
        { title: "Standard Visitor, 6 months", body: "For tourism, family visits and short business meetings, for up to 6 months. The fee is GBP 135. This is the visa most applicants ask for." },
        { title: "Long-term Standard Visitor, 2, 5 or 10 years", body: "For frequent visitors. The fees are GBP 506 for 2 years, GBP 903 for 5 years and GBP 1,128 for 10 years. Each stay is still up to 6 months, and you apply with your travel history." },
        { title: "Medical and academic visitor", body: "A Standard Visitor visa for private medical treatment lasts up to 11 months, and one for academics lasts up to 12 months. Each costs GBP 234 and needs extra papers from the doctor, hospital or university." },
        { title: "Transit and other routes", body: "A Visitor in Transit visa costs GBP 74.50 and covers passing through the UK. Marriage, study and work use separate visas, and a Standard Visitor cannot take paid work or marry in the UK." },
      ],
    },

    residents: {
      intro: "You book the biometrics appointment as part of the online application, and the centre can be in another country. Residents of Singapore choose a centre in Singapore when they book. Your pass shows that you live here.",
      rows: [
        { pass: "Employment Pass", body: "Bring your EP card, an employment letter with your role, salary and approved leave, and recent bank statements. This is the most common route for Chinese and Indian passport holders working in Singapore." },
        { pass: "S Pass", body: "Bring your S Pass card, the employment letter and bank statements. The checklist matches the Employment Pass." },
        { pass: "Dependant's Pass", body: "Bring your Dependant's Pass and a copy of the main holder's pass. Add the marriage or birth certificate and the main holder's bank statements with a letter if they pay for the trip." },
        { pass: "Permanent Resident", body: "Bring your PR card or re-entry permit and proof of your work or business in Singapore. You apply with the passport of your own country, and the Singapore ETA rule does not apply to you." },
        { pass: "Singapore citizen", body: "No visa. Apply for an ETA, carry the same passport you used in the application and enter through the e-passport gates where available." },
        { pass: "Student's Pass", body: "Bring your Student's Pass and a school letter with your term dates. A parent can support the trip with a letter and their bank statements." },
      ],
    },

    fees: {
      intro: "The UK government sets the visa fee and you pay it to UK Visas and Immigration. VIZA's help is free. Each family member needs their own application, fee and appointment.",
      rows: [
        { item: "Standard Visitor visa, 6 months", amount: "GBP 135", note: "The fee on GOV.UK. You pay it online when you apply." },
        { item: "Long-term visa, 2 years", amount: "GBP 506", note: "Each stay is still up to 6 months." },
        { item: "Long-term visa, 5 years", amount: "GBP 903", note: "Each stay is still up to 6 months." },
        { item: "Long-term visa, 10 years", amount: "GBP 1,128", note: "Each stay is still up to 6 months." },
        { item: "Medical or academic visitor", amount: "GBP 234", note: "Up to 11 months for medical treatment, up to 12 months for academics." },
        { item: "Electronic Travel Authorisation (ETA)", amount: "About GBP 20", note: "For Singapore and Malaysian passports. The ETA app shows the exact fee." },
        { item: "Visa centre service charges", amount: "Set by the centre", note: "The centre lists its own service fee and optional extras when you book." },
      ],
      processing: "UKVI says you usually get a decision within 3 weeks of applying, proving your identity and sending your documents. You can apply no earlier than 3 months before you travel. Faster decisions are offered in some cases for an extra fee, so check the booking page. An ETA is usually quick, and you need the approval email before you fly.",
    },

    apply: {
      intro: "Choose the route first. Singapore and Malaysian passports use the ETA app. Every other passport uses the online visa form and a biometrics appointment.",
      guided: {
        title: "Guided",
        body: "VIZA's AI walks you through the UKVI form and the document list for your pass type. You complete the form, book the appointment and attend yourself.",
      },
      fullService: {
        title: "Full-service",
        body: "A VIZA consultant prepares your answers, checks that your bank statements, employment letter and form agree and prepares the file for your appointment.",
      },
      steps: [
        { title: "Check your route", body: "We confirm whether your passport needs a visa or an ETA, and the dates you can apply." },
        { title: "Complete the online form", body: "Fill in the UKVI application with your travel dates, accommodation, trip cost, address history and income." },
        { title: "Give biometrics", body: "Book a visa application centre in Singapore. You give fingerprints and a photo, show your passport and hand in your documents." },
        { title: "Wait for the decision", body: "UKVI decides and your passport comes back. Do not book non-refundable flights before the decision." },
      ],
    },

    checklist: {
      intro: "The UK asks for a core list and checks that your documents match the form. Always compare with the latest GOV.UK guide to supporting documents before you submit.",
      groups: [
        {
          applicant: "Everyone",
          items: [
            "Passport valid for your whole stay",
            "Travel dates, accommodation and an estimate of the trip cost",
            "Home address and address history",
            "Bank statements that show where your money comes from",
            "Travel history for the last 10 years, if you have it",
            "Certified translation of any document not in English or Welsh",
          ],
        },
        {
          applicant: "Employment Pass and S Pass",
          items: [
            "Pass card, copy of both sides",
            "Employment letter with role, salary and approved leave",
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
          ],
        },
      ],
    },

    travel: {
      intro: "The visa or ETA lets you travel. Border Force decides at the desk whether you can enter.",
      items: [
        { title: "No arrival card", body: "The UK has no paper or digital arrival card. Airlines check your visa or ETA before boarding." },
        { title: "Border questions", body: "Be ready to show where you stay, how you pay for the trip and your return ticket. A visa or ETA does not guarantee entry." },
        { title: "ETA for Singapore passports", body: "Apply in the UK ETA app with your passport and a selfie. The ETA lets you stay up to 6 months per visit." },
        { title: "What a visitor cannot do", body: "A visitor cannot work, claim benefits, marry or live in the UK through repeated visits. Permitted paid engagements are the exception and need their own papers." },
        { title: "Overstaying", body: "Leave within the time you were given. Overstays can lead to a ban on coming back." },
      ],
    },

    reviewed: {
      date: "25 November 2026",
      note: "Checked against GOV.UK. Fees and rules change, so look at the links under Sources before you pay.",
    },

    related: {
      destinations: ["france", "schengen", "united-states", "canada"],
      guides: [
        { label: "Visa-free countries for Singapore passport holders", href: "/guides/visa-free-countries-singapore-passport" },
        { label: "Visas for Chinese passport holders in Singapore", href: "/guides/visas-chinese-passport-holders-singapore" },
        { label: "Visas for Filipino and Indian residents of Singapore", href: "/guides/visas-filipino-indian-residents-singapore" },
        { label: "ETA vs visa: UK, Australia, Korea and Canada", href: "/guides/eta-vs-visa" },
        { label: "Visa refused: why it happens and how to reapply", href: "/guides/visa-refused-reapply" },
        { label: "Visa photo requirements by country", href: "/guides/visa-photo-requirements" },
        { label: "GOV.UK: guide to supporting documents for visitors", href: "https://www.gov.uk/government/publications/visitor-visa-guide-to-supporting-documents/guide-to-supporting-documents-visiting-the-uk" },
        { label: "VIZA visa news", href: "/blog" },
      ],
    },
  },

  rejectionTitle: "Common rejection reasons",
  rejectionSub: "UKVI checks every visitor application against the genuine visitor rules. These are the points a consultant checks first.",
  rejectionReasons: [
    { title: "Not clear you will leave", body: "A short time in Singapore, no employment letter or vague plans make it harder to show you will go home after the visit." },
    { title: "Funds that are unexplained", body: "Statements that do not show where the money came from, or large deposits just before you apply, raise questions." },
    { title: "Documents do not match the form", body: "The income, job and trip cost on the form need to agree with your letters and statements. A mismatch is a common reason for refusal." },
    { title: "Immigration history", body: "Earlier refusals, overstays or frequent long visits to the UK need a clear explanation." },
    { title: "False or unreliable documents", body: "Any document that cannot be trusted leads to refusal and can lead to a long ban on applying." },
    { title: "Plans that a visitor cannot do", body: "Evidence that you plan to work, marry or get private medical care without the right visa is a ground for refusal." },
  ],

  faqSub: "Can't find your answer? Ask the AI assistant below or message a VIZA consultant.",
  faq: [
    { category: "Do I need a visa", q: "Do Singaporeans need a UK visa?", a: "No. Singapore passport holders visit the UK for up to 6 months with an ETA, which costs about GBP 20 and is applied for in the UK ETA app before you fly." },
    { category: "Do I need a visa", q: "Do Chinese passport holders living in Singapore need a UK visa?", a: "Yes. China is not on the ETA list, so you apply for the Standard Visitor visa online and give biometrics at a visa application centre." },
    { category: "Do I need a visa", q: "Do Malaysians in Singapore need a UK visa?", a: "No. Malaysia is on the ETA list, so you apply for an ETA before you travel." },
    { category: "Do I need a visa", q: "Do Indian, Indonesian, Philippine and Vietnamese passport holders need a UK visa?", a: "Yes. None of these passports can get an ETA, so each applies for the Standard Visitor visa." },
    { category: "Applying in Singapore", q: "How do I apply for a UK visa in Singapore?", a: "Complete the online UKVI form, pay the fee, then book an appointment at a visa application centre and choose Singapore. You give fingerprints and a photo and hand in your documents." },
    { category: "Applying in Singapore", q: "Do I need a biometrics appointment?", a: "Yes, for the visa. You give fingerprints and a photo at the centre and show your passport. The ETA does not need an appointment." },
    { category: "Applying in Singapore", q: "When can I apply?", a: "No earlier than 3 months before you travel. UKVI usually decides within 3 weeks of applying, giving biometrics and sending your documents." },
    { category: "Applying in Singapore", q: "Can I apply for the whole family together?", a: "Each family member needs their own application, fee and appointment. You can book them close together." },
    { category: "Fees and time", q: "How much is a UK visa from Singapore?", a: "GBP 135 for the 6 month Standard Visitor visa. Long-term visas cost GBP 506 for 2 years, GBP 903 for 5 years and GBP 1,128 for 10 years." },
    { category: "Fees and time", q: "Can I get a longer UK visa?", a: "Yes. Frequent visitors can apply for a 2, 5 or 10 year visa. Each stay is still up to 6 months, and you apply with your travel history." },
    { category: "Rejections", q: "What happens if my UK visa is refused?", a: "UKVI sends a notice with the reasons. Review them with a consultant before you apply again, because a new application should answer each point." },
    { category: "Before you travel", q: "Can I work in the UK on a Standard Visitor visa?", a: "No. A visitor cannot take work, claim benefits or marry. Permitted paid engagements are the exception and need their own papers." },
    { category: "Before you travel", q: "How much does VIZA charge?", a: "Nothing. VIZA's help is free. You pay the UK government fee directly." },
  ],

  sources: [
    { label: "GOV.UK, Standard Visitor visa", url: "https://www.gov.uk/standard-visitor", display: "gov.uk" },
    { label: "GOV.UK, apply for a Standard Visitor visa", url: "https://www.gov.uk/standard-visitor/apply-standard-visitor-visa", display: "gov.uk" },
    { label: "GOV.UK, guide to supporting documents", url: "https://www.gov.uk/government/publications/visitor-visa-guide-to-supporting-documents/guide-to-supporting-documents-visiting-the-uk", display: "gov.uk" },
    { label: "GOV.UK, check when you can get an ETA", url: "https://www.gov.uk/guidance/check-when-you-can-get-an-electronic-travel-authorisation-eta", display: "gov.uk" },
    { label: "GOV.UK, get an ETA to visit the UK", url: "https://www.gov.uk/eta/apply", display: "gov.uk" },
    { label: "UK visa fee calculator", url: "https://visa-fees.homeoffice.gov.uk/y/singapore/sgd/visit/all", display: "visa-fees.homeoffice.gov.uk" },
    { label: "UKVI online application", url: "https://visas-immigration.service.gov.uk/apply-visa-type/visit", display: "visas-immigration.service.gov.uk" },
  ],

  price: {
    etaLabel: "Decision time",
    etaValue: "Usually within 3 weeks",
    title: "Standard Visitor visa · up to 6 months",
    sub: "VIZA's help is free: form preparation and document review. The visa fee is paid to UK Visas and Immigration.",
    foot: "VIZA's service is free. Any UK visa fee is paid directly to UK Visas and Immigration.",
  },

  aiPlaceholder: "Ask anything about a UK visa from Singapore: ETA, fees, documents, biometrics…",
};

export default unitedKingdom;
