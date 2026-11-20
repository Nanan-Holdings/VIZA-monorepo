import type { HelpArticleSection } from "@/components/client/help-article";

/**
 * "What to do after submitting on France-Visas" guide for short-stay
 * (Schengen C) applicants filing in mainland China. Every fact here was read
 * on 2026-11-19 from france-visas.gouv.fr (la-demarche, chine,
 * suivre-votre-demande), visas-fr.tlscontact.com and the European
 * Commission's Schengen visa page. Do not add facts from memory; re-check the
 * fees, centre hours and closure dates against those pages when they change.
 */
export const FR_NEXT_STEPS_CHECKED_ON = "2026-11-19";

export const FR_OFFICIAL_LINKS = {
  procedure: "https://france-visas.gouv.fr/en/la-demarche",
  china: "https://france-visas.gouv.fr/en/chine",
  tlscontact: "https://visas-fr.tlscontact.com/",
  trackApplication: "https://france-visas.gouv.fr/suivre-votre-demande",
  euSchengen: "https://home-affairs.ec.europa.eu/policies/schengen/schengen-visas/applying-schengen-visa_en",
} as const;

const TLS_PHONE = "+86 (021) 60168668";

type FilingHours = "split" | "continuous";
type SaturdayFiling = "on_request" | "closed" | null;

interface TlsCentre {
  key: string;
  cityZh: string;
  cityEn: string;
  /** Official address as published by France-Visas / TLScontact. */
  address: string;
  hours: FilingHours;
  saturday: SaturdayFiling;
}

/** The 15 TLScontact France visa centres in mainland China. */
export const TLS_CENTRES: readonly TlsCentre[] = [
  { key: "beijing", cityZh: "北京", cityEn: "Beijing", address: "11F, Block A, Gateway Plaza, No. 18 East 3rd Ring North Road, Chaoyang 100027", hours: "split", saturday: "on_request" },
  { key: "guangzhou", cityZh: "广州", cityEn: "Guangzhou", address: "1402-1403 Pacific Finance Center, No. 32 Huaxia Road, Tianhe", hours: "split", saturday: "on_request" },
  { key: "chengdu", cityZh: "成都", cityEn: "Chengdu", address: "Rooms 2505-2509, 25F, Western Cultural Industry Centre, No. 16 Huaxing East St, Jinjiang 610020", hours: "split", saturday: "closed" },
  { key: "shanghai", cityZh: "上海", cityEn: "Shanghai", address: "2F, No. 299 Hengfeng Road, Jing'an 200070", hours: "continuous", saturday: "on_request" },
  { key: "shenyang", cityZh: "沈阳", cityEn: "Shenyang", address: "Room 1401, Fortune Plaza E, 59 Beizhan Road, Shenhe 110013", hours: "split", saturday: "closed" },
  { key: "wuhan", cityZh: "武汉", cityEn: "Wuhan", address: "Rooms 906-910, International Intelligence Center (IIC), 1515 Zhongshan Avenue, Jiang'an", hours: "split", saturday: "on_request" },
  { key: "jinan", cityZh: "济南", cityEn: "Jinan", address: "503-504, 5F, Overseas Plaza, No. 6636 2nd Ring Road, Shizhong 250024", hours: "split", saturday: null },
  { key: "chongqing", cityZh: "重庆", cityEn: "Chongqing", address: "Rooms 4306, 4307-2, 43F, Yingli International Financial Centre, No. 28 Minquan Road, Yuzhong 400010", hours: "split", saturday: null },
  { key: "shenzhen", cityZh: "深圳", cityEn: "Shenzhen", address: "Office 07-13, 1F, News Building, 1002 Shennan Zhong Road, Futian 518027", hours: "split", saturday: null },
  { key: "changsha", cityZh: "长沙", cityEn: "Changsha", address: "Room 1507, Dolton Hotel, 159 Shaoshan North Road, Furong", hours: "split", saturday: null },
  { key: "hangzhou", cityZh: "杭州", cityEn: "Hangzhou", address: "705-707, Building A, Mingteng Mansion, Jinlong Centre, No. 859 Huanzhan East Road, Shangcheng", hours: "continuous", saturday: null },
  { key: "kunming", cityZh: "昆明", cityEn: "Kunming", address: "Room 804A, 8F, CES Investment Office Building, No. 219 Chuncheng Road, Guandu 650000", hours: "split", saturday: null },
  { key: "xian", cityZh: "西安", cityEn: "Xi'an", address: "Room 03-01, 19F, Chanba Foreign Affairs Building, No. 1 Chanba Avenue, Baqiao", hours: "split", saturday: null },
  { key: "nanjing", cityZh: "南京", cityEn: "Nanjing", address: "502-503, 5F, Zhonghai Building, No. 39 Qingliangmen Avenue, Gulou 210036", hours: "continuous", saturday: null },
  { key: "fuzhou", cityZh: "福州", cityEn: "Fuzhou", address: "Rooms 03 & 05, 6F, YuYang Central Building, No. 118 Shuguang Road, Taijiang", hours: "split", saturday: null },
];

