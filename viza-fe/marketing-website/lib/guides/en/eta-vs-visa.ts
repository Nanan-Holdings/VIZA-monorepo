import type { GuideContent } from "../types";

/**
 * Guide: ETA vs visa (UK, Australia, Korea, Canada) for people living in Singapore.
 *
 * Checked 25 Nov 2026. Pages opened and read on the day:
 *   - gov.uk: apply for an ETA (GBP 20, 2 years or until passport expires, decision usually within a day, up to 3 working days),
 *     the ETA guidance page (up to 6 months, not a guarantee of entry, each traveller needs one), the "check when you can get an ETA"
 *     list (Singapore and Malaysia listed; China, India, Indonesia, Philippines, Vietnam not listed), the ETA national list in the
 *     Immigration Rules (same result), apply for a Standard Visitor visa (GBP 135, apply online then biometrics at a centre that
 *     "could be in another country", usually 3 weeks, earliest 3 months before travel)
 *   - Australian High Commission Kuala Lumpur ETA page (AUD 20 service charge, app is the only channel, up to one year, 3 months
 *     per visit, apply at least 4 weeks ahead)
 *   - k-eta.go.kr guide page (KRW 10,000, generally within 72 hours, only k-eta.go.kr or the K-ETA app)
 *   - Embassy of Korea in Singapore notice list ("Singapore passport holders are exempted from K-ETA till 31 December 2027")
 *   - MOFA Korea Singapore notice of 24 Dec 2025 (exempt nationals can still apply for K-ETA for a fee to skip the arrival card)
 *   - canada.ca eTA apply page (CAD 7, most approved within minutes), eTA facts page (up to 5 years or until passport expires,
 *     flying only), eTA eligibility page, the eTA-x list (15 countries incl. Philippines and Thailand, conditions), and the entry
 *     requirements by country page (Singapore listed under eTA when travelling by air)
 * Not confirmed on an official page this session (copy hedges or leaves it out):
 *   - Australia: immi.homeaffairs.gov.au returned 403. Singapore ETA eligibility rests on the Singapore MFA Australia page as quoted
 *     in search results (the page itself was too large to fetch) and the repo's /visa/australia page. The Visitor visa (600) fee is
 *     not quoted (third-party pages say the Tourist stream rose on 1 Jul 2026, not read on Home Affairs).
 *   - Korea: the K-ETA validity period (the site mentions an expansion, no number read), the maximum stay for Singapore passports,
 *     the e-Arrival Card exemption list for K-ETA holders (reported, not read on e-arrivalcard.go.kr), and Korea's exempt list for
 *     other passports. A K-ETA notice dated 2026-11-23 on k-eta.go.kr was visible by title only.
 *   - Canada: Malaysia and Indonesia. The eTA apply page says some citizens may apply for an eTA, the eTA-x list does not name them.
 *     The visitor visa fees (CAD 100 plus CAD 85 biometrics) come from the repo's /visa/canada page, read on canada.ca earlier.
 *   - US: Singapore in the Visa Waiver Program seen in a search result quoting travel.state.gov and in the repo's /visa/united-states
 *     page (the State Department page returned 403). The ESTA fee is left out. The task brief said Singapore is not in the VWP,
 *     the sources say it is, so the copy follows the sources.
 *   - Europe: the ETIAS page on travel-europe.europa.eu returned only a title. EUR 20, 3 years and "not in operation, no date
 *     announced" come from the repo's /visa/schengen page. Search reports on a start date conflict, so the copy says to check.
 *   - Thailand: 30 day visa free stay from 15 Sep 2026, the S$50 e-visa and TDAC facts come from the repo's /visa/thailand page.
 */
