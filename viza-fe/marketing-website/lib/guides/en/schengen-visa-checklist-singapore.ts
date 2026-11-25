import type { GuideContent } from "../types";

/**
 * Schengen visa document checklist for people living in Singapore (English).
 *
 * Checked 25 Nov 2026 against: EU home affairs "Applying for a Schengen visa"; the Embassy of Italy in Singapore
 * (fee page, Tourist Visa Checklist updated 23.04.2026, read from the PDF); BLS International Italy Singapore
 * tourist visa page; BLS Spain Singapore site; Embassy of the Netherlands (apply Singapore, making appointment);
 * German embassy Singapore visa page; EU home affairs ETIAS page (dated 6 Oct 2025); eu-LISA EES news;
 * Dutch government ETIAS page; Danish and Swedish embassy pages on travel medical insurance; the EC news item on
 * Bulgaria and Romania joining Schengen; and the repo pages lib/visa-content/schengen.ts, france.ts, italy.ts.
 * The EU travel-europe.europa.eu pages, EUR-Lex, VFS Global and France-Visas returned nothing readable or HTTP 403.
 *
 * Not confirmed on an official page, so the copy hedges or leaves it out:
 *   - The EUR 30,000 wording of Visa Code Article 15 was read in embassy pages and a search summary, not on
 *     EUR-Lex itself. The EU home affairs page names the cover (emergency care, hospital, repatriation) but no amount
 *   - The ETIAS start date (the EU has announced none) and whether the EU list names Singapore
 *   - ETIAS validity and age exemptions (not on the page read), so they are left out
 *   - Pass validity rules for EP, S Pass, Dependant's Pass and PR re-entry permits (the Italian checklist names
 *     the NRIC or FIN card and the PR re-entry permit but gives no number of days)
 *   - Documents for retired applicants in Singapore (no checklist read lists a retiree line)
 *   - Country-specific checklists other than Italy (France, Germany, Netherlands, Spain, Switzerland were not read in full)
 *   - France application fee of EUR 34 and the new VFS address from 2 June 2026 (France-Visas returned 403,
 *     figures come from the repo page lib/visa-content/france.ts)
 *   - VFS Global service fees in SGD, and VFS appointment waiting times
 *   - Which countries use VFS Global, BLS or another centre in Singapore beyond those named in the copy
 *   - Photo size beyond ICAO (EU), white background (Italy) and 4 x 5 cm (BLS Italy)
 *   - Whether employer or credit card insurance is accepted (left to the embassy)
 */
