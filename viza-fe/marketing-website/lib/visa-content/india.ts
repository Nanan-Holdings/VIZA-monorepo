import type { DestinationContent } from "./types";

/**
 * India e-Tourist Visa (e-TV), framed globally (any passport that is eligible), with a section for Singapore residents.
 *
 * Checked 25 Nov 2026 against the Indian Visa Online portal. Read on the day:
 *   - https://indianvisaonline.gov.in/evisa/tvoa.html (e-Tourist visa conditions, ineligible groups, e-Arrival Card note)
 *   - https://indianvisaonline.gov.in/evisa/images/Etourist_fee_final.pdf (country-wise fee table, dated 8 Sep 2026:
 *     most passports US$25 for 30 days July to March, US$10 April to June, US$40 for 1 year, US$200 for 5 years;
 *     Singapore row 10 / 25 / 25 / 200; Indonesia 0 on all four; Malaysia and Philippines 0 for 30 days, 40 / 200 for 1 and
 *     5 years; Vietnam 10 / 25 / 40 / 200; China and Hong Kong style rows are not in the table; the note adds a 3% bank charge)
 * Not confirmed on an official page this session (kept general or flagged in the copy):
 *   - the e-TV processing time (the portal gives none; only "apply at least 4 days before arrival, up to 120 days ahead")
 *   - whether the 30-day e-TV is single, double or multiple entry (the portal says multiple, older notices said double)
 *   - the e-Arrival Card window (portal says "within 72 hours before arrival"; one airline notice says 24 to 72 hours)
 *   - the route for Chinese passport holders (regular visa through BLS International centres, resumed 2025; the e-Tourist
 *     visa fee table has no China row; e-visa for China was suspended)
 *   - the number of designated airports (the portal gives 33 in one place and 37 in another, so the page names no number)
 *   - the visa on arrival rules and e-T2 (6-month) fee, left out
 * Titles: the shared default title for this page is "India e-Visa: Requirements and How to Apply | VIZA".
 */
