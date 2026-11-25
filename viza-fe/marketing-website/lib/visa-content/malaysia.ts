import type { DestinationContent } from "./types";

/**
 * Malaysia visa application (eVISA) and the Malaysia Digital Arrival Card (MDAC), framed globally, with a section
 * for Singapore residents.
 *
 * Checked 25 Nov 2026. Read on the day:
 *   - https://www.imi.gov.my/index.php/en/main-services/visa/visa-requirement-by-country/ (Singapore no visa; Indonesia,
 *     Philippines, Vietnam as ASEAN nationals no visa under one month; India visa exempt until 31 Dec 2026; eVISA at
 *     malaysiavisa.imi.gov.my; links to eNTRI for India and China; the page does not list China)
 *   - https://imigresen-online.imi.gov.my/mdac/main (MDAC landing page; the eligibility infographics were not readable)
 * Not confirmed on an official page this session (kept general or flagged in the copy):
 *   - the eVISA fee (secondary sites say RM 20 to 50 plus about RM 105 processing; the copy says "set by the portal")
 *   - the eVISA processing time (the July 2026 check had 48 hours on working days; sources say 2 to 5 working days)
 *   - the eVISA stay and validity (single entry, 30 days, 3 months from issue, no extension, from the July 2026 check)
 *   - China: 30 days per visit and 90 days in any 180 under the mutual exemption in force 17 Jul 2025 (secondary sources,
 *     the IMI requirements page does not list China); the copy says check the High Commission or IMI before you go
 *   - India exemption is 30 days until 31 Dec 2026 and its renewal is unconfirmed, so the page tells readers to check for 2027 trips
 *   - MDAC exemption for Singapore citizens and the 3 days before arrival window (July 2026 check; infographics not readable)
 *   - whether the portal accepts applications lodged from Singapore (the July check had conflicting notes)
 *   - the number of days ASEAN passports get (the IMI page says under one month)
 * Titles: the shared default title is "Malaysia e-Visa: Requirements and How to Apply | VIZA". "Malaysia visa application" could be added by an override in lib/seo/titles.ts.
 */