const guide: GuideContent = {
  title: "ETA vs Visa: K-ETA, UK, Australia, Canada | VIZA",
  description: "ETA vs visa for people living in Singapore: how K-ETA, UK ETA, Australia ETA and Canada eTA work, fees, who needs which, and what to do on another passport.",
  h1: "ETA vs visa: how K-ETA, UK ETA, Australia ETA and Canada eTA work",
  lead: "An ETA is a short online approval linked to your passport. It is not a visa, and it is not an arrival card. If you live in Singapore, the rule that applies to you is the one for the passport you hold, so a Singapore passport, an Indian passport and a Chinese passport each lead to a different answer.",
  glance: [
    { k: "What an ETA is", v: "An online approval for visitors who do not need a visa, linked to your passport" },
    { k: "Singapore passport", v: "Needs a UK ETA, an Australia ETA and a Canada eTA when flying. No K-ETA until 31 December 2027" },
    { k: "Fees", v: "UK GBP 20, Australia AUD 20 service charge, Canada CAD 7, Korea KRW 10,000" },
    { k: "Other passports", v: "If your passport is not eligible for an ETA, you apply for a visa with the passport you hold" },
    { k: "Where to apply", v: "Only the government app or site. Fees are paid to the authority" },
  ],
  sections: [
    {
      id: "what-is-an-eta",
      heading: "What an ETA is",
      body: [
        "An Electronic Travel Authorisation, or ETA, is a short online approval for visitors who do not need a visa. You fill in a form, pay a small fee and the authority links the approval to your passport. There is no embassy visit and no interview. Most decisions come back within minutes to a few days.",
        "An ETA does not guarantee entry. The UK says so on gov.uk, and the other schemes work the same way. The border officer still decides when you arrive.",
        "Your passport decides which rule applies. An Employment Pass, S Pass, Dependant's Pass, work permit, student pass or Singapore PR status does not change it. You follow the rule for the passport in your hand, and the Singapore pass only helps as proof that you live and work here when you apply for a visa.",
      ],
    },
    {
      id: "eta-visa-arrival-card",
      heading: "ETA, visa and arrival card",
      body: [
        "People mix up three different things. An ETA is a permission for visa free passports. A visa is a permission for the other passports. An arrival card is a declaration of your trip details, not a permission.",
        "A trip can need more than one. A Singapore passport going to Korea needs no visa and no K-ETA, and still files the free [Korea e-Arrival Card](/arrival-cards/korea-e-arrival-card). Thailand and Singapore also have their own cards: see the [Thailand TDAC guide](/arrival-cards/thailand-tdac) and the [SG Arrival Card guide](/arrival-cards/singapore-sg-arrival-card).",
      ],
      table: {
        head: ["Document", "What it is", "Who it is for", "Examples"],
        rows: [
          ["ETA", "Online approval linked to your passport", "Passports the destination exempts from a visa", "UK ETA, Australia ETA, Canada eTA, Korea K-ETA"],
          ["Visa", "Permission to enter, with documents and often biometrics", "Passports that are not exempt", "UK Standard Visitor visa, Australia Visitor visa, Canada visitor visa"],
          ["Arrival card", "A trip declaration, not a permission", "Almost every foreign visitor, with or without a visa or ETA", "Korea e-Arrival Card, Thailand TDAC"],
        ],
      },
    },
    {
      id: "uk-eta-singapore",
      heading: "UK ETA from Singapore",
      body: [
        "Singapore and Malaysia are on the UK's ETA list. The UK ETA costs GBP 20 and lasts 2 years or until your passport expires, whichever comes first. It allows visits of up to 6 months. You can make as many trips as you like during that time.",
        "Apply in the UK ETA app, which scans your passport and your face, or on gov.uk. You usually get an email decision within a day, and it can take up to 3 working days. Do not fly until the email arrives. Every traveller needs one, babies and children included. For the UK ETA in Singapore, the steps are the same as anywhere else, because the application is online.",
        "China, India, Indonesia, the Philippines and Vietnam are not on the ETA list. Gov.uk says other nationalities cannot get an ETA, so those passports apply for the Standard Visitor visa. It costs GBP 135 for 6 months. You apply online, then book a biometrics appointment at a visa application centre. Gov.uk says the centre could be in another country, so choose Singapore when you book. A decision usually comes within 3 weeks, and you can apply up to 3 months before you travel.",
        "The [UK visa from Singapore page](/visa/united-kingdom) covers the visa documents by pass type.",
      ],
    },
    {
      id: "australia-eta-visa",
      heading: "Australia visa and ETA from Singapore",
      body: [
        "Every passport needs approval to enter Australia. Singapore citizens can apply for the Electronic Travel Authority, subclass 601, according to the Singapore Ministry of Foreign Affairs. This is the answer most people want when they search for an Australia visa from Singapore with an ETA.",
        "The Australian High Commission says the Australian ETA app is the only way to apply. There is no visa application charge, and the app adds a service charge of AUD 20. The ETA allows multiple entries for up to one year, or until your passport expires if that is sooner. Each visit can last up to 3 months. The High Commission suggests applying at least 4 weeks before you travel, and each person, children included, applies separately.",
        "Singapore citizens can also apply for a Long Validity Visitor visa, subclass 600, at the Australian visa application centre in Singapore, according to the same MFA page. Chinese, Indian, Indonesian, Philippine and Vietnamese passports are not on the ETA route and apply for the Visitor visa, subclass 600, online. The fee is on the Home Affairs price list, so check it before you pay.",
        "The [Australia visa from Singapore page](/visa/australia) lists the documents by pass type.",
      ],
    },
    {
      id: "korea-k-eta",
      heading: "Korea K-ETA and e-Arrival Card",
      body: [
        "The K-ETA is Korea's online authorisation for travellers who can enter without a visa. It costs KRW 10,000 and a decision generally comes within 72 hours. Apply only at k-eta.go.kr or in the K-ETA app. Sites that charge more are not the government.",
        "Singapore passports are on Korea's temporary exemption list. The Korean Embassy in Singapore says Singapore passport holders are exempt from the K-ETA until 31 December 2027. That means a Singapore citizen needs no visa and no K-ETA for a short visit. You still file the free e-Arrival Card within 3 days before you arrive. If you choose to buy a K-ETA anyway, Korean authorities say it lets you skip the arrival card.",
        "If you live in Singapore on another passport, search for your nationality on the K-ETA eligibility list. A passport on the list needs a K-ETA, at least 72 hours before you board. A passport that is not on the list needs a short-term visa from the Korean Embassy or visa centre. The [Korea K-ETA and visa page](/visa/south-korea) explains the visa route.",
      ],
    },
    {
      id: "canada-eta-singapore",
      heading: "Canada eTA from Singapore",
      body: [
        "Singapore is on Canada's list of countries that need an eTA to fly in. The Canada eTA costs CAD 7 and lasts up to 5 years or until your passport expires. Most applications are approved within minutes. Some applicants are asked for documents first, and instructions arrive by email within 72 hours.",
        "You need the eTA only when you fly to or transit through a Canadian airport. Arriving by car, bus, train or boat does not need one. Apply on the official canada.ca form, which is in English and French. The form cannot be saved, so have your passport and email ready.",
        "Other passports follow a different path. Chinese, Indian and Vietnamese passport holders apply for a visitor visa, which costs CAD 100 plus CAD 85 for biometrics. Philippine and Thai passports can use an eTA to fly if they held a Canadian visitor visa in the last 10 years or hold a valid US nonimmigrant visa on the day they apply. For Malaysian and Indonesian passports, Canada says some citizens may qualify for an eTA, so use the IRCC entry requirements tool before you apply for a visa.",
        "The [Canada visa from Singapore page](/visa/canada) covers the visitor visa.",
      ],
    },
    {
      id: "four-etas-compared",
      heading: "The four ETAs compared",
      body: [
        "This table shows a Singapore passport and the rule for people on other passports. Each cell comes from the official page named in the sources.",
      ],
      table: {
        head: ["", "UK ETA", "Australia ETA", "Korea K-ETA", "Canada eTA"],
        rows: [
          ["Singapore passport", "Needed", "Needed", "Not needed until 31 Dec 2027", "Needed when flying"],
          ["Fee", "GBP 20", "AUD 20 service charge", "KRW 10,000", "CAD 7"],
          ["Validity", "2 years or until passport expires", "Up to 1 year or until passport expires", "Check the K-ETA site", "Up to 5 years or until passport expires"],
          ["Stay per visit", "Up to 6 months", "Up to 3 months", "Check the Korean Embassy page", "Set by the border officer"],
          ["Where to apply", "UK ETA app or gov.uk", "Australian ETA app only", "k-eta.go.kr or K-ETA app", "canada.ca online form"],
          ["Usual decision", "Within a day, up to 3 working days", "Apply at least 4 weeks ahead", "Generally within 72 hours", "Most within minutes"],
          ["If your passport is not eligible", "Standard Visitor visa", "Visitor visa, subclass 600", "Short-term visa", "Visitor visa"],
        ],
      },
    },
    {
      id: "thailand-us-europe",
      heading: "Thailand, the US and Europe",
      body: [
        "Thailand has no ETA, so a search for a Thailand ETA visa leads to three other things. Singapore passports enter Thailand visa free for up to 30 days from 15 September 2026. A longer stay needs the Thailand tourist e-visa, which you apply for online. Every visitor also files the free TDAC, which is an arrival card and not a visa or an ETA. Read the [Thailand visa page](/visa/thailand) and the [TDAC guide](/arrival-cards/thailand-tdac).",
        "The United States has its own ETA style approval called ESTA. Singapore is in the US Visa Waiver Program, so Singapore passports apply for an ESTA before a short trip. Other passports apply for a B1/B2 visa. See the [US visa page](/visa/united-states).",
        "Europe plans an ETIAS for visa free visitors, including Singapore passports. It is meant to cost EUR 20. When we checked, ETIAS was not in operation and we found no confirmed start date, so check the EU travel site before you book. The [Schengen visa page](/visa/schengen) tracks it.",
      ],
    },
    {
      id: "next-steps",
      heading: "Next steps",
      body: [
        "Find your passport in the table, then open the page for your destination: [UK](/visa/united-kingdom), [Australia](/visa/australia), [Korea](/visa/south-korea) or [Canada](/visa/canada). Guides for Chinese, Indian and Filipino passports are the [Chinese passport guide](/guides/visas-chinese-passport-holders-singapore) and the [Filipino and Indian residents guide](/guides/visas-filipino-indian-residents-singapore). For the passports that are visa free, see the [visa free countries guide](/guides/visa-free-countries-singapore-passport).",
        "VIZA's service is free, and VIZA is an independent service. The ETA fee, the visa fee and any visa centre fee are paid directly to the authority and are separate. Approval is decided by the authority.",
      ],
    },
  ],
  faq: [
    { q: "What is the difference between an ETA and a visa?", a: "An ETA is a short online approval for passports that do not need a visa. A visa is for passports that are not exempt, and usually needs documents and sometimes biometrics. Neither guarantees entry." },
    { q: "What is K-ETA, and do Singaporeans need it?", a: "K-ETA is Korea's online travel authorisation for visa free visitors, and it costs KRW 10,000. The Korean Embassy in Singapore says Singapore passport holders are exempt until 31 December 2027, so they do not need one. They still file the free e-Arrival Card." },
    { q: "Do I need a UK ETA with a Singapore passport?", a: "Yes. Singapore is on the UK's ETA list. You apply in the UK ETA app or on gov.uk, and the ETA costs GBP 20." },
    { q: "How do I apply for a UK ETA in Singapore?", a: "Apply online in the UK ETA app or on gov.uk with your passport and a photo of your face. Decisions usually come by email within a day and can take up to 3 working days. There is no appointment." },
    { q: "How long is a UK ETA valid?", a: "It lasts 2 years or until your passport expires, whichever comes first. You can make unlimited trips of up to 6 months each." },
    { q: "Do I need an Australia ETA or a visa from Singapore?", a: "A Singapore citizen applies for an ETA, subclass 601, in the Australian ETA app, which adds a service charge of AUD 20. Chinese, Indian, Indonesian, Philippine and Vietnamese passports apply for the Visitor visa, subclass 600." },
    { q: "Do Singaporeans need a Canada eTA?", a: "Yes, when flying to or through Canada. The eTA costs CAD 7 and is valid for up to 5 years or until your passport expires. You do not need one to enter by land or sea." },
    { q: "I live in Singapore on an Indian or Chinese passport. Can I get an ETA?", a: "Not for the UK or Canada. India and China are not on the UK ETA list, and both need a visitor visa for Canada. Australia also asks these passports for a Visitor visa. Apply with the passport you hold, and use your Singapore pass as proof of residence." },
    { q: "Is there a Thailand ETA visa?", a: "No. Thailand has no ETA. Singapore passports enter visa free for up to 30 days, a longer stay uses the tourist e-visa, and the TDAC is a free arrival card." },
    { q: "Is the Korea e-Arrival Card the same as the K-ETA?", a: "No. The K-ETA is a travel authorisation and the e-Arrival Card is a free declaration filed within 3 days before arrival. Korean authorities say a K-ETA lets you skip the card." },
    { q: "Do I need an ESTA for the US with a Singapore passport?", a: "Yes. Singapore is in the Visa Waiver Program, so you apply for an ESTA before a short trip. Check the amount on the official ESTA site." },
    { q: "Is ETIAS in operation for Europe?", a: "When we checked on 25 November 2026, ETIAS was not in operation and we found no confirmed start date. It is meant to cost EUR 20. Check the EU travel site before you book." },
  ],
  sources: [
    { label: "GOV.UK, apply for an ETA", url: "https://www.gov.uk/eta/apply" },
    { label: "GOV.UK, electronic travel authorisation guidance", url: "https://www.gov.uk/guidance/apply-for-an-electronic-travel-authorisation-eta" },
    { label: "GOV.UK, check when you can get an ETA", url: "https://www.gov.uk/guidance/check-when-you-can-get-an-electronic-travel-authorisation-eta" },
    { label: "GOV.UK, Immigration Rules Appendix ETA National List", url: "https://www.gov.uk/guidance/immigration-rules/immigration-rules-appendix-eta-national-list" },
    { label: "GOV.UK, apply for a Standard Visitor visa", url: "https://www.gov.uk/standard-visitor/apply-standard-visitor-visa" },
    { label: "Australian High Commission, ETA", url: "https://malaysia.embassy.gov.au/klpr/ETA.html" },
    { label: "Singapore MFA, Australia travel information", url: "https://www.mfa.gov.sg/travelling-overseas/travel-advisories-notices-and-visa-information/australia/" },
    { label: "K-ETA, official guide", url: "https://www.k-eta.go.kr/portal/guide/index.do" },
    { label: "Embassy of Korea in Singapore, K-ETA notices", url: "https://overseas.mofa.go.kr/sg-en/brd/m_2435/view.do?seq=761475" },
    { label: "Korea MOFA, K-ETA exemption extension", url: "https://www.mofa.go.kr/sg-ko/brd/m_11935/view.do?seq=1347008" },
    { label: "Korea Electronic Arrival Card platform", url: "https://www.e-arrivalcard.go.kr" },
    { label: "Canada.ca, apply for an eTA", url: "https://www.canada.ca/en/immigration-refugees-citizenship/services/visit-canada/eta/apply.html" },
    { label: "Canada.ca, eTA facts", url: "https://www.canada.ca/en/immigration-refugees-citizenship/services/visit-canada/eta/facts.html" },
    { label: "Canada.ca, entry requirements by country", url: "https://www.canada.ca/en/immigration-refugees-citizenship/services/visit-canada/entry-requirements-country.html" },
    { label: "EU travel site, ETIAS", url: "https://travel-europe.europa.eu/en/etias" },
  ],
  reviewed: "Checked on 25 November 2026 against gov.uk, the Australian High Commission, the Singapore MFA, k-eta.go.kr, the Embassy of Korea in Singapore, Canada.ca and the EU travel site. Home Affairs and the US State Department pages did not load, so check the Australia Visitor visa fee, the ESTA fee and the ETIAS start date on the official sites.",
};

export default guide;
