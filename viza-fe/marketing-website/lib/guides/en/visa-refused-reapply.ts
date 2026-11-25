import type { GuideContent } from "../types";

/**
 * Guide: visa refused, why it happens and how to reapply (people living in Singapore).
 *
 * Checked 25 Nov 2026. Sources opened and read: the EU Annex VI refusal form (EEAS copy), the EU Commission
 * "applying for a Schengen visa" page and VIS page, the German Embassy Singapore visa page, the Spanish Embassy
 * Singapore Schengen page, the Italian Embassy Singapore tourist checklist, the US Foreign Affairs Manual 9 FAM
 * 403.10, the UK Home Office Visit guidance v18.0 (published 8 Oct 2026), gov.uk administrative review and
 * Part Suitability deception guidance, the gov.uk 2013 family visit appeal notice, IRCC Help Centre answers 1485
 * and 422, the IRCC reconsideration-after-refusal manual page and the Canada.ca inadmissibility page. The Czech
 * Foreign Ministry refusal page was also read as an example of a 15 day appeal rule (not quoted in the copy).
 * Keyword note: docs/seo/keywords.csv has no refusal keywords. Targets come from the brief
 * (schengen visa rejected, visa refused reapply, us visa 214(b)) plus csv terms (schengen visa singapore,
 * us visa singapore, uk visa singapore, canada visa singapore, japan visa singapore, australia visa singapore).
 *
 * Not confirmed on an official page this session (the copy hedges or leaves these out):
 *   - travel.state.gov visa denials and administrative processing pages returned HTTP 403. 214(b) and 221(g)
 *     facts rest on 9 FAM 403.10 (read) and search summaries of travel.state.gov. The one year window for
 *     221(g) documents and the no new fee rule inside that window are NOT stated in the copy.
 *   - the exact wording of the DS-160 refusal question and the Schengen, UK, Japan, Australia and Canada form
 *     questions. The copy says "answer what the form asks" and does not quote any form.
 *   - MOFA Japan FAQ (HTTP 403): the six month rule for the same purpose and the humanitarian exception come
 *     from search snippets of the MOFA and embassy FAQ pages. Reasons not disclosed matches lib/visa-content/japan.ts.
 *   - Australia: whether a Visitor visa refused while outside Australia can go to the ART. Home Affairs and the
 *     ART page were not readable. The copy only says the refusal letter states review rights. The PIC 4020
 *     false information bar (about 3 years) is from a search summary, so the copy gives no period.
 *   - Canada: the Federal Court judicial review deadline (search summaries gave 15 to 60 days) and the length
 *     of the misrepresentation ban (5 years under IRPA s.40 is not stated on the Canada.ca page read). No period given.
 *   - UK: whether visitor visas are formally outside Appendix AR (gov.uk review page does not name visitor visas,
 *     the Home Office guidance only describes "no right of appeal" and "human rights appeal" templates). The copy
 *     points to the refusal notice for review rights.
 *   - France and Italy appeal bodies and deadlines for refusals decided in Singapore (not found). The copy says
 *     to read the appeal paragraph on the notice.
 *   - the 2019 revision of Annex VI (the EEAS copy is the older layout), so the copy gives no box numbers.
 *   - UK 10 year ban applying to visitor applications specifically (guidance page does not address visitors).
 *   - Singapore specific pass validity rules beyond the Italian checklist (valid IC or FIN card, valid
 *     Re-Entry Permit for PRs, passport valid 3 months after return).
 */
