import type { GuideContent } from "../types";

/**
 * Guide: visas for Filipino and Indian passport holders living in Singapore (English).
 *
 * Sources opened on 25 Nov 2026 (read directly unless marked otherwise):
 *   - ICA visa requirements page (33 countries, India listed, Philippines not listed, how to apply)
 *   - ICA SG Arrival Card page
 *   - High Commission of Singapore in New Delhi, visa information (page updated 11 Aug 2026)
 *   - VFS Global Japan Visa Application Centre Singapore page (fees, service fee, photo, processing)
 *   - Royal Thai Embassy Singapore tourist visa page, Royal Thai Embassy New Delhi update (27 Jul 2026),
 *     thailand.prd.go.th notice (15 Sep 2026), Thai MFA country table PDF (file dated 20 May 2026)
 *   - EU Home Affairs "applying for a Schengen visa" and the 28 Apr 2026 EES and ETIAS article
 *   - gov.uk Standard Visitor apply page and the Visitor visa national list (India and Philippines listed)
 *   - Embassy of Korea in Singapore KVAC notice (m_2444, seq 761433)
 *   - Turkish MFA visa information page
 *   - Chinese Visa Application Service Centre Singapore page (address, process, hours, optional service fees)
 *
 * Not confirmed on an official page (the copy hedges, points to the official page, or leaves it out):
 *   - Japan: the Embassy of Japan and MOFA pages returned HTTP 403. That both passports need a visa rests on the VFS
 *     fee table and the repo's Japan page. The Embassy rule that applicants must hold a valid Singapore pass and
 *     live here came from a search summary of the Embassy FAQ. Whether the JAPAN eVISA is open to Singapore
 *     residents is unconfirmed, so the copy tells readers to check. The VFS table lists Indonesia and Vietnam at
 *     S$26 and S$53, which looks older than the July 2026 fee rise, so no other nationality's fee is quoted.
 *     The Embassy says 5 working days and VFS says 10 business days minimum, so the copy says allow two weeks or more.
 *   - Thailand: the Royal Gazette text was not read. India's 30 day exemption rests on the Royal Thai Embassy New
 *     Delhi notice and the Thai government PRD notice (which names no countries). The Thai MFA table file dated
 *     20 May 2026 still lists India under visa on arrival; the New Delhi update of 27 Jul 2026 supersedes it. The
 *     Singapore Embassy page is undated and still says 60 days per entry on an e-visa. Extension and land border
 *     rules left out. The TDAC rule comes from the repo's TDAC guide.
 *   - Schengen: the EUR 30,000 minimum insurance figure is not on the EU page, so it is left out. Visa centre
 *     providers and service fees per country in Singapore were not confirmed.
 *   - UK: whether Indian and Filipino residents of Singapore may book biometrics in Singapore is not stated on
 *     gov.uk, so the copy says the centre can be in another country and to choose when booking.
 *   - Korea: India and Philippines visa status and K-ETA eligibility were not read on the K-ETA site (copy says to
 *     check the list). The fee for Filipino applicants was not read, only the base S$52 line from a search summary.
 *   - Vietnam: evisa.gov.vn failed its certificate check. The e-visa fee, validity and the number of visa free
 *     days for Philippine passports (lists differ) are not quoted.
 *   - Indonesia: evisa.imigrasi.go.id did not show the visa on arrival rules. India on the visa on arrival list,
 *     the fee and the August 2026 proposed rise are unconfirmed, so no fee is quoted.
 *   - Australia: Home Affairs returned HTTP 403. No fee or processing time is quoted, and the ETA list is not
 *     quoted beyond saying the ETA is for other passports.
 *   - Turkiye: the evisa.gov.tr eligibility page did not load. The MFA page was read. The e-Visa fee is not quoted.
 *   - China: no visa fee read on an official page. The visa free lists and the 240 hour transit list were not
 *     re-read, so the copy says to check them.
 *   - Singapore: the visa validity, the Local Contact application steps and the stay length for Filipino visitors
 *     are not on the ICA pages.
 */
