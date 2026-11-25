import type { GuideContent } from "../types";

/**
 * US nonimmigrant visa application and interview for people living in Singapore.
 *
 * Checked 25 Nov 2026. travel.state.gov, sg.usembassy.gov, ceac.state.gov, the Federal Register and
 * usvisascheduling.com returned HTTP 403, 502 or a redirect to the fetcher, and the Firecrawl credits were out,
 * so official facts were read through search summaries that quote the official pages, plus the 25 Nov 2026
 * check in lib/visa-content/united-states.ts. Pages opened: bu.edu ISSO visa integrity fee note (19 May 2026),
 * taxnews.ey.com expedited pilot note (24 Aug 2026), visagrader.com (mirror of the State Department wait data).
 * Re-open these before a publish:
 *   - https://travel.state.gov/content/travel/en/News/visas-news/interview-waiver-update-sept-18-2025.html
 *   - https://travel.state.gov/content/travel/en/News/visas-news/adjudicating-niv-applicants-in-their-country-of-residence.html
 *   - https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/fees/fees-visa-services.html
 *   - https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/visa-denials.html
 *   - https://sg.usembassy.gov/visas/ and https://sg.usembassy.gov/visa-navigator/
 * Not confirmed on an official page this session (hedged or left out):
 *   - The exact name and address of the Singapore appointment booking site for nonimmigrant visas. The copy says
 *     to use the link on the US Embassy Singapore visa page. A January 2026 Singapore supplement was said to point
 *     to usvisascheduling.com, but that is an immigrant visa document, so the site is not named.
 *   - Whether Singapore offers the B1/B2 renewal interview waiver (dropbox) in practice, and the Singapore
 *     rules for it. The copy gives the national rule and says to check the embassy page.
 *   - Visa Integrity Fee (USD 250 per issuance by law). A university note of 19 May 2026 says some posts have begun
 *     charging it at issuance after approval. Whether Singapore collects it, and the refund process, are not
 *     confirmed. The copy gives no total and says to check.
 *   - Fee for petition-based visas (H, L, O, P, Q) and E visas. A third-party source gave USD 205 for H, so no
 *     figure is stated for them. B1/B2, F, M and J at USD 185 come from the fee page via the repo copy.
 *   - SEVIS fee amount for F and J. The copy says it is separate and gives no amount.
 *   - Embassy security list for nonimmigrant interviews. The wording used (no electronic devices, large bags,
 *     food or liquids) comes from the Singapore supplement page, which sits on the immigrant visa side.
 *   - Whether Singapore takes part in the USD 750 expedited B1/B2 appointment pilot (1 Jul to 31 Dec 2026, B1/B2
 *     only, interview within 10 business days per EY). The post list was not readable.
 *   - Interview wait time and passport return time for Singapore. No numbers are given.
 *   - Social media rule scope after December 2025 (reports of a further widening in March 2026). The copy states
 *     F, M, J, H-1B and H-4 only, and says to check.
 *   - Photo pixel size. The copy points to the photo guide and the State Department rules.
 *   - 180 day wait before asking about administrative processing (a university claim). Not used.
 */
