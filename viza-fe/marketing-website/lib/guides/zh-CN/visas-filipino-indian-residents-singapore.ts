import type { GuideContent } from "../types";

/**
 * Guide: visas for Filipino and Indian passport holders living in Singapore (Simplified Chinese, written natively
 * for Chinese speakers in Singapore who help or advise Indian and Filipino colleagues, friends and family).
 *
 * Sources opened on 25 Nov 2026: ICA visa requirements and SG Arrival Card pages, High Commission of Singapore in
 * New Delhi (updated 11 Aug 2026), VFS Global Japan Visa Application Centre Singapore, Royal Thai Embassies in
 * Singapore and New Delhi, thailand.prd.go.th, Thai MFA country table PDF (file dated 20 May 2026), EU Home Affairs
 * (Schengen visa, EES and ETIAS article), gov.uk (Standard Visitor, visa national list), Embassy of Korea in
 * Singapore KVAC notice, Turkish MFA, Chinese Visa Application Service Centre Singapore.
 *
 * Not confirmed on an official page (the copy hedges, points to the official page, or leaves it out):
 *   - Japan: Embassy and MOFA pages returned HTTP 403. Visa needed for both passports rests on the VFS fee table and
 *     the repo Japan page. The rule that applicants must hold a valid Singapore pass came from a search summary of
 *     the Embassy FAQ. JAPAN eVISA availability for Singapore residents is unconfirmed. No fee for other
 *     nationalities is quoted. Embassy says 5 working days, VFS says 10 business days minimum, copy says 2 weeks or more.
 *   - Thailand: Royal Gazette text not read. India 30 day exemption rests on the Royal Thai Embassy New Delhi notice
 *     (27 Jul 2026) and the PRD notice (names no countries). The MFA table dated 20 May 2026 lists India under visa on
 *     arrival and is superseded. Singapore Embassy page is undated. Extension and land border rules left out.
 *   - Schengen: minimum insurance figure left out. Visa centre providers and service fees per country not confirmed.
 *   - UK: whether biometrics can be booked in Singapore is not stated on gov.uk, copy says choose when booking.
 *   - Korea: India and Philippines visa and K-ETA status not read on the K-ETA site. No Korean fee quoted.
 *   - Vietnam: portal failed its certificate check, so no fee, validity or visa free days for Philippine passports.
 *   - Indonesia: visa on arrival list, fee and the August 2026 proposed rise unconfirmed, so no fee is quoted.
 *   - Australia: Home Affairs returned HTTP 403, so no fee or processing time.
 *   - Turkiye: evisa.gov.tr eligibility page did not load, MFA page read. No e-Visa fee quoted.
 *   - China: no visa fee read on an official page. Visa free and transit lists not re-read.
 *   - Singapore: visa validity, Local Contact steps and the stay length for Filipino visitors not on the ICA pages.
 */
