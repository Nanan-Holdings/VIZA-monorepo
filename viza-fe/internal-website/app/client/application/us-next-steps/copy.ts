import type { HelpArticleSection } from "@/components/client/help-article";

/**
 * "What to do after the DS-160" guide for applicants interviewing in mainland
 * China. Every fact here was checked on 2026-11-19 against the official
 * State Department appointment service for China (ustraveldocs.com/cn), the
 * U.S. Embassy & Consulates in China site and evus.gov. travel.state.gov was
 * not readable by automation, so anything only it states (reciprocity fees) is
 * phrased as "check the official table" rather than as a figure.
 * Re-check the figures when fees or delivery options change.
 */
export const US_NEXT_STEPS_CHECKED_ON = "2026-11-19";

export const US_OFFICIAL_LINKS = {
  infoSite: "https://www.ustraveldocs.com/cn/zh",
  scheduling: "https://www.usvisascheduling.com/",
  fees: "https://www.ustraveldocs.com/cn/zh/step-3",
  waiveInterview: "https://www.ustraveldocs.com/cn/zh/renew-visa",
  expedite: "https://www.ustraveldocs.com/cn/zh/expedited-appointment",
  interviewDay: "https://www.ustraveldocs.com/cn/zh/step-5",
  form221g: "https://www.ustraveldocs.com/cn/zh/221g",
  collection: "https://www.ustraveldocs.com/cn/zh/collection-locations",
  trackPassport: "https://www.ustraveldocs.com/cn/zh/step-6",
  ceacStatus: "https://ceac.state.gov/CEACStatTracker/Status.aspx",
  reciprocity:
    "https://travel.state.gov/content/travel/en/us-visas/Visa-Reciprocity-and-Civil-Documents-by-Country.html",
  evus: "https://www.evus.gov/",
  embassy: "https://china.usembassy-china.org.cn/visas/nonimmigrant-visas/",
} as const;

interface ChinaPost {
  code: string;
  nameZh: string;
  nameEn: string;
  cityZh: string;
  cityEn: string;
  addressZh: string;
  addressEn: string;
  /** Free CITIC Bank passport pickup / 221(g) drop-off office. */
  citicEn: string;
}

/** Visa-section addresses as listed on ustraveldocs.com/cn and the embassy site. */
export const CHINA_POSTS: readonly ChinaPost[] = [
  {
    code: "BEJ",
    cityZh: "北京",
    cityEn: "Beijing",
    nameZh: "美国驻华大使馆（北京）",
    nameEn: "U.S. Embassy Beijing",
    addressZh: "北京市安家楼路 55 号（No. 55 An Jia Lou Lu, Beijing 100600）",
    addressEn: "No. 55 An Jia Lou Lu, Beijing 100600",
    citicEn: "1F, Bldg E, No 8, Fuhua Mansion, Chaoyangmen North Street, Beijing",
  },
  {
    code: "SHG",
    cityZh: "上海",
    cityEn: "Shanghai",
    nameZh: "美国驻上海总领事馆",
    nameEn: "U.S. Consulate General Shanghai",
    addressZh: "上海市南京西路 1038 号梅龙镇广场 8 楼（Westgate Mall 8th Floor, Shanghai 200041）",
    addressEn: "1038 West Nanjing Road, Westgate Mall 8th Floor, Shanghai 200041",
    citicEn: "Pacific Plaza, GF, No 1168 Nanjing West Rd, Shanghai",
  },
  {
    code: "GUZ",
    cityZh: "广州",
    cityEn: "Guangzhou",
    nameZh: "美国驻广州总领事馆",
    nameEn: "U.S. Consulate General Guangzhou",
    addressZh:
      "广州市天河区珠江新城华夏路（地铁 3/5 号线珠江新城站 B1 出口附近）。面签申请人请走华夏路的领事客户入口（Consular Customer Entrance）。",
    addressEn:
      "Huaxia Road, Zhujiang New Town, Tianhe District, Guangzhou (near Exit B1 of Zhujiang New Town station, Lines 3 and 5). Visa applicants use the Consular Customer Entrance on Huaxia Road.",
    citicEn: "1st Floor, CITIC Plaza, No. 233 Tianhe Road (North), Tianhe District, Guangzhou",
  },
  {
    code: "SNY",
    cityZh: "沈阳",
    cityEn: "Shenyang",
    nameZh: "美国驻沈阳总领事馆",
    nameEn: "U.S. Consulate General Shenyang",
    addressZh:
      "沈阳市沈河区青年大街 185 号茂业天地 5 楼（地铁 2 号线市图书馆站 B 出口）。上午 10 点前进入商场请走领事处入口。",
    addressEn:
      "No 185 Qingnian Dajie, Maoye Tiandi Shopping Mall, 5th Floor, Shenhe District, Shenyang (Line 2 Shitushuguan station, Exit B). Before 10 AM, use the Consular Section entrance.",
    citicEn: "Branch Office, 336, Daxi Road, Shenhe District, Shenyang",
  },
  {
    code: "WUH",
    cityZh: "武汉",
    cityEn: "Wuhan",
    nameZh: "美国驻武汉总领事馆",
    nameEn: "U.S. Consulate General Wuhan",
    addressZh: "武汉市江岸区新华路 396 号民生银行大厦（Wuhan Minsheng Bank Building, 430015）",
    addressEn: "Wuhan Minsheng Bank Building, 396 Xinhua Road, Jiang'an District, Wuhan 430015",
    citicEn: "No. 2 Nanjing Road, Jiang'an District, Wuhan, Hubei",
  },
];

