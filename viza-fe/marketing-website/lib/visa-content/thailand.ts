import type { DestinationContent } from "./types";

/**
 * Thailand visa and tourist e-visa, framed globally (any passport), with a section for Singapore residents.
 *
 * Checked 25 Nov 2026. Thailand changed its rules on 15 Sep 2026 (Royal Gazette, 31 Aug 2026): the 60-day visa
 * exemption was revoked and replaced by 30 days. Read on the day:
 *   - https://thailand.prd.go.th/en/content/category/detail/id/48/iid/538547 (effective 15 Sep 2026, 60 countries to 30 days)
 *   - https://image.mfa.go.th/mfa/0/wdW3FTtVMc/2026-05-22/ตารางทบทวนมาตรการ_ver._eng.pdf (MFA country table: 30-day
 *     exemption includes Singapore, Malaysia, Indonesia, Philippines; visa on arrival lists Azerbaijan, Belarus, Serbia,
 *     India; bilateral 30 days for China and Vietnam)
 *   - https://singapore.thaiembassy.org/en/page/tourist-visa (SGD 50 single, SGD 250 METV, 3 and 6 months validity,
 *     60 days per entry, apply 21 working days ahead, stay in Singapore while processing, bank statement S$800 or S$8,000)
 * Not confirmed on an official page this session (kept general or flagged in the copy):
 *   - the stay on a visa (the Embassy page, undated, still says 60 days per entry after the 15 Sep change)
 *   - the visa on arrival fee and the extension fee (left out; the July check had THB 1,900 for a 30-day extension)
 *   - one extension of up to 30 days for exempt travellers (press reports, not the Gazette text)
 *   - land border limit of two exempt entries a calendar year, which excludes Singapore, Malaysia, Indonesia and Brunei
 *     (press reports quoting the Gazette)
 *   - TDAC rules (read from Thai embassy pages and press: free, within 3 days before arrival, one form per entry)
 *   - the e-visa processing time (the Embassy gives none; it says apply at least 21 working days ahead)
 *   - overstay fine amounts, left out
 * Titles: the shared default title is "Thailand e-Visa: Requirements and How to Apply | VIZA". The keywords "thailand visa"
 * and "thailand visa singapore" would suit a shorter "Thailand Visa for Singapore Residents | VIZA" override in lib/seo/titles.ts.
 */
