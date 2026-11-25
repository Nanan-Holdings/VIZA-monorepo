import type { GuideContent } from "../types";

/**
 * Visas for Chinese (PRC) passport holders living in Singapore. Guide slug: visas-chinese-passport-holders-singapore.
 * Target keywords (from docs/seo/keywords.csv, which has no Chinese-passport phrase): japan visa singapore,
 * uk visa singapore, us visa singapore, schengen visa singapore, australia visa singapore, canada visa singapore,
 * plus natural phrases "visa for Chinese passport holders in Singapore" and "EP holder visa".
 *
 * Checked 25 Nov 2026. Pages opened and read this session:
 *   - ICA PR Re-Entry Permit pages (REP needed, S$50 for 5 years, 180 day rule, online renewal 3 months ahead)
 *   - ICA SG Arrival Card page (PRs and Long-Term Pass holders included, 3 days, free)
 *   - MOM FAQ on pass holders travelling with the digital work pass or notification letter
 *   - Embassy of Korea in Singapore C-3-9 page (KVAC, documents, 3 / 6 / 5 year entry types, 8 working days)
 *   - Embassy of Korea in Singapore page on the Chinese group visa free scheme (29 Sep 2025 to 30 Jun 2026, not for Singapore)
 *   - Australian Embassy in China page (PRC passports cannot use ETA 601 or eVisitor 651)
 *   - gov.uk Standard Visitor apply page (GBP 135, 3 months ahead, decision usually within 3 weeks, biometrics centre)
 *   - European Commission "applying for a Schengen visa" page (EUR 90, 15 days, 6 months ahead, legal residence rule)
 *   - canada.ca eTA apply page (eTA for visa exempt passports, CAD 7)
 *   - english.www.gov.cn report on the China and Malaysia mutual visa exemption (30 days per visit, 90 in 180)
 * Taken from the repo's destination pages (lib/visa-content, checked 25 Nov 2026, several through search summaries):
 *   Japan fees and Embassy route, Korea visa fees (S$52 / 78 / 91 / 117), Thailand 30 day bilateral rule, Vietnam
 *   e-visa fees, Indonesia VOA, UK long visa fees, US B1/B2 and EVUS, Australia subclass 600, Canada visitor visa.
 *
 * Not confirmed on an official page (the copy hedges or omits these):
 *   - Japan: eVISA eligibility for Chinese passports and the exact eVISA payment method; MOFA and Embassy pages
 *     returned 403 to the fetcher, so fees come from the repo's earlier read.
 *   - Korea: whether China is on the K-ETA country list (the copy says check the list); the visa fee page was not
 *     opened this session (fees from the repo); whether the Chinese group scheme was extended after 30 Jun 2026
 *     (no source found, the copy does not claim it).
 *   - Malaysia: whether the MDAC applies to Chinese visitors (the repo says yes; no official page read this session);
 *     the end date of the exemption (reports say 5 years, not read on an official page).
 *   - Indonesia: China on the current VOA and e-VOA country list (secondary sources only).
 *   - Vietnam: US$25 and US$50 fees and 90 day validity (secondary sources and the repo page).
 *   - Thailand: the MFA country table was read in an earlier session, not re-opened.
 *   - US: State Department third country policy (12 Dec 2025) was read through search summaries (travel.state.gov
 *     returned 403); no Singapore-specific wait time, visa fee total or Visa Integrity Fee is quoted; EVUS fee not quoted.
 *   - UK: whether a Singapore resident may choose a Singapore application centre (gov.uk only says the centre
 *     could be in another country); long visa fees are from the repo.
 *   - Schengen: which country and provider suits each trip, VFS service fees, per pass checklists, any cascade or
 *     multiple entry rule for Chinese passports.
 *   - Australia: visa charge, processing time and the Frequent Traveller stream (Home Affairs returned 403).
 *   - Canada: processing time from Singapore and the VAC arrangement (not readable).
 *   - Singapore: that pass holders need no extra document to return beyond a valid pass (MOM page covers the digital pass
 *     and notification letter only); how a renewed Chinese passport affects a pass.
 */
