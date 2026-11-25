import type { DestinationContent } from "./types";

/**
 * France Schengen short-stay visa (type C) for people living in Singapore (embassy visa, framed "from
 * Singapore"). Singapore and Malaysian passports are visa exempt. Chinese, Indian, Indonesian, Philippine and
 * Vietnamese passports apply on France-Visas and lodge at VFS Global in Singapore. Links to the Schengen hub
 * at /visa/schengen for the rules shared by all Schengen countries.
 *
 * Checked 25 Nov 2026 against the France-Visas Singapore page (via search summary of the page: residents of
 * Singapore lodge in Singapore at VFS Global by appointment, new address from 2 Jun 2026, fee of EUR 34 per
 * application payable in SGD), the Schengen hub page of this site (EU Visa Code, EU travel site, EES, ETIAS),
 * and the 5 Jul 2026 check kept in the older version of this file. france-visas.gouv.fr and visa.vfsglobal.com
 * returned HTTP 403 to the fetcher, so re-open these before a publish:
 *   - https://france-visas.gouv.fr/en/singapour
 *   - https://visa.vfsglobal.com/sgp/en/fra/
 *   - https://www.france-visas.gouv.fr/en/visa-de-court-sejour
 * Not confirmed on an official page this session (kept general or left out):
 *   - the VFS Global service fee for France in Singapore (the EUR 34 on France-Visas is the "basic application
 *     fee" per search summary; the copy says VFS lists its own extras)
 *   - France's daily means of subsistence thresholds (not quoted)
 *   - the processing time for Singapore (copy uses the EU Visa Code figures of 15 days, up to 45)
 *   - the ETIAS start date (the EU has announced none) and that it will cover Singapore
 *   - biometric reuse for 59 months (older version) and the extension fee (older version), so both are left out
 *   - approval rates (never quoted)
 */
