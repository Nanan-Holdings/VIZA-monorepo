import type { GuideContent } from "../types";

/**
 * 新加坡申根签证材料清单（简体中文，原创撰写，不是英文逐句翻译）。
 *
 * 2026年11月25日核对来源：欧盟内政总司“申请申根签证”页面；意大利驻新加坡大使馆（费用页、2026年4月23日
 * 更新的旅游签证材料清单PDF）；BLS International意大利新加坡旅游签证页；BLS西班牙新加坡网站；荷兰驻新加坡
 * 使馆（新加坡申请页、预约页）；德国驻新加坡使馆签证页；欧盟内政总司ETIAS页面（页面日期2025年10月6日）；
 * eu-LISA关于EES的新闻；荷兰政府ETIAS页面；丹麦和瑞典使馆的旅行医疗保险页；欧盟委员会关于保加利亚和罗马尼亚
 * 加入申根区的新闻；以及本仓库的 lib/visa-content/schengen.ts、france.ts、italy.ts。
 * travel-europe.europa.eu、EUR-Lex、VFS Global、France-Visas 没有读到内容或返回HTTP 403。
 *
 * 以下事项没有在官方页面确认，正文已含糊处理或略去（Not confirmed）：
 *   - 签证法典第15条的3万欧元表述，是在使馆页面和搜索摘要里读到的，没有在EUR-Lex原文确认；欧盟内政总司页面
 *     只写了保障项目（紧急医疗、住院、遣返），没有写金额
 *   - ETIAS开始日期（欧盟没有公布），以及欧盟名单是否点名新加坡
 *   - ETIAS有效期和年龄豁免（所读页面没有），所以不写
 *   - EP、S Pass、家属准证、PR回头签（re-entry permit）的剩余有效期要求（意大利清单只写了NRIC或FIN卡和PR回头签，没有天数）
 *   - 退休人员在新加坡的材料（所读清单没有退休人员一项）
 *   - 意大利以外各国的具体清单（法国、德国、荷兰、西班牙、瑞士没有完整读过）
 *   - 法国EUR 34申请费和VFS 2026年6月2日新地址（France-Visas返回403，数字来自仓库 france.ts）
 *   - VFS Global的新币服务费和预约等候时间
 *   - 新加坡各国分别用VFS、BLS还是其他中心（正文只写了读到的几个）
 *   - 照片尺寸除了ICAO标准（欧盟）、白底（意大利）、4 x 5 cm（BLS意大利）以外的要求
 *   - 雇主团险或信用卡附送保险是否被接受（建议直接问使馆）
 */
