import type { GuideContent } from "../types";

/**
 * 指南：电子旅行授权（ETA）和签证的区别，面向住在新加坡的人。写法按中文读者的习惯重写，不是英文版的直译。
 *
 * 2026 年 11 月 25 日核对的来源（当天打开读过）：
 *   - gov.uk：英国 ETA 申请页（20 英镑，有效期 2 年或到护照到期，通常一天内出结果，最长 3 个工作日）、ETA 说明页
 *     （每次最长 6 个月，不保证入境，每人一份）、可申请 ETA 的国家名单（新加坡和马来西亚在列，中国、印度、印尼、菲律宾、
 *     越南不在列）、标准访客签证申请页（135 英镑，先网上申请再录指纹，录指纹中心可能在另一个国家，通常 3 周内出结果，
 *     最早出行前 3 个月可申请）
 *   - 澳大利亚驻吉隆坡高级专员公署 ETA 页（服务费 20 澳元，只能用 ETA 应用，最长一年，每次停留最长 3 个月，建议至少提前 4 周）
 *   - k-eta.go.kr 指南页（10,000 韩元，通常 72 小时内，只在 k-eta.go.kr 或 K-ETA 应用办理）
 *   - 韩国驻新加坡大使馆公告列表（新加坡护照持有人到 2027 年 12 月 31 日免 K-ETA）
 *   - 韩国外交部新加坡公告（2025 年 12 月 24 日，免 K-ETA 的人仍可自愿付费申请，以免填入境卡）
 *   - canada.ca：eTA 申请页（7 加元，多数几分钟内批准）、eTA 说明页（最长 5 年或到护照到期，只在搭飞机时需要）、
 *     eTA 资格页、eTA-x 名单（15 个国家，含菲律宾和泰国，附条件）、按国家查入境要求页（新加坡在“搭飞机需 eTA”名单中）
 * 当天没能在官方页面确认的内容（正文已改成提示核对，或没有写）：
 *   - 澳大利亚：immi.homeaffairs.gov.au 返回 403。新加坡护照可申请 ETA 一事，依据是新加坡外交部澳大利亚页的搜索摘要
 *     （页面太大没抓下来）和本站 /visa/australia 页。访客签证（600）费用没有写具体数字。
 *   - 韩国：K-ETA 有效期（官网提到有调整，没读到数字）、新加坡护照最长停留天数、持 K-ETA 免填入境卡的豁免名单
 *     （报道和本站韩国页这样说，没在 e-arrivalcard.go.kr 读到）、其他护照的韩国豁免名单。k-eta.go.kr 上日期为 2026-11-23 的
 *     公告只看到标题。
 *   - 加拿大：马来西亚和印尼。eTA 申请页说部分公民可申请 eTA，eTA-x 名单里没有这两国。访客签证费用（100 加元加 85 加元
 *     指纹费）来自本站 /visa/canada 页（先前读自 canada.ca）。
 *   - 美国：新加坡属于免签证计划（VWP）一事，来自引用 travel.state.gov 的搜索结果和本站 /visa/united-states 页
 *     （国务院页面返回 403）。ESTA 费用没有写。任务说明写新加坡不在 VWP，但资料显示在，所以按资料写。
 *   - 欧洲：travel-europe.europa.eu 的 ETIAS 页只返回标题。欧盟尚未运行、没有公布启动日期，这一点来自本站 /visa/schengen 页；
 *     搜索结果对启动日期说法不一，所以正文要求出发前核对。20 欧元也没有在官方页面当面确认，所以正文不写金额。
 *   - 泰国：2026 年 9 月 15 日起免签 30 天、50 新元电子签、TDAC 的说明来自本站 /visa/thailand 页。
 */