export const malaysia: DestinationContent = {
  slug: "malaysia",

  heroTitle: "Malaysia visa application: do you need a visa, eVISA and MDAC",
  lede: "A Malaysia visa application depends on your passport. Singapore passports need no visa, and neither do ASEAN passports for a stay under one month. Chinese passports are visa exempt under a mutual agreement, and Indian passports are exempt until 31 December 2026, so check the date if you travel in 2027. Passports that do need a visa apply online for the Malaysia eVISA on the Immigration Department's portal. Every visitor except Singapore citizens fills in the free Malaysia Digital Arrival Card (MDAC) within three days before arrival. This page also covers Singapore residents on EP, S Pass, Dependant's Pass and PR.",
  heroImage: "/assets/heroes/malaysia.jpg",
  meta: [
    { k: "Singapore passport", v: "No visa needed" },
    { k: "eVISA", v: "Single entry, 30 days" },
    { k: "Arrival card", v: "MDAC, free" },
    { k: "Checked", v: "25 Nov 2026" },
  ],
  tags: [
    { icon: "shield", label: "Free VIZA service" },
    { icon: "doc", label: "MDAC and document check" },
    { icon: "bolt", label: "eVISA online" },
  ],

  page: {
    framing: "global",

    glance: {
      needVisa: "Not for Singapore passports, ASEAN passports under one month, Chinese passports or Indian passports until 31 December 2026. Other passports use the eVISA",
      govFee: "Set by the government portal and shown before you pay. Visa exempt travellers pay no visa fee",
      processing: "Set by the government portal. Immigration's published eVISA time is short, so allow several working days",
      maxStay: "30 days per entry on the eVISA. Exempt stays depend on your passport",
      checked: "25 November 2026",
    },

    passports: {
      intro: "Malaysia decides by passport, not by where you live. The table skips Malaysian passports and adds Thailand, since Thai passports are on the same ASEAN list. The Immigration Department's visa requirement page is the final word.",
      rows: [
        { passport: "Singapore", status: "No visa needed", note: "Singapore passports need no visa for any purpose or length of stay, according to the Immigration Department's list. Singapore citizens are also exempt from the MDAC." },
        { passport: "China (PRC)", status: "Visa exempt under a mutual agreement", note: "Reported as up to 30 days per visit under the China and Malaysia mutual visa exemption, and a cap of 90 days in any 180. Check the High Commission or the Immigration Department before you go. The MDAC is required." },
        { passport: "India", status: "Visa exempt until 31 December 2026", note: "The Immigration Department lists Indian citizens as exempt until that date, reported as 30 days for tourism, business, social visits and transit. Check for renewal before travelling in 2027. The MDAC is required." },
        { passport: "Indonesia", status: "No visa under one month", note: "ASEAN nationals need no visa for a stay under one month. A longer stay needs a visa." },
        { passport: "Philippines", status: "No visa under one month", note: "ASEAN nationals need no visa for a stay under one month. A longer stay needs a visa." },
        { passport: "Vietnam", status: "No visa under one month", note: "ASEAN nationals need no visa for a stay under one month. A longer stay needs a visa." },
        { passport: "Thailand", status: "No visa under one month", note: "ASEAN nationals need no visa for a stay under one month. A longer stay needs a visa." },
        { passport: "Other passports", status: "Check the requirement list", note: "Some nationalities need a visa and apply for the eVISA online. The Immigration Department lists each country, so look for yours before you book." },
      ],
    },

    visaTypes: {
      intro: "Most visitors from Singapore need no visa at all. For those who do, Malaysia has a few routes.",
      items: [
        { title: "Visa exempt entry", body: "For Singapore, ASEAN, Chinese and Indian passports on the terms in the table. No application, but the MDAC is needed for most passports." },
        { title: "Tourist eVISA (single entry)", body: "Applied for online on the Immigration Department's eVISA portal. In the July 2026 check it was single entry, a stay of 30 days that cannot be extended, valid for three months from issue." },
        { title: "Visa with reference or approval letter", body: "Some nationalities need a visa with reference, or receive a visa approval letter. The Immigration Department's page describes these for the countries that need them." },
        { title: "eNTRI and other schemes", body: "The Immigration Department links separate eNTRI pages for Indian and Chinese citizens. Check them if your trip falls outside the exemption." },
      ],
    },

    residents: {
      intro: "Living in Singapore does not change what Malaysia asks. The passport decides, and your pass only matters for returning to Singapore, so keep it valid past your return date.",
      rows: [
        { pass: "Employment Pass", body: "Follow your passport's row. A Chinese or Indian passport holder is exempt on the terms above, and an EP holder with another passport checks the requirement list. Complete the MDAC." },
        { pass: "S Pass", body: "The same as the EP. The eVISA form asks for your passport, and the portal does not ask for your pass." },
        { pass: "Dependant's Pass", body: "Each family member follows their own passport's row, and children need their own MDAC. Keep the pass valid past your return date." },
        { pass: "Permanent Resident", body: "A PR holds a passport from another country, so follow that row. A Singapore PR needs to complete the MDAC, because the exemption is for Singapore citizens." },
        { pass: "Singapore citizen", body: "No visa and no MDAC. Carry your passport with enough validity." },
        { pass: "Student's Pass", body: "Follow your passport's row, and complete the MDAC if it applies to you." },
      ],
    },

    fees: {
      intro: "Visa exempt travellers pay no visa fee, and the MDAC is free. The eVISA fee is shown on the government portal, and VIZA's help is free.",
      rows: [
        { item: "Tourist eVISA", amount: "Set by the government portal", note: "The fee depends on your nationality and is shown before you pay. Third-party sites quote different amounts, so rely on the portal." },
        { item: "Visa exempt entry", amount: "No fee", note: "Singapore, ASEAN, Chinese and Indian passports on the terms in the table." },
        { item: "MDAC arrival card", amount: "Free", note: "Use only the Immigration Department's site, and avoid websites that charge for it." },
        { item: "Overstay", amount: "Fine or prison", note: "Under the Immigration Act an overstay can bring a fine up to RM 10,000 or imprisonment, so leave on time." },
      ],
      processing: "The Immigration Department publishes a short eVISA time on working days, and other sources give 2 to 5 working days, so allow at least a week. The eVISA is single entry, valid three months from issue, with a 30-day stay that cannot be extended. Visa exempt travellers have nothing to wait for. Plan the MDAC for the three days before you arrive.",
    },

    apply: {
      intro: "Most people need no visa, only the MDAC. If you need the eVISA, choose how much help you want. The fee goes to the Immigration Department, not to VIZA.",
      guided: {
        title: "Guided",
        body: "VIZA's AI walks you through the eVISA form and the MDAC, checks your files against the portal's rules, and you submit on the government site yourself.",
      },
      fullService: {
        title: "Full-service",
        body: "A VIZA consultant fills the forms, checks the files and prepares the application, so the common mistakes are caught before you submit.",
      },
      steps: [
        { title: "Start on VIZA", body: "Tell us your passport, pass and trip dates. We confirm whether you are exempt or need the eVISA." },
        { title: "Prepare the files", body: "We check the passport scan, photo and travel details for the eVISA." },
        { title: "Submit", body: "Submit on the Immigration Department's eVISA portal and pay the fee it shows. If the portal does not accept an application lodged from Singapore, contact the Malaysian High Commission." },
        { title: "Fill in the MDAC", body: "Within three days before you arrive, complete the free Malaysia Digital Arrival Card and keep the confirmation." },
      ],
    },

    checklist: {
      intro: "Exempt travellers need little. The eVISA asks for a few more files. These apply to everyone, with a few points by applicant type.",
      groups: [
        {
          applicant: "Everyone",
          items: [
            "Passport with enough validity for your stay",
            "Return or onward ticket",
            "Address for your first night in Malaysia",
            "MDAC confirmation, if it applies to your passport",
          ],
        },
        {
          applicant: "eVISA applicants",
          items: [
            "Passport bio page scan",
            "Recent photo in the portal's format",
            "Travel details and dates",
            "Card to pay the fee the portal shows",
          ],
        },
        {
          applicant: "Singapore citizens and residents",
          items: [
            "Your Singapore pass or NRIC kept valid for your return",
            "Passport from the country you hold, not your pass, for any application",
          ],
        },
        {
          applicant: "Chinese and Indian passport holders",
          items: [
            "The MDAC before you arrive",
            "For India, a check that the exemption is still in force on your travel date",
          ],
        },
      ],
    },

    travel: {
      intro: "Entry rules are easy for most Singapore travellers, and the arrival card is the one step many people miss.",
      items: [
        { title: "Malaysia Digital Arrival Card (MDAC)", body: "Foreign visitors complete the MDAC online, free, within three days before arrival, at the Immigration Department's site. Singapore citizens are exempt. Use only the official site, since the card is not a visa and does not grant entry by itself.", href: "/arrival-cards/malaysia-mdac", linkLabel: "Read the MDAC guide" },
        { title: "Money limits", body: "Declare cash or bearer instruments worth more than US$10,000 to customs, and do not carry more than US$10,000 in ringgit without permission from Bank Negara Malaysia." },
        { title: "Overstaying", body: "An overstay can bring a fine or imprisonment under the Immigration Act. Leave before the days you were given run out." },
        { title: "Visa free is not work", body: "Visa exempt entry is for tourism, business, social visits and transit. Work and study need a visa." },
        { title: "Insurance", body: "Travel insurance is not an entry requirement, but a policy covering medical care and cancelled flights is sensible." },
      ],
    },

    reviewed: {
      date: "25 November 2026",
      note: "Checked against the Malaysian Immigration Department's visa requirement page and its MDAC site. The Indian exemption runs to 31 December 2026, so look at the links under Sources before you travel.",
    },

    related: {
      destinations: ["thailand", "indonesia", "vietnam", "india"],
      guides: [
        { label: "Visas for Chinese passport holders in Singapore", href: "/guides/visas-chinese-passport-holders-singapore" },
        { label: "Malaysia Digital Arrival Card, Immigration Department", href: "https://imigresen-online.imi.gov.my/mdac/main" },
        { label: "VIZA visa news", href: "/blog" },
      ],
    },
  },

  rejectionTitle: "Common rejection reasons",
  rejectionSub: "The Immigration Department decides each eVISA, and fees are not refunded on refusal. These are the points a consultant checks before you submit.",
  rejectionReasons: [
    { title: "Applying when you are exempt", body: "A Singapore, ASEAN, Chinese or Indian passport holder on a short tourist stay usually needs no eVISA. Check the requirement list first." },
    { title: "Photo or scan that does not meet the rules", body: "A blurred or cropped passport scan or a photo outside the portal's format is a common reason for a return." },
    { title: "Details that do not match the passport", body: "Name, passport number and date of birth must match the passport exactly." },
    { title: "Passport validity", body: "The passport needs enough validity for the stay. A passport close to expiry should be renewed first." },
    { title: "Wrong purpose", body: "The tourist eVISA is for tourism and short visits. Work and study need a different visa." },
    { title: "Travelling on a date outside an exemption", body: "The Indian exemption runs to 31 December 2026. A trip in 2027 needs a fresh check of the rule." },
  ],

  faqSub: "Can't find your answer? Ask the AI assistant below or message a VIZA consultant.",
  faq: [
    { category: "Do I need a visa", q: "Do Singaporeans need a visa for Malaysia?", a: "No. Singapore passports need no visa for any purpose or length of stay, according to the Immigration Department's list. Singapore citizens are also exempt from the MDAC." },
    { category: "Do I need a visa", q: "Do Chinese passport holders need a Malaysia visa?", a: "Chinese passports are visa exempt under the mutual agreement, reported as up to 30 days per visit. Check the High Commission or the Immigration Department before you go, and complete the MDAC." },
    { category: "Do I need a visa", q: "Do Indians in Singapore need a Malaysia visa?", a: "The Immigration Department lists Indian citizens as exempt until 31 December 2026. Check whether the rule has been renewed before a trip in 2027, and complete the MDAC." },
    { category: "Do I need a visa", q: "Do Singapore PR and pass holders need a Malaysia visa?", a: "It depends on your passport. Malaysia looks at the passport, so follow the row for the passport you hold. A PR must also complete the MDAC." },
    { category: "Applying", q: "How does a Malaysia visa application work?", a: "If your passport needs a visa, you apply online on the Immigration Department's eVISA portal and pay the fee it shows. VIZA can check the form and the files first, for free." },
    { category: "Applying", q: "How long does the Malaysia eVISA take?", a: "The Immigration Department publishes a short time on working days, and other sources say 2 to 5 working days. Allow at least a week." },
    { category: "Applying", q: "Can I extend my Malaysia eVISA?", a: "In the July 2026 check the eVISA was single entry with a 30-day stay that cannot be extended, valid three months from issue." },
    { category: "Fees", q: "How much is a Malaysia visa?", a: "The eVISA fee is set by the government portal and depends on your nationality, so rely on the amount it shows. Visa exempt entry has no fee." },
    { category: "Arrival card", q: "What is the MDAC?", a: "The Malaysia Digital Arrival Card is a free online arrival form for foreign visitors, completed within three days before arrival. It is not a visa." },
    { category: "Arrival card", q: "Do I need an MDAC from Singapore?", a: "Singapore citizens are exempt. Singapore PR and pass holders with another passport complete it." },
    { category: "Before you travel", q: "What happens if I overstay in Malaysia?", a: "An overstay can bring a fine up to RM 10,000 or imprisonment under the Immigration Act, so leave before your days run out." },
    { category: "Before you travel", q: "How much does VIZA charge?", a: "Nothing. VIZA's help is free. You pay any government fee on the portal." },
  ],

  sources: [
    { label: "Immigration Department of Malaysia, visa requirement by country", url: "https://www.imi.gov.my/index.php/en/main-services/visa/visa-requirement-by-country/", display: "imi.gov.my" },
    { label: "Malaysia eVISA portal", url: "https://malaysiavisa.imi.gov.my/", display: "malaysiavisa.imi.gov.my" },
    { label: "Malaysia Digital Arrival Card", url: "https://imigresen-online.imi.gov.my/mdac/main", display: "imigresen-online.imi.gov.my" },
  ],

  price: {
    etaLabel: "Processing time",
    etaValue: "Set by the portal",
    title: "Tourist eVISA · 30 days",
    sub: "VIZA's help is free: form preparation and document review. The visa fee is paid on the government portal.",
    foot: "VIZA's service is free. Any Malaysia visa fee is paid directly to the Immigration Department.",
  },

  aiPlaceholder: "Ask anything about a Malaysia visa application: eVISA, MDAC, who is exempt…",
};

export default malaysia;
