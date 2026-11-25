import type { GuideContent } from "../types";

/**
 * Guide (zh-CN): 签证被拒，原因和重新申请 (for people living in Singapore). Written natively, same facts as
 * lib/guides/en/visa-refused-reapply.ts.
 *
 * Checked 25 Nov 2026. Sources opened and read: EU Annex VI refusal form (EEAS copy), European Commission
 * Schengen application and VIS pages, German Embassy Singapore visa page, Spanish Embassy Singapore Schengen page,
 * Italian Embassy Singapore tourist checklist, US Foreign Affairs Manual 9 FAM 403.10, UK Home Office Visit
 * guidance v18.0 (8 Oct 2026), gov.uk administrative review, Part Suitability deception guidance and the 2013
 * family visit appeal notice, IRCC Help Centre answers 1485 and 422, IRCC reconsideration manual page,
 * Canada.ca inadmissibility page.
 * Keyword note: docs/seo/keywords.csv has no refusal keywords. Chinese terms used from the csv: 签证,
 * 新加坡 签证, 申根 签证, 美国 签证, 英国 签证, 日本 签证, 澳洲 签证, 加拿大 签证. 214(b) is kept as a term.
 *
 * Not confirmed on an official page (the copy hedges or leaves these out):
 *   - travel.state.gov denial pages (HTTP 403): the one year window for 221(g) documents is NOT stated.
 *   - exact wording of the DS-160 refusal question and of the other forms: the copy says answer what the form asks.
 *   - Japan MOFA FAQ (HTTP 403): the six month same purpose rule and humanitarian exception come from search
 *     snippets. "Reasons not disclosed" matches lib/visa-content/japan.ts.
 *   - Australia: whether a Visitor visa refused from outside Australia can go to the ART. Copy says the letter
 *     states review rights. No PIC 4020 ban period given.
 *   - Canada: the Federal Court judicial review deadline and the length of the misrepresentation ban. No period given.
 *   - UK: whether visitor visas are formally outside administrative review (gov.uk page does not name them).
 *   - France and Italy appeal bodies and deadlines for refusals decided in Singapore.
 *   - the 2019 revision of Annex VI layout, so no box numbers.
 *   - UK 10 year refusal period applying to visitor applications specifically.
 *   - Singapore pass rules beyond the Italian checklist (valid IC or FIN, valid Re-Entry Permit, passport valid
 *     3 months after return).
 */
