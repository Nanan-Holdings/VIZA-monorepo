import type { VisaContent } from "./types";

/**
 * Malaysia eVISA — Single Entry Visa (SEV), Tourism.
 *
 * Last fact-checked: 2026-07-05 against official sources:
 *   - malaysiavisa.imi.gov.my (official eVISA portal, MyVISA)
 *   - imi.gov.my (Immigration Department of Malaysia — visa fees, visa
 *     requirement by country, overstay offences s.15(4), Short-Term Social
 *     Visit Pass extension rules)
 *   - kln.gov.my (official eVISA FAQ; High Commission of Malaysia in
 *     Singapore — Entry and Visa Procedure, June 2024)
 *   - imigresen-online.imi.gov.my/mdac (MDAC arrival card portal)
 *   - my.china-embassy.gov.cn (China–Malaysia mutual visa exemption FAQ)
 * Key confirmed facts:
 *   - Single entry, 30-day stay, NO extension allowed; eVISA valid 3 months
 *     from issue. Official processing: 48 hours, working days only.
 *   - Overstay: Immigration Act 1959/63 s.15(4) — fine up to RM 10,000 or
 *     imprisonment up to 5 years, or both; compound settlement RM 3,000.
 *   - The eVISA applies only to the ~30 visa-required nationalities.
 *     Singapore citizens are visa-free (30 days) and MDAC-exempt; PRC
 *     nationals are visa-free 30 days/entry (mutual exemption treaty in
 *     force 17 Jul 2025; 90 days per 180-day cap) but must submit MDAC.
 *   - MDAC mandatory since 1 Jan 2024, free, within 3 days before arrival.
 * Items needing ops confirmation:
 *   1. All-in online eVisa fee: base visa fee RM 20–50 by nationality is
 *      official; the ~RM 105 online processing fee on top is third-party
 *      reported only (portal is login-gated) — confirm displayed total.
 *   2. Applying from Singapore: 2021 official FAQ says the portal blocks
 *      Malaysia/Singapore/Israel; the High Commission's June 2024 PDF says
 *      worldwide except Malaysia/Israel/North Korea. Confirm current rule.
 *   3. Overstay re-entry ban lengths (1–5 years) are from secondary
 *      sources (Fragomen), not imi.gov.my.
 *   4. VOA fee of RM 200 (PRC/India arriving from Singapore) is from
 *      secondary sources; official PDF lists conditions but not the fee.
 *   5. Reported 17 Feb 2026 tightening of PRC 90-in-180 enforcement is
 *      unconfirmed on official pages.
 */
