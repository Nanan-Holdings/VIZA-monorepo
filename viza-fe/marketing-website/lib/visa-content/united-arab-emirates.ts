import type { DestinationContent } from "./types";

/**
 * United Arab Emirates tourist visa and visa on arrival (framed globally, with a section for Singapore
 * residents; search terms "dubai visa singapore" and "uae visa"). The UAE issues tourist visas through a sponsor
 * (airline, hotel or licensed agent) on the GDRFA Dubai or ICP systems, and many passports enter without one.
 * Checkout behaviour is unchanged (it comes from lib/countries.ts).
 *
 * Checked 25 Nov 2026. The UAE MOFA news item of 25 Jun 2026 was read directly. The Singapore MFA travel page
 * was too large to fetch and was read through a search summary (page dated 1 Mar 2026). u.ae returned a 404 and
 * the UAE embassy Singapore visa page returned a 404. Re-open these before a publish:
 *   - https://www.mfa.gov.sg/travelling-overseas/travel-advisories-notices-and-visa-information/united-arab-emirates/
 *   - https://www.mofa.gov.ae/en/mediahub/news/2026/6/25/uae-grants-visa-on-arrival
 *   - https://u.ae/en/information-and-services/visa-and-emirates-id/tourist-visa (404 on the day)
 * Confirmed on an official page: visa on arrival for Indonesian, Vietnamese, Philippine (and Thai, Kenyan, South
 * African) ordinary passports with a valid residence permit from the US, an EU state, the UK, Singapore, Japan,
 * South Korea, Australia, New Zealand or Canada: 14 days AED 100 (extendable once) or 60 days AED 250 (not
 * extendable), overstay AED 50 per day (MOFA, 25 Jun 2026). Indian passports with a Singapore residence permit
 * since 13 Feb 2025 (UAE embassy New Delhi).
 * Not confirmed on an official page this session (kept general, hedged or left out):
 *   - Singapore stay length: the Singapore MFA says 90 days in any 180, older UAE embassy pages say 30 days
 *   - China (30 days) and Malaysia visa exemption and stay length
 *   - Tourist visa fees from GDRFA or ICP (earlier figures are not used), the visa's entry window, extension rules
 *   - Passport validity of 6 months (reported for Indian passports), and the single-name passport rule (MFA SG)
 *   - Whether the Singapore MFA advisory dated 1 Mar 2026 on the Middle East is still in force
 */
