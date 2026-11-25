import type { GuideContent } from "../types";

/**
 * Visa photo requirements by country, for people living in Singapore.
 *
 * Checked 25 Nov 2026. Pages read directly:
 *   - https://www.gov.uk/guidance/how-to-take-a-photo-for-a-visa-application-or-permission
 *   - https://ica.gov.sg/photo-guidelines
 *   - https://www.vfsglobal.com/one-pager/japan/singapore/english/index.html and its Photo Specifications PDF
 *   - https://www.visaforchina.cn/SGP4_EN/qianzhengyewu/jichuzhishi/changjianwenti/550212650076868648.html (page dated 2026-08-20)
 *   - https://indianvisaonline.gov.in/evisa/tvoa.html and https://indianvisaonline.gov.in/visa/VSS_IMAGE.pdf
 *   - https://evisa.gov.vn/instruction (read in the browser pane, the fetch tool fails its TLS check)
 *   - https://www.canada.ca/en/immigration-refugees-citizenship/services/application/application-forms-guides/temporary-resident-visa-application-photograph-specifications.html
 *   - https://www.blsinternational.com/italy/singapore/touristvisa.php and the Embassy of Italy tourist visa checklist PDF
 *   - the German embassy visa photo sheet (kuwait.diplo.de PDF, text read with pdftotext)
 *   - https://overseas.mofa.go.kr/sg-en/brd/m_2444/view.do?seq=761433 (Embassy of Korea in Singapore, C-3-9)
 * Repo pages reused: lib/visa-content/{china,india,japan,south-korea,schengen,italy,vietnam,australia,canada,united-states}.ts.
 *
 * Not confirmed on an official page this session (the copy hedges or leaves these out):
 *   - US: travel.state.gov blocked fetch and browser access (HTTP 403 and a bot challenge). The 2 x 2 inch size,
 *     600 to 1200 pixel square range, 6 month age and "no eyeglasses since 1 Nov 2016" come from search excerpts
 *     quoting the State Department photo pages. The background wording, head size and the JPEG file size limit
 *     (240 KB shows only in an excerpt of the Spanish Diversity Visa page) are not stated in the copy.
 *   - Schengen: no single EU rule found. France-Visas photo sheet also blocked (a width of 35 to 40 mm was seen only
 *     in a search excerpt, so it is not used). BLS Italy says 4 x 5 cm, the Italy embassy checklist says passport
 *     size on white, the German photo sheet says 35 x 45 mm. The copy tells people to ask their centre.
 *   - Australia: Home Affairs pages blocked. The ETA app live photo, plain background, good lighting and glasses
 *     advice come from search excerpts (the industry guidance is dated). Visitor visa 600 photo specs not found.
 *   - Japan: the embassy site returned 403. Figures come from VFS Global Singapore pages (no date on the page).
 *     JAPAN eVISA upload specs not confirmed.
 *   - China: the centre page gives size, colour, background and 6 months only. Online upload file format and size,
 *     head size ranges and glossy paper rule were not on a page we could read, so they are left out.
 *   - South Korea: the embassy page gives one physical photo on white and no size. K-ETA upload specs not found.
 *   - Canada: the visitor visa page gives no file format or size. eTA photo rules not covered.
 *   - UK: the GOV.UK page does not state how recent the photo must be and does not cover ETA specifics.
 *   - India: the e-visa page says 10 KB to 1 MB, the regular online visa guide says 10 KB to 300 KB and 350 to 1000 px.
 *     The copy gives both and says which page each comes from.
 *   - Vietnam: a Vietnamese notice on the immigration portal reportedly gives much smaller limits (50 KB portrait).
 *     Not confirmed. The instruction page says under 2 MB. The older repo note says about 1 MB, which this page replaces.
 *   - Singapore: studios and photo booths that take passport-style photos is general knowledge, no official page
 *     lists them. No business is named. A photo service at visa centres was not checked.
 */