export const malaysia: VisaContent = {
  slug: "malaysia",

  heroTitle: "Malaysia eVISA",
  lede: "The Malaysia eVISA (Single Entry Visa) is a tourist e-visa for the ~30 visa-required nationalities: one entry, a 30-day stay with no extension, valid 3 months from issue. Singapore and China passport holders travel visa-free — VIZA handles whichever path applies to you.",
  heroImage: "/assets/heroes/malaysia.jpg",
  meta: [
    { k: "Type", v: "eVISA (SEV · Tourist)" },
    { k: "Length of stay", v: "30 days" },
    { k: "Validity", v: "3 months" },
    { k: "Entry", v: "Single" },
  ],
  tags: [
    { icon: "bolt", label: "Official processing · 48 hrs" },
    { icon: "shield", label: "On-time guarantee" },
    { icon: "doc", label: "Document pre-check" },
  ],

  overviewTitle: "Malaysia, at a glance",
  overviewSub:
    "The eVISA covers tourism and family visits for up to 30 days per entry. It is issued online by the Immigration Department of Malaysia (Jabatan Imigresen Malaysia) through the official MyVISA portal — the only official application channel since the appointed-agent route in Singapore ended on 31 May 2024.",
  glance: [
    { icon: "globe", k: "Capital", v: "Kuala Lumpur", sub: "UTC +8 (Malaysia Standard Time)" },
    { icon: "clock", k: "Best time to visit", v: "Mar – Oct", sub: "West coast dry season · east coast Nov – Feb" },
    { icon: "currency", k: "Currency", v: "Malaysian Ringgit (MYR)", sub: "SGD 1 ≈ RM 3.30" },
    { icon: "pin", k: "Top destinations", v: "Kuala Lumpur · Penang · Langkawi", sub: "Plus Sabah, Sarawak, and the Cameron Highlands" },
  ],

  processTitle: "How the Malaysia eVISA process works",
  processSub:
    "Submit once. We file directly on the official eVISA portal (malaysiavisa.imi.gov.my), track every stage, and remind you of the MDAC arrival card before you fly.",
  steps: [
    {
      title: "Apply on VIZA",
      body: "Upload your passport bio page, a 35 × 50 mm studio photo, your confirmed return ticket, and accommodation proof. Immigration advises applying at least 2 weeks before departure — we make sure you're inside that window.",
    },
    {
      title: "Your documents are verified",
      body: "Your VIZA consultant checks every field against your passport — any mismatch invalidates the eVisa and the fee is non-refundable — then submits via the official portal. No third-party or agent sites are ever used.",
    },
    {
      title: "Your eVISA gets processed",
      body: "Malaysian Immigration's official processing time is 48 hours, counted in working days only — weekends and public holidays in Malaysia and your country don't count. We monitor the queue and flag any delay early.",
      statusRows: [
        { label: "Application submitted on the official eVISA portal", ts: "15 Aug, 8:30 AM", onTime: true },
        { label: "Application under Immigration review", ts: "15 Aug, 2:00 PM", onTime: true },
        { label: "Awaiting final approval", ts: "In progress" },
      ],
    },
    {
      title: "Get your eVISA on 17 Aug, 10:00 AM",
      body: "Your eVISA arrives in your inbox and the VIZA app — print it or keep the digital copy. We then remind you to submit the free MDAC arrival card within 3 days before you fly.",
      delivered: true,
    },
  ],

  docsTitle: "Required documents",
  docsSub:
    "Your VIZA consultant double-checks each document against the official spec before submission. Re-uploads are unlimited and free.",
  documents: [
    { name: "Passport bio page", sub: "Valid 6+ months from your arrival date in Malaysia · at least 3 blank pages · clear scan" },
    { name: "Studio passport photo", sub: "35 × 50 mm · pure white background, no shadows · taken within 6 months · no edits or borders — scanned or retouched photos are auto-rejected" },
    { name: "Confirmed return or onward ticket", sub: "Flight, train, or bus booking · travelling by private vehicle? A written note of vehicle details is accepted" },
    { name: "Proof of accommodation", sub: "Paid hotel booking — or, if staying with a host: cover letter with the address, the host's Malaysian ID, and their Malaysian contact number" },
    { name: "Birth certificate (children under 12)", sub: "Compulsory upload for every child below 12 years old" },
    { name: "Cover letter (if applicable)", sub: "Short English PDF to the Immigration Officer explaining any missing document or special circumstances" },
  ],

  rejectionTitle: "Why Malaysia eVISA applications get rejected",
  rejectionSub:
    "Malaysian Immigration decides each application on individual merit and can refuse without stating a reason. VIZA screens for every known blocker before you submit.",
  rejectionReasons: [
    { title: "Data mismatch with your passport", body: "Any difference between the application and your travel document invalidates the eVisa. Corrections after payment require a fresh, paid application — fees are non-refundable." },
    { title: "Non-compliant photo", body: "Photos that are edited, bordered, not studio-taken, the wrong size (not 35 × 50 mm), shadowed, or older than 6 months are automatically rejected by the system." },
    { title: "Insufficient passport validity", body: "Less than 6 months' validity from your arrival date, or fewer than 3 blank pages." },
    { title: "Missing supporting documents", body: "No confirmed return or onward ticket, no paid accommodation or host ID and contact, or a missing birth certificate for a child under 12." },
    { title: "Applying from an ineligible location", body: "The portal blocks applications lodged from within Malaysia, and tourists cannot apply while travelling in a third country on a tourist visa." },
    { title: "Unofficial third-party websites", body: "Immigration appoints no agents — applications made through fake or lookalike sites are at your own risk. VIZA files only on the official portal." },
  ],

  entryTitle: "Entry & exit regulations",
  entrySub:
    "Everyone (except Singapore citizens) must submit the free MDAC digital arrival card within 3 days before arrival. At the checkpoint, officers may ask for your passport, eVISA printout or digital copy, boarding pass, return ticket, accommodation proof, and sufficient funds. An eVisa does not guarantee entry — the final decision rests with the border officer.",
  entryExit: [
    { icon: "refresh", k: "Entry", v: "Single", sub: "Re-entry requires a new eVISA application" },
    { icon: "clock", k: "Stay period", v: "30 days", sub: "Counted from arrival date · no extension" },
    { icon: "doc", k: "MDAC arrival card", v: "Within 3 days before arrival", sub: "Free · imigresen-online.imi.gov.my/mdac · mandatory since 1 Jan 2024" },
    { icon: "plane", k: "Autogates", v: "Eligible nationalities", sub: "No passport stamp — track your permitted stay yourself" },
  ],

  extensionTitle: "Visa extension & overstays",
  extensionSub:
    "The official eVISA FAQ is unambiguous: the 30-day stay comes with no extensions allowed, and Malaysian missions abroad cannot extend visas. Only in extreme circumstances — serious illness or accident, or war in your home country — can a Short-Term Social Visit Pass extension be requested in person at an Immigration office using Form IMM.55, at the officer's discretion.",
  extension: [
    { icon: "extend", k: "Extension", v: "Not allowed", sub: "Extreme circumstances only · Form IMM.55, in person, discretionary" },
    { icon: "alert", k: "Overstay penalty", v: "Fine up to RM 10,000", sub: "≈ SGD 3,000 — or imprisonment up to 5 years, or both; compound settlement RM 3,000 ≈ SGD 900 (Immigration Act 1959/63, s.15(4))" },
  ],

  reviews: {
    score: "4.6",
    outOf: "/ 5",
    sub: "Highest rated visa platform · 12,841 reviews",
    platforms: [
      { rating: "4.6", name: "Trustpilot" },
      { rating: "4.7", name: "App Store" },
    ],
    items: [
      {
        initials: "DM",
        name: "Divya M.",
        source: "Trustpilot · 1 week ago",
        title: "Seamless — approved in under 2 days",
        body: "The consultant checked everything and flagged that my photo background wasn't quite right before submission. Got the approval letter well ahead of my trip.",
      },
      {
        initials: "CW",
        name: "Calvin W.",
        source: "App Store · 3 weeks ago",
        title: "Took the stress out of it",
        body: "I wasn't sure which documents Malaysia needed. VIZA gave me a clear list, reviewed my uploads, and the e-Visa came through faster than expected.",
      },
    ],
  },

  faqSub:
    "Can't find an answer? Ask the AI assistant at the bottom of this page or message your VIZA consultant.",
  faq: [
    {
      category: "General information",
      q: "What is the Malaysia eVISA?",
      a: "The eVISA (Single Entry Visa) is an electronic tourist visa issued by the Immigration Department of Malaysia via the official MyVISA portal. It grants one entry with a 30-day stay and is valid 3 months from the date of issue. It applies only to the roughly 30 nationalities that need a visa to visit Malaysia — most visitors, including Singaporeans, don't need one.",
    },
    {
      category: "General information",
      q: "Do Singapore or China passport holders need this visa?",
      a: "No. Singapore citizens enter visa-free with a 30-day pass on arrival, need no eVisa, and are the only nationality exempt from the MDAC arrival card. Chinese (PRC) passport holders are visa-free for 30 days per entry under the China–Malaysia mutual exemption treaty (in force since 17 July 2025, capped at 90 days per 180-day period), but must still submit the MDAC within 3 days before arrival. VIZA checks your exact requirement and handles the MDAC and entry paperwork end-to-end either way.",
    },
    {
      category: "Application process",
      q: "How long does Malaysian Immigration take to process an eVISA?",
      a: "The official processing time is 48 hours — counted in working days only, so weekends and public holidays in Malaysia and your home country don't count. Immigration advises applying at least 2 weeks before departure. VIZA files immediately, monitors the queue, and backs the timeline with an on-time guarantee.",
    },
    {
      category: "Application process",
      q: "How much does the Malaysia eVISA cost?",
      a: "The government visa fee is set by nationality — RM 20 to RM 50 (≈ SGD 6–15; China RM 30). The online portal adds a processing fee, widely reported at around RM 105 (≈ SGD 32). VIZA quotes you a single all-in price at checkout covering government charges, document review, and our on-time guarantee.",
    },
    {
      category: "Refunds, rejections & reapplications",
      q: "What happens if my Malaysia eVISA is refused?",
      a: "Government fees are non-refundable on refusal, and even fixing a typo after payment requires a fresh, paid application. VIZA's processing fee is fully refunded, and your consultant reviews the refusal, corrects the issue, and manages the reapplication.",
    },
  ],

  sources: [
    { label: "Official Malaysia eVISA portal (MyVISA)", url: "https://malaysiavisa.imi.gov.my/", display: "malaysiavisa.imi.gov.my" },
    { label: "Official eVISA FAQ — validity, processing, documents, photo spec", url: "https://www.kln.gov.my/documents/1620528/0/FAQ+eVisa+Malaysia/0cae1cfc-576a-459f-a839-bbeae935bed1?version=1.0", display: "kln.gov.my" },
    { label: "High Commission of Malaysia in Singapore — Entry and Visa Procedure", url: "https://www.kln.gov.my/documents/34253/9682852/ENTRY+AND+VISA+PROCEDURE+TO+MALAYSIA.pdf/25d8fce1-b1b2-419e-aa23-366ef06afcaf", display: "kln.gov.my" },
    { label: "Immigration Department of Malaysia — Visa fees by country", url: "https://www.imi.gov.my/index.php/en/main-services/visa/visa-fees/", display: "imi.gov.my" },
    { label: "Immigration Department of Malaysia — Overstay offences (Immigration Act s.15(4))", url: "https://www.imi.gov.my/index.php/en/main-services/entry-requirement-into-malaysia-en/frequently-committed-offences/", display: "imi.gov.my" },
    { label: "MDAC — Malaysia Digital Arrival Card (official portal)", url: "https://imigresen-online.imi.gov.my/mdac/main", display: "imigresen-online.imi.gov.my" },
    { label: "Chinese Embassy in Malaysia — mutual visa exemption FAQ", url: "https://my.china-embassy.gov.cn/eng/fwzc/lsyw/qz/202508/t20250801_11681401.htm", display: "my.china-embassy.gov.cn" },
  ],

  price: {
    etaLabel: "Apply now, get it by",
    etaValue: "17 Aug 2026, 10:00 AM",
    title: "Tourist eVISA (SEV) · 30-day stay",
    saving: "1 day faster than filing direct",
    sub: "All-inclusive of government fee, document review, and on-time guarantee.",
    foot: "Government fee and VIZA processing are collected together at checkout, backed by our on-time guarantee.",
  },

  aiPlaceholder: "Ask anything about Malaysia eVISAs — eligibility, documents, processing time…",
};

export default malaysia;
