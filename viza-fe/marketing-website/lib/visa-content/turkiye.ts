import type { DestinationContent } from "./types";

/**
 * Türkiye (Turkey) e-Visa and visa exemptions (e-visa product framed globally, with a section for Singapore
 * residents). Singapore, Malaysian and Chinese ordinary passports do not need a visa. The e-Visa portal is
 * evisa.gov.tr. Checkout behaviour is unchanged (it comes from lib/countries.ts).
 *
 * Checked 25 Nov 2026. The Ministry of Foreign Affairs visa page (mfa.gov.tr) was read directly. The e-Visa
 * portal pages (evisa.gov.tr) returned only a page shell, so eligibility by nationality and the e-Visa terms
 * come from secondary guides (visa-requirements.io, Wego, updated April 2026). Re-open these before a publish:
 *   - https://www.evisa.gov.tr/en/info/who-is-eligible-for-e-visa/
 *   - https://www.mfa.gov.tr/visa-information-for-foreigners.en.mfa
 * Confirmed on mfa.gov.tr: Singapore and Malaysia exempt up to 90 days, China exempt up to 90 days in any 180
 * from 2 Jan 2026, e-Visa for tourism or commerce only, passport valid 60 days beyond the stay, some
 * nationalities need a Schengen, US, UK or Irish visa or residence permit for the e-Visa.
 * Not confirmed on an official page this session (kept general, hedged or left out):
 *   - The e-Visa fee. The portal shows it after you pick a nationality. A table of USD 15 to 80 is reported
 *     from 2014 and is not used
 *   - Indonesia visa free 30 days per entry, Vietnam unconditional e-Visa (30 days, single entry), and India and
 *     the Philippines needing a supporting visa or residence permit (secondary guides only)
 *   - Validity of 180 days from the arrival date entered and the 24 to 48 hour processing range
 *   - Hotel booking and USD 50 per day funds requirement (depends on nationality)
 *   - Overstay fine amounts (only the entry-ban schedule was published on goc.gov.tr in July 2026)
 */
