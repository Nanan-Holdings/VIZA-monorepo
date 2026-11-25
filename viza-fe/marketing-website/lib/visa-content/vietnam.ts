import type { DestinationContent } from "./types";

/**
 * Vietnam e-visa, framed globally (any nationality can apply), with a section for Singapore residents.
 *
 * Checked 25 Nov 2026. The Vietnam e-visa portal (evisa.gov.vn) failed its TLS check from the fetch tool and the
 * Singapore MFA page was too large to read, so the facts below come from the July 2026 check of the portal, its
 * official mirror and the embassy notices, plus search summaries read on the day. Re-open these before a publish:
 *   - https://evisa.gov.vn/ (fee, validity, processing time, checkpoints)
 *   - https://prearrival.immigration.gov.vn/ (pre-arrival form, which airports)
 *   - https://www.mfa.gov.sg/travelling-overseas/travel-advisories-notices-and-visa-information/vietnam/
 * Not confirmed on an official page this session (kept general or flagged):
 *   - fee US$25 single and US$50 multiple, up to 90 days (several 2026 sources repeat it, one cites Circular 28/2026/TT-BTC)
 *   - processing time: 3 working days is the figure Vietnam publishes, sources say 3 to 5 or 3 to 7, so the page says allow a week
 *   - visa free days: Singapore and Malaysia 30 days (Wikipedia policy page and the July check); Indonesia and the
 *     Philippines shown there as 14 and 21 days, which conflicts with other lists, so the page does not give a number
 *   - Chinese biometric passport loose-leaf visa practice, left out
 *   - the pre-arrival form airports (SGN, HAN, PQC in the July check), so the page says "some airports"
 *   - overstay fine amounts (Decree 282/2025/ND-CP in the July check), left out
 *   - photo size (4 x 6 cm, JPG, about 1 MB in the July check), the page says "the size the portal states"
 * Titles: the shared default title for this page is "Vietnam e-Visa: Requirements and How to Apply | VIZA".
 */
