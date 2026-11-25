import type { GuideContent } from "../types";

/**
 * 在新加坡办理美国非移民签证和面签（简体中文，原创写法，不是英文逐句翻译）。
 *
 * Checked 25 Nov 2026. travel.state.gov, sg.usembassy.gov, ceac.state.gov and the Federal Register returned
 * HTTP 403, 502 or a redirect to the fetcher, and the Firecrawl credits were out, so official facts were read
 * through search summaries that quote the official pages, plus lib/visa-content/united-states.ts.
 * Pages opened: bu.edu ISSO visa integrity fee note (19 May 2026), taxnews.ey.com expedited pilot note.
 * Same list of unconfirmed facts as the English guide (en/us-visa-interview-singapore.ts). Not confirmed on an
 * official page (hedged or left out):
 *   - Name of the Singapore booking site for nonimmigrant visas (copy says use the link on the Embassy page).
 *   - Whether Singapore runs the B1/B2 renewal waiver (dropbox) in practice.
 *   - Visa Integrity Fee (USD 250 by law): whether Singapore collects it, when, and refunds. No total given.
 *   - Fees for H, L, O, P, Q and E visas, and the SEVIS fee amount. No figure given.
 *   - Embassy security list for nonimmigrant interviews (wording is from the Singapore supplement page).
 *   - Whether Singapore joins the USD 750 expedited B1/B2 pilot (1 Jul to 31 Dec 2026).
 *   - Singapore wait time and passport return time. No numbers given.
 *   - Scope of the social media rule after December 2025. Copy lists F, M, J, H-1B and H-4 and says to check.
 *   - Photo pixel size. Copy points to the photo guide.
 */
