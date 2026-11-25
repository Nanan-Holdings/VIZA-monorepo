import type { DestinationContent } from "./types";

/**
 * Schengen visa hub for people living in Singapore (embassy visa, framed "from Singapore"). Links to the France
 * and Italy pages, which have checkout. The hub itself is consult-only (no pricing row for a generic Schengen
 * country; see lib/countries.ts), so its CTA goes to /contact.
 *
 * Checked 25 Nov 2026 against the EU Visa Code (EUR-Lex), home-affairs.ec.europa.eu, travel-europe.europa.eu,
 * the Italian embassy in Singapore and the VFS Global country pages. Firecrawl was out of credits, so pages were
 * read in the browser pane.
 *
 * Not confirmed on an official page, so the copy hedges or leaves it out:
 *   - ETIAS start date (the EU says none is announced) and that it names Singapore (59 visa-exempt countries)
 *   - the provider for Belgium, Greece, Czechia, Poland and Hungary in Singapore (VFS pages were 404)
 *   - TLScontact in Singapore (no page found, so not mentioned)
 *   - service fees in SGD for VFS and BLS (France VFS lists EUR 34, payable in local currency)
 *   - per-pass rules for EP, S Pass and Dependant's Pass on France-Visas (only Italy's checklist was read)
 *   - any announced change to the EUR 90 fee
 *   - "29 countries" in the Schengen area and the standard passport rules (3 months beyond departure, issued in the last 10 years)
 */