export const turkiye: DestinationContent = {
  slug: "turkiye",

  heroTitle: "Türkiye (Turkey) e-Visa",
  lede: "A Turkey e-visa is an online visa for tourism or business, issued on evisa.gov.tr in minutes for eligible passports. Many travellers do not need one: Singapore and Malaysian passports are visa exempt for up to 90 days, and Chinese passports are exempt for up to 90 days in any 180 since 2 January 2026. Vietnamese passports use the e-visa, and Indian and Philippine passports need a Schengen, US, UK or Irish visa or permit to qualify. This guide covers Türkiye for any traveller, with a section for people who live in Singapore.",
  heroImage: "/assets/heroes/turkiye.jpg",
  meta: [
    { k: "Singapore passport", v: "Visa free, 90 days" },
    { k: "e-Visa", v: "Tourism or commerce" },
    { k: "Apply on", v: "evisa.gov.tr" },
    { k: "Checked", v: "25 Nov 2026" },
  ],
  tags: [
    { icon: "shield", label: "Free VIZA service" },
    { icon: "doc", label: "Document check" },
    { icon: "bolt", label: "Online e-Visa" },
  ],

  page: {
    framing: "global",

    glance: {
      needVisa: "Not for Singapore, Malaysian or Chinese passports. Yes, by e-Visa or embassy visa, for many others",
      govFee: "Set by the e-Visa portal for your nationality. Free for visa-exempt passports",
      processing: "The e-Visa is usually issued within minutes. Embassy visas take longer",
      maxStay: "90 days visa free. The e-Visa gives 30 to 90 days, by nationality",
      checked: "25 November 2026",
    },

    passports: {
      intro: "The passport decides, and the rules differ widely. The table shows what we could confirm for the passports most common in Singapore. The portal shows your own result after you pick your nationality.",
      rows: [
        { passport: "Singapore", status: "Visa free, up to 90 days", note: "The Ministry of Foreign Affairs lists Singapore ordinary passports as visa exempt for up to 90 days. There is no fee, and no arrival card." },
        { passport: "China (PRC)", status: "Visa free, 90 days in 180", note: "Ordinary Chinese passports have been exempt since 2 January 2026, for up to 90 days in any 180." },
        { passport: "Malaysia", status: "Visa free, up to 90 days", note: "The Ministry lists Malaysian ordinary passports as visa exempt for up to 90 days." },
        { passport: "India", status: "e-Visa with a condition", note: "Reported to need a valid Schengen, US, UK or Irish visa or residence permit, for a single entry stay of 30 days. Without one, apply for a visa at a Turkish mission." },
        { passport: "Indonesia", status: "Visa free, 30 days", note: "Reported as visa exempt for 30 days per entry and 90 days in any 180. Confirm with the Ministry." },
        { passport: "Philippines", status: "e-Visa with a condition", note: "Reported to need a valid Schengen, US, UK or Irish visa or residence permit, for a single entry stay of 30 days." },
        { passport: "Vietnam", status: "e-Visa", note: "Reported as an e-Visa without a supporting visa, single entry, 30 days." },
        { passport: "Other passports", status: "Check the portal", note: "Choose your nationality on evisa.gov.tr. It tells you whether you are exempt, eligible for the e-Visa, or need an embassy visa." },
      ],
    },

    visaTypes: {
      intro: "Türkiye issues visas by purpose. The e-Visa is only valid for tourism or commerce.",
      items: [
        { title: "Visa exemption", body: "Singapore, Malaysian and Chinese ordinary passports need nothing but the passport, for up to 90 days. Check the passport validity rule below." },
        { title: "e-Visa, no condition", body: "Some nationalities get the e-Visa with only the form and the fee. It is valid for tourism or commerce, with a stay of 30 to 90 days and a single or multiple entry, by nationality." },
        { title: "e-Visa with a supporting visa", body: "Some nationalities, such as Indian and Philippine passports, need a valid Schengen, US, UK or Irish visa or residence permit. The Ministry lists this condition, and an electronic copy of that visa is not accepted." },
        { title: "Embassy or consulate visa", body: "Work, study and long stays need a visa from a Turkish mission, as do passports that the e-Visa does not cover. Work and study visas have their own documents." },
      ],
    },

    residents: {
      intro: "Your Singapore pass does not change the Türkiye rule, because the passport decides. It matters in two places: the supporting visa for conditional e-Visa passports, and your right to return to Singapore. A Singapore pass is not one of the supporting visas the Ministry lists.",
      rows: [
        { pass: "Employment Pass", body: "An EP holder with a Singapore, Malaysian or Chinese passport needs no visa. An Indian or Philippine passport holder needs a valid Schengen, US, UK or Irish visa or permit for the e-Visa. The Employment Pass does not count." },
        { pass: "S Pass", body: "The same as the Employment Pass. Check your passport on the portal, and keep the S Pass valid for your return." },
        { pass: "Dependant's Pass", body: "Each family member uses their own passport and applies on their own e-Visa. A child with an Indian or Philippine passport needs the same supporting visa." },
        { pass: "Permanent Resident", body: "You travel on the passport of your own country. A Malaysian or Chinese PR is visa exempt, and a Vietnamese PR applies for the e-Visa." },
        { pass: "Singapore citizen", body: "No visa. Carry a passport valid for at least 60 days beyond your stay, and ideally 6 months from arrival." },
        { pass: "Student's Pass", body: "The passport decides. A student with a conditional e-Visa passport needs the supporting visa too. Study in Türkiye needs a different visa from a Turkish mission." },
      ],
    },

    fees: {
      intro: "The e-Visa fee depends on your nationality, and the portal shows it after you select your country. It is lower than the fee for a visa bought on arrival. Visa-exempt passports pay nothing. VIZA's help is free.",
      rows: [
        { item: "Visa exemption", amount: "No fee", note: "Singapore, Malaysian and Chinese ordinary passports for up to 90 days." },
        { item: "e-Visa fee", amount: "Set by the portal", note: "Charged in US dollars by card and shown after you pick a nationality. Third-party sites add their own charges." },
        { item: "Supporting visa", amount: "Not applicable", note: "Indian and Philippine applicants show an existing Schengen, US, UK or Irish visa or permit." },
        { item: "VIZA service", amount: "Free", note: "VIZA charges nothing." },
      ],
      processing: "The Ministry says the e-Visa takes about three minutes to complete online, and guides report approvals within 24 to 48 hours at most. Apply at least 72 hours before you fly. Visas from an embassy take longer. Print the e-Visa and carry it.",
    },

    apply: {
      intro: "The e-Visa form is short. Most trouble comes from picking the wrong site, because copycat sites add charges, or from a missing supporting visa. Choose how much help you want.",
      guided: {
        title: "Guided",
        body: "VIZA's AI confirms whether you need a visa, then walks you through the form on evisa.gov.tr. You submit and pay on the government portal yourself.",
      },
      fullService: {
        title: "Full-service",
        body: "A VIZA consultant checks your passport, supporting visa and dates before you submit, so the e-Visa matches what the airline and the border officer will see.",
      },
      steps: [
        { title: "Start on VIZA", body: "Upload your passport and trip dates. We confirm whether you are exempt, eligible for the e-Visa or need a visa from a mission." },
        { title: "Check the file", body: "We check the passport validity and, where it applies, the Schengen, US, UK or Irish visa or permit." },
        { title: "Submit and pay", body: "Complete the form on evisa.gov.tr and pay the fee shown. Use the official portal only." },
        { title: "Download and print", body: "Download the e-Visa, print it and carry it with your passport." },
      ],
    },

    checklist: {
      intro: "A visa-exempt traveller needs only a valid passport. The e-Visa needs a short list. These are the common items, and the portal is the final rule.",
      groups: [
        {
          applicant: "Everyone",
          items: [
            "Passport valid for at least 60 days beyond the end of your stay, and ideally 6 months from arrival",
            "Return or onward ticket",
            "First night's accommodation address",
            "Evidence of funds, which some nationalities are asked to show at the border",
          ],
        },
        {
          applicant: "e-Visa applicants",
          items: [
            "Email address, for the e-Visa",
            "Credit or debit card for the fee",
            "Name, dates, passport number and address for the form",
            "A printed copy of the e-Visa",
          ],
        },
        {
          applicant: "Indian and Philippine passports",
          items: [
            "A valid Schengen, US, UK or Irish visa or residence permit, in its physical form",
            "Hotel booking and funds, if the portal asks for them",
            "Without the supporting visa, a visa from a Turkish mission",
          ],
        },
        {
          applicant: "Employment Pass, S Pass and Dependant's Pass",
          items: [
            "Valid pass for your return to Singapore",
            "Each family member's own passport and application",
            "Employer letter, if the airline asks about the trip",
          ],
        },
        {
          applicant: "Permanent Resident and student",
          items: [
            "The passport of your own country",
            "Valid re-entry permit or Student's Pass",
            "Supporting visa, for conditional e-Visa passports",
          ],
        },
      ],
    },

    travel: {
      intro: "Türkiye has few entry steps, and no digital arrival card. These are the points that catch visitors out.",
      items: [
        { title: "Passport validity", body: "Turkish law requires the passport to expire at least 60 days beyond the authorised stay. The Ministry advises 6 months from arrival." },
        { title: "Only the official portal", body: "The e-Visa is applied for on evisa.gov.tr. Other sites charge extra for the same visa." },
        { title: "Purpose of the trip", body: "The e-Visa is valid for tourism or commerce only. Work and study need a visa from a Turkish mission." },
        { title: "Staying longer", body: "People who will live, work or study in Türkiye register with the local police on arrival. Overstays lead to fines and entry bans." },
        { title: "Travel advice", body: "The Singapore Ministry of Foreign Affairs publishes a travel page for Türkiye. Read the current version before you book." },
      ],
    },

    reviewed: {
      date: "25 November 2026",
      note: "Checked against the Turkish Ministry of Foreign Affairs. The e-Visa portal showed no rules to our checks, so look at the links under Sources and your nationality on the portal before you pay.",
    },

    related: {
      destinations: ["egypt", "italy", "saudi-arabia", "united-arab-emirates"],
      guides: [
        { label: "Visas for Filipino and Indian residents of Singapore", href: "/guides/visas-filipino-indian-residents-singapore" },
        { label: "e-Visa vs visa on arrival vs embassy visa", href: "/guides/e-visa-vs-visa-on-arrival-vs-embassy-visa" },
        { label: "Türkiye e-Visa portal", href: "https://www.evisa.gov.tr/en/" },
        { label: "VIZA visa news", href: "/blog" },
      ],
    },
  },

  rejectionTitle: "Common rejection reasons",
  rejectionSub: "The e-Visa is decided from the form, so refusals come from details that do not fit. These are the points a consultant checks first.",
  rejectionReasons: [
    { title: "Missing supporting visa", body: "Indian and Philippine passports need a valid Schengen, US, UK or Irish visa or residence permit. An expired or electronic-only copy does not work." },
    { title: "Passport details do not match", body: "A typo in the passport number or dates means the e-Visa does not match your passport at the border." },
    { title: "Passport validity too short", body: "The passport must expire at least 60 days beyond your stay, and 6 months from arrival is safer." },
    { title: "Wrong purpose", body: "The e-Visa covers tourism and commerce only. A work or study trip needs a different visa." },
    { title: "Wrong site", body: "Copycat sites charge extra and can deliver the wrong document. Apply on evisa.gov.tr only." },
  ],

  faqSub: "Can't find your answer? Ask the AI assistant below or message a VIZA consultant.",
  faq: [
    { category: "Do I need a visa", q: "Do Singaporeans need a visa for Türkiye?", a: "No. Singapore passport holders can stay in Türkiye without a visa for up to 90 days. Keep your passport valid for at least 60 days beyond your stay." },
    { category: "Do I need a visa", q: "Do Chinese and Malaysian passport holders in Singapore need a Turkey visa?", a: "No. Chinese ordinary passports have been exempt since 2 January 2026, for up to 90 days in any 180, and Malaysian passports are exempt for up to 90 days." },
    { category: "Do I need a visa", q: "Do Indian passport holders in Singapore need a Turkey e-visa?", a: "Yes. India is reported to be on the conditional list. You need a valid Schengen, US, UK or Irish visa or residence permit, and a Singapore pass does not count. Without one, apply at a Turkish mission." },
    { category: "Do I need a visa", q: "Do Indonesian, Philippine and Vietnamese passport holders need a Turkey visa?", a: "Indonesia is reported as visa free for 30 days. The Philippines is reported as a conditional e-Visa, and Vietnam as an e-Visa without a condition. Confirm your passport on evisa.gov.tr." },
    { category: "Applying", q: "How do I apply for the Turkey e-visa?", a: "Go to evisa.gov.tr, pick your nationality, fill in the form and pay by card. The e-Visa is issued by email. Print it and carry it." },
    { category: "Applying", q: "What is the Turkey e-visa valid for?", a: "Tourism or commerce only. It is valid for 180 days from the arrival date you enter, for most eligible nationalities, with a stay of 30 to 90 days." },
    { category: "Applying", q: "Can I use a Singapore Employment Pass instead of a Schengen visa?", a: "No. The Ministry lists a Schengen, US, UK or Irish visa or residence permit as the supporting document. A Singapore pass is not on that list." },
    { category: "Fees and time", q: "How much is the Turkey e-visa?", a: "The portal sets the fee by nationality and shows it after you select your country. Visa-exempt passports pay nothing. Third-party sites add their own charges." },
    { category: "Fees and time", q: "How long does the Turkey e-visa take?", a: "The Ministry says the online form takes about three minutes. Approval is usually quick, and guides report up to 48 hours. Apply at least 72 hours ahead." },
    { category: "Fees and time", q: "How long can I stay in Türkiye?", a: "Up to 90 days when you are visa exempt. The e-Visa gives 30 to 90 days, by nationality." },
    { category: "Rejections", q: "What if my Turkey e-visa is refused?", a: "Check the passport details and the supporting visa first. A consultant can review the file, and you can apply again once it is fixed. A mission visa is the next route." },
    { category: "Before you travel", q: "How long must my passport be valid for Türkiye?", a: "Turkish law requires the passport to expire at least 60 days beyond your authorised stay. The Ministry advises 6 months from arrival." },
    { category: "Before you travel", q: "How much does VIZA charge?", a: "Nothing. VIZA's help is free. You pay the e-Visa fee on the government portal." },
  ],

  sources: [
    { label: "Ministry of Foreign Affairs of Türkiye, visa information for foreigners", url: "https://www.mfa.gov.tr/visa-information-for-foreigners.en.mfa", display: "mfa.gov.tr" },
    { label: "Türkiye e-Visa portal", url: "https://www.evisa.gov.tr/en/", display: "evisa.gov.tr" },
    { label: "Türkiye e-Visa portal, who is eligible", url: "https://www.evisa.gov.tr/en/info/who-is-eligible-for-e-visa/", display: "evisa.gov.tr" },
    { label: "Presidency of Migration Management", url: "https://en.goc.gov.tr/", display: "goc.gov.tr" },
    { label: "Singapore Ministry of Foreign Affairs, travel advisories", url: "https://www.mfa.gov.sg/travelling-overseas/travel-advisories-notices-and-visa-information/", display: "mfa.gov.sg" },
  ],

  price: {
    etaLabel: "Processing time",
    etaValue: "Usually within minutes",
    title: "Türkiye e-Visa · tourism or commerce",
    sub: "VIZA's help is free: eligibility check, form preparation and document review. The e-Visa fee is paid on the government portal.",
    foot: "VIZA's service is free. The Türkiye e-Visa fee is paid directly on the government portal.",
  },

  aiPlaceholder: "Ask anything about the Turkey e-visa: who needs one, fees, Singapore residents…",
};

export default turkiye;