const guide: GuideContent = {
  title: "Visas for Indian and Filipino Residents of Singapore | VIZA",
  description: "Do Indians need a visa for Thailand? Japan, Schengen, UK, Korea and more for Indian and Filipino passports living in Singapore, and where each one is lodged.",
  h1: "Visas for Indian and Filipino passport holders living in Singapore",
  lead: "If you live in Singapore on an Indian or Filipino passport, your passport decides the rule and your pass shows the embassy that you live here. Japan, Schengen, the UK, Korea, Australia and China need a visa. Thailand is visa free for 30 days on both passports from 15 September 2026, and some countries use an e-visa. This guide covers each country and where the application goes from Singapore.",
  glance: [
    { k: "Rule", v: "Your passport decides, not where you live" },
    { k: "Visa needed", v: "Japan, Schengen, UK, Korea, Australia, China, and Turkiye with conditions" },
    { k: "No visa for a short trip", v: "Thailand on both passports. Filipino passports also for Vietnam and Indonesia" },
    { k: "Lodged from Singapore", v: "Embassies, visa centres, or online portals, depending on the country" },
    { k: "Visiting Singapore", v: "Indian passports need a visa. Filipino passports are not on ICA's visa list" },
  ],
  sections: [
    {
      id: "overview",
      heading: "Country by country overview",
      body: [
        "The table shows what each passport needs for a short tourist visit and where the application goes if you live in Singapore. Each country has its own section below with the details.",
      ],
      table: {
        head: ["Destination", "Indian passport", "Filipino passport", "Where to apply from Singapore"],
        rows: [
          ["[Japan](/visa/japan)", "Visa", "Visa", "Japan Visa Application Centre run by VFS Global, for the Embassy of Japan"],
          ["[Thailand](/visa/thailand)", "Visa free, 30 days", "Visa free, 30 days", "No visa. For longer, the Thai e-visa, lodged through the Royal Thai Embassy in Singapore"],
          ["[Schengen](/visa/schengen)", "Visa", "Visa", "The embassy or visa centre of the country where you spend the most days"],
          ["[United Kingdom](/visa/united-kingdom)", "Visa", "Visa", "Online with UK Visas and Immigration, then biometrics at a visa application centre"],
          ["[South Korea](/visa/south-korea)", "Visa, check the K-ETA list", "Visa, check the K-ETA list", "Korea Visa Application Center, in person"],
          ["[Vietnam](/visa/vietnam)", "E-visa", "Visa exempt for a short stay, check the days", "Vietnam e-visa portal, online"],
          ["[Indonesia](/visa/indonesia)", "Visa on arrival or e-VOA", "Visa free for tourism, check the days", "Online e-visa portal, or on arrival"],
          ["[Australia](/visa/australia)", "Visitor visa", "Visitor visa", "Online with the Department of Home Affairs"],
          ["[Turkiye](/visa/turkiye)", "E-visa with conditions", "E-visa with conditions", "Online e-visa portal, or a Turkish mission"],
          ["[China](/visa/china)", "Visa", "Visa", "Chinese Visa Application Service Centre, Robinson Road"],
        ],
      },
    },
    {
      id: "residence",
      heading: "Why residence still matters",
      body: [
        "Your Indian or Filipino passport sets the rule. A Singapore Employment Pass, S Pass, Dependant's Pass, Student's Pass, work permit or PR status does not change it. What the pass does is show the embassy that you live in Singapore, which is what lets you apply here instead of back home.",
        "Several offices ask for this. The Royal Thai Embassy in Singapore says you must stay in Singapore until your e-visa is approved. The Embassy of Korea says short-term visitors to Singapore cannot apply at its office.",
        "Most checklists ask for the same core items.",
      ],
      list: [
        "Your passport, valid for the whole trip and, for some countries, six months or more beyond it.",
        "A copy of your pass, both sides. Permanent residents add the Blue IC and, for Thailand, the Re-entry Permit.",
        "A recent employment letter. Korea asks for one issued in the past month with a wet-ink signature and company stamp.",
        "Bank statements in your own name, usually two to six months. Korea wants three months from your salary account and does not accept card or overseas statements.",
        "Flight and hotel bookings, or a host's invitation. Korea asks you not to book before approval.",
        "A recent photo to the country's size. Our [photo requirements guide](/guides/visa-photo-requirements) covers the common sizes.",
      ],
    },
    {
      id: "japan",
      heading: "Japan visa for Indians and Filipinos",
      body: [
        "Both passports need a visa for Japan, and in Singapore you submit at the Japan Visa Application Centre run by VFS Global. Applications are accepted from people who live here, so bring your pass. The [Japan visa page](/visa/japan) has the full checklist.",
        "VFS Global's page lists the government fee by nationality. Filipino applicants pay S$0 for single and multiple entry, and Indian applicants pay S$7 for both. VFS adds a S$22 service fee that is not refunded. Fees can change, and the rate on the day you submit applies.",
        "Apply within three months of your travel date. VFS says processing takes at least 10 business days from submission and that it does not accept expedite requests, so allow two weeks or more.",
        "For one or two entries, Filipino and Indian applicants both use the All Nationalities sightseeing checklist. For multiple entry, Filipino applicants use the combined Indonesia, Philippines and Vietnam checklist, and Indian applicants use a separate India checklist. Japan also runs an online JAPAN eVISA. It is open only to certain countries and regions, so check the Ministry of Foreign Affairs page to see whether Singapore residents can use it before you plan around it.",
        "Once you have the visa, set up [Visit Japan Web](/arrival-cards/japan-visit-japan-web) before you fly to speed up immigration and customs.",
      ],
    },
    {
      id: "thailand",
      heading: "Thailand visa for Indians",
      body: [
        "Do Indians need a visa for Thailand? Not for a short holiday from 15 September 2026. Thailand's government notice says the 60 day exemption scheme ended on that date and a 30 day scheme applies. The Royal Thai Embassy in New Delhi says the Cabinet approved a 30 day tourism exemption for Indian passport holders on 14 July 2026. An earlier May 2026 table put India on visa on arrival, and the later Embassy notice replaces it.",
        "Philippine passports are on Thailand's 30 day visa exemption list. The Royal Thai Embassy in New Delhi also says that for a stay over 30 days, you apply for an e-visa at thaievisa.go.th.",
        "If you live in Singapore and want longer, the Royal Thai Embassy in Singapore handles the tourist e-visa. It lists S$50 for a single entry visa valid three months and S$250 for a multiple entry visa valid six months, with up to 60 days per entry. Apply at least 21 working days before you travel and stay in Singapore until it is approved.",
        "For a single entry visa the Embassy asks for three months of bank statements showing at least S$800, a round trip ticket, a hotel booking and a copy of your pass valid at least two months. A multiple entry visa asks for six months of statements with at least S$8,000 and an employment letter.",
        "Every visitor also completes the free [Thailand Digital Arrival Card](/arrival-cards/thailand-tdac) before arrival. More on the [Thailand visa page](/visa/thailand).",
      ],
    },
    {
      id: "europe-uk",
      heading: "Schengen and UK visas",
      body: [
        "Both passports need a Schengen visa. You apply to the country where you spend the most days, at the consulate covering where you are legally resident, which for you is Singapore. The fee is EUR 90 for adults and EUR 45 for children aged 6 to 12, and visa centres may charge a service fee on top. Apply no earlier than six months ahead and at least 15 days before you go. Processing is normally 15 days, up to 45. See the [Schengen visa page](/visa/schengen) and our [Schengen checklist](/guides/schengen-visa-checklist-singapore).",
        "Since 10 April 2026 the EU Entry/Exit System has been fully operational. It records passport details, a photo and fingerprints at the border, visa holders included. ETIAS is for visa free travellers, so a visa holder does not need it, and the EU says it is scheduled for the last quarter of 2026.",
        "For the UK, India and the Philippines are both on the UK's visa national list, so neither passport can use the cheaper electronic travel authorisation. You apply online for the Standard Visitor visa. It costs GBP 135 for six months, and the decision usually comes within three weeks. You can apply from three months before you travel, and you give fingerprints and a photo at a visa application centre that you choose when you book. gov.uk says the centre could be in another country, so pick Singapore if you live here. More on the [UK visa page](/visa/united-kingdom).",
      ],
    },
    {
      id: "korea-china-vietnam",
      heading: "Korea, China and Vietnam",
      body: [
        "South Korea. Korea's temporary K-ETA exemption helps some visa free passports. For Indian and Filipino passports, check the K-ETA country list first, then apply for the short-term visa if you are not on it. In Singapore you submit in person at the Korea Visa Application Center, and friends or travel agents cannot submit for you. The Embassy says processing takes 8 working days, with no express service, and that your passport stays at the Embassy meanwhile. A single entry visa is valid three months. Read the [South Korea visa page](/visa/south-korea), and file the free [e-Arrival Card](/arrival-cards/korea-e-arrival-card) before you fly.",
        "China. Both passports need a visa. Singapore's visa free arrangement covers Singapore passports only. The Chinese Visa Application Service Centre at 80 Robinson Road handles applications. You complete the online application first and submit your passport after it is approved online. Submission and payment run 9:00 to 15:00 on weekdays, and collection runs 9:00 to 16:00. Check China's visa free and transit lists for your passport. See the [China visa page](/visa/china).",
        "Vietnam. Indian passports need the e-visa, which you apply for online on the official Vietnam e-visa portal. Philippine passports are visa exempt for a short stay, and published lists differ on the number of days, so check the immigration department's list before you fly. More on the [Vietnam visa page](/visa/vietnam).",
      ],
    },
    {
      id: "indonesia-australia-turkiye",
      heading: "Indonesia, Australia and Turkiye",
      body: [
        "Indonesia. For Indonesia visa on arrival for Indians, Indian passports are eligible for the visa on arrival and the e-VOA, and applying for the e-VOA online before you fly avoids the airport queue. The fee is set by Indonesian immigration and a rise was reported in August 2026, so check the portal for the current amount. Filipino passports are visa free for tourism as ASEAN nationals, and the number of days is on the immigration list. Complete the free [All Indonesia card](/arrival-cards/indonesia-all-indonesia) too. See the [Indonesia visa page](/visa/indonesia).",
        "Australia. Neither passport can use the Australian ETA, which is for other passports. For an Australia visa as an Indian in Singapore, or as a Filipino, you apply online for the Visitor visa (subclass 600) with the Department of Home Affairs. The fee is on its pricing page. See the [Australia visa page](/visa/australia).",
        "Turkiye. The Turkish Ministry of Foreign Affairs says the e-Visa is only for tourism or commerce. Indian passport holders may get a single entry e-visa valid one month if they meet its conditions. Philippine passport holders normally need a visa, and they can get a 30 day single entry e-visa when they hold a valid Schengen, US, UK or Irish visa or residence permit. A Singapore pass is not on that list. Without a qualifying visa you apply at a Turkish mission. See the [Turkiye visa page](/visa/turkiye) and the [e-visa guide](/guides/e-visa-vs-visa-on-arrival-vs-embassy-visa).",
      ],
    },
    {
      id: "visiting-singapore",
      heading: "Singapore tourist visa for Indians",
      body: [
        "This section is for relatives and friends outside Singapore who want to visit you. ICA lists India among the 33 countries and places that need a visa to enter Singapore. The Philippines is not on that list, so Filipino passport holders do not need a visa for a visit. ICA says the stay is set by the e-Pass issued at the checkpoint, not by the visa.",
        "ICA does not take visa applications at immigration counters. Applicants apply through an authorised visa agent appointed by the Singapore Overseas Missions or at the nearest mission. A visitor with a Local Contact who has a Singpass or Corppass account has another route. The High Commission in New Delhi says the local contact is a Singapore citizen or PR aged 21 or older.",
        "The High Commission's page, updated on 11 August 2026, lists Form 14A, a passport valid at least six months from the entry date and two colour photos. Processing is generally 3 to 5 working days. The processing fee is INR 2,100 and is not refunded, and agents may add INR 1,300. Indian nationals passing through Singapore may qualify for ICA's 96 hour Visa Free Transit Facility if they hold a valid visa or long-term pass from Australia, Canada, Germany, Japan, New Zealand, Switzerland, the UK or the US.",
        "Every visitor submits the free [SG Arrival Card](/arrival-cards/singapore-sg-arrival-card) within three days before arrival. ICA does not endorse companies that charge to submit it for you. Residents returning home submit the health declaration only.",
      ],
    },
    {
      id: "next-steps",
      heading: "Next steps",
      body: [
        "Pick the destination page for your trip: [Japan](/visa/japan), [Thailand](/visa/thailand), [Schengen](/visa/schengen), [United Kingdom](/visa/united-kingdom), [South Korea](/visa/south-korea), [Vietnam](/visa/vietnam), [Indonesia](/visa/indonesia), [Australia](/visa/australia), [Turkiye](/visa/turkiye) or [China](/visa/china).",
        "VIZA is an independent service and its help is free. Government and visa centre fees go straight to the authority or centre and are separate. If a visa is refused, read our guide to [reapplying after a refusal](/guides/visa-refused-reapply).",
      ],
    },
  ],
  faq: [
    { q: "Do Indians need a visa for Thailand?", a: "Not for a short holiday from 15 September 2026. The Royal Thai Embassy in New Delhi reports a 30 day tourism exemption for Indian passport holders. For longer, apply for an e-visa at thaievisa.go.th,." },
    { q: "Thailand visa for Indians living in Singapore: where do I apply?", a: "Apply for the e-visa online through the Thai e-visa system. The Royal Thai Embassy in Singapore handles it and asks you to apply at least 21 working days ahead and to stay in Singapore until it is approved." },
    { q: "How to apply for a Japan visa in Singapore as a Filipino?", a: "Prepare the sightseeing checklist, book at the Japan Visa Application Centre run by VFS Global and submit with your pass. VFS lists S$0 as the visa fee for Filipinos, plus a S$22 service fee." },
    { q: "Japan visa for Indians in Singapore: how much and how long?", a: "VFS Global lists S$7 for the visa fee for Indian passports, plus a S$22 service fee. VFS says processing takes at least 10 business days." },
    { q: "Can I apply for a visa in Singapore with an Indian or Filipino passport?", a: "Yes, if you live here on a valid pass. Japan, Korea and Thailand ask you to apply in Singapore as a resident. For Schengen, the EU says you usually apply where you are legally resident." },
    { q: "UK visa for an Indian passport in Singapore: what is the process?", a: "Apply online for the Standard Visitor visa, which costs GBP 135 for six months. Then give fingerprints and a photo at a visa application centre. gov.uk says the decision is usually within three weeks." },
    { q: "Australia visa for an Indian in Singapore: can I use the ETA?", a: "No. Indian and Filipino passports apply for the Visitor visa (subclass 600) online with Home Affairs. Check its pricing page for the current charge." },
    { q: "Indonesia visa on arrival for Indians: is it still available?", a: "Indian passports are eligible for the visa on arrival and the e-VOA. The fee is set by Indonesian immigration and may rise, so check the portal." },
    { q: "Do Indians need a Turkey e-visa or a tourist visa?", a: "The Turkish Ministry of Foreign Affairs says Indian passport holders may get a one month single entry e-visa if they meet its conditions. If you do not qualify, apply for a visa at a Turkish mission." },
    { q: "Singapore tourist visa for Indians: how do my relatives apply?", a: "Indian passport holders need a visa for Singapore. They apply through an authorised visa agent appointed by the Singapore Overseas Missions or at the nearest mission, and a Local Contact with Singpass is another route. They also complete the free SG Arrival Card." },
    { q: "Do Filipinos need a visa to visit Singapore?", a: "No. The Philippines is not on ICA's list of countries that need a visa. Submit the free SG Arrival Card within three days before arrival, and the e-Pass issued at the checkpoint sets your stay." },
  ],
  sources: [
    { label: "ICA, visa requirements for entering Singapore", url: "https://www.ica.gov.sg/enter-transit-depart/entering-singapore/visa_requirements" },
    { label: "ICA, SG Arrival Card", url: "https://www.ica.gov.sg/enter-transit-depart/entering-singapore/sg-arrival-card" },
    { label: "High Commission of Singapore in New Delhi, visa information", url: "https://new-delhi.mfa.gov.sg/consular-services/visa-information/" },
    { label: "VFS Global, Japan Visa Application Centre Singapore", url: "https://www.vfsglobal.com/one-pager/japan/singapore/english/index.html" },
    { label: "Royal Thai Embassy Singapore, tourist visa", url: "https://singapore.thaiembassy.org/en/page/tourist-visa" },
    { label: "Royal Thai Embassy New Delhi, update on the visa exemption scheme for Indian passport holders", url: "https://newdelhi.thaiembassy.org/en/content/latest-update-on-revision-to-thailand-s-visa-exemp" },
    { label: "Thai government PRD, visa exemption measures from 15 September 2026", url: "https://thailand.prd.go.th/en/content/category/detail/id/48/iid/538547" },
    { label: "Thai Ministry of Foreign Affairs, visa exemption country table", url: "https://image.mfa.go.th/mfa/0/wdW3FTtVMc/2026-05-22/%E0%B8%95%E0%B8%B2%E0%B8%A3%E0%B8%B2%E0%B8%87%E0%B8%97%E0%B8%9A%E0%B8%97%E0%B8%A7%E0%B8%99%E0%B8%A1%E0%B8%B2%E0%B8%95%E0%B8%A3%E0%B8%81%E0%B8%B2%E0%B8%A3_ver._eng.pdf" },
    { label: "European Commission, applying for a Schengen visa", url: "https://home-affairs.ec.europa.eu/policies/schengen/visa-policy/applying-schengen-visa_en" },
    { label: "European Commission, EES and ETIAS explained", url: "https://home-affairs.ec.europa.eu/news/main-differences-between-ees-and-etias-what-travellers-need-know-2026-04-28_en" },
    { label: "GOV.UK, apply for a Standard Visitor visa", url: "https://www.gov.uk/standard-visitor/apply-standard-visitor-visa" },
    { label: "GOV.UK, visa national list", url: "https://www.gov.uk/guidance/immigration-rules/immigration-rules-appendix-visitor-visa-national-list" },
    { label: "Embassy of Korea in Singapore, KVAC and short-term visa notice", url: "https://overseas.mofa.go.kr/sg-en/brd/m_2444/view.do?seq=761433" },
    { label: "Turkish Ministry of Foreign Affairs, visa information for foreigners", url: "https://www.mfa.gov.tr/visa-information-for-foreigners.en.mfa" },
    { label: "Chinese Visa Application Service Centre Singapore", url: "https://www.visaforchina.cn/SGP4_EN/" },
  ],
  reviewed: "Checked on 25 November 2026 against ICA, the High Commission of Singapore in New Delhi, VFS Global, the Royal Thai Embassies in Singapore and New Delhi, the European Commission, GOV.UK, the Embassy of Korea in Singapore, the Turkish Ministry of Foreign Affairs and the Chinese Visa Application Service Centre. Some Japan, Vietnam, Indonesia and Australia pages did not load, so check those official pages for fees.",
};

export default guide;
