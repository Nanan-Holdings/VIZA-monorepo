import { COMPANY } from "./company";
import { facts, note, p, ul, type LegalDoc, type LegalSlug } from "./types";

const MAIL = `[${COMPANY.email}](mailto:${COMPANY.email})`;
const who = (lead: string) => [
  p(lead),
  facts(
    ["Singapore UEN", COMPANY.uen],
    ["Registered Address", COMPANY.address],
    ["Contact", `${COMPANY.email} | ${COMPANY.phone}`],
  ),
  p(`VIZA is a [Kelin Studio](${COMPANY.url}) venture.`),
];

const terms: LegalDoc = {
  title: "Terms & Conditions",
  lede: "The agreement between you and VIZA when you use our visa application service.",
  sections: [
    {
      id: "who-we-are",
      heading: "1. Who we are",
      blocks: who(`VIZA ("Service") is operated by ${COMPANY.legalName} ("we", "us", "our"), a Singapore business.`),
    },
    {
      id: "service",
      heading: "2. The Service",
      blocks: [
        p("VIZA helps people living in Singapore prepare, check and file visa applications. There are two ways to apply:"),
        ul(
          "Guided: VIZA's AI walks you through the form and a checklist for your situation, and you answer every question yourself.",
          "Full-service: a consultant prepares the answers with you and checks your documents.",
        ),
        p("In both, we:"),
        ul(
          "Check the documents you upload for completeness.",
          "Read your passport and forms to fill in the application.",
          "File the application with the issuing authority.",
          "Track the application and tell you about decisions.",
        ),
        note("VIZA is a private service. We are not a government body, an embassy or a law firm, and we do not give immigration legal advice. Where a decision turns on legal interpretation, we will say so and suggest you speak to a lawyer."),
      ],
    },
    {
      id: "accounts",
      heading: "3. Accounts",
      blocks: [
        ul(
          "You must be at least 18 to open an account in your own name.",
          "Keep your sign-in details to yourself. You are responsible for everything done under your account.",
          `Email ${MAIL} straight away if you think someone else has used your account.`,
          "We may ask you to confirm who you are when the law requires it or to prevent fraud.",
        ),
        p("If you use VIZA for a company or for another person, you confirm that you may act for them."),
      ],
    },
    {
      id: "your-part",
      heading: "4. What you provide",
      blocks: [
        ul(
          "Accurate information. A wrong answer can invalidate a visa and carry penalties under the destination's law. We rely on what you give us.",
          "Genuine documents. Forged or altered documents are rejected and may be reported to the authorities.",
          "Quick replies. Some authorities ask for more information or an interview at short notice, and a missed deadline can end an application.",
          "Compliance with the destination's laws. Our help ends when the visa is issued. What happens at the border or during your stay is between you and the destination.",
        ),
      ],
    },
    {
      id: "fees",
      heading: "5. Fees",
      blocks: [
        ul(
          "VIZA service fee: free, for Guided and Full-service. There are no paid upgrades and applications do not need a payment to VIZA.",
          "Government fee: set by the issuing authority. Where one applies, we show it before you start and you pay it directly to that authority. VIZA does not collect it or pay it for you.",
          "Other providers, such as appointment centres, couriers or translators, charge their own fees under their own terms.",
        ),
        p("Refunds are covered in our [refunds policy](/refunds)."),
      ],
    },
    {
      id: "decisions",
      heading: "6. Government decisions",
      blocks: [
        p("VIZA is not a government body and cannot guarantee an outcome. The issuing authority makes every decision, and a visa can be refused even when the application is complete and correct."),
        p("If a refusal comes from a mistake in how we filed your application, we will help you file again at no cost."),
        p("Processing times are set by the issuing authority. Any date we show is an estimate, not a promise."),
      ],
    },
    {
      id: "ai",
      heading: "7. AI and your data",
      blocks: [
        p("We use AI to read your documents, fill in forms and check that your answers agree with each other. Our consultants review applications. AI can make mistakes, so check every answer before we file. You stay responsible for the information in your application."),
        p("How we handle your personal data, including passport data and AI processing, is set out in our [privacy policy](/legal/privacy)."),
      ],
    },
    {
      id: "prohibited",
      heading: "8. Prohibited use",
      blocks: [
        p("You may not use VIZA to:"),
        ul(
          "Give false, misleading or fraudulent information.",
          "Apply for another person without their clear consent.",
          "Get around immigration controls, sanctions or travel bans.",
          "Scrape the site or automate access in a way that disrupts the Service.",
          "Resell the Service or build it into another offer without our written agreement.",
        ),
        p("Breaking this section is grounds for ending your access, and we may report it to the authorities."),
      ],
    },
    {
      id: "ip",
      heading: "9. Intellectual property",
      blocks: [
        p(`The VIZA platform, brand, designs and software belong to ${COMPANY.legalName} or its licensors. Using the Service does not give you any rights in them.`),
        p("What you upload stays yours. You give us a limited licence to process it and file it with the issuing authority, only to deliver your application."),
      ],
    },
    {
      id: "liability",
      heading: "10. Liability",
      blocks: [
        p("The Service is provided as available. To the fullest extent the law allows, our total liability for any claim connected with the Service is limited to SGD 500, and we are not liable for indirect or consequential loss, including lost flights, accommodation or business."),
        p("Nothing in these terms limits liability for fraud, for death or personal injury caused by negligence, or for anything else the law does not allow us to limit."),
      ],
    },
    {
      id: "termination",
      heading: "11. Suspension and termination",
      blocks: [
        p("You can close your account at any time from your account settings."),
        p("We may suspend or end access if you break these terms or the law, if we reasonably suspect fraud, identity theft or a sanctions breach, or if continuing would put us at legal or regulatory risk. Where we can, we finish applications already in progress."),
      ],
    },
    {
      id: "law",
      heading: "12. Governing law",
      blocks: [
        p("These terms are governed by the laws of Singapore. The courts of Singapore have jurisdiction over any dispute about them."),
      ],
    },
    {
      id: "changes",
      heading: "13. Changes to these terms",
      blocks: [
        p("We may update these terms when the Service or the rules change. For material changes we email you at least 14 days before they apply. If you keep using the Service after that date, you accept the updated terms."),
      ],
    },
    {
      id: "contact",
      heading: "14. Contact",
      blocks: [
        p(`Questions about these terms: ${MAIL} or ${COMPANY.phone}.`),
        p(`${COMPANY.legalName}, ${COMPANY.address}.`),
      ],
    },
  ],
};