const guide: GuideContent = {
  title: "Visa Photo Requirements by Country for Singapore | VIZA",
  description:
    "Visa photo requirements by country for Singapore residents: size, background, file limits and rejection causes for the US, UK, Schengen, Japan, China and more.",
  h1: "Visa photo requirements by country for Singapore residents",
  lead: "Every visa authority sets its own photo rules, and your ICA passport photo does not fit them all. This guide gives the size, background, file limits and common rejection causes for the US, Schengen, UK, Japan, China, India, Vietnam, Australia, Canada and South Korea, from the official pages we could read.",
  glance: [
    { k: "One rule for all", v: "None. Each embassy, centre or portal sets its own size and file limits" },
    { k: "Print sizes", v: "US 2 x 2 in, Japan 45 x 35 mm, China 48 x 33 mm, Vietnam e-visa 4 x 6 cm" },
    { k: "Photo age", v: "6 months is the common limit, for example Japan, China, Canada and BLS Italy" },
    { k: "Online files", v: "UK JPG 50 KB to 6 MB, India e-visa JPEG 10 KB to 1 MB, Vietnam JPG under 2 MB" },
    { k: "ICA photo", v: "ICA's 400 x 514 pixel file is for ICA, not for foreign visas" },
  ],
  sections: [
    {
      id: "how-rules-work",
      heading: "How visa photo rules work",
      body: [
        "There is no single visa photo. Each embassy, visa centre or e-visa portal sets its own size, background and file limits, and a photo that works for one country can fail at the next.",
        "Most rules share the same core: a recent, sharp photo of your full face looking at the camera, in even light with no shadows, and with no edits or filters. The size, background shade and file limits differ.",
        "You will meet two kinds of request. A paper application asks for a printed photo. An online application asks for a digital file in a set size range. The China visa uses both: you upload a photo first and bring a paper copy to the centre.",
      ],
    },
    {
      id: "size-table",
      heading: "Size and background by country",
      body: [
        "The table below sums up what each authority says on the pages we read on 25 November 2026. Not stated means the page gives no figure, so ask the visa centre or check the upload screen.",
      ],
      table: {
        head: ["Destination", "Print size", "Background", "Online file", "Notes"],
        rows: [
          ["[United States](/visa/united-states)", "2 x 2 in (51 x 51 mm)", "Plain light", "Square, 600 to 1200 px", "Last 6 months. No glasses"],
          ["[Schengen](/visa/schengen)", "Varies: 4 x 5 cm at BLS Italy, 35 x 45 mm on the German sheet", "White or bright single colour", "Varies by country", "Italy: colour, last 6 months, no scans"],
          ["[United Kingdom](/visa/united-kingdom)", "Digital only", "Plain, light", "JPG, 50 KB to 6 MB, at least 600 x 750 px", "No filters. New photo"],
          ["[Japan](/visa/japan)", "45 x 35 mm", "White, no shadows", "Not stated", "Last 6 months. No spectacles. Not 45 x 45 mm"],
          ["[China](/visa/china)", "48 x 33 mm", "White", "Upload on the centre's site, size not stated", "Colour, bare head, full face, last 6 months"],
          ["[India](/visa/india) e-visa", "Not needed", "Plain, light or white", "JPEG, 10 KB to 1 MB, square", "Passport page PDF, 10 to 300 KB"],
          ["[Vietnam](/visa/vietnam) e-visa", "4 x 6 cm image", "White", "JPG or JPEG, under 2 MB", "No hat, no glasses, formal attire"],
          ["[Australia](/visa/australia)", "Live photo in the ETA app", "Plain, well lit", "Taken inside the app", "Visitor visa: see ImmiAccount"],
          ["[Canada](/visa/canada)", "Frame at least 35 x 45 mm, head 31 to 36 mm", "Plain white or light", "Not stated", "Last 6 months. Clear lenses allowed"],
          ["[South Korea](/visa/south-korea)", "Not stated", "White", "Not stated", "One physical photo with the visa form"],
        ],
      },
    },
    {
      id: "americas-australia",
      heading: "United States, Canada and Australia",
      body: [
        "United States. The State Department asks for a 2 x 2 inch (51 x 51 mm) photo for a visa. The digital version is square, from 600 x 600 up to 1200 x 1200 pixels, and the photo is taken within the last 6 months. Its template says eyeglasses have not been allowed in visa photos since 1 November 2016, so take them off. You upload the photo in the DS-160. Check the [State Department photo page](https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/photos.html) for the head size template and the current file size limit before you upload. See the [US visa page](/visa/united-states) and the [US visa interview guide](/guides/us-visa-interview-singapore).",
        "Canada. For a visitor visa, IRCC asks for two identical photos taken in the last 6 months. The frame is at least 35 x 45 mm and your head, from chin to crown, measures 31 to 36 mm. The background is plain white or light, with a neutral expression and the mouth closed. Clear prescription glasses are allowed when both eyes are visible, and sunglasses are not. A digital photo must not be altered in any way. See the [Canada visa page](/visa/canada).",
        "Australia. Singapore and Malaysian passports apply for the ETA in the Australian ETA app, which takes a live photo of you after it reads your passport. The app guidance asks for a plain background and good lighting, and suggests removing glasses where you can. Other passports apply for the Visitor visa in ImmiAccount, where the upload screen states the photo rules for that application. See the [Australia visa page](/visa/australia).",
      ],
    },
    {
      id: "schengen-uk",
      heading: "Schengen and the United Kingdom",
      body: [
        "Schengen. Each Schengen country sets its own checklist, so there is no single size. In Singapore, BLS lists a 4 x 5 cm colour photo on a plain white background for the Italy tourist visa, taken within 6 months, and it does not accept scans or colour photocopies. The Embassy of Italy checklist asks for two recent passport-size photos on a white background. A German embassy photo sheet uses 35 x 45 mm, with the face filling 70 to 80 percent of the frame and a single bright background colour. Ask the centre of the country you apply to which size it wants. See the [Schengen visa page](/visa/schengen) and the [Schengen visa checklist](/guides/schengen-visa-checklist-singapore).",
        "United Kingdom. GOV.UK says the file must be a JPG or JPEG between 50 KB and 6 MB, at least 600 pixels wide and 750 pixels tall, vertical, and not mirrored or flipped. The background is plain and light, with no shadows on your face or behind you. Keep a neutral expression with your mouth closed. Avoid glasses. If you need them, no tint, and frames and glare cannot cover your eyes. The photo must be a new digital image, not a scan or a photo of another photo, and not the photo in your passport or identity card. You can take it on a phone. See the [UK visa page](/visa/united-kingdom).",
      ],
    },
    {
      id: "asia-visas",
      heading: "Japan, China and South Korea",
      body: [
        "Japan. The Japan visa page run by VFS Global in Singapore asks for a colour passport-size photo of 45 x 35 mm, which is 4.5 cm tall and 3.5 cm wide. It is taken within the last 6 months on a plain white background with no border or shadows. Tie your hair back, take off glasses and hats, and keep your ears visible. It goes on glossy photo paper and cannot have been used on an earlier visa or ID. See the [Japan visa page](/visa/japan).",
        "China. The Chinese Visa Application Service Center in Singapore asks for a colour photo taken within the last 6 months, bare head and full face, on a white background, 48 mm tall by 33 mm wide. You upload it with the online form first. The paper photo you bring must match the uploaded one, and a rejected upload means a new photo. See the [China visa page](/visa/china) and the [guide for Chinese passport holders in Singapore](/guides/visas-chinese-passport-holders-singapore).",
        "South Korea. The Embassy of Korea in Singapore asks for one physical passport photo taken against a white background, attached to the visa form for the C-3-9 short-term visit visa. The page does not give a size, so ask the Korea Visa Application Center before you print. See the [South Korea visa page](/visa/south-korea).",
      ],
    },
    {
      id: "e-visa-uploads",
      heading: "Vietnam and India e-visa photos",
      body: [
        "Vietnam e visa photo requirements are set on the Vietnam e-visa portal. The photo is a recent 4 x 6 cm image in JPG or JPEG, under 2 MB. It is front-facing, with no hat, no glasses, formal attire and a white background. You upload two images: your portrait and your passport data page. The system checks both automatically, and if the passport image is not valid it does not let you submit. See the [Vietnam e-visa page](/visa/vietnam).",
        "India. The India e-visa page asks for a JPEG between 10 KB and 1 MB with equal height and width, so the photo is square. Show your full face from the front with your eyes open, take off spectacles, and use a plain light or white background with no shadows or borders. The passport bio page is a separate PDF between 10 KB and 300 KB.",
        "The portal guide for the regular online visa registration uses tighter limits: JPEG, 10 KB to 300 KB, and 350 x 350 to 1000 x 1000 pixels. If your application is not an e-visa, use that range. Check the upload screen for your visa type. See the [India visa page](/visa/india) and the [guide for Filipino and Indian residents in Singapore](/guides/visas-filipino-indian-residents-singapore).",
      ],
    },
    {
      id: "rejections",
      heading: "Common rejection causes",
      body: [
        "Most photo rejections come from a short list of slips. A rejected photo costs a retake at the least. At a visa centre it can cost an appointment slot, and on the Vietnam portal a bad passport image blocks the submission.",
      ],
      table: {
        head: ["Cause", "What to do"],
        rows: [
          ["Shadows on the face or behind the head", "Stand a step away from the wall and face a window or an even light."],
          ["Glasses", "Take them off. The US bars glasses in visa photos, and Japan, India and Vietnam ask for none. The UK and Canada allow clear lenses if your eyes stay visible."],
          ["Smiling or an open mouth", "Keep a neutral face with the mouth closed and eyes open."],
          ["Filters and retouching", "Switch off beauty mode and filters. GOV.UK, ICA and IRCC all rule out edits."],
          ["An old photo", "Retake it. The US, Japan, China, Canada and BLS Italy all work to a 6 month limit."],
          ["Wrong crop or size", "Match the exact size and head size. Canada asks for a 31 to 36 mm head."],
          ["File too big or too small", "Resize the file. The UK takes 50 KB to 6 MB, the India e-visa 10 KB to 1 MB and Vietnam under 2 MB."],
          ["A photo of a photo or a scan", "Take a new digital image. The UK and BLS Italy do not accept copies."],
          ["Reusing an old photo", "Take a new photo for each application. The UK bars your passport photo and Japan bars a photo used on an earlier visa or ID."],
          ["Wrong background colour", "Japan, China and Vietnam ask for white. The UK and India accept plain light backgrounds."],
        ],
      },
    },
    {
      id: "singapore-photos",
      heading: "Taking your photo in Singapore",
      body: [
        "ICA's photo guidelines are written for Singapore passport and identity card applications. For uploads through e-Services, ICA asks for a 400 x 514 pixel image in JPG, JPEG, HEIC, HEIF or PNG, up to 8 MB, and says the photo should follow ISO and ICAO standards. That is ICA's own file spec. A foreign embassy or visa centre does not use it, so do not reuse an ICA-sized file for a visa unless the visa page lists that exact size.",
        "ICA also says to avoid filters and have someone else take the photo, because selfies usually fail.",
        "Many photo studios and photo booths in Singapore take passport-style photos. Tell them the country and visa type first, and ask for the exact size, the background colour and a digital copy of the file. A booth set to one standard size gives one size only, so check it matches. For digital uploads, GOV.UK says a phone photo works. Ask another person to take it against a plain wall in even light.",
        "VIZA also has a Visa Photo Creator tool on the site. Check any result against the rules above, because the embassy, centre or portal decides, and no tool can promise a photo will be accepted.",
      ],
    },
    {
      id: "next-steps",
      heading: "Next steps",
      body: [
        "Open the page for your destination and read its checklist before you print or upload: [United States](/visa/united-states), [Schengen](/visa/schengen), [United Kingdom](/visa/united-kingdom), [Japan](/visa/japan), [China](/visa/china), [India](/visa/india), [Vietnam](/visa/vietnam), [Australia](/visa/australia), [Canada](/visa/canada) or [South Korea](/visa/south-korea).",
        "If you are not sure which type of visa you need, read [e-visa vs visa on arrival vs embassy visa](/guides/e-visa-vs-visa-on-arrival-vs-embassy-visa). If an application was refused, see [what to do after a visa refusal](/guides/visa-refused-reapply). Singapore passport holders can start with the [visa free countries guide](/guides/visa-free-countries-singapore-passport).",
        "VIZA's service is free. Government and visa centre fees are paid directly to the authority and are separate. VIZA is an independent service, not a government body.",
      ],
    },
  ],
  faq: [
    {
      q: "What are the Vietnam e visa photo requirements?",
      a: "The Vietnam e-visa portal asks for a recent 4 x 6 cm portrait in JPG or JPEG, under 2 MB, front-facing with no hat, no glasses, formal attire and a white background. You also upload your passport data page, and the system checks both images.",
    },
    {
      q: "What size is a US visa photo?",
      a: "A US visa photo is 2 x 2 inches (51 x 51 mm). The digital version is square, from 600 x 600 to 1200 x 1200 pixels, and taken within the last 6 months. Check the State Department photo page before you upload.",
    },
    {
      q: "What size photo does a Japan visa need, 45 x 45 mm?",
      a: "No. The Japan visa photo is 45 x 35 mm, which is 4.5 cm tall and 3.5 cm wide, in colour on a plain white background, taken within the last 6 months. A 45 x 45 mm print will not fit.",
    },
    {
      q: "What is the China visa photo size?",
      a: "The Chinese Visa Application Service Center in Singapore asks for a colour photo 48 mm tall by 33 mm wide, on a white background, bare head and full face, taken within the last 6 months. You upload it with the online form first.",
    },
    {
      q: "What are the India e-visa photo requirements?",
      a: "The India e-visa portal asks for a square JPEG between 10 KB and 1 MB, full face from the front, eyes open, no spectacles and a plain light or white background. The passport bio page is a separate PDF between 10 KB and 300 KB.",
    },
    {
      q: "What are the UK visa photo requirements?",
      a: "GOV.UK asks for a new digital JPG or JPEG between 50 KB and 6 MB, at least 600 x 750 pixels, vertical, with a plain light background, no filters and a neutral expression.",
    },
    {
      q: "What is the Schengen visa photo size?",
      a: "It depends on the country. BLS lists 4 x 5 cm for the Italy visa in Singapore, and a German embassy photo sheet uses 35 x 45 mm. Ask the visa centre which size it wants.",
    },
    {
      q: "Can I wear glasses in a visa photo?",
      a: "The US says no glasses in visa photos, and Japan, India and Vietnam ask for none. The UK and Canada allow clear lenses if the frames, glare and shadows leave both eyes visible. Taking them off is the safest choice.",
    },
    {
      q: "Can I use my ICA passport photo for a visa?",
      a: "Not as it is. ICA's 400 x 514 pixel file spec is for ICA applications, and each visa authority sets its own size and background. The UK also says the photo cannot be the one in your passport, and Japan says it cannot have been used on an earlier visa or ID.",
    },
    {
      q: "Can I take a visa photo with my phone?",
      a: "For digital uploads, yes. GOV.UK says a phone photo works for UK applications, and ICA suggests another person takes the photo because selfies usually fail. Use even light against a plain wall and skip filters.",
    },
    {
      q: "How old can a visa photo be?",
      a: "Six months is the common limit. The US, Japan, China, Canada and BLS Italy all work to it. GOV.UK states no age, and asks for a new photo for each application.",
    },
    {
      q: "Why was my visa photo rejected?",
      a: "The usual causes are shadows, glasses, a smile or open mouth, filters, an old photo, the wrong size, a file outside the limits, and a scan of a photo. Retake it against a plain wall in even light.",
    },
  ],
  sources: [
    { label: "GOV.UK, how to take a photo for a visa application or permission", url: "https://www.gov.uk/guidance/how-to-take-a-photo-for-a-visa-application-or-permission" },
    { label: "ICA, photo guidelines", url: "https://ica.gov.sg/photo-guidelines" },
    { label: "VFS Global, Japan visa information, Singapore", url: "https://www.vfsglobal.com/one-pager/japan/singapore/english/index.html" },
    { label: "VFS Global, Japan visa photo specifications, Singapore", url: "https://www.vfsglobal.com/one-pager/japan/singapore/english/pdf/Photo-Specifications.pdf" },
    { label: "Chinese Visa Application Service Center Singapore, photo requirement", url: "https://www.visaforchina.cn/SGP4_EN/qianzhengyewu/jichuzhishi/changjianwenti/550212650076868648.html" },
    { label: "Indian Visa Online, e-visa tourist page", url: "https://indianvisaonline.gov.in/evisa/tvoa.html" },
    { label: "Indian Visa Online, online visa photo upload guide", url: "https://indianvisaonline.gov.in/visa/VSS_IMAGE.pdf" },
    { label: "Vietnam National Electronic Visa system, instruction", url: "https://evisa.gov.vn/instruction" },
    { label: "IRCC, temporary resident visa photograph specifications", url: "https://www.canada.ca/en/immigration-refugees-citizenship/services/application/application-forms-guides/temporary-resident-visa-application-photograph-specifications.html" },
    { label: "BLS International, Italy visa Singapore, tourist visa", url: "https://www.blsinternational.com/italy/singapore/touristvisa.php" },
    { label: "Embassy of Italy in Singapore, tourist visa checklist", url: "https://ambsingapore.esteri.it/wp-content/uploads/2026/04/Tourist-Visa-Checklist-UPDATED-ON-23.04.2026.pdf" },
    { label: "German embassy, Schengen visa photo instructions", url: "https://kuwait.diplo.de/resource/blob/2079290/153d98a9ab09f4702a0d796b5000a6f6/pdf-bio-photo-data.pdf" },
    { label: "Embassy of Korea in Singapore, C-3-9 short-term visit visa", url: "https://overseas.mofa.go.kr/sg-en/brd/m_2444/view.do?seq=761433&page=1" },
  ],
  reviewed:
    "Checked on 25 November 2026 against GOV.UK, ICA, the VFS Global Japan pages for Singapore, the Chinese Visa Application Service Center in Singapore, Indian Visa Online, the Vietnam e-visa portal, IRCC, BLS International, the Embassy of Italy in Singapore, a German embassy photo sheet and the Embassy of Korea in Singapore. The US State Department photo page blocked automated access on the day, so check the live page before you upload.",
};

export default guide;