const guide: GuideContent = {
  title: "Visas for Chinese Passport Holders in Singapore | VIZA",
  description: "Chinese passport holder living in Singapore on an EP, S Pass, Dependant Pass or PR? See which visas you need for Japan, Korea, Europe, the UK and US. Free.",
  h1: "Visa for Chinese passport holders in Singapore",
  lead: "A Chinese passport holder who lives in Singapore follows the rules for the Chinese passport, not for Singapore. Thailand, Malaysia, Indonesia and Vietnam are the easy trips. Japan, South Korea, Europe, the UK, the US, Australia and Canada need a visa, and your EP, S Pass, Dependant's Pass, PR or Student's Pass shows the embassy that you live here.",
  glance: [
    { k: "No visa needed", v: "Thailand (30 days) and Malaysia (30 days per visit)" },
    { k: "Easy online or on arrival", v: "Vietnam e-visa, Indonesia visa on arrival" },
    { k: "Visa needed", v: "Japan, South Korea, Schengen, UK, US, Australia, Canada" },
    { k: "Proof of Singapore status", v: "Your pass card, employment letter and 3 to 6 months of bank statements" },
    { k: "PR holders", v: "Keep a valid Re-Entry Permit, and bring a copy when you travel" },
  ],
  sections: [
    {
      id: "destination-overview",
      heading: "Visa needs by destination",
      body: [
        "Your residence does not decide the rule. Your passport does. The table shows where a Chinese passport needs a visa and where you apply from Singapore. Fees and rules change, so each row links to the full destination page.",
      ],
      table: {
        head: ["Destination", "Chinese passport", "Where to apply from Singapore"],
        rows: [
          ["[Thailand](/visa/thailand)", "No visa for 30 days", "Nothing to apply for. Fill in the free TDAC before you fly"],
          ["[Malaysia](/visa/malaysia)", "Visa exempt, 30 days per visit, 90 days in any 180", "Nothing to apply for. Check the MDAC"],
          ["[Indonesia](/visa/indonesia)", "Visa on arrival or e-VOA", "Online e-VOA or at the airport"],
          ["[Vietnam](/visa/vietnam)", "Visa required", "Vietnam e-visa, online"],
          ["[Japan](/visa/japan)", "Visa required", "Embassy of Japan in Singapore through its visa centre, or the eVISA if you are eligible"],
          ["[South Korea](/visa/south-korea)", "Visa required for a Chinese passport living in Singapore", "Korea Visa Application Center, by appointment"],
          ["[Schengen](/visa/schengen)", "Visa required", "The visa centre of the country you will spend most time in"],
          ["[United Kingdom](/visa/united-kingdom)", "Standard Visitor visa", "Online form, then biometrics at a visa application centre"],
          ["[United States](/visa/united-states)", "B1/B2 visa", "DS-160 form and an interview at the US Embassy in Singapore"],
          ["[Australia](/visa/australia)", "Visitor visa, subclass 600", "Online in ImmiAccount"],
          ["[Canada](/visa/canada)", "Visitor visa", "Online, with biometrics"],
        ],
      },
    },
    {
      id: "singapore-status",
      heading: "Proving you live in Singapore",
      body: [
        "Embassies in Singapore take visa applications from people who live here. The Embassy of Korea says short-term visitors in Singapore cannot apply at its office. The Embassy of Japan asks tourists to apply in their home country or country of residence. Your pass is the proof.",
        "Most files carry the same core documents. Pick the line below that matches your pass.",
      ],
      list: [
        "Employment Pass (EP holder visa file): pass card or a printout from the SGWorkPass app, an employment letter signed by your employer, and recent bank statements.",
        "S Pass: the same file as an EP. Korea asks for at least one month of validity left on the day you return to Singapore.",
        "Dependant's Pass: your pass, a copy of the main holder's pass and a letter of support. Bank statements can come from you or from the main holder.",
        "Permanent resident: your PR card, your Re-Entry Permit and your Chinese passport. You apply as a Chinese passport holder, not as a Singapore citizen.",
        "Student's Pass: your pass, a school letter and proof of funds, often a parent's bank statements with a support letter.",
      ],
    },
    {
      id: "pass-validity",
      heading: "Pass validity and trip dates",
      body: [
        "Check your pass dates before you book anything. Your pass must still be valid on the day you fly back to Singapore, and the visa file asks for the pass as proof. Korea asks for a recent printout if your pass is digital.",
        "Pass holders can travel with the digital work pass in the SGWorkPass app or with a valid notification letter, according to MOM. Use the card or the app that matches your pass, and carry your passport.",
        "PR holders need a valid Re-Entry Permit to leave and come back as a PR. ICA lists a 5-year Re-Entry Permit at S$50, and you can renew it online with Singpass from three months before it ends. If you leave without one, or it expires while you are away, you apply within 180 days and must obtain it, otherwise PR status is lost. Bring a copy of the Re-Entry Permit when you travel, because some foreign authorities ask for it.",
        "Passport dates matter as well. Korea asks for a passport valid for at least 6 months. Schengen asks for a passport that expires at least 3 months after you leave the Schengen area. If you renew your Chinese passport, transfer your Re-Entry Permit validity to the new passport on the ICA site.",
        "For the flight home, most travellers submit the free SG Arrival Card within 3 days before arrival, and ICA includes PRs and Long-Term Pass holders. Read the [Singapore SG Arrival Card guide](/arrival-cards/singapore-sg-arrival-card) before you return.",
      ],
    },
    {
      id: "easy-trips",
      heading: "Thailand, Malaysia, Indonesia, Vietnam",
      body: [
        "Thailand is visa free for a Chinese passport for up to 30 days under a bilateral agreement, and Thailand moved from 60 to 30 days for many nationalities on 15 September 2026. Fill in the free Thailand Digital Arrival Card before you fly. The [Thailand TDAC guide](/arrival-cards/thailand-tdac) walks through it, and the [Thailand visa page](/visa/thailand) covers longer stays.",
        "Malaysia and China have a mutual visa exemption in force since 17 July 2025. Ordinary passport holders stay up to 30 days per visit and no more than 90 days in any 180. Work and study need a visa. Visitors also complete the digital arrival card, so read the [Malaysia MDAC guide](/arrival-cards/malaysia-mdac) and the [Malaysia visa page](/visa/malaysia) before you go.",
        "Indonesia offers a 30 day visa on arrival, which you can apply for online as an e-VOA. The listed fee is IDR 500,000 and one extension is possible. Check that your passport is on the current list. The [Indonesia visa page](/visa/indonesia) has the detail, and the [All Indonesia guide](/arrival-cards/indonesia-all-indonesia) covers the arrival declaration.",
        "Vietnam does not exempt Chinese ordinary passports, so you apply for the e-visa online before you fly. The fee is US$25 for single entry and US$50 for multiple entry, and the visa can be valid for up to 90 days. See the [Vietnam visa page](/visa/vietnam). The article [e-visa, visa on arrival or embassy visa](/guides/e-visa-vs-visa-on-arrival-vs-embassy-visa) explains how the three routes differ.",
      ],
    },
    {
      id: "japan-korea",
      heading: "Japan and South Korea visa",
      body: [
        "For a Japan visa in Singapore, a Chinese passport holder applies at the Embassy of Japan through the visa centre, or online with the JAPAN eVISA if eligible. Fees rose on 1 July 2026. The single entry visa is JPY 15,000 (S$132 at the Embassy) and multiple entry is JPY 30,000 (S$263), with a S$22 handling fee at the centre. The Embassy says at least 5 working days when the file is clean, and advises applying about 2 months ahead. The [Japan visa page](/visa/japan) has the checklist.",
        "South Korea runs a group visa free scheme for Chinese tour groups from China, which ran from 29 September 2025 to 30 June 2026. The Embassy of Korea in Singapore states it does not apply to Chinese nationals travelling from Singapore. Check the K-ETA country list on the [South Korea visa page](/visa/south-korea) first, and apply for the C-3-9 tourist visa if your passport is not on it.",
        "The C-3-9 application goes in person to the Korea Visa Application Center on an appointment. A friend or travel agent cannot submit it for you, and family members may submit for each other with proof of relationship. Bring your pass copy, a signed employment letter issued within one month, 3 months of bank statements from your salary account and a passport valid for 6 months. The Embassy takes 8 working days with no express service. Do not book tickets before approval.",
        "Korea visitors also complete the free e-Arrival Card, explained in the [Korea e-Arrival Card guide](/arrival-cards/korea-e-arrival-card).",
      ],
    },
    {
      id: "europe-uk-us",
      heading: "Schengen, UK and US visa",
      body: [
        "For a Schengen visa in Singapore, apply at the consulate of the country where you spend the most time, or the first country you enter if stays are equal. The European Commission says you apply where you are legally resident. The fee is EUR 90 for an adult. Apply no earlier than 6 months before and at least 15 days before travel, with normal processing at 15 days and up to 45 days. EES has been fully operational since 10 April 2026. ETIAS is not in operation, and it is for visa exempt visitors, so it does not apply to you. Use the [Schengen visa checklist for Singapore](/guides/schengen-visa-checklist-singapore) and the [Schengen visa page](/visa/schengen).",
        "For a UK visa in Singapore, a Chinese passport cannot get an ETA, so you apply for the Standard Visitor visa online. gov.uk lists GBP 135 for 6 months, and you can apply up to 3 months before travel. You then give fingerprints and a photo at a visa application centre, which gov.uk says could be in another country, so choose a Singapore appointment when you book. A decision usually comes within 3 weeks. The [UK visa page](/visa/united-kingdom) has the details.",
        "For a US visa in Singapore, a Chinese passport holder needs a B1/B2 visa, which means a DS-160 form, the fee and an interview at the US Embassy. The State Department says applicants should interview in the country of their nationality or residence, so your Singapore pass supports a Singapore appointment. If the visa is issued with 10 years of validity, enrol in EVUS before each trip. The [US visa interview guide](/guides/us-visa-interview-singapore) and [US visa page](/visa/united-states) cover the steps.",
      ],
    },
    {
      id: "australia-canada",
      heading: "Australia and Canada visa",
      body: [
        "For an Australia visa in Singapore, the Australian Embassy in China says PRC passports cannot use the ETA or the eVisitor visa. You apply for the Visitor visa, subclass 600, online in ImmiAccount. Add your Singapore pass, employment letter and bank statements to show your ties here. The [Australia visa page](/visa/australia) lists the checklist and the current charge.",
        "For a Canada visa in Singapore, the eTA is for visa exempt passports, so a Chinese passport holder applies for a visitor visa online and gives biometrics. The government fee is on the [Canada visa page](/visa/canada). Anyone with a valid visitor visa can travel until it expires.",
        "Both countries look at your job, your savings and your plans to return to Singapore. A clear employment letter and 3 to 6 months of consistent bank statements help. Keep your photo to the stated size, as described in the [visa photo requirements](/guides/visa-photo-requirements).",
      ],
    },
    {
      id: "multiple-entry",
      heading: "Multiple entry options",
      body: [
        "If you travel often, a multiple entry visa saves repeat applications. The table lists what each destination offers as of 25 November 2026.",
      ],
      table: {
        head: ["Destination", "Multiple entry option", "Fee"],
        rows: [
          ["South Korea", "Multiple entry valid 5 years, if the Embassy approves", "S$117"],
          ["Japan", "Multiple entry for applicants who meet the Embassy criteria", "JPY 30,000 (S$263)"],
          ["United Kingdom", "Standard Visitor visa for 2, 5 or 10 years", "GBP 506, 903 or 1,128"],
          ["Vietnam", "Multiple entry e-visa", "US$50"],
          ["United States", "The officer sets validity, 10 years is possible for Chinese passports", "Check the official fee page"],
          ["Canada", "A visitor visa can be valid for up to 10 years", "Check the official fee page"],
        ],
      },
    },
    {
      id: "next-steps",
      heading: "Next steps",
      body: [
        "Start with the destination page for your trip: [Japan](/visa/japan), [South Korea](/visa/south-korea), [Schengen](/visa/schengen), [UK](/visa/united-kingdom), [US](/visa/united-states), [Australia](/visa/australia) or [Canada](/visa/canada). Check your pass and passport dates, then gather your pass card, employment letter and bank statements.",
        "VIZA's help is free. The visa fee goes to the embassy or visa centre, and the visa centre may add its own service fee. No one can promise an outcome, so read the [visa refused guide](/guides/visa-refused-reapply) in case you need a second try. The list of [visa free countries for Singapore passport holders](/guides/visa-free-countries-singapore-passport) is a different rule set, so use it only if you hold a Singapore passport.",
      ],
    },
  ],
  faq: [
    { q: "Do Chinese passport holders living in Singapore need a visa for Japan?", a: "Yes. A Chinese passport holder who lives in Singapore applies at the Embassy of Japan through the visa centre, or online with the eVISA if eligible. Your pass and bank statements show that you live here." },
    { q: "Where do I apply for a South Korea visa as a Chinese passport holder in Singapore?", a: "You apply in person at the Korea Visa Application Center on an appointment, for the C-3-9 tourist visa. The Embassy says the Chinese group visa free scheme does not apply to travel from Singapore." },
    { q: "Do I need a visa for Thailand with a Chinese passport?", a: "Not for a holiday of up to 30 days under the bilateral agreement. You still fill in the free Thailand Digital Arrival Card before you fly." },
    { q: "Can Chinese passport holders go to Malaysia without a visa from Singapore?", a: "Yes. Ordinary Chinese passports are visa exempt for up to 30 days per visit and 90 days in any 180. Work and study need a visa, and you should check the Malaysia arrival card guide before travel." },
    { q: "Is there a Schengen visa application in Singapore for EP holders?", a: "Yes. Apply at the visa centre of the country where you spend the most time. The European Commission says you apply where you are legally resident, and the fee is EUR 90 for an adult." },
    { q: "How does an EP holder visa application work for the UK?", a: "Fill in the online form, pay GBP 135 for the 6 month Standard Visitor visa and book biometrics at a visa application centre. Add your EP, employment letter and bank statements. gov.uk says a decision usually comes within 3 weeks." },
    { q: "Can a Chinese passport holder in Singapore use the Australia ETA?", a: "No. The Australian Embassy in China says PRC passports cannot use the ETA, so you apply for the Visitor visa, subclass 600." },
    { q: "Does a Singapore PR need a Re-Entry Permit to travel?", a: "Yes. ICA says a PR must hold a valid Re-Entry Permit to leave and return. If you leave without one, apply within 180 days and obtain it, otherwise PR status is lost." },
    { q: "Can I apply for a US visa in Singapore with a Chinese passport?", a: "Yes. The State Department says to interview in your country of nationality or residence, and you live in Singapore. Check the US Embassy page for appointment rules, and read the interview guide first." },
    { q: "What happens if my pass expires before my trip ends?", a: "Check your dates before you apply. Your pass must be valid when you return, and Korea asks for at least one month of validity left for S Pass, work permit and student pass holders." },
  ],
  sources: [
    { label: "ICA, Re-Entry Permit for Permanent Residents", url: "https://www.ica.gov.sg/reside/PR/re-entry-permit" },
    { label: "ICA, Entry Permit and Re-Entry Permit conditions", url: "https://www.ica.gov.sg/PR/see-more/entry-permit-and-re-entry-permit-conditions-for-singapore-permanent-residents" },
    { label: "ICA, SG Arrival Card", url: "https://www.ica.gov.sg/enter-transit-depart/entering-singapore/sg-arrival-card" },
    { label: "MOM, pass holders travelling with the digital pass", url: "https://www.mom.gov.sg/faq/work-permit-for-foreign-worker/can-pass-holders-travel-in-and-out-of-singapore-if-they-have-not-received-the-pass-card" },
    { label: "Embassy of Korea in Singapore, C-3-9 tourist visa", url: "https://overseas.mofa.go.kr/sg-en/brd/m_2444/view.do?seq=761433" },
    { label: "Embassy of Korea in Singapore, Chinese group visa free scheme", url: "https://overseas.mofa.go.kr/sg-en/brd/m_2435/view.do?seq=761557" },
    { label: "Australian Embassy in China, ETA and visitor visas", url: "https://china.embassy.gov.au/bjng/dima0301.html" },
    { label: "GOV.UK, apply for a Standard Visitor visa", url: "https://www.gov.uk/standard-visitor/apply-standard-visitor-visa" },
    { label: "European Commission, applying for a Schengen visa", url: "https://home-affairs.ec.europa.eu/policies/schengen/visa-policy/applying-schengen-visa_en" },
    { label: "Government of Canada, apply for an eTA", url: "https://www.canada.ca/en/immigration-refugees-citizenship/services/visit-canada/eta/apply.html" },
    { label: "Chinese government, China and Malaysia mutual visa exemption", url: "https://english.www.gov.cn/news/202507/17/content_WS6878b7c7c6d0868f4e8f43e0.html" },
  ],
  reviewed: "Checked on 25 November 2026 against ICA, MOM, the Embassy of Korea in Singapore, the Australian Embassy in China, GOV.UK, the European Commission, the Government of Canada and the Chinese government. Japan, US, Thailand, Vietnam and Indonesia figures come from our destination pages and were not all readable on official sites, so check each official page before you pay.",
};

export default guide;
