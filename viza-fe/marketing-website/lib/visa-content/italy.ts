import type { DestinationContent } from "./types";

/**
 * Italy short-stay Schengen visa (Type C, tourism) for people living in Singapore (embassy visa, framed "from
 * Singapore"). Applications go through BLS International in Singapore to the Embassy of Italy. Links to the
 * Schengen hub at /visa/schengen. Checkout behaviour is unchanged (it comes from lib/countries.ts).
 *
 * Checked 25 Nov 2026 against the Embassy of Italy in Singapore (fee page, issuance procedure, tourist visa
 * checklist updated 23.04.2026) and the BLS International Italy Singapore tourist visa page. Both pages were
 * read directly. EU pages (travel-europe.europa.eu) returned only a title, so EES and ETIAS lines follow the
 * wording already used in schengen.ts.
 *
 * Not confirmed on an official page this session (kept general or hedged):
 *   - Processing time: the Embassy checklist says 15 days and "normally issued within 5 days", while the BLS
 *     page says "minimum 15 working days". The copy gives both and tells people to allow 3 weeks
 *   - Which nationalities are visa exempt (EU Regulation 2018/1806 was not re-read); Malaysia and the
 *     visa-required list for China, India, Indonesia, Philippines and Vietnam follow schengen.ts
 *   - Pass validity rules for EP, S Pass and Dependant's Pass (the Embassy checklist only names the NRIC or FIN
 *     card and, for PR, the re-entry permit)
 *   - Child fee age band: the Embassy and BLS both write "6 to 12"; EU law says 6 to under 12
 *   - Photo size (BLS says 4 x 5 cm within 6 months, the Embassy checklist says passport size, white background)
 *   - Exact ETIAS start date (the EU has announced none) and the EES start date (from schengen.ts)
 *   - Appointment waiting times at BLS (not published)
 */
