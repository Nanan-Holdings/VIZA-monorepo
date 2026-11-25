import type { DestinationContent } from "./types";

/**
 * China visa for people living in Singapore (embassy visa, framed "from Singapore").
 * Consult-only: the portal has no china pricing row, so the CTA goes to /contact (see lib/countries.ts).
 *
 * Checked 25 Nov 2026 against sg.china-embassy.gov.cn, visaforchina.cn (Singapore centre), en.nia.gov.cn
 * and the Chinese embassy in Malaysia.
 *
 * Not confirmed on an official page, so the copy hedges or leaves it out:
 *   - the Singapore visa-free arrangement has no published end date
 *   - Malaysia's 30 days per stay and 90 days in 180 (read in a summary; the embassy notice should be reopened)
 *   - how long online review takes (the centre gives collection days after submission only)
 *   - a minimum pass validity per pass type (EP, S Pass, Dependant's Pass, PR)
 *   - whether the unilateral and fingerprint concessions that end on 31 Dec 2026 are extended
 */
export const china: DestinationContent = {
  slug: "china",

  heroTitle: "China visa from Singapore",
  lede: "If you want to apply for a China visa in Singapore, the first question is your passport. Singapore passports enter China visa free for up to 30 days. Most other passports, including those from India, Indonesia, the Philippines and Vietnam, need a visa from the Chinese Visa Application Service Center at 80 Robinson Road. This page shows who needs what, the fees, and the documents for people who live in Singapore on an Employment Pass, S Pass, Dependant's Pass or PR.",
  heroImage: "/assets/heroes/china.jpg",
  meta: [
    { k: "Singapore passport", v: "Visa free, 30 days" },
    { k: "Other passports", v: "Visa from the centre" },
    { k: "Centre", v: "80 Robinson Road" },
    { k: "Checked", v: "25 Nov 2026" },
  ],
  tags: [
    { icon: "shield", label: "Free VIZA service" },
    { icon: "doc", label: "Document check" },
    { icon: "globe", label: "English and Chinese" },
  ],

  page: {
    framing: "singapore",

    glance: {
      needVisa: "Not for Singapore passports. Yes for most other passports",
      govFee: "S$38 for a single entry on other passports, plus the centre fee from S$61",
      processing: "Collect from the 4th working day after submission, plus online review",
      maxStay: "30 days visa free for Singapore passports",
      checked: "25 November 2026",
    },

    passports: {
      intro: "Entry rules follow the passport in your hand, not where you live. A Singapore PR or Employment Pass does not change this. The rows below are for ordinary passports used for tourism and short business trips.",
      rows: [
        { passport: "Singapore", status: "Visa free, up to 30 days", note: "Mutual exemption in force since 9 February 2024. Work, journalism and stays over 30 days need a visa before you travel. No end date is announced." },
        { passport: "China (PRC)", status: "No visa needed", note: "Chinese citizens enter on their own travel documents. Renew an expiring passport through the Chinese Embassy in Singapore before you book flights." },
        { passport: "Malaysia", status: "Visa free, 30 days per stay", note: "Mutual exemption since 17 July 2025. Check the Chinese Embassy in Malaysia notice for the number of days allowed in any 180." },
        { passport: "India", status: "Visa required", note: "Not on the visa free lists. Apply at the Singapore visa centre if you live here. The 240-hour transit rule does not cover India." },
        { passport: "Indonesia", status: "Visa required", note: "Not on the visa free lists. Indonesia is on the 240-hour transit list if you fly on to a third country." },
        { passport: "Philippines", status: "Visa required", note: "Not on the visa free lists or the 240-hour transit list." },
        { passport: "Vietnam", status: "Visa required", note: "Not on the visa free lists. Vietnam is on the 240-hour transit list for onward travel." },
        { passport: "Other passports", status: "Check your country", note: "About 50 countries are on a 30-day visa free list valid to 31 December 2026, and Thailand has a mutual exemption. Singapore is not on that list because it has its own arrangement. Ask us if your passport is not shown here." },
      ],
    },

    visaTypes: {
      intro: "China issues visas by purpose. The type depends on why you travel, and the centre asks for the paper that proves it.",
      items: [
        { title: "L, tourism", body: "For sightseeing and visiting friends. You show flights and hotel bookings, or an invitation. This is the type most Singapore residents ask about." },
        { title: "M, business", body: "For trade, meetings and trade fairs. You need an invitation letter from a business partner or a fair organiser." },
        { title: "F, visits and exchanges", body: "For short non-commercial visits, talks and study tours. It also needs an invitation letter." },
        { title: "Z, work", body: "For employment in China. You need a work permit notice first, and your employer usually leads this process." },
        { title: "X1 and X2, study", body: "X1 is for study over 180 days and X2 for study up to 180 days. Both need an admission notice from the school." },
        { title: "G, transit", body: "For passing through China to a third country. Many travellers can use the 240-hour transit rule instead and skip the visa." },
      ],
    },

    residents: {
      intro: "The visa centre treats you as a resident applicant when you apply outside your country of citizenship. It asks for proof of legal stay in Singapore, so your pass matters. The centre does not publish a different checklist for each pass type, so the points below are what we advise.",
      rows: [
        { pass: "Employment Pass", body: "Bring your EP card and a recent employment letter as proof of legal stay and work. If you live in Singapore but hold a passport that needs a visa, this is the usual route. Check that the pass stays valid well beyond your return date." },
        { pass: "S Pass", body: "The same approach as the EP. Bring the S Pass card and employment proof." },
        { pass: "Dependant's Pass", body: "Bring the Dependant's Pass card and a letter or document showing your link to the main pass holder. Applicants on a Dependant's Pass do not have their own employer letter." },
        { pass: "Permanent Resident", body: "Bring your PR card or re-entry permit. A Singapore PR who holds an Indian, Indonesian, Philippine or Vietnamese passport applies with that passport, and the 30-day visa free rule for Singapore passports does not apply." },
        { pass: "Singapore citizen", body: "No visa for stays up to 30 days. If you plan to work, study or stay longer, apply for the matching visa before you go." },
      ],
    },

    fees: {
      intro: "Two charges apply: the embassy visa fee, paid in Singapore dollars at the centre, and the centre's service fee. VIZA's help is free. The table lists the fees shown by the Embassy and the centre for applicants in Singapore. The schedule notes that fees for some passports may differ, and the amount the centre gives you at the counter is final.",
      rows: [
        { item: "Embassy fee, single entry", amount: "S$19 or S$38", note: "S$19 for a Singapore passport. S$38 for other passports such as Indian, Indonesian or Filipino." },
        { item: "Embassy fee, double entry", amount: "S$26 or S$56", note: "Singapore passport or other passports." },
        { item: "Embassy fee, 6-month multiple entry", amount: "S$34 or S$75", note: "Singapore passport or other passports." },
        { item: "Embassy fee, 12-month multiple entry", amount: "S$49 or S$113", note: "Singapore passport or other passports." },
        { item: "Centre service fee, regular", amount: "S$61", note: "GST included. Collect from the 4th working day." },
        { item: "Centre service fee, express", amount: "S$92", note: "GST included. Collect from the 3rd working day." },
        { item: "Centre service fee, urgent", amount: "S$122", note: "GST included. Collect from the 2nd working day." },
      ],
      processing: "Example: a single-entry visa for an Indonesian passport holder costs S$38 plus S$61 for regular service, S$99 in total. Payment at the centre is cash in Singapore dollars or PayNow, and service fees are not refundable. The centre gives working days for collection after you submit. Online review comes before that and has no fixed length, so apply several weeks before you fly.",
    },

    apply: {
      intro: "The centre works in two steps: you complete the online form first, then you submit in person. There is no booking system for the counter, and it opens on weekdays. Submission and payment run from 9:00 to 15:00, collection from 9:00 to 16:00.",
      guided: {
        title: "Guided",
        body: "VIZA walks you through the online form and the checklist for your pass type, and you submit at the centre yourself. It suits people who like to keep control of each step.",
      },
      fullService: {
        title: "Full-service",
        body: "A VIZA consultant prepares your form and document set, so your visit to the centre is short and you bring only what is asked. Fingerprints are still taken in person unless you are exempt.",
      },
      steps: [
        { title: "Talk to a consultant", body: "Tell us your passport, your pass and your dates. We confirm whether you need a visa at all, which type fits, and which fee applies." },
        { title: "Complete the online form", body: "Fill in the form on the centre's site and upload your photo. The centre approves it online first. Submit in person within 30 days of that approval." },
        { title: "Submit at the centre", body: "Go to 80 Robinson Road with your printed confirmation, passport and proof of stay. Give fingerprints unless you are exempt and pay by cash or PayNow." },
        { title: "Collect your passport", body: "Collect from the 4th working day for regular service. Someone else can collect with a pickup form, an authorisation letter and both IDs, or you can ask for return by post." },
      ],
    },

    checklist: {
      intro: "These are the documents the Embassy and the centre ask for. Applicants who apply outside their country of citizenship must also show proof of legal stay, residence, employment or study in Singapore, in original and copy.",
      groups: [
        {
          applicant: "Everyone",
          items: [
            "Original passport valid for more than 6 months, with blank pages",
            "Photocopy of the passport information page",
            "Online application form, printed with the confirmation",
            "A recent colour photo with a light background, matching the one you uploaded",
            "Invitation letter or booking proof for your visa type (a copy is usually accepted, but you may be asked for the original)",
          ],
        },
        {
          applicant: "Employment Pass and S Pass",
          items: [
            "Pass card, original and copy",
            "Recent employment letter",
            "Flight and hotel bookings for an L visa, or the invitation for an M or F visa",
          ],
        },
        {
          applicant: "Dependant's Pass",
          items: [
            "Dependant's Pass card, original and copy",
            "Document showing your link to the main pass holder, such as the main holder's pass copy",
            "Flight and hotel bookings, or an invitation",
          ],
        },
        {
          applicant: "Permanent Resident",
          items: [
            "PR card or re-entry permit, original and copy",
            "Proof of residence in Singapore, such as a recent bill or employment letter",
            "Flight and hotel bookings, or an invitation",
          ],
        },
      ],
    },

    travel: {
      intro: "Visa approval is the start. China asks for a few more things before you board and when you land.",
      items: [
        { title: "Arrival card", body: "China has an online arrival card, free of charge, since 20 November 2025. Fill it in on the National Immigration Administration site, the 12367 app, or the WeChat and Alipay mini programmes. Some groups are exempt, including holders of a Foreign Permanent Resident ID card." },
        { title: "Entry rules", body: "Singapore passport holders stay up to 30 days. Do not use the visa free entry to work. If your plans change, apply for the right visa before you travel, because you cannot convert tourist entry into a work stay on arrival." },
        { title: "240-hour transit", body: "If you fly through China to a third country or region, you may stay up to 10 days without a visa. You need an onward ticket with a confirmed seat and date and must enter through a designated port. Singapore, Indonesia and Vietnam are on the list. India, the Philippines, Malaysia and Thailand are not." },
      ],
    },

    reviewed: {
      date: "25 November 2026",
      note: "Checked against the Embassy of China in Singapore, the Chinese Visa Application Service Center and the National Immigration Administration. Rules change, so look at the links under Sources before you pay.",
    },

    related: {
      destinations: ["japan", "south-korea", "vietnam", "thailand"],
      guides: [
        { label: "Visa-free countries for Singapore passport holders", href: "/guides/visa-free-countries-singapore-passport" },
        { label: "Visas for Filipino and Indian residents of Singapore", href: "/guides/visas-filipino-indian-residents-singapore" },
        { label: "Visa photo requirements by country", href: "/guides/visa-photo-requirements" },
        { label: "VIZA visa news", href: "/blog" },
      ],
    },
  },

  rejectionTitle: "Common rejection reasons",
  rejectionSub: "The Embassy does not publish reasons for a refusal. These are the points the centre's own requirements make easy to miss, and a consultant checks them before you go.",
  rejectionReasons: [
    { title: "Passport validity", body: "Your passport needs more than 6 months of validity and blank pages. Check the expiry date before you start the online form." },
    { title: "Photo does not match", body: "The paper photo must match the one you uploaded, in colour with a light background. If the uploaded photo is rejected, you bring a new one." },
    { title: "No proof of stay in Singapore", body: "A foreign passport holder applying in Singapore must show legal stay, residence, employment or study. Missing pass copies or an old letter slows the file." },
    { title: "Wrong visa type", body: "A tourist visa does not cover work or paid training. An M or F visa needs an invitation letter, and a Z visa needs a work permit notice." },
    { title: "Form and booking mismatch", body: "Dates, names and passport numbers must agree between the online form, the bookings and the passport." },
    { title: "Late submission", body: "The centre asks you to submit within 30 days of online approval, so book your visit once the approval arrives." },
  ],

  faqSub: "Can't find your answer? Talk to a VIZA consultant and we will check your passport and pass.",
  faq: [
    { category: "Do I need a visa", q: "Do Singaporeans need a visa for China?", a: "No for stays up to 30 days. Singapore and China have a mutual visa exemption for ordinary passports, in force since 9 February 2024. You need a visa before you travel if you will work, report as a journalist or stay longer than 30 days." },
    { category: "Do I need a visa", q: "Does a Singapore PR need a China visa?", a: "It depends on the passport. The exemption applies to Singapore passports only, so a PR who holds an Indian, Indonesian, Philippine or Vietnamese passport needs a visa. A PR with a Malaysian passport follows the Malaysia rule." },
    { category: "Do I need a visa", q: "Do Indians living in Singapore need a China visa?", a: "Yes. India is not on the visa free lists, so an Indian passport holder applies at the Chinese Visa Application Service Center in Singapore. India is also not on the 240-hour transit list." },
    { category: "Do I need a visa", q: "Can I use the 240-hour transit rule from Singapore?", a: "Yes if you hold a passport from a listed country such as Singapore, Indonesia or Vietnam, and you have an onward ticket to a third country or region with a confirmed seat and date. You enter through a designated port and stay up to 10 days." },
    { category: "Applying in Singapore", q: "Where is the Chinese Visa Application Service Center in Singapore?", a: "It is at 80 Robinson Road, #16-01/02/02A, Singapore 068898. It opens on weekdays. Submission and payment run from 9:00 to 15:00 and collection from 9:00 to 16:00. There is no appointment system for the counter." },
    { category: "Applying in Singapore", q: "How do I apply for a China visa in Singapore?", a: "Complete the online form on the centre's website, wait for online approval, then submit the printed confirmation, passport, photo and proof of stay in person within 30 days. A consultant can prepare the form and checklist with you before you go." },
    { category: "Applying in Singapore", q: "Do I need to give fingerprints?", a: "Yes for ordinary passports, in person at the centre. You are exempt if you are under 14 or over 70, or if you gave fingerprints for a Chinese visa on the same passport in the last 5 years. Single and double entry visas up to 180 days are also exempt on or before 31 December 2026." },
    { category: "Applying in Singapore", q: "Can someone else submit or collect my passport?", a: "A proxy can submit only if you are exempt from fingerprints. Anyone can collect with the pickup form, an authorisation letter and both IDs. You can also ask the centre to return the passport by post." },
    { category: "Fees and time", q: "How much is a China visa in Singapore?", a: "The Embassy fee for a single-entry visa is S$19 for a Singapore passport and S$38 for other passports such as Indian, Indonesian or Filipino. The centre adds S$61 for regular service, S$92 for express or S$122 for urgent. The centre confirms the final amount at the counter." },
    { category: "Fees and time", q: "How long does a China visa take?", a: "After you submit at the centre, you collect from the 4th working day for regular service, the 3rd for express and the 2nd for urgent. The online review before that has no fixed length, so apply several weeks before you fly." },
    { category: "Before you travel", q: "Do I need an arrival card for China?", a: "Yes. China has a free online arrival card, available since 20 November 2025, on the National Immigration Administration site, the 12367 app and the WeChat and Alipay mini programmes. A few groups are exempt." },
    { category: "Before you travel", q: "How much does VIZA charge?", a: "Nothing. VIZA's help is free. You pay the Embassy fee and the centre fee directly at the centre." },
  ],

  sources: [
    { label: "Embassy of China in Singapore, how to apply for a visa", url: "https://sg.china-embassy.gov.cn/eng/lsfwx/va/zgqz/202609/t20260918_12025190.htm", display: "sg.china-embassy.gov.cn" },
    { label: "Embassy of China in Singapore, visa free FAQ", url: "https://sg.china-embassy.gov.cn/eng/lsfwx/zytz/202511/t20251112_11751424.htm", display: "sg.china-embassy.gov.cn" },
    { label: "Embassy of China in Singapore, arrival card notice", url: "https://sg.china-embassy.gov.cn/eng/lsfwx/zytz/202512/t20251201_11763717.htm", display: "sg.china-embassy.gov.cn" },
    { label: "Chinese Visa Application Service Center, Singapore", url: "https://www.visaforchina.cn/SGP4_EN/", display: "visaforchina.cn" },
    { label: "Chinese Visa Application Service Center, visa application guide", url: "https://www.visaforchina.cn/SGP4_EN/tongzhigonggao/550212650089451557.html", display: "visaforchina.cn" },
    { label: "National Immigration Administration, mutual visa exemption list", url: "https://en.nia.gov.cn/n147418/n147463/c181470/content.html", display: "en.nia.gov.cn" },
    { label: "National Immigration Administration, 30-day visa free list", url: "https://en.nia.gov.cn/n147418/n147463/c183390/content.html", display: "en.nia.gov.cn" },
    { label: "National Immigration Administration, 240-hour transit", url: "https://en.nia.gov.cn/n147418/n147463/c183412/content.html", display: "en.nia.gov.cn" },
    { label: "Embassy of China in Malaysia, visa exemption notice", url: "https://my.china-embassy.gov.cn/eng/fwzc/lsyw/qz/202507/t20250714_11670217.htm", display: "my.china-embassy.gov.cn" },
  ],

  price: {
    etaLabel: "Collect from",
    etaValue: "4th working day (regular)",
    title: "China visa · Singapore residents",
    sub: "VIZA's help is free: form preparation and document review. The Embassy and centre fees are paid at the centre.",
    foot: "VIZA's service is free. China visa fees are paid at the visa centre.",
  },

  aiPlaceholder: "Ask anything about a China visa from Singapore: passport rules, fees, documents…",
};

export default china;
