import type { VisaContent } from "./types";

/**
 * Vietnam e-Visa (visa symbol "EV", tourist purpose).
 *
 * Last fact-checked: 2026-07-05 against official sources:
 *   - evisa.gov.vn (canonical portal; also thithucdientu.gov.vn)
 *   - evisa.xuatnhapcanh.gov.vn (official mirror / FAQ)
 *   - prearrival.immigration.gov.vn (mandatory QR pre-arrival form)
 *   - vnembassy-singapore.mofa.gov.vn / mfa.gov.sg (Singapore exemption)
 * Key facts as verified:
 *   - Fee USD 25 single / USD 50 multiple entry (Circular 25/2021/TT-BTC),
 *     paid online, non-refundable on refusal.
 *   - Validity up to 90 days from the entry date chosen at application;
 *     stay bounded by the validity window; single or multiple entry.
 *   - Official processing: 3 working days (3–7 around Tet and public holidays).
 *   - Passport ≥6 months beyond arrival, ≥2 blank pages; photo 4x6 cm JPG,
 *     white background, ≤1 MB; entry only via the checkpoint named on the visa.
 *   - No in-country extension for tourist e-Visas — sponsored fresh visa via the
 *     Immigration Department, or exit and reapply online.
 *   - Overstay fines per Decree 282/2025/ND-CP (effective 15 Dec 2025): from
 *     VND 500,000–2,000,000 under 16 days up to VND 40 million; deportation and
 *     blacklisting possible from 16 days.
 *   - QR Pre-Arrival Form mandatory at SGN since 15 Apr 2026, HAN & PQC from Jun 2026.
 * Items needing ops confirmation:
 *   - evisa.gov.vn could not be fetched directly (TLS error); USD 25/50 and
 *     "3 working days" confirmed via the official mirror + embassy notices —
 *     re-verify the live portal at publication.
 *   - Photo spec (4x6 cm, ≤1 MB JPG) consistent across sources but not quoted
 *     verbatim from the official instruction page.
 *   - Decree 282/2025 fine bands sourced from Việt Nam News (state media);
 *     check exact band boundaries against the decree text.
 *   - Loose-leaf visa practice for PRC nine-dash-line passports is widely
 *     reported but not stated on the official portal.
 *   - SGD conversions use ≈1.28 USD/SGD (mid-2026) — refresh before publish.
 *   - Confirm whether the pre-arrival QR form has expanded beyond SGN/HAN/PQC
 *     (list at prearrival.immigration.gov.vn).
 */