const guide: GuideContent = {
  title: "新加坡美国签证申请与面签指南 | VIZA",
  description:
    "住在新加坡怎么申请美国签证：DS-160、签证费、预约美国大使馆面签、材料清单、常见问题，还有 EP、S Pass 持有人怎么证明回国约束。免费指南。",
  h1: "在新加坡申请美国签证和面签",
  lead: "住在新加坡申请美国签证，几乎所有人都要到美国驻新加坡大使馆面签。不管持哪国护照，流程都一样：填 DS-160，交签证费，预约，面签。这篇指南讲清楚谁要面签、怎么预约、当天带什么、签证官常问什么，也包括 EP 和 S Pass 持有人最常被问的回国约束问题。",
  glance: [
    { k: "面签", v: "自 2025 年 10 月 1 日起，几乎所有申请人都要面签，免面签只剩少数情况" },
    { k: "在哪里递签", v: "在国籍所在国或居住国办理。住在新加坡的人在美国驻新加坡大使馆预约" },
    { k: "流程", v: "DS-160，交费，预约，面签，取回护照" },
    { k: "访客签证费", v: "B1/B2 为 185 美元。付款前先看官方页面有没有其他费用" },
    { k: "等待时间", v: "每月都在变，请看美国国务院的签证等待时间页面" },
  ],
  sections: [
    {
      id: "who-attends",
      heading: "谁需要面签",
      body: [
        "自 2025 年 10 月 1 日起，美国国务院要求几乎所有非移民签证申请人亲自到场，由领事官员面谈。14 岁以下的孩子和 79 岁以上的长者，以前不少人可以免面谈，现在一般也要到场。",
        "还有少数人可以免面签，也就是大家常说的 dropbox。最常见的是 B-1、B-2 或 B1/B2 签证续签。条件是：新申请在旧签证到期后 12 个月内提交，旧签证当时是按完整有效期签发的，申请人年满 18 岁。同时要在你的国籍国或居住国递签，没有被拒签过（被拒后已经解决的除外），也没有明显的不符合资格的情况。外交和公务类别另有一份免面谈名单。",
        "即使符合免面签条件，签证官仍然可以要求你到场。如果你在新加坡续签美国签证，预订前先看[美国驻新加坡大使馆的签证页面](https://sg.usembassy.gov/visas/)，确认使馆怎么处理免面签的案子。",
      ],
    },
    {
      id: "where-to-apply",
      heading: "在新加坡哪里递签",
      body: [
        "美国国务院说，非移民签证申请人应当在国籍国或居住国的美国使领馆预约面签。如果按居住地申请，要准备好证明你确实住在当地。持 EP、S Pass、Dependant's Pass、工作准证、学生准证或 PR 卡住在新加坡的人，一般都在美国驻新加坡大使馆预约。",
        "到别的国家递签，等位时间可能长很多。如果订在你没有资格的地点，签证费不退，也不能转到别的使领馆。紧急情况下有少数例外。护照决定你需不需要签证，居住地决定你去哪里递签。",
      ],
      table: {
        head: ["护照", "短期出行的办法", "下一步"],
        rows: [
          ["新加坡", "ESTA，最多停留 90 天，不用面签", "在美国海关边境保护局的 ESTA 官网申请。停留更久，或者不能用 ESTA 的，才办 B1/B2 签证。"],
          ["中国、印度、马来西亚、印尼、菲律宾、越南", "B1/B2 签证，需要面签", "在新加坡按下面的步骤办理。可以先看[中国护照指南](/guides/visas-chinese-passport-holders-singapore)和[菲律宾与印度护照指南](/guides/visas-filipino-indian-residents-singapore)。"],
          ["其他护照", "先查免签证计划（Visa Waiver Program）名单", "不在名单上就办 B1/B2 签证。"],
        ],
      },
    },
    {
      id: "steps",
      heading: "递签步骤",
      body: [
        "需要签证的人，流程都一样。建议在计划出发前几个月就开始，因为预约等位和可能的额外审查都不在你控制之内。各国护照的详细情况可以看[美国签证页面](/visa/united-states)。",
      ],
      table: {
        head: ["步骤", "要做什么", "要保存"],
        rows: [
          ["1. DS-160", "在美国国务院网站 ceac.state.gov 填写在线非移民签证申请表，照片要符合[签证照片要求](/guides/visa-photo-requirements)。", "带条形码的确认页"],
          ["2. 交费", "按使馆指示交签证申请费，每人一份。", "付款收据"],
          ["3. 预约", "从美国驻新加坡大使馆签证页面上的链接预约面签，一般要绑定 DS-160 和付款收据。", "预约确认信"],
          ["4. 面签", "带护照、材料和确认信到使馆。指纹在使馆现场采集。", "护照，或使馆给你的凭条"],
          ["5. 出签结果", "获批的话，护照会带着签证寄回。需要额外审查的话，签证官会给你一封信。", "签证官给的任何信件"],
        ],
      },
    },
    {
      id: "fees",
      heading: "签证费和其他费用",
      body: [
        "下面的费用都由美国政府规定，直接交给美国政府或使馆的付款渠道。VIZA 的协助免费，也不从这些费用里抽成。访客、留学和交流类签证（B、F、M、J）的标准申请费是 185 美元，这是美国国务院费用页面上的数字，2026 年 11 月 25 日核对过。H、L 这类需要雇主申请的签证，以及 E 签证，同一页面上有各自的金额。",
        "此外还可能有其他费用。留学生和交流访问学者还要交 SEVIS 费。2025 年 7 月，美国通过法律设立了每张签证 250 美元的签证诚信费（Visa Integrity Fee）。一所大学 2026 年 5 月 19 日发布的说明提到，部分使领馆已经开始收，而且是批准后出签时才交，不是预约时交。新加坡使馆是否收、什么时候收，目前没有核实到，付款前请看使馆页面和费用页面。",
        "临时规定还设立了一项自愿选择的 750 美元加急费，用于在部分使领馆更早预约 B1/B2 面签，实施期是 2026 年 7 月 1 日到 12 月 31 日。它加在签证费之上，只是换一个更早的预约时间。新加坡是否参加，请看美国国务院公布的参与使领馆名单。",
      ],
      list: [
        "标准签证费在被拒签后不退。",
        "新加坡护照的 ESTA 是另外在美国海关边境保护局官网付款。",
      ],
    },
    {
      id: "bring-and-day",
      heading: "面签带什么材料和当天流程",
      body: [
        "只带面签需要的东西。签证官一般很少翻材料，你在被问到时再递上去。材料整理得整齐，回答起来就快。",
        "使馆在新加坡的指引里写明，访客不能带电池供电的电子设备、大件包或行李、食物和液体进入，拒绝安检的人也不能进入。这段文字写在使馆的移民签证页面上，所以请以你自己的预约确认信为准。手机、电脑、能连手机的手表、大包和饮料最好都留在家里。轻装出门，早一点到，因为安检需要时间。",
        "当天的顺序是：安检，排一小段队，核对材料和采集指纹，然后到窗口面谈。面谈一般很短，在窗口进行。签证官提问，可能收走材料，最后告诉你结果。问什么答什么，回答简短，说实话。DS-160 或面谈里有虚假陈述，可能带来很长时间的入境禁令。",
        "F、M、J、H-1B 和 H-4 申请人还要把社交媒体账号设为公开，并在 DS-160 上填报账号。H-1B 和 H-4 的要求从 2025 年 12 月起生效，目前适用范围请看美国国务院的公告。",
      ],
      list: [
        "护照，有效期要覆盖整个行程，另外带上有美国签证的旧护照。",
        "DS-160 确认页，要带条形码。",
        "预约确认信，使馆要求的话再带签证费收据。",
        "只有使馆要求纸质照片时才带一张近照，DS-160 里已经有电子照片。",
        "按你的签证类型准备材料：在职证明和工资单（旅游探亲类）；F-1 带 I-20；J 带 DS-2019；H-1B 和 H-4 带获批的申请通知。",
        "你的新加坡准证卡（EP、S Pass、Dependant's Pass、学生准证或 PR 卡），让签证官看到你住在哪里。",
      ],
    },
    {
      id: "questions",
      heading: "面签常见问题",
      body: [
        "签证官决定得很快，所以一两句话的清楚回答最好。下面的例子只是参考，请用你自己的真实情况回答，并且要和 DS-160 一致。",
      ],
      table: {
        head: ["签证", "常见问题", "回答示例"],
        rows: [
          ["B1/B2", "你这次去美国做什么？", "和太太去加州玩两个星期。酒店已经订好，我也请好了假。"],
          ["B1/B2", "谁出旅费？", "我自己，用工资付。银行流水能看到我的存款。"],
          ["B1/B2", "你在新加坡做什么工作？", "我是市场经理，持 EP，在这家公司做了四年。"],
          ["F-1", "为什么选这所大学和这个专业？", "这所学校有我需要的数据科学课程，我拿到了奖学金。毕业后我打算回来在这个行业工作。"],
          ["F-1", "谁支付你的学费？", "我父母出，银行流水和资助信我都带来了。"],
          ["H-1B", "你在美国公司做什么？", "我在支付团队做软件工程师。雇主已经递交了申请，我的学位和这个职位对口。"],
          ["任何签证", "你以前被美国拒过签吗？", "如实回答有或没有，被问到时简单说明原因。"],
        ],
      },
    },
    {
      id: "strong-ties",
      heading: "EP 和 S Pass 的回国约束",
      body: [
        "签证官要相信你访问后会回新加坡。多数 B1/B2 拒签，背后都是这个问题，对应的是美国移民法 214(b) 条。EP 和 S Pass 持有人经常被问到这一点，因为准证和工作、年限挂钩。",
        "所谓约束，都是很实在的东西：稳定的工作和批准的假期、租约或自己的房子、同住的家人、与行程相称的存款，以及出国后按时回来的记录。在新加坡住得久、在现公司做得久，都有加分。Dependant's Pass 持有人要证明和主申请人的关系，也要展示主申请人的工作和收入。PR 持有人带上工作证明、税单和再入境许可。",
        "不用带一大堆材料。带一份写明职位、薪水和批准休假日期的在职证明、近期工资单、近期个人银行流水、准证卡，还有你的回程安排就够了。申请前不久突然存入大笔资金，容易引起问题，要准备好说明钱从哪里来。",
      ],
    },
    {
      id: "delays",
      heading: "221(g)、拒签和等位时间",
      body: [
        "如果签证官当场没办法决定，你可能会收到一封 221(g) 的信，也就是很多人说的白条。信里会列出要补交的材料，或者告诉你案子需要进一步的行政审查。美国国务院说，处理时间因案而异，材料或审查完成后，签证官可以重新考虑。221(g) 不是最终拒签。CEAC 网站上的状态可能显示 refused，案子其实还没有结束，所以请看你收到的那封信。",
        "214(b) 拒签只针对那一次申请。美国国务院说，你可以带着情况已经改变的证据再次申请，并且要再交一次费用。重新递签之前，先看[被拒签后怎么办](/guides/visa-refused-reapply)。没有人能保证出签，VIZA 也不能。",
        "预约等位时间每月都在变，也因签证类型而不同。美国国务院在全球签证等待时间页面上公布新加坡的数字，请看那个页面，不要用文章里的数字。",
      ],
    },
    {
      id: "next-steps",
      heading: "下一步",
      body: [
        "先在[美国签证页面](/visa/united-states)对照你的护照，选好签证类型，然后填 DS-160，到美国驻新加坡大使馆签证页面预约。也可以对比其他办法：[ETA 和签证有什么不同](/guides/eta-vs-visa)、[电子签、落地签和使馆签证](/guides/e-visa-vs-visa-on-arrival-vs-embassy-visa)。",
        "VIZA 的协助免费。政府和签证中心的费用直接交给相关机构，是另外的费用。VIZA 不是美国政府，也不是美国大使馆。",
      ],
    },
  ],
  faq: [
    {
      q: "在新加坡怎么申请美国签证？",
      a: "先在网上填 DS-160，交签证费，再从美国驻新加坡大使馆签证页面上的链接预约面签，当天带护照和材料到场。需要签证的护照，步骤都一样。",
    },
    {
      q: "在新加坡办美国签证一定要面签吗？",
      a: "几乎都要。自 2025 年 10 月 1 日起，美国国务院收紧了免面谈的范围。最主要的一类是 B-1、B-2 或 B1/B2 续签：旧签证到期后 12 个月内，旧签证按完整有效期签发，并且申请人年满 18 岁。",
    },
    {
      q: "美国签证在新加坡怎么预约？",
      a: "交完 DS-160 和签证费后，用美国驻新加坡大使馆签证页面上的预约链接。预约时间经常变动，具体流程看使馆页面，时间长短看美国国务院的签证等待时间页面。",
    },
    {
      q: "不是新加坡公民，能在新加坡申请美国签证吗？",
      a: "可以，前提是你住在新加坡。美国国务院说，申请人应在国籍国或居住国预约，按居住地申请的要准备好证明自己住在当地。准证卡和在职证明就是证明。",
    },
    {
      q: "在新加坡办美国签证要多少钱？",
      a: "B1/B2、F、M、J 签证的标准费用是 185 美元，2026 年 11 月 25 日核对过。法律还设立了 250 美元的签证诚信费，部分使领馆已开始在出签时收取。付款前请看使馆页面和费用页面。",
    },
    {
      q: "新加坡美国签证要多久出签？",
      a: "面签日期由使馆安排，美国国务院在等待时间页面公布新加坡当前的等位时间。有些案子面签后还要额外审查，所以出发前要留出余量。",
    },
    {
      q: "去美国驻新加坡大使馆面签要带什么？",
      a: "带护照、DS-160 确认页、预约确认信、新加坡准证卡和你的辅助材料。电子设备、大包、食物和饮料留在家里，完整清单以确认信为准。",
    },
    {
      q: "美国签证面签会问什么问题？",
      a: "签证官会问行程目的、谁出钱、你的工作或学业，以及你和新加坡的联系。学生会被问学校和专业，H-1B 申请人会被问雇主和职位。",
    },
    {
      q: "EP 和 S Pass 持有人需要证明回国约束吗？",
      a: "需要，和所有申请人一样。展示稳定的工作和批准的假期、与行程相称的存款、在新加坡的家人或住房，以及按时回来的记录。在职证明、工资单和银行流水基本就够了。",
    },
    {
      q: "美国签证 221(g) 是什么意思？",
      a: "意思是签证官需要更多材料，或者需要更多审查才能决定。你会收到一封信，写明是哪一种。221(g) 不是最终拒签，审查完成后签证官可以重新考虑。",
    },
    {
      q: "在新加坡续签美国签证可以免面签吗？",
      a: "有时可以。B1/B2 在到期后 12 个月内续签，如果旧签证按完整有效期签发、你年满 18 岁、也没有被拒过签，就可能免面签。使馆仍然可以要求你到场，所以先看使馆的签证页面。",
    },
    {
      q: "新加坡护照去美国需要面签吗？",
      a: "停留 90 天以内不需要。新加坡护照旅游和商务用 ESTA。停留更久，或者不能用 ESTA 的，才办签证和面签。",
    },
  ],
  sources: [
    { label: "US Embassy Singapore, visas", url: "https://sg.usembassy.gov/visas/" },
    { label: "US Embassy Singapore, Visa Navigator", url: "https://sg.usembassy.gov/visa-navigator/" },
    { label: "US Department of State, interview waiver update, 18 Sep 2025", url: "https://travel.state.gov/content/travel/en/News/visas-news/interview-waiver-update-sept-18-2025.html" },
    { label: "US Department of State, applying in country of nationality or residence", url: "https://travel.state.gov/content/travel/en/News/visas-news/adjudicating-niv-applicants-in-their-country-of-residence.html" },
    { label: "US Department of State, fees for visa services", url: "https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/fees/fees-visa-services.html" },
    { label: "US Department of State, global visa wait times", url: "https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/global-visa-wait-times.html" },
    { label: "US Department of State, visa denials", url: "https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/visa-denials.html" },
    { label: "US Department of State, administrative processing", url: "https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/administrative-processing-information.html" },
    { label: "US Department of State, expanded screening and vetting", url: "https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/visas-news-archive/announcement-of-expanded-screening-and-vetting-for-visa-applicants.html" },
    { label: "DS-160 online nonimmigrant visa application", url: "https://ceac.state.gov/genniv/" },
    { label: "ESTA, US Customs and Border Protection", url: "https://esta.cbp.dhs.gov/" },
    { label: "Federal Register, expedited B1/B2 appointment fee, 9 Jun 2026", url: "https://www.govinfo.gov/content/pkg/FR-2026-06-09/html/2026-11513.htm" },
  ],
  reviewed:
    "2026 年 11 月 25 日核对，依据美国国务院（免面签、居住地规定、费用、拒签、等待时间）、美国驻新加坡大使馆签证页面和联邦公报。部分官方页面我们的检查工具打不开，付款或预约前请点开「来源」里的链接再确认。",
};

export default guide;