export const unitedArabEmirates: DestinationContent = {
  slug: "united-arab-emirates",

  heroTitle: "UAE visa: Dubai and Abu Dhabi entry rules",
  lede: "A UAE visa depends on your passport. Singapore passports enter the UAE without a visa, and most Dubai visa from Singapore questions come down to the other passports. If you live in Singapore on an Indian, Indonesian, Philippine or Vietnamese passport, you can qualify for a visa on arrival with your Singapore residence permit. Other travellers get a 30 or 60 day tourist visa through an airline, a hotel or a licensed agent. This guide covers the UAE visa for any traveller, with a section for people who live in Singapore.",
  heroImage: "/assets/heroes/united-arab-emirates.jpg",
  meta: [
    { k: "Singapore passport", v: "Visa free" },
    { k: "Visa on arrival", v: "14 or 60 days, AED 100 or 250" },
    { k: "Tourist visa", v: "Sponsor-filed" },
    { k: "Checked", v: "25 Nov 2026" },
  ],
  tags: [
    { icon: "shield", label: "Free VIZA service" },
    { icon: "doc", label: "Document check" },
    { icon: "plane", label: "Dubai and Abu Dhabi" },
  ],

  page: {
    framing: "global",

    glance: {
      needVisa: "Not for Singapore passports. Residents on Indian, Indonesian, Philippine or Vietnamese passports can get a visa on arrival",
      govFee: "Visa on arrival AED 100 for 14 days or AED 250 for 60 days. Tourist visa fees are set by the issuing authority",
      processing: "A tourist visa is issued through the sponsor, often within about 2 working days. Visa on arrival is on the spot",
      maxStay: "Singapore passports: up to 90 days in any 180. Visa on arrival: 14 or 60 days",
      checked: "25 November 2026",
    },

    passports: {
      intro: "The UAE decides by passport, and it keeps adding categories. The table shows the passports most common in Singapore and the route that applies to each. Where we could not confirm the stay length on an official page, the table says so.",
      rows: [
        { passport: "Singapore", status: "Visa free", note: "The Singapore Ministry of Foreign Affairs says up to 90 days within any 180. Older UAE embassy pages say 30 days, so read the MFA page before you fly." },
        { passport: "China (PRC)", status: "Visa free, reported 30 days", note: "Chinese passports are reported as visa exempt under a 2018 agreement. We could not confirm the stay length on an official page." },
        { passport: "Malaysia", status: "Visa free, check the stay", note: "Malaysian passports are reported as visa exempt on arrival. Confirm the stay length with the UAE authorities." },
        { passport: "India", status: "Visa on arrival with a permit", note: "Indian ordinary passports with a valid Singapore residence permit can get a visa on arrival, a rule that started on 13 February 2025. US, UK and EU visas or permits also qualify." },
        { passport: "Indonesia", status: "Visa on arrival with a permit", note: "Since June 2026, ordinary passports with a valid Singapore residence permit get a 14 day or 60 day visa on arrival." },
        { passport: "Philippines", status: "Visa on arrival with a permit", note: "The same June 2026 rule, with a valid Singapore residence permit and an ordinary passport." },
        { passport: "Vietnam", status: "Visa on arrival with a permit", note: "The same June 2026 rule, with a valid Singapore residence permit and an ordinary passport." },
        { passport: "Other passports", status: "Check with the UAE authorities", note: "Many passports are visa exempt or get a visa on arrival, and others need a tourist visa through a sponsor. Ask the airline or the issuing authority." },
      ],
    },

    visaTypes: {
      intro: "The UAE has several ways in. Which one you use depends on your passport and your residence.",
      items: [
        { title: "Visa free entry", body: "Singapore passports, and a long list of others, enter on arrival with no visa and no fee. The stay is set by the passport." },
        { title: "Visa on arrival for residents", body: "Ordinary passports from Indonesia, Vietnam, the Philippines, Thailand, Kenya and South Africa, with a valid residence permit from Singapore and several other countries, get 14 days (AED 100, extendable once) or 60 days (AED 250, no extension). Indian passports with a Singapore permit qualify under a separate rule." },
        { title: "Tourist visa through a sponsor", body: "An airline, a hotel or a licensed agent applies for you on the Dubai (GDRFA) or federal (ICP) system. A 30 or 60 day stay is common. Embassies do not issue it." },
        { title: "Transit and long stay", body: "Transit visas, work, residence and Golden Visa applications are separate processes. The tourist visa does not allow work." },
      ],
    },

    residents: {
      intro: "For people in Singapore, the pass matters most for Indian, Indonesian, Philippine and Vietnamese passports, because the visa on arrival needs a valid Singapore residence permit. A Singapore passport needs no visa at all.",
      rows: [
        { pass: "Employment Pass", body: "An EP holder with an Indian, Indonesian, Philippine or Vietnamese passport can get a visa on arrival with the EP as the residence permit. Keep the pass valid, carry the card and travel on an ordinary passport." },
        { pass: "S Pass", body: "The same as the Employment Pass. The S Pass is a Singapore residence permit, and the permit must be valid when you land." },
        { pass: "Dependant's Pass", body: "Accompanying family members are covered by the June 2026 rule for the six nationalities. Each person carries their own passport and a valid Dependant's Pass." },
        { pass: "Permanent Resident", body: "Carry your re-entry permit and NRIC with the passport of your own country. A PR with an eligible passport is covered as a Singapore resident." },
        { pass: "Singapore citizen", body: "No visa. Carry a passport valid for your trip, and note that the Singapore Ministry of Foreign Affairs says passports with only a single name are not allowed entry to the UAE." },
        { pass: "Student's Pass", body: "A Student's Pass is a Singapore residence permit. Ask the airline whether it accepts it for the visa on arrival, and carry a school letter." },
      ],
    },

    fees: {
      intro: "A visa-free entry costs nothing. The visa on arrival has fixed fees. A sponsor-filed tourist visa has a fee set by the issuing authority and the sponsor. VIZA's help is free.",
      rows: [
        { item: "Visa free entry", amount: "No fee", note: "Singapore passports, and the other exempt passports." },
        { item: "Visa on arrival, 14 days", amount: "AED 100", note: "For the six eligible nationalities with a valid permit. It can be extended once inside the UAE." },
        { item: "Visa on arrival, 60 days", amount: "AED 250", note: "A single stay that cannot be extended." },
        { item: "Tourist visa, sponsor-filed", amount: "Set by the issuing authority", note: "The airline, hotel or agent quotes the total. Check what it includes." },
        { item: "Overstay", amount: "AED 50 per day", note: "Charged for every day beyond the permitted stay." },
      ],
      processing: "Visa on arrival is issued at the airport. A tourist visa filed by a sponsor is commonly approved within about two working days, but no fixed time is published. Apply at least a week before you fly and do not book non-refundable flights before the visa arrives.",
    },

    apply: {
      intro: "The UAE does not have one public application site for every traveller, so the first job is to pick the right route. Choose how much help you want.",
      guided: {
        title: "Guided",
        body: "VIZA's AI confirms which route applies to your passport and residence, then walks you through the documents. You complete the step with your airline or sponsor yourself.",
      },
      fullService: {
        title: "Full-service",
        body: "A VIZA consultant checks your passport, permit and dates, and prepares the file for the sponsor, so the visa or the arrival check goes through the first time.",
      },
      steps: [
        { title: "Start on VIZA", body: "Upload your passport, Singapore pass and trip dates. We confirm whether you need a visa, a visa on arrival or nothing." },
        { title: "Prepare the file", body: "We check the passport validity, the residence permit and the return ticket against the route." },
        { title: "Apply through the route", body: "Use the sponsor route for a tourist visa, or carry the permit for the visa on arrival. Pay the government fee shown." },
        { title: "Travel", body: "Carry your passport, pass, ticket and hotel booking, with a printed copy of any visa." },
      ],
    },

    checklist: {
      intro: "The documents depend on the route. The list below is the common core, and the airline or sponsor can ask for more.",
      groups: [
        {
          applicant: "Everyone",
          items: [
            "Passport valid for at least 6 months, which airlines commonly ask for",
            "Return or onward ticket",
            "Hotel booking or the address where you stay",
            "A passport that has more than a single name",
          ],
        },
        {
          applicant: "Tourist visa through a sponsor",
          items: [
            "Colour passport copy and a recent photo",
            "Sponsor details, from the airline, hotel or agent",
            "Payment for the fee the sponsor quotes",
          ],
        },
        {
          applicant: "Employment Pass and S Pass",
          items: [
            "Valid pass card, with the pass valid through your return",
            "Ordinary passport of the eligible nationality",
            "Employer letter, if the airline asks",
          ],
        },
        {
          applicant: "Dependant's Pass",
          items: [
            "Dependant's Pass card and the main holder's pass copy",
            "Each person's own passport",
            "Marriage or birth certificate, if the airline asks",
          ],
        },
        {
          applicant: "Permanent Resident and student",
          items: [
            "Valid re-entry permit and NRIC, or Student's Pass and school letter",
            "The passport of your own country",
            "Proof of funds, if asked",
          ],
        },
      ],
    },

    travel: {
      intro: "The UAE is easy to enter once the paperwork is right. A few rules catch visitors out.",
      items: [
        { title: "Check the advisory", body: "The Singapore Ministry of Foreign Affairs advised in March 2026 that Singaporeans defer travel to the region. Read the current advisory before you book." },
        { title: "Single-name passports", body: "The Singapore Ministry says passports with only a single name are not allowed entry. Check the name on your passport page." },
        { title: "Know your stay length", body: "Your allowed days depend on the passport and the route. Count them, because overstays cost AED 50 per day." },
        { title: "Carry the proof", body: "Carry your pass, ticket, hotel booking and any visa copy, because the airline checks them at check-in." },
        { title: "Local laws", body: "Dress and behaviour rules are stricter than in Singapore, and rules on alcohol and public conduct differ by emirate." },
      ],
    },

    reviewed: {
      date: "25 November 2026",
      note: "Checked against the UAE Ministry of Foreign Affairs and the Singapore Ministry of Foreign Affairs. Some UAE pages were not available to our checks, so look at the links under Sources before you travel.",
    },

    related: {
      destinations: ["saudi-arabia", "egypt", "india", "turkiye"],
      guides: [
        { label: "Visa-free countries for Singapore passport holders", href: "/guides/visa-free-countries-singapore-passport" },
        { label: "e-Visa vs visa on arrival vs embassy visa", href: "/guides/e-visa-vs-visa-on-arrival-vs-embassy-visa" },
        { label: "UAE Ministry of Foreign Affairs, visa on arrival for residents of selected countries", href: "https://www.mofa.gov.ae/en/mediahub/news/2026/6/25/uae-grants-visa-on-arrival" },
        { label: "VIZA visa news", href: "/blog" },
      ],
    },
  },

  rejectionTitle: "Common rejection reasons",
  rejectionSub: "The UAE does not always explain a refusal. These are the points a consultant checks first.",
  rejectionReasons: [
    { title: "Residence permit not valid", body: "The visa on arrival needs a valid permit from an eligible country. An expired permit or a Social Visit Pass does not count." },
    { title: "Wrong passport type", body: "The June 2026 rule covers ordinary passports. A diplomatic or special passport follows different rules." },
    { title: "Passport validity too short", body: "Airlines commonly ask for at least 6 months, and short validity is refused at check-in." },
    { title: "Single-name passport", body: "A passport with only a single name is not allowed entry, according to the Singapore Ministry of Foreign Affairs." },
    { title: "Earlier overstay or fines", body: "Unpaid fines or an earlier overstay can block a new approval." },
  ],

  faqSub: "Can't find your answer? Ask the AI assistant below or message a VIZA consultant.",
  faq: [
    { category: "Do I need a visa", q: "Do Singaporeans need a visa for Dubai or the UAE?", a: "No. Singapore passport holders enter the UAE without a visa. The Singapore Ministry of Foreign Affairs says the stay is up to 90 days within any 180, though older UAE embassy pages say 30 days, so check before you fly." },
    { category: "Do I need a visa", q: "Do Indian passport holders in Singapore need a UAE visa?", a: "They can get a visa on arrival if they hold a valid Singapore residence permit, under a rule that started on 13 February 2025. US, UK and EU visas or permits also qualify." },
    { category: "Do I need a visa", q: "Can Indonesian, Philippine and Vietnamese passport holders in Singapore get a UAE visa on arrival?", a: "Yes. Since June 2026, ordinary passports from these countries with a valid Singapore residence permit can get a 14 day visa (AED 100, extendable once) or a 60 day visa (AED 250) on arrival." },
    { category: "Do I need a visa", q: "Do Chinese and Malaysian passport holders in Singapore need a UAE visa?", a: "Both are reported as visa exempt on arrival. We could not confirm the stay length on an official page, so check with the UAE authorities or your airline." },
    { category: "Applying", q: "How do I get a UAE tourist visa from Singapore?", a: "If you need one, an airline, a hotel or a licensed agent applies for you on the Dubai or federal system. Embassies do not issue UAE tourist visas." },
    { category: "Applying", q: "Does my Employment Pass or PR change the UAE rule?", a: "For Singapore, Malaysian and Chinese passports, no. For Indian, Indonesian, Philippine and Vietnamese passports, yes, because the visa on arrival needs a valid Singapore residence permit." },
    { category: "Applying", q: "Is there a UAE e-visa?", a: "The UAE issues a visa electronically through a sponsor on its Dubai and federal systems, with no open public portal. Many travellers need no visa at all." },
    { category: "Fees and time", q: "How much is the UAE visa on arrival?", a: "AED 100 for 14 days, which can be extended once, and AED 250 for 60 days, which cannot." },
    { category: "Fees and time", q: "How long does a UAE tourist visa take?", a: "A sponsor-filed visa is commonly approved within about two working days, though no fixed time is published. Apply at least a week ahead." },
    { category: "Fees and time", q: "What is the UAE overstay fine?", a: "AED 50 per day beyond the permitted stay, according to the UAE Ministry of Foreign Affairs." },
    { category: "Rejections", q: "What if my UAE visa or entry is refused?", a: "A consultant can check the permit, passport and documents for the likely cause. Fix it before you apply again, and do not travel on a refused visa." },
    { category: "Before you travel", q: "Is it safe to travel to the UAE now?", a: "Read the Singapore Ministry of Foreign Affairs advisory for the UAE. It advised deferring travel to the region in March 2026, and the current status is on the MFA page." },
    { category: "Before you travel", q: "How much does VIZA charge?", a: "Nothing. VIZA's help is free. You pay any government or sponsor fee directly." },
  ],

  sources: [
    { label: "UAE Ministry of Foreign Affairs, visa on arrival for residents of six countries", url: "https://www.mofa.gov.ae/en/mediahub/news/2026/6/25/uae-grants-visa-on-arrival", display: "mofa.gov.ae" },
    { label: "UAE Embassy New Delhi, expanded visa on arrival for Indian nationals", url: "https://www.mofa.gov.ae/en/Missions/New-Delhi/Media-hub/News/19-2-2025-new-delhi", display: "mofa.gov.ae" },
    { label: "Singapore Ministry of Foreign Affairs, UAE travel page", url: "https://www.mfa.gov.sg/travelling-overseas/travel-advisories-notices-and-visa-information/united-arab-emirates/", display: "mfa.gov.sg" },
    { label: "UAE Government portal, tourist visa", url: "https://u.ae/en/information-and-services/visa-and-emirates-id/tourist-visa", display: "u.ae" },
    { label: "ICP, Federal Authority for Identity, Citizenship, Customs and Port Security", url: "https://icp.gov.ae/en/", display: "icp.gov.ae" },
  ],

  price: {
    etaLabel: "Processing time",
    etaValue: "On arrival or about 2 days",
    title: "UAE tourist visa · visa on arrival",
    sub: "VIZA's help is free: route check and document review. Government and sponsor fees are paid directly.",
    foot: "VIZA's service is free. Any UAE visa fee is paid directly to the authority or sponsor.",
  },

  aiPlaceholder: "Ask anything about a UAE visa: Dubai from Singapore, visa on arrival, fees…",
};

export default unitedArabEmirates;