const guide: GuideContent = {
  title: "ETA 和签证的区别：K-ETA、英国、澳洲、加拿大 | VIZA",
  description: "住在新加坡的人怎么看电子旅行授权和签证：韩国 K-ETA、英国 ETA、澳大利亚 ETA、加拿大 eTA 的费用、谁要办，持中国、印度等护照怎么办。",
  h1: "ETA 和签证的区别：K-ETA、英国 ETA、澳大利亚 ETA、加拿大 eTA 怎么办",
  lead: "ETA 是绑定护照的线上授权，不是签证，也不是入境卡。住在新加坡的人，看的是手里那本护照：新加坡护照、印度护照、中国护照，答案各不相同。下面按护照把英国、澳大利亚、韩国、加拿大讲清楚。",
  glance: [
    { k: "ETA 是什么", v: "给免签护照用的线上授权，和护照绑定" },
    { k: "新加坡护照", v: "去英国要办 ETA，去澳大利亚要办 ETA，搭飞机去加拿大要办 eTA。去韩国到 2027 年 12 月 31 日前不用 K-ETA" },
    { k: "费用", v: "英国 20 英镑，澳大利亚服务费 20 澳元，加拿大 7 加元，韩国 10,000 韩元" },
    { k: "其他护照", v: "护照不能办 ETA，就按手里的护照递签证" },
    { k: "在哪里办", v: "只用官方应用或官方网站，费用直接付给政府" },
  ],
  sections: [
    {
      id: "what-is-an-eta",
      heading: "ETA 是什么",
      body: [
        "ETA 的全称是电子旅行授权（Electronic Travel Authorisation）。免签证的旅客在网上填表、交一小笔费用，政府把批准结果绑在你的护照上。不用去使馆，不用面试，也不用交纸质材料，通常几分钟到几天就有结果。",
        "ETA 不保证入境。英国政府在 gov.uk 上写得很清楚，其他国家的做法也一样：到了口岸，由边检人员决定放不放行。",
        "看护照，不看准证。你持的是工作准证 EP、S Pass、家属准证、工作许可、学生准证，还是新加坡永久居民身份，都不改变规则。这些证件只在你递签证时用来证明你住在新加坡、在新加坡工作或读书。",
      ],
    },
    {
      id: "eta-visa-arrival-card",
      heading: "ETA、签证和入境卡",
      body: [
        "很多人把三样东西混在一起。ETA 是免签护照用的许可。签证是其他护照用的许可。入境卡是申报行程的表格，不是许可。",
        "一趟行程可能要同时办几样。新加坡护照去韩国，不用签证，也不用 K-ETA，但要在网上填免费的[韩国电子入境卡](/arrival-cards/korea-e-arrival-card)。泰国和新加坡也有自己的入境卡，见[泰国 TDAC 指南](/arrival-cards/thailand-tdac)和[新加坡 SG 入境卡指南](/arrival-cards/singapore-sg-arrival-card)。",
      ],
      table: {
        head: ["类型", "是什么", "给谁用", "例子"],
        rows: [
          ["ETA", "绑定护照的线上授权", "目的地免签的护照", "英国 ETA、澳大利亚 ETA、加拿大 eTA、韩国 K-ETA"],
          ["签证", "入境许可，要交材料，常要录指纹", "不在免签名单里的护照", "英国标准访客签证、澳大利亚访客签证、加拿大访客签证"],
          ["入境卡", "行程申报，不是许可", "几乎所有外国游客，有签证或 ETA 也要填", "韩国电子入境卡、泰国 TDAC"],
        ],
      },
    },
    {
      id: "uk-eta-singapore",
      heading: "新加坡出发办英国 ETA",
      body: [
        "新加坡和马来西亚都在英国的 ETA 名单上。英国 ETA 费用 20 英镑，有效期 2 年，或到护照到期，以先到的为准。每次最长停留 6 个月，有效期内可以多次往返。",
        "在英国 ETA 应用里扫护照和人脸就能申请，也可以在 gov.uk 上申请。通常一天内收到邮件结果，最长要 3 个工作日。邮件到手之前别订不能改的机票。每个人都要单独办，婴儿和小孩也一样。在新加坡办英国 ETA，步骤和在其他地方一样，因为全程在线。",
        "中国、印度、印尼、菲律宾和越南不在 ETA 名单上。gov.uk 写明其他国籍不能办 ETA，这些护照要递标准访客签证。6 个月的签证费是 135 英镑。先在网上申请，再预约签证中心录指纹。gov.uk 说录指纹的中心可能在另一个国家，所以预约时选新加坡。通常 3 周内出签，最早可在出行前 3 个月递签。",
        "不同准证要准备什么材料，见[新加坡出发办英国签证](/visa/united-kingdom)。",
      ],
    },
    {
      id: "australia-eta-visa",
      heading: "澳大利亚签证和 ETA",
      body: [
        "去澳大利亚，所有护照都要先拿到批准。新加坡外交部说，新加坡公民可以申请电子旅行授权（ETA，subclass 601）。想问“新加坡办澳大利亚签证能不能走 ETA”的人，答案就是这个。",
        "澳大利亚驻吉隆坡高级专员公署说，只能用澳大利亚 ETA 应用申请。ETA 没有签证申请费，应用另收 20 澳元服务费。ETA 可多次入境，最长一年，或到护照到期，以先到的为准。每次最长停留 3 个月。公署建议至少提前 4 周申请，每个人包括小孩都要单独办。",
        "同一页新加坡外交部公告还说，新加坡公民可以到新加坡的澳大利亚签证申请中心，申请长期有效的访客签证（subclass 600）。中国、印度、印尼、菲律宾和越南护照不走 ETA，要在网上递访客签证（subclass 600）。签证费用以澳大利亚内政部的收费表为准，付款前先核对。",
        "不同准证的材料清单见[新加坡出发办澳大利亚签证](/visa/australia)。",
      ],
    },
    {
      id: "korea-k-eta",
      heading: "韩国 K-ETA 和入境卡",
      body: [
        "K-ETA 是韩国给免签旅客用的线上旅行授权，费用 10,000 韩元，一般 72 小时内出结果。只在 k-eta.go.kr 或 K-ETA 应用上办。收费更高的网站不是政府网站。",
        "新加坡护照在韩国的临时豁免名单上。韩国驻新加坡大使馆公告说，新加坡护照持有人到 2027 年 12 月 31 日前免 K-ETA。也就是说新加坡公民短期去韩国，不用签证，也不用 K-ETA。但出发前 3 天内要填免费的电子入境卡。如果你自愿买一份 K-ETA，韩国方面说可以免填入境卡。",
        "住在新加坡、持其他护照的人，先在 K-ETA 资格名单里搜自己的国籍。在名单上的，登机前至少 72 小时办好 K-ETA。不在名单上的，要向韩国大使馆或签证中心递短期签证。签证怎么递，见[韩国 K-ETA 和签证](/visa/south-korea)。",
      ],
    },
    {
      id: "canada-eta-singapore",
      heading: "新加坡出发办加拿大 eTA",
      body: [
        "新加坡在加拿大“搭飞机需要 eTA”的名单上。加拿大 eTA 费用 7 加元，有效期最长 5 年，或到护照到期。多数申请几分钟内批准。少数人会先被要求补材料，说明会在 72 小时内发到邮箱。",
        "只有搭飞机到加拿大或在加拿大机场转机才要 eTA。开车、坐巴士、坐火车或坐船入境不用。要在 canada.ca 的官方表格上申请，表格只有英文和法文。表格不能存草稿，开始前先把护照和邮箱准备好。",
        "其他护照走另一条路。中国、印度和越南护照要递访客签证，费用 100 加元，另加 85 加元指纹费。菲律宾和泰国护照如果过去 10 年拿过加拿大访客签证，或申请当天持有有效的美国非移民签证，可以用 eTA 搭飞机入境。马来西亚和印尼护照，加拿大说部分公民可能符合 eTA 条件，所以递签证之前先用加拿大移民部的入境要求工具查一下。",
        "访客签证的细节见[新加坡出发办加拿大签证](/visa/canada)。",
      ],
    },
    {
      id: "four-etas-compared",
      heading: "四个 ETA 对照",
      body: [
        "下表是新加坡护照的情况，以及其他护照的出路。每一格都来自来源里列出的官方页面。",
      ],
      table: {
        head: ["", "英国 ETA", "澳大利亚 ETA", "韩国 K-ETA", "加拿大 eTA"],
        rows: [
          ["新加坡护照", "要办", "要办", "到 2027 年 12 月 31 日前不用", "搭飞机要办"],
          ["费用", "20 英镑", "服务费 20 澳元", "10,000 韩元", "7 加元"],
          ["有效期", "2 年或到护照到期", "最长 1 年或到护照到期", "以 K-ETA 官网为准", "最长 5 年或到护照到期"],
          ["每次停留", "最长 6 个月", "最长 3 个月", "以韩国大使馆页面为准", "由边检人员决定"],
          ["在哪里办", "英国 ETA 应用或 gov.uk", "只能用澳大利亚 ETA 应用", "k-eta.go.kr 或 K-ETA 应用", "canada.ca 在线表格"],
          ["多久出结果", "一天内，最长 3 个工作日", "建议至少提前 4 周", "一般 72 小时内", "多数几分钟内"],
          ["护照不能办 ETA 时", "标准访客签证", "访客签证 subclass 600", "短期签证", "访客签证"],
        ],
      },
    },
    {
      id: "thailand-us-europe",
      heading: "泰国、美国和欧洲",
      body: [
        "泰国没有 ETA，所以搜“泰国 ETA 签证”的人，其实要看另外三样东西。2026 年 9 月 15 日起，新加坡护照免签入境泰国，最长 30 天。要停更久，办泰国旅游电子签，在网上申请。每位游客入境前还要填免费的 TDAC，它是入境卡，不是签证，也不是 ETA。见[泰国签证](/visa/thailand)和[TDAC 指南](/arrival-cards/thailand-tdac)。",
        "美国有类似 ETA 的授权，叫 ESTA。新加坡属于美国免签证计划（VWP），新加坡护照短期去美国先办 ESTA。其他护照要递 B1/B2 签证。见[美国签证](/visa/united-states)。",
        "欧洲计划推出 ETIAS，给免签旅客用，新加坡护照也在其中。我们核对时 ETIAS 还没有运行，也没有查到确定的启动日期，订机票前请到欧盟旅行官网核对。进展见[申根签证](/visa/schengen)。",
      ],
    },
    {
      id: "next-steps",
      heading: "下一步",
      body: [
        "先在上面的表里找到你的护照，再打开目的地页面：[英国](/visa/united-kingdom)、[澳大利亚](/visa/australia)、[韩国](/visa/south-korea)或[加拿大](/visa/canada)。持中国、印度、菲律宾护照的人，可以看[中国护照在新加坡办签证指南](/guides/visas-chinese-passport-holders-singapore)和[菲律宾、印度居民办签证指南](/guides/visas-filipino-indian-residents-singapore)。哪些护照免签，见[新加坡护照免签国家指南](/guides/visa-free-countries-singapore-passport)。",
        "VIZA 的服务免费，VIZA 是独立的服务。ETA 费用、签证费和签证中心的费用，都直接付给相关机构，和 VIZA 无关。批不批准，由政府部门决定。",
      ],
    },
  ],
  faq: [
    { q: "ETA 和签证有什么区别？", a: "ETA 是免签护照用的线上授权，签证是给不免签的护照用的，通常要交材料，有时要录指纹。两者都不保证入境。" },
    { q: "K-ETA 是什么，新加坡人要办吗？", a: "K-ETA 是韩国给免签旅客用的线上旅行授权，费用 10,000 韩元。韩国驻新加坡大使馆说，新加坡护照持有人到 2027 年 12 月 31 日前免 K-ETA，所以不用办，但仍要填免费的电子入境卡。" },
    { q: "新加坡护照去英国要办 ETA 吗？", a: "要。新加坡在英国的 ETA 名单上。在英国 ETA 应用或 gov.uk 上申请，费用 20 英镑。" },
    { q: "在新加坡怎么申请英国 ETA？", a: "用英国 ETA 应用或 gov.uk，上传护照和人脸照片，在线完成。通常一天内邮件出结果，最长 3 个工作日，不用预约。" },
    { q: "英国 ETA 有效期多久？", a: "有效期 2 年，或到护照到期，以先到的为准。期间可多次往返，每次最长 6 个月。" },
    { q: "新加坡去澳大利亚要办 ETA 还是签证？", a: "新加坡公民在澳大利亚 ETA 应用上申请 ETA（subclass 601），应用另收 20 澳元服务费。中国、印度、印尼、菲律宾和越南护照要递访客签证（subclass 600）。" },
    { q: "新加坡护照去加拿大要办 eTA 吗？", a: "搭飞机到加拿大或在加拿大转机时要。eTA 费用 7 加元，有效期最长 5 年或到护照到期。陆路和海路入境不用。" },
    { q: "我住在新加坡，持印度护照或中国护照，能办 ETA 吗？", a: "去英国和加拿大不行。印度和中国不在英国 ETA 名单上，去加拿大两国护照都要访客签证。澳大利亚也要这两种护照递访客签证。按手里的护照递，新加坡的准证用来证明你住在这里。" },
    { q: "泰国有 ETA 签证吗？", a: "没有。泰国没有 ETA。新加坡护照免签最长 30 天，要停更久办旅游电子签，TDAC 是免费的入境卡。" },
    { q: "韩国电子入境卡和 K-ETA 是一回事吗？", a: "不是。K-ETA 是旅行授权，电子入境卡是抵达前 3 天内填的免费申报。韩国方面说持有 K-ETA 可以免填入境卡。" },
    { q: "新加坡护照去美国要办 ESTA 吗？", a: "要。新加坡属于免签证计划，短期去美国先办 ESTA。费用请在 ESTA 官网核对。" },
    { q: "欧洲的 ETIAS 开始运行了吗？", a: "我们在 2026 年 11 月 25 日核对时，ETIAS 还没有运行，也没有查到确定的启动日期。订机票前请到欧盟旅行官网核对。" },
  ],
  sources: [
    { label: "GOV.UK, apply for an ETA", url: "https://www.gov.uk/eta/apply" },
    { label: "GOV.UK, electronic travel authorisation guidance", url: "https://www.gov.uk/guidance/apply-for-an-electronic-travel-authorisation-eta" },
    { label: "GOV.UK, check when you can get an ETA", url: "https://www.gov.uk/guidance/check-when-you-can-get-an-electronic-travel-authorisation-eta" },
    { label: "GOV.UK, Immigration Rules Appendix ETA National List", url: "https://www.gov.uk/guidance/immigration-rules/immigration-rules-appendix-eta-national-list" },
    { label: "GOV.UK, apply for a Standard Visitor visa", url: "https://www.gov.uk/standard-visitor/apply-standard-visitor-visa" },
    { label: "Australian High Commission, ETA", url: "https://malaysia.embassy.gov.au/klpr/ETA.html" },
    { label: "Singapore MFA, Australia travel information", url: "https://www.mfa.gov.sg/travelling-overseas/travel-advisories-notices-and-visa-information/australia/" },
    { label: "K-ETA, official guide", url: "https://www.k-eta.go.kr/portal/guide/index.do" },
    { label: "Embassy of Korea in Singapore, K-ETA notices", url: "https://overseas.mofa.go.kr/sg-en/brd/m_2435/view.do?seq=761475" },
    { label: "Korea MOFA, K-ETA exemption extension", url: "https://www.mofa.go.kr/sg-ko/brd/m_11935/view.do?seq=1347008" },
    { label: "Korea Electronic Arrival Card platform", url: "https://www.e-arrivalcard.go.kr" },
    { label: "Canada.ca, apply for an eTA", url: "https://www.canada.ca/en/immigration-refugees-citizenship/services/visit-canada/eta/apply.html" },
    { label: "Canada.ca, eTA facts", url: "https://www.canada.ca/en/immigration-refugees-citizenship/services/visit-canada/eta/facts.html" },
    { label: "Canada.ca, entry requirements by country", url: "https://www.canada.ca/en/immigration-refugees-citizenship/services/visit-canada/entry-requirements-country.html" },
    { label: "EU travel site, ETIAS", url: "https://travel-europe.europa.eu/en/etias" },
  ],
  reviewed: "2026 年 11 月 25 日核对，来源包括 gov.uk、澳大利亚驻吉隆坡高级专员公署、新加坡外交部、k-eta.go.kr、韩国驻新加坡大使馆、Canada.ca 和欧盟旅行官网。澳大利亚内政部和美国国务院的页面当天打不开，访客签证费用、ESTA 费用和 ETIAS 启动日期请到官方网站核对。",
};

export default guide;