export const italy: DestinationContent = {
  slug: "italy",

  heroTitle: "Italy visa from Singapore",
  lede: "An Italy visa from Singapore is a Schengen short-stay visa that also covers 28 other European countries, for up to 90 days in any 180. Singapore passports do not need one. If you live in Singapore on a Chinese, Indian, Indonesian, Philippine or Vietnamese passport, you book an appointment at the BLS centre, submit your file in person, and the Embassy of Italy decides. The visa fee is S$132.80 at the Embassy for the fourth quarter of 2026, plus a S$31 BLS service fee.",
  heroImage: "/assets/heroes/italy.jpg",
  meta: [
    { k: "Singapore passport", v: "Visa free, 90 days in 180" },
    { k: "Visa fee", v: "EUR 90 (S$132.80)" },
    { k: "Decision", v: "15 days, sometimes longer" },
    { k: "Checked", v: "25 Nov 2026" },
  ],
  tags: [
    { icon: "shield", label: "Free VIZA service" },
    { icon: "doc", label: "Document check" },
    { icon: "plane", label: "Schengen-wide" },
  ],

  page: {
    framing: "singapore",

    glance: {
      needVisa: "Not for Singapore passports. Yes for Chinese, Indian, Indonesian, Philippine and Vietnamese passports",
      govFee: "EUR 90, which is S$132.80 at the Embassy (Q4 2026), plus S$31 BLS service fee",
      processing: "The Embassy says 15 days and often faster. BLS says allow at least 15 working days. Apply 3 weeks or more ahead",
      maxStay: "90 days in any 180, across all Schengen countries",
      checked: "25 November 2026",
    },

    passports: {
      intro: "The passport decides, not where you live. Singapore PR and pass holders follow the rule for the passport they hold. To apply in Singapore you must live here legally, and the Embassy asks for your residence card as proof. The table shows the passports most common among people in Singapore.",
      rows: [
        { passport: "Singapore", status: "Visa free, 90 days in 180", note: "No visa and no fee for a holiday or short business trip. The EU's ETIAS authorisation is not in operation and the EU has not announced a start date." },
        { passport: "China (PRC)", status: "Visa required", note: "Chinese passport holders who live in Singapore apply at BLS Singapore for the Embassy of Italy, with their Singapore residence card." },
        { passport: "Malaysia", status: "Visa free, 90 days in 180", note: "Malaysia is on the EU visa-exempt list. Check the EU list before you book." },
        { passport: "India", status: "Visa required", note: "The same process as other visa-required passports. You show your Singapore pass and 3 months of Singapore bank statements." },
        { passport: "Indonesia", status: "Visa required", note: "Apply at BLS Singapore if you live here. The documents and fee are the same as for other nationalities." },
        { passport: "Philippines", status: "Visa required", note: "The same process and the same fee. Overseas bank accounts are not accepted, so use a Singapore account." },
        { passport: "Vietnam", status: "Visa required", note: "The same process. Book an individual appointment for every family member." },
        { passport: "Other passports", status: "Check the EU exemption list", note: "The EU keeps the visa-exempt list in Regulation 2018/1806. If your passport is not on it, you need a visa. The Schengen hub page explains the list." },
      ],
    },

    visaTypes: {
      intro: "For a holiday the Schengen short-stay visa is the usual choice. This page covers that visa. Other Italian visas exist for other purposes.",
      items: [
        { title: "Short-stay visa for tourism", body: "Type C, for holidays, family visits and short trips, up to 90 days in any 180. It can be single, double or multiple entry. First-time applicants usually receive single entry." },
        { title: "Visit family or friends", body: "The same visa, with a Host Declaration Form (Dichiarazione di Alloggio) from your host. A host who is an Italian citizen completes it, and a foreign host has it certified by the Italian municipality." },
        { title: "Family of EU or EEA citizens", body: "Spouses, civil union partners and dependent relatives of EU or EEA citizens can get a free, priority visa of up to 90 days. They apply in person at the Embassy by appointment, with proof of the relationship." },
        { title: "Long stay and national visas", body: "Study, work and stays over 90 days need an Italian national visa. The Embassy lists a fee of EUR 116 (S$171.10) for national visas. This is a separate process from the tourist visa." },
      ],
    },

    residents: {
      intro: "You apply in the country where you live, so the Embassy asks for proof that you live in Singapore. Your pass and your Singapore bank account carry most of the file. The checklist names the NRIC or FIN card, and for permanent residents the re-entry permit.",
      rows: [
        { pass: "Employment Pass", body: "Bring your FIN card, original and a copy of both sides, and the employment letter addressed to the Embassy of Italy. The letter shows your position, start date, leave dates, salary and the purpose of the trip, with the company seal and an original signature." },
        { pass: "S Pass", body: "The same as the Employment Pass. Use your FIN card and the employment letter, and add 3 months of Singapore bank statements with the bank's stamp." },
        { pass: "Dependant's Pass", body: "Bring the Dependant's Pass and the main holder's pass copy. If the main holder pays for the trip, the sponsor must come to BLS in person to sign the sponsorship affidavit. Married couples bring the marriage certificate and the spouse's passport copy." },
        { pass: "Permanent Resident", body: "Bring your valid re-entry permit and your NRIC. You apply with the passport of your own country, and the Singapore passport visa free rule does not apply to you." },
        { pass: "Singapore citizen", body: "No visa. Carry a passport valid for your whole stay. Italy has no arrival card, and the EU's EES takes a photo and sometimes fingerprints at the border." },
        { pass: "Student's Pass", body: "Add a letter from your school addressed to the Embassy, with enrolment year, trip dates, the principal's name, an original signature and the school seal. A sponsor, such as a parent, attends BLS to sign the affidavit." },
      ],
    },

    fees: {
      intro: "The Embassy collects the visa fee in Singapore dollars when you submit, and BLS charges its own service fee. The visa fee is not refunded if the visa is refused. VIZA's help is free.",
      rows: [
        { item: "Adult visa fee", amount: "EUR 90 (S$132.80)", note: "The Embassy's price for the fourth quarter of 2026. It follows the euro exchange rate each quarter." },
        { item: "Child 6 to 12", amount: "EUR 45 (S$66.40)", note: "The age band as the Embassy and BLS write it. Children under 6 are free." },
        { item: "BLS service fee", amount: "S$31.00", note: "Per application, charged by the visa centre." },
        { item: "Optional BLS services", amount: "S$5 to S$250", note: "SMS S$5, photos S$12, form filling S$15, courier S$25, Prime Time slot S$50, mobile biometrics S$250. All optional." },
        { item: "Travel insurance", amount: "Paid to the insurer", note: "Cover of at least EUR 30,000 or SGD 50,000 for the whole stay, including repatriation." },
        { item: "Italian national visa", amount: "EUR 116 (S$171.10)", note: "For long stays only, not for tourism." },
      ],
      processing: "The Embassy says it processes applications within 15 days, normally issues the visa within 5 days, and may take longer when it needs more documents. The BLS page says processing may take at least 15 working days. Plan on three weeks and add a buffer for peak seasons. You can apply up to 6 months before the trip and no later than 15 days before it. Your passport stays at the Embassy during processing, so do not plan other travel in that window.",
    },

    apply: {
      intro: "Italy needs an in-person appointment at BLS, so the work is in preparing the file correctly the first time. Choose how much help you want.",
      guided: {
        title: "Guided",
        body: "VIZA's AI walks you through the checklist for your pass type and flags what is missing. You book the BLS appointment, attend in person and pay the fees yourself.",
      },
      fullService: {
        title: "Full-service",
        body: "A VIZA consultant prepares the form, itinerary, insurance and bank statements, and checks the employment letter against the Embassy's wording, so the file is complete before you go to BLS.",
      },
      steps: [
        { title: "Start on VIZA", body: "Upload your passport, pass and trip dates. We confirm that you need the visa and that Italy is the right country to apply to." },
        { title: "Prepare the file", body: "We check the form, flights, insurance, bank statements and letters against the Embassy checklist updated on 23 April 2026." },
        { title: "Book and submit at BLS", body: "Book the appointment online and submit in person with your original passport. Fingerprints and a photo are taken, and you pay the visa fee and the service fee." },
        { title: "Wait and collect", body: "Wait for the decision and collect the passport. Do not buy non-refundable flights before the visa is issued." },
      ],
    },

    checklist: {
      intro: "This list follows the Embassy of Italy's tourist visa checklist. It must be signed and submitted with your application, and every supporting document must be in English. The Embassy may ask for more.",
      groups: [
        {
          applicant: "Everyone",
          items: [
            "Signed checklist and completed application form (online form printed and signed)",
            "Passport issued within the last 10 years, valid at least 3 months after you leave Schengen, with 2 blank facing pages, plus a copy of the first 3 pages",
            "Two recent passport-size photos on a white background",
            "Round trip flight booking (not a paid ticket) and bookings for any train, flight or car rental between Schengen countries",
            "Travel insurance for the Schengen area covering EUR 30,000 or SGD 50,000, for the whole stay",
            "Original bank statements for the last 3 months, with the bank's stamp, from a Singapore account",
          ],
        },
        {
          applicant: "Employment Pass and S Pass",
          items: [
            "Valid FIN card, original and a copy of both sides",
            "Employment letter on company letterhead, addressed to the Embassy, with position, start date, leave, salary, trip purpose, signer name and an original signature and company seal",
            "No coloured scans and no electronic signatures",
          ],
        },
        {
          applicant: "Dependant's Pass",
          items: [
            "Dependant's Pass, original and copy, and the main holder's pass copy",
            "Sponsorship affidavit signed at BLS by the sponsor in person",
            "Marriage certificate and the spouse's passport copy if married",
          ],
        },
        {
          applicant: "Permanent Resident and self-employed",
          items: [
            "Valid re-entry permit and NRIC, original and copy",
            "Self-employed applicants add the ACRA Biz File",
            "Bank statements and the travel plan",
          ],
        },
        {
          applicant: "Student and minors",
          items: [
            "Student's Pass and a signed school letter with the school seal",
            "For minors, both parents attend BLS with their passports and the child's birth certificate",
            "When one parent travels alone with a child, the other gives written consent at an Italian Embassy or Consulate",
          ],
        },
        {
          applicant: "Staying with a host",
          items: [
            "Host Declaration Form (Dichiarazione di Alloggio)",
            "For a foreign host, the form is certified by the Italian municipality, with a copy of the host's passport",
          ],
        },
      ],
    },

    travel: {
      intro: "Once the visa is in your passport, a few EU rules apply at the border. None of them change how you apply.",
      items: [
        { title: "Entry and Exit System", body: "The EES has been fully operational at EU borders since 10 April 2026. First-time visitors have a face photo and sometimes fingerprints taken, and passports are not stamped. Italy has no separate arrival card." },
        { title: "ETIAS", body: "ETIAS is a travel authorisation for visa-exempt visitors such as Singapore passport holders. It is not in operation yet, and the EU has not announced a start date. Visa holders do not need it." },
        { title: "90 days in 180", body: "Days in any Schengen country count together, not only days in Italy. Italy should be your main destination, meaning the longest stay, or your first entry if the stays are equal." },
        { title: "Insurance and proof at the border", body: "Carry your insurance, flight booking, hotel bookings and bank statements. Border officers can ask for them." },
        { title: "Overstaying", body: "Leave within the days on your visa. An overstay is recorded automatically by the EES and can affect later Schengen applications." },
      ],
    },

    reviewed: {
      date: "25 November 2026",
      note: "Checked against the Embassy of Italy in Singapore and BLS International. Fees and rules change, so look at the links under Sources before you pay.",
    },

    related: {
      destinations: ["schengen", "france", "united-kingdom", "turkiye"],
      guides: [
        { label: "Schengen visa document checklist from Singapore", href: "/guides/schengen-visa-checklist-singapore" },
        { label: "Schengen visa from Singapore, the hub guide to choosing a country", href: "/visa/schengen" },
        { label: "Il Visto per l'Italia, the Italian Ministry of Foreign Affairs visa portal", href: "https://vistoperitalia.esteri.it" },
        { label: "VIZA visa news", href: "/blog" },
      ],
    },
  },

  rejectionTitle: "Common rejection reasons",
  rejectionSub: "The Embassy gives a reason when it refuses a visa, and the visa fee is not refunded. These are the weak points a consultant checks first.",
  rejectionReasons: [
    { title: "Purpose of the trip is not clear", body: "A thin itinerary, bookings that do not match the dates or an employment letter that skips the leave dates all raise questions." },
    { title: "Funds do not fit the trip", body: "Bank statements that look low for the stay, large deposits just before you apply, or an overseas account, which the Embassy does not accept." },
    { title: "Weak ties to Singapore", body: "A short time in Singapore, no employer letter or no clear reason to return makes it harder to show that you will leave Schengen on time." },
    { title: "Insurance that does not qualify", body: "Cover below EUR 30,000 or SGD 50,000, wrong dates, or a policy that does not cover the whole Schengen area." },
    { title: "Letters that break the format", body: "Coloured scans, electronic signatures, a missing company seal or a letter not addressed to the Embassy of Italy." },
    { title: "Earlier overstays or alerts", body: "An overstay or an entry alert in the Schengen Information System needs an explanation and can lead to a refusal." },
  ],

  faqSub: "Can't find your answer? Ask the AI assistant below or message a VIZA consultant.",
  faq: [
    { category: "Do I need a visa", q: "Do Singaporeans need a visa for Italy?", a: "No. Singapore passport holders enter Italy and the rest of the Schengen area visa free for up to 90 days in any 180. ETIAS is planned for visa-exempt visitors, but it is not in operation and the EU has not announced a date." },
    { category: "Do I need a visa", q: "Do Chinese, Indian, Indonesian, Philippine and Vietnamese passport holders in Singapore need an Italy visa?", a: "Yes. These passports need a Schengen visa for Italy. If you live in Singapore, you apply at BLS International for the Embassy of Italy, with your Singapore residence card." },
    { category: "Do I need a visa", q: "Do Singapore PR holders need a visa for Italy?", a: "It depends on your passport. A PR with a Malaysian passport is visa exempt, and a PR with a Chinese, Indian, Indonesian, Philippine or Vietnamese passport needs a visa. PR holders bring their re-entry permit." },
    { category: "Do I need a visa", q: "Can I use an Italy visa for other European countries?", a: "Yes. A Schengen visa from Italy is valid across the Schengen area for the days and entries granted. Apply to Italy only if it is your main destination, or your first entry when stays are equal." },
    { category: "Applying in Singapore", q: "How do I apply for an Italy visa in Singapore?", a: "Fill in the application form, book an appointment on the BLS portal, and submit your documents in person with your original passport. The Embassy of Italy decides, and BLS only receives the file." },
    { category: "Applying in Singapore", q: "Where do I apply for an Italy visa in Singapore?", a: "At the BLS International visa application centre for Italy in Singapore. The appointment is compulsory. The BLS Contact Us page lists the current address." },
    { category: "Applying in Singapore", q: "How early can I apply for an Italy visa from Singapore?", a: "Up to 6 months before the trip and no later than 15 days before. We suggest 3 to 4 weeks ahead, longer in summer." },
    { category: "Fees and time", q: "How much is an Italy visa from Singapore?", a: "The Embassy lists EUR 90, which is S$132.80, for the fourth quarter of 2026. Children aged 6 to 12 pay S$66.40, and under 6 are free. BLS adds a S$31 service fee." },
    { category: "Fees and time", q: "How long does an Italy visa take?", a: "The Embassy says it processes applications within 15 days and normally issues the visa within 5 days. BLS says it may take at least 15 working days. Allow three weeks." },
    { category: "Fees and time", q: "What bank statements does the Embassy want?", a: "Original statements for the last 3 months with the bank's stamp, from a Singapore account. Overseas accounts are not accepted." },
    { category: "Rejections", q: "What happens if my Italy visa is refused?", a: "You receive a refusal with the stated reason, and the fee is not refunded. A consultant can review the reasons and help you decide between reapplying and an appeal." },
    { category: "Before you travel", q: "Do I need travel insurance for an Italy visa?", a: "Yes. The policy must cover medical costs, hospital care and repatriation up to EUR 30,000 or SGD 50,000, for the whole stay in the Schengen area." },
    { category: "Before you travel", q: "How much does VIZA charge?", a: "Nothing. VIZA's help is free. You pay the visa fee to the Embassy and the service fee to BLS." },
  ],

  sources: [
    { label: "Embassy of Italy in Singapore, visa fees", url: "https://ambsingapore.esteri.it/en/servizi-consolari-e-visti/servizi-per-il-cittadino-straniero/visti/visas-fees/", display: "ambsingapore.esteri.it" },
    { label: "Embassy of Italy in Singapore, issuance procedure", url: "https://ambsingapore.esteri.it/en/servizi-consolari-e-visti/servizi-per-il-cittadino-straniero/visti/issuence-procedure/", display: "ambsingapore.esteri.it" },
    { label: "Embassy of Italy in Singapore, tourist visa checklist (23 April 2026)", url: "https://ambsingapore.esteri.it/wp-content/uploads/2026/04/Tourist-Visa-Checklist-UPDATED-ON-23.04.2026.pdf", display: "ambsingapore.esteri.it" },
    { label: "BLS International, Italy visa Singapore, tourist visa", url: "https://www.blsinternational.com/italy/singapore/touristvisa.php", display: "blsinternational.com" },
    { label: "Il Visto per l'Italia, Ministry of Foreign Affairs", url: "https://vistoperitalia.esteri.it", display: "vistoperitalia.esteri.it" },
    { label: "EU travel site, ETIAS", url: "https://travel-europe.europa.eu/en/etias", display: "travel-europe.europa.eu" },
    { label: "EU travel site, Entry and Exit System", url: "https://travel-europe.europa.eu/ees/faq", display: "travel-europe.europa.eu" },
  ],

  price: {
    etaLabel: "Decision",
    etaValue: "15 days, sometimes longer",
    title: "Schengen short-stay visa · Italy",
    sub: "VIZA's help is free: form preparation and document review. The visa fee and the BLS service fee are paid at your appointment.",
    foot: "VIZA's service is free. The visa fee is paid to the Embassy of Italy and the service fee to BLS.",
  },

  aiPlaceholder: "Ask anything about an Italy visa from Singapore: BLS, fees, documents…",
};

export default italy;
