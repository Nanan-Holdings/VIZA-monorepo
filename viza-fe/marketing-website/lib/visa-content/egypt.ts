import type { DestinationContent } from "./types";

/**
 * Egypt tourist e-Visa (e-visa product anyone on an eligible passport can apply for online, framed globally,
 * with a section for Singapore residents). Applications are made on visa2egypt.gov.eg. Checkout behaviour is
 * unchanged (it comes from lib/countries.ts).
 *
 * Checked 25 Nov 2026. The official portal FAQ (visa2egypt.gov.eg/eVisa/FAQ) was read directly: fees of USD 30
 * single and USD 65 multiple entry, the eligible country list, 6 month passport validity, documents to carry.
 * Singapore, China, India, Malaysia and Vietnam are on the list. Indonesia and the Philippines are not.
 * Not confirmed on an official page this session (kept general, hedged or left out):
 *   - Validity (single entry 3 months, multiple 6 months from issue) and the 30 day stay per entry: reported by
 *     guides and by the previous version of this file, not shown on the portal's public pages
 *   - A fee rise to USD 33 single entry from 1 Jan 2027 (reported by an ETAA circular, via atta.travel and
 *     Wego). The portal still showed USD 30 and USD 65. Check again in December
 *   - Processing time. The portal only says to apply at least 7 days ahead. "5 to 7 business days" is not used
 *   - Visa on arrival at USD 30 from 1 Mar 2026 (guides only)
 *   - Extension and overstay fines (no official tariff online), and the paper arrival card
 *   - The Egyptian embassy route for Indonesian and Philippine passports from Singapore (not researched)
 */