/**
 * France-Visas "city of submission" (`fv_deposit_town`) codes we can map to a
 * TLS centre. Only `1PE` (Beijing) is documented in this repo (selectors,
 * schema playbook); the portal publishes no code list, so any other code
 * leaves every centre unmarked rather than guessing.
 */
export const FV_DEPOSIT_TOWN_CENTRES: Readonly<Record<string, string>> = {
  "1PE": "beijing",
};

/** The applicant's centre from a VIZA centre key ("changsha") or a France-Visas town code ("1PE"). */
export function centreForDepositTown(depositTown: string | null | undefined): TlsCentre | null {
  const raw = depositTown?.trim() ?? "";
  const key = TLS_CENTRES.some((centre) => centre.key === raw.toLowerCase())
    ? raw.toLowerCase()
    : FV_DEPOSIT_TOWN_CENTRES[raw.toUpperCase()];
  return TLS_CENTRES.find((centre) => centre.key === key) ?? null;
}

function orderedCentres(mine: TlsCentre | null): TlsCentre[] {
  return mine ? [mine, ...TLS_CENTRES.filter((centre) => centre !== mine)] : [...TLS_CENTRES];
}

export interface FrNextStepsOptions {
  depositTown?: string | null;
  applicationReference?: string | null;
}

export interface FrNextStepsCopy {
  title: string;
  subtitle: string;
  topBackLabel: string;
  backLabel: string;
  sections: HelpArticleSection[];
}

const SPLIT = "08:30–12:30 / 13:30–16:30";
const CONTINUOUS = "08:30–16:30";

function hoursZh(centre: TlsCentre): string {
  const weekdays = `周一至周五 ${centre.hours === "split" ? SPLIT : CONTINUOUS}`;
  if (centre.saturday === "on_request") return `${weekdays}；周六 08:30–12:30 按需开放`;
  if (centre.saturday === "closed") return `${weekdays}；周六不开放`;
  return weekdays;
}

function hoursEn(centre: TlsCentre): string {
  const weekdays = `Mon–Fri ${centre.hours === "split" ? SPLIT : CONTINUOUS}`;
  if (centre.saturday === "on_request") return `${weekdays}; Sat 08:30–12:30 on request`;
  if (centre.saturday === "closed") return `${weekdays}; Sat closed`;
  return weekdays;
}

