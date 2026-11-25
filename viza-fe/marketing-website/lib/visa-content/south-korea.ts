import type { DestinationContent } from "./types";

/**
 * South Korea: K-ETA (global framing, anyone who is visa free can apply) plus the C-3-9 short-term visa route for
 * foreign residents of Singapore. Checkout is wired for the visa route (portal row south_korea / KR_C39_SHORT_TERM_VISIT).
 * K-ETA is a free-standing application on k-eta.go.kr and is not a portal product.
 *
 * Checked 25 Nov 2026 against overseas.mofa.go.kr/sg-en (Embassy of the Republic of Korea in Singapore), k-eta.go.kr,
 * e-arrivalcard.go.kr and the Q-CODE notices. Firecrawl was out of credits, so pages were read with WebFetch.
 *
 * Not confirmed on an official page, so the copy hedges or leaves it out:
 *   - the official 2027 exemption notice text and the full list of exempt countries (the Singapore embassy page says
 *     "Extended till 31 December 2027"; the K-ETA site shows a notice titled as an extension dated 2026-11-23)
 *   - K-ETA eligibility for Malaysia, India, Indonesia, the Philippines, Vietnam, China and Thailand (the page tells the
 *     reader to check the K-ETA country list)
 *   - K-ETA refusal reasons and reapply rules
 *   - the S$55 submission fee a visa agent is said to charge (not on the fee page, so left out)
 *   - the maximum stay for Singapore passports (90 days is the usual figure, not on the embassy notice)
 *   - Korean e-visa and Jeju visa-free rules
 */
