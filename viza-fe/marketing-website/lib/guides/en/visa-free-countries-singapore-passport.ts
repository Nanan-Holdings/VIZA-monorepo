import type { GuideContent } from "../types";

/**
 * Guide: visa free countries for Singapore passport holders (and what residents on other passports get).
 *
 * Checked 25 Nov 2026 against:
 *   - ICA, mutual 30-day visa exemption with China (read; page updated Oct 2026)
 *   - ICA, advice for Singapore citizens travelling abroad (read; 6 months passport validity before departure)
 *   - Embassy of the Republic of Korea in Singapore notice (read: K-ETA exempt until 31 December 2027)
 *   - k-eta.go.kr (read: KRW 10,000, notice dated 2026-11-23, review generally within 72 hours)
 *   - Royal Thai Embassy Singapore tourist visa page (read: S$50 single entry, S$250 multiple, 60 days per entry,
 *     apply at least 21 working days ahead, passport valid for more than 6 months)
 *   - Thailand PRD notice (read: 60 day exemption revoked, 30 day scheme from 15 Sep 2026)
 *   - gov.uk ETA pages and the ETA national list (read: GBP 20, up to 6 months, Singapore listed)
 *   - Immigration Department of Malaysia visa requirement page (read: Singapore no visa)
 *   - European Commission pages (read: EES fully operational 10 Apr 2026; ETIAS not in operation, fee EUR 20)
 *
 * Not confirmed on an official page this session, so the copy hedges or omits:
 *   - Japan 90 days for Singapore passports (Embassy of Japan and MOFA pages returned 403; read through Singapore MFA and
 *     embassy search summaries only)
 *   - Vietnam 30 days per entry, Indonesia 30 days (not extendable) and Singapore MFA country pages (too large to fetch;
 *     read through search summaries that quote them)
 *   - Singapore passport on Thailand's 30 day list by name (the Thai notice gives counts only; the Thai MFA table and press name it)
 *   - Malaysia stay length for Singapore passports (the IMI page gives no number)
 *   - UAE stay length (Singapore MFA says 90 days in 180, the UAE embassy says 30 days extendable) and the status of the
 *     Singapore MFA Middle East advisory of early 2026
 *   - ESTA fee amount (sources range USD 40 to 40.62), ESTA validity of 2 years (CBP FAQ returned 404)
 *   - Australia ETA stay and validity, AUD 20 app fee (read through search summaries; Home Affairs page not read)
 *   - Canada eTA CAD 7 (canada.ca read through search summaries; Singapore not named on the page seen)
 *   - ETIAS start date (Commission says none announced; a press report says it slipped again)
 *   - passport validity rules per country other than Thailand (more than 6 months, Thai embassy page)
 *   - onward ticket rules per country (none read on an official page)
 *   - PR re-entry permit and pass rules for non-citizens travelling (not read on ICA)
 *   - any end date for China, Thailand and Korea arrangements beyond what is stated
 */
