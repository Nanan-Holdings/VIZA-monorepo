import type { DestinationContent } from "./types";

/**
 * Australia Visitor visa (subclass 600) and ETA (subclass 601) for people living in Singapore (embassy visa,
 * framed "from Singapore"). Singapore and Malaysian passports are ETA eligible and apply in the Australian ETA
 * app. Chinese, Indian, Indonesian, Philippine and Vietnamese passports apply for the subclass 600 Tourist stream
 * online in ImmiAccount.
 *
 * Checked 25 Nov 2026. immi.homeaffairs.gov.au returned HTTP 403 to the fetcher, so facts were read through
 * search summaries of the Home Affairs pages and migration law sites, plus the 5 Jul 2026 check kept in the
 * older version of this file. Re-open these before a publish:
 *   - https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/visitor-600
 *   - https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/electronic-travel-authority-601
 *   - https://immi.homeaffairs.gov.au/visas/getting-a-visa/fees-and-charges/current-visa-pricing
 * Not confirmed on an official page this session (kept general or left out):
 *   - Subclass 600 Tourist stream charge of AUD 250 offshore and AUD 630 onshore from 1 Jul 2026, and the
 *     Frequent Traveller stream at AUD 1,845 (law firm and news summaries agree, the pricing page was not read)
 *   - ETA service fee of AUD 20 (a government embassy page was named in search summaries, not read in full)
 *   - the ETA eligible passport list, so Singapore and Malaysia rest on search summaries and the 5 Jul check
 *   - processing time figures (two trackers gave different percentiles, so none is quoted)
 *   - the photo size (45 x 35 mm is the long-standing Form 1419 size)
 *   - China checklist items (national ID, hukou, Form 54) from an embassy PDF that was not re-read
 *   - health examination and biometrics rules, so the copy only says Home Affairs may ask
 */