const privacy: LegalDoc = {
  title: "Privacy Policy",
  lede: "What VIZA collects when you apply for a visa, why, who sees it and how long we keep it.",
  sections: [
    {
      id: "who-we-are",
      heading: "1. Who we are",
      blocks: who(`VIZA ("Service") is operated by ${COMPANY.legalName} ("we", "us", "our"), a Singapore business. We are responsible for the personal data described in this policy, and we handle it under Singapore's Personal Data Protection Act 2012 (PDPA).`),
    },
    {
      id: "scope",
      heading: "2. Scope",
      blocks: [
        p("This policy covers viza.it.com, the VIZA client portal and your conversations with our consultants by email, WhatsApp, WeChat or phone. It applies to visa applicants, family members on a joint application and people who only browse."),
      ],
    },
    {
      id: "collect",
      heading: "3. Data we collect",
      blocks: [
        p("Only what is needed to file a visa correctly. The issuing authority decides most of the fields, and we do not ask for more than the form needs."),
        ul(
          "Identity: full name, date of birth, nationality, place of birth, passport number and expiry, and an image of your passport.",
          "Contact: email, phone number and address.",
          "Travel: destination, dates, purpose of visit, accommodation and onward travel where the form asks for them.",
          "Supporting documents: photographs, employment letters, bank statements, invitation letters and whatever else the authority requires.",
          "Device and usage data: browser, IP address and basic usage events, for security and to see how the site is used.",
          "From others: status updates and decision letters from the issuing authority, and identity checks where an authority requires them.",
        ),
      ],
    },
    {
      id: "why",
      heading: "4. Why we use it",
      blocks: [
        ul(
          "To prepare, check and file your visa application, and to tell you what happens next.",
          "To meet legal duties, such as fraud prevention and record keeping.",
          "To keep accounts secure, spot abuse and improve our document checks, using data combined across users.",
          "To send marketing emails or optional offers, only if you agree.",
        ),
        note("We never sell personal data, never share it with advertisers and never use the contents of your application to train any AI model, ours or anyone else's."),
      ],
    },
    {
      id: "ai",
      heading: "5. AI processing",
      blocks: [
        p("VIZA uses AI to read passport and document images, fill in forms and check that your answers agree with each other. Our consultants review applications, and you check every answer before it is filed."),
        p("AI processing is part of preparing your application. It does not decide whether you get a visa. That decision is always made by the issuing authority."),
      ],
    },
    {
      id: "sharing",
      heading: "6. Who we share it with",
      blocks: [
        ul(
          "The issuing authority. Your application goes to them by design, and they receive the fields their form requires.",
          "Identity verification providers, where an authority requires a check. They may use the data only for that check.",
          "Hosting, storage and email providers that run our systems under written agreements.",
          "Others where the law, a court order or the defence of a legal claim requires it.",
        ),
      ],
    },
    {
      id: "retention",
      heading: "7. How long we keep it",
      blocks: [
        ul(
          "Application documents, such as passport images, photos and bank statements: kept while your application is processed and for 30 days after the decision so you can download it. We never keep them longer than 90 days.",
          "Account profile: kept while your account is open. When you close it, we delete it within 60 days unless the law requires longer.",
          "Marketing data: removed within 30 days of you unsubscribing.",
          "Security logs: kept for 12 months.",
          "Order and payment records from before 15 September 2026, when VIZA stopped taking payments: kept for 7 years for tax and finance rules in Singapore.",
        ),
      ],
    },
    {
      id: "overseas",
      heading: "8. Sending data overseas",
      blocks: [
        p("Our systems run on infrastructure in Singapore, the United States and the European Union. When data leaves Singapore, we make sure it is protected to a standard comparable to the PDPA."),
        p("When you apply, the destination authority receives your application under its own national laws."),
      ],
    },
    {
      id: "rights",
      heading: "9. Your rights",
      blocks: [
        p("Under the PDPA you can:"),
        ul(
          "Ask for a copy of the personal data we hold about you.",
          "Ask us to correct data that is wrong.",
          "Withdraw your consent at any time, where we rely on it.",
        ),
        p("We also act on requests to delete your data or to receive it in a common format, within the retention limits above. We reply within 30 days. Complaints can go to the Personal Data Protection Commission at [pdpc.gov.sg](https://www.pdpc.gov.sg), and we would like the chance to put things right first."),
      ],
    },
    {
      id: "security",
      heading: "10. Security",
      blocks: [
        p("Applicant data is encrypted in transit with TLS 1.3 and at rest with AES-256. Access inside VIZA is limited by role and every read is logged. More detail is on our [security page](/security), including how to report a vulnerability."),
      ],
    },
    {
      id: "cookies",
      heading: "11. Cookies and analytics",
      blocks: [
        ul(
          "Strictly necessary: your sign-in session and language. These cannot be switched off.",
          "Functional: remembers your saved details and drafts.",
          "Analytics: shows how pages are used. You can turn it off in the cookie banner.",
          "Marketing: set only after you opt in.",
        ),
        p("We do not use third-party advertising trackers and we do not build profiles of you across other sites."),
      ],
    },
    {
      id: "children",
      heading: "12. Children",
      blocks: [
        p("VIZA is not aimed at children under 13. Where a child's visa is part of a family application, a parent or legal guardian who holds the account provides the data. We use it only for the visa application."),
      ],
    },
    {
      id: "changes",
      heading: "13. Changes to this policy",
      blocks: [
        p("For material changes we email account holders at least 14 days before the new version applies. Earlier versions are available on request."),
      ],
    },
    {
      id: "contact",
      heading: "14. Contact",
      blocks: [
        p(`Privacy requests, questions and complaints go to the same place: ${MAIL} or ${COMPANY.phone}. This is also the contact for our Data Protection Officer.`),
        p(`${COMPANY.legalName}, ${COMPANY.address}.`),
      ],
    },
  ],
};