export const thailand: DestinationContent = {
  slug: "thailand",

  heroTitle: "Thailand visa: do you need one, and how to apply for the e-visa",
  lede: "Do Singaporeans need a visa to Thailand? Not for a holiday. From 15 September 2026 Singapore passports enter Thailand visa free for up to 30 days, down from 60, and Malaysian, Indonesian and Philippine passports get the same. Chinese and Vietnamese passports get 30 days under their own agreements, and Indian passports use visa on arrival. For a longer stay you apply for the Thailand e-visa online, and the Royal Thai Embassy in Singapore charges S$50 for a single entry. Every visitor also fills in the free Thailand Digital Arrival Card (TDAC) before arrival.",
  heroImage: "/assets/heroes/thailand.jpg",
  meta: [
    { k: "Singapore passport", v: "Visa free, 30 days" },
    { k: "e-visa, single entry", v: "S$50 at the Embassy" },
    { k: "Arrival card", v: "TDAC, free" },
    { k: "Checked", v: "25 Nov 2026" },
  ],
  tags: [
    { icon: "shield", label: "Free VIZA service" },
    { icon: "doc", label: "TDAC and document check" },
    { icon: "bolt", label: "e-visa and visa free" },
  ],

  page: {
    framing: "global",

    glance: {
      needVisa: "Not for Singapore, Malaysian, Indonesian, Philippine, Chinese or Vietnamese passports on a tourist stay. Indian passports use visa on arrival",
      govFee: "S$50 for a single entry e-visa and S$250 for a multiple entry (METV) at the Embassy in Singapore. Visa free entry has no fee",
      processing: "The Embassy gives no time. It says to apply at least 21 working days before you travel and to stay in Singapore until it is approved",
      maxStay: "30 days visa free, tourism only. The Embassy lists up to 60 days per entry on a tourist e-visa",
      checked: "25 November 2026",
    },

    passports: {
      intro: "Thailand changed its entry rules on 15 September 2026. The 60-day exemption is gone and the Ministry of Foreign Affairs now lists each country under one scheme. The table follows that list, and the Ministry's table is the final word.",
      rows: [
        { passport: "Singapore", status: "Visa free, up to 30 days", note: "Tourism only, no fee and no visa. For more than 30 days, apply for the tourist e-visa before you go." },
        { passport: "China (PRC)", status: "Visa free, 30 days", note: "Chinese passports are covered by a bilateral agreement for 30 days. Complete the TDAC before you arrive." },
        { passport: "Malaysia", status: "Visa free, up to 30 days", note: "Malaysian passports are on the 30-day list." },
        { passport: "India", status: "Visa on arrival", note: "India is on the Ministry's visa on arrival list. The fee and the documents are set by Thai immigration, so check before you fly or apply for the e-visa in advance." },
        { passport: "Indonesia", status: "Visa free, up to 30 days", note: "Indonesian passports are on the 30-day list." },
        { passport: "Philippines", status: "Visa free, up to 30 days", note: "Philippine passports are on the 30-day list." },
        { passport: "Vietnam", status: "Visa free, 30 days", note: "Vietnamese passports are covered by a bilateral agreement for 30 days." },
        { passport: "Other passports", status: "Check the Ministry's table", note: "Sixty countries and territories get 30 days, a few get 15 days or visa on arrival, and some bilateral agreements differ. If yours is not listed, you need a visa." },
      ],
    },

    visaTypes: {
      intro: "Most visitors need no visa for a holiday. When you do, Thailand issues visas by purpose, and tourists use the e-visa.",
      items: [
        { title: "Visa free entry", body: "Thirty days for tourism for the countries on the Ministry's 30-day list, which includes Singapore. Eligible visitors can ask immigration for one extension of up to 30 more days, as reported after the change." },
        { title: "Tourist visa (TR), single entry", body: "Applied for online on the Thai e-visa portal. The Embassy in Singapore lists a S$50 fee, three months of validity and up to 60 days per entry." },
        { title: "Multiple entry tourist visa (METV)", body: "S$250 at the Embassy in Singapore, valid for six months, with up to 60 days per entry. It needs six months of bank statements and an employment letter." },
        { title: "Visa on arrival", body: "A short list of countries, including India, can get a visa on arrival under the new scheme. Fee and conditions are set at the immigration counter." },
      ],
    },

    residents: {
      intro: "If you live in Singapore, the Royal Thai Embassy in Singapore accepts your e-visa application, and you show your long-term pass. You must stay in Singapore until the e-visa is approved.",
      rows: [
        { pass: "Employment Pass", body: "Chinese, Vietnamese, Malaysian, Indonesian and Philippine passport holders need no visa for 30 days. For a longer stay, apply for the e-visa and add a copy of your EP (front and back) and its QR code details." },
        { pass: "S Pass", body: "The same as the EP. Show the S Pass copy, and the Embassy asks for three months of bank statements with at least S$800 for a single entry." },
        { pass: "Dependant's Pass", body: "Each family member applies on their own passport. Add the Dependant's Pass copy, and a sponsor letter and proof of relationship if someone else pays." },
        { pass: "Permanent Resident", body: "Follow the row for your passport, not your PR status. A PR with an Indian passport uses visa on arrival or applies for the e-visa first." },
        { pass: "Singapore citizen", body: "No visa for a holiday of up to 30 days. Carry your passport, a return ticket and your TDAC QR code." },
        { pass: "Student's Pass", body: "Follow your passport's row. For an e-visa, add the Student's Pass copy and a school letter or a parent's sponsor letter." },
      ],
    },

    fees: {
      intro: "Visa free entry has no fee. The fees below are for the tourist e-visa lodged at the Royal Thai Embassy in Singapore. VIZA's help is free.",
      rows: [
        { item: "Single entry tourist e-visa", amount: "S$50", note: "Non-refundable. Valid three months from issue, up to 60 days per entry." },
        { item: "Multiple entry tourist e-visa (METV)", amount: "S$250", note: "Non-refundable. Valid six months, up to 60 days per entry." },
        { item: "Visa free entry", amount: "No fee", note: "Thirty days for Singapore, Malaysian, Indonesian, Philippine, Chinese and Vietnamese passports." },
        { item: "Visa on arrival", amount: "Set at the counter", note: "The fee is not confirmed here, so check Thai immigration before you fly." },
        { item: "TDAC arrival card", amount: "Free", note: "Use only the official site, and avoid websites that charge for it." },
      ],
      processing: "The Embassy gives no processing time. It tells applicants to submit at least 21 working days before travel and to remain in Singapore until the e-visa is approved. The Embassy may ask for more documents or an interview without notice. Visa free travellers have nothing to wait for, so plan the TDAC for the three days before you fly.",
    },

    apply: {
      intro: "Most people never need an application, only the TDAC. If you need the e-visa, choose how much help you want. The fee goes to the Embassy, not to VIZA.",
      guided: {
        title: "Guided",
        body: "VIZA's AI walks you through the e-visa form and the Embassy's checklist for your pass type, and you submit on the Thai e-visa portal yourself.",
      },
      fullService: {
        title: "Full-service",
        body: "A VIZA consultant prepares the form, checks the bank statements, itinerary and pass copies, and prepares the file so the common document mistakes are caught before you submit.",
      },
      steps: [
        { title: "Start on VIZA", body: "Tell us your passport, pass and trip length. We confirm whether you can go visa free or need the e-visa." },
        { title: "Prepare the file", body: "We check the photo, bank statements, flight ticket and accommodation proof against the Embassy's list." },
        { title: "Submit", body: "Submit on the Thai e-visa portal and pay the fee. Stay in Singapore until it is approved." },
        { title: "Fill in the TDAC", body: "Within three days before you arrive, complete the free Thailand Digital Arrival Card and save the QR code." },
      ],
    },

    checklist: {
      intro: "These are the Embassy in Singapore's documents for a single entry tourist e-visa. Visa free travellers need only a passport, a return ticket and the TDAC.",
      groups: [
        {
          applicant: "Everyone applying for the e-visa",
          items: [
            "Passport valid for more than six months",
            "Photo taken in the last six months, to the portal's specification",
            "Copy of a round-trip flight ticket and a travel itinerary",
            "Accommodation proof for the whole stay",
            "Bank statements for three months with at least S$800 per person (single entry)",
          ],
        },
        {
          applicant: "Employment Pass and S Pass",
          items: [
            "Pass copy, front and back, with the QR code details",
            "Employment letter for a multiple entry visa, with six months of statements showing at least S$8,000",
          ],
        },
        {
          applicant: "Dependant's Pass and families",
          items: [
            "Dependant's Pass copy",
            "Proof of relationship, translated and certified where needed",
            "Sponsor letter and the sponsor's documents if someone else pays",
          ],
        },
        {
          applicant: "Permanent Resident and student",
          items: [
            "PR card or Student's Pass copy",
            "Bank statements, or a parent's sponsor letter with their statements",
          ],
        },
        {
          applicant: "Visa free travellers",
          items: [
            "Passport valid for your stay",
            "Return or onward ticket",
            "TDAC QR code",
          ],
        },
      ],
    },

    travel: {
      intro: "Visa free or e-visa, you still do the arrival card, and Thailand changed more than one rule in 2026.",
      items: [
        { title: "Thailand Digital Arrival Card (TDAC)", body: "Every foreign visitor completes the TDAC online before arriving. It is free, you submit it within three days before arrival at tdac.immigration.go.th, and you need a new one for each entry. Save the QR code to your phone.", href: "/arrival-cards/thailand-tdac", linkLabel: "Read the TDAC guide" },
        { title: "The 30-day change", body: "From 15 September 2026 the visa free stay is 30 days. A visitor who entered before that date keeps the stay they were given on arrival." },
        { title: "Entering by land", body: "Press reports say visa free visitors who enter by land are limited to two entries a calendar year, with Singapore, Malaysia, Indonesia and Brunei excluded. Check the current rule before a border run." },
        { title: "Extending", body: "A visa free visitor can apply to immigration for one extension of up to 30 days, subject to approval. A tourist visa is extended at an immigration office in Thailand." },
        { title: "Insurance", body: "Travel insurance is not an entry requirement, but a policy covering medical care and cancelled flights is sensible." },
      ],
    },

    reviewed: {
      date: "25 November 2026",
      note: "Checked against the Thai Ministry of Foreign Affairs country table, the Public Relations Department's notice and the Royal Thai Embassy in Singapore. Thailand changed these rules in September 2026, so look at the links under Sources before you travel.",
    },

    related: {
      destinations: ["vietnam", "malaysia", "india", "indonesia"],
      guides: [
        { label: "Visa-free countries for Singapore passport holders", href: "/guides/visa-free-countries-singapore-passport" },
        { label: "Visas for Chinese passport holders in Singapore", href: "/guides/visas-chinese-passport-holders-singapore" },
        { label: "Visas for Filipino and Indian residents of Singapore", href: "/guides/visas-filipino-indian-residents-singapore" },
        { label: "e-Visa vs visa on arrival vs embassy visa", href: "/guides/e-visa-vs-visa-on-arrival-vs-embassy-visa" },
        { label: "Thailand Digital Arrival Card, Immigration Bureau", href: "https://tdac.immigration.go.th/" },
        { label: "VIZA visa news", href: "/blog" },
      ],
    },
  },

  rejectionTitle: "Common rejection reasons",
  rejectionSub: "The Embassy does not publish its reasons for refusing an e-visa, and the fee is not refunded. These are the points a consultant checks first.",
  rejectionReasons: [
    { title: "Funds that do not fit the trip", body: "The Embassy asks for three months of statements with at least S$800 per person for a single entry. Thin statements or sudden large deposits raise questions." },
    { title: "Travel plans that do not agree", body: "The flight ticket, itinerary and accommodation proof must agree on dates. A missing hotel booking is a common return." },
    { title: "Applying too late", body: "The Embassy advises at least 21 working days. A late application may not be approved before you fly." },
    { title: "Leaving Singapore during processing", body: "The Embassy requires you to remain in Singapore until the e-visa is approved." },
    { title: "Missing pass documents", body: "A long-term pass applicant needs the pass copy, front and back, with its QR code details." },
    { title: "Photo that does not meet the portal", body: "The photo must be recent and meet the e-visa portal's specification." },
  ],

  faqSub: "Can't find your answer? Ask the AI assistant below or message a VIZA consultant.",
  faq: [
    { category: "Do I need a visa", q: "Do Singaporeans need a visa to Thailand?", a: "No, not for a holiday. From 15 September 2026 Singapore passports enter Thailand visa free for up to 30 days for tourism. For a longer stay, apply for the Thailand tourist e-visa first." },
    { category: "Do I need a visa", q: "Do I need a Thailand visa from Singapore if I hold a Chinese or Indian passport?", a: "Chinese passports enter visa free for 30 days under a bilateral agreement. Indian passports are on the visa on arrival list. For a longer stay, apply for the e-visa through the Embassy in Singapore." },
    { category: "Do I need a visa", q: "Did Thailand cut the visa free stay for Singapore passports?", a: "The 60-day exemption was revoked and replaced by 30 days from 15 September 2026. Singapore stays on the 30-day list." },
    { category: "Do I need a visa", q: "Do Singapore PR and pass holders need a Thailand visa?", a: "It depends on your passport. Malaysian, Indonesian, Philippine, Chinese and Vietnamese passports have visa free entry for 30 days. Indian passports use visa on arrival." },
    { category: "Thailand e-visa", q: "What is the Thailand e-visa?", a: "It is the tourist visa applied for online on the Thai e-visa portal. The Royal Thai Embassy in Singapore lists S$50 for a single entry and S$250 for a multiple entry." },
    { category: "Thailand e-visa", q: "How do I apply for a Thailand e-visa from Singapore?", a: "Submit the application on the Thai e-visa portal with your passport, photo, flight ticket, accommodation proof, bank statements and pass copy. Stay in Singapore until it is approved." },
    { category: "Thailand e-visa", q: "How long does a Thailand e-visa take?", a: "The Embassy gives no time. It advises applying at least 21 working days before you travel." },
    { category: "Thailand e-visa", q: "How long can I stay on a Thailand tourist e-visa?", a: "The Embassy's tourist visa page lists up to 60 days per entry, with a single entry visa valid for three months. Rules changed in September 2026, so check the page before you go." },
    { category: "Arrival card", q: "What is the Thailand Digital Arrival Card?", a: "The TDAC is an online arrival card that every foreign visitor completes before entering Thailand. It is free, takes a few minutes and gives you a QR code." },
    { category: "Arrival card", q: "When do I fill in the TDAC?", a: "Within three days before you arrive, on tdac.immigration.go.th. You need a new one for each entry." },
    { category: "Arrival card", q: "Can I extend my stay in Thailand?", a: "A visa free visitor can ask immigration for one extension of up to 30 days, subject to approval. A tourist visa holder extends at an immigration office." },
    { category: "Before you travel", q: "How much does VIZA charge?", a: "Nothing. VIZA's help is free. You pay the Embassy fee, if you need an e-visa, on the Thai portal." },
  ],

  sources: [
    { label: "Thai Public Relations Department, revision of visa exemption and visa on arrival", url: "https://thailand.prd.go.th/en/content/category/detail/id/48/iid/538547", display: "thailand.prd.go.th" },
    { label: "Ministry of Foreign Affairs of Thailand, revised country table 2026", url: "https://image.mfa.go.th/mfa/0/wdW3FTtVMc/2026-05-22/ตารางทบทวนมาตรการ_ver._eng.pdf", display: "image.mfa.go.th" },
    { label: "Royal Thai Embassy in Singapore, tourist visa", url: "https://singapore.thaiembassy.org/en/page/tourist-visa", display: "singapore.thaiembassy.org" },
    { label: "Thai e-visa portal", url: "https://thaievisa.go.th/", display: "thaievisa.go.th" },
    { label: "Thailand Digital Arrival Card", url: "https://tdac.immigration.go.th/", display: "tdac.immigration.go.th" },
  ],

  price: {
    etaLabel: "Processing time",
    etaValue: "Apply 21 working days ahead",
    title: "Tourist e-visa · single entry",
    sub: "VIZA's help is free: form preparation and document review. The visa fee is paid to the Embassy on the Thai portal.",
    foot: "VIZA's service is free. Any Thailand visa fee is paid directly to the issuing authority.",
  },

  aiPlaceholder: "Ask anything about a Thailand visa from Singapore: e-visa, TDAC, 30 days…",
};

export default thailand;