const guide: GuideContent = {
  title: "US Visa Application Singapore: Interview Guide | VIZA",
  description:
    "How to apply for a US visa in Singapore: DS-160, fees, booking the US Embassy appointment, interview rules, what to bring and common questions. Free guide.",
  h1: "US visa application and interview in Singapore",
  lead: "Nearly everyone applying for a US visa from Singapore attends an in-person interview at the US Embassy. The steps are the same for every passport: DS-160, fee, appointment, interview. This guide covers who must attend, how to book, what to bring and the questions officers ask, including for people living here on an Employment Pass or S Pass.",
  glance: [
    { k: "Interview", v: "Required for nearly all applicants since 1 October 2025, with a short list of waivers" },
    { k: "Where to apply", v: "In the country where you live or hold citizenship. Residents of Singapore book at the US Embassy Singapore" },
    { k: "Order", v: "DS-160, fee, appointment, interview, then passport return" },
    { k: "Visitor fee", v: "USD 185 for a B1/B2 visa. Check the page for any extra fee before you pay" },
    { k: "Wait times", v: "Change every month. Read the State Department wait times page" },
  ],
  sections: [
    {
      id: "who-attends",
      heading: "Who must attend an interview",
      body: [
        "Since 1 October 2025, the State Department asks nearly all nonimmigrant visa applicants to attend an interview in person with a consular officer. That includes children under 14 and adults over 79, who used to be exempt in many cases.",
        "A few groups can still use an interview waiver, sometimes called a dropbox. The main one is a renewal of a B-1, B-2 or B1/B2 visa. To qualify, the new application is made within 12 months of the old visa's expiry, the old visa was issued for full validity, and you are 18 or older. You also need to apply in the country where you live or hold citizenship, you must never have been refused a visa unless that refusal was overcome, and there must be no sign of an ineligibility. Diplomatic and official categories have their own waiver list.",
        "Officers can still ask any applicant to attend an interview, even if you fit the waiver. If you are renewing a US visa from Singapore, check the [US Embassy Singapore visa page](https://sg.usembassy.gov/visas/) to see how it handles waiver cases before you book.",
      ],
    },
    {
      id: "where-to-apply",
      heading: "Where to apply from Singapore",
      body: [
        "The State Department says nonimmigrant visa applicants should book their interview at the US Embassy or Consulate in their country of nationality or residence. If you apply on the basis of residence, be ready to show that you live there. Singapore residents on an Employment Pass, S Pass, Dependant's Pass, work permit, Student's Pass or PR card normally book at the US Embassy Singapore.",
        "Applying in another country can mean a much longer wait, and the visa fee is not refunded or moved to another post if you booked where you are not eligible. Rare exceptions exist for emergencies. Your passport decides whether you need a visa, and where you live decides where you apply.",
      ],
      table: {
        head: ["Passport", "Route for a short trip", "Next step"],
        rows: [
          ["Singapore", "ESTA, up to 90 days, no interview", "Apply on the CBP ESTA site. A B1/B2 visa is for longer stays or if ESTA is not available to you."],
          ["China, India, Malaysia, Indonesia, Philippines, Vietnam", "B1/B2 visa with interview", "Follow the steps below from Singapore. See the [China](/guides/visas-chinese-passport-holders-singapore) and [Philippines and India](/guides/visas-filipino-indian-residents-singapore) guides."],
          ["Other passports", "Check the Visa Waiver Program list", "If your passport is not on it, apply for a B1/B2 visa."],
        ],
      },
    },
    {
      id: "steps",
      heading: "Steps in order",
      body: [
        "Every visa-required applicant follows the same order. Start at least a few months before you plan to fly, because the appointment wait and any extra checks are outside your control. The [United States visa page](/visa/united-states) has the passport by passport details.",
      ],
      table: {
        head: ["Step", "What you do", "Keep"],
        rows: [
          ["1. DS-160", "Complete the online nonimmigrant visa application on the State Department site, ceac.state.gov. Upload a photo that meets the rules in the [photo guide](/guides/visa-photo-requirements).", "The confirmation page with the barcode"],
          ["2. Fee", "Pay the visa application fee as the Embassy instructs. The fee is paid per applicant.", "The receipt"],
          ["3. Book", "Book your interview from the link on the US Embassy Singapore visa page. You usually link your DS-160 and fee receipt.", "The appointment letter"],
          ["4. Interview", "Attend at the Embassy with your passport, documents and letter. Fingerprints are taken there.", "Your passport or the slip you are given"],
          ["5. Result", "If approved, the passport returns with the visa. If extra checks are needed, the officer gives you a letter.", "Any letter from the officer"],
        ],
      },
    },
    {
      id: "fees",
      heading: "Fees and extra charges",
      body: [
        "The US government sets every fee below and you pay it to the US government or the Embassy's payment channel. VIZA's help is free and VIZA does not take any part of these fees. For most visitor, student and exchange visas the standard application fee is USD 185. On the State Department fee page this is the figure for B, F, M and J applicants, checked on 25 November 2026. Petition-based visas such as H and L, and E visas, have separate amounts on the same page.",
        "Other charges can sit on top. Students and exchange visitors also pay a SEVIS fee to the school or programme system. The Visa Integrity Fee of USD 250 per visa issued was created by law in July 2025. A university note dated 19 May 2026 says some consular posts have started to collect it, and that it is paid at issuance after approval, not when you book. Whether and when the Singapore Embassy collects it is not confirmed, so read the Embassy page and the fee page before you pay.",
        "A temporary rule also created an optional USD 750 fee for an earlier B1/B2 interview at selected posts, running from 1 July to 31 December 2026. It is paid on top of the visa fee and only buys an earlier slot. The State Department list of participating posts shows whether Singapore takes part.",
      ],
      list: [
        "The standard fee is not refunded if the visa is refused.",
        "ESTA for Singapore passports is a separate online payment on the official CBP site.",
      ],
    },
    {
      id: "bring-and-day",
      heading: "What to bring and how the day runs",
      body: [
        "Bring only what the interview needs. Officers usually ask few document questions, and you hand over papers when asked. A neat set in order helps you answer quickly.",
        "The Embassy's Singapore guidance says visitors cannot enter with battery-operated or electronic devices, large bags or luggage, or food and liquids, and that anyone who declines security screening cannot enter. That text sits on the Embassy's immigrant visa page, so read your own appointment letter for the list that applies to you. Leave phones, laptops, watches that connect to your phone, large bags and drinks at home. Travel light and arrive early, because screening takes time.",
        "On the day you go through security, then a short queue, then document check and fingerprints. The interview itself is usually short and held at a window. The officer asks questions, may take documents and tells you the result at the end. Answer the question you are asked, keep your replies short, and tell the truth. A false statement on the DS-160 or at the interview can lead to a long bar.",
        "F, M, J, H-1B and H-4 applicants also need public social media profiles and must list their accounts on the DS-160. This applies from December 2025 for H-1B and H-4, so check the State Department announcement for the current scope.",
      ],
      list: [
        "Passport valid for your whole stay, plus any old passports with US visas.",
        "DS-160 confirmation page with the barcode.",
        "Appointment confirmation or letter, and the fee receipt if the Embassy asks for it.",
        "One recent photo only if the Embassy asks for a paper copy. Your DS-160 already holds the digital photo.",
        "Supporting papers for your type of visa. Employment letter and payslips for work and visit cases. Form I-20 for F-1, Form DS-2019 for J, and the approved petition notice for H-1B and its H-4 dependants.",
        "Your Singapore pass card (EP, S Pass, Dependant's Pass, Student's Pass or PR card), so the officer sees where you live.",
      ],
    },
    {
      id: "questions",
      heading: "Common interview questions",
      body: [
        "Officers decide quickly, so a clear one or two sentence answer works best. The examples below are only models. Use your own facts, and make sure they match your DS-160.",
      ],
      table: {
        head: ["Visa", "Typical question", "Example answer"],
        rows: [
          ["B1/B2", "What is the purpose of your trip?", "A two week holiday in California with my wife. We have booked hotels and I have taken leave."],
          ["B1/B2", "Who pays for the trip?", "I do, from my salary. My bank statements show my savings."],
          ["B1/B2", "What do you do in Singapore?", "I am a marketing manager on an Employment Pass. I have worked at this company for four years."],
          ["F-1", "Why this university and course?", "It has the data science programme I need, and I received a scholarship. I plan to return to work in my field."],
          ["F-1", "Who pays for your studies?", "My parents, with the bank statements and sponsorship letter I have brought."],
          ["H-1B", "What will you do at the US company?", "I will work as a software engineer on the payments team. My employer filed the petition and my degree matches the role."],
          ["Any", "Have you been refused a US visa before?", "Answer yes or no truthfully and give a brief reason if asked."],
        ],
      },
    },
    {
      id: "strong-ties",
      heading: "Ties for EP and S Pass holders",
      body: [
        "Officers need to believe you will return to Singapore after a visit. This is the question behind most B1/B2 refusals under section 214(b). EP and S Pass holders are often asked about this because the pass is tied to a job and a time limit.",
        "Strong ties are plain things: a steady job with approved leave, a lease or home, family who live with you, savings that fit the trip, and a record of travelling and returning. Length of time in Singapore and in the current role helps. Dependant's Pass holders show the link to the main holder, and the main holder's job and income. PR holders show their work, tax records and re-entry permit.",
        "You do not need to bring a pile of papers. Bring an employment letter with role, salary and approved leave dates, recent payslips, recent personal bank statements, your pass card and your return plan. Large deposits made just before you apply can raise questions, so be ready to explain where the money came from.",
      ],
    },
    {
      id: "delays",
      heading: "221(g), refusals and wait times",
      body: [
        "If the officer cannot decide at the window, you may receive a letter under section 221(g). It lists the documents to send, or tells you your case needs further administrative processing. The State Department says processing time varies by case and that an officer can reconsider the application once the documents or checks are complete. A 221(g) is not a final refusal. The status on the CEAC site may say refused while the case is still open, so read your letter.",
        "A section 214(b) refusal applies to that one application. The State Department says you can apply again with evidence that your circumstances have changed, and you pay the fee again. Read [what to do after a refusal](/guides/visa-refused-reapply) before you re-apply. No one can promise approval, and VIZA does not.",
        "Appointment wait times change every month and by visa type. The State Department publishes the figure for Singapore on its global visa wait times page, so use that page instead of a number from an article.",
      ],
    },
    {
      id: "next-steps",
      heading: "Next steps",
      body: [
        "Check your passport against the [United States visa page](/visa/united-states), pick your visa type, then complete the DS-160 and book from the US Embassy Singapore visa page. Compare the route with other options in [ETA vs visa](/guides/eta-vs-visa) and [e-visa, visa on arrival or embassy visa](/guides/e-visa-vs-visa-on-arrival-vs-embassy-visa).",
        "VIZA's help is free. Government and visa-centre fees are paid directly to the authority and are separate. VIZA is not the US government or the US Embassy.",
      ],
    },
  ],
  faq: [
    {
      q: "How do I apply for a US visa in Singapore?",
      a: "Complete the DS-160 online, pay the visa fee, book the interview from the link on the US Embassy Singapore visa page, and attend with your passport and documents. The steps are the same for every passport that needs a visa.",
    },
    {
      q: "Do I need an interview for a US visa in Singapore?",
      a: "Nearly always. Since 1 October 2025 the State Department has limited interview waivers. The main one is a B-1, B-2 or B1/B2 renewal within 12 months of the old visa's expiry, if it was issued for full validity and you are 18 or older.",
    },
    {
      q: "How do I book a US visa appointment in Singapore?",
      a: "Use the booking link on the US Embassy Singapore visa page, after your DS-160 and the fee. Slots change often, so check the page for the current process and the State Department wait times page for timing.",
    },
    {
      q: "Can I apply for a US visa in Singapore if I am not a Singapore citizen?",
      a: "Yes, if you live in Singapore. The State Department says applicants should book in their country of nationality or residence, and applicants applying on residence should be ready to show that they live there. Your pass card and employment letter are the proof.",
    },
    {
      q: "How much is a US visa from Singapore?",
      a: "The standard fee for B1/B2, F, M and J visas is USD 185, checked on 25 November 2026. A USD 250 Visa Integrity Fee exists by law, and some posts have started to collect it at issuance. Check the Embassy and fee pages for what applies before you pay.",
    },
    {
      q: "What is the US visa processing time in Singapore?",
      a: "The Embassy sets the interview date and the State Department publishes the current Singapore wait on its wait times page. Some cases need extra checks after the interview, so allow extra time before you fly.",
    },
    {
      q: "What should I bring to the US Embassy in Singapore?",
      a: "Bring your passport, DS-160 confirmation page, appointment letter, your Singapore pass card and your supporting papers. Leave electronic devices, large bags and food or drinks at home, and read your letter for the full list.",
    },
    {
      q: "What questions do they ask at a US visa interview?",
      a: "Officers ask about the purpose of your trip, who pays, what you do for work or study, and your ties to Singapore. Students are asked about their school and course. H-1B applicants are asked about the employer and role.",
    },
    {
      q: "Do EP and S Pass holders need to prove strong ties?",
      a: "Yes, as for every applicant. Show a steady job with approved leave, savings that fit the trip, family or a home in Singapore and a history of returning. An employment letter, payslips and bank statements cover most of it.",
    },
    {
      q: "What does 221(g) mean on a US visa?",
      a: "It means the officer needs more documents or more checks before deciding. You receive a letter that says which. A 221(g) is not a final refusal, and the officer can reconsider once the checks are done.",
    },
    {
      q: "Can I renew my US visa in Singapore without an interview?",
      a: "Sometimes. A B1/B2 renewal within 12 months of expiry can qualify for an interview waiver if the old visa was issued for full validity, you are 18 or older and you have never been refused. The Embassy can still ask you to attend, so check its visa page.",
    },
    {
      q: "Do Singapore passport holders need a US visa interview?",
      a: "Not for a trip of 90 days or less. Singapore passports use ESTA for tourism and business. A visa and interview are for longer stays or if ESTA is not available to you.",
    },
  ],
  sources: [
    { label: "US Embassy Singapore, visas", url: "https://sg.usembassy.gov/visas/" },
    { label: "US Embassy Singapore, Visa Navigator", url: "https://sg.usembassy.gov/visa-navigator/" },
    { label: "US Department of State, interview waiver update, 18 Sep 2025", url: "https://travel.state.gov/content/travel/en/News/visas-news/interview-waiver-update-sept-18-2025.html" },
    { label: "US Department of State, applying in country of nationality or residence", url: "https://travel.state.gov/content/travel/en/News/visas-news/adjudicating-niv-applicants-in-their-country-of-residence.html" },
    { label: "US Department of State, fees for visa services", url: "https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/fees/fees-visa-services.html" },
    { label: "US Department of State, global visa wait times", url: "https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/global-visa-wait-times.html" },
    { label: "US Department of State, visa denials", url: "https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/visa-denials.html" },
    { label: "US Department of State, administrative processing", url: "https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/administrative-processing-information.html" },
    { label: "US Department of State, expanded screening and vetting", url: "https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/visas-news-archive/announcement-of-expanded-screening-and-vetting-for-visa-applicants.html" },
    { label: "DS-160 online nonimmigrant visa application", url: "https://ceac.state.gov/genniv/" },
    { label: "ESTA, US Customs and Border Protection", url: "https://esta.cbp.dhs.gov/" },
    { label: "Federal Register, expedited B1/B2 appointment fee, 9 Jun 2026", url: "https://www.govinfo.gov/content/pkg/FR-2026-06-09/html/2026-11513.htm" },
  ],
  reviewed:
    "Checked on 25 November 2026 against the US Department of State (interview waiver, residence rule, fees, denials, wait times), the US Embassy Singapore visa pages and the Federal Register. Some official pages did not load for our checker, so look at the links under Sources before you pay or book.",
};

export default guide;