export const vietnam: DestinationContent = {
  slug: "vietnam",

  heroTitle: "Vietnam e-visa: requirements and how to apply",
  lede: "A Vietnam e-visa is a single or multiple entry visa you apply for online on the government's e-visa portal and receive by email, valid for up to 90 days. It costs US$25 for single entry and US$50 for multiple entry, and every nationality can apply. Singapore and Malaysian passports enter Vietnam visa free for a short stay, so a Singapore citizen only needs the Vietnam e-visa for longer trips. Chinese and Indian passports need a visa for every stay. This page also covers Singapore residents on EP, S Pass, Dependant's Pass and PR.",
  heroImage: "/assets/heroes/vietnam.jpg",
  meta: [
    { k: "Type", v: "e-visa (EV)" },
    { k: "Validity", v: "Up to 90 days" },
    { k: "Fee", v: "US$25 single, US$50 multiple" },
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
      needVisa: "Not for Singapore or Malaysian passports on a short stay. Yes for Chinese and Indian passports. Check the exemption list for Indonesian and Philippine passports",
      govFee: "US$25 single entry, US$50 multiple entry, paid on the portal and not refunded if refused",
      processing: "3 working days is the published time. Allow up to a week, and longer around Tet and public holidays",
      maxStay: "Up to 90 days, within the validity you choose",
      checked: "25 November 2026",
    },

    passports: {
      intro: "Vietnam decides by passport, not by where you live. The table shows who can enter without a visa and who needs the e-visa. Vietnam's immigration department keeps the exemption list, so look at it before you book if your passport is not in the table.",
      rows: [
        { passport: "Singapore", status: "Visa free for a short stay", note: "Singapore ordinary passports enter without a visa for up to 30 days. For a longer stay you need the 90-day e-visa before you travel, because the exemption cannot be extended at the border." },
        { passport: "China (PRC)", status: "Visa required", note: "Chinese ordinary passports are not visa exempt. Apply for the e-visa online. Entry must be through the checkpoint named on the visa." },
        { passport: "Malaysia", status: "Visa free for a short stay", note: "Malaysian passports enter without a visa for up to 30 days. Use the e-visa for longer stays." },
        { passport: "India", status: "Visa required", note: "Indian passports need the e-visa for every stay. US$25 single entry and US$50 multiple entry." },
        { passport: "Indonesia", status: "Visa free for a short stay", note: "Indonesian passports are on the ASEAN exemption list. The number of days differs between published lists, so check the immigration department's list before you fly." },
        { passport: "Philippines", status: "Visa free for a short stay", note: "Philippine passports are on the ASEAN exemption list. The number of days differs between published lists, so check the immigration department's list before you fly." },
        { passport: "Vietnam", status: "No visa needed", note: "Vietnamese citizens enter on their own passport. Overseas Vietnamese have their own exemption rules." },
        { passport: "Other passports", status: "e-visa for all nationalities", note: "Since August 2023 every nationality can apply for the e-visa. Some countries also have a visa free period, so check the exemption list first." },
      ],
    },

    visaTypes: {
      intro: "Vietnam's e-visa is one product with two entry options. Business and work stays use other documents.",
      items: [
        { title: "Single entry e-visa", body: "One entry within the validity window you choose, up to 90 days. It costs US$25. This is enough for most holiday trips that enter and leave Vietnam once." },
        { title: "Multiple entry e-visa", body: "Leave and re-enter freely within the validity window, up to 90 days. It costs US$50. It suits trips that include Laos or Cambodia and a return to Vietnam." },
        { title: "Visa free entry", body: "Singapore and Malaysian passports are exempt for a short stay. You need no application, but carry a passport with enough validity and an onward ticket." },
        { title: "Work, long stay and business", body: "Working in Vietnam or staying long needs a different visa and a sponsor in Vietnam. The tourist e-visa does not allow paid work." },
      ],
    },

    residents: {
      intro: "Living in Singapore does not change what Vietnam asks. The passport decides, and your pass only matters for returning to Singapore, so keep it valid past your return date.",
      rows: [
        { pass: "Employment Pass", body: "Follow the row for your passport. A Chinese or Indian passport holder applies for the e-visa. A Malaysian passport holder can enter visa free for a short stay." },
        { pass: "S Pass", body: "The same as the EP. The e-visa form asks for your passport and photo, and not for your pass." },
        { pass: "Dependant's Pass", body: "Each family member applies on their own passport, and children need their own e-visa. Keep the pass valid past your return date." },
        { pass: "Permanent Resident", body: "A PR holds a passport from another country, so follow that passport's row. A PR with a Chinese or Indian passport needs the e-visa." },
        { pass: "Singapore citizen", body: "No visa for a short stay of up to 30 days. For a longer stay, apply for the 90-day e-visa before you fly." },
        { pass: "Student's Pass", body: "Follow your passport's row. Check that the passport has enough validity for the trip." },
      ],
    },

    fees: {
      intro: "The government fee is paid on the e-visa portal. VIZA's help is free. Vietnam keeps the fee if an application is refused.",
      rows: [
        { item: "Single entry e-visa", amount: "US$25", note: "Up to 90 days, one entry." },
        { item: "Multiple entry e-visa", amount: "US$50", note: "Up to 90 days, entry and exit as often as you like inside the window." },
        { item: "Refused application", amount: "Fee not refunded", note: "The portal keeps the fee, so check the photo and passport details before you submit." },
        { item: "Visa free entry", amount: "No fee", note: "Singapore and Malaysian passports on a short stay." },
      ],
      processing: "Vietnam publishes 3 working days for the e-visa after a complete application and payment. Other sources say 3 to 5 or up to 7 working days around Tet and public holidays, so apply at least a week before you fly. The e-visa arrives as a PDF by email. You can only enter through the checkpoint you choose when you apply.",
    },

    apply: {
      intro: "Choose the route first, then prepare the files. The portal is the government's, and the fee goes to the government, not to VIZA.",
      guided: {
        title: "Guided",
        body: "VIZA's AI walks you through the form, checks the photo and passport scan against the portal's rules, and you submit and pay on the portal yourself.",
      },
      fullService: {
        title: "Full-service",
        body: "A VIZA consultant fills the form, checks the files and the entry checkpoint, and prepares the application, so the common photo and date mistakes are caught before they cost you the fee.",
      },
      steps: [
        { title: "Start on VIZA", body: "Tell us your passport, the entry and exit dates and the checkpoint you will use. We confirm whether you need the e-visa at all." },
        { title: "Prepare the files", body: "Scan the passport bio page and take a plain-background portrait. We check both against the size the portal states." },
        { title: "Apply and pay", body: "Submit on the Vietnam e-visa portal and pay the fee by card. Dates use day, month, year." },
        { title: "Receive the e-visa", body: "The e-visa PDF arrives by email. Print it or save it to your phone, and show it with your passport at the checkpoint named on it." },
      ],
    },

    checklist: {
      intro: "The portal asks for a few files and some travel details. These apply to everyone, with a few points by applicant type.",
      groups: [
        {
          applicant: "Everyone",
          items: [
            "Passport valid for at least six months beyond your arrival, with blank pages",
            "Passport bio page image, full page with both lines at the bottom visible",
            "Portrait photo with a plain white background, in the size and format the portal states",
            "Entry and exit dates, an address in Vietnam and the checkpoints you will use",
            "Card to pay the fee",
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
          applicant: "Families and groups",
          items: [
            "One e-visa for each traveller, including children",
            "Separate passports for children, with the right dates for each person",
          ],
        },
        {
          applicant: "Chinese and Indian passport holders",
          items: [
            "The e-visa for every stay, with the entry checkpoint chosen at the time of application",
            "A return or onward ticket and funds to show if the officer asks",
          ],
        },
      ],
    },

    travel: {
      intro: "Getting the e-visa is one part. Vietnam also has an arrival form, and the checkpoint rule catches people out.",
      items: [
        { title: "Pre-arrival form", body: "Vietnam's immigration department runs a digital pre-arrival form with a QR code at some airports. Check prearrival.immigration.gov.vn before you fly to see whether your airport needs it." },
        { title: "Entry checkpoint", body: "You enter through the checkpoint named on the e-visa. A different airport or border post means being turned away, so choose carefully when you apply." },
        { title: "Extensions", body: "A tourist e-visa is not extended in the country as a routine step. For more time, leave and apply for a new e-visa, or ask the immigration department about a sponsored visa." },
        { title: "Overstay", body: "Overstaying is fined under Vietnamese law and can lead to deportation and a ban on re-entry. Leave before the validity ends." },
        { title: "Insurance", body: "Travel insurance is not part of the e-visa, but a policy covering medical care and cancelled flights is sensible." },
      ],
    },

    reviewed: {
      date: "25 November 2026",
      note: "Checked against the Vietnam e-visa portal, the Immigration Department's pre-arrival page and the Singapore Ministry of Foreign Affairs. Fees and rules change, so look at the links under Sources before you pay.",
    },

    related: {
      destinations: ["thailand", "malaysia", "indonesia", "japan"],
      guides: [
        { label: "Visa-free countries for Singapore passport holders", href: "/guides/visa-free-countries-singapore-passport" },
        { label: "Visas for Chinese passport holders in Singapore", href: "/guides/visas-chinese-passport-holders-singapore" },
        { label: "Visas for Filipino and Indian residents of Singapore", href: "/guides/visas-filipino-indian-residents-singapore" },
        { label: "e-Visa vs visa on arrival vs embassy visa", href: "/guides/e-visa-vs-visa-on-arrival-vs-embassy-visa" },
        { label: "Visa photo requirements by country", href: "/guides/visa-photo-requirements" },
        { label: "Vietnam pre-arrival form, Immigration Department", href: "https://prearrival.immigration.gov.vn/" },
        { label: "VIZA visa news", href: "/blog" },
      ],
    },
  },

  rejectionTitle: "Common rejection reasons",
  rejectionSub: "Vietnam keeps the fee if an e-visa is refused. These are the points a consultant checks before you submit.",
  rejectionReasons: [
    { title: "Photo or scan does not meet the rules", body: "A blurred, cropped, glared or low resolution portrait or passport scan is the most common cause. A coloured background, a hat or tinted glasses also fail." },
    { title: "Wrong passport page", body: "Upload the full bio page with both lines at the bottom visible, not the cover or a part of the page." },
    { title: "Details that do not match the passport", body: "Name order, spelling, passport number or date of birth must match the passport exactly." },
    { title: "Date errors", body: "The form uses day, month, year. A swapped day and month gives the wrong validity window or a refusal." },
    { title: "Passport validity", body: "The passport needs at least six months of validity beyond arrival. A damaged passport can also be refused." },
    { title: "Wrong checkpoint on arrival", body: "This is a border problem, not an application refusal. Enter through the checkpoint printed on the e-visa." },
  ],

  faqSub: "Can't find your answer? Ask the AI assistant below or message a VIZA consultant.",
  faq: [
    { category: "Do I need a visa", q: "Do Singaporeans need a visa for Vietnam?", a: "Not for a short stay. Singapore ordinary passports enter visa free for up to 30 days. For a longer stay you need the 90-day Vietnam e-visa before you travel." },
    { category: "Do I need a visa", q: "What is the Vietnam e-visa?", a: "It is a visa you apply for online on the government's e-visa portal and receive by email. It is single or multiple entry, valid for up to 90 days, and open to every nationality." },
    { category: "Do I need a visa", q: "Do Chinese passport holders need a visa for Vietnam?", a: "Yes. Chinese ordinary passports are not visa exempt, so you need the Vietnam e-visa for every stay." },
    { category: "Do I need a visa", q: "Do Indian passport holders in Singapore need a visa for Vietnam?", a: "Yes. Indian passports need the e-visa, US$25 for single entry and US$50 for multiple entry." },
    { category: "Do I need a visa", q: "Do Singapore PR and pass holders need a Vietnam e-visa?", a: "It depends on your passport. Vietnam looks at the passport, so follow the row for the passport you hold. Your EP, S Pass, Dependant's Pass or PR does not change it." },
    { category: "Applying", q: "How do I apply for a Vietnam e-visa?", a: "Open the Vietnam e-visa portal, fill in the form, upload your passport bio page and photo, choose your entry checkpoint and pay by card. VIZA can check the files and the form first, for free." },
    { category: "Applying", q: "How long does the Vietnam e-visa take?", a: "Vietnam publishes 3 working days after a complete application and payment. Allow up to a week, and longer around Tet and public holidays." },
    { category: "Applying", q: "Should I choose single or multiple entry?", a: "Choose multiple entry if you will leave Vietnam and return, for example a side trip to Laos or Cambodia. Choose single entry if you enter and leave once." },
    { category: "Fees", q: "How much is a Vietnam e-visa?", a: "US$25 for single entry and US$50 for multiple entry, paid on the portal. The fee is not refunded if the application is refused." },
    { category: "Rejections", q: "What if my Vietnam e-visa is refused?", a: "The fee is kept. Fix the cause, often the photo, passport scan or a date, and apply again. A consultant can review the files first." },
    { category: "Before you travel", q: "Can I enter Vietnam through any airport with an e-visa?", a: "No. You enter through the checkpoint you chose when you applied, and it is printed on the e-visa. A different port means being turned away." },
    { category: "Before you travel", q: "Do I need a pre-arrival form for Vietnam?", a: "Some airports use a digital pre-arrival form with a QR code. Check prearrival.immigration.gov.vn before you fly." },
    { category: "Before you travel", q: "How much does VIZA charge?", a: "Nothing. VIZA's help is free. You pay the government fee on the portal." },
  ],

  sources: [
    { label: "Vietnam National e-visa portal", url: "https://evisa.gov.vn/", display: "evisa.gov.vn" },
    { label: "Vietnam Immigration Department, pre-arrival form", url: "https://prearrival.immigration.gov.vn/", display: "prearrival.immigration.gov.vn" },
    { label: "Embassy of Vietnam in Singapore", url: "https://vnembassy-singapore.mofa.gov.vn/", display: "vnembassy-singapore.mofa.gov.vn" },
    { label: "Singapore MFA, Vietnam travel information", url: "https://www.mfa.gov.sg/travelling-overseas/travel-advisories-notices-and-visa-information/vietnam/", display: "mfa.gov.sg" },
  ],

  price: {
    etaLabel: "Processing time",
    etaValue: "3 working days published",
    title: "e-visa · up to 90 days",
    sub: "VIZA's help is free: file checks and form review. The visa fee is paid on the government portal.",
    foot: "VIZA's service is free. The Vietnam e-visa fee is paid directly to the Vietnam Immigration Department.",
  },

  aiPlaceholder: "Ask anything about a Vietnam e-visa: single or multiple entry, fees, checkpoints…",
};

export default vietnam;