export const india: DestinationContent = {
  slug: "india",

  heroTitle: "India e-visa: how to apply for an Indian visa",
  lede: "An India e-visa is the online route to an Indian visa application: you apply on the government's Indian Visa Online portal, pay the fee by card and receive an Electronic Travel Authorisation by email, with no embassy visit. Singapore passports are not visa free for India, so a Singapore citizen needs one for every trip. The 30-day e-Tourist visa costs US$25 for most passports (US$10 for April to June arrivals), and passport holders from China apply through a different route. This page also covers Singapore residents on EP, S Pass, Dependant's Pass and PR.",
  heroImage: "/assets/heroes/india.jpg",
  meta: [
    { k: "Type", v: "e-Tourist visa (ETA)" },
    { k: "Stay", v: "30 days (1 and 5 year options)" },
    { k: "Fee, 30 days", v: "US$25 (US$10 Apr to Jun)" },
    { k: "Checked", v: "25 Nov 2026" },
  ],
  tags: [
    { icon: "shield", label: "Free VIZA service" },
    { icon: "doc", label: "Photo and passport check" },
    { icon: "bolt", label: "Fully online" },
  ],

  page: {
    framing: "global",

    glance: {
      needVisa: "Yes for Singapore, Indonesian, Malaysian, Philippine and Vietnamese passports (apply for the e-Tourist visa online). Chinese passport holders use a regular visa, not the e-visa",
      govFee: "US$25 for the 30-day e-Tourist visa (US$10 for April to June), plus a 3% bank charge. Fees vary by passport and are on the portal's fee table",
      processing: "Set by the government portal. Apply at least 4 days before arrival, and up to 120 days ahead",
      maxStay: "30 days on the 30-day e-visa. The 1-year and 5-year e-visas allow up to 180 days in each calendar year",
      checked: "25 November 2026",
    },

    passports: {
      intro: "India decides by passport, not by where you live. The table shows what each passport needs for a tourist trip. The country-wise fee table on the portal is the final word, so look at your own row before you pay.",
      rows: [
        { passport: "Singapore", status: "Visa required, e-Tourist visa", note: "Singapore passports are not visa free for India. The fee table lists US$25 for 30 days (July to March) and US$10 (April to June). Apply online." },
        { passport: "China (PRC)", status: "Regular visa, not the e-visa", note: "Chinese passport holders are not on the e-Tourist visa fee table. Apply for a regular tourist visa through India's visa application centre for your location, and allow extra time." },
        { passport: "Malaysia", status: "e-Tourist visa, no 30-day fee listed", note: "The fee table lists no fee for the 30-day e-visa for Malaysian passports. The 1-year visa is US$40 and the 5-year visa is US$200." },
        { passport: "India", status: "No visa needed", note: "Indian citizens enter on their own passport. Overseas Citizens of India carry their OCI card." },
        { passport: "Indonesia", status: "e-Tourist visa, no fee listed", note: "The fee table lists no fee for Indonesian passports on any of the four e-visa types. You still apply online before you travel." },
        { passport: "Philippines", status: "e-Tourist visa, no 30-day fee listed", note: "No fee for the 30-day e-visa. The 1-year visa is US$40 and the 5-year visa is US$200." },
        { passport: "Vietnam", status: "e-Tourist visa", note: "US$25 for 30 days (July to March), US$10 for April to June, US$40 for 1 year and US$200 for 5 years." },
        { passport: "Other passports", status: "Check the eligible list", note: "175 countries are on the e-visa list. Pakistani passport holders and people of Pakistani origin are not eligible, and neither are diplomatic or official passports." },
      ],
    },

    visaTypes: {
      intro: "The e-Tourist visa covers tourism, sightseeing, visiting family and friends, and short yoga programmes. It is not valid for work, and it does not cover protected, restricted or cantonment areas.",
      items: [
        { title: "30-day e-Tourist visa", body: "Valid for 30 days from your first arrival, multiple entry on the portal's description, and not extendable or convertible. This is the most common choice and the cheapest." },
        { title: "1-year e-Tourist visa", body: "Valid for 365 days from the date the authorisation is granted, multiple entry, with stay capped at 180 days in each calendar year. The fee table lists US$40 for most passports and US$25 for Singapore." },
        { title: "5-year e-Tourist visa", body: "Valid for five years from the date it is granted, with the same 180-day cap each calendar year. The fee table lists US$200 for most passports." },
        { title: "Other purposes", body: "Business, medical, work and study trips fall under different visa categories with their own rules. Check the portal before you choose, because an e-Tourist visa cannot be converted." },
      ],
    },

    residents: {
      intro: "India looks at your passport, so your Singapore pass does not change the visa or the fee. What your pass does is give you the right to return to Singapore, so keep it valid for the whole trip. Here is how each pass type applies.",
      rows: [
        { pass: "Employment Pass", body: "Apply on your own passport. Chinese, Indian and other nationalities follow the row for their passport, and the EP only matters for your return to Singapore." },
        { pass: "S Pass", body: "The same as the EP. The e-visa form asks for your passport and photo, and the portal does not ask for your pass." },
        { pass: "Dependant's Pass", body: "Each family member applies on their own passport, and children need their own application. Keep the pass valid past your return date." },
        { pass: "Permanent Resident", body: "A PR holds a passport from another country, so you apply on that passport. Being a PR does not make you eligible for anything extra." },
        { pass: "Singapore citizen", body: "You need an e-Tourist visa. Apply at least 4 days before you fly, and complete the free e-Arrival Card before you land." },
        { pass: "Student's Pass", body: "Apply on your own passport. Make sure the passport has six months of validity when you apply." },
      ],
    },

    fees: {
      intro: "The fee depends on your passport and the month you arrive. VIZA's help is free, and you pay the government fee on the portal. The fee is not refunded if the application is refused.",
      rows: [
        { item: "30-day e-Tourist visa, July to March", amount: "US$25", note: "Most passports, including Singapore and Vietnam." },
        { item: "30-day e-Tourist visa, April to June", amount: "US$10", note: "The lower rate on the fee table." },
        { item: "1-year e-Tourist visa", amount: "US$40 (Singapore US$25)", note: "Multiple entry, 180 days maximum in each calendar year." },
        { item: "5-year e-Tourist visa", amount: "US$200", note: "Multiple entry, 180 days maximum in each calendar year." },
        { item: "Indonesian, Malaysian and Philippine passports", amount: "No fee on the 30-day visa", note: "Indonesia is listed as no fee for all four types. Malaysia and the Philippines pay US$40 for 1 year and US$200 for 5 years." },
        { item: "Bank charge", amount: "3%", note: "The fee table adds 3% on applicable e-visa fees. Card payments carry 3% and PayPal 4% on the portal's payment FAQ." },
      ],
      processing: "The portal does not state a processing time. It tells you to apply at least 4 days before you arrive, and you can apply up to 120 days ahead. You pay at least 4 days before travel or the application is not processed. The result arrives by email as Granted or Rejected. Apply early in busy months, and do not book non-refundable flights until the authorisation is in your inbox.",
    },

    apply: {
      intro: "Choose how much help you want. Both routes use the same government portal, and the fee goes to the government, not to VIZA.",
      guided: {
        title: "Guided",
        body: "VIZA's AI walks you through each field, checks your passport scan and photo against the portal's rules, and you submit and pay on the portal yourself.",
      },
      fullService: {
        title: "Full-service",
        body: "A VIZA consultant fills the form, checks the files and prepares the application, so the common photo and passport mistakes are caught before they cost you the fee.",
      },
      steps: [
        { title: "Start on VIZA", body: "Tell us your passport, trip dates and the visa length you want. We confirm that the e-visa fits your passport." },
        { title: "Prepare the files", body: "Scan the passport bio page as a PDF and take a plain, square photo. We check both against the portal's size rules." },
        { title: "Apply and pay", body: "Submit on the Indian Visa Online portal and pay the fee by card at least 4 days before you arrive." },
        { title: "Receive the authorisation", body: "The Electronic Travel Authorisation comes by email. Print it or save it to your phone, and carry it with your passport." },
      ],
    },

    checklist: {
      intro: "The portal asks for a small set of files. These apply to everyone, with a few extra points by applicant type.",
      groups: [
        {
          applicant: "Everyone",
          items: [
            "Passport with at least six months of validity when you apply and two blank pages for stamps",
            "Passport bio page as a PDF, between 10 KB and 300 KB",
            "Recent photo as a JPEG, between 10 KB and 1 MB, square, full face, eyes open, plain light background, no spectacles",
            "Card to pay the fee (the portal adds a 3% charge)",
            "Return or onward ticket and your first night's address, to hand at immigration",
          ],
        },
        {
          applicant: "Singapore citizens and residents",
          items: [
            "Your Singapore pass or NRIC kept valid for your return",
            "Passport from the country you hold, not your pass, for the application",
          ],
        },
        {
          applicant: "Families and children",
          items: [
            "One application and one fee for each person, including children",
            "A child cannot be endorsed on a parent's passport, so each child needs a passport of their own",
          ],
        },
        {
          applicant: "Chinese passport holders",
          items: [
            "A regular tourist visa application through India's visa application centre for your location",
            "The documents the centre lists for tourist visas, which differ from the e-visa",
          ],
        },
      ],
    },

    travel: {
      intro: "The e-visa is one part of getting in. India also asks every foreign visitor to fill in an arrival card online.",
      items: [
        { title: "e-Arrival Card", body: "Foreign nationals and OCI cardholders complete the e-Arrival Card online before arrival. The portal says to submit it within 72 hours before you arrive, it is free, and it is not a visa. Show the QR code you receive. The Bureau of Immigration, the Indian Visa Online site and the Su-Swagatam app all host it, and a site that asks for payment is not the official one." },
        { title: "Entry airports", body: "The e-visa is valid through designated airports and seaports only. Check the current list on the portal before you book, and do not rely on a count you read elsewhere." },
        { title: "Protected areas", body: "The e-visa is not valid for protected, restricted or cantonment areas. Visiting these needs separate permission from the civil authority." },
        { title: "Extensions", body: "The e-Tourist visa cannot be extended or converted into another visa. Plan your dates before you apply." },
        { title: "Insurance", body: "Travel insurance is not part of the e-visa, but a policy that covers medical care and cancelled flights is sensible for a trip of up to 30 days." },
      ],
    },

    reviewed: {
      date: "25 November 2026",
      note: "Checked against the Indian Visa Online portal and its country-wise fee table of 8 September 2026. Fees, seasons and eligibility change, so check the links under Sources before you pay.",
    },

    related: {
      destinations: ["thailand", "malaysia", "united-arab-emirates", "saudi-arabia"],
      guides: [
        { label: "e-Visa vs visa on arrival vs embassy visa", href: "/guides/e-visa-vs-visa-on-arrival-vs-embassy-visa" },
        { label: "Visa photo requirements by country", href: "/guides/visa-photo-requirements" },
        { label: "India e-Arrival Card, on the Indian Visa Online portal", href: "https://indianvisaonline.gov.in/earrival/" },
        { label: "VIZA visa news", href: "/blog" },
      ],
    },
  },

  rejectionTitle: "Common rejection reasons",
  rejectionSub: "The fee is not refunded if an e-visa is rejected. These are the points a consultant checks before you submit.",
  rejectionReasons: [
    { title: "Photo does not meet the rules", body: "The portal asks for a JPEG between 10 KB and 1 MB, square, full face, eyes open and a plain light background. Glasses, shadows and borders cause rejections." },
    { title: "Passport scan problems", body: "The bio page must be a PDF between 10 KB and 300 KB. A cropped, blurred or partial page, or a file outside the size range, is a common reason for a return." },
    { title: "Passport validity", body: "The passport needs six months of validity when you apply and two blank pages. A passport close to expiry should be renewed first." },
    { title: "An ineligible group", body: "Pakistani passport holders, people of Pakistani origin, diplomatic and official passports, and people endorsed on a parent's or spouse's passport cannot use the e-visa. Serving or retired defence, military, security and police personnel are also not eligible." },
    { title: "Applying too late", body: "The portal expects the application and payment at least 4 days before you arrive. A late application is not processed." },
    { title: "The wrong visa type", body: "The e-Tourist visa is for tourism. Business, medical and work trips need another category, and the e-visa cannot be converted." },
  ],

  faqSub: "Can't find your answer? Ask the AI assistant below or message a VIZA consultant.",
  faq: [
    { category: "Do I need a visa", q: "Do Singaporeans need a visa for India?", a: "Yes. Singapore passports are not visa free for India. A Singapore citizen applies for the e-Tourist visa online, and the fee table lists US$25 for 30 days from July to March and US$10 for April to June." },
    { category: "Do I need a visa", q: "What is an India e-visa?", a: "It is an Electronic Travel Authorisation granted online through the Indian Visa Online portal. You upload a passport scan and a photo, pay the fee and receive the result by email, with no embassy visit." },
    { category: "Do I need a visa", q: "Can Chinese passport holders get the India e-visa?", a: "Chinese passports are not on the e-Tourist visa fee table. Chinese passport holders apply for a regular tourist visa through India's visa application centre for their location." },
    { category: "Do I need a visa", q: "Do Singapore PR and pass holders need an Indian visa?", a: "It depends on the passport you hold. India looks at the passport, so an EP, S Pass, Dependant's Pass or PR holder follows the row for their own passport." },
    { category: "Applying", q: "How do I make an Indian visa application online?", a: "Open the Indian Visa Online portal, choose the e-Tourist visa, fill in the form, upload your passport bio page and photo, and pay by card. VIZA can check the files and the form first, for free." },
    { category: "Applying", q: "How far ahead should I apply for an India e-visa?", a: "Apply at least 4 days before you arrive, and no more than 120 days ahead. Pay at least 4 days before you travel or the application is not processed." },
    { category: "Applying", q: "How long does an India e-visa take?", a: "The portal gives no processing time. It emails the result as Granted or Rejected, so apply early and do not book non-refundable flights before you receive it." },
    { category: "Applying", q: "What size should the photo and passport scan be?", a: "The photo is a JPEG between 10 KB and 1 MB, square, with a plain light background. The passport bio page is a PDF between 10 KB and 300 KB." },
    { category: "Fees and stay", q: "How much is an India e-visa?", a: "For most passports it is US$25 for 30 days (US$10 for April to June), US$40 for 1 year and US$200 for 5 years, plus a 3% bank charge. Indonesian, Malaysian and Philippine passports have no fee on the 30-day visa." },
    { category: "Fees and stay", q: "Can I extend an India e-tourist visa?", a: "No. The e-Tourist visa cannot be extended or converted. A longer stay needs a different visa applied for before you travel." },
    { category: "Before you travel", q: "Do I need the India e-Arrival Card?", a: "Yes. Foreign nationals complete it online, free, within 72 hours before arrival, and show the QR code. It is not a visa." },
    { category: "Before you travel", q: "What happens if my India e-visa is rejected?", a: "The fee is not refunded. Fix the cause, such as the photo or passport scan, and apply again. A consultant can review the files first." },
    { category: "Before you travel", q: "How much does VIZA charge?", a: "Nothing. VIZA's help is free. You pay the government fee on the portal." },
  ],

  sources: [
    { label: "Indian Visa Online, e-Tourist visa conditions", url: "https://indianvisaonline.gov.in/evisa/tvoa.html", display: "indianvisaonline.gov.in" },
    { label: "Indian Visa Online, country-wise e-Tourist visa fee", url: "https://indianvisaonline.gov.in/evisa/images/Etourist_fee_final.pdf", display: "indianvisaonline.gov.in" },
    { label: "Indian Visa Online, e-Visa home", url: "https://indianvisaonline.gov.in/evisa/", display: "indianvisaonline.gov.in" },
    { label: "Indian Visa Online, e-Arrival Card", url: "https://indianvisaonline.gov.in/earrival/", display: "indianvisaonline.gov.in" },
  ],

  price: {
    etaLabel: "Processing time",
    etaValue: "Set by the portal",
    title: "e-Tourist visa · 30 days",
    sub: "VIZA's help is free: file checks and form review. The visa fee is paid on the government portal.",
    foot: "VIZA's service is free. The India e-visa fee is paid directly to the Government of India.",
  },

  aiPlaceholder: "Ask anything about an India e-visa: fees, photo rules, e-Arrival Card…",
};

export default india;