export const france: DestinationContent = {
  slug: "france",

  heroTitle: "France visa from Singapore",
  lede: "A France visa from Singapore depends on your passport. Singapore and Malaysian passports enter France visa free for up to 90 days in any 180. If you live in Singapore on a Chinese, Indian, Indonesian, Philippine or Vietnamese passport, you need a Schengen visa from France, which you apply for on France-Visas and lodge at the visa centre in Singapore. A France visa also covers the other Schengen countries, so read the Schengen visa hub as well if France is not your only stop.",
  heroImage: "/assets/heroes/france.jpg",
  meta: [
    { k: "Singapore passport", v: "Visa free, 90 days in 180" },
    { k: "Visa fee", v: "EUR 90 adult" },
    { k: "Lodge at", v: "VFS Global Singapore" },
    { k: "Checked", v: "25 Nov 2026" },
  ],
  tags: [
    { icon: "shield", label: "Free VIZA service" },
    { icon: "doc", label: "Document check" },
    { icon: "plane", label: "Schengen visa" },
  ],

  page: {
    framing: "singapore",

    glance: {
      needVisa: "Not for Singapore or Malaysian passports. Yes for Chinese, Indian, Indonesian, Philippine and Vietnamese passports",
      govFee: "EUR 90 adult, EUR 45 child 6 to 11, free under 6. Plus a visa centre fee",
      processing: "15 days, up to 45 in some cases. Apply no earlier than 6 months ahead",
      maxStay: "90 days in any 180, across all Schengen countries",
      checked: "25 November 2026",
    },

    passports: {
      intro: "The passport decides the rule. Singapore PR and pass holders follow the rules for the passport they hold. The EU keeps the list of visa exempt nationalities, and the table shows the ones most common in Singapore.",
      rows: [
        { passport: "Singapore", status: "Visa free, 90 days in 180", note: "No visa for tourism or short business. The EU travel authorisation called ETIAS is not in operation yet, and the EU has not announced a start date." },
        { passport: "China (PRC)", status: "Visa required", note: "Chinese passport holders who live in Singapore lodge their France application in Singapore." },
        { passport: "Malaysia", status: "Visa free, 90 days in 180", note: "Malaysia is also on the visa exempt list." },
        { passport: "India", status: "Visa required", note: "Apply for a France visa if France is your main destination. Show your Singapore pass as proof of residence." },
        { passport: "Indonesia", status: "Visa required", note: "The same process and the same documents as other visa-required passports." },
        { passport: "Philippines", status: "Visa required", note: "The same process. Residents of Singapore lodge in Singapore." },
        { passport: "Vietnam", status: "Visa required", note: "The same process. Check the France-Visas checklist for your case." },
        { passport: "Other passports", status: "Check the EU list", note: "The EU keeps the visa exempt list. If your passport is not on it, you need a visa." },
      ],
    },

    visaTypes: {
      intro: "France issues short-stay visas for visits and long-stay visas for living there. Most people in Singapore travelling for a holiday use the short-stay visa.",
      items: [
        { title: "Short-stay visa (type C)", body: "For tourism, family visits and short business trips, for up to 90 days in any 180. It is valid in all Schengen countries. The fee is EUR 90 for adults." },
        { title: "Single or multiple entry", body: "A first-time applicant usually gets the entries and dates for the trip. Frequent travellers with a clean record can ask for a longer multiple-entry visa." },
        { title: "Airport transit", body: "For passing through the international area of a French airport without entering France. Some passports need it and some do not." },
        { title: "Long-stay visa", body: "Study, work and stays over 90 days use a French national visa, with a separate process. Students first complete the Campus France step before lodging." },
      ],
    },

    residents: {
      intro: "France-Visas says residents of Singapore lodge their application in Singapore, by appointment. You apply with the passport you hold, and your pass shows that you live here.",
      rows: [
        { pass: "Employment Pass", body: "Bring your EP card, an employment letter with your role, salary and approved leave, and 3 months of bank statements. Keep the pass valid for at least 3 months after you return." },
        { pass: "S Pass", body: "Bring your S Pass card, the employment letter and 3 months of bank statements. The checklist matches the Employment Pass." },
        { pass: "Dependant's Pass", body: "Bring your Dependant's Pass and a copy of the main holder's pass. Add the marriage or birth certificate and the main holder's bank statements with a support letter if they pay." },
        { pass: "Permanent Resident", body: "Bring your PR card or re-entry permit and proof of your work or business in Singapore. You apply with the passport of your own country, and the Singapore visa free rule does not apply to you." },
        { pass: "Singapore citizen", body: "No visa. Carry a passport that is valid for your stay and expect to register in the EU Entry and Exit System at the border." },
        { pass: "Student's Pass", body: "Bring your Student's Pass and a school letter with your leave dates. A parent can support the trip with a letter and their bank statements." },
      ],
    },

    fees: {
      intro: "The EU sets the visa fee and you pay it with your application. The visa centre charges its own fees on top. VIZA's help is free.",
      rows: [
        { item: "Adult visa fee", amount: "EUR 90", note: "Set by EU law. It is not refunded if the visa is refused." },
        { item: "Child 6 to 11", amount: "EUR 45", note: "Children under 6 pay nothing." },
        { item: "Application fee at the Singapore centre", amount: "EUR 34", note: "The France-Visas Singapore page lists it per application, paid in Singapore dollars. Not refundable." },
        { item: "Optional visa centre services", amount: "Set by VFS Global", note: "VFS Global lists its own extras on its France page." },
        { item: "Travel insurance", amount: "Paid to the insurer", note: "Minimum EUR 30,000 of cover, for the whole stay and all Schengen countries." },
      ],
      processing: "A decision normally takes 15 days and can take up to 45 in some cases. You apply no earlier than 6 months before you travel and, as a rule, no later than 15 days before. Fingerprints are taken when you lodge. Aim for 6 to 8 weeks ahead in busy months, and book your appointment early.",
    },

    apply: {
      intro: "Check that France is the right country first. Apply to the country where you spend the most days, and to the one where you first enter if you split the time evenly. For several countries, see the Schengen visa hub.",
      guided: {
        title: "Guided",
        body: "VIZA's AI walks you through the France-Visas form and the checklist for your pass type. You book the appointment and lodge at the visa centre yourself.",
      },
      fullService: {
        title: "Full-service",
        body: "A VIZA consultant prepares your form, itinerary, insurance and bank statements, so you arrive at the visa centre with a file that matches the France checklist.",
      },
      steps: [
        { title: "Confirm the country", body: "France must be your main destination or your first entry. If you visit several countries, read the Schengen hub first." },
        { title: "Complete France-Visas", body: "Fill in the online form on the France-Visas site and print the summary. Prepare the passport, photo, insurance and bookings." },
        { title: "Book and lodge", body: "Book an appointment at the visa centre in Singapore and attend in person. You give fingerprints and hand in the file." },
        { title: "Wait and collect", body: "The French embassy decides, and you collect your passport. Do not book non-refundable flights before the decision." },
      ],
    },

    checklist: {
      intro: "The EU sets a core list and France adds its own. The list below is the common core. Always compare it with the France-Visas checklist before you lodge.",
      groups: [
        {
          applicant: "Everyone",
          items: [
            "France-Visas form, completed online and signed",
            "Passport valid at least 3 months after you leave, with 2 blank pages",
            "Recent photo that meets the Schengen standard",
            "Flight reservation and accommodation for the whole stay",
            "Travel insurance of at least EUR 30,000 for all Schengen countries",
            "Bank statements for the last 3 months",
          ],
        },
        {
          applicant: "Employment Pass and S Pass",
          items: [
            "Pass card, copy of both sides, valid at least 3 months after you return",
            "Employment letter and leave approval",
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
            "PR card and a re-entry permit that covers the trip",
            "Proof of work or business in Singapore",
            "Personal bank statements",
          ],
        },
        {
          applicant: "Student",
          items: [
            "Student's Pass and a school letter with leave dates",
            "Parent's support letter with their bank statements",
          ],
        },
      ],
    },

    travel: {
      intro: "A few EU systems changed in the last year. They affect how you cross the border, not how you apply.",
      items: [
        { title: "Entry and Exit System", body: "The EES has been fully operational at EU external borders since 10 April 2026. First-time visitors have a face photo and sometimes fingerprints taken, and passports are not stamped." },
        { title: "ETIAS", body: "ETIAS is a travel authorisation for visa exempt visitors. It is not in operation yet, and the EU will announce the start date ahead of time." },
        { title: "No arrival card", body: "France has no paper or digital arrival card. Border police may ask for your return ticket, funds, insurance and where you stay." },
        { title: "Insurance", body: "Cover of at least EUR 30,000 for the whole stay and all Schengen countries is a condition of the visa." },
        { title: "The 90 in 180 rule", body: "Days in all Schengen countries count together. Plan your stay within the dates on the visa." },
      ],
    },

    reviewed: {
      date: "25 November 2026",
      note: "Checked against France-Visas, the EU Visa Code and the EU travel site. Fees and rules change, so look at the links under Sources before you pay.",
    },

    related: {
      destinations: ["schengen", "italy", "united-kingdom", "turkiye"],
      guides: [
        { label: "Schengen visa document checklist from Singapore", href: "/guides/schengen-visa-checklist-singapore" },
        { label: "VIZA Schengen visa hub: rules shared by all Schengen countries", href: "/visa/schengen" },
        { label: "EU Entry and Exit System, how it works", href: "https://travel-europe.europa.eu/ees/ltr/how-does-the-ees-work" },
        { label: "VIZA visa news", href: "/blog" },
      ],
    },
  },

  rejectionTitle: "Common rejection reasons",
  rejectionSub: "The EU Visa Code lists the grounds for refusal. These are the grounds that matter most for a tourist application, and a consultant checks them before you lodge.",
  rejectionReasons: [
    { title: "Purpose of the trip is not clear", body: "The embassy needs a clear reason for the visit. An itinerary that does not explain the days is a common weakness." },
    { title: "Not enough funds", body: "You must show means for the whole stay and for the return. Thin statements or last-minute deposits raise doubt." },
    { title: "No valid insurance", body: "A policy under EUR 30,000, one that starts late or one that does not cover all Schengen countries is refused." },
    { title: "Doubt about leaving", body: "Weak ties to Singapore, such as a short pass or no employment letter, can raise doubt that you will return." },
    { title: "Unreliable bookings or documents", body: "Bookings that cannot be confirmed, or documents the embassy cannot trust, are a ground for refusal and can affect future applications." },
    { title: "Earlier Schengen record", body: "An earlier overstay or an alert in the Schengen system needs an explanation." },
  ],

  faqSub: "Can't find your answer? Ask the AI assistant below or message a VIZA consultant.",
  faq: [
    { category: "Do I need a visa", q: "Do Singaporeans need a visa for France?", a: "No. Singapore passports enter France visa free for up to 90 days in any 180. The EU travel authorisation called ETIAS is not in operation yet, and the EU has not announced a start date." },
    { category: "Do I need a visa", q: "Do Chinese passport holders living in Singapore need a France visa?", a: "Yes. You apply for a Schengen visa from France, and residents of Singapore lodge the application in Singapore." },
    { category: "Do I need a visa", q: "Do Malaysians in Singapore need a France visa?", a: "No. Malaysia is on the EU visa exempt list for stays up to 90 days in any 180." },
    { category: "Do I need a visa", q: "Do Indians, Indonesians, Filipinos and Vietnamese in Singapore need a France visa?", a: "Yes. Each applies for a Schengen visa from France if France is the main destination." },
    { category: "Applying in Singapore", q: "How do I apply for a France visa in Singapore?", a: "Complete the form on France-Visas, book an appointment at the visa centre in Singapore and attend in person with your documents. Fingerprints are taken at the centre." },
    { category: "Applying in Singapore", q: "Where is the France visa centre in Singapore?", a: "France-Visas lists VFS Global in Singapore, by appointment only. The centre moved on 2 June 2026, so check the France-Visas page for the current address before you go." },
    { category: "Applying in Singapore", q: "Can I use a France visa for other countries?", a: "Yes. A French short-stay visa is valid in all Schengen countries, as long as France is your main destination or your first entry. Read the Schengen visa hub for the shared rules." },
    { category: "Applying in Singapore", q: "When should I apply?", a: "No earlier than 6 months and, as a rule, no later than 15 days before you travel. Aim for 6 to 8 weeks ahead in busy months." },
    { category: "Fees and time", q: "How much is a France visa from Singapore?", a: "The visa fee is EUR 90 for adults and EUR 45 for children from 6 to 11, free under 6. France-Visas lists an application fee of EUR 34 at the Singapore centre, paid in Singapore dollars." },
    { category: "Fees and time", q: "How long does a France visa take?", a: "Normally 15 days, and up to 45 days in some cases. Fingerprints are taken when you lodge." },
    { category: "Documents", q: "Do I need travel insurance?", a: "Yes. Minimum cover is EUR 30,000 for the whole stay and all Schengen countries." },
    { category: "Rejections", q: "What happens if my France visa is refused?", a: "You receive a notice with the reason. The visa fee is not refunded. Review the reason with a consultant before you apply again." },
    { category: "Before you travel", q: "How much does VIZA charge?", a: "Nothing. VIZA's help is free. You pay the visa fee and the centre fees directly." },
  ],

  sources: [
    { label: "France-Visas, short-stay visa", url: "https://www.france-visas.gouv.fr/en/visa-de-court-sejour", display: "france-visas.gouv.fr" },
    { label: "France-Visas, Singapore submission location", url: "https://france-visas.gouv.fr/en/singapour", display: "france-visas.gouv.fr" },
    { label: "VFS Global, France visas, Singapore", url: "https://visa.vfsglobal.com/sgp/en/fra/", display: "visa.vfsglobal.com" },
    { label: "EU home affairs, applying for a Schengen visa", url: "https://home-affairs.ec.europa.eu/policies/schengen/schengen-visas/applying-schengen-visa_en", display: "home-affairs.ec.europa.eu" },
    { label: "EU Visa Code, Regulation 810/2009", url: "https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:02009R0810-20200202", display: "eur-lex.europa.eu" },
    { label: "EU travel site, ETIAS", url: "https://travel-europe.europa.eu/en/etias", display: "travel-europe.europa.eu" },
    { label: "EU travel site, Entry and Exit System", url: "https://travel-europe.europa.eu/ees/faq", display: "travel-europe.europa.eu" },
  ],

  price: {
    etaLabel: "Decision",
    etaValue: "15 days, up to 45",
    title: "France Schengen short-stay visa · up to 90 days",
    sub: "VIZA's help is free: form preparation and document review. The visa fee is paid with your application.",
    foot: "VIZA's service is free. The visa fee and the centre fees are paid directly to the issuing authority and the visa centre.",
  },

  aiPlaceholder: "Ask anything about a France visa from Singapore: fees, documents, VFS, Schengen…",
};

export default france;