export const australia: DestinationContent = {
  slug: "australia",

  heroTitle: "Australia visa from Singapore",
  lede: "An Australia visa from Singapore depends on your passport, and no passport travels to Australia without some form of approval. Singapore and Malaysian passports apply for an ETA in the Australian ETA app. If you live in Singapore on a Chinese, Indian, Indonesian, Philippine or Vietnamese passport, you apply for the Visitor visa, subclass 600, which is the Australia tourist visa. This page covers the Australia visa application: the ETA, the fees from 1 July 2026, documents by pass type and the usual reasons for refusal.",
  heroImage: "/assets/heroes/australia.jpg",
  meta: [
    { k: "Singapore passport", v: "ETA, app only" },
    { k: "Tourist visa fee", v: "AUD 250 from outside Australia" },
    { k: "Apply", v: "ImmiAccount or ETA app" },
    { k: "Checked", v: "25 Nov 2026" },
  ],
  tags: [
    { icon: "shield", label: "Free VIZA service" },
    { icon: "doc", label: "Document check" },
    { icon: "bolt", label: "ETA and visa" },
  ],

  page: {
    framing: "singapore",

    glance: {
      needVisa: "Yes, for every passport. Singapore and Malaysian passports use the ETA. Chinese, Indian, Indonesian, Philippine and Vietnamese passports apply for the Visitor visa",
      govFee: "Tourist stream AUD 250 from outside Australia. ETA has no visa charge and about AUD 20 in app fees",
      processing: "ETA often within minutes to hours. The Visitor visa is set by Home Affairs, so apply 1 to 2 months ahead",
      maxStay: "ETA up to 3 months per visit. Visitor visa 3, 6 or 12 months as granted",
      checked: "25 November 2026",
    },

    passports: {
      intro: "The passport decides the route. Singapore PR and pass holders follow the rules for the passport they hold. Home Affairs keeps the list of passports that can use the ETA, and every other passport applies for a Visitor visa.",
      rows: [
        { passport: "Singapore", status: "ETA, app only", note: "Apply in the Australian ETA app with your passport and a photo. It allows visits of up to 3 months each and is valid for 12 months. Stays over 3 months need a Visitor visa." },
        { passport: "China (PRC)", status: "Visitor visa required", note: "Chinese passports cannot use the ETA. Chinese passport holders living in Singapore apply for the Visitor visa, subclass 600, in ImmiAccount." },
        { passport: "Malaysia", status: "ETA, app only", note: "Malaysia is on the ETA list, so Malaysians living in Singapore apply in the ETA app." },
        { passport: "India", status: "Visitor visa required", note: "Apply for the Visitor visa online. Bring proof of your job, your pass and your savings." },
        { passport: "Indonesia", status: "Visitor visa required", note: "Apply for the Visitor visa online in ImmiAccount." },
        { passport: "Philippines", status: "Visitor visa required", note: "Apply for the Visitor visa online. Allow extra time to prepare your bank statements." },
        { passport: "Vietnam", status: "Visitor visa required", note: "Apply for the Visitor visa online in ImmiAccount." },
        { passport: "Other passports", status: "Check Home Affairs", note: "Some European passports use the eVisitor visa, and some Asian and North American passports use the ETA. Home Affairs has a tool for your passport." },
      ],
    },

    visaTypes: {
      intro: "Australia has several ways to visit. Most people in Singapore travelling for a holiday or to see family use the ETA or the Visitor visa.",
      items: [
        { title: "ETA, subclass 601", body: "For eligible passports. You apply in the Australian ETA app, there is no visa charge and the app adds a service fee of about AUD 20. It allows multiple visits over 12 months, up to 3 months each." },
        { title: "Visitor visa, subclass 600, Tourist stream", body: "The Australia tourist visa. It covers holidays and family visits. Home Affairs grants a stay of 3, 6 or 12 months and decides single or multiple entry. 3 months is the most common for tourism." },
        { title: "Frequent Traveller stream", body: "A longer visa for people who travel to Australia often. It costs AUD 1,845 and is granted for up to 10 years, with each stay of up to 3 months." },
        { title: "Work, study and other visas", body: "Working, studying or living in Australia needs a different visa. A visitor visa does not allow work, and study is limited." },
      ],
    },

    residents: {
      intro: "You apply online and, for the Visitor visa, upload your documents in ImmiAccount. Your pass shows that you live in Singapore, which helps the officer see your ties and your plan to return.",
      rows: [
        { pass: "Employment Pass", body: "Bring your EP card, an employment letter with your role, salary and approved leave, and 3 to 6 months of bank statements. This is the most common route for Chinese and Indian passport holders working in Singapore." },
        { pass: "S Pass", body: "Bring your S Pass card, the employment letter and bank statements. The checklist matches the Employment Pass." },
        { pass: "Dependant's Pass", body: "Bring your Dependant's Pass and a copy of the main holder's pass. Add the marriage or birth certificate and the main holder's bank statements with a support letter." },
        { pass: "Permanent Resident", body: "Bring your PR card or re-entry permit and proof of your work or business in Singapore. You apply with the passport of your own country, and the Singapore ETA rule does not apply to you." },
        { pass: "Singapore citizen", body: "Apply for an ETA in the app before you fly. Keep the approval linked to your passport and use the passport gates where they are available." },
        { pass: "Student's Pass", body: "Bring your Student's Pass and a school letter with your term dates. A parent can support the trip with a letter and their bank statements." },
      ],
    },

    fees: {
      intro: "Home Affairs sets the visa charge and you pay it to Home Affairs. VIZA's help is free. The charge is set on the day you lodge, so a later rise does not change an application you have already lodged.",
      rows: [
        { item: "Visitor visa, Tourist stream, outside Australia", amount: "AUD 250", note: "From 1 July 2026. It was AUD 200 before." },
        { item: "Visitor visa, Tourist stream, inside Australia", amount: "AUD 630", note: "From 1 July 2026. It was AUD 500 before." },
        { item: "Frequent Traveller stream", amount: "AUD 1,845", note: "From 1 July 2026. It was AUD 1,480 before." },
        { item: "ETA, subclass 601", amount: "No visa charge", note: "The ETA app adds a service fee of about AUD 20, which is not refundable." },
      ],
      processing: "Home Affairs publishes processing times for the Visitor visa and updates them each month, so check the page before you lodge. Apply 1 to 2 months before you travel and wait for the grant before you book flights. An ETA is often decided within minutes to hours and can take longer.",
    },

    apply: {
      intro: "Choose the route first. Singapore and Malaysian passports use the ETA app. Every other passport uses the online Visitor visa form in ImmiAccount.",
      guided: {
        title: "Guided",
        body: "VIZA's AI walks you through the form and the document list for your pass type. You lodge in ImmiAccount or the ETA app yourself and keep control of every answer.",
      },
      fullService: {
        title: "Full-service",
        body: "A VIZA consultant prepares your answers, checks that your bank statements, employment letter and itinerary agree and prepares the file for lodging.",
      },
      steps: [
        { title: "Check your route", body: "We confirm whether your passport can use the ETA or needs the Visitor visa, and how long you plan to stay." },
        { title: "Prepare the file", body: "Gather your passport, photo, bank statements, employment letter and a simple plan for the trip." },
        { title: "Lodge online", body: "Lodge the Visitor visa in ImmiAccount, or apply for the ETA in the Australian ETA app. Pay the charge yourself." },
        { title: "Wait for the grant", body: "Home Affairs emails the decision. The visa is linked to your passport, so nothing is stuck in it. Do not book non-refundable flights before the grant." },
      ],
    },

    checklist: {
      intro: "Home Affairs asks for a core set and may ask for more. The list below is the common core. Always compare it with the latest form before you lodge.",
      groups: [
        {
          applicant: "Everyone",
          items: [
            "Passport valid for your whole stay, and ideally 6 months more",
            "Recent colour photo",
            "Bank statements for the last 3 to 6 months",
            "Employment letter with approved leave, or business registration",
            "A simple itinerary and your ties to Singapore",
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
            "Birth certificate and consent form for a child travelling without both parents",
          ],
        },
        {
          applicant: "Chinese passport holders",
          items: [
            "National ID, both sides",
            "Household register (hukou) page, if asked",
            "Application form that the Home Affairs checklist lists for Chinese applicants",
          ],
        },
      ],
    },

    travel: {
      intro: "The ETA or visa lets you travel. Border Force decides at the airport whether you can enter.",
      items: [
        { title: "Visa is linked to your passport", body: "Nothing is stamped on arrival. Hold your ETA or Visitor visa before you board, and use the same passport as in the application." },
        { title: "Incoming Passenger Card", body: "Every arrival completes an Incoming Passenger Card. It asks about biosecurity, so read the questions carefully." },
        { title: "Biosecurity", body: "Declare food, plant and animal goods. Fines for a false declaration are heavy, and the officers check bags." },
        { title: "SmartGate", body: "Singapore and Chinese e-passports can use SmartGate at major airports." },
        { title: "Staying longer or overstaying", body: "A visitor visa cannot be extended. You lodge a new application before it ends. An overstay of 28 days or more can lead to a 3 year ban on coming back." },
      ],
    },

    reviewed: {
      date: "25 November 2026",
      note: "Checked against the Australian Department of Home Affairs and the Australian High Commission. Fees and rules change, so look at the links under Sources before you pay.",
    },

    related: {
      destinations: ["indonesia", "malaysia", "vietnam", "thailand"],
      guides: [
        { label: "Visas for Chinese passport holders in Singapore", href: "/guides/visas-chinese-passport-holders-singapore" },
        { label: "Visas for Filipino and Indian residents of Singapore", href: "/guides/visas-filipino-indian-residents-singapore" },
        { label: "ETA vs visa: UK, Australia, Korea and Canada", href: "/guides/eta-vs-visa" },
        { label: "Visa refused: why it happens and how to reapply", href: "/guides/visa-refused-reapply" },
        { label: "Visa photo requirements by country", href: "/guides/visa-photo-requirements" },
        { label: "Home Affairs: visa processing times", href: "https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-processing-times/global-visa-processing-times" },
        { label: "VIZA visa news", href: "/blog" },
      ],
    },
  },

  rejectionTitle: "Common rejection reasons",
  rejectionSub: "Home Affairs decides each visitor application on its own file. These are the points a consultant checks first.",
  rejectionReasons: [
    { title: "Not clear you will go home", body: "The officer needs to believe you are a genuine visitor. Weak ties, such as a short pass, no employment letter or a vague purpose, are the most common problem." },
    { title: "Funds that are unexplained", body: "Statements that do not show steady savings or income, or large deposits just before you apply, raise questions about who pays for the trip." },
    { title: "Incomplete or unclear documents", body: "A missing employment letter, scans that are hard to read or missing identity papers cause delays and refusals." },
    { title: "Wrong information", body: "A false or misleading statement can lead to refusal and a ban on applying again. Answer every question honestly." },
    { title: "Earlier visa problems", body: "An earlier overstay or breach of a visa condition needs a clear explanation." },
    { title: "Health or character concerns", body: "Health requirements and character grounds, such as a criminal record, can lead to refusal." },
  ],

  faqSub: "Can't find your answer? Ask the AI assistant below or message a VIZA consultant.",
  faq: [
    { category: "Do I need a visa", q: "Do Singaporeans need a visa for Australia?", a: "Singapore passport holders need an ETA, which you apply for in the Australian ETA app. It allows visits of up to 3 months each over 12 months. Longer stays need a Visitor visa." },
    { category: "Do I need a visa", q: "What is the Australia visa ETA?", a: "The ETA, subclass 601, is an app-only travel authority for eligible passports. There is no visa charge and the app adds a service fee of about AUD 20. It is linked to your passport." },
    { category: "Do I need a visa", q: "Do Chinese passport holders living in Singapore need an Australia tourist visa?", a: "Yes. Chinese passports cannot use the ETA, so you apply for the Visitor visa, subclass 600, online in ImmiAccount." },
    { category: "Do I need a visa", q: "Do Indians, Indonesians, Filipinos and Vietnamese in Singapore need a visa?", a: "Yes. Each applies for the Visitor visa online, with proof of work, savings and ties to Singapore." },
    { category: "Applying in Singapore", q: "How do I make an Australia visa application from Singapore?", a: "Check your passport route. Singapore and Malaysian passports use the ETA app. Other passports lodge the Visitor visa in ImmiAccount and upload their documents." },
    { category: "Applying in Singapore", q: "Where do I apply, and do I need to go anywhere?", a: "Everything is online. You lodge in ImmiAccount or the ETA app from Singapore. Home Affairs tells you if it needs health checks or biometrics." },
    { category: "Applying in Singapore", q: "How long can I stay on the tourist visa?", a: "Home Affairs grants 3, 6 or 12 months per entry and decides single or multiple entry. 3 months is the most common for tourism." },
    { category: "Fees and time", q: "How much is the Australia tourist visa?", a: "From 1 July 2026 the Tourist stream charge is AUD 250 from outside Australia. The Frequent Traveller stream is AUD 1,845. The ETA has no visa charge and about AUD 20 in app fees." },
    { category: "Fees and time", q: "How long does the Australia visa take?", a: "An ETA is often decided within minutes to hours. For the Visitor visa, Home Affairs publishes processing times that change each month, so apply 1 to 2 months before you travel." },
    { category: "Fees and time", q: "Can I extend my Australia visitor visa?", a: "No. You lodge a new application before your current visa ends. The charge inside Australia is AUD 630 and some visas carry a no further stay condition." },
    { category: "Rejections", q: "What happens if my Australia visa is refused?", a: "Home Affairs keeps the charge and sends the reasons. The most common one is that the officer was not sure you are a genuine visitor. Review it with a consultant before you apply again." },
    { category: "Before you travel", q: "Do I need an arrival card for Australia?", a: "Yes. Every arrival completes an Incoming Passenger Card with biosecurity questions. A digital version is being tested on some routes." },
    { category: "Before you travel", q: "How much does VIZA charge?", a: "Nothing. VIZA's help is free. You pay the Home Affairs charge directly." },
  ],

  sources: [
    { label: "Home Affairs, Visitor visa (subclass 600)", url: "https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/visitor-600", display: "immi.homeaffairs.gov.au" },
    { label: "Home Affairs, Electronic Travel Authority (subclass 601)", url: "https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/electronic-travel-authority-601", display: "immi.homeaffairs.gov.au" },
    { label: "Home Affairs, current visa pricing", url: "https://immi.homeaffairs.gov.au/visas/getting-a-visa/fees-and-charges/current-visa-pricing", display: "immi.homeaffairs.gov.au" },
    { label: "Home Affairs, global visa processing times", url: "https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-processing-times/global-visa-processing-times", display: "immi.homeaffairs.gov.au" },
    { label: "ImmiAccount", url: "https://online.immi.gov.au/lusc/login", display: "online.immi.gov.au" },
    { label: "Australian Border Force, Incoming Passenger Card", url: "https://www.abf.gov.au/entering-and-leaving-australia/crossing-the-border/at-the-border/incoming-passenger-card-(ipc)", display: "abf.gov.au" },
    { label: "Australian High Commission Singapore, visas and migration", url: "https://singapore.highcommission.gov.au/sing/Visas_and_Migration.html", display: "singapore.highcommission.gov.au" },
  ],

  price: {
    etaLabel: "Processing time",
    etaValue: "Set by Home Affairs",
    title: "Visitor visa or ETA",
    sub: "VIZA's help is free: form preparation and document review. The visa charge is paid to Home Affairs.",
    foot: "VIZA's service is free. Any Australia visa charge is paid directly to the Department of Home Affairs.",
  },

  aiPlaceholder: "Ask anything about an Australia visa from Singapore: ETA, fees, documents…",
};

export default australia;