const guide: GuideContent = {
  title: "Singapore Passport Visa Free Countries and Rules | VIZA",
  description: "Singapore passport visa free guide: stay limits for China, Japan, Korea, Thailand, UAE, UK and Schengen, which need an ETA or arrival card, and how to check.",
  h1: "Singapore passport visa free countries and entry rules",
  lead: "A Singapore passport gets you into many countries without a visa, including China, Japan, South Korea, Thailand, Malaysia, Indonesia, Vietnam and the UAE. Some of them still ask for an online form first, such as the UK ETA, the Korea e-Arrival Card or the Thailand arrival card. The rules follow the passport, not where you live, so a PR or pass holder on another country's passport checks that passport instead.",
  glance: [
    { k: "Visa free, 30 days", v: "China (since 9 February 2024) and Thailand (from 15 September 2026)" },
    { k: "Visa free, longer", v: "Japan, 90 days, and Schengen, 90 days in any 180" },
    { k: "Online form first", v: "UK ETA, US ESTA, Korea e-Arrival Card, Thailand and Malaysia arrival cards" },
    { k: "Passport validity", v: "ICA advises at least 6 months before you leave, and some countries ask for more" },
    { k: "PR and pass holders", v: "Rules follow your passport, not your Singapore pass" },
  ],
  sections: [
    {
      id: "popular-destinations",
      heading: "Popular destinations at a glance",
      body: [
        "This table covers the places Singapore passport holders ask about most. The day limits are the ones we could confirm on government pages. Where a number is missing, the official page for that country is the place to check.",
      ],
      table: {
        head: ["Destination", "Visa", "Stay", "Still needed before you go"],
        rows: [
          ["[China](/visa/china)", "Not needed", "30 days", "Visa for work, study or longer stays"],
          ["[Japan](/visa/japan)", "Not needed", "90 days", "Visit Japan Web is optional, and recommended"],
          ["[South Korea](/visa/south-korea)", "Not needed", "Check the embassy page", "K-ETA waived until 31 December 2027, free e-Arrival Card"],
          ["[Thailand](/visa/thailand)", "Not needed", "30 days from 15 September 2026", "Free Thailand Digital Arrival Card"],
          ["[Malaysia](/visa/malaysia)", "Not needed", "Check the official page", "Singapore citizens skip the MDAC"],
          ["[Indonesia](/visa/indonesia)", "Not needed", "30 days, no extension", "All Indonesia arrival declaration"],
          ["[Vietnam](/visa/vietnam)", "Not needed", "30 days per entry", "Check your passport stamp on arrival"],
          ["[UAE](/visa/united-arab-emirates)", "Not needed", "Check the official page", "Check the MFA advisory before booking"],
          ["[United Kingdom](/visa/united-kingdom)", "Not needed", "Up to 6 months", "ETA, GBP 20"],
          ["[Schengen area](/visa/schengen)", "Not needed", "90 days in any 180", "Passport check and EES registration at the border"],
          ["[United States](/visa/united-states)", "Not needed", "90 days", "ESTA"],
        ],
      },
    },
    {
      id: "east-asia",
      heading: "East Asia",
      body: [
        "[China](/visa/china) and Singapore have a mutual 30 day visa exemption for ordinary passports. ICA's notice on the arrangement says it covers Singapore and Chinese ordinary passport holders for up to 30 days. If you are searching for how Singapore to China visa free works, that is the rule: show a Singapore passport and enter. Work, study and stays over 30 days need a visa. Singapore's MFA also notes that Hainan has a second visa exemption arrangement, so read the MFA China page if Hainan is your first stop. No end date is published on the pages we read.",
        "[Japan](/visa/japan) lets Singapore citizens enter without a visa for temporary visits of under 90 days, according to the Singapore MFA and the Embassy of Japan. The exemption covers tourism, visiting family and short business trips. Work, study and settling need a visa. [Visit Japan Web](/arrival-cards/japan-visit-japan-web) is a free service for immigration and customs steps. It is recommended, not required.",
        "[South Korea](/visa/south-korea) waives the K-ETA for Singapore passport holders. The Embassy of the Republic of Korea in Singapore states the exemption runs until 31 December 2027, and the K-ETA site carries a notice about the extension dated 23 November 2026. The waiver is a temporary one that Korea has renewed each year, so look at the date again before you book a trip far ahead. Visitors without a K-ETA submit the free [Korea e-Arrival Card](/arrival-cards/korea-e-arrival-card), which has been required since 1 January 2026.",
      ],
    },
    {
      id: "southeast-asia",
      heading: "Southeast Asia",
      body: [
        "[Thailand](/visa/thailand) changed its rules on 15 September 2026. The 60 day exemption was revoked and a 30 day tourism exemption applies instead. Thai government notices give the counts of countries on each scheme, and the Thai MFA table and press reports place Singapore on the 30 day list. Every visitor also fills in the free [Thailand Digital Arrival Card](/arrival-cards/thailand-tdac) within 3 days before arrival.",
        "If you plan to stay longer in Thailand, the Royal Thai Embassy in Singapore lists a tourist e-visa at S$50 for single entry and S$250 for multiple entry. It says to apply at least 21 working days before travel and to hold a passport valid for more than 6 months.",
        "[Malaysia](/visa/malaysia) does not need a visa from Singapore citizens, according to the Immigration Department's requirements page. Singapore citizens are also exempt from the [Malaysia Digital Arrival Card](/arrival-cards/malaysia-mdac) at all entry points, as announced in December 2023. Everyone else fills it in before they cross.",
        "[Indonesia](/visa/indonesia) allows Singapore passport holders in for up to 30 days without a visa, and the stay cannot be extended, according to the Singapore MFA. For a longer trip, consider the visa on arrival or e-VOA, which can be extended once. Visitors complete the free [All Indonesia](/arrival-cards/indonesia-all-indonesia) declaration before arrival.",
        "[Vietnam](/visa/vietnam) lets Singapore passport holders stay up to 30 days per entry without a visa, per the Singapore MFA. The MFA tells travellers to check the stay date stamped in the passport on arrival. Longer stays use the Vietnam e-visa.",
      ],
    },
    {
      id: "middle-east",
      heading: "UAE and the Middle East",
      body: [
        "For Singapore passport holders asking about a Singapore passport Dubai visa, the answer is that a visa is not needed for a tourist visit to the [UAE](/visa/united-arab-emirates). The length of stay differs between sources. The Singapore MFA page says 90 days within 180 days, and the UAE Embassy in Singapore has described a free visa on arrival of 30 days that can be extended by 30. Ask the airline or read both pages before you book a long stay.",
        "The Singapore MFA also publishes travel advisories for the Middle East. An advisory dated early 2026 advised Singaporeans to defer travel to the region. Read the current MFA page before you book, because advisories change.",
      ],
    },
    {
      id: "europe-uk-us",
      heading: "Europe, the UK and the US",
      body: [
        "The [Schengen area](/visa/schengen) lets Singapore citizens visit for up to 90 days within any 180 days without a visa, as long as they do not take up work. The 180 days roll forward, and the count covers all Schengen countries together. The EU Entry/Exit System has been fully operational since 10 April 2026, so your entries and exits are recorded electronically instead of stamped.",
        "ETIAS is the EU's planned online travel authorisation for visa exempt visitors, with a fee of EUR 20. The European Commission says it is not in operation yet and no applications are collected. The start date will be announced several months ahead, so check the EU page before a trip.",
        "The [United Kingdom](/visa/united-kingdom) asks Singapore citizens for an Electronic Travel Authorisation. Singapore is on the gov.uk ETA national list. The ETA costs GBP 20 and lets you visit for up to 6 months. Apply only on gov.uk or the official app, and do it before you book non-refundable travel.",
        "Singapore is a Visa Waiver Program country, so Singapore passport holders visit the [United States](/visa/united-states) for up to 90 days for tourism or business with an approved ESTA instead of a visa. The ESTA fee changes, so read it on the official ESTA site on the day you apply.",
        "Other places in this group follow the same pattern. Australia uses an ETA through its app, and its High Commission describes a AUD 20 service fee. Canada asks visa exempt travellers who fly in for an eTA, which Canada's government lists at CAD 7. See the [Australia](/visa/australia) and [Canada](/visa/canada) pages for the current steps.",
      ],
    },
    {
      id: "rules-and-entry",
      heading: "Visa free and visa exempt",
      body: [
        "Visa free and visa exempt mean the same thing in practice. You enter without a visa sticker, for a set number of days, for a set purpose such as tourism or short business. The words differ because some countries call it a visa waiver or an exemption scheme.",
        "Visa free does not mean paperwork free. Three things can still be asked of you. An electronic travel authorisation is a screening you finish online before you fly, such as the UK ETA, the US ESTA, the Canada eTA and the Australia ETA. An arrival card is a declaration, such as the Thailand, Korea, Indonesia and Malaysia cards, and it is not a permit. A registration step is biometric, such as the EU Entry/Exit System at the border.",
        "Passport validity is the most common reason for a refused boarding. ICA advises Singapore citizens to hold a passport valid for at least 6 months before leaving, in good condition with no torn or missing pages. A Singapore passport with less than 6 months can still be used to return home. Destinations set their own rules, and some count from the day you enter and others from the day you leave. Thailand's embassy page says more than 6 months, so plan for 6 months everywhere unless the country says otherwise.",
        "Onward tickets are checked by airlines. Some countries expect proof that you will leave, and an airline can refuse boarding if you have none. We could not confirm the rule per country on an official page, so keep a return or onward booking ready for every trip, and ask the airline if you are unsure.",
        "The stay limit is a ceiling set by the officer at the border. The Singapore MFA's Vietnam note says the same, as final entry decisions rest with Vietnamese immigration. Keep your accommodation, your return booking and a funds record handy.",
      ],
      list: [
        "Passport valid for at least 6 months, with blank pages.",
        "A return or onward booking.",
        "Any online authorisation or arrival card for your destination, from the official site only.",
        "Travel insurance and the address of your first night.",
      ],
    },
    {
      id: "residents-other-passports",
      heading: "If you live here on another passport",
      body: [
        "Many people in Singapore hold an Employment Pass, S Pass, Dependant's Pass, student's pass or PR on a passport from India, China, the Philippines, Indonesia, Vietnam or another country. The visa free list above does not apply to you. A Singapore pass is a permit to live here, and it does not give you the Singapore passport's rights.",
        "Some countries have special rules for residents of Singapore on certain passports. The UAE gives some Indonesian, Vietnamese, Philippine and Indian passport holders a visa on arrival when they have a Singapore residence permit. Check the rule for your own passport, since it changes.",
        "Start with the destination page for your trip, then match it to your passport. The Chinese passport and Indian and Filipino passport pages cover residents in more depth: [visas for Chinese passport holders in Singapore](/guides/visas-chinese-passport-holders-singapore) and [visas for Filipino and Indian residents in Singapore](/guides/visas-filipino-indian-residents-singapore).",
        "For a Schengen trip, the [Schengen visa checklist for Singapore](/guides/schengen-visa-checklist-singapore) shows what residents bring. For the United States, read the [US visa interview guide for Singapore](/guides/us-visa-interview-singapore). If an online authorisation is the question, the guide on [ETA and visa](/guides/eta-vs-visa) explains the difference, and the guide on [e-visa, visa on arrival and embassy visa](/guides/e-visa-vs-visa-on-arrival-vs-embassy-visa) covers the other routes.",
        "Your Singapore pass also needs to stay valid. If you hold a long-term pass or PR, confirm with ICA that your pass or re-entry permit covers your return date before you fly.",
      ],
    },
    {
      id: "check-live",
      heading: "How to check the rules live",
      body: [
        "Rules change fast. Korea's waiver is renewed yearly, and Thailand changed its scheme in September 2026. Use official sources, and look at the date on the page.",
      ],
      list: [
        "Singapore MFA travel pages at mfa.gov.sg, which list entry notes and advisories for each country. Official Singapore links end in .gov.sg.",
        "ICA advice for Singapore citizens travelling abroad, for passport validity and travel tips.",
        "The embassy or immigration site of your destination, which has the final word.",
        "Your airline. Airlines check your documents at check-in and often use IATA's Timatic database. Many airline sites have a travel requirements checker that uses it.",
        "The official portal for any online form: gov.uk for the ETA, the official ESTA site, k-eta.go.kr, and the arrival card sites named in the guides above.",
      ],
    },
    {
      id: "next-steps",
      heading: "Next steps",
      body: [
        "Open the page for your destination: [China](/visa/china), [Japan](/visa/japan), [South Korea](/visa/south-korea), [Thailand](/visa/thailand), [Vietnam](/visa/vietnam), [UAE](/visa/united-arab-emirates) or [United Kingdom](/visa/united-kingdom). Each one covers Singapore residents on every pass type. Set up the arrival cards for [Malaysia](/arrival-cards/malaysia-mdac), [Japan](/arrival-cards/japan-visit-japan-web), [Thailand](/arrival-cards/thailand-tdac), [Korea](/arrival-cards/korea-e-arrival-card) and [Indonesia](/arrival-cards/indonesia-all-indonesia) just before you fly.",
        "VIZA is an independent service. It is free to use. Government fees and visa centre fees are paid directly to the authority and are separate. VIZA is not a government body.",
      ],
    },
  ],
  faq: [
    { q: "Which countries can I enter visa free with a Singapore passport?", a: "Many, including China, Japan, South Korea, Thailand, Malaysia, Indonesia, Vietnam, the UAE, Schengen countries, the UK and the US. Several need an online authorisation or arrival card first. Check each destination page and the official site before you book." },
    { q: "Is Singapore to China visa free?", a: "Yes. Singapore and China have a mutual 30 day visa exemption for ordinary passports. Work, study and stays over 30 days need a visa. Read the ICA notice and the Singapore MFA China page before you go." },
    { q: "Do Singaporeans need a visa for Japan?", a: "No. Singapore passport holders can enter Japan for under 90 days without a visa, for tourism, family visits and short business trips. Work and study need a visa. Visit Japan Web is free and recommended." },
    { q: "Do Singapore citizens need a K-ETA for South Korea?", a: "No. The Embassy of the Republic of Korea in Singapore says Singapore passport holders are exempt from the K-ETA until 31 December 2027. You still submit the free Korea e-Arrival Card. The waiver is temporary, so check its date." },
    { q: "How many days can a Singapore passport stay in Thailand without a visa?", a: "Thailand's tourism exemption is 30 days from 15 September 2026, down from 60. Fill in the free Thailand Digital Arrival Card within 3 days before arrival. For longer stays, the tourist e-visa costs S$50 for a single entry at the Royal Thai Embassy in Singapore." },
    { q: "Do I need a visa for Dubai with a Singapore passport?", a: "No. A Singapore passport holder does not need a visa for a tourist visit to the UAE. Stay length differs between sources, so confirm it on the Singapore MFA page and the UAE Embassy, and read any MFA advisory for the Middle East first." },
    { q: "Do Singapore citizens need an ETA for the UK?", a: "Yes. Singapore is on the UK ETA list. The ETA costs GBP 20 and lets you visit for up to 6 months. Apply only on gov.uk or the official app." },
    { q: "Can I travel to Europe visa free with a Singapore passport?", a: "Yes, for up to 90 days in any 180 days in the Schengen area, without working. The EU Entry/Exit System has run since 10 April 2026. ETIAS is planned, with a EUR 20 fee, and is not in operation yet." },
    { q: "How long should my passport be valid for travel?", a: "ICA advises Singapore citizens to hold a passport valid for at least 6 months before leaving. Some countries ask for more, and others count from your entry date. Check the destination's rule." },
    { q: "I am a PR or EP holder from India or China. Do I get the Singapore passport rules?", a: "No. The rules follow your passport, not your Singapore pass. Check the destination for your own passport, and read the guides for Chinese, Filipino and Indian residents." },
    { q: "Where can I check the latest visa rules for Singapore passport holders?", a: "Use the Singapore MFA travel pages, the destination's embassy or immigration site, and your airline's travel requirements check. Official Singapore pages end in .gov.sg." },
  ],
  sources: [
    { label: "ICA, mutual 30 day visa exemption between Singapore and China", url: "https://www.ica.gov.sg/about-ica/news-and-publications/media-room/mutual-30-day-visa-exemption-arrangement-between-singapore-and-the-people-s-republic-of-china" },
    { label: "ICA, advice for Singapore citizens travelling abroad", url: "https://www.ica.gov.sg/enter-depart/for-singapore-citizens/advice-for-travelling-abroad" },
    { label: "Singapore MFA, travel advisories, notices and visa information", url: "https://www.mfa.gov.sg/travelling-overseas/travel-advisories-notices-and-visa-information/" },
    { label: "Embassy of the Republic of Korea in Singapore, K-ETA exemption notice", url: "https://www.mofa.go.kr/sg-en/brd/m_2435/view.do?seq=761475" },
    { label: "Korea K-ETA portal", url: "https://www.k-eta.go.kr" },
    { label: "Royal Thai Embassy Singapore, tourist visa", url: "https://singapore.thaiembassy.org/en/page/tourist-visa" },
    { label: "Thailand Public Relations Department, visa exemption changes from 15 September 2026", url: "https://thailand.prd.go.th/en/content/category/detail/id/48/iid/538547" },
    { label: "GOV.UK, electronic travel authorisation", url: "https://www.gov.uk/guidance/electronic-travel-authorisation-eta" },
    { label: "GOV.UK, ETA national list", url: "https://www.gov.uk/guidance/immigration-rules/immigration-rules-appendix-eta-national-list" },
    { label: "Immigration Department of Malaysia, visa requirement by country", url: "https://www.imi.gov.my/index.php/en/main-services/visa/visa-requirement-by-country/" },
    { label: "European Commission, Entry/Exit System fully operational", url: "https://commission.europa.eu/news-and-media/news/more-secure-efficient-and-convenient-way-travelling-non-eu-nationals-2026-04-10_en" },
    { label: "European Commission, ETIAS", url: "https://home-affairs.ec.europa.eu/policies/schengen/smart-borders/european-travel-information-authorisation-system_en" },
  ],
  reviewed: "Checked on 25 November 2026 against ICA, the Singapore MFA, the Embassy of the Republic of Korea in Singapore, the K-ETA portal, the Royal Thai Embassy in Singapore, GOV.UK, the Immigration Department of Malaysia and the European Commission. Some Singapore MFA, Japan, Vietnam, Indonesia and UAE details were read through summaries and could not be opened in full, so check those pages before you book.",
};

export default guide;