export const egypt: DestinationContent = {
  slug: "egypt",

  heroTitle: "Egypt e-Visa: tourist visa requirements",
  lede: "The Egypt e-visa is an online tourist visa, issued on the government portal visa2egypt.gov.eg. You apply with your passport details, pay by card, and the visa is emailed to you. The fee is USD 30 for a single entry and USD 65 for multiple entries. Singapore, Chinese, Indian, Malaysian and Vietnamese passports are on the eligible list, and Indonesian and Philippine passports are not. This guide covers the Egypt e-visa for any traveller, with a section for people who live in Singapore.",
  heroImage: "/assets/heroes/egypt.jpg",
  meta: [
    { k: "Single entry fee", v: "USD 30" },
    { k: "Multiple entry fee", v: "USD 65" },
    { k: "Apply on", v: "visa2egypt.gov.eg" },
    { k: "Checked", v: "25 Nov 2026" },
  ],
  tags: [
    { icon: "shield", label: "Free VIZA service" },
    { icon: "doc", label: "Document check" },
    { icon: "bolt", label: "Online e-Visa" },
  ],

  page: {
    framing: "global",

    glance: {
      needVisa: "Yes for most passports. Singapore, Chinese, Indian, Malaysian and Vietnamese passports apply for the e-Visa online",
      govFee: "USD 30 single entry, USD 65 multiple entry, paid by card on the portal",
      processing: "The portal says to apply at least 7 days before you fly. No fixed time is published",
      maxStay: "30 days per entry, as reported by guides. Confirm in your application",
      checked: "25 November 2026",
    },

    passports: {
      intro: "The portal lists the nationalities that can apply for the e-Visa. The table shows the passports most common among people in Singapore. A passport that is not on the list applies through an Egyptian embassy.",
      rows: [
        { passport: "Singapore", status: "e-Visa, apply online", note: "Singapore is on the portal's eligible list. Apply online, pay by card and print the visa." },
        { passport: "China (PRC)", status: "e-Visa, apply online", note: "China is on the eligible list. Chinese passport holders in Singapore apply on the same portal." },
        { passport: "Malaysia", status: "e-Visa, apply online", note: "Malaysia is on the eligible list." },
        { passport: "India", status: "e-Visa, apply online", note: "India is on the eligible list. Indian passport holders in Singapore apply online with their passport details." },
        { passport: "Indonesia", status: "Not on the e-Visa list", note: "Indonesia is not on the portal's list. Apply through an Egyptian embassy or consulate, or ask the airline about arrival options." },
        { passport: "Philippines", status: "Not on the e-Visa list", note: "The Philippines is not on the portal's list. Apply through an Egyptian embassy or consulate." },
        { passport: "Vietnam", status: "e-Visa, apply online", note: "Vietnam is on the eligible list." },
        { passport: "Other passports", status: "Check the portal", note: "The portal lists about 80 nationalities, including the US, the UK, Canada, Australia, Japan, South Korea and most of Europe. Nationals of some Gulf states enter without a visa." },
      ],
    },

    visaTypes: {
      intro: "For a holiday you choose between single and multiple entry. The visa is for tourism, and other purposes use other visas.",
      items: [
        { title: "Single entry e-Visa", body: "One entry for tourism, at USD 30. Guides report a validity of about three months from issue and a stay of up to 30 days. This suits one trip." },
        { title: "Multiple entry e-Visa", body: "Several entries at USD 65, reported as valid for about six months from issue, with up to 30 days each stay. It suits a trip where you leave Egypt and come back." },
        { title: "Visa on arrival", body: "Some passports can buy a visa at the airport, reported at USD 30 since 1 March 2026. Queues can be long, and the e-Visa lets you skip that step." },
        { title: "Embassy visa and other purposes", body: "Passports not on the e-Visa list, and work, study and long stays, use a visa from an Egyptian embassy or consulate." },
      ],
    },

    residents: {
      intro: "Your Singapore pass does not change the Egypt rule, because the passport decides. It matters for your return to Singapore, and for the Indonesian and Philippine passports that need the embassy route.",
      rows: [
        { pass: "Employment Pass", body: "An EP holder with a Singapore, Chinese, Indian, Malaysian or Vietnamese passport applies for the e-Visa online. An Indonesian or Philippine passport holder applies through an Egyptian embassy. Keep the passport valid for 6 months from arrival." },
        { pass: "S Pass", body: "The same as the Employment Pass. The passport decides, and the S Pass must stay valid for your return." },
        { pass: "Dependant's Pass", body: "Each family member applies on their own passport and pays their own fee. Children need their own e-Visa." },
        { pass: "Permanent Resident", body: "You travel on the passport of your own country. A Malaysian, Chinese, Indian or Vietnamese PR applies online. An Indonesian or Philippine PR uses the embassy route." },
        { pass: "Singapore citizen", body: "Apply for the e-Visa online with your Singapore passport. Carry a printed copy, and a hotel booking or itinerary." },
        { pass: "Student's Pass", body: "The passport decides. A student on an eligible passport applies online, and carries a school letter with the Student's Pass for the return." },
      ],
    },

    fees: {
      intro: "The fee is set by the Egyptian government and paid by card on the portal. It was USD 30 and USD 65 when we checked. A rise for 2027 has been reported, so look at the portal before you pay. VIZA's help is free.",
      rows: [
        { item: "Single entry e-Visa", amount: "USD 30", note: "Shown on the official portal. A rise to USD 33 from 1 January 2027 has been reported, and the portal had not shown it." },
        { item: "Multiple entry e-Visa", amount: "USD 65", note: "Shown on the official portal." },
        { item: "Visa on arrival", amount: "About USD 30", note: "Reported by guides since 1 March 2026. Not checked on an official page." },
        { item: "VIZA service", amount: "Free", note: "VIZA charges nothing. You pay Egypt on the portal." },
      ],
      processing: "The portal says to apply at least 7 days before departure, and the visa is emailed to you for download. No fixed time is published, so apply early. Print the e-Visa and carry it, because Egyptian port authorities can refuse entry to an e-Visa holder without giving a reason.",
    },

    apply: {
      intro: "The e-Visa form is short, and the mistakes are small ones: a wrong passport number, a photo that fails or the wrong visa type. Choose how much help you want.",
      guided: {
        title: "Guided",
        body: "VIZA's AI confirms that your passport is on the list, then walks you through the form. You submit and pay on the government portal yourself.",
      },
      fullService: {
        title: "Full-service",
        body: "A VIZA consultant checks your passport details, dates and visa type before you submit, so you do not lose the fee to a typo.",
      },
      steps: [
        { title: "Start on VIZA", body: "Upload your passport and trip dates. We confirm that your passport is on the e-Visa list." },
        { title: "Check the file", body: "We check the passport number, dates, 6 month validity and the entry type you need." },
        { title: "Submit and pay", body: "Complete the form on visa2egypt.gov.eg and pay USD 30 or USD 65 by card." },
        { title: "Download and print", body: "Download the e-Visa from the link emailed to you. Print it and carry it with your passport." },
      ],
    },

    checklist: {
      intro: "The online form is short, and the border officer checks a few documents. These are the common items. The portal is the final rule.",
      groups: [
        {
          applicant: "Everyone",
          items: [
            "Passport valid for at least 6 months from your arrival date, with a blank visa page",
            "Printed copy of the e-Visa",
            "Travel itinerary",
            "Hotel bookings or details of the places you will visit, for tourists",
            "Card for the online payment",
          ],
        },
        {
          applicant: "Visiting family or on business",
          items: [
            "Invitation letter from your host, or a company letter",
            "Host's contact details",
            "Return ticket",
          ],
        },
        {
          applicant: "Employment Pass and S Pass",
          items: [
            "Valid pass for your return to Singapore",
            "Passport of an eligible country",
            "Employer letter, if the airline asks",
          ],
        },
        {
          applicant: "Dependant's Pass and children",
          items: [
            "A separate e-Visa for each person",
            "Each passport valid for 6 months from arrival",
            "Birth or marriage certificate, if the airline asks",
          ],
        },
        {
          applicant: "Permanent Resident and student",
          items: [
            "The passport of your own country",
            "Valid re-entry permit or Student's Pass",
            "Indonesian and Philippine passports: an embassy visa instead of the e-Visa",
          ],
        },
      ],
    },

    travel: {
      intro: "Entry to Egypt is simple when the e-Visa is right. These are the points that catch visitors out.",
      items: [
        { title: "Carry a printed visa", body: "Print the e-Visa and keep a digital copy. Entry can still be refused without a reason, so keep your itinerary and bookings ready." },
        { title: "Use the official portal", body: "The e-Visa is applied for on visa2egypt.gov.eg. Other sites charge extra for the same visa." },
        { title: "Passport validity", body: "The passport must be valid for 6 months from your arrival date and have a blank visa page." },
        { title: "Arrival card", body: "You may be handed an arrival card. Fill it in with the passport details and your hotel address." },
        { title: "Staying longer", body: "Stay within the days granted. Egypt publishes no tariff for overstays online, and fines move with the exchange rate." },
      ],
    },

    reviewed: {
      date: "25 November 2026",
      note: "Checked against the official Egypt e-Visa portal. Fees may change in 2027, so look at the links under Sources before you pay.",
    },

    related: {
      destinations: ["saudi-arabia", "turkiye", "united-arab-emirates", "italy"],
      guides: [
        { label: "e-Visa vs visa on arrival vs embassy visa", href: "/guides/e-visa-vs-visa-on-arrival-vs-embassy-visa" },
        { label: "Egypt e-Visa portal", href: "https://visa2egypt.gov.eg/eVisa/Home" },
        { label: "VIZA visa news", href: "/blog" },
      ],
    },
  },

  rejectionTitle: "Common rejection reasons",
  rejectionSub: "The portal does not explain a refusal in detail. These are the mistakes a consultant checks before you submit.",
  rejectionReasons: [
    { title: "Passport is not on the list", body: "Indonesian and Philippine passports are not on the e-Visa list, so an online application is refused." },
    { title: "Passport details do not match", body: "A typo in the passport number or dates means the e-Visa does not match your passport at the border." },
    { title: "Passport validity too short", body: "The passport must be valid for 6 months from arrival and have a blank visa page." },
    { title: "Photo or scan fails", body: "A blurred scan or a photo with the wrong background fails the portal's checks." },
    { title: "Wrong entry type or dates", body: "A single entry visa for a trip that crosses the border twice, or dates that do not fit your trip, causes trouble at the airport." },
  ],

  faqSub: "Can't find your answer? Ask the AI assistant below or message a VIZA consultant.",
  faq: [
    { category: "Do I need a visa", q: "Do Singaporeans need a visa for Egypt?", a: "Yes. Singapore passport holders apply for the Egypt e-visa online on visa2egypt.gov.eg. The fee is USD 30 for a single entry and USD 65 for multiple entries." },
    { category: "Do I need a visa", q: "Do Chinese, Indian, Malaysian and Vietnamese passport holders in Singapore need an Egypt visa?", a: "Yes. All four are on the portal's eligible list, so you apply for the same e-Visa online." },
    { category: "Do I need a visa", q: "Can Indonesian and Philippine passport holders get the Egypt e-visa?", a: "No. Indonesia and the Philippines are not on the portal's list. Apply through an Egyptian embassy or consulate." },
    { category: "Do I need a visa", q: "Does my Employment Pass or PR change the Egypt visa rule?", a: "No. The e-Visa depends on your passport. Your pass shows that you live in Singapore and lets you return." },
    { category: "Applying", q: "How do I apply for an Egypt e-visa from Singapore?", a: "Go to visa2egypt.gov.eg, fill in the form, pay by card and download the e-Visa from the link emailed to you. Print it and carry it." },
    { category: "Applying", q: "Is the Egypt e-visa the same as a visa on arrival?", a: "No. The e-Visa is applied for before you fly, and the visa on arrival is bought at the airport. The e-Visa saves you a queue." },
    { category: "Applying", q: "What documents do I carry for Egypt?", a: "Your passport, a printed e-Visa, your itinerary, and hotel bookings or details of the places you will visit. For family visits or business, add an invitation or company letter." },
    { category: "Fees and time", q: "How much is the Egypt e-visa?", a: "USD 30 for a single entry and USD 65 for multiple entries, according to the portal. A rise to USD 33 for single entry from 1 January 2027 has been reported, so check the portal." },
    { category: "Fees and time", q: "How long does the Egypt e-visa take?", a: "The portal says to apply at least 7 days before departure. No fixed time is published, so apply early." },
    { category: "Fees and time", q: "How long can I stay in Egypt on the e-visa?", a: "Guides report 30 days per entry, with a single entry visa valid for about three months and a multiple entry visa for about six. Confirm the dates in your application." },
    { category: "Rejections", q: "What if my Egypt e-visa is refused?", a: "A consultant can check your passport details and the list for the likely cause. If your passport is not on the list, use the embassy route." },
    { category: "Before you travel", q: "How long must my passport be valid for Egypt?", a: "At least 6 months from your arrival date, with a blank visa page." },
    { category: "Before you travel", q: "How much does VIZA charge?", a: "Nothing. VIZA's help is free. You pay the visa fee to the government on the portal." },
  ],

  sources: [
    { label: "Egypt e-Visa portal", url: "https://visa2egypt.gov.eg/eVisa/Home", display: "visa2egypt.gov.eg" },
    { label: "Egypt e-Visa portal, FAQ on fees, eligibility and documents", url: "https://visa2egypt.gov.eg/eVisa/FAQ?lang=en", display: "visa2egypt.gov.eg" },
    { label: "Embassy of Egypt, Washington DC, visa requirements", url: "https://egyptembassy.net/consular-services/visas-travel/visa-requirements/", display: "egyptembassy.net" },
    { label: "Egypt tourist visa fee change reported for 2027", url: "https://atta.travel/resource/egypt-to-raise-single-entry-visa-fee-to-33-from-january-2027.html", display: "atta.travel" },
  ],

  price: {
    etaLabel: "Processing time",
    etaValue: "Apply 7 days ahead",
    title: "Tourist e-Visa · single or multiple entry",
    sub: "VIZA's help is free: passport check and form review. The visa fee is paid on the government portal.",
    foot: "VIZA's service is free. The Egypt visa fee is paid directly on the government portal.",
  },

  aiPlaceholder: "Ask anything about the Egypt e-visa: fees, who can apply, Singapore residents…",
};

export default egypt;