const guide: GuideContent = {
  title: "签证被拒怎么办：原因、申诉和重新申请 | VIZA",
  description: "签证被拒或申根签证被拒绝？了解新加坡居民常见的拒签原因、怎样读拒签信、能否申诉、什么时候重新申请，以及以后表格里被拒记录怎么如实填写。",
  h1: "签证被拒怎么办：原因和重新申请",
  lead: "拒签信会写明官员依据的规定，一份更扎实的再次申请就从这里开始。本文讲申根签证被拒、美国签证 214(b)，以及英国、日本、澳洲和加拿大签证被拒的常见原因，也讲哪些情况可以申诉、什么时候适合重新递签，还有以后的表格里“是否被拒过签证”该怎么如实填写。内容面向住在新加坡的读者，属于一般信息，不是法律意见。",
  glance: [
    { k: "第一步", v: "先读拒签信，里面会写明拒签理由或法律条款。" },
    { k: "申诉", v: "申根按各国自己的程序申诉。美国签证没有正式申诉。英国、日本、澳洲和加拿大要看拒签信怎么写。" },
    { k: "重新申请", v: "先改正官员存疑的地方。材料原样再递，结果通常不会变。" },
    { k: "以后的表格", v: "表格问到被拒记录，就如实全部写上。隐瞒的后果往往比被拒本身更重。" },
    { k: "没有保证", v: "任何材料清单和任何中介都不能保证出签。每个签证机关各自决定。" },
  ],
  sections: [
    {
      id: "why-refused",
      heading: "签证被拒的常见原因",
      body: [
        "游客签证被拒，多数归结为一个问题：官员是否相信你的行程真实，并且相信你会按时回来。资金、在新加坡的牵绊、行程安排和出行记录，都是回答这个问题的证据。下表列出各签证机关怎样写明理由。",
      ],
      table: {
        head: ["签证机关", "理由的写法", "游客最常见的原因"],
        rows: [
          ["申根国家", "欧盟统一的拒签表格，用编号列出理由", "停留目的和条件没有说清、资金不足、没有有效的旅行医疗保险、信息不可靠、无法确认你会在签证到期前离开"],
          ["美国", "写明法律条款，通常是 214(b) 或 221(g)", "214(b)：官员没有被说服你会回国。221(g)：材料不全或需要进一步审查"],
          ["英国", "拒签通知里写明理由", "不能确信你是真实访客、资金、与居住地的联系、出行记录、以前有欺骗行为"],
          ["日本", "不告知理由", "日本不公布拒签的具体原因"],
          ["澳洲", "内政部来信写明理由", "不是真实访客、材料不清楚或缺失、虚假或误导性信息、健康或品行问题"],
          ["加拿大", "拒签信写明理由", "官员不确信你会离开、行程目的或资金不清楚、申请不完整、信息有误"],
        ],
      },
    },
    {
      id: "read-letter",
      heading: "怎样读拒签信",
      body: [
        "先把整封信读完再做别的事。信里通常有四项内容：决定、理由或法律条款、能否申诉或申请复核、办理期限。期限可能很短，当天就记下来。",
        "把每一条理由对应到你能改的证据上。写资金的，看银行流水。写行程目的的，看行程单和订单。写是否会离开的，看你在新加坡的工作、家人和住所。",
      ],
      list: [
        "抄下被勾选的具体理由、条款或编号。",
        "记下申诉或复核的期限，以及递交的地点。",
        "信里没有写理由时，把材料里最弱的一环当成原因，每一项都补强。",
      ],
    },
    {
      id: "schengen-rejected",
      heading: "申根签证被拒",
      body: [
        "申根拒签用欧盟统一表格，理由以方框列出，包括：出示伪造的旅行证件、没有说明停留目的和条件、没有证明资金足够、180天内已停留90天、申根信息系统里有警报、被认为威胁公共政策或安全、没有有效的旅行医疗保险、关于停留目的的信息不可靠，以及无法确认你会在签证到期前离开。",
        "表格还写明，你可以依各国法律申诉。每个国家要在自己的通知上写明申诉机构、程序和期限，所以怎么办取决于是哪个国家拒的签。想重新整理材料，可以看[申根签证材料清单](/guides/schengen-visa-checklist-singapore)。",
        "新加坡的两个使馆就能看出各国规定差别很大。西班牙使馆说，收到拒签通知次日起一个月内可以向领事处申请重新审议，之后两个月内可以向马德里法院申请司法复核。德国使馆说，异议程序已在2025年7月1日取消，可以向柏林行政法院起诉，要用德语，并有诉讼费，同时说明可以随时重新递交申请。",
        "[法国](/visa/france)和[意大利](/visa/italy)是最常见的两个目的地。法国或意大利拒签后的申诉，请按通知里的申诉段落办理，我们没有在官方页面找到这两国的具体期限。",
        "申根拒签会记录在欧盟签证信息系统（VIS）里，欧盟说明数据自作出否定决定之日起保存五年。",
      ],
    },
    {
      id: "us-214b",
      heading: "美国签证 214(b) 和 221(g)",
      body: [
        "214(b) 条款是 B1/B2 访客签证被拒最常见的依据。法律先假定每个申请人都想移民，要申请人自己证明不是。被拒 214(b) 就是官员没有被说服你旅行后会回国。美国国务院的手册要求官员写明条款，并就 214(b) 说明申请人没有说服官员自己会回国。",
        "214(b) 不是永久禁入。手册写明，以前的拒签不妨碍你之后在情况变化时拿到签证，拒签信也写明你可以随时再申请，需要新的表格、照片、签证费和新的面谈。没有正式申诉，214(b) 也没有豁免。",
        "221(g) 不一样，通常是官员需要补材料或进一步审查后才能决定。拒签信或使馆会告诉你要交什么、有多长时间，请严格照办并尽快回复。按国务院手册，221(g) 在法律上也算一次拒签，即使后来解决了，这对下面的表格填写很重要。",
        "面谈准备可以看[美国签证面谈指南](/guides/us-visa-interview-singapore)，申请流程和费用见[新加坡办理美国签证](/visa/united-states)。",
      ],
    },
    {
      id: "appeal-or-reapply",
      heading: "申诉、复核还是重新申请",
      body: [
        "各国做法不同，下表是各签证机关的说法，你的个案以拒签信为准。",
        "申诉或法院程序审查的是决定是否合法、是否公平，新的证据要放进重新递交的申请里。是否走这些程序，可以请律师判断。",
      ],
      table: {
        head: ["目的地", "申诉或复核", "重新申请"],
        rows: [
          ["[申根](/visa/schengen)", "可以，依拒签国自己的法律，通知里写明机构和期限", "允许。德国使馆说随时可以。先改正信里写的理由"],
          ["[美国](/visa/united-states)", "访客签证被拒没有正式申诉", "随时可以，需要新的表格、照片、签证费和面谈。要说明哪里变了"],
          ["[英国](/visa/united-kingdom)", "多数访客签证被拒没有上诉权，涉及人权的情况除外。gov.uk 的复核页面（80英镑、28天）没有提访客签证，请看通知", "gov.uk 说可以重复申请，并补充材料。逐条回应拒签理由"],
          ["[日本](/visa/japan)", "没有说明申诉渠道，也不告知理由", "同一目的在六个月内再申请，一般不受理，见日本外务省常见问题。请向使馆确认"],
          ["[澳洲](/visa/australia)", "拒签信会写明是否可以复核和期限", "信里没有复核权利时，通常重新申请。先对照[ETA 与签证指南](/guides/eta-vs-visa)确认申请的类别对不对"],
          ["[加拿大](/visa/canada)", "没有正式上诉。可以向联邦法院申请司法复核，期限很短。移民部把重新审议当作例外，只是不同意决定并不够", "只有情况变了或有针对拒签理由的新信息才值得再递。移民部说，找代理不会提高获批的机会"],
        ],
      },
    },
    {
      id: "refused-before",
      heading: "表格里的被拒记录",
      body: [
        "如实申报是强制的。表格问到以前的拒签，就回答“是”，并写清它要求的细节，哪怕是多年前、在别的国家、为别的目的，或者后来已经解决。",
        "隐瞒拒签比拒签本身严重得多。英国指引规定，因欺骗被拒的申请会有10年的拒签期，并把没有披露以前的拒签列为未披露相关事实的例子。加拿大移民部把虚假陈述（包括隐瞒信息）列为可能令人不得入境的原因。美国国务院提醒，虚假或误导性的回答可能导致永久拒签。",
        "按美国国务院手册，221(g) 也可能算作拒签。每份表格的措辞都要逐字读，问什么答什么。如果不确定撤回的申请或行政审查中的案子算不算，提交前请先咨询律师。",
        "表格留有说明栏时，写清发生了什么、之后有什么变化，并附上新的证据。",
      ],
    },
    {
      id: "fix-weaknesses",
      heading: "补强薄弱环节",
      body: [
        "再次申请要围绕拒签理由来准备，不是把材料堆得更厚。逐项检查如下。",
      ],
      list: [
        "资金：展示稳定的收入和足够覆盖行程与回程的存款。英国指引说没有固定金额，官员看整体情况。",
        "在新加坡的牵绊：在职证明写明职位、入职日期和批准的假期，再加上住所、家人、学业或生意的证明，并附上准证和有效期。",
        "行程：每天的安排清楚，并与订单一致。申根签证里，行程说不清每一天是常见的弱点。",
        "出行记录：附上以前的签证和出入境章。按时回来的记录有帮助。",
        "递错地方：向主要目的地所在国申请，并在对应的签证中心预约。申根签证向停留天数最多的国家申请，天数相同就向第一个入境的国家申请。",
        "前后一致：表格、信件和银行流水上的日期、姓名、收入和地址要对得上。",
        "照片和表格：用对照片，每一栏都填完，见[签证照片要求](/guides/visa-photo-requirements)。",
      ],
    },
    {
      id: "singapore-residents",
      heading: "住在新加坡的注意点",
      body: [
        "住在新加坡的人通常在居住地递签。欧盟页面说，一般向对你合法居住国有管辖权的领事馆申请，美国国务院也让申请人在居住地申请。对大多数人来说就是新加坡的使馆或签证中心。",
        "新加坡的身份要保持有效。意大利使馆的清单要求有效的新加坡身份证或 FIN 卡，新加坡永久居民要出示有效的再入境许可，护照在回程日之后还要有至少三个月有效期。准证快到期本身就是弱点，能先续就先续。拒签后如果工作、准证或雇主有变化，下一份材料里要放入新的文件。",
        "新加坡护照可以免签的地方，见[新加坡护照免签国家](/guides/visa-free-countries-singapore-passport)。持中国护照住在新加坡，请看[持中国护照在新加坡办签证](/guides/visas-chinese-passport-holders-singapore)。菲律宾和印度籍居民见[菲律宾和印度居民办签证](/guides/visas-filipino-indian-residents-singapore)。",
        "遇到可能被禁止申请、被指虚假信息、有犯罪或移民记录，或者有法院或复核期限在走时，请咨询律师。",
      ],
    },
    {
      id: "next-steps",
      heading: "下一步",
      body: [
        "读拒签信，记下期限和理由，再决定是申诉或复核，还是准备一份更扎实的新申请。",
        "准备重新递签时，打开目的地页面查看适合你准证的规则和费用：[申根](/visa/schengen)、[美国](/visa/united-states)、[英国](/visa/united-kingdom)、[日本](/visa/japan)、[澳洲](/visa/australia)或[加拿大](/visa/canada)。VIZA 的服务免费，可以在你提交前帮你核对材料。政府和签证中心的费用直接付给签证机关，另行计算。任何服务都不能承诺出签。",
      ],
    },
  ],
  faq: [
    {
      q: "申根签证为什么被拒绝？",
      a: "拒签表格会列出理由。游客常见的有行程目的或安排不清楚、资金不足、没有有效的旅行医疗保险、信息不可靠，以及无法确认你会按时离开。先看表格上勾选的是哪几项，再逐项改正。",
    },
    {
      q: "在新加坡申根签证被拒后可以申诉吗？",
      a: "可以，依拒签国自己的法律，机构和期限写在通知上。例如西班牙驻新加坡使馆给一个月时间申请重新审议。德国使馆说异议程序已在2025年7月1日结束。",
    },
    {
      q: "美国签证 214(b) 是什么意思？",
      a: "意思是官员没有被说服你旅行后会回国。它不是永久禁入，你可以随时重新申请，需要新的表格、照片、签证费和面谈。要说明和上次相比哪里变了。",
    },
    {
      q: "美国签证被拒后可以马上重新申请吗？",
      a: "可以，拒签信写明可以随时再申请。事实不变的申请很难换来不同结果，所以等到工作、家庭或出行记录有了相关变化再递更合适。",
    },
    {
      q: "英国访客签证被拒后可以上诉吗？",
      a: "多数访客签证被拒没有上诉权，涉及人权的有限情况除外。你可以补充材料后重复申请。适用于你个案的权利以拒签通知为准。",
    },
    {
      q: "日本签证被拒为什么不告诉原因？",
      a: "日本不公布拒签的具体原因。按外务省的常见问题，同一目的在六个月内再申请一般不受理，请向使馆确认，并等到你能展示实质变化再递。",
    },
    {
      q: "签证被拒后隔多久再申请合适？",
      a: "要看签证机关。日本对同一目的有六个月的规定。美国、英国和德国允许随时再申请，加拿大说情况变了再申请。无论哪里，都等到你改正了拒签理由再递。",
    },
    {
      q: "以后申请签证一定要写以前被拒过吗？",
      a: "要。表格问到就回答“是”，并写清它要求的细节。签证机关把隐瞒视为严重问题，英国对因欺骗被拒的申请设有10年的拒签期。",
    },
    {
      q: "一个国家的拒签会影响申请别的国家吗？",
      a: "可能会。英国指引提到，被别国拒绝入境可能对真实访客的判断不利，要看具体情况。申根拒签会在欧盟共用系统里保存五年。如实申报，并说明哪里变了。",
    },
    {
      q: "签证被拒后什么时候该找律师？",
      a: "提到禁止入境或虚假信息、你有犯罪或移民记录、有法院或复核期限在走，或者结果对你很重要时，请找律师。本文是一般信息，不是法律意见。",
    },
  ],
  sources: [
    { label: "欧盟拒签通知标准表格（附件六，EEAS 版本）", url: "https://eeas.europa.eu/sites/default/files/annex_vi_visa_refusal_form_en_0.pdf" },
    { label: "欧盟委员会：申请申根签证", url: "https://home-affairs.ec.europa.eu/policies/schengen/visa-policy/applying-schengen-visa_en" },
    { label: "欧盟委员会：签证信息系统", url: "https://home-affairs.ec.europa.eu/policies/schengen/schengen-visas/visa-information-system-vis_en" },
    { label: "德国驻新加坡使馆：签证与异议程序", url: "https://singapur.diplo.de/sg-en/service/05-visaeinreise/1225482-1225482" },
    { label: "西班牙驻新加坡使馆：申根签证", url: "https://www.exteriores.gob.es/Embajadas/singapur/en/ServiciosConsulares/Paginas/Consular/Visados-Schengen.aspx" },
    { label: "意大利驻新加坡使馆", url: "https://ambsingapore.esteri.it" },
    { label: "美国外交事务手册 9 FAM 403.10：非移民签证拒签", url: "https://fam.state.gov/fam/09FAM/09FAM040310.html" },
    { label: "英国内政部：访客指引（18.0 版，2026年10月8日）", url: "https://assets.publishing.service.gov.uk/media/68e3dbcbc487360cc70ca17a/Visit.pdf" },
    { label: "GOV.UK：申请签证行政复核", url: "https://www.gov.uk/ask-for-a-visa-administrative-review" },
    { label: "GOV.UK：取消探亲访客签证的上诉权", url: "https://www.gov.uk/government/news/right-of-appeal-for-family-visit-visas-abolished" },
    { label: "GOV.UK：适格性指引，欺骗和虚假陈述", url: "https://www.gov.uk/government/publications/suitability-false-representations-immigration-staff-guidance/part-suitability-deception-false-representations-false-documents-and-non-disclosure-of-relevant-facts-accessible" },
    { label: "加拿大移民部帮助中心：访客签证被拒后是否再申请", url: "https://ircc.canada.ca/english/helpcentre/answer.asp?qnum=1485&top=16" },
    { label: "加拿大移民部帮助中心：签证申请被拒后怎么办", url: "https://ircc.canada.ca/english/helpcentre/answer.asp?qnum=422&top=16" },
    { label: "加拿大移民部：拒签后的重新审议", url: "https://www.canada.ca/en/immigration-refugees-citizenship/corporate/publications-manuals/operational-bulletins-manuals/service-delivery/reconsideration-after-refusal.html" },
    { label: "Canada.ca：可能不得入境加拿大的原因", url: "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/inadmissibility/reasons.html" },
  ],
  reviewed: "2026年11月25日核对，依据欧盟附件六拒签表格和欧盟委员会页面、德国、西班牙和意大利驻新加坡使馆页面、美国外交事务手册、英国内政部访客指引和 gov.uk 页面，以及加拿大移民部帮助中心和手册页面。日本和澳洲的规定通过摘要读取，因为官方页面没有加载。你自己的权利以你的拒签信为准。",
};

export default guide;
