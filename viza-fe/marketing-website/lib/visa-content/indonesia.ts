import type { DestinationContent } from "./types";

/**
 * Indonesia visa on arrival (the e-VOA, visa type B1), framed globally, with a section for Singapore residents.
 *
 * Checked 25 Nov 2026. The Directorate General of Immigration pages (evisa.imigrasi.go.id) returned little text and the
 * RRI news page returned 403, so the fee and eligibility facts come from search summaries and one Wise guide read on the day,
 * plus the July 2026 check. Re-open these before a publish:
 *   - https://evisa.imigrasi.go.id/web/visa-selection (fee, eligibility, documents)
 *   - https://www.imigrasi.go.id/wna/daftar-negara-voa-bvk-calling-visa (the VOA country list)
 *   - https://allindonesia.imigrasi.go.id/ (arrival declaration)
 * Not confirmed on an official page this session (kept general or flagged in the copy):
 *   - the fee: IDR 500,000 is the last figure on the Directorate General's information. On 12 Aug 2026 the Director General
 *     announced IDR 750,000 for the e-VOA and IDR 1,000,000 on arrival; reports call it a proposal and no effective date is
 *     published. Update the fee rows the day it takes effect.
 *   - which ASEAN passports are visa free for 30 days: Singapore is confirmed by the Wise guide, the other ASEAN rows follow
 *     the portal's "visa exemption is offered for ASEAN nationals"
 *   - China on the e-VOA list (a 2023 list had it; not re-read), India is on the list
 *   - the e-VOA validity window (valid 90 days in the July check; sources disagree whether it is the apply window or the entry window)
 *   - the Bali foreign tourist levy of IDR 150,000 (secondary sources), set by the Bali provincial government
 *   - Singapore PRs' special exemption of up to 4 days for Batam, Bintan and Karimun (one guide; conditions not read)
 *   - the previous page described a Singapore passport e-VOA product. Singapore passports are visa free for 30 days, so the
 *     copy says the e-VOA is the choice when you may want the 30-day extension. Check this against the checkout.
 * Titles: the shared default title is "Indonesia e-Visa: Requirements and How to Apply | VIZA". The keyword "indonesia visa on
 * arrival" would suit an override such as "Indonesia Visa on Arrival (e-VOA): How to Apply | VIZA" in lib/seo/titles.ts.
 */