const guide: GuideContent = {
  title: "新加坡印度和菲律宾护照持有人办签证指南 | VIZA",
  description: "印度人去泰国要签证吗？住在新加坡的印度和菲律宾护照，办日本、申根、英国、韩国等签证的要求，以及在新加坡哪里递签。",
  h1: "住在新加坡的印度和菲律宾护照持有人怎么办签证",
  lead: "住在新加坡，持印度或菲律宾护照，规则由护照决定，居住身份只是向使馆证明你住在这里。日本、申根、英国、韩国、澳大利亚和中国要签证。自 2026 年 9 月 15 日起，泰国对两种护照都是 30 天免签，有些国家用电子签。本文按国家讲清楚，并说明在新加坡去哪里递签。",
  glance: [
    { k: "基本规则", v: "看护照，不看你住在哪里" },
    { k: "要签证", v: "日本、申根、英国、韩国、澳大利亚、中国，土耳其有条件办电子签" },
    { k: "短期免签", v: "泰国两种护照都免签。菲律宾护照去越南和印尼也免签" },
    { k: "在新加坡递签", v: "使馆、签证中心或网上系统，各国不同" },
    { k: "去新加坡", v: "印度护照要签证，菲律宾护照不在 ICA 的签证名单上" },
  ],
  sections: [
    {
      id: "overview",
      heading: "各国一览",
      body: [
        "下表是两种护照短期旅游的要求，以及住在新加坡时在哪里递签。每个国家的细节在后面各节。",
      ],
      table: {
        head: ["目的地", "印度护照", "菲律宾护照", "在新加坡怎么递签"],
        rows: [
          ["[日本](/visa/japan)", "要签证", "要签证", "VFS Global 运营的日本签证申请中心，代日本大使馆收件"],
          ["[泰国](/visa/thailand)", "免签 30 天", "免签 30 天", "不用签证。住更久办泰国电子签，通过泰国驻新加坡大使馆"],
          ["[申根](/visa/schengen)", "要签证", "要签证", "停留天数最多的那个国家的使馆或签证中心"],
          ["[英国](/visa/united-kingdom)", "要签证", "要签证", "先在英国签证与移民局网站申请，再到签证申请中心录指纹"],
          ["[韩国](/visa/south-korea)", "要签证，先查 K-ETA 名单", "要签证，先查 K-ETA 名单", "韩国签证申请中心，本人递交"],
          ["[越南](/visa/vietnam)", "电子签", "短期免签，天数要查", "越南电子签证网站"],
          ["[印尼](/visa/indonesia)", "落地签或 e-VOA", "旅游免签，天数要查", "网上电子签系统，或落地办理"],
          ["[澳大利亚](/visa/australia)", "访客签证", "访客签证", "澳大利亚内政部网上申请"],
          ["[土耳其](/visa/turkiye)", "有条件的电子签", "有条件的电子签", "电子签网站，或土耳其驻外使领馆"],
          ["[中国](/visa/china)", "要签证", "要签证", "中国签证申请服务中心，罗敏申路"],
        ],
      },
    },
    {
      id: "residence",
      heading: "居住身份的作用",
      body: [
        "规则由你的印度或菲律宾护照决定。工作准证 EP、S Pass、陪读准证或家属准证、学生准证、工作许可或新加坡永久居民身份，都不会改变规则。它们的作用是向使馆证明你住在新加坡，这样你才能在这里递签，不用回国。",
        "好几个机构都有这个要求。泰国驻新加坡大使馆说，电子签批准之前你要留在新加坡。韩国大使馆说，来新加坡短期停留的人不能在使馆递签。日本也受理住在新加坡的人递交的申请。",
        "大多数国家的材料清单大同小异。",
      ],
      list: [
        "护照：有效期要覆盖整个行程，有些国家要求回程后还剩六个月以上。",
        "准证复印件，正反两面。新加坡永久居民再加蓝色身份证，办泰国签证还要加回头签（Re-entry Permit）。",
        "近期的在职证明。韩国要求一个月内开具，有公司盖章和手写签名。",
        "本人名下的银行流水，一般两到六个月。韩国要三个月的工资账户流水，不收信用卡和境外账户的流水。",
        "机票和酒店订单，或亲友的邀请函。韩国要求批准前不要订票。",
        "近期照片，按各国规格。常见尺寸见我们的[签证照片要求指南](/guides/visa-photo-requirements)。",
      ],
    },
    {
      id: "japan",
      heading: "印度和菲律宾护照办日本签证",
      body: [
        "两种护照去日本都要签证。在新加坡，材料递交到 VFS Global 运营的日本签证申请中心。受理住在新加坡的人，请带上准证。完整的材料清单见[日本签证页面](/visa/japan)。",
        "VFS Global 页面按国籍列出了签证费。菲律宾申请人单次和多次入境都是 S$0，印度申请人两种都是 S$7。VFS 另收 S$22 服务费，不退。费用可能调整，以递交当天的标准为准。",
        "旅行前三个月内可以递签。VFS 说递交后至少要 10 个工作日，不接受加急，所以建议留两周以上。",
        "单次或两次入境，菲律宾和印度申请人都用“所有国籍”的观光材料清单。多次入境，菲律宾申请人用印尼、菲律宾、越南合并的清单，印度申请人用单独的印度清单。日本还有网上的 JAPAN eVISA，只对部分国家和地区开放，住在新加坡的人能不能用，请先看日本外务省页面，别急着按电子签安排行程。",
        "拿到签证后，出发前先设置好 [Visit Japan Web](/arrival-cards/japan-visit-japan-web)，入境和海关会快一些。",
      ],
    },
    {
      id: "thailand",
      heading: "印度护照去泰国要签证吗",
      body: [
        "印度人去泰国要签证吗？2026 年 9 月 15 日起，短期旅游不用。泰国政府的通知说，60 天免签方案已在这一天结束，改用 30 天方案。泰国驻新德里大使馆说，内阁在 2026 年 7 月 14 日批准了对印度护照的 30 天旅游免签。2026 年 5 月的一份表格曾把印度列为落地签，后来大使馆的通知已经取代了它。",
        "菲律宾护照在泰国的 30 天免签名单上。泰国驻新德里大使馆还说，停留超过 30 天，要在 thaievisa.go.th 申请电子签证。",
        "住在新加坡又想住得更久，可以通过泰国驻新加坡大使馆办旅游电子签。大使馆列出单次入境 S$50，有效期三个月，多次入境 S$250，有效期六个月，每次入境最长 60 天。请至少提前 21 个工作日递签，批准前要留在新加坡。",
        "单次入境，大使馆要三个月银行流水，余额不少于 S$800，还要往返机票、酒店订单，以及有效期至少还有两个月的准证复印件。多次入境要六个月流水，余额不少于 S$8,000，另加在职证明。",
        "所有旅客入境前还要填免费的[泰国数字入境卡](/arrival-cards/thailand-tdac)。更多见[泰国签证页面](/visa/thailand)。",
      ],
    },
    {
      id: "europe-uk",
      heading: "申根和英国签证",
      body: [
        "两种护照去申根区都要签证。向停留天数最多的国家递签，在使馆辖区内，也就是你合法居住的地方递交，对你来说就是新加坡。签证费成人 EUR 90，6 到 12 岁儿童 EUR 45，签证中心可能另收服务费。最早提前六个月递签，最晚出发前 15 天。一般 15 天出签，最长可到 45 天。见[申根签证页面](/visa/schengen)和[申根材料清单](/guides/schengen-visa-checklist-singapore)。",
        "欧盟出入境系统 EES 自 2026 年 4 月 10 日起在所有申根国家全面运行，会在边境记录护照信息、照片和指纹，持签证的人也一样。ETIAS 是给免签旅客的，持签证者不需要办，欧盟说计划在 2026 年第四季度启动。",
        "英国方面，印度和菲律宾都在英国的签证国民名单上，所以两种护照都用不了便宜的电子旅行许可。要在网上申请标准访客签证，六个月 GBP 135，通常三周内有结果。最早在出行前三个月申请，指纹和照片到签证申请中心录取，中心在预约时选择。gov.uk 说中心可能在别的国家，住在新加坡就选新加坡。更多见[英国签证页面](/visa/united-kingdom)。",
      ],
    },
    {
      id: "korea-china-vietnam",
      heading: "韩国、中国和越南",
      body: [
        "韩国。K-ETA 的临时豁免只惠及部分免签护照。印度和菲律宾护照请先查 K-ETA 国家名单，不在名单上就办短期签证。在新加坡要本人到韩国签证申请中心递交，朋友或旅行社不能代交。大使馆说审理要 8 个工作日，没有加急，审理期间护照留在使馆。单次入境签证有效期三个月。见[韩国签证页面](/visa/south-korea)，出发前还要提交免费的[电子入境卡](/arrival-cards/korea-e-arrival-card)。",
        "中国。两种护照都要签证。新加坡与中国互免签证只适用于新加坡护照。申请在罗敏申路 80 号的中国签证申请服务中心办理。先在网上填写申请，网上审核通过后再递交护照。递交和付款时间是周一到周五 9:00 至 15:00，取件是 9:00 至 16:00。出行前请查看中国免签名单和过境免签名单有没有你的护照。见[中国签证页面](/visa/china)。",
        "越南。印度护照要办电子签，在越南电子签证官网网上申请。菲律宾护照短期停留免签，不同名单对天数的说法不一，出发前请查越南移民局的名单。更多见[越南签证页面](/visa/vietnam)。",
      ],
    },
    {
      id: "indonesia-australia-turkiye",
      heading: "印尼、澳大利亚和土耳其",
      body: [
        "印尼。印度人去印尼办落地签，印度护照可以办落地签和 e-VOA，出发前在网上办 e-VOA 可以省去机场排队。费用由印尼移民局定，2026 年 8 月有调价的报道，请到官网查当前金额。菲律宾护照作为东盟国民，旅游免签，天数看移民局的名单。还要填免费的 [All Indonesia 入境卡](/arrival-cards/indonesia-all-indonesia)。见[印尼签证页面](/visa/indonesia)。",
        "澳大利亚。两种护照都用不了澳大利亚的 ETA，ETA 是给其他护照的。住在新加坡的印度或菲律宾人，要在澳大利亚内政部网站网上申请访客签证（子类 600）。费用见官方收费页面。见[澳大利亚签证页面](/visa/australia)。",
        "土耳其。土耳其外交部说，电子签只用于旅游或商务。印度护照持有人符合条件的话，可以办有效期一个月的单次入境电子签。菲律宾护照一般要办签证，持有有效的申根、美国、英国或爱尔兰签证或居留许可，可以办 30 天单次入境电子签。新加坡的准证不在这个名单里。没有符合条件的签证，就要到土耳其驻外使领馆递签。见[土耳其签证页面](/visa/turkiye)和[电子签指南](/guides/e-visa-vs-visa-on-arrival-vs-embassy-visa)。",
      ],
    },
    {
      id: "visiting-singapore",
      heading: "印度护照去新加坡的签证",
      body: [
        "这一节写给想来新加坡看你的亲友。ICA 列出的 33 个需要签证的国家和地区里有印度，菲律宾不在名单上，所以菲律宾护照来访不用签证。ICA 说停留多久由入境时发的 e-Pass 决定，不由签证决定。",
        "ICA 不在移民柜台受理签证申请。申请人通过新加坡驻外使领馆指定的授权签证代理递交，或到最近的使领馆。有 Singpass 或 Corppass 账户的本地联络人，是另一个途径。新加坡驻新德里高级专员公署说，本地联络人是年满 21 岁的新加坡公民或永久居民。",
        "高级专员公署的页面在 2026 年 8 月 11 日更新，列出的材料有 Form 14A、入境日起至少还有六个月有效期的护照和两张彩色照片。一般 3 到 5 个工作日出签。手续费 INR 2,100，不退，代理可能另收 INR 1,300。过境新加坡的印度公民，如果持有澳大利亚、加拿大、德国、日本、新西兰、瑞士、英国或美国的有效签证或长期准证，可能符合 ICA 的 96 小时免签过境安排。",
        "每位旅客都要在抵达前三天内提交免费的[新加坡入境卡 SG Arrival Card](/arrival-cards/singapore-sg-arrival-card)。ICA 不认可收费代交的公司。居民出行回来只需提交健康申报。",
      ],
    },
    {
      id: "next-steps",
      heading: "下一步",
      body: [
        "选择你要去的目的地页面：[日本](/visa/japan)、[泰国](/visa/thailand)、[申根](/visa/schengen)、[英国](/visa/united-kingdom)、[韩国](/visa/south-korea)、[越南](/visa/vietnam)、[印尼](/visa/indonesia)、[澳大利亚](/visa/australia)、[土耳其](/visa/turkiye)或[中国](/visa/china)。",
        "VIZA 是独立的服务，我们的协助免费。政府和签证中心的费用直接付给官方机构或签证中心，另行计算。如果被拒签，请看[被拒签后怎么重新递签](/guides/visa-refused-reapply)。",
      ],
    },
  ],
  faq: [
    { q: "印度人去泰国要签证吗？", a: "2026 年 9 月 15 日起，短期旅游不用。泰国驻新德里大使馆说，印度护照享有 30 天旅游免签。住更久请到 thaievisa.go.th 申请电子签，订票前先看大使馆页面。" },
    { q: "住在新加坡的印度人办泰国签证，在哪里递签？", a: "通过泰国电子签证系统网上递交，由泰国驻新加坡大使馆处理。大使馆要求至少提前 21 个工作日递签，批准前要留在新加坡。" },
    { q: "菲律宾人在新加坡怎么办日本签证？", a: "准备好观光材料清单，到 VFS Global 运营的日本签证申请中心递交，带上你的准证。VFS 列出菲律宾人的签证费是 S$0，另加 S$22 服务费。建议留两周以上。" },
    { q: "印度人在新加坡办日本签证要多少钱，多久出签？", a: "VFS Global 列出印度护照的签证费是 S$7，另加 S$22 服务费。VFS 说递交后至少要 10 个工作日。" },
    { q: "持印度或菲律宾护照，可以在新加坡递签吗？", a: "可以，前提是你持有效准证住在新加坡。日本、韩国和泰国要求你以居民身份在新加坡递签。申根方面，欧盟说一般在你合法居住的地方递签。" },
    { q: "印度护照在新加坡办英国签证的流程是什么？", a: "在网上申请标准访客签证，六个月 GBP 135，然后到签证申请中心录指纹和照片。gov.uk 说通常三周内有结果。" },
    { q: "印度人在新加坡办澳大利亚签证，能用 ETA 吗？", a: "不能。印度和菲律宾护照要在内政部网站网上申请访客签证（子类 600），当前收费见官方收费页面。" },
    { q: "印度护照办印尼落地签，现在还可以吗？", a: "印度护照可以办落地签和 e-VOA。费用由印尼移民局定，可能调整，请到官网查。" },
    { q: "印度人去土耳其要办电子签还是旅游签证？", a: "土耳其外交部说，印度护照持有人符合条件的话，可以办一个月的单次入境电子签。不符合的话，到土耳其驻外使领馆办签证。" },
    { q: "印度亲友来新加坡旅游，签证怎么办？", a: "印度护照来新加坡要签证。通过新加坡驻外使领馆指定的授权签证代理递交，或到最近的使领馆，有 Singpass 的本地联络人是另一个途径。还要提交免费的新加坡入境卡。" },
    { q: "菲律宾人去新加坡要签证吗？", a: "不用。菲律宾不在 ICA 的签证国家名单上。抵达前三天内提交免费的入境卡，停留多久由入境时发的 e-Pass 决定。" },
  ],
  sources: [
    { label: "ICA，进入新加坡的签证要求", url: "https://www.ica.gov.sg/enter-transit-depart/entering-singapore/visa_requirements" },
    { label: "ICA，新加坡入境卡 SG Arrival Card", url: "https://www.ica.gov.sg/enter-transit-depart/entering-singapore/sg-arrival-card" },
    { label: "新加坡驻新德里高级专员公署，签证信息", url: "https://new-delhi.mfa.gov.sg/consular-services/visa-information/" },
    { label: "VFS Global，新加坡日本签证申请中心", url: "https://www.vfsglobal.com/one-pager/japan/singapore/english/index.html" },
    { label: "泰国驻新加坡大使馆，旅游签证", url: "https://singapore.thaiembassy.org/en/page/tourist-visa" },
    { label: "泰国驻新德里大使馆，印度护照免签方案更新", url: "https://newdelhi.thaiembassy.org/en/content/latest-update-on-revision-to-thailand-s-visa-exemp" },
    { label: "泰国政府公共关系厅，2026 年 9 月 15 日起的免签措施", url: "https://thailand.prd.go.th/en/content/category/detail/id/48/iid/538547" },
    { label: "泰国外交部，免签国家表", url: "https://image.mfa.go.th/mfa/0/wdW3FTtVMc/2026-05-22/%E0%B8%95%E0%B8%B2%E0%B8%A3%E0%B8%B2%E0%B8%87%E0%B8%97%E0%B8%9A%E0%B8%97%E0%B8%A7%E0%B8%99%E0%B8%A1%E0%B8%B2%E0%B8%95%E0%B8%A3%E0%B8%81%E0%B8%B2%E0%B8%A3_ver._eng.pdf" },
    { label: "欧盟委员会，申请申根签证", url: "https://home-affairs.ec.europa.eu/policies/schengen/visa-policy/applying-schengen-visa_en" },
    { label: "欧盟委员会，EES 与 ETIAS 的区别", url: "https://home-affairs.ec.europa.eu/news/main-differences-between-ees-and-etias-what-travellers-need-know-2026-04-28_en" },
    { label: "GOV.UK，申请标准访客签证", url: "https://www.gov.uk/standard-visitor/apply-standard-visitor-visa" },
    { label: "GOV.UK，访客签证国民名单", url: "https://www.gov.uk/guidance/immigration-rules/immigration-rules-appendix-visitor-visa-national-list" },
    { label: "韩国驻新加坡大使馆，KVAC 与短期签证通知", url: "https://overseas.mofa.go.kr/sg-en/brd/m_2444/view.do?seq=761433" },
    { label: "土耳其外交部，外国人签证信息", url: "https://www.mfa.gov.tr/visa-information-for-foreigners.en.mfa" },
    { label: "中国签证申请服务中心新加坡", url: "https://www.visaforchina.cn/SGP4_EN/" },
  ],
  reviewed: "2026 年 11 月 25 日核对了 ICA、新加坡驻新德里高级专员公署、VFS Global、泰国驻新加坡和新德里大使馆、欧盟委员会、GOV.UK、韩国驻新加坡大使馆、土耳其外交部和中国签证申请服务中心的页面。日本、越南、印尼和澳大利亚的部分官方页面打不开，费用请到官网确认。",
};

export default guide;