const guide: GuideContent = {
  title: "新加坡申根签证申请：材料清单与保险要求 | VIZA",
  description: "住在新加坡怎么递申根签证：按身份列出材料清单，说明3万欧元旅行保险要求，介绍VFS Global和BLS递签地点、时间、费用和被拒原因。",
  h1: "新加坡申根签证申请：材料清单",
  lead: "如果你住在新加坡，护照需要申根签证，就要在新加坡向停留天数最长的国家递签，一般通过该国的签证中心提交。这篇指南按身份列出材料，说明旅行保险的要求，也讲清楚去哪里递、什么时候递、要花多少钱、哪些情况容易被拒。",
  glance: [
    { k: "谁在新加坡递签", v: "护照需要申根签证的新加坡居民，例如中国、印度、印尼、菲律宾、泰国、越南护照持有人" },
    { k: "向哪个国家递签", v: "停留天数最长的国家，天数相同则向第一个入境的国家" },
    { k: "什么时候递", v: "出发前6个月内，并且至少提前15天" },
    { k: "旅行保险", v: "保额至少3万欧元，覆盖整个申根区和全部行程" },
    { k: "签证费", v: "成人90欧元，另加签证中心服务费" },
  ],
  sections: [
    {
      id: "who-needs-a-visa",
      heading: "谁需要申根签证",
      body: [
        "看的是你手上的护照，不是你在新加坡持有的准证。新加坡护照和马来西亚护照免签进入申根区，任意180天内最多停留90天。申根区目前有29个欧洲国家，一张短期签证在批准的天数和入境次数内通用。",
        "中国、印度、印尼、菲律宾、泰国、越南护照需要签证，就算你持有EP、S Pass或新加坡永久居民身份也一样。你的护照不在表里，出行前请查欧盟免签国家名单（第2018/1806号条例）。更多内容见[申根签证页面](/visa/schengen)。",
      ],
      table: {
        head: ["护照", "申根签证", "在新加坡怎么办"],
        rows: [
          ["新加坡", "不需要", "任意180天内最多90天。见[新加坡护照免签国家指南](/guides/visa-free-countries-singapore-passport)"],
          ["马来西亚", "不需要", "任意180天内最多90天"],
          ["中国大陆", "需要", "在新加坡合法居住就在新加坡递签。见[中国护照持有人签证指南](/guides/visas-chinese-passport-holders-singapore)"],
          ["印度", "需要", "用你的新加坡准证证明居住。见[菲律宾和印度居民指南](/guides/visas-filipino-indian-residents-singapore)"],
          ["菲律宾", "需要", "向你选择的国家的签证中心递签，流程相同"],
          ["印尼、泰国、越南", "需要", "流程和基本材料相同"],
        ],
      },
    },
    {
      id: "which-country",
      heading: "选国家和签证中心",
      body: [
        "欧盟的规则是向停留时间最长的国家递签。各国天数相同，就向第一个入境的国家递签。只去一个国家，就向那个国家递签。一般还要向你合法居住地的领事机构递签，所以新加坡居民在新加坡递。机票和酒店要和你选的国家对得上。",
        "材料要在该国签证中心预约后亲自递交，并现场录指纹。签证由使馆决定，签证中心只负责收件。请在签证中心官网自己预约，不要通过中介。",
        "[VFS Global新加坡](https://visa.vfsglobal.com/sgp/en/deu/)负责好几个国家的申根签证。德国使馆页面写明VFS中心在Haw Par Centre（180 Clemenceau Avenue），荷兰使馆让新加坡居民去VFS Global，并要求每个人单独预约。意大利使馆通过BLS International收件，西班牙在新加坡的签证中心也由BLS运营。具体地址请看该国页面，地址会变。",
      ],
      table: {
        head: ["你的行程", "向哪国递签"],
        rows: [
          ["意大利8天，法国3天", "意大利，停留最长。见[意大利签证页面](/visa/italy)"],
          ["法国5天，意大利5天", "第一个入境的国家。见[法国签证页面](/visa/france)"],
          ["只去意大利", "意大利"],
        ],
      },
    },
    {
      id: "core-documents",
      heading: "所有人都要的材料",
      body: [
        "欧盟定了一份基本清单，各国再加自己的要求。打印材料之前，先打开目的国的清单。意大利使馆给新加坡申请人的清单最清楚，下面的内容以它为参照。",
      ],
      list: [
        "申请表：网上填写，打印并签名。未满18岁由父母共同签名。",
        "护照：离开申根区后至少还有3个月有效期。意大利还要求护照签发不满10年，有2页相对的空白页，本人已签名，并附上首3页复印件和近3年的申根签证复印件。",
        "照片：欧盟要求符合ICAO标准。意大利要求两张近照，白底，BLS写的是6个月内拍摄的4 x 5 cm彩色照片。详见[签证照片要求指南](/guides/visa-photo-requirements)。",
        "新加坡居住证明：意大利要求NRIC或FIN卡原件和正反面复印件，永久居民要出示有效的回头签（re-entry permit）。",
        "机票订单：意大利接受已确认、未付款的订单，申根国家之间的火车、航班、租车都要提供订单。",
        "住宿证明：酒店订单，或者申根区居民邀请你时的住宿声明。",
        "银行流水：近3个月。意大利要求带银行盖章的原件，必须是新加坡账户，不接受海外账户。",
        "旅行保险：下一节详细讲。",
      ],
    },
    {
      id: "by-applicant-type",
      heading: "按身份准备材料",
      body: [
        "你在新加坡的身份决定要补哪些证明。下表按意大利使馆2026年4月23日更新的清单整理。其他国家的要求类似，请当作参考，具体写法以你选的签证中心为准。",
        "各类证明信要用英文，有原件签名和公章，不能是电子版。意大利清单明确写了不接受彩色扫描件和电子签名。",
      ],
      table: {
        head: ["身份", "要补的材料"],
        rows: [
          ["在职（EP、S Pass、工作准证）", "FIN卡，加上公司抬头纸打印、写给使馆的在职证明。内容包括姓名、职位、入职日期、批准的假期、薪资，以及行程目的和日期。签署人要写明姓名、职位，并有原件签名和公司公章"],
          ["自雇", "FIN或NRIC，用ACRA Biz File代替在职证明，再加3个月银行流水"],
          ["学生（Student's Pass）", "学校出具、写给使馆的证明信，写明姓名、入学年份、行程目的和日期，并有校长姓名、原件签名和学校公章。父母出钱的话，担保人要签担保声明"],
          ["家属（Dependant's Pass）", "FIN卡。配偶或父母出钱的话，担保人要亲自到签证中心签担保声明。已婚申请人加交结婚证和配偶护照复印件。主准证持有人的准证复印件和工资单是否需要，请先问签证中心"],
          ["新加坡永久居民", "NRIC和有效回头签（原件加复印件），再加工作或生意证明和银行流水"],
          ["退休人士", "新加坡银行流水和居住证明。意大利清单没有退休人员一项，是否需要养老金证明，请先问签证中心"],
          ["未满18岁", "父母双方亲自到场，带上各自护照和孩子的出生证明。只有一方带孩子递签的话，另一方要到最近的意大利使馆或领事馆提交书面同意书"],
        ],
      },
    },
    {
      id: "travel-insurance",
      heading: "申根签证旅行保险",
      body: [
        "旅行保险是拿签证的条件。欧盟签证法典规定最低保额3万欧元，在申根国家境内有效，覆盖整个预计停留期间。使馆对保障范围的说法是紧急医疗、住院治疗，以及因医疗原因遣返，包括身故。欧盟内政总司页面列了同样三项，丹麦和瑞典使馆页面也重复了3万欧元和全程覆盖的要求。",
        "意大利驻新加坡使馆的写法有两种货币：保额最高3万欧元或5万新币，覆盖整个停留期间，保障范围为申根区或全球。BLS表示可以用任何有资质的保险公司，保单在签证中心提交。买之前，请在保单条款里核对下面这些。",
      ],
      list: [
        "保额：至少3万欧元，意大利也接受5万新币。意大利清单接受欧元、新币、美元三种货币。",
        "区域：覆盖全部申根国家。只保亚洲或只保一个国家的保单，不适合放进签证材料。",
        "日期：从入境当天到离境当天全程有保障。多次入境签证的保单要覆盖第一次行程。",
        "保障项目：紧急医疗、住院治疗、遣返。意大利要求保单写明完整保障内容和地理范围。",
        "姓名：保单上的名字和护照一致。每位旅客各有一份保单，小孩也一样。",
        "年龄：丹麦使馆写明，保单条款不能因年龄把医疗保障降到最低保额以下，年长的申请人要特别核对。",
        "证明：打印一份放进材料，手机里也存一份。瑞典使馆提醒，入境时可能被要求出示。",
      ],
    },
    {
      id: "timing-and-fees",
      heading: "递签时间和费用",
      body: [
        "最早出发前6个月可以递，最晚至少提前15天。有些签证中心的时间窗更短，例如西班牙在新加坡的中心写的是出发前最多3个月，请看你所选国家的页面。出签通常是15天，需要补材料时最长可到45天。",
        "意大利使馆表示通常5天内出签，BLS则写明至少要预留15个工作日。审理期间护照留在使馆，这段时间不要安排其他出行。旺季建议提前6到8周准备，出签之前先别买不能改的机票。",
        "欧盟页面写的签证费是成人90欧元，6到12岁儿童45欧元。意大利使馆公布的2026年第四季度新币价格是成人S$132.80、儿童S$66.40，6岁以下免费。费用在递交时收取，签证被拒一般不退。签证中心另收服务费，例如意大利在BLS的服务费是S$31。France-Visas页面写的法国新加坡中心申请费是34欧元。",
      ],
    },
    {
      id: "refusal-mistakes",
      heading: "容易被拒的情况",
      body: [
        "签证法典列出了拒签理由。旅游签证被拒，多数是因为材料没有说清楚行程、资金和回程计划。如果被拒，先看拒签通知，再读我们的[被拒后重新申请指南](/guides/visa-refused-reapply)。",
      ],
      list: [
        "选错国家：订单指向一个国家，申请却递给另一个国家。",
        "资金偏弱：流水对这趟行程来说偏低，或者递签前突然存入一大笔钱。意大利不接受海外账户。",
        "保险不合格：保额不够、生效日期太晚，或者没有覆盖整个申根区。",
        "目的不清楚：行程单里有几天没有交代。",
        "和新加坡的联系偏弱：准证有效期很短、没有在职证明，或者假期没有批准。",
        "信件有误：缺公章、用了电子签名或彩色扫描件。",
        "护照问题：离境后不足3个月、没有本人签名、没有相对的空白页。",
        "申请表、机票、酒店和保险上的日期互相对不上。",
      ],
    },
    {
      id: "ees-and-etias",
      heading: "EES和ETIAS最新情况",
      body: [
        "欧盟有两个新系统，影响的是边检，不是递签。根据eu-LISA，入境出境系统（EES）已于2026年4月10日全面启用。它以电子方式记录你的入境和出境，包括面部照片和指纹，并取代短期访客护照盖章。持签证的旅客同样适用，入境时会有这些检查。",
        "ETIAS是另一个系统，面向免签访客，所以主要影响新加坡和马来西亚护照持有人，持有签证的人不需要。欧盟页面写明ETIAS目前尚未运行，不接受申请，欧盟会在启动前数月公布日期。截至2026年11月25日，我们没有找到公布的日期。页面列出的费用是20欧元。",
        "两者都可能调整，出发前请查看[欧盟旅行信息网站](https://travel-europe.europa.eu/etias_en)。",
      ],
    },
    {
      id: "next-steps",
      heading: "下一步",
      body: [
        "先选定国家，再打开该国的清单。[申根签证页面](/visa/schengen)讲怎么选，[法国](/visa/france)和[意大利](/visa/italy)页面逐步讲这两个目的地。",
        "VIZA的协助是免费的，包括选国家、填表和材料检查。签证费交给使馆，服务费交给签证中心，两者都和VIZA无关。",
      ],
    },
  ],
  faq: [
    { q: "怎么在新加坡申请申根签证？", a: "选定停留天数最长的国家，填好该国申请表，在该国签证中心预约并亲自递交材料和护照。指纹在签证中心录取，由使馆决定是否出签。" },
    { q: "住在新加坡还需要申根签证吗？", a: "看你的护照。新加坡和马来西亚护照免签，任意180天内最多90天。中国、印度、印尼、菲律宾、泰国、越南护照需要签证，持有EP、S Pass或永久居民身份也一样。" },
    { q: "新加坡申请申根签证需要哪些材料？", a: "签名的申请表、护照、照片、新加坡居住证明、机票和住宿订单、近3个月银行流水和旅行保险。再按身份补在职证明、ACRA Biz File或学校证明信。" },
    { q: "新加坡申根签证一定要买旅行保险吗？", a: "要。最低保额3万欧元，在整个申根区有效，覆盖全部行程，保障紧急医疗、住院和遣返。意大利也接受5万新币。" },
    { q: "买申根签证保险时要核对什么？", a: "核对保额、区域、日期、遣返和住院保障，以及保单上有你的护照姓名。多次入境签证的保单要覆盖第一次行程。" },
    { q: "VFS Global新加坡申根签证中心在哪里？", a: "德国使馆写明VFS Global在Haw Par Centre（180 Clemenceau Avenue），荷兰使馆也让居民去VFS Global。地址会变，请看该国页面。意大利用的是BLS International。" },
    { q: "新加坡申根签证最早什么时候可以递？", a: "欧盟的规则是最早出发前6个月，最晚至少提前15天。西班牙在新加坡的中心写的是最多提前3个月，所以要看所选国家的页面。" },
    { q: "新加坡递申根签证要多少钱？", a: "成人90欧元，6到12岁儿童45欧元，6岁以下免费。意大利使馆公布的2026年第四季度成人价格是S$132.80。签证中心另收服务费，意大利在BLS是S$31。" },
    { q: "新加坡申根签证多久出签？", a: "通常15天，需要补材料时最长45天。意大利使馆表示常在5天内出签，BLS则写明至少预留15个工作日。" },
    { q: "家属准证和学生可以在新加坡递签吗？", a: "可以。家属和学生用FIN卡证明居住。在意大利的签证中心，配偶或父母作担保人要亲自到场签担保声明，学生还要补学校证明信。" },
    { q: "有申根签证还要办ETIAS吗？", a: "不用。ETIAS面向免签访客，目前还没有运行，欧盟没有公布开始日期。持有签证的人不需要申请ETIAS。" },
  ],
  sources: [
    { label: "EU home affairs, applying for a Schengen visa", url: "https://home-affairs.ec.europa.eu/policies/schengen/schengen-visas/applying-schengen-visa_en" },
    { label: "Embassy of Italy in Singapore, visa fees", url: "https://ambsingapore.esteri.it/en/servizi-consolari-e-visti/servizi-per-il-cittadino-straniero/visti/visas-fees/" },
    { label: "Embassy of Italy in Singapore, Tourist Visa Checklist updated 23.04.2026", url: "https://ambsingapore.esteri.it/wp-content/uploads/2026/04/Tourist-Visa-Checklist-UPDATED-ON-23.04.2026.pdf" },
    { label: "BLS International, Italy visa Singapore, tourist visa", url: "https://www.blsinternational.com/italy/singapore/touristvisa.php" },
    { label: "BLS Spain visa, Singapore", url: "https://singapore.blsspainvisa.com/" },
    { label: "Netherlands Worldwide, apply for a Schengen visa in Singapore", url: "https://www.netherlandsworldwide.nl/visa-the-netherlands/schengen-visa/apply-singapore" },
    { label: "German embassy Singapore, visa for visits up to 90 days", url: "https://singapur.diplo.de/sg-en/service/05-visaeinreise/1225488-1225488" },
    { label: "VFS Global, Germany visas, Singapore", url: "https://visa.vfsglobal.com/sgp/en/deu/" },
    { label: "EU home affairs, ETIAS", url: "https://home-affairs.ec.europa.eu/policies/schengen/smart-borders/european-travel-information-authorisation-system_en" },
    { label: "eu-LISA, Entry/Exit System fully deployed across the EU", url: "https://www.eulisa.europa.eu/news-and-events/news/entryexit-system-fully-deployed-across-eu" },
    { label: "Government of the Netherlands, ETIAS", url: "https://www.government.nl/topics/holidays-and-travels/etias" },
    { label: "Danish embassy, travel medical insurance", url: "https://um.dk/saudiarabien/en/travel-and-residence/practical-information/visa/travel-medical-insurance/" },
    { label: "Swedish embassy, medical travel insurance", url: "https://swedenabroad.se/en/about-sweden-non-swedish-citizens/china/going-to-sweden/visiting-sweden/medical-travel-insurance" },
    { label: "European Commission, Bulgaria and Romania join the Schengen area", url: "https://home-affairs.ec.europa.eu/news/bulgaria-and-romania-join-schengen-area-2025-01-03_en" },
  ],
  reviewed: "2026年11月25日核对来源：欧盟内政总司的申根签证和ETIAS页面、意大利驻新加坡大使馆（费用和2026年4月23日更新的旅游签证清单）、BLS International（意大利和西班牙）、荷兰和德国驻新加坡使馆页面、eu-LISA，以及丹麦和瑞典使馆的保险页面。规则会变，付款前请打开“来源”里的链接再确认。",
};

export default guide;
