import type { DestinationContent } from "./types";

/**
 * Japan Temporary Visitor (tourist) visa for people living in Singapore (embassy visa, framed "from Singapore").
 * Singapore passports are visa exempt for 90 days. The paid visa route is for visa-required nationals who live
 * in Singapore, through the Embassy of Japan (via the Japan Visa Application Centre) or the JAPAN eVISA.
 *
 * Checked 25 Nov 2026. MOFA, the Embassy of Japan in Singapore and VFS blocked automated fetching on the day
 * (HTTP 403), so the fee, eVISA, processing and departure tax facts were read through search summaries that quote
 * the official pages. Re-open these before a publish:
 *   - https://www.sg.emb-japan.go.jp/itpr_en/visa_fees.html (S$132 / S$263 "Others", S$7 India, S$22 handling fee)
 *   - https://www.mofa.go.jp/j_info/visit/visa/visaonline.html (eVISA eligibility, Singapore residents)
 *   - https://www.sg.emb-japan.go.jp/itpr_en/visa_processingtime.html
 * Not confirmed on an official page this session (kept general or left out):
 *   - Singapore passport 90 days visa free (stable rule, MOFA exemption page not re-read)
 *   - which passports are visa exempt or not, beyond Singapore and the Embassy's own fee table
 *   - visa validity (3 months to enter) and stay lengths (15, 30 or 90 days)
 *   - photo size, schedule of stay form, per-pass checklists (EP, S Pass, DP, PR)
 *   - JESTA fee and start date (planned during FY2028, nothing final)
 *   - the operator and address of the Japan Visa Application Centre (JVAC)
 *   - eVISA payment method (Embassy page and MOFA FAQ disagree)
 */