function zh(options: FrNextStepsOptions): FrNextStepsCopy {
  const mine = centreForDepositTown(options.depositTown);
  const centres = orderedCentres(mine);
  const reference = options.applicationReference?.trim() || null;
  return {
    title: "提交后怎么办：预约递交与后续流程",
    subtitle: `France-Visas 在线表提交后，如何在 TLScontact 签证中心预约递交、准备材料、缴费、采集生物信息并取回护照。信息核对自法国签证官网、TLScontact 和欧盟委员会官网（${FR_NEXT_STEPS_CHECKED_ON}）。`,
    topBackLabel: "提交结果",
    backLabel: "返回提交结果",
    sections: [
      {
        heading: "先了解这几点",
        content: [
          {
            type: "list",
            items: [
              "签证由法国驻华大使馆（北京）以及驻广州、驻上海总领事馆审批。",
              "TLScontact 签证中心负责接待申请人、接收材料，不负责审批。",
              "最早可以在出行前 6 个月递交申请。",
              ...(reference ? [`你的 France-Visas 申请编号：${reference}`] : []),
              mine
                ? `你在 France-Visas 上选择的递交城市是${mine.cityZh}，下方签证中心列表已把${mine.cityZh}签证中心排在第一位。`
                : "请在你在 France-Visas 上选择的递交城市的签证中心预约，全部 15 个签证中心见下方列表。",
            ],
          },
        ],
      },
      {
        heading: "第 1 步：打印并签署申请表",
        content: [
          {
            type: "list",
            items: [
              "在 France-Visas 官网填写的申请表需要打印出来，并用黑色墨水笔签名。",
              "只能由申请人本人签名，代理人不能代签。",
            ],
          },
        ],
      },
      {
        heading: "第 2 步：在 TLScontact 预约递交时间",
        content: [
          {
            type: "paragraph",
            text: "在 visas-fr.tlscontact.com 网上预约，也可以电话预约。网上预约步骤：",
          },
          {
            type: "list",
            items: [
              "1. 回答一份简短问卷，系统会列出适合你情况的材料清单。",
              "2. 用邮箱和密码注册账号。",
              "3. 为每位出行人填写一张信息表（姓名、出生日期、护照号、出行日期）。",
              "4. 选择日期和时间，之后会收到确认邮件。",
              "5. 打印预约确认函（convocation）。",
            ],
          },
          {
            type: "tip",
            text: `如需修改预约，请致电 ${TLS_PHONE}。呼叫中心工作时间：周一至周五 8:30–12:00、13:15–16:30。`,
          },
          {
            type: "links",
            items: [{ label: "TLScontact 法国签证中心（中国）", href: FR_OFFICIAL_LINKS.tlscontact }],
          },
        ],
      },
      {
        heading: "第 3 步：准备材料",
        content: [
          { type: "paragraph", text: "护照要求：" },
          {
            type: "list",
            items: [
              "完好无损。",
              "签发不超过 10 年。",
              "至少有 2 页空白页。",
              "有效期在离开申根区后至少还剩 3 个月。",
            ],
          },
          {
            type: "list",
            items: [
              "两张近期拍摄、符合 ICAO 标准的照片。",
              "非英文或法文的文件可能需要附法文翻译。",
            ],
          },
          { type: "paragraph", text: "递交当天带上：" },
          {
            type: "list",
            items: [
              "打印好的预约确认函（convocation）。",
              "护照。",
              "全部申请材料，按材料清单的顺序排好。",
              "签证费和服务费（见下方「费用」）。",
            ],
          },
        ],
      },
      {
        heading: "费用",
        content: [
          {
            type: "list",
            items: [
              "签证费：成人 90 欧元，6–12 岁儿童 45 欧元（欧盟委员会官网）。",
              "TLScontact 服务费：每份申请约 250 元人民币。服务费由领馆以欧元设定，以人民币支付，递交当天在签证中心用现金或银行卡（信用卡或借记卡，仅限银联）支付。",
              "服务费不退，除非你在采集生物信息之前决定不递交。",
              "France-Visas 常见问题说明：服务费不得超过 45 欧元。",
              "可选付费服务：照片、复印、护照邮寄回寄。",
            ],
          },
        ],
      },
      {
        heading: "递交当天：生物信息采集与安检",
        content: [
          {
            type: "list",
            items: [
              "12 岁及以上的申请人都要拍照并采集 10 枚指纹。",
              "如果你在 59 个月内采集过生物信息，可以复用；这一条不适用于长期签证和法国海外省及海外领地（DROM-COM）签证。",
              "12 岁以下儿童免采集，由父母或法定监护人递交材料，现场扫描一张 ICAO 标准照片。",
            ],
          },
          { type: "paragraph", text: "安检规定：" },
          {
            type: "list",
            items: [
              "不得携带尖锐物品或武器。",
              "严禁使用手机、相机或任何录音录像设备。",
              "包可能会被检查。",
              "只有申请人、获授权的代理人和获授权的陪同人员（例如行动协助人员、翻译）可以进入。",
            ],
          },
        ],
      },
      {
        heading: "签证中心地址和递交时间",
        content: [
          {
            type: "paragraph",
            text: `递交只接受预约；取护照无需预约，时间为周一至周五，与递交时间相同（另有说明的除外）。${SPLIT} 表示上午和下午分两段开放。`,
          },
          ...centres.map((centre) => ({
            type: "paragraph" as const,
            text: `${centre === mine ? "【你的签证中心】" : ""}${centre.cityZh}签证中心：${centre.address}。递交时间：${hoursZh(centre)}。`,
          })),
          {
            type: "links",
            items: [{ label: "France-Visas：在中国申请（签证中心与联系方式）", href: FR_OFFICIAL_LINKS.china }],
          },
        ],
      },
      {
        heading: "不经 TLScontact 递交的情况",
        content: [
          {
            type: "list",
            items: [
              "旅游、商务、探亲访友、过境和短期学习签证都通过 TLScontact 签证中心递交。",
              "以下类别直接向领馆递交：法国公民的配偶、欧盟公民家属短期签证、结婚、收养，以及部分长期商务签证。",
              "属于北京领区的法国公民配偶和欧盟/欧洲经济区公民家属，可以不预约直接到大使馆签证处递交，时间为周一至周五 8:30–12:00。",
            ],
          },
          { type: "paragraph", text: "使领馆签证处：" },
          {
            type: "list",
            items: [
              "法国驻华大使馆签证处：60 Tianze Lu, Chaoyang 100600。周一至周五 08:30–12:00，每月最后一个周六 09:00–12:00。",
              "法国驻广州总领事馆签证处：Room 1901-1907, Central Tower (Kaihua International Center), No. 5 Xiancun Road, Tianhe 510623。周一至周五 09:00–12:00。",
              "法国驻上海总领事馆签证处：18F, Building A, Soho Zhongshan Plaza, 1055 West Zhongshan Road 200051。周一至周五 09:00–12:00。",
            ],
          },
        ],
      },
      {
        heading: "2026 年签证中心关闭日期",
        content: [
          {
            type: "list",
            items: [
              "每周六、周日（个别中心周六按需开放递交，见上方）。",
              "1 月 1 日。",
              "2 月 16–19 日（春节）。",
              "4 月 6 日（清明节）。",
              "5 月 1–4 日。",
              "6 月 19 日（端午节）。",
              "9 月 25 日（中秋节）。",
              "10 月 1–5 日（国庆节）。",
              "12 月 25 日。",
            ],
          },
        ],
      },
      {
        heading: "递交之后：处理时间与进度查询",
        content: [
          {
            type: "list",
            items: [
              "材料送达领馆后，完整的短期签证申请通常在 24–48 个工作小时内处理完（仅供参考）。",
              "欧盟规定的一般处理时间为 15 天，最长可延至 45 天。",
              "护照回到签证中心后，你会收到邮件和短信通知。",
              `可以在 TLScontact 账号里查询进度，也可以致电 ${TLS_PHONE}。`,
            ],
          },
          {
            type: "links",
            items: [
              { label: "France-Visas：查询申请进度", href: FR_OFFICIAL_LINKS.trackApplication },
              { label: "欧盟委员会：申请申根签证", href: FR_OFFICIAL_LINKS.euSchengen },
            ],
          },
        ],
      },
      {
        heading: "取回护照（三种方式）",
        content: [
          {
            type: "list",
            items: [
              "1. 本人领取：带上递交时拿到的取件回执，以及身份证原件和复印件。",
              "2. 代理人领取：带上取件回执、申请人身份证复印件、代理人身份证原件和复印件（代理人须为成年人），以及申请人签名的授权书。未成年人的授权书由父母或监护人签名，并附监护关系证明。",
              "3. 付费快递寄回：在预约递交时申请。",
            ],
          },
          {
            type: "tip",
            text: "护照在签证中心超过 3 个月未领取，会被退回领馆。",
          },
        ],
      },
      {
        heading: "另外：法属波利尼西亚和留尼汪免签",
        content: [
          {
            type: "paragraph",
            text: "参加经批准的旅行社团队游的中国游客，前往法属波利尼西亚和留尼汪可免签，停留最长 14 天。",
          },
        ],
      },
      {
        heading: "信息来源",
        content: [
          {
            type: "links",
            items: [
              { label: "France-Visas：申请流程", href: FR_OFFICIAL_LINKS.procedure },
              { label: "France-Visas：在中国申请", href: FR_OFFICIAL_LINKS.china },
              { label: "TLScontact 法国签证中心（中国）", href: FR_OFFICIAL_LINKS.tlscontact },
              { label: "France-Visas：查询申请进度", href: FR_OFFICIAL_LINKS.trackApplication },
              { label: "欧盟委员会：申请申根签证", href: FR_OFFICIAL_LINKS.euSchengen },
            ],
          },
          {
            type: "tip",
            text: `本页信息核对自以上官方网站（${FR_NEXT_STEPS_CHECKED_ON}）。费用、开放时间和关闭日期可能调整，请以官网为准。`,
          },
        ],
      },
    ],
  };
}