const refunds: LegalDoc = {
  title: "Refunds Policy",
  lede: "VIZA does not charge for its service, so there is nothing to refund. Here is what that means for fees.",
  sections: [
    {
      id: "overview",
      heading: "1. Overview",
      blocks: [
        p(`VIZA is operated by ${COMPANY.legalName}. Guided and Full-service are both free, and an application does not need a payment to VIZA.`),
      ],
    },
    {
      id: "service",
      heading: "2. The VIZA service",
      blocks: [
        p("Because we do not charge for preparing, checking or tracking your application, there is no VIZA fee to refund."),
      ],
    },
    {
      id: "government",
      heading: "3. Government fees",
      blocks: [
        p("Where a destination charges a visa fee, you pay it directly to the issuing authority. VIZA does not collect it, so VIZA cannot refund it. Whether a government fee can be refunded is decided by the authority under its own rules, so read those rules before you pay."),
      ],
    },
    {
      id: "third-parties",
      heading: "4. Other providers",
      blocks: [
        p("Appointment centres, couriers, translators and similar providers charge their own fees. Refunds follow the terms of the provider you paid."),
      ],
    },
    {
      id: "errors",
      heading: "5. If we make a mistake",
      blocks: [
        p("If a refusal comes from a mistake in how we filed your application, we will help you file again at no cost. See [section 6 of our terms](/legal/terms#decisions)."),
      ],
    },
    {
      id: "earlier",
      heading: "6. Payments before 15 September 2026",
      blocks: [
        p(`VIZA stopped taking payments on 15 September 2026. If you paid VIZA before that date and have a question about the payment, email ${MAIL} with your name and the email address on your account.`),
      ],
    },
    {
      id: "contact",
      heading: "7. Contact",
      blocks: [p(`${MAIL} or ${COMPANY.phone}.`)],
    },
  ],
};

const businessInformation: LegalDoc = {
  title: "Business Information",
  lede: "Who operates VIZA and how to reach us.",
  sections: [
    {
      id: "company",
      heading: "Company details",
      blocks: [
        p(`VIZA is operated by ${COMPANY.legalName} (Singapore). VIZA is a [Kelin Studio](${COMPANY.url}) venture.`),
        facts(
          ["Operated by", COMPANY.legalName],
          ["Service", "VIZA, visa application help for people living in Singapore"],
          ["Singapore UEN", COMPANY.uen],
          ["Registered Address", COMPANY.address],
          ["Phone", COMPANY.phone],
          ["Email", COMPANY.email],
          ["Governing law", "Singapore"],
        ),
        p("Read our [terms](/legal/terms), [privacy policy](/legal/privacy) and [refunds policy](/refunds)."),
      ],
    },
  ],
};

export const en: Record<LegalSlug, LegalDoc> = { terms, privacy, refunds, "business-information": businessInformation };