export interface UsNextStepsCopy {
  title: string;
  subtitle: string;
  topBackLabel: string;
  backLabel: string;
  sections: HelpArticleSection[];
}

function orderedPosts(postCode: string | null): ChinaPost[] {
  const code = postCode?.trim().toUpperCase() ?? "";
  const mine = CHINA_POSTS.find((post) => post.code === code);
  return mine ? [mine, ...CHINA_POSTS.filter((post) => post !== mine)] : [...CHINA_POSTS];
}

function zh(postCode: string | null, applicationId: string | null): UsNextStepsCopy {
  const posts = orderedPosts(postCode);
  const mine = posts[0]?.code === postCode?.trim().toUpperCase() ? posts[0] : null;
  return {
    title: "DS-160 提交后：预约面签全流程",
    subtitle: `从缴费、预约、面试当天到取回护照和办理 EVUS，一步步告诉你接下来做什么。信息核对自美国官方网站（${US_NEXT_STEPS_CHECKED_ON}）。`,
    topBackLabel: "提交结果",
    backLabel: "返回提交结果",
    sections: [
      {
        heading: "先准备好这两样",
        content: [
          {
            type: "list",
            items: [
              `DS-160 确认号（Application ID，以 AA 开头）${applicationId ? `：${applicationId}` : ""}。预约面试时要填写。`,
              "DS-160 确认页（带条形码），在提交结果页点「下载英文确认页 PDF」并打印，面试当天要带。",
              mine
                ? `你在 DS-160 上选择的面签地点是：${mine.nameZh}。预约时请选同一个地点。`
                : "预约时请选择你在 DS-160 上填写的面签地点（按居住地所属领区）。",
            ],
          },
        ],
      },
      {
        heading: "第 1 步：在官方预约网站缴纳签证申请费",
        content: [
          {
            type: "paragraph",
            text: "中国大陆的缴费和预约都在美国国务院授权的官方系统完成：信息网站 ustraveldocs.com/cn，登录、缴费和预约在 usvisascheduling.com。使馆声明这是唯一授权提供签证预约服务的网站，其他中介与使馆没有「特殊关系」。",
          },
          {
            type: "list",
            items: [
              "B1/B2 申请费：185 美元，网页以美元显示，实际按美国国务院领事汇率以人民币支付。",
              "费用不退、不可转让，无论是否获签。缴费后一年内需预约面试。",
              "支付方式：支付宝；中信银行网上支付（需中国银行卡，银联）；中信银行柜台现金（带护照和打印的缴费单）；中信银行智能柜台（银联借记卡）；或用信用卡以美元在线支付（可能有手续费）。",
              "先登录 usvisascheduling.com 建立个人资料，点 Start Application，选签证类型、领馆和类别后才会出现缴费页面。",
              "缴费后务必保存收据号（receipt number），遗失无法补，没有收据号无法预约。",
              "如果支付报错或不确定是否成功，不要再付一次（不会退款），先发邮件给 support-china@usvisascheduling.com 核查。",
              "官方无法开具发票或收据（fapiao/shouju）；用支付宝可在支付宝账单中找到付款凭证。",
            ],
          },
          {
            type: "links",
            items: [
              { label: "官方签证预约与缴费系统（usvisascheduling.com）", href: US_OFFICIAL_LINKS.scheduling },
              { label: "签证费用与支付方式说明（ustraveldocs.com）", href: US_OFFICIAL_LINKS.fees },
            ],
          },
        ],
      },
      {
        heading: "第 2 步：预约面试",
        content: [
          {
            type: "list",
            items: [
              "缴费后在同一系统选择面试日期和时间。时间先到先得，越早预约越容易约到想要的日期。",
              "官方建议至少提前 3 个月申请。北京使馆因多年无法招聘本地员工，处理量有限，等待时间可能较长。各领馆当前等待时间在 ustraveldocs 的预约页面可查。",
              "预约时会让你选择护照领取方式（见「取回护照」一节）。",
              "改约次数有限，请确定好时间再约，否则可能需要重新缴费。",
              "自 2025 年 10 月 1 日起，在中国申请的所有人（含 14 岁以下儿童和 80 岁以上老人）都必须亲自到使领馆面试，除非符合免面谈条件。",
              "免面谈（续签）的主要条件：续签同类 B1/B2 签证，上一张签证仍有效或过期不超过 12 个月，上次签发时已满 18 岁，上次已录十指指纹，旧签证没有丢失、被盗或被注销，且从未被拒签（或拒签已被推翻）。免面谈不是加急，处理可能需要数周。",
              "14 岁以下申请人必须预约面试，并由至少一位父母陪同，带出生证、户口本（如适用）、父母身份证件和结婚证的原件。",
              "加急面试仅适用于紧急就医、丧事、紧急商务、学生/交流访问者，或 ESTA/EVUS 被拒等情况，且须先缴费并预约最早的常规时间。婚礼、毕业典礼、年度会议或临时旅游不符合加急条件。",
            ],
          },
          {
            type: "links",
            items: [
              { label: "免面谈（续签）条件", href: US_OFFICIAL_LINKS.waiveInterview },
              { label: "加急面试申请条件", href: US_OFFICIAL_LINKS.expedite },
            ],
          },
        ],
      },
      {
        heading: "第 3 步：面试当天带什么",
        content: [
          {
            type: "list",
            items: [
              "预约确认信（每位面试者都要带，名单上没有的人不能进入）。",
              "有效护照，以及含有旧美国签证的旧护照。",
              "DS-160 确认页（带条形码）。",
              "一张近 6 个月内拍摄的彩色照片：5cm × 5cm、白色背景、正面、不得修图、不能戴眼镜或改变眼睛颜色的隐形眼镜。",
              "能说明你此行目的和回国约束的材料，签证官可能会要求查看（如在职/在读证明、行程安排、资金证明）。官方没有固定清单，以签证官要求为准。",
            ],
          },
          {
            type: "tip",
            text: "通知上的时间是你到达使领馆的时间，不是面试时间。不会提前放你进入；迟到超过 30 分钟需要重新预约。",
          },
        ],
      },
      {
        heading: "不能带进使领馆的东西",
        content: [
          {
            type: "paragraph",
            text: "使领馆不提供寄存，请把以下物品留在家中或交给同伴保管：",
          },
          {
            type: "list",
            items: [
              "所有包：旅行包、背包、公文包、手提袋、拉链文件袋等。",
              "所有电子设备（无论开关机）：手机、智能手表、手环、智能眼镜、蓝牙/WiFi 设备、电子钥匙和门禁卡、相机、电脑、U 盘、耳机等（助听器除外）。",
              "食物和饮料，包括瓶装水（婴儿食品可例外）。",
              "香烟、打火机、火柴；剪刀、指甲锉等尖锐物品；密封的信封或包裹。",
              "年长或残障申请人经使领馆同意可由一人陪同；其他陪同人员（包括律师）不能进入等候区。",
            ],
          },
        ],
      },
      {
        heading: "面签地点和开放时间",
        content: [
          ...posts.map((post) => ({
            type: "paragraph" as const,
            text: `${post === mine ? "【你的面签地点】" : ""}${post.nameZh}：${post.addressZh}`,
          })),
          {
            type: "tip",
            text: "官方没有公布签证处的固定开放时间，一律按预约通知上的时间入场。使领馆在中美两国法定假日均关闭，具体闭馆日期见使馆官网。",
          },
          {
            type: "links",
            items: [{ label: "使馆官网：非移民签证与联系方式", href: US_OFFICIAL_LINKS.embassy }],
          },
        ],
      },
      {
        heading: "面试结束后：三种结果",
        content: [
          {
            type: "list",
            items: [
              "通过：签证官会留下你的护照，签证通常在约 3 个工作日内处理完，再寄送或送到你选择的取件点。",
              "221(g)：表示缺少材料或需要行政审查，签证官会给你书面通知。如要求补材料，需送到中信银行文件递交点，由官方转交。行政审查时间因人而异，多数在 180 天内完成；除紧急情况外，需等满 180 天才能询问进度。",
              "拒签：签证官会当场告知。申请费不退；如要再次申请，需要重新提交 DS-160 并重新缴费预约。",
            ],
          },
          {
            type: "paragraph",
            text: "查询签证状态：打开美国国务院 CEAC 状态查询页，选择 NONIMMIGRANT VISA (NIV)、面签地点，输入 DS-160 确认号即可。",
          },
          {
            type: "links",
            items: [
              { label: "CEAC 签证状态查询（ceac.state.gov）", href: US_OFFICIAL_LINKS.ceacStatus },
              { label: "221(g) 说明与补交材料", href: US_OFFICIAL_LINKS.form221g },
            ],
          },
        ],
      },
      {
        heading: "取回护照",
        content: [
          {
            type: "list",
            items: [
              "EMS 优质送件上门：人民币 175 元（2026 年 11 月 23 日起，不分签证类型），含最高 3,500 元护照遗失保障。需在 vfs.gtspremium.com 预付，只送中国大陆地址。主要城市 2-3 个工作日，偏远地区 4-5 个工作日；EMS 会先联系你约送达时间，必须有人在场签收。",
              "中信银行网点自取：以下 5 个网点免费（不含遗失保障）。也可选择其他中信优质网点，费用 175 元（含遗失保障）。",
              ...posts.map((post) => `${post.cityZh}：${post.citicEn}`),
              "自 2026 年 8 月 1 日起，在北京、广州、上海、沈阳、武汉的标准网点取护照，需要收到「可领取」邮件后在官网预约取件时间。预约时填写领取人身份证号后六位，系统生成二维码，取件时出示。预约后不能取消或改期，迟到超过 30 分钟作废，可在第二天重新预约。",
              "护照只保留 30 天（从第一封可领取通知算起），逾期退回使领馆。",
              "面试当天 23:59 前可以修改送件地址或取件网点。",
            ],
          },
          {
            type: "links",
            items: [
              { label: "护照领取方式、地点与取件预约", href: US_OFFICIAL_LINKS.collection },
              { label: "追踪护照与修改送件地址", href: US_OFFICIAL_LINKS.trackPassport },
            ],
          },
        ],
      },
      {
        heading: "拿到签证之后：办理 EVUS",
        content: [
          {
            type: "list",
            items: [
              "收到护照后先核对签证页上的姓名、出生日期、护照号和签证类型。",
              "持中国护照和 10 年期 B1、B2 或 B1/B2 签证的人，每次赴美前都必须在 EVUS 登记，否则无法入境。",
              "官方网站是 evus.gov，费用 31.75 美元，可用 Visa、MasterCard、American Express、Discover、银联等支付。",
              "登记有效期两年，或到护照/签证到期为止（以先到者为准），到期需重新登记。",
              "请只在 evus.gov 办理，网上有收费更高的仿冒网站。",
            ],
          },
          {
            type: "links",
            items: [{ label: "EVUS 官方登记网站（evus.gov）", href: US_OFFICIAL_LINKS.evus }],
          },
        ],
      },
      {
        heading: "费用汇总",
        content: [
          {
            type: "list",
            items: [
              "签证申请费：185 美元（人民币支付，必交，不退）。",
              "签证签发费（互惠费）：是否收取以美国国务院按国家公布的互惠表为准；中国护照 B1/B2 一般为 10 年多次签证。",
              "护照寄送或优质网点领取：175 元人民币（可选；5 个标准中信网点免费）。",
              "EVUS 登记：31.75 美元（拿到 10 年 B 签证后、赴美前办理）。",
              "250 美元「签证诚信费」：美国已立法设立，但截至核对日，官方缴费页面未列出这项费用，也没有开始收取。如官方开始收取，会在缴费系统中显示。",
            ],
          },
          {
            type: "links",
            items: [{ label: "美国国务院互惠表（签发费与签证有效期）", href: US_OFFICIAL_LINKS.reciprocity }],
          },
        ],
      },
      {
        heading: "联系官方客服",
        content: [
          {
            type: "list",
            items: [
              "邮箱：support-china@usvisascheduling.com",
              "电话（中国境内）：+86 020 22890872（普通话/粤语）",
              "电话（美国境内）：+1 703 997 2809",
              "官方客服不能代你预约，预约请在网站上自行完成。",
            ],
          },
          {
            type: "tip",
            text: `本页信息核对自 ustraveldocs.com/cn、美国驻华使领馆官网和 evus.gov（${US_NEXT_STEPS_CHECKED_ON}）。费用和流程可能调整，请以官网为准。`,
          },
        ],
      },
    ],
  };
}