export const vietnam: VisaContent = {
  slug: "vietnam",

  heroTitle: "Vietnam e-Visa",
  lede: "Vietnam's official electronic visa (symbol \"EV\") covers stays of up to 90 days, single or multiple entry, for USD 25–50 in government fees. Open to all nationalities and filed, tracked, and delivered end-to-end by your VIZA consultant.",
  heroImage: "/assets/heroes/vietnam.jpg",
  meta: [
    { k: "Type", v: "e-Visa (EV)" },
    { k: "Length of stay", v: "Up to 90 days" },
    { k: "Validity", v: "Up to 90 days" },
    { k: "Entry", v: "Single or Multiple" },
  ],
  tags: [
    { icon: "bolt", label: "Fast track · in 72 hrs" },
    { icon: "shield", label: "On-time guarantee" },
    { icon: "doc", label: "Minimal documents" },
  ],

  overviewTitle: "Vietnam, at a glance",
  overviewSub:
    "The e-Visa is open to all nationalities and accepted at 40+ designated airports, land crossings, and seaports. You choose your validity window (up to 90 days) and entry checkpoint when you apply — the government fee is USD 25 single entry or USD 50 multiple entry.",
  glance: [
    { icon: "globe", k: "Capital", v: "Hanoi", sub: "UTC +7 (Indochina Time)" },
    { icon: "clock", k: "Best time to visit", v: "Nov – Apr", sub: "Dry season in most regions" },
    { icon: "currency", k: "Currency", v: "Vietnamese Dong (VND)", sub: "SGD 1 ≈ VND 19,500 — check live rates" },
    { icon: "pin", k: "Top destinations", v: "Hanoi · Ho Chi Minh City · Hoi An", sub: "Plus Ha Long Bay, Da Nang, and Phu Quoc" },
  ],

  processTitle: "How the Vietnam e-Visa process works",
  processSub:
    "Submit once. We file directly on the official portal (evisa.gov.vn), track the Immigration Department queue, and notify you the moment your e-Visa is ready — officially 3 working days, 3–7 around Tet and public holidays.",
  steps: [
    {
      title: "Apply on VIZA",
      body: "Upload your passport bio page and a 4x6 cm portrait photo, then set your entry date, your Vietnam address, and — critically — the exact entry checkpoint. Choose single (USD 25) or multiple entry (USD 50) based on your itinerary.",
    },
    {
      title: "Your documents are verified",
      body: "Your VIZA consultant checks every field against your passport's machine-readable zone, confirms your photo meets the official spec, and submits the application to the Vietnam Immigration Department via evisa.gov.vn.",
    },
    {
      title: "Your e-Visa gets processed",
      body: "The Immigration Department's official turnaround is 3 working days from a complete application. We monitor the portal queue and flag any requests for further information before they delay your approval.",
      statusRows: [
        { label: "Application submitted to Vietnam Immigration", ts: "3 Jul, 10:15 AM", onTime: true },
        { label: "Application under review", ts: "4 Jul, 9:00 AM", onTime: true },
        { label: "Awaiting final approval", ts: "In progress" },
      ],
    },
    {
      title: "Get your e-Visa on 6 Jul, 11:00 AM",
      body: "Your e-Visa PDF is sent to your inbox and the VIZA app. Print it or save it to your phone — present it at immigration alongside your passport, at the checkpoint named on the visa.",
      delivered: true,
    },
  ],

  docsTitle: "Required documents",
  docsSub:
    "Your VIZA consultant double-checks each document before submission. Re-uploads are unlimited and free.",
  documents: [
    { name: "Passport bio page", sub: "Valid 6+ months beyond arrival · 2+ blank pages · full page incl. MRZ lines · sharp, uncropped scan" },
    { name: "Portrait photograph", sub: "4x6 cm passport-style JPG · white background · taken within 6 months · no tinted glasses or hat · max ~1 MB" },
    { name: "Travel details", sub: "Entry & exit dates, temporary address in Vietnam (hotel/host), and your exact entry and exit checkpoints" },
    { name: "Trip evidence (carry, not uploaded)", sub: "Onward/return ticket and proof of funds or accommodation — border officers may ask on arrival" },
  ],

  rejectionTitle: "Why Vietnam e-Visa applications get rejected",
  rejectionSub:
    "The Vietnam Immigration Department may refuse for any of the following — and the government fee is not refunded. VIZA flags these before you submit.",
  rejectionReasons: [
    { title: "Blurry or non-compliant uploads", body: "Out-of-focus, glared, cropped, or pixelated passport scans and portraits are the #1 cause of refusal. Coloured or patterned backgrounds, hats, and tinted glasses also fail." },
    { title: "Wrong passport page uploaded", body: "Uploading the passport cover or a partial page instead of the full bio-data page with both MRZ (machine-readable) lines visible." },
    { title: "Data mismatch with the passport MRZ", body: "Name order or spelling, passport number, or date of birth not matching the MRZ character-for-character." },
    { title: "Date errors (DD/MM/YYYY)", body: "Vietnam's form uses day/month/year — a swapped day and month produces the wrong validity window or an outright refusal, with no fee refund." },
    { title: "Insufficient passport validity", body: "A passport with under 6 months' remaining validity, a damaged passport, or an applicant falling under an entry-suspension case (Art. 21, Law on Entry/Exit of Foreigners)." },
    { title: "Wrong entry port after approval", body: "Not an application refusal but a border one: you must enter through the exact checkpoint printed on the e-Visa — a different port means being turned away." },
  ],

  entryTitle: "Entry & exit regulations",
  entrySub:
    "Present your e-Visa PDF alongside your passport at the checkpoint named on the visa — entry via any other port will be refused. Arrivals at Ho Chi Minh City (SGN), Hanoi (HAN), and Phu Quoc (PQC) must also complete Vietnam's digital Pre-Arrival Form and show the QR code at immigration.",
  entryExit: [
    { icon: "pin", k: "Entry port", v: "Fixed at application", sub: "40+ eligible air/land/sea checkpoints — you must use the one on your visa" },
    { icon: "doc", k: "Pre-Arrival Form (QR)", v: "SGN · HAN · PQC", sub: "prearrival.immigration.gov.vn · complete up to 3 days before arrival" },
    { icon: "refresh", k: "Entry", v: "Single or Multiple", sub: "Multiple-entry holders may exit and re-enter freely within the validity window" },
    { icon: "plane", k: "Carry on arrival", v: "Onward ticket + funds proof", sub: "Officers may request them; no biometric enrolment for tourists" },
  ],

  extensionTitle: "Visa extension & overstays",
  extensionSub:
    "Tourist e-Visas cannot be extended in-country as a routine matter. The official route to more time is a sponsored fresh visa via the Immigration Department (offices in Hanoi, HCMC, Da Nang) — or simply exit and apply for a new 90-day e-Visa online (USD 25/50 again). Since 15 Dec 2025, Decree 282/2025/ND-CP sharply raised overstay penalties.",
  extension: [
    { icon: "extend", k: "Extension", v: "Not extendable in-country", sub: "Sponsored new visa via the Immigration Department, or exit and reapply online — agency \"extensions\" are sponsored new visas plus service fees" },
    { icon: "alert", k: "Overstay fine (under 16 days)", v: "VND 500,000 – 2,000,000", sub: "≈ SGD 25 – 100 · Decree 282/2025/ND-CP, effective 15 Dec 2025" },
    { icon: "ban", k: "Overstay of 16+ days", v: "Up to VND 40 million", sub: "≈ SGD 2,000 for 1 year+ · plus possible deportation and entry blacklist" },
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
        initials: "JT",
        name: "Jamie T.",
        source: "Trustpilot · 5 days ago",
        title: "e-Visa in my inbox before my flight",
        body: "Applied three days before travelling — the consultant got it through in time. Clear communication throughout and the PDF was exactly what immigration wanted.",
      },
      {
        initials: "AN",
        name: "Aisha N.",
        source: "App Store · 2 weeks ago",
        title: "Photo issue fixed without any hassle",
        body: "I uploaded a photo that didn't meet the spec and the consultant sorted it immediately. No delays, visa approved on schedule.",
      },
    ],
  },

  faqSub:
    "Can't find an answer? Ask the AI assistant at the bottom of this page or message your VIZA consultant.",
  faq: [
    {
      category: "General information",
      q: "What is the Vietnam e-Visa?",
      a: "The Vietnam e-Visa (visa symbol \"EV\") is the official electronic visa issued by the Vietnam Immigration Department via evisa.gov.vn. Since August 2023 it is open to all nationalities for stays of up to 90 days, single or multiple entry, and is accepted at 40+ designated airports, land crossings, and seaports — you must enter via the checkpoint named on your visa.",
    },
    {
      category: "General information",
      q: "Do Singapore passport holders need a visa for Vietnam?",
      a: "Not for short trips — Singapore ordinary-passport holders enter visa-free for up to 30 days (passport valid 6+ months, onward ticket, no paid work). For stays over 30 days, the exemption cannot be extended at the border: you need the 90-day e-Visa before travel, which VIZA files and tracks end-to-end. Either way, arrivals at SGN, HAN, or Phu Quoc must complete the QR Pre-Arrival Form.",
    },
    {
      category: "General information",
      q: "Do Chinese (PRC) passport holders need a visa?",
      a: "Yes — there is no visa exemption for PRC ordinary passports, so a visa is required for any stay. PRC nationals are fully eligible for the 90-day single or multiple-entry e-Visa (USD 25/50, official processing 3 working days), which VIZA handles end-to-end. Note: holders of biometric passports containing the nine-dash-line map are commonly issued the visa/stamp on a separate loose-leaf sheet at the checkpoint — keep it with your passport until exit.",
    },
    {
      category: "General information",
      q: "Should I choose single or multiple entry?",
      a: "Choose multiple entry (USD 50 government fee) if your itinerary includes side trips to neighbouring countries such as Laos or Cambodia with a return to Vietnam — you can exit and re-enter freely within your validity window. Single entry (USD 25) is sufficient if you enter and exit Vietnam only once.",
    },
    {
      category: "Application process",
      q: "How much does the Vietnam e-Visa cost?",
      a: "The government fee is USD 25 for single entry (≈ SGD 32) or USD 50 for multiple entry (≈ SGD 64), charged in VND at conversion and non-refundable even if the application is refused. VIZA's processing fee is collected together with it at checkout and refunded in full if your visa is refused or we miss the timeline.",
    },
    {
      category: "Application process",
      q: "How long does processing take?",
      a: "The Immigration Department's official turnaround is 3 working days after receiving a complete application and fee. Around peak seasons and Vietnamese public holidays (Tet, 30 Apr – 1 May, 2 Sep) expect 3–7 working days. VIZA monitors your application throughout and backs the timeline with an on-time guarantee — your processing fee is refunded if we're late.",
    },
    {
      category: "Application process",
      q: "Can I apply for multiple travellers together?",
      a: "Yes. Each traveller needs their own e-Visa, but you can add all members of your group in a single VIZA application. Your consultant submits them together so approvals arrive on the same timeline.",
    },
    {
      category: "Refunds, rejections & reapplications",
      q: "What happens if my Vietnam e-Visa is refused?",
      a: "Vietnam Immigration retains the government fee on refusal — it is non-refundable by regulation. VIZA's processing fee is fully refunded. Your consultant will review the refusal reason (most are fixable upload or data-entry issues) and resubmit a corrected application.",
    },
  ],

  sources: [
    { label: "Vietnam National Electronic Visa portal (official)", url: "https://evisa.gov.vn/", display: "evisa.gov.vn" },
    { label: "National Portal on Immigration — e-Visa information and FAQ (official mirror)", url: "https://evisa.xuatnhapcanh.gov.vn/trang-chu-ttdt", display: "evisa.xuatnhapcanh.gov.vn" },
    { label: "Official Pre-Arrival Information form — Vietnam Immigration Department", url: "https://prearrival.immigration.gov.vn/", display: "prearrival.immigration.gov.vn" },
    { label: "Vietnam Embassy in Singapore — visa exemption for Singapore citizens", url: "https://vnembassy-singapore.mofa.gov.vn/", display: "vnembassy-singapore.mofa.gov.vn" },
    { label: "Singapore MFA — Vietnam travel information", url: "https://www.mfa.gov.sg/travelling-overseas/travel-advisories-notices-and-visa-information/vietnam/", display: "mfa.gov.sg" },
  ],

  price: {
    etaLabel: "Apply now, get it by",
    etaValue: "6 Jul 2026, 11:00 AM",
    title: "e-Visa (EV) · up to 90 days",
    saving: "2 days faster than filing direct",
    sub: "All-inclusive of government fee, document review, and on-time guarantee.",
    foot: "Government fee and VIZA processing are collected together at checkout, backed by our on-time guarantee.",
  },

  aiPlaceholder: "Ask anything about Vietnam e-Visas — single vs. multiple entry, processing time, documents…",
};

export default vietnam;
