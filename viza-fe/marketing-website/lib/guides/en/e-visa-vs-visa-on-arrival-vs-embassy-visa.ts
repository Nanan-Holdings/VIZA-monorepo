import type { GuideContent } from "../types";

/**
 * Guide: visa on arrival vs e-Visa vs embassy visa, for people living in Singapore.
 *
 * Checked 25 Nov 2026. Pages opened and read on the day:
 *   - Singapore MFA travel pages: Indonesia, Thailand (updated for the 15 Sep 2026 change), India, Egypt, Saudi Arabia, Vietnam,
 *     United Arab Emirates (page dated 1 Mar 2026), Türkiye, United States, Japan (fetched with curl, text read)
 *   - Indonesia Directorate General of Immigration e-VoA page (imigrasi.go.id/wna/e-voa): B visa 30 days, one extension of 30 days,
 *     fee Rp500.000, e-VoA paid by card online, counter VoA paid at a designated bank counter, e-VoA extension online
 *   - Indonesia Directorate General of Immigration country list page and the e-visa portal passport list (India, China, Singapore listed)
 *   - Tourism Authority of Thailand, 1 Sep 2026 (Royal Gazette lists: 60 countries 30 days incl. Singapore, Malaysia, Indonesia,
 *     Philippines, India; 15 days Seychelles, Mauritius; visa on arrival Azerbaijan, Belarus, Serbia) and the Thai PRD notice 4 Sep 2026
 *   - Royal Thai Embassy Singapore tourist visa page (e-Visa, SGD 50 / SGD 250, 21 working days, stay in Singapore while processing)
 *   - Indian Visa Online e-Tourist page and fee table PDF (4 days ahead, 120 days, print the ETA, US$25 / US$10, fake site warning)
 *   - Egypt visa2egypt.gov.eg FAQ (USD 30 single, USD 65 multiple, 6 months validity, printout, port authorities can refuse)
 *   - Türkiye MFA visa page, UAE MOFA news of 25 Jun 2026, EU home-affairs Schengen visa page, gov.uk ETA page and ETA national list,
 *     VFS Global JAPAN eVISA release of 9 Sep 2026
 * Not confirmed on an official page (the copy hedges or omits these):
 *   - Indonesia fee rise (IDR 750,000 e-VOA, IDR 1,000,000 on arrival): reported from 12 Aug 2026, no official start date read
 *   - Indonesia passport validity of 6 months (guides only), e-VOA validity window of 90 days (guides only)
 *   - Whether India and China passports use visa on arrival or visa free in Indonesia (the lists name the passports, the tab was not readable)
 *   - Vietnam e-Visa fee, 90 day validity and about 3 working days (Vietnam government news Feb 2025 and guides; the portal did not load)
 *   - ETIAS start date (EC article of 28 Apr 2026 says last quarter of 2026, later reports say the target was dropped)
 *   - Airlines' check-in checks: general practice, no official page read for each airline
 *   - Saudi eVisa fee, UAE tourist visa fee, US visa fee and Japan visa fee (portals blocked or not read, so no amounts are given)
 *   - Thai e-Visa stay: the Embassy page still says 60 days per entry, written before the 15 Sep 2026 change
 *   - Thailand: the repo's Thailand destination page lists India as visa on arrival. The TAT Royal Gazette summary of 1 Sep 2026
 *     lists India among the 30 day exempt countries and the visa on arrival list as only Azerbaijan, Belarus, Serbia. This guide follows
 *     the newer TAT list. Update lib/visa-content/thailand.ts to match.
 *   - Chinese and Vietnamese passports for Thailand (bilateral arrangements, table not re-read), so the guide only points to the Ministry table
 */
