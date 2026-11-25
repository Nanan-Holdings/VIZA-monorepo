import type { DestinationContent } from "./types";

/**
 * Saudi Arabia tourist eVisa (e-visa product anyone on an eligible passport can apply for online, framed
 * globally, with a section for Singapore residents). Applications are made on visa.visitsaudi.com.
 * Checkout behaviour is unchanged (it comes from lib/countries.ts).
 *
 * Checked 25 Nov 2026. The portal (visa.visitsaudi.com, visitsaudi.com) returned HTTP 403 or no content to
 * automated fetches, so facts come from the Wego guide updated 12 Nov 2026, Wikipedia's visa policy page and
 * the July 2026 checks in the previous version of this file. Re-open these before a publish:
 *   - https://visa.visitsaudi.com (eligible countries, price at checkout, terms and conditions)
 *   - https://www.visitsaudi.com/en/plan-your-trip/visa-regulations
 * Not confirmed on an official page this session (kept general, hedged or left out):
 *   - The visa total. Guides disagree: SAR 535 (Wego, Nov 2026), SAR 300 base plus insurance and VAT, and one
 *     report of about SAR 395. The copy says the portal sets the price and shows it at checkout
 *   - Whether 90 days is per visit (earlier terms) or a total in the visa year (Wego). The copy says "up to 90
 *     days" and tells people to read the portal terms
 *   - Eligibility of India and Indonesia (a package eVisa scheme from July 2026 is reported by Wikipedia only),
 *     and of the Philippines and Vietnam (not on any list read)
 *   - The US, UK and Schengen visa holder route and visa on arrival (Wego and Wikipedia only)
 *   - Overstay fines (Saudi Press Agency, read in July 2026, not re-read)
 *   - Photo specification and the processing time (no published service level)
 *   - Whether the Singapore MFA travel advisory for the region is still in force
 */