function en(postCode: string | null, applicationId: string | null): UsNextStepsCopy {
  const posts = orderedPosts(postCode);
  const mine = posts[0]?.code === postCode?.trim().toUpperCase() ? posts[0] : null;
  return {
    title: "After your DS-160: booking and attending your visa interview",
    subtitle: `Every step from paying the fee and booking the interview to getting your passport back and enrolling in EVUS. Checked against official U.S. government sites on ${US_NEXT_STEPS_CHECKED_ON}.`,
    topBackLabel: "Submission result",
    backLabel: "Back to submission result",
    sections: [
      {
        heading: "Have these two things ready",
        content: [
          {
            type: "list",
            items: [
              `Your DS-160 confirmation number (Application ID, starting with AA)${applicationId ? `: ${applicationId}` : ""}. You enter it when booking.`,
              "Your DS-160 confirmation page with the barcode. Download the English confirmation PDF from the result page and print it for the interview.",
              mine
                ? `The interview location on your DS-160 is ${mine.nameEn}. Book the same location.`
                : "Book the interview location you chose on your DS-160 (the consular district where you live).",
            ],
          },
        ],
      },
      {
        heading: "Step 1: Pay the visa application fee on the official site",
        content: [
          {
            type: "paragraph",
            text: "In mainland China, payment and booking go through the State Department's official service: information on ustraveldocs.com/cn, and sign-in, payment and booking on usvisascheduling.com. The Embassy says it is the only website authorized for visa appointments; no other business has a special relationship with the Embassy.",
          },
          {
            type: "list",
            items: [
              "B1/B2 application fee: USD 185, shown in USD and paid in RMB at the State Department's consular exchange rate.",
              "Non-refundable and non-transferable, whether or not a visa is issued. Book your interview within one year of paying.",
              "Payment options: Alipay; CITIC Bank online (China-issued UnionPay card); cash at a CITIC Bank counter (bring your passport and the printed deposit slip); CITIC Bank Smart Counter (UnionPay debit card); or a credit card online in USD (fees may apply).",
              "Create a profile on usvisascheduling.com first and choose Start Application; the payment screen appears after you pick visa type, post and category.",
              "Keep your receipt number. It cannot be replaced, and you cannot book without it.",
              "If a payment errors or you are unsure it went through, do not pay again (it will not be refunded). Email support-china@usvisascheduling.com first.",
              "No fapiao or shouju can be issued; Alipay users can find proof of payment in their Alipay records.",
            ],
          },
          {
            type: "links",
            items: [
              { label: "Official visa scheduling and payment (usvisascheduling.com)", href: US_OFFICIAL_LINKS.scheduling },
              { label: "Visa fees and payment options (ustraveldocs.com)", href: US_OFFICIAL_LINKS.fees },
            ],
          },
        ],
      },
      {
        heading: "Step 2: Book the interview",
        content: [
          {
            type: "list",
            items: [
              "After paying, pick a date and time in the same system. Slots go first come, first served.",
              "Apply at least three months before travel. The Embassy in Beijing has been unable to hire local staff since 2021, so its capacity is limited and waits can be long. Current waits per post are on the ustraveldocs booking page.",
              "You choose how to get your passport back while booking (see Getting your passport back).",
              "Reschedules are limited; running out may mean paying the fee again.",
              "Since October 1, 2025, every applicant in China, including children under 14 and adults over 80, must attend in person unless they qualify for an interview waiver.",
              "Main interview-waiver (renewal) conditions: renewing a B1/B2 visa that is still valid or expired within 12 months, you were at least 18 when it was issued, all 10 fingerprints were taken then, it was not lost, stolen or revoked, and you have never been refused (unless overcome). A waiver is not faster and can take several weeks.",
              "Applicants under 14 must attend an interview with at least one parent and bring originals of the birth certificate, hukou (if applicable), a parent's ID and the parents' marriage certificate.",
              "Expedited interviews are only for medical emergencies, funerals, urgent business, students and exchange visitors, or ESTA/EVUS denial, after paying and booking the earliest regular slot. Weddings, graduations, annual conferences and last-minute tourism do not qualify.",
            ],
          },
          {
            type: "links",
            items: [
              { label: "Interview waiver (renewal) rules", href: US_OFFICIAL_LINKS.waiveInterview },
              { label: "Expedited appointment rules", href: US_OFFICIAL_LINKS.expedite },
            ],
          },
        ],
      },
      {
        heading: "Step 3: What to bring on interview day",
        content: [
          {
            type: "list",
            items: [
              "Your appointment notice (everyone attending needs one; people not on it are not admitted).",
              "Your valid passport, plus old passports with previous U.S. visas.",
              "Your DS-160 confirmation page with the barcode.",
              "One color photo taken within six months: 5 cm × 5 cm, white background, facing forward, not edited, no glasses or eye-colour-changing contacts.",
              "Documents showing your trip purpose and ties at home that the officer may ask to see (employment or study proof, itinerary, funds). There is no fixed official list.",
            ],
          },
          {
            type: "tip",
            text: "The time on your notice is when to arrive, not when you will be interviewed. You will not be let in early, and arriving more than 30 minutes late means rebooking.",
          },
        ],
      },
      {
        heading: "What you cannot bring inside",
        content: [
          { type: "paragraph", text: "The Embassy and Consulates cannot store items for you. Leave these at home or with a companion:" },
          {
            type: "list",
            items: [
              "All bags: travel bags, backpacks, briefcases, handbags, zip folders.",
              "All electronics, on or off: phones, smart watches, fitness trackers, smart glasses, Bluetooth/WiFi devices, electronic keys and access cards, cameras, laptops, USB drives, headphones (hearing aids are fine).",
              "Food and drinks, including bottled water (baby food may be allowed).",
              "Cigarettes, lighters, matches; scissors, nail files and other sharp objects; sealed envelopes or packages.",
              "Elderly or disabled applicants may bring one helper at the post's discretion; other companions, including lawyers, cannot enter the waiting room.",
            ],
          },
        ],
      },
      {
        heading: "Interview locations and hours",
        content: [
          ...posts.map((post) => ({
            type: "paragraph" as const,
            text: `${post === mine ? "[Your interview location] " : ""}${post.nameEn}: ${post.addressEn}`,
          })),
          {
            type: "tip",
            text: "No fixed public hours are published for the visa sections; you enter at the time on your appointment notice. Posts close on both U.S. and Chinese public holidays; closure dates are on the Embassy website.",
          },
          { type: "links", items: [{ label: "Embassy website: nonimmigrant visas and contacts", href: US_OFFICIAL_LINKS.embassy }] },
        ],
      },
      {
        heading: "After the interview: three outcomes",
        content: [
          {
            type: "list",
            items: [
              "Approved: the officer keeps your passport. Visa processing typically takes about three working days, then the passport goes to the delivery or pickup option you chose.",
              "221(g): information is missing or administrative processing is needed; you get a written letter. If documents are requested, submit them at a CITIC Bank document office, which forwards them. Most administrative processing finishes within 180 days; except in emergencies, wait 180 days before asking about it.",
              "Refused: the officer tells you at the interview. The fee is not refunded; to apply again you need a new DS-160 and a new fee and appointment.",
            ],
          },
          {
            type: "paragraph",
            text: "Check your visa status on the State Department CEAC status page: choose NONIMMIGRANT VISA (NIV) and your interview location, then enter your DS-160 confirmation number.",
          },
          {
            type: "links",
            items: [
              { label: "CEAC visa status check (ceac.state.gov)", href: US_OFFICIAL_LINKS.ceacStatus },
              { label: "221(g) and submitting documents", href: US_OFFICIAL_LINKS.form221g },
            ],
          },
        ],
      },
      {
        heading: "Getting your passport back",
        content: [
          {
            type: "list",
            items: [
              "EMS Premium Home Delivery: RMB 175 (from November 23, 2026, any visa type), including up to RMB 3,500 cover if the passport is lost. Prepay at vfs.gtspremium.com; mainland China addresses only. 2–3 working days in main cities, 4–5 in remote areas; EMS calls to arrange a time and someone must be there to sign.",
              "Pickup at CITIC Bank: free at the five offices below (no loss cover), or RMB 175 at any other CITIC premium location (with loss cover).",
              ...posts.map((post) => `${post.cityEn}: ${post.citicEn}`),
              "Since August 1, 2026, pickup at the standard offices in Beijing, Guangzhou, Shanghai, Shenyang and Wuhan needs an appointment, which you can book only after the \"ready for pickup\" email. Enter the last six digits of the collector's ID; bring the QR code. Bookings cannot be changed; more than 30 minutes late cancels it, and you can rebook for the next day.",
              "Passports are held for 30 days from the first pickup email, then returned to the Embassy or Consulate.",
              "You can change the delivery address or pickup location until 11:59 p.m. on your interview day.",
            ],
          },
          {
            type: "links",
            items: [
              { label: "Passport return options, locations and pickup booking", href: US_OFFICIAL_LINKS.collection },
              { label: "Track your passport and change the delivery address", href: US_OFFICIAL_LINKS.trackPassport },
            ],
          },
        ],
      },
      {
        heading: "After you get the visa: enroll in EVUS",
        content: [
          {
            type: "list",
            items: [
              "When the passport comes back, check the name, date of birth, passport number and visa type on the visa.",
              "Holders of a PRC passport with a 10-year B1, B2 or B1/B2 visa must enroll in EVUS before travelling to the United States.",
              "The official site is evus.gov. The fee is USD 31.75, payable by Visa, MasterCard, American Express, Discover or UnionPay.",
              "Enrollment lasts two years or until your passport or visa expires, whichever is first; then enroll again.",
              "Use only evus.gov; look-alike sites charge more.",
            ],
          },
          { type: "links", items: [{ label: "Official EVUS enrollment (evus.gov)", href: US_OFFICIAL_LINKS.evus }] },
        ],
      },
      {
        heading: "Costs at a glance",
        content: [
          {
            type: "list",
            items: [
              "Visa application fee: USD 185 (paid in RMB; required; non-refundable).",
              "Visa issuance (reciprocity) fee: whether one applies is set by the State Department's reciprocity table by country; PRC B1/B2 visas are generally 10-year multiple-entry.",
              "Passport delivery or premium pickup: RMB 175 (optional; the five standard CITIC offices are free).",
              "EVUS: USD 31.75 (after you get a 10-year B visa, before travelling).",
              "USD 250 \"visa integrity fee\": created by U.S. law, but as of the check date it is not listed on the official fee pages and is not being collected. If it starts, the payment system will show it.",
            ],
          },
          { type: "links", items: [{ label: "State Department reciprocity table (issuance fees and validity)", href: US_OFFICIAL_LINKS.reciprocity }] },
        ],
      },
      {
        heading: "Contact the official help desk",
        content: [
          {
            type: "list",
            items: [
              "Email: support-china@usvisascheduling.com",
              "Phone in China: +86 020 22890872 (Mandarin/Cantonese)",
              "Phone in the U.S.: +1 703 997 2809",
              "The call center cannot book appointments for you; book on the website.",
            ],
          },
          {
            type: "tip",
            text: `Checked against ustraveldocs.com/cn, the U.S. Embassy & Consulates in China website and evus.gov on ${US_NEXT_STEPS_CHECKED_ON}. Fees and steps can change; the official sites take precedence.`,
          },
        ],
      },
    ],
  };
}

export function getUsNextStepsCopy(
  locale: string,
  options: { postCode?: string | null; applicationId?: string | null } = {},
): UsNextStepsCopy {
  const postCode = options.postCode ?? null;
  const applicationId = options.applicationId ?? null;
  return locale.toLowerCase().startsWith("zh") ? zh(postCode, applicationId) : en(postCode, applicationId);
}