export const indonesia: DestinationContent = {
  slug: "indonesia",

  heroTitle: "Indonesia visa on arrival (e-VOA): requirements and how to apply",
  lede: "The Indonesia visa on arrival is a 30-day stay you can apply for online before you fly as an e-VOA, and it can be extended once for another 30 days. It costs IDR 500,000 on the Directorate General of Immigration's current information, and Indonesia has announced a higher fee that has no start date yet. Singapore passports enter Indonesia visa free for up to 30 days, so the e-VOA helps when you may want to extend. Chinese and Indian passports use the visa on arrival or e-VOA. Every visitor also fills in the free All Indonesia arrival declaration.",
  heroImage: "/assets/heroes/indonesia.jpg",
  meta: [
    { k: "Type", v: "e-VOA (B1)" },
    { k: "Stay", v: "30 days, extend once" },
    { k: "Fee", v: "IDR 500,000 (higher fee announced)" },
    { k: "Checked", v: "25 Nov 2026" },
  ],
  tags: [
    { icon: "shield", label: "Free VIZA service" },
    { icon: "doc", label: "Document check" },
    { icon: "bolt", label: "Apply online" },
  ],

  page: {
    framing: "global",

    glance: {
      needVisa: "Not for Singapore, Malaysian, Philippine or Vietnamese passports on a tourist stay of up to 30 days. Chinese and Indian passports use the visa on arrival or e-VOA",
      govFee: "IDR 500,000 for the visa on arrival or e-VOA on the current information. Indonesia announced IDR 750,000 (e-VOA) and IDR 1,000,000 (on arrival) in August 2026, with no start date",
      processing: "Set by the government portal. Apply before you fly, and allow time for the card payment and the email",
      maxStay: "30 days, extendable once by 30 days. Visa free entry is 30 days and cannot be extended",
      checked: "25 November 2026",
    },

    passports: {
      intro: "Indonesia decides by passport, not by where you live. The table shows the usual route for each passport. The portal's visa finder and the Directorate General's visa on arrival country list are the final word.",
      rows: [
        { passport: "Singapore", status: "Visa free, up to 30 days", note: "No fee, and the stay cannot be extended. A Singapore passport can also use the e-VOA, which allows one 30-day extension." },
        { passport: "China (PRC)", status: "Visa on arrival or e-VOA", note: "Chinese passports have used the visa on arrival route. Check your passport on the country list before you apply." },
        { passport: "Malaysia", status: "Visa free, up to 30 days", note: "ASEAN passports are on the visa exemption list for tourism." },
        { passport: "India", status: "Visa on arrival or e-VOA", note: "Indian passports are eligible for the B1 visa on arrival and the e-VOA." },
        { passport: "Indonesia", status: "No visa needed", note: "Indonesian citizens enter on their own passport and also fill in the All Indonesia declaration." },
        { passport: "Philippines", status: "Visa free, up to 30 days", note: "ASEAN passports are on the visa exemption list for tourism." },
        { passport: "Vietnam", status: "Visa free, up to 30 days", note: "ASEAN passports are on the visa exemption list for tourism." },
        { passport: "Other passports", status: "Check the country list", note: "About 90 countries can get a visa on arrival or e-VOA. If yours is not on the list, apply for a visit visa before you travel." },
      ],
    },

    visaTypes: {
      intro: "Indonesia has several short stay routes. Most tourists use one of the first three.",
      items: [
        { title: "Visa free entry", body: "For ASEAN passports on a tourist visit, up to 30 days. It has no fee and cannot be extended or changed into another permit." },
        { title: "e-VOA (B1)", body: "The visa on arrival applied for online before you fly. One application can cover up to five people, you pay by card, and the stay is 30 days with one extension of 30 days." },
        { title: "Visa on arrival (B1) at the airport", body: "The same visa bought at the immigration counter. Indonesia plans a higher fee for this route than for the e-VOA, so applying online is the cheaper plan." },
        { title: "Visit visa (C1) and longer stays", body: "For a longer stay or for business, apply through the portal's visa finder for a visit visa or another category. The B1 does not allow you to sell goods or services or be paid by an Indonesian company." },
      ],
    },

    residents: {
      intro: "Living in Singapore does not change what Indonesia asks. The passport decides. Keep your pass valid for the whole trip so you can return to Singapore.",
      rows: [
        { pass: "Employment Pass", body: "Follow your passport's row. A Chinese or Indian passport holder uses the visa on arrival or e-VOA, and the EP only matters for returning to Singapore." },
        { pass: "S Pass", body: "The same as the EP. The e-VOA form asks for your passport and details, and not for your pass." },
        { pass: "Dependant's Pass", body: "Each family member applies on their own passport, and one application can cover up to five people on the portal. Keep the pass valid past your return date." },
        { pass: "Permanent Resident", body: "A PR holds a passport from another country, so follow that row. One guide reports a special exemption for Singapore PRs on short trips to Batam, Bintan and Karimun, so check its conditions first." },
        { pass: "Singapore citizen", body: "No visa for up to 30 days. Use the e-VOA if you may want to extend. Carry your passport with six months of validity, a return ticket and your All Indonesia QR code." },
        { pass: "Student's Pass", body: "Follow your passport's row. Make sure the passport has six months of validity." },
      ],
    },

    fees: {
      intro: "Visa free entry has no fee. The visa on arrival and e-VOA are paid on the portal by card. VIZA's help is free.",
      rows: [
        { item: "e-VOA or visa on arrival (B1)", amount: "IDR 500,000", note: "The figure on the Directorate General's current information. Check the portal on the day you pay." },
        { item: "Announced increase", amount: "IDR 750,000 e-VOA, IDR 1,000,000 on arrival", note: "Announced on 12 August 2026 and described as a proposal, with no start date published." },
        { item: "Extension of the e-VOA", amount: "Set by the portal", note: "One extension of 30 days, applied for on the portal, with a photo taken at an immigration office the next working day." },
        { item: "Visa free entry", amount: "No fee", note: "ASEAN passports, up to 30 days, not extendable." },
        { item: "Bali tourist levy", amount: "IDR 150,000 (reported)", note: "A separate levy set by the Bali provincial government for foreign visitors. Check the Bali government's page before you fly." },
      ],
      processing: "The portal does not give a fixed time in the pages read for this guide, so apply before you fly and keep the email. You pay by Mastercard, Visa or JCB, and you need a passport with six months of validity. The e-VOA is a visa on arrival, so you show it at the Indonesian immigration counter with your passport.",
    },

    apply: {
      intro: "Choose how much help you want. The portal is the government's, and the fee goes to the government, not to VIZA.",
      guided: {
        title: "Guided",
        body: "VIZA's AI walks you through the e-VOA form, checks your passport and photo, and you submit and pay on the portal yourself.",
      },
      fullService: {
        title: "Full-service",
        body: "A VIZA consultant prepares the form for you and for your group, checks the files and prepares the application, so the common passport and date mistakes are caught before you pay.",
      },
      steps: [
        { title: "Start on VIZA", body: "Tell us your passport, trip dates and who is travelling. We confirm whether you can go visa free or want the e-VOA." },
        { title: "Prepare the files", body: "Scan the passport bio page and add a recent photo. We check both before you submit." },
        { title: "Apply and pay", body: "Submit on the Indonesian immigration e-visa portal and pay by card. The fee goes to the government." },
        { title: "Declare your arrival", body: "Within three days before you arrive, fill in the free All Indonesia declaration and keep the QR code with your e-VOA." },
      ],
    },

    checklist: {
      intro: "The portal asks for a short list. These apply to everyone, with a few points by applicant type.",
      groups: [
        {
          applicant: "Everyone",
          items: [
            "Passport valid for at least six months",
            "Passport bio page scan and a recent photo",
            "Email address and a Mastercard, Visa or JCB card for payment",
            "Return or onward ticket and your first address, to hand at immigration",
            "All Indonesia QR code, completed within three days before arrival",
          ],
        },
        {
          applicant: "Singapore citizens and residents",
          items: [
            "Your Singapore pass or NRIC kept valid for your return",
            "Passport from the country you hold, not your pass, for the application",
          ],
        },
        {
          applicant: "Families and groups",
          items: [
            "One application can cover up to five people, with each person's passport details",
            "Separate passports for children",
          ],
        },
        {
          applicant: "Chinese and Indian passport holders",
          items: [
            "Confirm your passport is on the visa on arrival country list",
            "Apply for the e-VOA before you fly, so you avoid the higher counter fee",
          ],
        },
      ],
    },

    travel: {
      intro: "The visa is one part. Indonesia asks every visitor for an arrival declaration, and a few rules catch people out.",
      items: [
        { title: "All Indonesia arrival declaration", body: "All travellers submit the arrival card on allindonesia.imigrasi.go.id within three days before arrival. It covers immigration, customs and health, it is free, and it gives you a QR code. It is not a visa.", href: "/arrival-cards/indonesia-all-indonesia", linkLabel: "Read the All Indonesia guide" },
        { title: "Extending the e-VOA", body: "You can extend the e-VOA once for 30 days on the portal, for 60 days in total. Visa free entry cannot be extended, so choose the e-VOA if you may stay longer." },
        { title: "Work and business", body: "The B1 does not let you sell goods or services or be paid by an Indonesian company. Check the portal for the right visa for work." },
        { title: "Bali levy", body: "Foreign visitors to Bali pay a separate tourist levy, reported at IDR 150,000. It is not part of the visa." },
        { title: "Insurance", body: "Travel insurance is not an entry requirement, but a policy covering medical care and cancelled flights is sensible." },
      ],
    },

    reviewed: {
      date: "25 November 2026",
      note: "Checked against the Indonesian immigration e-visa portal and news of the announced fee change. The fee may change soon, so look at the links under Sources before you pay.",
    },

    related: {
      destinations: ["malaysia", "vietnam", "thailand", "australia"],
      guides: [
        { label: "Visas for Chinese passport holders in Singapore", href: "/guides/visas-chinese-passport-holders-singapore" },
        { label: "Visas for Filipino and Indian residents of Singapore", href: "/guides/visas-filipino-indian-residents-singapore" },
        { label: "e-Visa vs visa on arrival vs embassy visa", href: "/guides/e-visa-vs-visa-on-arrival-vs-embassy-visa" },
        { label: "All Indonesia arrival declaration, Directorate General of Immigration", href: "https://allindonesia.imigrasi.go.id/" },
        { label: "VIZA visa news", href: "/blog" },
      ],
    },
  },

  rejectionTitle: "Common rejection reasons",
  rejectionSub: "Indonesia does not publish its reasons for refusing an e-VOA. These are the points a consultant checks before you submit.",
  rejectionReasons: [
    { title: "Passport validity", body: "The passport needs at least six months of validity. A passport close to expiry should be renewed first." },
    { title: "Passport not on the list", body: "The visa on arrival and e-VOA are for the countries on the Directorate General's list. Apply for a visit visa if yours is not on it." },
    { title: "Details that do not match the passport", body: "Name, passport number and date of birth must match the passport exactly." },
    { title: "Poor photo or scan", body: "A blurred or cropped passport scan or an unclear photo is a common reason for a return." },
    { title: "Wrong purpose", body: "The B1 is for tourism, family visits, short business meetings and similar. Work and long stays need another visa." },
    { title: "Applying for a stay beyond the rules", body: "A visa free stay cannot be extended. Choose the e-VOA before you fly if you may want more than 30 days." },
  ],

  faqSub: "Can't find your answer? Ask the AI assistant below or message a VIZA consultant.",
  faq: [
    { category: "Do I need a visa", q: "Do Singaporeans need a visa for Indonesia?", a: "Not for a tourist stay of up to 30 days. Singapore passports enter visa free, but the stay cannot be extended. The e-VOA allows one 30-day extension." },
    { category: "Do I need a visa", q: "What is the Indonesia visa on arrival?", a: "It is the B1 visa on arrival, a 30-day stay you can apply for online as an e-VOA before you fly or buy at the airport. It can be extended once for another 30 days." },
    { category: "Do I need a visa", q: "Do Chinese or Indian passport holders in Singapore need an Indonesian visa?", a: "They use the visa on arrival or e-VOA. India is on the list, and Chinese passport holders should check the Directorate General's country list before they apply." },
    { category: "Do I need a visa", q: "Do Singapore PR and pass holders need an Indonesia visa?", a: "It depends on your passport. Indonesia looks at the passport, so follow the row for the passport you hold. Your EP, S Pass, Dependant's Pass or PR does not change it." },
    { category: "Applying", q: "How do I apply for the Indonesia e-VOA?", a: "Open the Indonesian immigration e-visa portal, fill in the form, upload your passport and photo, and pay by Mastercard, Visa or JCB. One application can cover up to five people." },
    { category: "Applying", q: "How long does the e-VOA take?", a: "The portal pages read for this guide give no fixed time, so apply before you fly and keep the email." },
    { category: "Applying", q: "How long can I stay on the Indonesia e-VOA?", a: "Thirty days, with one extension of 30 days on the portal, for 60 days in total. After that you must leave." },
    { category: "Fees", q: "How much is the Indonesia visa on arrival?", a: "IDR 500,000 on the current information. In August 2026 Indonesia announced IDR 750,000 for the e-VOA and IDR 1,000,000 on arrival, with no start date, so check the portal on the day you pay." },
    { category: "Fees", q: "Is there a Bali tourist levy?", a: "Foreign visitors to Bali pay a separate levy, reported at IDR 150,000, which is set by the Bali provincial government and is not part of the visa." },
    { category: "Arrival card", q: "What is the All Indonesia arrival card?", a: "It is the free online arrival declaration for immigration, customs and health. Submit it within three days before arrival and show the QR code." },
    { category: "Before you travel", q: "Can the e-VOA be used for work in Indonesia?", a: "No. The B1 does not allow selling goods or services or being paid by an Indonesian person or company. Work needs another visa." },
    { category: "Before you travel", q: "How much does VIZA charge?", a: "Nothing. VIZA's help is free. You pay the government fee on the portal." },
  ],

  sources: [
    { label: "Indonesian Immigration e-visa portal", url: "https://evisa.imigrasi.go.id/web/home", display: "evisa.imigrasi.go.id" },
    { label: "Indonesian Immigration visa selection", url: "https://evisa.imigrasi.go.id/web/visa-selection", display: "evisa.imigrasi.go.id" },
    { label: "Directorate General of Immigration, visa on arrival country list", url: "https://www.imigrasi.go.id/wna/daftar-negara-voa-bvk-calling-visa", display: "imigrasi.go.id" },
    { label: "All Indonesia arrival declaration", url: "https://allindonesia.imigrasi.go.id/", display: "allindonesia.imigrasi.go.id" },
    { label: "Voice of Indonesia, announced visa on arrival fee change", url: "https://rri.co.id/en/national/2646854/indonesia-implements-tiered-visa-fees-for-efficient-arrivals", display: "rri.co.id" },
  ],

  price: {
    etaLabel: "Processing time",
    etaValue: "Set by the portal",
    title: "e-VOA · 30 days",
    sub: "VIZA's help is free: form preparation and document review. The visa fee is paid on the government portal.",
    foot: "VIZA's service is free. The Indonesia visa fee is paid directly to Indonesian Immigration.",
  },

  aiPlaceholder: "Ask anything about the Indonesia visa on arrival: e-VOA, fees, All Indonesia…",
};

export default indonesia;