export const saudiArabia: DestinationContent = {
  slug: "saudi-arabia",

  heroTitle: "Saudi e-Visa: Saudi Arabia visa requirements",
  lede: "The Saudi Arabia visa for tourists is an online eVisa. If your passport is on the eligible list, you apply on the government portal, pay the fee shown at checkout, and the visa usually arrives by email within hours. It is valid for one year with multiple entries and allows stays of up to 90 days. Singapore, Chinese and Malaysian passports are on the list. This guide covers the Saudi visa for any traveller, with a section for people who live in Singapore.",
  heroImage: "/assets/heroes/saudi-arabia.jpg",
  meta: [
    { k: "Type", v: "Tourist eVisa, multiple entry" },
    { k: "Validity", v: "1 year" },
    { k: "Stay", v: "Up to 90 days" },
    { k: "Checked", v: "25 Nov 2026" },
  ],
  tags: [
    { icon: "shield", label: "Free VIZA service" },
    { icon: "doc", label: "Document check" },
    { icon: "bolt", label: "Online eVisa" },
  ],

  page: {
    framing: "global",

    glance: {
      needVisa: "Yes for most passports. Singapore, Chinese and Malaysian passports apply for the eVisa online",
      govFee: "Set by the government portal and shown at checkout. It includes mandatory medical insurance",
      processing: "Often minutes to a few hours. No fixed time is published, so apply a week ahead",
      maxStay: "Up to 90 days, one year validity, multiple entry",
      checked: "25 November 2026",
    },

    passports: {
      intro: "The eVisa is open to citizens of an eligible list of countries, which Saudi Arabia keeps on the portal and has been extending in 2026. The table shows the passports most common among people in Singapore. Check the portal for your passport before you book flights.",
      rows: [
        { passport: "Singapore", status: "eVisa, apply online", note: "Singapore is on the eligible list. You apply on the portal with your passport and a photo, and you pay online." },
        { passport: "China (PRC)", status: "eVisa, apply online", note: "China, including Hong Kong and Macau, is on the eligible list in the guides we read. Confirm on the portal." },
        { passport: "Malaysia", status: "eVisa, apply online", note: "Malaysia is on the eligible list in the guides we read. Confirm on the portal." },
        { passport: "India", status: "Check the portal", note: "India is not on the standard list we read. Saudi Arabia announced a package eVisa scheme in 2026, so look at the portal for the current rule." },
        { passport: "Indonesia", status: "Check the portal", note: "Indonesia is not on the standard list we read. Look at the portal for the package eVisa scheme and the current rule." },
        { passport: "Philippines", status: "Not on the lists we read", note: "Ask the Saudi embassy about a regular visa, or check the portal for a change." },
        { passport: "Vietnam", status: "Not on the lists we read", note: "Ask the Saudi embassy about a regular visa, or check the portal for a change." },
        { passport: "Other passports", status: "Check the portal", note: "Citizens of the US, Canada, the UK, most of Europe, Japan, South Korea, Australia and New Zealand are among the eligible nationalities. The portal lists the rest." },
      ],
    },

    visaTypes: {
      intro: "Saudi Arabia issues several visas. Most visitors from Singapore want the tourist eVisa. These are the ones you may meet.",
      items: [
        { title: "Tourist eVisa", body: "Valid for one year with multiple entries, and a stay of up to 90 days. It covers tourism, family visits, events and Umrah. It does not cover the annual Hajj, which has its own visa through licensed operators." },
        { title: "Visa for holders of US, UK or Schengen visas", body: "Visitors with a valid US, UK or Schengen visa that they have used before may qualify for an eVisa through a separate route. The portal states the conditions." },
        { title: "Stopover visa", body: "A free stopover visa of up to 96 hours is offered to passengers transiting on Saudia or flynas, according to the guides we read. Check the airline page." },
        { title: "Work, residence and business visas", body: "Work and long stays need a different visa, applied for through the employer or the Saudi embassy. The tourist eVisa does not allow work." },
      ],
    },

    residents: {
      intro: "The eVisa rule follows your passport, not your pass. Your Singapore pass shows that you live here, and it helps with proof of address, but it does not make a passport eligible. A passport that is not on the list needs the embassy route.",
      rows: [
        { pass: "Employment Pass", body: "An EP holder with a Singapore, Chinese or Malaysian passport applies for the eVisa online. A holder with an Indian, Indonesian, Philippine or Vietnamese passport checks the portal list first. Keep the passport valid for six months from your arrival date." },
        { pass: "S Pass", body: "The same as the Employment Pass. The eVisa depends on the passport, so check the list for the passport you will travel on." },
        { pass: "Dependant's Pass", body: "Each family member applies on their own passport, including children. Use the same email and keep each person's passport details exact." },
        { pass: "Permanent Resident", body: "You apply with the passport of your own country. A Malaysian or Chinese PR applies for the eVisa. An Indian or Indonesian PR checks the portal for the current rule." },
        { pass: "Singapore citizen", body: "Apply for the eVisa online with your Singapore passport. Travel on the same passport you used to apply." },
        { pass: "Student's Pass", body: "The eVisa follows the passport. For a school trip or a family visit, a student applies on the portal in the same way as any traveller." },
      ],
    },

    fees: {
      intro: "The government portal sets the fee and shows the total at checkout. It includes the mandatory medical insurance. Guides in November 2026 give different totals, so look at the portal rather than a third-party page. VIZA's help is free.",
      rows: [
        { item: "eVisa fee", amount: "Set by the portal", note: "Paid once, online, by card. The fee is not refunded if the visa is refused." },
        { item: "Medical insurance", amount: "Included in the total", note: "Mandatory cover for emergency treatment during the stay. The portal shows the provider and premium." },
        { item: "VIZA service", amount: "Free", note: "VIZA charges nothing. You pay the government on the portal." },
        { item: "Extension", amount: "Not available", note: "To stay longer, leave and apply for a new visa. Plan your days inside the 90 day limit." },
      ],
      processing: "Most applications are decided within minutes to a few hours. Some need extra checks, which can take 24 to 48 hours. No fixed time is published, so apply at least a week before you fly. Do not book non-refundable flights before the visa arrives by email.",
    },

    apply: {
      intro: "The portal is an online form, so the risk is small mistakes: a wrong passport number, a photo that fails, or a name that does not match. Choose how much help you want.",
      guided: {
        title: "Guided",
        body: "VIZA's AI walks you through the form and the photo rules, and you submit and pay on the government portal yourself. It suits people who like to keep each step in their own hands.",
      },
      fullService: {
        title: "Full-service",
        body: "A VIZA consultant checks your passport details, photo and answers before you submit, and tells you what to carry, so a small error does not cost you the fee.",
      },
      steps: [
        { title: "Start on VIZA", body: "Upload your passport and trip dates. We confirm that your passport is on the eligible list." },
        { title: "Check the file", body: "We check the passport details, the photo and the email address against the portal's rules." },
        { title: "Submit and pay", body: "Submit on visa.visitsaudi.com and pay the total shown, which includes the insurance. Keep the receipt." },
        { title: "Download the visa", body: "The eVisa arrives by email. Print a copy and keep a digital copy, and travel on the same passport you applied with." },
      ],
    },

    checklist: {
      intro: "The online form is short. The list below is what to have ready, and what to carry when you fly. The portal terms are the final rule.",
      groups: [
        {
          applicant: "Everyone",
          items: [
            "Passport valid for at least 6 months from your date of entry",
            "Recent passport-style photo on a white background",
            "Email address that you can open, for the visa",
            "Card for the online payment",
            "Return ticket and your first hotel address, to show at the airport",
          ],
        },
        {
          applicant: "Employment Pass and S Pass holders",
          items: [
            "Passport for the country on the eligible list",
            "Valid pass for your return to Singapore",
            "Employer leave approval if the airline asks about the trip",
          ],
        },
        {
          applicant: "Dependant's Pass and children",
          items: [
            "A separate application for each person, children included",
            "Each passport valid for 6 months from entry",
            "Parents' details ready for a child's form",
          ],
        },
        {
          applicant: "Permanent Resident and student",
          items: [
            "The passport of your own country, not a Singapore passport",
            "Valid re-entry permit or Student's Pass for your return",
            "Printed or digital copy of the eVisa",
          ],
        },
      ],
    },

    travel: {
      intro: "The visa is the first step. Saudi Arabia has rules that surprise first-time visitors, so read these before you fly.",
      items: [
        { title: "Same passport", body: "Travel on the passport you applied with. A different passport means a different visa." },
        { title: "Mecca and Medina", body: "Mecca is closed to non-Muslims, and part of Medina is too. The eVisa allows Umrah for Muslim visitors but not Hajj." },
        { title: "Local laws", body: "Alcohol is banned, and dress in public places should be modest. Photographing people without their permission is not acceptable." },
        { title: "Overstaying", body: "Leave within the days you are allowed. The Saudi Press Agency has reported fines of SAR 15,000 for a first overstay, with higher fines, jail and bans for repeats. The visa cannot be extended." },
        { title: "Travel advice", body: "The Singapore Ministry of Foreign Affairs publishes a travel advisory for Saudi Arabia and the region. Read the current version before you book." },
      ],
    },

    reviewed: {
      date: "25 November 2026",
      note: "Checked against the Saudi visa portal information and recent guides. The portal blocked automated checks, so look at the links under Sources and the price at checkout before you pay.",
    },

    related: {
      destinations: ["united-arab-emirates", "egypt", "turkiye", "india"],
      guides: [
        { label: "e-Visa vs visa on arrival vs embassy visa", href: "/guides/e-visa-vs-visa-on-arrival-vs-embassy-visa" },
        { label: "Saudi eVisa portal, apply and check eligibility", href: "https://visa.visitsaudi.com" },
        { label: "VIZA visa news", href: "/blog" },
      ],
    },
  },

  rejectionTitle: "Common rejection reasons",
  rejectionSub: "The portal does not explain a refusal in detail, and the fee is not refunded. These are the mistakes a consultant checks before you submit.",
  rejectionReasons: [
    { title: "Passport is not eligible", body: "The eligible list changes. A passport that is not on it is refused, so check the list on the portal before you pay." },
    { title: "Passport details do not match", body: "A typo in the passport number, a wrong date or a name that differs from the passport page leads to a refusal." },
    { title: "Passport validity too short", body: "The passport must be valid for at least 6 months from your date of entry." },
    { title: "Photo does not pass", body: "A photo with a shadow, the wrong background or the wrong size fails the portal's checks." },
    { title: "Earlier overstay or entry ban", body: "A past overstay or ban in Saudi Arabia is a reason for refusal. Declare it and ask for advice first." },
  ],

  faqSub: "Can't find your answer? Ask the AI assistant below or message a VIZA consultant.",
  faq: [
    { category: "Do I need a visa", q: "Do Singaporeans need a visa for Saudi Arabia?", a: "Yes. Singapore passport holders apply for the Saudi eVisa online on the government portal. It is valid for one year with multiple entries and allows stays of up to 90 days." },
    { category: "Do I need a visa", q: "Do Chinese and Malaysian passport holders in Singapore need a Saudi visa?", a: "Yes. China and Malaysia are on the eligible list in the guides we read, so you apply for the same eVisa online. Confirm your passport on the portal." },
    { category: "Do I need a visa", q: "Can Indian, Indonesian, Philippine or Vietnamese passport holders get the Saudi eVisa?", a: "These passports are not on the standard list we read. Saudi Arabia announced a package eVisa scheme in 2026 that may apply to some of them. Check the portal, or ask the Saudi embassy about a regular visa." },
    { category: "Do I need a visa", q: "Does my Employment Pass or PR change the Saudi visa rule?", a: "No. The eVisa depends on your passport. Your pass shows that you live in Singapore, and you need it to return." },
    { category: "Applying", q: "How do I apply for a Saudi visa from Singapore?", a: "Apply on visa.visitsaudi.com with your passport details, a photo and your email, then pay online. The visa arrives by email. Print a copy to carry." },
    { category: "Applying", q: "Is the Saudi visa online?", a: "Yes. It is an eVisa, applied for and issued online, and you do not send your passport anywhere." },
    { category: "Applying", q: "What is the Saudi eVisa for?", a: "Tourism, family visits, events and Umrah. It does not allow work, and it does not cover the annual Hajj." },
    { category: "Fees and time", q: "How much is the Saudi visa?", a: "The portal sets the fee and shows the total at checkout, including mandatory medical insurance. Guides give different totals, so use the portal. The fee is not refunded if the visa is refused." },
    { category: "Fees and time", q: "How long does the Saudi visa take?", a: "Often minutes to a few hours, and sometimes 24 to 48 hours if extra checks are needed. No fixed time is published, so apply at least a week before you fly." },
    { category: "Fees and time", q: "How long can I stay in Saudi Arabia on the eVisa?", a: "Up to 90 days. The visa is valid for one year with multiple entries. The portal terms say exactly how the 90 days are counted, so read them before you plan a long trip." },
    { category: "Rejections", q: "What if my Saudi eVisa is refused?", a: "The fee is not refunded. A consultant can check the passport details and photo for the likely cause, and you can apply again once it is fixed." },
    { category: "Before you travel", q: "How long must my passport be valid for Saudi Arabia?", a: "At least 6 months from the date you enter. Travel on the passport you used to apply." },
    { category: "Before you travel", q: "How much does VIZA charge?", a: "Nothing. VIZA's help is free. You pay the visa fee to the government on the portal." },
  ],

  sources: [
    { label: "Saudi eVisa portal, Ministry of Tourism", url: "https://visa.visitsaudi.com", display: "visa.visitsaudi.com" },
    { label: "Visit Saudi, visa regulations", url: "https://www.visitsaudi.com/en/plan-your-trip/visa-regulations", display: "visitsaudi.com" },
    { label: "KSA Visa unified platform, tourism visa", url: "https://ksavisa.sa/visa/tourism/details", display: "ksavisa.sa" },
    { label: "Saudi Press Agency, overstay penalties", url: "https://www.spa.gov.sa/en/N2303510", display: "spa.gov.sa" },
    { label: "Singapore Ministry of Foreign Affairs, travel advisories", url: "https://www.mfa.gov.sg/travelling-overseas/travel-advisories-notices-and-visa-information/saudi-arabia/", display: "mfa.gov.sg" },
  ],

  price: {
    etaLabel: "Processing time",
    etaValue: "Minutes to a few hours",
    title: "Tourist eVisa · 1 year multiple entry",
    sub: "VIZA's help is free: form preparation and document review. The visa fee is paid to the government on the portal.",
    foot: "VIZA's service is free. The Saudi visa fee is paid directly on the government portal.",
  },

  aiPlaceholder: "Ask anything about the Saudi eVisa: eligibility, fees, Singapore residents…",
};

export default saudiArabia;