export const schengen: DestinationContent = {
  slug: "schengen",

  heroTitle: "Schengen visa from Singapore",
  lede: "A Schengen visa from Singapore lets you visit 29 European countries on one short-stay visa, up to 90 days in any 180. Singapore passports do not need it. If you live in Singapore on a Chinese, Indian, Indonesian, Philippine, Thai or Vietnamese passport, you apply to one country's embassy through its visa centre in Singapore, and the country you choose depends on where you spend the most time. Start here, then go to France or Italy for the detail.",
  heroImage: "/assets/heroes/schengen.jpg",
  meta: [
    { k: "Singapore passport", v: "Visa free, 90 days in 180" },
    { k: "Visa fee", v: "EUR 90 adult" },
    { k: "Insurance", v: "EUR 30,000 minimum" },
    { k: "Checked", v: "25 Nov 2026" },
  ],
  tags: [
    { icon: "shield", label: "Free VIZA service" },
    { icon: "doc", label: "Document check" },
    { icon: "plane", label: "France and Italy" },
  ],

  page: {
    framing: "singapore",

    glance: {
      needVisa: "Not for Singapore or Malaysian passports. Yes for most other passports",
      govFee: "EUR 90 adult, EUR 45 child 6 to 11, free under 6. Plus a visa centre fee",
      processing: "15 days, up to 45 in some cases. Apply no earlier than 6 months ahead",
      maxStay: "90 days in any 180",
      checked: "25 November 2026",
    },

    passports: {
      intro: "The rule follows your passport. Singapore PR and pass holders use the rules for the passport they hold. The EU keeps the list of visa-exempt nationalities in Regulation 2018/1806, and the table shows the ones most common in Singapore.",
      rows: [
        { passport: "Singapore", status: "Visa free, 90 days in 180", note: "No visa for tourism or short business. The EU's ETIAS travel authorisation is not in operation, and the EU has not announced a start date." },
        { passport: "Malaysia", status: "Visa free, 90 days in 180", note: "Malaysia is also on the visa-exempt list. ETIAS is expected for visa-exempt travellers once it starts." },
        { passport: "China (PRC)", status: "Visa required", note: "Chinese passport holders living in Singapore apply in Singapore if they are legally resident here." },
        { passport: "India", status: "Visa required", note: "Apply to the country where you spend the most days. Show your Singapore pass as proof of residence." },
        { passport: "Indonesia", status: "Visa required", note: "The same process and the same documents as other visa-required passports." },
        { passport: "Philippines", status: "Visa required", note: "The same process. Residents of Singapore apply through the visa centre of the country they choose." },
        { passport: "Vietnam", status: "Visa required", note: "The same process. Check the destination country's own checklist." },
        { passport: "Other passports", status: "Check Regulation 2018/1806", note: "Thailand is also on the visa-required list. If your passport is not on the exempt list, you need a visa." },
      ],
    },

    visaTypes: {
      intro: "The short-stay visa is the usual one for tourists. Other types exist for other purposes.",
      items: [
        { title: "Short-stay visa, single entry", body: "One entry, up to 90 days in any 180-day period. Best for a single holiday." },
        { title: "Short-stay visa, multiple entry", body: "Several entries. A first-time applicant usually gets single entry, and frequent travellers can build up to a longer multiple-entry visa. After 3 visas used in the past 2 years you can ask for 1 year, then 2 years, then 5 years, never beyond your passport validity." },
        { title: "Airport transit", body: "For passing through the international area of a Schengen airport without entering the country. Some passports need it and some do not." },
        { title: "Long-stay national visa", body: "Study, work and stays over 90 days use a national visa from each country, not the Schengen short-stay visa." },
      ],
    },

    residents: {
      intro: "Schengen visas are decided by residence, so the embassy wants proof that you live in Singapore legally. Rules differ by country. The Italian embassy asks for a pass valid at least 90 days after the visit, and the same for a PR re-entry permit. Check the country you apply to.",
      rows: [
        { pass: "Employment Pass", body: "Bring your EP card and an employment letter. Keep the pass valid for at least 3 months after you return, which is the Italian rule and a safe target for other countries." },
        { pass: "S Pass", body: "The same as the Employment Pass. Bring the card and employment proof, and 3 months of bank statements." },
        { pass: "Dependant's Pass", body: "Bring the Dependant's Pass and the main holder's pass copy. Add a letter of support and the main holder's bank statements if they pay for the trip." },
        { pass: "Permanent Resident", body: "Bring your PR card and a re-entry permit valid for at least 90 days after the visit, which is the Italian rule." },
        { pass: "Singapore citizen", body: "No visa. Carry a passport valid for your stay, and expect ETIAS later when the EU starts it." },
        { pass: "Non-resident", body: "Some embassies accept applicants who are legally in Singapore for a short time with a justified reason, and they decide each case. The Italian embassy says it keeps the right to evaluate." },
      ],
    },

    fees: {
      intro: "The visa fee goes to the country you apply to, and the visa centre charges a service fee on top. VIZA's help is free. Always confirm the centre fee on the country's own page, because each centre sets its own.",
      rows: [
        { item: "Adult visa fee", amount: "EUR 90", note: "Set by EU law. The Italian embassy lists SGD 132.80 for the fourth quarter of 2026." },
        { item: "Child 6 to 11", amount: "EUR 45", note: "The Italian embassy lists SGD 66.40 for the fourth quarter of 2026." },
        { item: "Child under 6", amount: "Free", note: "No visa fee." },
        { item: "Visa centre service fee, France", amount: "EUR 34", note: "Per applicant, paid in local currency at VFS Global." },
        { item: "Visa centre service fee, other countries", amount: "Set by the centre", note: "Each centre publishes its own fee. We could not confirm the Singapore figures for every country." },
        { item: "Travel insurance", amount: "Paid to the insurer", note: "Minimum EUR 30,000 of cover, for the whole stay." },
      ],
      processing: "A decision normally takes 15 days and can take up to 45 in some cases. You apply no earlier than 6 months before you travel and, as a rule, no later than 15 calendar days before. Fingerprints are taken when you submit. Because peak summer months get busy, aim for 6 to 8 weeks ahead.",
    },

    apply: {
      intro: "Choose the country first. The rule is simple: apply to the country where you spend the most days. If you split your time evenly, apply to the country where you first enter the Schengen area. If you visit only one country, apply to that one.",
      guided: {
        title: "Guided",
        body: "VIZA helps you pick the right country, then walks you through the form and the checklist. You book the appointment and submit at the visa centre yourself.",
      },
      fullService: {
        title: "Full-service",
        body: "A VIZA consultant prepares the form, itinerary, insurance and bank statements, so you arrive at the visa centre with a file that matches the country checklist.",
      },
      steps: [
        { title: "Pick the country", body: "Use the main destination rule. If you are going to France or Italy, go to those pages for their checklists." },
        { title: "Prepare the file", body: "Gather the form, passport, photo, pass, itinerary, insurance and bank statements." },
        { title: "Book and submit", body: "Book an appointment at the visa centre for that country, and attend in person with your original passport. Biometrics are taken at the centre." },
        { title: "Wait and collect", body: "Wait for the decision and collect your passport with the visa. Do not book non-refundable flights before approval." },
      ],
    },

    checklist: {
      intro: "The EU sets a core list, and each country adds its own. The list below is the common core. Always check the destination country's own checklist.",
      groups: [
        {
          applicant: "Everyone",
          items: [
            "Completed and signed visa application form",
            "Passport with 2 blank pages, valid for at least 3 months after you leave, issued within the last 10 years",
            "Recent photo that meets the Schengen standard",
            "Flight reservation and accommodation for every night",
            "Travel insurance of at least EUR 30,000 covering the whole Schengen area",
            "Bank statements for the last 3 months",
          ],
        },
        {
          applicant: "Employment Pass and S Pass",
          items: [
            "Pass card, copy of both sides, valid for at least 3 months after you return",
            "Employment letter and leave approval",
            "Payslips and personal bank statements",
          ],
        },
        {
          applicant: "Dependant's Pass",
          items: [
            "Dependant's Pass card and the main holder's pass copy",
            "Marriage or birth certificate showing the link",
            "Main holder's bank statements and a letter of support",
          ],
        },
        {
          applicant: "Permanent Resident",
          items: [
            "PR card and a re-entry permit valid for at least 90 days after the visit",
            "Proof of employment or business in Singapore",
            "Personal bank statements",
          ],
        },
        {
          applicant: "Student",
          items: [
            "Student's Pass and a school letter with leave dates",
            "Support letter from a parent and their bank statements",
          ],
        },
      ],
    },

    travel: {
      intro: "A few EU systems changed in the last year. They affect how you cross the border, not how you apply.",
      items: [
        { title: "Entry and Exit System", body: "The EES has been fully operational at all external borders since 10 April 2026. First-time visitors have a face photo and sometimes fingerprints taken, and passports are not stamped. Repeat visitors are only verified and may use self-service gates." },
        { title: "ETIAS", body: "ETIAS is a travel authorisation for visa-exempt visitors. It costs EUR 20 and lasts 3 years, with children under 18 and adults over 70 exempt. It is not in operation yet and the EU will announce the date several months ahead." },
        { title: "Insurance", body: "Minimum cover is EUR 30,000 for the whole Schengen area and the whole stay, including repatriation, urgent medical care and hospital treatment. For a multiple-entry visa, it must cover the first trip." },
        { title: "At the border", body: "Be ready to show your purpose, funds, accommodation and a way to leave. The 90 days in 180 count applies to the whole Schengen area together." },
      ],
    },

    reviewed: {
      date: "25 November 2026",
      note: "Checked against the EU Visa Code, the EU home affairs and travel sites, the Embassy of Italy in Singapore and VFS Global. Rules change, so look at the links under Sources before you pay.",
    },

    related: {
      destinations: ["france", "italy", "united-kingdom", "turkiye"],
      guides: [
        { label: "Visas for Chinese passport holders in Singapore", href: "/guides/visas-chinese-passport-holders-singapore" },
        { label: "Visas for Filipino and Indian residents of Singapore", href: "/guides/visas-filipino-indian-residents-singapore" },
        { label: "Schengen visa document checklist from Singapore", href: "/guides/schengen-visa-checklist-singapore" },
        { label: "Visa refused: why it happens and how to reapply", href: "/guides/visa-refused-reapply" },
        { label: "Visa photo requirements by country", href: "/guides/visa-photo-requirements" },
        { label: "EU Entry and Exit System, how it works", href: "https://travel-europe.europa.eu/ees/ltr/how-does-the-ees-work" },
        { label: "VIZA visa news", href: "/blog" },
      ],
    },
  },

  rejectionTitle: "Common rejection reasons",
  rejectionSub: "The EU Visa Code lists the grounds for refusal. These are the grounds that matter most for a tourist application, and a consultant checks them before you submit.",
  rejectionReasons: [
    { title: "No proof of the trip's purpose", body: "The embassy needs a clear reason for the visit. An itinerary that does not explain the days is a common weakness." },
    { title: "Not enough funds", body: "You must show means for the whole stay and for the return. Thin statements or last-minute deposits raise doubt." },
    { title: "No valid insurance", body: "Cover of at least EUR 30,000 for the whole stay is a condition. A policy that starts late or covers the wrong area is refused." },
    { title: "Doubt about leaving", body: "Weak ties to Singapore, such as a short pass or no employment letter, can raise doubt that you will return." },
    { title: "Wrong country", body: "Applying to a country that is not your main destination can lead to the file being returned." },
    { title: "False or unreliable documents", body: "A document the embassy cannot trust is a ground for refusal. Use originals and keep every date consistent." },
  ],

  faqSub: "Can't find your answer? Ask the AI assistant below or message a VIZA consultant.",
  faq: [
    { category: "Do I need a visa", q: "Do Singaporeans need a Schengen visa?", a: "No. Singapore passports are on the EU visa-exempt list for stays up to 90 days in any 180. ETIAS is planned for visa-exempt visitors but is not in operation, and the EU has not announced a date." },
    { category: "Do I need a visa", q: "Do Singapore PRs and pass holders need a Schengen visa?", a: "It depends on the passport. Chinese, Indian, Indonesian, Philippine, Thai and Vietnamese passport holders need one. Malaysian passport holders do not." },
    { category: "Applying in Singapore", q: "Which country do I apply to?", a: "The country where you spend the most days. If you split your time evenly, apply to the country where you first enter the Schengen area. If you visit only one country, apply to that one." },
    { category: "Applying in Singapore", q: "Where do I apply for a Schengen visa in Singapore?", a: "Through the visa centre for the country you choose. France, Germany, the Netherlands, Switzerland, Austria, Portugal and Sweden use VFS Global. Italy and Spain use BLS. Denmark's VFS centre also takes Norway and Finland." },
    { category: "Applying in Singapore", q: "Can I apply if I only live in Singapore for a short time?", a: "It depends on the embassy. The Italian embassy accepts applicants who are legally in Singapore with a justified reason and says it keeps the right to evaluate." },
    { category: "Applying in Singapore", q: "When should I apply?", a: "No earlier than 6 months and, as a rule, no later than 15 calendar days before you travel. Aim for 6 to 8 weeks ahead in busy months." },
    { category: "Fees and time", q: "How much is a Schengen visa from Singapore?", a: "The visa fee is EUR 90 for adults and EUR 45 for children from 6 to 11, free under 6. The Italian embassy lists SGD 132.80 for adults in the fourth quarter of 2026. The visa centre adds its own service fee." },
    { category: "Fees and time", q: "How long does a Schengen visa take?", a: "Normally 15 days, and up to 45 days in some cases. Fingerprints are taken when you submit." },
    { category: "Fees and time", q: "How much is the visa centre fee?", a: "Each centre sets its own. France lists EUR 34 per applicant at VFS Global, payable in local currency. Check the page for your country." },
    { category: "Documents", q: "Do I need travel insurance?", a: "Yes. Minimum cover of EUR 30,000 for the whole Schengen area and the whole stay, including repatriation, urgent medical care and hospital treatment." },
    { category: "Documents", q: "How long must my pass be valid?", a: "The Italian embassy asks for at least 90 days after the visit for a pass or PR re-entry permit. Check the rule for the country you apply to." },
    { category: "Before you travel", q: "What is the Entry and Exit System?", a: "A border system that records entries and exits instead of stamping passports. It has been fully operational since 10 April 2026. First-time visitors have a photo and sometimes fingerprints taken." },
    { category: "Before you travel", q: "How much does VIZA charge?", a: "Nothing. VIZA's help is free. You pay the visa fee and the visa centre fee directly." },
  ],

  sources: [
    { label: "EU home affairs, applying for a Schengen visa", url: "https://home-affairs.ec.europa.eu/policies/schengen/schengen-visas/applying-schengen-visa_en", display: "home-affairs.ec.europa.eu" },
    { label: "EU Visa Code, Regulation 810/2009", url: "https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:02009R0810-20200202", display: "eur-lex.europa.eu" },
    { label: "EU Regulation 2018/1806, visa-exempt countries", url: "https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:02018R1806-20251230", display: "eur-lex.europa.eu" },
    { label: "EU travel site, ETIAS", url: "https://travel-europe.europa.eu/en/etias", display: "travel-europe.europa.eu" },
    { label: "EU travel site, Entry and Exit System", url: "https://travel-europe.europa.eu/ees/faq", display: "travel-europe.europa.eu" },
    { label: "Embassy of Italy in Singapore, visa fees", url: "https://ambsingapore.esteri.it/en/servizi-consolari-e-visti/servizi-per-il-cittadino-straniero/visti/visas-fees/", display: "ambsingapore.esteri.it" },
    { label: "VFS Global, France visas, Singapore", url: "https://visa.vfsglobal.com/sgp/en/fra/", display: "visa.vfsglobal.com" },
    { label: "VFS Global, Germany visas, Singapore", url: "https://visa.vfsglobal.com/sgp/en/deu/", display: "visa.vfsglobal.com" },
    { label: "BLS Spain visa, Singapore", url: "https://singapore.blsspainvisa.com/", display: "singapore.blsspainvisa.com" },
  ],

  price: {
    etaLabel: "Decision",
    etaValue: "15 days, up to 45",
    title: "Schengen visa · Singapore residents",
    sub: "VIZA's help is free: country choice, form preparation and document review. The visa fee and centre fee are paid to the authority and the centre.",
    foot: "VIZA's service is free. Schengen fees are paid to the embassy and the visa centre.",
  },

  aiPlaceholder: "Ask anything about a Schengen visa from Singapore: which country, fees, documents…",
};

export default schengen;