export const southKorea: DestinationContent = {
  slug: "south-korea",

  heroTitle: "Korea K-ETA and visa",
  lede: "The Korea K-ETA is an online travel authorisation for visitors who do not need a visa, and it costs KRW 10,000. Singapore passports are on Korea's temporary exemption list, so Singaporeans need neither a visa nor a K-ETA, only a free e-Arrival Card. People who live in Singapore on another passport check the K-ETA country list first, and apply for a short-term visa in person if their passport is not on it.",
  heroImage: "/assets/heroes/south-korea.jpg",
  meta: [
    { k: "K-ETA fee", v: "KRW 10,000" },
    { k: "K-ETA validity", v: "3 years" },
    { k: "Singapore passport", v: "No K-ETA until 31 Dec 2027" },
    { k: "Checked", v: "25 Nov 2026" },
  ],
  tags: [
    { icon: "shield", label: "Free VIZA service" },
    { icon: "doc", label: "Document check" },
    { icon: "globe", label: "K-ETA and visa" },
  ],

  page: {
    framing: "global",

    glance: {
      needVisa: "K-ETA for visa-free passports. Visa for others. Not for Singapore passports",
      govFee: "K-ETA KRW 10,000. Visa from S$52 single entry",
      processing: "K-ETA generally within 72 hours. Visa 8 working days",
      maxStay: "Visa free stays are usually up to 90 days. A single entry visa is valid for 3 months",
      checked: "25 November 2026",
    },

    passports: {
      intro: "Korea sorts visitors into three groups: visa free with no K-ETA, visa free with a K-ETA, and visa required. The K-ETA site has a country list that tells you which group your passport is in. If your country is not listed, you need a visa.",
      rows: [
        { passport: "Singapore", status: "No visa, no K-ETA", note: "Singapore is on the temporary K-ETA exemption list, extended to 31 December 2027. File the free e-Arrival Card within 3 days before arrival." },
        { passport: "Malaysia", status: "Check the K-ETA list", note: "Search Malaysia on the K-ETA eligibility page. If it needs a K-ETA, apply at least 72 hours before you board." },
        { passport: "India", status: "Check the K-ETA list", note: "If India is not listed, apply for a visa. Residents of Singapore can apply at the Korea Visa Application Center." },
        { passport: "Indonesia", status: "Check the K-ETA list", note: "The same approach: search the list, and apply for a visa if your passport is not on it." },
        { passport: "Philippines", status: "Check the K-ETA list", note: "The Embassy lists the Philippines as exempt from the visa fee for a business or tour visa of 59 days or less." },
        { passport: "Vietnam", status: "Check the K-ETA list", note: "Vietnam has its own, lower fee table on the Embassy page if you need the visa." },
        { passport: "China (PRC)", status: "Check the K-ETA list", note: "The group tour visa free trial for Chinese nationals ran from 29 September 2025 to 30 June 2026. It applied to group tours in China and not to travel from Singapore." },
        { passport: "Other passports", status: "Search the K-ETA list", note: "Thailand is exempt from the Korean visa fee. For every other passport, the K-ETA page is the deciding source." },
      ],
    },

    visaTypes: {
      intro: "Two products matter for most trips. One is free-standing and one is a visa.",
      items: [
        { title: "K-ETA", body: "An online authorisation for visa-free visitors. It covers tourism, visiting relatives, events and business that earns no profit. It costs KRW 10,000, is valid for 3 years and covers multiple entries. You apply only on the K-ETA site or its app, not through an agent." },
        { title: "Short-term visit visa, C-3-9", body: "For tourism and short visits when your passport is not on the K-ETA list. In Singapore it is single entry (valid 3 months), double entry (6 months) or multiple entry (5 years, if approved)." },
        { title: "e-Arrival Card", body: "A free online card, live since 24 February 2025. Everyone files it within 3 days before arrival, including Singaporeans. A valid K-ETA holder is exempt." },
        { title: "Other visas", body: "Study, work and long stays use other Korean visa codes, and the Embassy decides them case by case." },
      ],
    },

    residents: {
      intro: "The Embassy accepts visa applications only from foreigners who live in Singapore with a valid long-term pass. Short-term visitors in Singapore are not eligible. Singapore citizens do not need to apply at all.",
      rows: [
        { pass: "Employment Pass", body: "Bring your passport, a copy of the pass, 3 months of bank statements and an employment letter issued within the last month, with a wet-ink signature and company stamp." },
        { pass: "S Pass", body: "The same as the Employment Pass. If your pass has a QR code, print a recent SGWORKPASS scan too." },
        { pass: "Dependant's Pass", body: "You count as unemployed. Bring an original letter from the employer or school of the spouse, parent or child, the passport copy of that person and documents proving your relationship in English." },
        { pass: "Permanent Resident", body: "Bring your PR card and a valid re-entry permit, plus your passport, photo, bank statements and employment letter." },
        { pass: "Singapore citizen", body: "No visa and no K-ETA. Your passport must cover the whole stay, and you file the e-Arrival Card. Singaporeans aged 17 and over can also register for automated immigration clearance at Incheon." },
        { pass: "Student's Pass", body: "Bring an original school letter issued within the last month. Students are excluded from the bank statement rule." },
      ],
    },

    fees: {
      intro: "The K-ETA fee goes to Korea, and the visa fee goes to the Embassy through the visa centre. The visa fees below apply from 1 September 2026. VIZA's help is free.",
      rows: [
        { item: "K-ETA", amount: "KRW 10,000", note: "About USD 7 to 8. Valid 3 years. Exempt countries such as Singapore need none." },
        { item: "Visa, single entry up to 90 days", amount: "S$52", note: "The rate for Singapore, Malaysia, India, Indonesia, China and the Philippines unless a special rule applies." },
        { item: "Visa, single entry over 90 days", amount: "S$78", note: "Valid for 3 months to enter." },
        { item: "Visa, double entry", amount: "S$91", note: "Valid for 6 months." },
        { item: "Visa, multiple entry", amount: "S$117", note: "Valid for 5 years, if approved. If refused, a single entry visa may be issued and the difference is not refunded." },
        { item: "Fee-exempt cases", amount: "S$0", note: "Thailand is exempt for all visas. The Philippines is exempt for a business or tour visa of 59 days or less." },
      ],
      processing: "K-ETA approvals generally arrive within 72 hours, so apply at least that long before boarding, and earlier if you can. The visa takes 8 working days and there is no express service. Pay the visa fee by cash or PayNow, and note that it is not refundable. Do not book flights or hotels before the visa is approved.",
    },

    apply: {
      intro: "Start with the question that decides everything: is your passport on the K-ETA list? If it is, the K-ETA takes minutes. If not, you apply for the visa in person by appointment.",
      guided: {
        title: "Guided",
        body: "VIZA checks which group your passport is in, then walks you through the K-ETA form or the visa form and the checklist for your pass type. You submit yourself.",
      },
      fullService: {
        title: "Full-service",
        body: "A VIZA consultant prepares your visa file, checks the bank statements and letters, and tells you what to bring to your appointment. K-ETA itself is filed by you on the K-ETA site.",
      },
      steps: [
        { title: "Check your passport", body: "Search your country on the K-ETA eligibility page. Singapore passports need neither a K-ETA nor a visa for now." },
        { title: "K-ETA route", body: "Apply on the K-ETA site or app and pay KRW 10,000. Approval generally takes up to 72 hours and lasts 3 years." },
        { title: "Visa route", body: "Book an appointment at the Korea Visa Application Center, then attend in person with the form, photo, passport, pass copy, bank statements and letters. No walk-ins and no online or email applications." },
        { title: "Collect and travel", body: "The visa takes 8 working days. File the e-Arrival Card within 3 days before you land, unless you hold a valid K-ETA." },
      ],
    },

    checklist: {
      intro: "These are the documents the Embassy asks for the C-3-9 visa from foreign residents of Singapore. The K-ETA needs only your passport details, a photo and a card for the fee.",
      groups: [
        {
          applicant: "Everyone",
          items: [
            "Signed visa application form with one white-background photo, no electronic signatures",
            "Passport with at least 6 months of validity, original and a clear copy of the photo page",
            "Clear copy of your Singapore NRIC, Employment Pass, S Pass, Work Permit, Student's Pass, LTVP or Dependant's Pass",
            "3 months of Singapore bank statements from the account that receives your salary, original or e-statement",
          ],
        },
        {
          applicant: "Employed",
          items: [
            "Original employment letter issued in the last month, with wet-ink signature and company stamp",
            "LTVP holders who work: Letter of Consent from the Ministry of Manpower",
          ],
        },
        {
          applicant: "Self-employed",
          items: ["ACRA business profile printed within the last month"],
        },
        {
          applicant: "Dependant's Pass and unemployed",
          items: [
            "Original letter from the employer or school of your spouse, parent or child",
            "Passport copy of that person and relationship documents in English",
            "Translations endorsed by the Embassy for any document not in English",
          ],
        },
        {
          applicant: "Permanent Resident and student",
          items: [
            "PR: valid re-entry permit",
            "Student: original school letter issued in the last month, no bank statements needed",
          ],
        },
      ],
    },

    travel: {
      intro: "Korea has moved most arrival steps online. A few minutes before you fly saves time at Incheon.",
      items: [
        { title: "e-Arrival Card", body: "File it within 3 days before arrival at the e-Arrival Card site. It is free. A valid K-ETA holder does not need it. Voluntary K-ETA applicants from exempt countries get the same benefit.", href: "/arrival-cards/korea-e-arrival-card", linkLabel: "Read the e-Arrival Card guide" },
        { title: "Q-CODE", body: "Q-CODE is only for travellers who have been in designated quarantine areas. Travellers from other places do not need one. Check the KDCA site before you fly." },
        { title: "Passport", body: "There is no fixed minimum validity for Singapore passports, but the passport must cover your whole stay. A renewed passport needs a new K-ETA." },
        { title: "Insurance", body: "No official page we read lists travel insurance as a condition. It is worth having for medical costs." },
        { title: "Automated clearance", body: "Singaporeans aged 17 and over can register for automated immigration clearance at Incheon from 1 December 2025." },
      ],
    },

    reviewed: {
      date: "25 November 2026",
      note: "Checked against the K-ETA site, the e-Arrival Card site and the Embassy of the Republic of Korea in Singapore. The temporary exemption was extended to 31 December 2027, so look at the links under Sources before you travel.",
    },

    related: {
      destinations: ["japan", "china", "vietnam", "thailand"],
      guides: [
        { label: "K-ETA, the official application site", href: "https://www.k-eta.go.kr/portal/guidance/index.do?locale=en" },
        { label: "VIZA blog: visa and arrival card guides", href: "/blog" },
      ],
    },
  },

  rejectionTitle: "Common rejection reasons",
  rejectionSub: "The Embassy does not usually give the reason for a rejection. These are the points it warns about, and a consultant checks them first.",
  rejectionReasons: [
    { title: "Blurred pass copies", body: "The Embassy warns that a blurred copy of the pass may lead to rejection. Scan clearly, both sides." },
    { title: "False or fraudulent information", body: "False information can lead to a visa ban of up to 3 years. Tell the truth on every line." },
    { title: "Thin bank statements", body: "The Embassy asks for 3 months from the account that receives your salary. Statements from overseas banks and cards are not accepted." },
    { title: "Old letters", body: "Employment, school and ACRA documents must be issued within the last month. An older letter is a common reason to be sent back." },
    { title: "Wrong route", body: "A K-ETA is for visa-free passports only. If your country is not on the list, a K-ETA will not help, and a visitor on a short stay in Singapore cannot apply for the visa here." },
    { title: "Booked too early", body: "The Embassy asks you not to book flights or hotels before approval, so a refusal does not leave you with bookings to cancel." },
  ],

  faqSub: "Can't find your answer? Ask the AI assistant below or message a VIZA consultant.",
  faq: [
    { category: "K-ETA", q: "What is the K-ETA?", a: "It is an online electronic travel authorisation for visitors who do not need a visa. It covers tourism, visiting relatives, events and business that earns no profit, and you must hold it before you board." },
    { category: "K-ETA", q: "How much is the K-ETA and how long is it valid?", a: "KRW 10,000, about USD 7 to 8. It is valid for 3 years and for multiple uses. A renewed passport needs a new K-ETA." },
    { category: "K-ETA", q: "How long does K-ETA approval take?", a: "It is generally approved within 72 hours, so apply at least that long before you board. Apply earlier if you can." },
    { category: "K-ETA", q: "Where do I apply for a K-ETA?", a: "Only on the K-ETA site or its mobile app. Be careful with agency and look-alike sites, because the K-ETA site warns about phishing." },
    { category: "Do I need it", q: "Do Singaporeans need a K-ETA for Korea?", a: "No. Singapore is on the temporary K-ETA exemption list, extended to 31 December 2027. You need no visa either, but you must file the free e-Arrival Card within 3 days before arrival." },
    { category: "Do I need it", q: "Do Malaysians, Indians or Filipinos living in Singapore need a K-ETA?", a: "Search your country on the K-ETA eligibility page. If it is listed, apply for a K-ETA. If not, you need a visa, and as a resident of Singapore you apply at the Korea Visa Application Center." },
    { category: "Do I need it", q: "Can Chinese passport holders in Singapore use the group visa free trial?", a: "No. The trial ran from 29 September 2025 to 30 June 2026 for Chinese nationals on certain group tours in China, and it did not apply to travel from Singapore." },
    { category: "Applying in Singapore", q: "Who can apply for a Korea visa in Singapore?", a: "Only foreigners who live in Singapore with a valid long-term pass. Short-term visitors in Singapore are not eligible." },
    { category: "Applying in Singapore", q: "Where do I apply for a Korea visa in Singapore?", a: "In person at the Korea Visa Application Center, by appointment. There are no walk-ins and no online or email applications. Family members may submit for each other, friends and travel agents may not." },
    { category: "Applying in Singapore", q: "What does a Korea visa cost in Singapore?", a: "From 1 September 2026, S$52 for a single entry up to 90 days, S$78 over 90 days, S$91 for double entry and S$117 for multiple entry. Payment is by cash or PayNow, and it is not refundable." },
    { category: "Applying in Singapore", q: "How long does a Korea visa take?", a: "8 working days. The Embassy offers no express service." },
    { category: "Before you travel", q: "Do I need the e-Arrival Card?", a: "Yes, unless you hold a valid K-ETA. File it free within 3 days before arrival. It has been live since 24 February 2025." },
    { category: "Before you travel", q: "How much does VIZA charge?", a: "Nothing. VIZA's help is free. You pay the K-ETA fee or the visa fee directly to the authority." },
  ],

  sources: [
    { label: "K-ETA, guidance and fees", url: "https://www.k-eta.go.kr/portal/guidance/index.do?locale=en", display: "k-eta.go.kr" },
    { label: "K-ETA, temporary exemption notice", url: "https://www.k-eta.go.kr/portal/board/viewboarddetail.do?bbsSn=299707&locale=EN", display: "k-eta.go.kr" },
    { label: "Embassy of Korea in Singapore, K-ETA FAQ", url: "https://overseas.mofa.go.kr/sg-en/brd/m_2445/view.do?seq=738963&page=1", display: "overseas.mofa.go.kr" },
    { label: "Embassy of Korea in Singapore, K-ETA exemption notice", url: "https://www.mofa.go.kr/sg-en/brd/m_2435/view.do?seq=761395", display: "mofa.go.kr" },
    { label: "Embassy of Korea in Singapore, C-3-9 short-term visit visa", url: "https://overseas.mofa.go.kr/sg-en/brd/m_2444/view.do?seq=761433&page=1", display: "overseas.mofa.go.kr" },
    { label: "Embassy of Korea in Singapore, visa fees from 1 September 2026", url: "https://overseas.mofa.go.kr/sg-en/brd/m_2444/view.do?seq=761414&page=1", display: "overseas.mofa.go.kr" },
    { label: "Embassy of Korea in Singapore, Chinese group visa free trial", url: "https://www.mofa.go.kr/sg-en/brd/m_2435/view.do?seq=761557", display: "mofa.go.kr" },
    { label: "e-Arrival Card, guide", url: "https://www.e-arrivalcard.go.kr/portal/guide/eacGuide.do?locale=E", display: "e-arrivalcard.go.kr" },
  ],

  price: {
    etaLabel: "K-ETA approval",
    etaValue: "Generally within 72 hours",
    title: "K-ETA and short-term visa",
    sub: "VIZA's help is free: document review and application preparation. The K-ETA fee and any visa fee are paid directly to the authority.",
    foot: "VIZA's service is free. Korean fees are paid directly to the issuing authority.",
  },

  aiPlaceholder: "Ask anything about the Korea K-ETA or visa: who needs one, fees, documents…",
};

export default southKorea;