function en(options: FrNextStepsOptions): FrNextStepsCopy {
  const mine = centreForDepositTown(options.depositTown);
  const centres = orderedCentres(mine);
  const reference = options.applicationReference?.trim() || null;
  return {
    title: "After you submit: booking your visa centre appointment and what comes next",
    subtitle: `How to book a TLScontact appointment after your France-Visas form, prepare your file, pay, give biometrics and get your passport back. Checked against France-Visas, TLScontact and European Commission pages on ${FR_NEXT_STEPS_CHECKED_ON}.`,
    topBackLabel: "Submission result",
    backLabel: "Back to submission result",
    sections: [
      {
        heading: "Before you start",
        content: [
          {
            type: "list",
            items: [
              "Visa decisions are made by the French Embassy in Beijing and the Consulates General in Guangzhou (Canton) and Shanghai.",
              "TLScontact centres receive applicants and their files; they do not decide.",
              "You can file up to 6 months before your trip.",
              ...(reference ? [`Your France-Visas application reference: ${reference}`] : []),
              mine
                ? `The city of submission on your France-Visas form is ${mine.cityEn}, so the ${mine.cityEn} centre is listed first below.`
                : "Book at the centre in the city of submission you chose on France-Visas. All 15 centres are listed below.",
            ],
          },
        ],
      },
      {
        heading: "Step 1: Print and sign the form",
        content: [
          {
            type: "list",
            items: [
              "Print the form you filled in on France-Visas and sign it in black ink.",
              "Only the applicant may sign it; a representative may not.",
            ],
          },
        ],
      },
      {
        heading: "Step 2: Book a TLScontact appointment",
        content: [
          {
            type: "paragraph",
            text: "Book online at visas-fr.tlscontact.com or by phone. Online booking steps:",
          },
          {
            type: "list",
            items: [
              "1. Answer a short questionnaire; the document list for your profile appears.",
              "2. Create an account with your email and a password.",
              "3. Fill in a sheet for each traveller (name, date of birth, passport number, trip dates).",
              "4. Pick a date and time; a confirmation email follows.",
              "5. Print the convocation (appointment letter).",
            ],
          },
          {
            type: "tip",
            text: `To change your booking, call ${TLS_PHONE}. Call centre hours: Mon–Fri 8:30–12:00 and 13:15–16:30.`,
          },
          {
            type: "links",
            items: [{ label: "TLScontact France visa centres in China", href: FR_OFFICIAL_LINKS.tlscontact }],
          },
        ],
      },
      {
        heading: "Step 3: Prepare your file",
        content: [
          { type: "paragraph", text: "Your passport must be:" },
          {
            type: "list",
            items: [
              "In good condition.",
              "Issued less than 10 years ago.",
              "With at least 2 blank pages.",
              "Valid for at least 3 months after you leave the Schengen area.",
            ],
          },
          {
            type: "list",
            items: [
              "Two recent ICAO-standard photos.",
              "Documents not in English or French may need a French translation.",
            ],
          },
          { type: "paragraph", text: "On filing day, bring:" },
          {
            type: "list",
            items: [
              "Your printed convocation.",
              "Your passport.",
              "Your file, with all documents in the order of the checklist.",
              "Payment for the visa fee and the service fee (see Fees).",
            ],
          },
        ],
      },
      {
        heading: "Fees",
        content: [
          {
            type: "list",
            items: [
              "Visa fee: EUR 90 for adults, EUR 45 for children aged 6–12 (European Commission).",
              "TLScontact service fee: about 250 RMB per file. It is set by the consulate in euros and paid in RMB at the centre on filing day, in cash or by credit or debit card (UnionPay only).",
              "The service fee is non-refundable unless you decide not to file before your biometrics are taken.",
              "France-Visas FAQ: the service fee cannot exceed EUR 45.",
              "Optional paid extras: photos, copies, and returning your passport by post.",
            ],
          },
        ],
      },
      {
        heading: "Filing day: biometrics and security",
        content: [
          {
            type: "list",
            items: [
              "Everyone aged 12 or over gives a photo and 10 fingerprints.",
              "Biometrics collected less than 59 months ago can be reused. This does not apply to long-stay or DROM-COM visas.",
              "Children under 12 are exempt: a parent or legal guardian presents the file and an ICAO photo is scanned.",
            ],
          },
          { type: "paragraph", text: "Security rules:" },
          {
            type: "list",
            items: [
              "No sharp objects or weapons.",
              "Using phones, cameras or recording devices is strictly forbidden.",
              "Bags may be inspected.",
              "Only applicants, authorised representatives and authorised companions (for example mobility assistance or an interpreter) may enter.",
            ],
          },
        ],
      },
      {
        heading: "Visa centre addresses and filing hours",
        content: [
          {
            type: "paragraph",
            text: `Filing is by appointment only. Passport pickup needs no appointment, Mon–Fri, during the same hours unless noted. ${SPLIT} means the centre is open in a morning and an afternoon session.`,
          },
          ...centres.map((centre) => ({
            type: "paragraph" as const,
            text: `${centre === mine ? "[Your centre] " : ""}${centre.cityEn}: ${centre.address}. Filing: ${hoursEn(centre)}.`,
          })),
          {
            type: "links",
            items: [{ label: "France-Visas: applying in China (centres and contacts)", href: FR_OFFICIAL_LINKS.china }],
          },
        ],
      },
      {
        heading: "When you do not file at TLScontact",
        content: [
          {
            type: "list",
            items: [
              "Tourism, business, family or friend visits, transit and short-stay study all go through TLScontact.",
              "These are filed directly at the consulate: spouses of French nationals, short stays for family members of EU citizens, marriage, adoption, and some long-stay business visas.",
              "Spouses of French nationals and family members of EU/EEA citizens in the Beijing district may file at the Embassy visa service without an appointment, Mon–Fri 8:30–12:00.",
            ],
          },
          { type: "paragraph", text: "Visa sections:" },
          {
            type: "list",
            items: [
              "French Embassy, Beijing: 60 Tianze Lu, Chaoyang 100600. Mon–Fri 08:30–12:00; last Saturday of the month 09:00–12:00.",
              "Consulate General, Guangzhou: Room 1901-1907, Central Tower (Kaihua International Center), No. 5 Xiancun Road, Tianhe 510623. Mon–Fri 09:00–12:00.",
              "Consulate General, Shanghai: 18F, Building A, Soho Zhongshan Plaza, 1055 West Zhongshan Road 200051. Mon–Fri 09:00–12:00.",
            ],
          },
        ],
      },
      {
        heading: "2026 visa centre closures",
        content: [
          {
            type: "list",
            items: [
              "Weekends (some centres file on Saturday on request; see above).",
              "1 January.",
              "16–19 February (Spring Festival).",
              "6 April (Qingming).",
              "1–4 May.",
              "19 June (Dragon Boat Festival).",
              "25 September (Mid-Autumn Festival).",
              "1–5 October (National Day).",
              "25 December.",
            ],
          },
        ],
      },
      {
        heading: "After filing: processing time and tracking",
        content: [
          {
            type: "list",
            items: [
              "Once your file reaches the consulate, a complete short-stay file typically takes 24–48 working hours (indicative).",
              "The EU norm is 15 days, extendable up to 45 days.",
              "When your passport is back at the centre, you get an email and an SMS.",
              `Track your file in your TLScontact account or by phone at ${TLS_PHONE}.`,
            ],
          },
          {
            type: "links",
            items: [
              { label: "France-Visas: track your application", href: FR_OFFICIAL_LINKS.trackApplication },
              { label: "European Commission: applying for a Schengen visa", href: FR_OFFICIAL_LINKS.euSchengen },
            ],
          },
        ],
      },
      {
        heading: "Getting your passport back (3 ways)",
        content: [
          {
            type: "list",
            items: [
              "1. In person: bring the tracking slip you were given at filing, plus your ID card original and a copy.",
              "2. A representative: bring the tracking slip, a copy of the applicant's ID, the representative's ID original and a copy (the representative must be an adult), and an authorisation letter signed by the applicant. For minors, a parent or guardian signs it and adds proof of guardianship.",
              "3. Paid express courier: request it at your appointment.",
            ],
          },
          {
            type: "tip",
            text: "Passports not collected within 3 months are returned to the consulate.",
          },
        ],
      },
      {
        heading: "Also: French Polynesia and Réunion",
        content: [
          {
            type: "paragraph",
            text: "Chinese tourists on approved agency tours can visit French Polynesia and Réunion without a visa for up to 14 days.",
          },
        ],
      },
      {
        heading: "Sources",
        content: [
          {
            type: "links",
            items: [
              { label: "France-Visas: the application process", href: FR_OFFICIAL_LINKS.procedure },
              { label: "France-Visas: applying in China", href: FR_OFFICIAL_LINKS.china },
              { label: "TLScontact France visa centres in China", href: FR_OFFICIAL_LINKS.tlscontact },
              { label: "France-Visas: track your application", href: FR_OFFICIAL_LINKS.trackApplication },
              { label: "European Commission: applying for a Schengen visa", href: FR_OFFICIAL_LINKS.euSchengen },
            ],
          },
          {
            type: "tip",
            text: `Checked against the official pages above on ${FR_NEXT_STEPS_CHECKED_ON}. Fees, hours and closure dates can change; the official sites take precedence.`,
          },
        ],
      },
    ],
  };
}

export function getFrNextStepsCopy(locale: string, options: FrNextStepsOptions = {}): FrNextStepsCopy {
  return locale.toLowerCase().startsWith("zh") ? zh(options) : en(options);
}