const guide: GuideContent = {
  title: "Visa Refused: Why It Happens and How to Reapply | VIZA",
  description: "Visa refused or Schengen visa rejected? See why refusals happen, how to read the letter, your appeal options, when to reapply and what to tell future forms.",
  h1: "Visa refused: why it happens and how to reapply",
  lead: "A refusal tells you which rule the officer applied, and that is where a stronger second application starts. This guide covers the usual grounds for a Schengen visa rejected notice, a US visa 214(b) refusal, and UK, Japan, Australia and Canada refusals, plus what you can appeal, when to reapply and how to answer the question about earlier refusals on future forms. It is written for people living in Singapore, and it is general information, not legal advice.",
  glance: [
    { k: "First step", v: "Read the letter. It names the ground or the section of law." },
    { k: "Appeals", v: "Schengen has one under each country's own rules. The US has none. UK, Japan, Australia and Canada depend on the letter." },
    { k: "Reapplying", v: "Change what the officer doubted first. The same file usually gets the same answer." },
    { k: "Future forms", v: "Disclose every earlier refusal when a form asks. Leaving it out can cost you far more than the refusal." },
    { k: "No guarantee", v: "No document set and no agent can guarantee a visa. Each authority decides on its own." },
  ],
  sections: [
    {
      id: "why-refused",
      heading: "Why visas are refused",
      body: [
        "Most refusals for tourists come down to one question: does the officer believe your trip is what you say it is, and that you will go home when it ends? Funds, ties, itinerary and history are the evidence. The table shows how each authority gives its reason.",
      ],
      table: {
        head: ["Authority", "How the reason is given", "Grounds that come up most"],
        rows: [
          ["Schengen states", "Numbered reasons on a standard EU refusal form", "Purpose of the stay not justified, not enough money, no valid travel medical insurance, unreliable information, intention to leave in time not established"],
          ["United States", "A section of US law, usually 214(b) or 221(g)", "214(b): the officer is not persuaded you will return home. 221(g): papers missing or more checks needed"],
          ["United Kingdom", "A refusal notice with the reasons", "Not satisfied you are a genuine visitor, funds, ties to your home country, travel history, earlier deception"],
          ["Japan", "No reason is given", "Japan does not publish the reason for a refusal"],
          ["Australia", "A letter from Home Affairs", "Not a genuine visitor, unclear or missing documents, false or misleading information, health or character concerns"],
          ["Canada", "A refusal letter with the reason", "Officer not satisfied you will leave, purpose or funds unclear, incomplete application, incorrect information"],
        ],
      },
    },
    {
      id: "read-letter",
      heading: "How to read a refusal letter",
      body: [
        "Read the whole letter before you do anything else. It usually tells you four things: the decision, the ground or the section of law, whether you can appeal or ask for review, and any deadline. Deadlines can be short, so note them the same day.",
        "Match each stated ground to a piece of evidence you can change. A funds ground points to your bank statements. A purpose ground points to your itinerary and bookings. A ground about leaving points to your job, family and home in Singapore.",
      ],
      list: [
        "Write down the exact ground, section or box that was ticked.",
        "Write down any appeal or review deadline and where to send it.",
        "If the letter gives no reason, treat the weakest area of your file as the cause and strengthen all of them.",
      ],
    },
    {
      id: "schengen-rejected",
      heading: "Schengen visa rejected",
      body: [
        "A Schengen refusal comes on a standard EU form. The form lists the reasons as boxes. They include a false or forged travel document, no justification for the purpose and conditions of the stay, no proof of sufficient means of subsistence, 90 days already used in the last 180, an alert in the Schengen Information System, a threat to public policy or security, no valid travel medical insurance, unreliable information about the purpose of the stay, and that your intention to leave before the visa expires could not be established.",
        "The form also says you may appeal as provided by national law. Each country must state the authority, the procedure and the time limit on its own notice, so the answer depends on which country refused you. The [Schengen visa checklist guide](/guides/schengen-visa-checklist-singapore) helps you rebuild the file.",
        "Two examples from embassies in Singapore show how different the rules are. The Spanish embassy says you can ask the consular office to reconsider within one month of the day after you receive the refusal, and you can then go to judicial review in Madrid within two months. The German embassy says the remonstration procedure was abolished on 1 July 2025, and a refusal can be challenged at the Berlin administrative court, in German and with court fees. It also says you can submit a new application at any time.",
        "The [France](/visa/france) and [Italy](/visa/italy) pages cover the two most common destinations. For appeals against a French or Italian refusal, follow the appeal paragraph on your notice. We did not find a deadline for those two on an official page.",
        "Schengen refusals are recorded in the EU's Visa Information System, and the EU says data is kept there for five years from the date of a negative decision.",
      ],
    },
    {
      id: "us-214b",
      heading: "US visa 214(b) and 221(g)",
      body: [
        "Section 214(b) is the usual ground for a B1/B2 visitor visa refusal. The law presumes every applicant intends to immigrate until the applicant shows otherwise. A 214(b) refusal means the officer was not persuaded you will return home after the trip. The State Department manual says an officer must cite the section and, for 214(b), explain that the applicant has not persuaded them they will return.",
        "A 214(b) refusal is not a permanent bar. The manual says a previous refusal does not stop a later visa if your circumstances have changed, and the refusal letters say you may reapply at any time with a new form, photo and visa fee, and a new interview. There is no formal appeal and no waiver for 214(b).",
        "Section 221(g) is different. It usually means the officer needs a document or more checks before deciding. The letter or the Embassy tells you what to send and how long you have, so follow that exactly and reply quickly. In the State Department's own manual a 221(g) refusal is legally a refusal even if it is later overcome, which matters for the form question below.",
        "The [US visa interview guide](/guides/us-visa-interview-singapore) covers preparation, and the [US visa from Singapore](/visa/united-states) page covers the application and fee.",
      ],
    },
    {
      id: "appeal-or-reapply",
      heading: "Appeal, review or reapply",
      body: [
        "The route depends on the authority. The table lists what each one says. Your letter is the final word on your own case.",
        "A lawyer can tell you whether a review or court route fits your facts. Those routes check whether the decision was lawful or fair. A fresh application is where new evidence goes.",
      ],
      table: {
        head: ["Destination", "Appeal or review", "Reapplying"],
        rows: [
          ["[Schengen](/visa/schengen)", "Yes, under the refusing country's national law, with its own authority and deadline on the notice", "Allowed. The German embassy says at any time. Fix the stated ground first"],
          ["[United States](/visa/united-states)", "No formal appeal for a visitor visa refusal", "Allowed at any time with a new form, photo, fee and interview. Show what has changed"],
          ["[United Kingdom](/visa/united-kingdom)", "No right of appeal for most visit visa refusals, except on human rights grounds. The gov.uk review page (£80, 28 days) does not name visitor visas, so check the notice", "Allowed as often as you like with extra information, per gov.uk. Address each reason"],
          ["[Japan](/visa/japan)", "No appeal route is stated. Reasons are not given", "Reapplying for the same purpose within six months is not normally accepted, per Japan's Foreign Ministry FAQ. Check the embassy"],
          ["[Australia](/visa/australia)", "The letter states any review right and deadline", "A new application is the usual route where the letter gives no review right. Check you chose the right product in the [ETA or visa guide](/guides/eta-vs-visa)"],
          ["[Canada](/visa/canada)", "No formal appeal. Judicial review at the Federal Court has a short deadline. IRCC treats reconsideration as an exception, and disagreeing with the decision is not enough", "Only worth it if your situation changed or you have new information on the stated reasons. IRCC says a representative does not raise the chance of approval"],
        ],
      },
    },
    {
      id: "refused-before",
      heading: "Earlier refusals on forms",
      body: [
        "Disclosure is mandatory. When a form asks about earlier refusals, answer yes and give the details it asks for, even if the refusal was years ago, in another country, for a different purpose or later overcome.",
        "Leaving out a refusal is treated far more seriously than the refusal itself. UK guidance sets a 10 year refusal period for applications refused because of deception, and lists non-disclosure of earlier refusals as an example of failing to disclose a relevant fact. IRCC lists misrepresentation, which includes withholding information, as a reason a person can be inadmissible to Canada. The US State Department warns that false or misleading answers can lead to a permanent refusal.",
        "A US 221(g) can count as a refusal under the State Department's manual. Read the wording of each form and answer exactly what it asks. If you are unsure whether a withdrawn application or an administrative processing case counts, ask a lawyer before you submit.",
        "Where the form gives space, state what happened and what has changed since, and attach new evidence.",
      ],
    },
    {
      id: "fix-weaknesses",
      heading: "Fixing the weak points",
      body: [
        "Rebuild the application around the ground you were given, not around a longer document pile. Here is what to check.",
      ],
      list: [
        "Funds: show steady income and savings that cover the trip and the return. UK guidance says there is no set level, so officers judge the whole picture.",
        "Ties: bring an employment letter with your position, start date and approved leave, plus proof of your Singapore home, family, studies or business. Show your pass and its expiry.",
        "Itinerary: make every day clear and consistent with your bookings. For Schengen, an itinerary that does not explain the days is a common weakness.",
        "Travel history: attach earlier visas and stamps. A record of returning on time helps.",
        "Wrong office: apply to the country that matches your main destination, and book at the visa centre that serves it. For Schengen, apply to the country where you spend the most days, or the first country you enter if the stays are equal.",
        "Consistency: dates, names, income and addresses must match across the form, letters and statements.",
        "Photo and forms: use the right photo and complete every field. See the [visa photo guide](/guides/visa-photo-requirements).",
      ],
    },
    {
      id: "singapore-residents",
      heading: "If you live in Singapore",
      body: [
        "Singapore residents usually apply where they live. The EU page says you apply at the consulate with territorial responsibility for the country where you are legally resident, and the US State Department also points residents to apply where they live. That means a Singapore visa centre or embassy for most of you.",
        "Keep your Singapore status clean and valid. The Italian checklist asks for your valid Singapore IC or FIN card, a valid Re-Entry Permit for permanent residents, and a passport valid for at least three months after your return. A pass close to expiry is a weak point on its own, so renew first where you can. If your job, pass or employer changes after a refusal, include the new documents in your next file.",
        "See [visa-free countries for a Singapore passport](/guides/visa-free-countries-singapore-passport). If you hold a Chinese, Indian or Philippine passport and live here, see [visas for Chinese passport holders in Singapore](/guides/visas-chinese-passport-holders-singapore) and [visas for Filipino and Indian residents](/guides/visas-filipino-indian-residents-singapore).",
        "Consult a lawyer when a refusal involves a possible ban, an allegation of false information, a criminal or immigration record, or a court or review deadline.",
      ],
    },
    {
      id: "next-steps",
      heading: "Next steps",
      body: [
        "Read your letter, note the deadline and the ground, and decide between an appeal or review and a stronger new application.",
        "When you are ready to reapply, open the destination page for the rules and fees that apply to your pass: [Schengen](/visa/schengen), [United States](/visa/united-states), [United Kingdom](/visa/united-kingdom), [Japan](/visa/japan), [Australia](/visa/australia) or [Canada](/visa/canada). VIZA's service is free and helps you check your documents before you submit. Government and visa centre fees are paid directly to the authority and are separate. No service can promise approval.",
      ],
    },
  ],
  faq: [
    {
      q: "Why was my Schengen visa rejected?",
      a: "The refusal form lists the reasons. The common ones for tourists are an unclear purpose or itinerary, not enough funds, no valid travel medical insurance, unreliable information and doubt that you will leave in time. Read the boxes on your form and fix those points first.",
    },
    {
      q: "Can I appeal a Schengen visa rejection from Singapore?",
      a: "Yes, under the national law of the country that refused you. Each country sets the authority and the deadline on the notice. For example, the Spanish embassy in Singapore gives one month to ask for reconsideration. The German embassy says its remonstration procedure ended on 1 July 2025.",
    },
    {
      q: "What does US visa 214(b) mean?",
      a: "It means the officer was not persuaded you will return home after your trip. It is not a permanent bar, and you can apply again at any time with a new form, photo, fee and interview. Show what has changed since the last time.",
    },
    {
      q: "Can I reapply right after a US visa refusal?",
      a: "Yes, you can. The refusal letters say you may reapply at any time. A new application with the same facts is unlikely to change the answer, so wait until something relevant has changed, such as your job, family situation or travel history.",
    },
    {
      q: "Is there an appeal if my UK visitor visa is refused?",
      a: "For most visit visa refusals there is no right of appeal, apart from limited human rights cases. You can apply again as often as you like with more information. Your refusal notice states the rights that apply to your case.",
    },
    {
      q: "Why does Japan not tell me the reason my visa was refused?",
      a: "Japan does not publish the reason for a refusal. Reapplying for the same purpose within six months is not normally accepted, according to the Foreign Ministry FAQ, so check with the embassy and wait until you can show a real change.",
    },
    {
      q: "How long should I wait before I reapply after a visa refusal?",
      a: "It depends on the authority. Japan has a six month rule for the same purpose. The US, UK and Germany allow a new application at any time, and Canada says to reapply only when something has changed. In every case wait until you have fixed the stated reason.",
    },
    {
      q: "Do I have to say I was refused a visa on future applications?",
      a: "Yes. Answer yes whenever a form asks, and give the details it requests. Authorities treat non-disclosure as a serious problem, and the UK sets a 10 year refusal period for applications refused because of deception.",
    },
    {
      q: "Does a refusal from one country affect my application to another?",
      a: "It can. UK guidance lists being refused entry to another country as something that may weigh against a genuine visitor claim, depending on the circumstances. Schengen refusals sit in a shared EU system for five years. Disclose the refusal and show what has changed.",
    },
    {
      q: "When should I speak to a lawyer after a visa refusal?",
      a: "Speak to a lawyer when a ban or false information is mentioned, when you have a criminal or immigration record, when a court or review deadline is running, or when a lot depends on the result. This guide is general information, not legal advice.",
    },
  ],
  sources: [
    { label: "EU standard form for notifying a visa refusal (Annex VI, EEAS copy)", url: "https://eeas.europa.eu/sites/default/files/annex_vi_visa_refusal_form_en_0.pdf" },
    { label: "European Commission: applying for a Schengen visa", url: "https://home-affairs.ec.europa.eu/policies/schengen/visa-policy/applying-schengen-visa_en" },
    { label: "European Commission: Visa Information System", url: "https://home-affairs.ec.europa.eu/policies/schengen/schengen-visas/visa-information-system-vis_en" },
    { label: "German Embassy Singapore: visa and remonstration", url: "https://singapur.diplo.de/sg-en/service/05-visaeinreise/1225482-1225482" },
    { label: "Embassy of Spain in Singapore: Schengen visas", url: "https://www.exteriores.gob.es/Embajadas/singapur/en/ServiciosConsulares/Paginas/Consular/Visados-Schengen.aspx" },
    { label: "Embassy of Italy in Singapore", url: "https://ambsingapore.esteri.it" },
    { label: "US Foreign Affairs Manual 9 FAM 403.10: nonimmigrant visa refusals", url: "https://fam.state.gov/fam/09FAM/09FAM040310.html" },
    { label: "UK Home Office: Visit guidance (version 18.0, 8 October 2026)", url: "https://assets.publishing.service.gov.uk/media/68e3dbcbc487360cc70ca17a/Visit.pdf" },
    { label: "GOV.UK: ask for a visa administrative review", url: "https://www.gov.uk/ask-for-a-visa-administrative-review" },
    { label: "GOV.UK: right of appeal for family visit visas abolished", url: "https://www.gov.uk/government/news/right-of-appeal-for-family-visit-visas-abolished" },
    { label: "GOV.UK: Part Suitability, deception and false representations", url: "https://www.gov.uk/government/publications/suitability-false-representations-immigration-staff-guidance/part-suitability-deception-false-representations-false-documents-and-non-disclosure-of-relevant-facts-accessible" },
    { label: "IRCC Help Centre: my visitor visa was refused, should I apply again", url: "https://ircc.canada.ca/english/helpcentre/answer.asp?qnum=1485&top=16" },
    { label: "IRCC Help Centre: help if my visa application is refused", url: "https://ircc.canada.ca/english/helpcentre/answer.asp?qnum=422&top=16" },
    { label: "IRCC: reconsideration after refusal", url: "https://www.canada.ca/en/immigration-refugees-citizenship/corporate/publications-manuals/operational-bulletins-manuals/service-delivery/reconsideration-after-refusal.html" },
    { label: "Canada.ca: reasons you may be inadmissible to Canada", url: "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/inadmissibility/reasons.html" },
  ],
  reviewed: "Checked on 25 November 2026 against the EU Annex VI refusal form and Commission pages, the German, Spanish and Italian embassy pages in Singapore, the US Foreign Affairs Manual, UK Home Office Visit guidance and gov.uk pages, and IRCC Help Centre and manual pages. Japan and Australia rules were read through summaries because the official pages did not load. Check your own refusal letter for the rights that apply to you.",
};

export default guide;