export const japan: DestinationContent = {
  slug: "japan",

  heroTitle: "Japan visa from Singapore",
  lede: "A Japan visa from Singapore depends on your passport, not on where you live. Singapore passports enter Japan visa free for up to 90 days. If you live in Singapore on a Chinese, Indian, Indonesian, Philippine or Vietnamese passport, you need a Japan tourist visa, and you can apply through the Embassy of Japan in Singapore or online with the JAPAN eVISA. Fees went up on 1 July 2026, so the numbers below are the new ones.",
  heroImage: "/assets/heroes/japan.jpg",
  meta: [
    { k: "Singapore passport", v: "Visa free, 90 days" },
    { k: "Single entry fee", v: "JPY 15,000 from 1 Jul 2026" },
    { k: "Apply via", v: "Embassy or eVISA" },
    { k: "Checked", v: "25 Nov 2026" },
  ],
  tags: [
    { icon: "shield", label: "Free VIZA service" },
    { icon: "doc", label: "Document check" },
    { icon: "bolt", label: "Embassy and eVISA" },
  ],

  page: {
    framing: "singapore",

    glance: {
      needVisa: "Not for Singapore passports. Yes for Chinese, Indian, Indonesian, Philippine and Vietnamese passports",
      govFee: "JPY 15,000 single entry (S$132 at the Embassy), JPY 30,000 multiple (S$263)",
      processing: "At least 5 working days at the Embassy, 1 week or more through the centre. Allow 2 months",
      maxStay: "Up to 90 days, single entry",
      checked: "25 November 2026",
    },

    passports: {
      intro: "Where you live does not decide the rule. The passport does. Singapore PR and pass holders follow the rules for the passport they hold, and the Embassy only accepts visa applications from long-term residents of Singapore.",
      rows: [
        { passport: "Singapore", status: "Visa free, up to 90 days", note: "No fee and no form today. Japan plans an electronic travel authorisation called JESTA during fiscal year 2028, with no fee or date confirmed." },
        { passport: "China (PRC)", status: "Visa required", note: "Chinese passport holders living in Singapore apply at the Embassy of Japan through the visa centre, or online with the eVISA if eligible." },
        { passport: "Malaysia", status: "Visa free, up to 90 days", note: "Check the Ministry of Foreign Affairs exemption list before you book." },
        { passport: "India", status: "Visa required", note: "The Embassy lists a lower fee of S$7 for Indian nationals, and it did not rise on 1 July 2026." },
        { passport: "Indonesia", status: "Visa required", note: "Apply at the Embassy through the centre, or with the eVISA. The Embassy has a separate checklist for Singapore residents with Indonesian, Philippine and Vietnamese passports." },
        { passport: "Philippines", status: "Visa required", note: "The same Embassy checklist applies. Allow extra time for the bank statements." },
        { passport: "Vietnam", status: "Visa required", note: "The same Embassy checklist applies as for Indonesia and the Philippines." },
        { passport: "Other passports", status: "Check the exemption list", note: "The Ministry of Foreign Affairs keeps the list of visa exempt countries. If yours is not on it, you need a visa." },
      ],
    },

    visaTypes: {
      intro: "Japan issues visas by purpose. Most Singapore residents travelling for a holiday need the Temporary Visitor visa.",
      items: [
        { title: "Temporary Visitor, tourism", body: "For holidays, family visits and short trips. It is normally single entry and lasts up to 90 days. This is the visa most applicants ask for." },
        { title: "JAPAN eVISA", body: "The same tourist visa, applied for online. It is single entry for short tourism stays, open to people who live in Singapore and are not visa exempt, on an ordinary passport. You receive a Visa Issuance Notice by email, and the Embassy may ask you to come for an interview." },
        { title: "Multiple entry", body: "The multiple-entry visa costs JPY 30,000, double the single-entry fee. It is for applicants who meet the Embassy's criteria, and the Embassy publishes a separate multiple-entry checklist for some passports." },
        { title: "Business and other short stays", body: "Meetings and short business visits fall under the same Temporary Visitor class but need an invitation or company letter. Study, work and long stays need a different visa and a Certificate of Eligibility from Japan." },
      ],
    },

    residents: {
      intro: "The Embassy of Japan accepts visa applications from long-term residents of Singapore. Tourists visiting Singapore are asked to apply in their home country or country of residence. Your pass shows that you live here.",
      rows: [
        { pass: "Employment Pass", body: "Bring your EP card and a recent employment letter. Add your bank statements, and keep the pass valid for the whole trip. This is the most common route for Chinese and Indian passport holders working in Singapore." },
        { pass: "S Pass", body: "Bring your S Pass card and employment proof. The checklist is the same as for the EP, and the Embassy looks at the pass to confirm that you live in Singapore." },
        { pass: "Dependant's Pass", body: "Bring the Dependant's Pass and the main holder's pass copy. You show funds either from your own account or with a letter of support from the main holder, with their bank statements." },
        { pass: "Permanent Resident", body: "Bring your PR card or re-entry permit and proof of address. You apply with the passport of your own country, not as a Singapore citizen, and the visa free rule does not apply to you." },
        { pass: "Singapore citizen", body: "No visa. Carry a passport valid for the whole stay, and complete Visit Japan Web before you arrive to speed up immigration and customs." },
        { pass: "Student's Pass", body: "Bring your Student's Pass and a school letter. Proof of funds can come from a parent with a support letter." },
      ],
    },

    fees: {
      intro: "Japan raised its visa fees on 1 July 2026 for the first time in decades. The new fee applies to applications accepted on or after that date. VIZA's help is free. The government fee goes to the Embassy or through the eVISA.",
      rows: [
        { item: "Single entry visa", amount: "JPY 15,000 (S$132)", note: "S$132 is the Embassy's price for most passports. It was S$27 before 1 July 2026." },
        { item: "Double or multiple entry visa", amount: "JPY 30,000 (S$263)", note: "It was S$53 before 1 July 2026." },
        { item: "Indian nationals", amount: "S$7", note: "The Embassy lists S$7 for both single and multiple entry." },
        { item: "Centre handling fee", amount: "S$22", note: "Charged by the Embassy's centre when you submit through it." },
        { item: "JAPAN eVISA", amount: "JPY 15,000 equivalent", note: "Single entry, tourism only. Check the Embassy page for how payment works, because the Embassy and the Ministry describe it differently." },
        { item: "Departure tax", amount: "JPY 3,000", note: "Collected in your air ticket since 1 July 2026. Children under 2 and some transit passengers are exempt." },
      ],
      processing: "The Embassy says it takes at least 5 working days if the documents have no issues, and that applications through the centre take 1 week or longer. Referral cases can take up to 2 months, and the Embassy advises applying at least 2 months ahead because of eVISA volume. For the eVISA, the Visa Issuance Notice arrives by email 2 to 3 working days after payment. Embassy submissions pay in cash when they collect the visa.",
    },

    apply: {
      intro: "Choose the route first, then prepare the file. Both routes need the same documents and the same care with the bank statements.",
      guided: {
        title: "Guided",
        body: "VIZA's AI walks you through the form and the checklist for your pass type, and you submit to the Embassy centre or the eVISA site yourself. It suits people who like to keep control of each step.",
      },
      fullService: {
        title: "Full-service",
        body: "A VIZA consultant prepares your forms, checks the bank statements and itinerary, and prepares the file for submission, so you do not guess at what the Embassy wants.",
      },
      steps: [
        { title: "Start on VIZA", body: "Upload your passport, pass and trip dates. We confirm whether you need a visa and which route fits your passport." },
        { title: "Prepare the file", body: "We check the form, the itinerary and the bank statements against the Embassy checklist for Singapore residents." },
        { title: "Submit", body: "Submit to the Embassy through the centre or online through the eVISA. Pay the government fee yourself, and keep the receipt." },
        { title: "Collect or download", body: "eVISA applicants get a Visa Issuance Notice by email. Show it on your phone at check-in. Paper applicants collect the passport with the visa." },
      ],
    },

    checklist: {
      intro: "The Embassy publishes checklists by passport and purpose. The list below is the common core. Always compare it with the latest checklist before you submit.",
      groups: [
        {
          applicant: "Everyone",
          items: [
            "Passport valid for your whole stay",
            "Completed visa application form",
            "Recent photo, 4.5 cm by 3.5 cm, white background",
            "Flight booking and a day-by-day itinerary with hotels",
            "Bank statements for the latest 2 months with transaction history",
          ],
        },
        {
          applicant: "Employment Pass and S Pass",
          items: [
            "Pass card, copy of both sides",
            "Recent employment letter",
            "Personal bank statements in your own name",
          ],
        },
        {
          applicant: "Dependant's Pass",
          items: [
            "Dependant's Pass card and the main holder's pass copy",
            "Marriage or birth certificate showing your link to the main holder",
            "Bank statements, yours or the main holder's with a support letter",
          ],
        },
        {
          applicant: "Permanent Resident",
          items: [
            "PR card or re-entry permit, copy",
            "Proof of residence in Singapore, such as a recent bill",
            "Personal bank statements and employment letter",
          ],
        },
        {
          applicant: "Student",
          items: [
            "Student's Pass and a school letter",
            "Support letter from a parent with their bank statements",
          ],
        },
      ],
    },

    travel: {
      intro: "Having the visa is half of it. Japan runs most entry steps online, and a few costs changed in 2026.",
      items: [
        { title: "Visit Japan Web", body: "Visit Japan Web lets you complete immigration, customs and tax-free steps online and show a QR code on arrival. It is optional, but it shortens queues at the major airports.", href: "/arrival-cards/japan-visit-japan-web", linkLabel: "Read the Visit Japan Web guide" },
        { title: "Entry rules", body: "Immigration takes a facial photo and fingerprints from foreign visitors. Carry your return ticket and proof of funds. An eVISA holder shows the Visa Issuance Notice on a phone, because printouts are not accepted." },
        { title: "Departure tax", body: "The international tourist tax rose to JPY 3,000 per departure on 1 July 2026. It is collected in your ticket, so you do not pay it at the airport." },
        { title: "JESTA", body: "Japan plans a travel authorisation for visa-exempt visitors during fiscal year 2028, which would include Singapore passports. No date or fee is final, so you need nothing extra today." },
        { title: "Overstaying", body: "Leave within the days you were granted. Japan takes overstays seriously, and they can lead to a ban on re-entry." },
      ],
    },

    reviewed: {
      date: "25 November 2026",
      note: "Checked against the Ministry of Foreign Affairs of Japan and the Embassy of Japan in Singapore. Fees and rules change, so look at the links under Sources before you pay.",
    },

    related: {
      destinations: ["south-korea", "china", "vietnam", "thailand"],
      guides: [
        { label: "Visit Japan Web, the Digital Agency's immigration and customs site", href: "https://services.digital.go.jp/en/visit-japan-web/" },
        { label: "VIZA blog: visa and arrival card guides", href: "/blog" },
      ],
    },
  },

  rejectionTitle: "Common rejection reasons",
  rejectionSub: "Japan does not publish the reason for a refusal, and a refused applicant should wait before applying again for the same purpose. These are the points a consultant checks first.",
  rejectionReasons: [
    { title: "Funds that do not fit the trip", body: "Bank statements that look thin for the length of stay, or large unexplained deposits just before you apply, raise questions." },
    { title: "Itinerary and bookings do not agree", body: "Dates in the form, the itinerary and the flights must match. A missing or vague itinerary is a common reason for a return." },
    { title: "Weak ties to your home", body: "A short stay in Singapore, no employment letter or no clear plan to return makes the purpose of the trip harder to believe." },
    { title: "Wrong office", body: "The Embassy accepts applications from long-term residents of Singapore. A visitor on a short stay is asked to apply at home." },
    { title: "Earlier immigration problems", body: "An earlier overstay, deportation or refusal in Japan needs an explanation, and some cases are referred, which adds weeks." },
  ],

  faqSub: "Can't find your answer? Ask the AI assistant below or message a VIZA consultant.",
  faq: [
    { category: "Do I need a visa", q: "Do Singaporeans need a visa for Japan?", a: "No. Singapore passport holders enter Japan visa free for up to 90 days as temporary visitors, with no fee. Japan plans an electronic travel authorisation called JESTA during fiscal year 2028, but no date or fee is final." },
    { category: "Do I need a visa", q: "Do Chinese passport holders living in Singapore need a Japan visa?", a: "Yes. A Chinese passport holder who lives in Singapore applies at the Embassy of Japan through the visa centre, or online with the JAPAN eVISA if eligible. You show your Singapore pass and your bank statements." },
    { category: "Do I need a visa", q: "Do Indians in Singapore need a Japan visa?", a: "Yes. The Embassy lists a fee of S$7 for Indian nationals, and it did not change on 1 July 2026. You apply through the Embassy with the same checklist as other residents." },
    { category: "Do I need a visa", q: "Do Singapore PR holders need a Japan visa?", a: "It depends on your passport. A PR with a passport that is visa exempt for Japan, such as Malaysian, does not need one, and a PR with a Chinese, Indian, Indonesian, Philippine or Vietnamese passport does." },
    { category: "Applying in Singapore", q: "How do I apply for a Japan visa in Singapore?", a: "Prepare the form, photo, bookings, itinerary and bank statements. Submit them at the Embassy's visa centre, or apply online with the eVISA. Check the Embassy checklist for your passport first." },
    { category: "Applying in Singapore", q: "What is the JAPAN eVISA?", a: "It is the online version of the single-entry tourist visa. It is open to people who live in Singapore, are not visa exempt and hold an ordinary passport. You receive a Visa Issuance Notice by email and show it on your phone at check-in." },
    { category: "Applying in Singapore", q: "Can a tourist visiting Singapore apply here?", a: "Usually not. The Embassy says only long-term residents of Singapore are eligible, and visitors apply in their home country or country of residence." },
    { category: "Applying in Singapore", q: "Where do I submit my Japan visa application in Singapore?", a: "Through the Japan Visa Application Centre named on the Embassy's visa page, or online through the eVISA. Check the Embassy page for the current address and hours." },
    { category: "Fees and time", q: "How much is a Japan visa from Singapore?", a: "Since 1 July 2026 the fee is JPY 15,000 for single entry, S$132 at the Embassy for most passports, and JPY 30,000 for multiple entry, S$263. Indian nationals pay S$7. The centre adds a S$22 handling fee." },
    { category: "Fees and time", q: "How long does a Japan visa take?", a: "The Embassy says at least 5 working days when the file has no issues, and 1 week or longer through the centre. Referral cases can take up to 2 months, so apply at least 2 months before you fly." },
    { category: "Fees and time", q: "Is there a Japan departure tax?", a: "Yes. The international tourist tax is JPY 3,000 per departure since 1 July 2026, collected in your ticket." },
    { category: "Rejections", q: "What happens if my Japan visa is refused?", a: "Japan does not give reasons. Wait before you apply again for the same purpose, and have a consultant review the file for the likely weak points first." },
    { category: "Before you travel", q: "Do I need Visit Japan Web?", a: "It is optional but useful. You register your trip and show a QR code for immigration, customs and tax-free steps." },
    { category: "Before you travel", q: "How much does VIZA charge?", a: "Nothing. VIZA's help is free. You pay the government fee yourself, to the Embassy or through the eVISA." },
  ],

  sources: [
    { label: "Embassy of Japan in Singapore, visa to Japan", url: "https://www.sg.emb-japan.go.jp/itpr_en/visit.html", display: "sg.emb-japan.go.jp" },
    { label: "Embassy of Japan in Singapore, visa fees", url: "https://www.sg.emb-japan.go.jp/itpr_en/visa_fees.html", display: "sg.emb-japan.go.jp" },
    { label: "Embassy of Japan in Singapore, processing time", url: "https://www.sg.emb-japan.go.jp/itpr_en/visa_processingtime.html", display: "sg.emb-japan.go.jp" },
    { label: "Ministry of Foreign Affairs, JAPAN eVISA", url: "https://www.mofa.go.jp/j_info/visit/visa/visaonline.html", display: "mofa.go.jp" },
    { label: "Ministry of Foreign Affairs, visa fees", url: "https://www.mofa.go.jp/j_info/visit/visa/procedure/fee.html", display: "mofa.go.jp" },
    { label: "Ministry of Foreign Affairs, exemption of visa", url: "https://www.mofa.go.jp/j_info/visit/visa/short/novisa.html", display: "mofa.go.jp" },
    { label: "JAPAN eVISA portal", url: "https://www.evisa.mofa.go.jp/", display: "evisa.mofa.go.jp" },
    { label: "Japan Tourism Agency, international tourist tax", url: "https://www.mlit.go.jp/kankocho/content/001996466.pdf", display: "mlit.go.jp" },
    { label: "Digital Agency, Visit Japan Web", url: "https://services.digital.go.jp/en/visit-japan-web/", display: "services.digital.go.jp" },
  ],

  price: {
    etaLabel: "Processing time",
    etaValue: "At least 5 working days",
    title: "Temporary Visitor visa · up to 90 days",
    sub: "VIZA's help is free: form preparation and document review. The visa fee is paid to the Embassy or through the eVISA.",
    foot: "VIZA's service is free. Any Japan visa fee is paid directly to the issuing authority.",
  },

  aiPlaceholder: "Ask anything about a Japan visa from Singapore: eVISA, fees, documents…",
};

export default japan;