const guide: GuideContent = {
  title: "Visa on Arrival vs e-Visa vs Embassy Visa | VIZA",
  description:
    "Visa on arrival, e-Visa or embassy visa? Compare time, cost and risk for Indonesia, Thailand, Vietnam, India, Egypt and the UAE if you live in Singapore.",
  h1: "Visa on arrival, e-Visa or embassy visa from Singapore",
  lead: "A visa on arrival is issued at the airport or border, an e-Visa is approved online before you fly, and an embassy visa goes through an embassy or visa centre. If you live in Singapore, your passport decides which one you need, not your pass. This guide compares the three and shows what each destination asks for, as checked on 25 November 2026.",
  glance: [
    { k: "Visa on arrival", v: "Issued at the immigration counter. Indonesia also sells it online first as an e-VOA, at IDR 500,000 on the official page" },
    { k: "e-Visa", v: "Apply online, get approval before you fly. Used by Vietnam, India, Egypt and Saudi Arabia, and by Türkiye on some conditions" },
    { k: "Embassy visa", v: "Appointment, documents and sometimes fingerprints. Used by Schengen countries, the UK, the US and Japan for many passports" },
    { k: "Your pass", v: "An EP, S Pass or PR does not change the entry rule. Your passport does" },
    { k: "Keep in mind", v: "Use official sites only, keep six months of passport validity, and note that no route guarantees entry" },
  ],
  sections: [
    {
      id: "three-routes",
      heading: "The three routes",
      body: [
        "A visa on arrival is issued when you reach the immigration counter. You queue, pay the government fee and the officer issues the visa. Indonesia's B visa on arrival is 30 days, and you can extend it once for 30 more.",
        "An e-Visa is applied for on a government website before you fly. You upload your passport page and a photo, pay by card and receive an approval by email or as a PDF. India, Vietnam and Egypt work this way. An e-VOA is a visa on arrival that you apply for and pay online first. Indonesia offers one, paid by card, while counter applicants pay at a designated bank counter.",
        "An embassy visa goes through an embassy, consulate or its visa centre. You book an appointment, bring documents and often give fingerprints. Schengen countries, the UK Standard Visitor visa and the US B1/B2 visa work this way. For Schengen, you apply at the consulate of the country you visit, and as a rule at the one responsible for where you legally live.",
        "A fourth case is visa free entry, where you need nothing in advance. Singapore passports get it for Thailand (30 days), Indonesia (30 days), Vietnam (30 days), Türkiye (90 days in any 180) and the UAE (90 days in any 180), according to the Singapore Ministry of Foreign Affairs. Some still ask for a free arrival card. A travel authorisation such as the UK ETA is separate, and our [ETA vs visa guide](/guides/eta-vs-visa) explains it.",
      ],
    },
    {
      id: "compare",
      heading: "How the three compare",
      body: [
        "Fees and times are the ones we read on official pages on 25 November 2026. Check the portal on the day you pay.",
      ],
      table: {
        head: ["", "Visa on arrival", "e-Visa", "Embassy visa"],
        rows: [
          ["Where you apply", "At the immigration counter, or online first as an e-VOA", "On the government portal", "At the embassy, consulate or its visa centre"],
          ["Time", "Same day at the counter. An e-VOA is arranged before you fly", "India asks for at least 4 days, the Thai embassy for 21 working days", "Schengen 15 days, up to 45. UK usually 3 weeks"],
          ["Cost certainty", "Set on the day. Indonesia: IDR 500,000, with a rise reported", "Shown on the portal. Lookalike sites add charges", "Government fee plus visa centre fee. Schengen EUR 90, UK 6 months GBP 135"],
          ["Risk at the border", "The officer decides at the counter", "Approval is not a promise of entry", "A visa is not a promise of entry either"],
          ["Airline check-in", "May ask for your ticket out and visa or exemption", "May ask to see the approval. India and Egypt want a printout", "Checks the visa in your passport"],
          ["Choose it when", "A short trip and your passport is on the list", "You can plan a week or more ahead", "No other route exists for your passport"],
        ],
      },
    },
    {
      id: "indonesia",
      heading: "Indonesia visa on arrival",
      body: [
        "Singapore passports do not need a visa for tourist visits of up to 30 days. The Singapore Ministry of Foreign Affairs calls this the A1 visa exemption and says the stay cannot be extended. If you may stay longer, pick the e-VOA, which can be extended once.",
        "Many people search for the Indonesia visa on arrival price. The Directorate General of Immigration's e-VoA page lists the B visa fee as IDR 500,000. Guides updated in November 2026 give the same amount for the e-VOA and the counter visa. A proposal reported in August 2026 would raise it to IDR 750,000 online and IDR 1,000,000 on arrival. We found no start date, so check the portal on the day you pay.",
        "Indian and Chinese passports both appear on the immigration portal's passport list. Pick your passport on the portal to see which route applies to you.",
        "Every visitor also completes the free All Indonesia arrival declaration within 3 days before arriving. It is not a visa. See our [All Indonesia guide](/arrival-cards/indonesia-all-indonesia) and the [Indonesia visa page](/visa/indonesia).",
      ],
      list: [
        "Stay: 30 days, extendable once, so 60 days in total",
        "Extension: e-VOA holders extend online, counter visa holders at an immigration office",
      ],
    },
    {
      id: "thailand",
      heading: "Thailand visa on arrival and e-Visa",
      body: [
        "Singapore passports enter Thailand without a visa for up to 30 days under the Tourist Visa Exemption Scheme. The Singapore Ministry of Foreign Affairs says this applies from 15 September 2026.",
        "The Thailand visa on arrival is now a very short list. The Royal Gazette notice, as summarised by the Tourism Authority of Thailand on 1 September 2026, names only Azerbaijan, Belarus and Serbia. Sixty countries and territories get 30 days visa free. They include Singapore, Malaysia, Indonesia, the Philippines and India. Separate arrangements still apply to some other passports, so check the Ministry of Foreign Affairs table.",
        "Searches for a Thailand ETA visa usually mean the online steps. We found no separate Thai ETA scheme on the official pages we read. Thailand's online steps are the e-Visa at thaievisa.go.th and the free Thailand Digital Arrival Card (TDAC) for every non-Thai traveller. See our [Thailand TDAC guide](/arrival-cards/thailand-tdac) and the [Thailand visa page](/visa/thailand).",
        "The Royal Thai Embassy in Singapore handles tourist e-Visa applications for people living in Singapore. Apply at least 21 working days before travel and stay in Singapore until approval. The embassy lists SGD 50 single entry and SGD 250 multiple, not refundable. Its page still says 60 days per entry and predates the 15 September change, so confirm the stay on your approval.",
      ],
    },
    {
      id: "other-evisas",
      heading: "Other e-Visa destinations",
      body: [
        "The first column is the Singapore passport. The last covers other passports and the details that matter.",
      ],
      table: {
        head: ["Destination", "Singapore passport", "Other passports and notes"],
        rows: [
          [
            "[Vietnam](/visa/vietnam)",
            "No visa, up to 30 days per entry, according to the Singapore Ministry of Foreign Affairs",
            "The e-Visa is open to all nationalities. The government has published US$25 single entry and US$50 multiple, valid up to 90 days. Allow about a week",
          ],
          [
            "[India](/visa/india)",
            "A visa is required. The e-Visa is the usual route",
            "Apply 4 days to 120 days before arrival for the 30 day e-Tourist visa. Most passports pay US$25 from July to March and US$10 from April to June, plus a 3% bank charge. Carry a printout of the approved ETA",
          ],
          [
            "[Türkiye](/visa/turkiye)",
            "No visa, 90 days in any 180",
            "Chinese passports are exempt for 90 days in any 180 from 2 January 2026. Indian and Philippine passports get a 30 day single entry e-Visa only with a valid Schengen, US, UK or Irish visa or residence permit. Vietnamese passports get a 30 day e-Visa",
          ],
          [
            "[Egypt](/visa/egypt)",
            "A visa is required. A 30 day single entry visa is issued on arrival at airports for USD 30",
            "The e-Visa portal lists USD 30 single entry and USD 65 multiple. China, India, Malaysia and Vietnam are on its list, and Indonesia and the Philippines are not. Bring a printout",
          ],
          [
            "[UAE](/visa/united-arab-emirates)",
            "No visa, 90 days in any 180",
            "Indonesian, Vietnamese, Thai and Philippine passports with a valid Singapore residence permit can get a visa on arrival, 14 days for AED 100 or 60 days for AED 250, as announced on 25 June 2026",
          ],
          [
            "[Saudi Arabia](/visa/saudi-arabia)",
            "A visa is required. Apply for the tourist e-Visa at visa.visitsaudi.com",
            "A visa on arrival may be granted, though Singapore's Ministry of Foreign Affairs recommends the e-Visa. The e-Visa includes mandatory health insurance, and the portal sets the price",
          ],
        ],
      },
    },
    {
      id: "embassy",
      heading: "Embassy visas and travel authorisations",
      body: [
        "Some destinations need an embassy or visa centre application for many passports.",
      ],
      list: [
        "[Schengen](/visa/schengen): Singapore passports are visa free for short stays. Other passports apply at the consulate of the country they visit, no earlier than 6 months and at least 15 days before travel. The fee is EUR 90 for adults. The Entry/Exit System has run fully since 10 April 2026, and ETIAS is not operating yet, so check travel-europe.europa.eu. See our [Schengen checklist](/guides/schengen-visa-checklist-singapore).",
        "[United Kingdom](/visa/united-kingdom): Singapore and Malaysian passports use the UK ETA, which costs GBP 20 and allows up to 6 months. China, India, Indonesia, the Philippines and Vietnam are not on the ETA list, so those passports apply for a Standard Visitor visa, GBP 135 for 6 months.",
        "[United States](/visa/united-states): Singapore passports travel with an approved ESTA under the Visa Waiver Program, or with a visa. Other passports apply for a visitor visa and attend an interview. Read our [US visa interview guide](/guides/us-visa-interview-singapore).",
        "[Japan](/visa/japan): Singapore passports can visit for under 90 days without a visa. Singapore residents on other passports can now apply for a single entry tourist eVISA fully online, according to a VFS Global release of 9 September 2026. Business and family visits use the visa centre.",
      ],
    },
    {
      id: "which-route",
      heading: "Which route to choose",
      body: [
        "Start with your passport, then trip length, then how many days you have.",
      ],
      table: {
        head: ["Your situation", "Route", "Why"],
        rows: [
          ["Singapore passport, Thailand, Indonesia or Vietnam, under 30 days", "No visa", "Visa free entry applies. Complete the TDAC or All Indonesia card"],
          ["Singapore passport, Indonesia for more than 30 days", "e-VOA", "Visa free entry cannot be extended, and the e-VOA can be extended once"],
          ["Indian passport, Thailand", "Visa free for 30 days", "India is on the 30 day list in the Royal Gazette summary. Apply for the e-Visa for a longer stay"],
          ["Indian or Chinese passport, Indonesia", "e-VOA or visa on arrival", "Both are on the portal list. Apply online first"],
          ["Indian or Philippine passport, Türkiye", "e-Visa with a supporting visa, otherwise an embassy visa", "The e-Visa needs a valid Schengen, US, UK or Irish visa or residence permit"],
          ["Leaving within a week", "Visa free entry or visa on arrival", "Embassy visas take weeks, and some e-Visas need days"],
          ["Schengen, UK or US on a passport that needs a visa", "Embassy visa", "There is no counter or online option. Book early"],
        ],
      },
    },
    {
      id: "mistakes",
      heading: "Common mistakes",
      body: ["Most trouble comes from a few avoidable slips."],
      list: [
        "Using a lookalike site. India says its site is the only official one and no agent is needed, and the UK notes other websites may charge more. Type the address yourself, such as evisa.imigrasi.go.id, thaievisa.go.th, visa2egypt.gov.eg or indianvisaonline.gov.in.",
        "Short passport validity. Egypt and Saudi Arabia ask for six months from arrival, India six months, and the Thai embassy more than six. Schengen asks for 3 months after you leave.",
        "No printout. India and Egypt ask for one. Keep a phone copy too.",
        "Applying too late. India needs 4 days, the Thai embassy 21 working days, Schengen at least 15 days.",
        "Mixing up arrival cards and visas. The TDAC and All Indonesia are declarations, not visas.",
        "Assuming approval means entry. The UK ETA page and the Singapore Ministry of Foreign Affairs say approval does not guarantee entry. Carry your booking and return ticket.",
        "Typing details that differ from the passport. Copy them from the photo page.",
      ],
    },
    {
      id: "next-steps",
      heading: "Next steps",
      body: [
        "Open the page for your destination and your passport: [Indonesia](/visa/indonesia), [Thailand](/visa/thailand), [Vietnam](/visa/vietnam), [India](/visa/india), [Türkiye](/visa/turkiye), [Egypt](/visa/egypt), [UAE](/visa/united-arab-emirates) or [Saudi Arabia](/visa/saudi-arabia). If you have not decided where to go, our [guide to visa free countries](/guides/visa-free-countries-singapore-passport) is a good start.",
        "VIZA is an independent service and not a government agency. VIZA's service is free, and the government and visa centre fees you pay are separate and go straight to the authority. If an application is refused, our [reapply guide](/guides/visa-refused-reapply) explains your options.",
      ],
    },
  ],
  faq: [
    {
      q: "What is the difference between a visa on arrival and an e-Visa?",
      a: "A visa on arrival is issued at the airport or border when you reach immigration. An e-Visa is applied for and approved online before you fly. Some countries, such as Indonesia, let you do the visa on arrival online first as an e-VOA.",
    },
    {
      q: "What is the Indonesia visa on arrival price?",
      a: "The Directorate General of Immigration lists IDR 500,000 for the B visa on arrival, and November 2026 guides give the same for the e-VOA. A higher fee was proposed in August 2026 with no start date we found, so check the portal first.",
    },
    {
      q: "Do Singaporeans need an Indonesia visa on arrival?",
      a: "No, not for tourist visits of up to 30 days. Singapore passports enter visa free, and that stay cannot be extended. Choose the e-VOA if you may stay longer, since it can be extended once for 30 days.",
    },
    {
      q: "Is there a Thailand visa on arrival for Singapore residents?",
      a: "Singapore passports do not need one. They enter visa free for up to 30 days from 15 September 2026. Visa on arrival now covers only Azerbaijan, Belarus and Serbia, per the Tourism Authority of Thailand.",
    },
    {
      q: "Is there a Thailand ETA visa?",
      a: "We found no separate Thai ETA scheme on the official pages we read. Thailand's online steps are the e-Visa at thaievisa.go.th for people who need a visa, and the free TDAC arrival card for all non-Thai nationals.",
    },
    {
      q: "How early should I apply for a Thailand e-Visa from Singapore?",
      a: "The Royal Thai Embassy in Singapore asks you to apply at least 21 working days before you travel. You need to stay in Singapore while it is processed.",
    },
    {
      q: "Can I be refused at the border with an e-Visa?",
      a: "Yes. Egypt's portal says port authorities can refuse entry to an e-Visa holder, and the UK ETA and US pages say approval is not a promise of entry. Carry your booking and return ticket.",
    },
    {
      q: "Do airlines check my visa at check-in?",
      a: "Airlines usually check that you hold the right permission before you board. We did not read each airline's rules, so check your airline's travel document page, and carry the approval on paper and on your phone.",
    },
    {
      q: "Do I need to print my e-Visa?",
      a: "India asks you to print and carry the approved ETA, and Egypt lists the e-Visa printout among its entry documents. A paper copy is a sensible backup for any e-Visa.",
    },
    {
      q: "Which is faster, an e-Visa or an embassy visa?",
      a: "An e-Visa is usually faster. Embassy visas take longer: 15 days for Schengen, up to 45, and about 3 weeks for the UK.",
    },
    {
      q: "How do I avoid fake e-Visa websites?",
      a: "Type the official address yourself. India says its site is the only official one and no agent is needed, and the UK warns that other websites may charge more.",
    },
    {
      q: "Does my EP, S Pass or PR change what visa I need?",
      a: "No. Entry rules follow your passport. Keep your pass valid for your return to Singapore. Some embassies ask for it as proof of residence.",
    },
  ],
  sources: [
    { label: "Singapore MFA, Indonesia travel page", url: "https://www.mfa.gov.sg/countries-regions/i/indonesia/travel-page" },
    { label: "Indonesia Directorate General of Immigration, e-VoA and visa on arrival", url: "https://www.imigrasi.go.id/wna/e-voa" },
    { label: "Singapore MFA, Thailand travel page", url: "https://www.mfa.gov.sg/countries-regions/t/thailand/travel-page" },
    { label: "Tourism Authority of Thailand, new visa exemption rules", url: "https://www.tatnews.org/2026/09/thailand-introduces-new-30-day-and-15-day-visa-exemption-rules-from-15-september/" },
    { label: "Royal Thai Embassy Singapore, tourist visa", url: "https://singapore.thaiembassy.org/en/page/tourist-visa" },
    { label: "Singapore MFA, Vietnam travel page", url: "https://www.mfa.gov.sg/countries-regions/v/viet-nam/travel-page" },
    { label: "Indian Visa Online, e-Tourist visa", url: "https://indianvisaonline.gov.in/evisa/tvoa.html" },
    { label: "Egypt e-Visa portal FAQ", url: "https://visa2egypt.gov.eg/eVisa/FAQ" },
    { label: "Türkiye Ministry of Foreign Affairs, visa information", url: "https://www.mfa.gov.tr/visa-information-for-foreigners.en.mfa" },
    { label: "UAE Ministry of Foreign Affairs, visa on arrival", url: "https://www.mofa.gov.ae/en/mediahub/news/2026/6/25/uae-grants-visa-on-arrival" },
    { label: "Singapore MFA, Saudi Arabia travel page", url: "https://www.mfa.gov.sg/countries-regions/s/saudi-arabia/travel-page" },
    { label: "European Commission, applying for a Schengen visa", url: "https://home-affairs.ec.europa.eu/policies/schengen/visa-policy/applying-schengen-visa_en" },
    { label: "GOV.UK, electronic travel authorisation", url: "https://www.gov.uk/guidance/electronic-travel-authorisation-eta" },
    { label: "Singapore MFA, United States travel page", url: "https://www.mfa.gov.sg/countries-regions/u/united-states/travel-page" },
    { label: "VFS Global, JAPAN eVISA in Singapore", url: "https://www.vfsglobal.com/en/PDF/media-releases/2026/MR_Japan_eVisa_service_launch_in_Singapore_09092026.pdf" },
  ],
  reviewed:
    "Checked on 25 November 2026 against the Singapore Ministry of Foreign Affairs travel pages (including Egypt, the UAE and Japan), the Indonesian immigration portal, the Tourism Authority of Thailand, the Royal Thai Embassy in Singapore, Indian Visa Online, the Egypt e-Visa portal, the Türkiye Ministry of Foreign Affairs, the UAE Ministry of Foreign Affairs, the European Commission, GOV.UK and VFS Global. Fees and rules change, so confirm them on the official page before you pay. The Indonesia fee rise, ETIAS date and airline check-in practice are not confirmed on official pages.",
};

export default guide;