const guide: GuideContent = {
  title: "Schengen Visa Application Singapore: Checklist | VIZA",
  description: "How to apply for a Schengen visa in Singapore: documents by applicant type, EUR 30,000 travel insurance, VFS Global and BLS, timing, fees and refusal reasons.",
  h1: "Schengen visa application in Singapore: document checklist",
  lead: "If you live in Singapore on a passport that needs a Schengen visa, you apply in Singapore to the country where you spend the most days, usually through its visa centre. This guide lists the documents for each applicant type, explains the travel insurance rule, and covers where to apply, when, what it costs and what causes refusals.",
  glance: [
    { k: "Who applies here", v: "Residents of Singapore whose passport needs a Schengen visa, such as Chinese, Indian, Indonesian, Philippine, Thai and Vietnamese passports" },
    { k: "Which country", v: "The one where you spend the most days, or your first entry if the stays are equal" },
    { k: "When", v: "No earlier than 6 months and at least 15 days before you travel" },
    { k: "Insurance", v: "At least EUR 30,000, valid across the Schengen area for the whole stay" },
    { k: "Visa fee", v: "EUR 90 for adults, plus the visa centre service fee" },
  ],
  sections: [
    {
      id: "who-needs-a-visa",
      heading: "Who needs a visa",
      body: [
        "The rule follows the passport you hold, not the pass you hold in Singapore. Singapore and Malaysian passports enter the Schengen area visa free for up to 90 days in any 180. The Schengen area covers 29 European countries, so one short-stay visa works across all of them for the days and entries granted.",
        "Chinese, Indian, Indonesian, Philippine, Thai and Vietnamese passport holders need a visa. If your passport is not in the table, check the EU list of visa-exempt nationalities (Regulation 2018/1806) before you plan. Our [Schengen visa page](/visa/schengen) keeps the full picture.",
      ],
      table: {
        head: ["Passport", "Schengen visa", "What it means in Singapore"],
        rows: [
          ["Singapore", "Not needed", "Up to 90 days in any 180. See the [visa free countries guide](/guides/visa-free-countries-singapore-passport)"],
          ["Malaysia", "Not needed", "Up to 90 days in any 180"],
          ["China (PRC)", "Needed", "Apply in Singapore if you live here legally. See the [guide for Chinese passport holders](/guides/visas-chinese-passport-holders-singapore)"],
          ["India", "Needed", "Show your Singapore pass as proof of residence. See the [guide for Filipino and Indian residents](/guides/visas-filipino-indian-residents-singapore)"],
          ["Philippines", "Needed", "Same process through the centre of the country you choose"],
          ["Indonesia, Thailand, Vietnam", "Needed", "Same process and the same core documents"],
        ],
      },
    },
    {
      id: "which-country",
      heading: "Country and visa centre",
      body: [
        "The EU says to apply to the country where you will spend the most time. If the stays are equal, apply to the country you enter first. If you visit one country only, apply to that one. As a rule you also apply where you are legally resident, which is why Singapore residents lodge here. Make your bookings match the country you choose.",
        "You lodge your file at that country's visa centre, by appointment, and attend in person for fingerprints. The embassy decides and the centre only receives the file. Book on the centre's own website, not through an intermediary.",
        "[VFS Global Singapore](https://visa.vfsglobal.com/sgp/en/deu/) handles Schengen applications for several countries. The German embassy lists its VFS centre at Haw Par Centre, 180 Clemenceau Avenue, and the Dutch embassy sends Singapore residents to VFS Global and asks you to book each person separately. The Italian embassy uses BLS International, and the Spain centre in Singapore is also run by BLS. Check the country's page for the current address.",
      ],
      table: {
        head: ["Your trip", "Apply to"],
        rows: [
          ["Eight days in Italy, three in France", "Italy, the longest stay. See the [Italy visa page](/visa/italy)"],
          ["Five days in France, five in Italy", "The country you enter first. See the [France visa page](/visa/france)"],
          ["Italy only", "Italy"],
        ],
      },
    },
    {
      id: "core-documents",
      heading: "Core documents for everyone",
      body: [
        "The EU sets a short core list. Each country adds its own checklist, so open the checklist for your destination before you print anything. The Italian embassy publishes the clearest one for Singapore, and it is the model for the lines below.",
      ],
      list: [
        "Application form, completed online, printed and signed. Parents sign together for anyone under 18.",
        "Passport valid at least 3 months after you leave the Schengen area. Italy also wants it issued within the last 10 years, with 2 blank facing pages, a signature, and a copy of the first 3 pages and any Schengen visas from the last 3 years.",
        "Photos. The EU asks for a photo that meets ICAO standards. Italy asks for two recent passport-size photos on a white background, and BLS describes a 4 x 5 cm colour photo taken within 6 months. Read the [visa photo requirements guide](/guides/visa-photo-requirements).",
        "Proof you live in Singapore. Italy asks for your NRIC or FIN card, original and a copy of both sides, and a valid re-entry permit for permanent residents.",
        "Flight bookings. Italy accepts a confirmed booking that is not paid, and asks for every train, flight and car rental between Schengen countries.",
        "Accommodation for the stay, such as hotel bookings, or a host declaration if a resident of the Schengen area hosts you.",
        "Bank statements for the last 3 months. Italy wants originals with the bank stamp from a Singapore account and does not accept overseas accounts.",
        "Travel insurance. The next section covers it.",
      ],
    },
    {
      id: "by-applicant-type",
      heading: "Documents by applicant type",
      body: [
        "Your status in Singapore decides which proof you add. The table follows the Italian embassy checklist updated on 23 April 2026. Other countries ask for similar proof, so treat it as a guide and confirm the exact wording with your centre.",
        "Letters must be in English, carry an original signature and seal, and not be an electronic copy. The Italian checklist says coloured scans and electronic signatures are not accepted.",
      ],
      table: {
        head: ["Applicant", "What to add"],
        rows: [
          ["Employed (EP, S Pass, work permit)", "FIN card, and an employment letter on company letterhead addressed to the embassy. It states your name, position, start date, approved leave, salary, and the purpose and dates of the trip. The signer gives name, position, original signature and company seal"],
          ["Self-employed", "Your FIN or NRIC, and your ACRA Biz File in place of an employment letter, with 3 months of bank statements"],
          ["Student (Student's Pass)", "A school letter addressed to the embassy with your name, year of enrolment, purpose and dates of the trip, and the principal's name, original signature and school seal. If a parent pays, the sponsor signs a sponsorship affidavit"],
          ["Dependant (Dependant's Pass)", "Your FIN card. If a spouse or parent pays, the sponsor attends the centre in person to sign the sponsorship affidavit. Married couples add the marriage certificate and a copy of the spouse's passport. Ask your centre if it wants the main pass holder's pass copy and payslips as well"],
          ["Permanent Resident", "NRIC and a valid re-entry permit, original and copy, plus proof of work or business and your bank statements"],
          ["Retired", "Singapore bank statements and your residence proof. The Italian checklist has no retiree line, so ask the centre whether it wants pension statements"],
          ["Minor under 18", "Both parents attend in person with their passports and the child's birth certificate. If only one parent applies with the child, the other parent gives written consent at the nearest Italian embassy or consulate"],
        ],
      },
    },
    {
      id: "travel-insurance",
      heading: "Schengen visa insurance in Singapore",
      body: [
        "Travel insurance is a condition of the visa. The EU Visa Code sets the minimum at EUR 30,000, valid across the territory of the Schengen states and for your whole intended stay. Embassies describe the cover as urgent medical care, hospital treatment and repatriation for medical reasons, including death. The EU home affairs page lists the same three items. Danish and Swedish embassy pages repeat the EUR 30,000 and the whole-stay rule.",
        "The Embassy of Italy in Singapore words it in two currencies: cover of up to EUR 30,000 or SGD 50,000, for the whole period of stay, valid for the Schengen area or worldwide. BLS says you can use any authorised insurer and submit the certificate at the centre. These are the points to read in the policy wording before you buy.",
      ],
      list: [
        "Amount: at least EUR 30,000, or SGD 50,000 for Italy. The Italian checklist accepts EUR, SGD and USD.",
        "Area: all Schengen states. A policy for Asia only, or for one country only, does not fit a visa file.",
        "Dates: the cover runs for the whole stay, from the day you arrive to the day you leave. For a multiple-entry visa it must cover the first trip.",
        "Cover items: urgent medical care, hospital treatment and repatriation. Italy asks that the policy shows the full coverages and the geographical area.",
        "Name: the policy shows your name as in your passport. Each traveller needs a policy, including children.",
        "Age: the Danish embassy says policy terms must not cut medical cover below the minimum because of age, so check this if you are older.",
        "Proof: print the certificate for the file and keep a copy on your phone. The Swedish embassy says you may be asked to show it at the border.",
      ],
    },
    {
      id: "timing-and-fees",
      heading: "Timing and fees",
      body: [
        "Apply no earlier than 6 months and at least 15 days before you travel. Some centres set a shorter window. The Spain centre in Singapore says up to 3 months before departure, so read your country's page. A decision normally takes 15 days and can take up to 45 when the embassy needs more documents.",
        "The Italian embassy says it normally issues the visa within 5 days, and BLS says to allow at least 15 working days. Your passport stays with the embassy while it decides, so avoid other trips in that period. Aim for 6 to 8 weeks ahead in busy months, and wait for the decision before you buy flights you cannot change.",
        "The EU page lists EUR 90 for adults and EUR 45 for children aged 6 to 12. The Italian embassy lists S$132.80 and S$66.40 for the fourth quarter of 2026 and says children under 6 pay nothing. Fees are due when you submit and are generally not refunded if the visa is refused. The visa centre adds its own service fee, such as S$31 at BLS for Italy. The France-Visas page lists an application fee of EUR 34 at its Singapore centre.",
      ],
    },
    {
      id: "refusal-mistakes",
      heading: "Mistakes that cause refusals",
      body: [
        "The Visa Code lists the grounds for refusal, and most tourist refusals come from a file that does not show the trip, the money or the plan to return. If a refusal happens, read the notice and our [guide to reapplying after a refusal](/guides/visa-refused-reapply).",
      ],
      list: [
        "Wrong country. The bookings point to one country and the application goes to another.",
        "Weak funds. Statements look low for the stay, or a large deposit arrives just before you apply. Italy does not accept overseas accounts.",
        "Insurance that does not qualify. Cover under the minimum, dates that start late, or an area that is not the whole Schengen area.",
        "Unclear purpose. An itinerary that leaves days unexplained.",
        "Weak ties to Singapore. A short pass, no employment letter, or leave that is not approved.",
        "Letter errors. A missing seal, an electronic signature or a coloured scan.",
        "Passport problems. Fewer than 3 months left after you leave, no signature, or no facing blank pages.",
        "Dates that disagree across the form, flights, hotels and insurance.",
      ],
    },
    {
      id: "ees-and-etias",
      heading: "EES and ETIAS in 2026",
      body: [
        "Two EU systems change the border, not the application. The Entry/Exit System (EES) has been fully deployed since 10 April 2026, according to eu-LISA. It records your entry and exit digitally, including a face image and fingerprints, and replaces passport stamping for short-stay visitors. Visa holders are covered, so expect these checks at the border.",
        "ETIAS is a separate travel authorisation for visa-exempt visitors, so it matters to Singapore and Malaysian passport holders and not to you if you hold a visa. The EU page says ETIAS is currently not in operation, no applications are collected and the EU will announce the start date several months ahead. As of 25 November 2026 we found no announced date. The page lists a fee of EUR 20.",
        "Both can change, so check the [EU travel information site](https://travel-europe.europa.eu/etias_en) before you fly.",
      ],
    },
    {
      id: "next-steps",
      heading: "Next steps",
      body: [
        "Pick the country first, then open its checklist. The [Schengen visa page](/visa/schengen) explains the choice, and the [France](/visa/france) and [Italy](/visa/italy) pages go through those two destinations step by step.",
        "VIZA's help is free: country choice, form preparation and a document check. The visa fee goes to the embassy and the service fee to the visa centre, and both are separate from VIZA.",
      ],
    },
  ],
  faq: [
    { q: "How do I apply for a Schengen visa in Singapore?", a: "Choose the country where you spend the most days, complete its application form, book an appointment at its visa centre and attend in person with your documents and passport. Fingerprints are taken at the centre, and the embassy decides." },
    { q: "Do I need a Schengen visa if I live in Singapore?", a: "It depends on your passport. Singapore and Malaysian passports are visa free for 90 days in any 180. Chinese, Indian, Indonesian, Philippine, Thai and Vietnamese passports need a visa, even if you hold an EP, S Pass or PR." },
    { q: "What documents do I need for a Schengen visa application in Singapore?", a: "A signed form, passport, photos, proof of residence in Singapore, flight and accommodation bookings, 3 months of bank statements and travel insurance. Add an employment letter, ACRA Biz File or school letter for your status." },
    { q: "Do I need travel insurance for a Schengen visa from Singapore?", a: "Yes. The minimum is EUR 30,000, valid across the Schengen area for the whole stay. It must cover urgent medical care, hospital treatment and repatriation. Italy also accepts SGD 50,000." },
    { q: "What should I check in Schengen visa insurance in Singapore?", a: "Check the amount, the area, the dates, the cover for repatriation and hospital care, and that the policy shows your name. For a multiple-entry visa it must cover the first trip." },
    { q: "Where is the VFS Global Singapore Schengen visa centre?", a: "The German embassy lists VFS Global at Haw Par Centre, 180 Clemenceau Avenue, and the Dutch embassy sends residents to VFS Global too. Addresses change, so confirm on the country's page. Italy uses BLS International." },
    { q: "How early can I apply for a Schengen visa in Singapore?", a: "The EU says no earlier than 6 months and at least 15 days before you travel. Spain's centre in Singapore says up to 3 months, so check your country's page." },
    { q: "How much is a Schengen visa from Singapore?", a: "The visa fee is EUR 90 for adults and EUR 45 for children aged 6 to 12, free under 6. The Italian embassy lists S$132.80 for adults in Q4 2026. The visa centre adds a service fee, S$31 at BLS for Italy." },
    { q: "How long does a Schengen visa take from Singapore?", a: "Normally 15 days and up to 45 when more documents are needed. Italy says it often issues within 5 days, while BLS says to allow at least 15 working days." },
    { q: "Can Dependant Pass holders and students apply in Singapore?", a: "Yes. Dependants and students use their FIN card as proof of residence. A sponsor, such as a spouse or parent, attends in person to sign the sponsorship affidavit at Italy's centre, and students add a school letter." },
    { q: "Do I need ETIAS for a Schengen visa?", a: "No. ETIAS is for visa-exempt visitors and is not in operation yet. The EU has announced no start date. If you hold a visa, you do not apply for ETIAS." },
  ],
  sources: [
    { label: "EU home affairs, applying for a Schengen visa", url: "https://home-affairs.ec.europa.eu/policies/schengen/schengen-visas/applying-schengen-visa_en" },
    { label: "Embassy of Italy in Singapore, visa fees", url: "https://ambsingapore.esteri.it/en/servizi-consolari-e-visti/servizi-per-il-cittadino-straniero/visti/visas-fees/" },
    { label: "Embassy of Italy in Singapore, Tourist Visa Checklist updated 23.04.2026", url: "https://ambsingapore.esteri.it/wp-content/uploads/2026/04/Tourist-Visa-Checklist-UPDATED-ON-23.04.2026.pdf" },
    { label: "BLS International, Italy visa Singapore, tourist visa", url: "https://www.blsinternational.com/italy/singapore/touristvisa.php" },
    { label: "BLS Spain visa, Singapore", url: "https://singapore.blsspainvisa.com/" },
    { label: "Netherlands Worldwide, apply for a Schengen visa in Singapore", url: "https://www.netherlandsworldwide.nl/visa-the-netherlands/schengen-visa/apply-singapore" },
    { label: "German embassy Singapore, visa for visits up to 90 days", url: "https://singapur.diplo.de/sg-en/service/05-visaeinreise/1225488-1225488" },
    { label: "VFS Global, Germany visas, Singapore", url: "https://visa.vfsglobal.com/sgp/en/deu/" },
    { label: "EU home affairs, ETIAS", url: "https://home-affairs.ec.europa.eu/policies/schengen/smart-borders/european-travel-information-authorisation-system_en" },
    { label: "eu-LISA, Entry/Exit System fully deployed across the EU", url: "https://www.eulisa.europa.eu/news-and-events/news/entryexit-system-fully-deployed-across-eu" },
    { label: "Government of the Netherlands, ETIAS", url: "https://www.government.nl/topics/holidays-and-travels/etias" },
    { label: "Danish embassy, travel medical insurance", url: "https://um.dk/saudiarabien/en/travel-and-residence/practical-information/visa/travel-medical-insurance/" },
    { label: "Swedish embassy, medical travel insurance", url: "https://swedenabroad.se/en/about-sweden-non-swedish-citizens/china/going-to-sweden/visiting-sweden/medical-travel-insurance" },
    { label: "European Commission, Bulgaria and Romania join the Schengen area", url: "https://home-affairs.ec.europa.eu/news/bulgaria-and-romania-join-schengen-area-2025-01-03_en" },
  ],
  reviewed: "Checked on 25 November 2026 against the EU home affairs Schengen visa and ETIAS pages, the Embassy of Italy in Singapore (fees and the Tourist Visa Checklist updated 23 April 2026), BLS International for Italy and Spain, the Dutch and German embassy pages for Singapore, eu-LISA, and the Danish and Swedish embassy insurance pages. Rules change, so open the links under Sources before you pay.",
};

export default guide;
