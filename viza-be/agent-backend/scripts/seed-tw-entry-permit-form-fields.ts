/**
 * Seed script: visa_form_fields for Taiwan Online Entry Permit
 * (旅居海外大陸地區人民申請來臺觀光入境許可).
 *
 * Field definitions are based on a live, read-only walkthrough of the real
 * official portal (coa.immigration.gov.tw/coa-frontend/overseas-foreign-china)
 * up to (but not including) the CAPTCHA + "確認資料" submit step — see
 * docs/tw-entry-permit-auto-submit-plan.md for the full write-up.
 *
 * Scope: mainland Chinese nationals residing abroad or in Hong Kong/Macau
 * applying online for a Taiwan tourism entry permit. This is a real reviewed
 * application (NIA approves/rejects), not an instant free arrival-card
 * notification like Malaysia MDAC / Thailand TDAC.
 *
 * Out of scope (deliberately, matches src/tw/ backend halt boundary):
 * CAPTCHA solving, the "確認資料"/final submit click, review/approval
 * tracking, and the post-approval online payment (NT$600 / NT$1,000),
 * which stay applicant-controlled. There is no persistent portal account —
 * the official site uses a one-time email OTP verification within a single
 * continuous session, not an email+password account like uk_accounts.
 *
 * field_name values here are the contract that src/tw/normalize.ts's
 * output keys and viza-fe wizards/tw/config.ts field keys must match.
 *
 * Run: npx tsx scripts/seed-tw-entry-permit-form-fields.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import { toBilingualSeedRow } from "./bilingual-seed-row";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env.local") });
dotenv.config({ path: path.join(__dirname, "../.env") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const VISA_TYPE = "TW_ENTRY_PERMIT";

interface FieldDef {
  field_name: string;
  label: string;
  field_type: string;
  required: boolean;
  step_number: number;
  step_name: string;
  display_order: number;
  placeholder?: string;
  validation_rules?: Record<string, unknown>;
  options?: Array<{ value: string; text: string; label_zh?: string; official_label?: string }>;
  conditional_logic?: Record<string, unknown>;
}

const YES_NO = [
  { value: "no", text: "No", label_zh: "否" },
  { value: "yes", text: "Yes", label_zh: "是" },
];

// ─── Real option lists captured live from the official portal ──────────────
// (label_zh values below are Simplified Chinese for display on our site;
// the official portal itself uses Traditional Chinese — see comments/plan
// doc for the real on-page text.)

const CONTINENTS = [
  { value: "A", text: "Asia", label_zh: "亚洲" },
  { value: "B", text: "Americas", label_zh: "美洲" },
  { value: "C", text: "Europe", label_zh: "欧洲" },
  { value: "D", text: "Africa", label_zh: "非洲" },
  { value: "E", text: "Oceania", label_zh: "大洋洲" },
];

const EMBASSY_OFFICES = [
  { value: "50", text: "Taipei Economic and Cultural Office / Hong Kong Office", label_zh: "台北经济文化办事处／香港办事处" },
  { value: "51", text: "Taipei Economic and Cultural Office / Macau Office", label_zh: "台北经济文化办事处／澳门办事处" },
  { value: "5A", text: "Taipei Economic and Cultural Representative Office (Tokyo)", label_zh: "台北驻日经济文化代表处(东京)" },
  { value: "5C", text: "Taipei Economic and Cultural Office in Osaka", label_zh: "台北驻大阪经济文化办事处" },
  { value: "5F", text: "Taipei Mission in Korea", label_zh: "驻韩国台北代表处" },
  { value: "55", text: "Taipei Economic and Cultural Office in Malaysia", label_zh: "驻马来西亚台北经济文化办事处" },
  { value: "56", text: "Taipei Economic and Cultural Office in the Philippines", label_zh: "驻菲律宾台北经济文化办事处" },
  { value: "53", text: "Taipei Representative Office in Singapore", label_zh: "驻新加坡台北代表处" },
  { value: "52", text: "Taipei Economic and Cultural Office in Thailand", label_zh: "驻泰国台北经济文化办事处" },
  { value: "67", text: "Taipei Economic and Cultural Office (Hanoi)", label_zh: "驻越南代表处(河内)" },
  { value: "57", text: "Taipei Economic and Cultural Office in Ho Chi Minh City", label_zh: "驻胡志明市台北经济文化办事处" },
  { value: "58", text: "Taipei Economic and Cultural Office in Myanmar", label_zh: "驻缅甸代表处" },
  { value: "66", text: "Taipei Economic and Cultural Center in India", label_zh: "驻印度代表处" },
  { value: "54", text: "Taipei Economic and Trade Office in Indonesia", label_zh: "驻印尼台北经济贸易代表处" },
  { value: "6A", text: "Taipei Economic and Cultural Office in Vancouver", label_zh: "驻温哥华台北经济文化办事处" },
  { value: "6B", text: "Taipei Economic and Cultural Office in Toronto", label_zh: "驻多伦多台北经济文化办事处" },
  { value: "60", text: "Taipei Economic and Cultural Office in New York", label_zh: "驻纽约台北经济文化办事处" },
  { value: "61", text: "Taipei Economic and Cultural Office in Los Angeles", label_zh: "驻洛杉矶台北经济文化办事处" },
  { value: "62", text: "Taipei Economic and Cultural Office in San Francisco", label_zh: "驻旧金山台北经济文化办事处" },
  { value: "64", text: "Taipei Economic and Cultural Representative Office in the United States (Washington, DC)", label_zh: "驻美国台北经济文化代表处(华盛顿特区)" },
  { value: "65", text: "Taipei Economic and Cultural Office in Miami", label_zh: "驻迈阿密台北经济文化办事处" },
  { value: "70", text: "Embassy of the Republic of China (Taiwan) in Paraguay", label_zh: "驻巴拉圭共和国大使馆" },
  { value: "GP", text: "Taipei Representative Office in the EU and Belgium", label_zh: "驻欧盟兼驻比利时代表处" },
  { value: "72", text: "Taipei Representative Office in France", label_zh: "驻法国台北代表处" },
  { value: "63", text: "Taipei Representative Office in the United Kingdom", label_zh: "驻英国台北代表处" },
  { value: "71", text: "Taipei Liaison Office in the Republic of South Africa", label_zh: "驻南非共和国台北联络代表处" },
  { value: "73", text: "Taipei Economic and Cultural Office in Sydney", label_zh: "驻雪梨台北经济文化办事处" },
  { value: "74", text: "Taipei Economic and Cultural Office in Auckland", label_zh: "驻奥克兰台北经济文化办事处" },
];

const EMBASSY_OFFICES_BY_CONTINENT = {
  A: EMBASSY_OFFICES.filter((office) => ["50", "51", "5A", "5C", "5F", "55", "56", "53", "52", "67", "57", "58", "66", "54"].includes(office.value)),
  B: EMBASSY_OFFICES.filter((office) => ["6A", "6B", "60", "61", "62", "64", "65", "70"].includes(office.value)),
  C: EMBASSY_OFFICES.filter((office) => ["GP", "72", "63"].includes(office.value)),
  D: EMBASSY_OFFICES.filter((office) => ["71"].includes(office.value)),
  E: EMBASSY_OFFICES.filter((office) => ["73", "74"].includes(office.value)),
};

const ELIGIBILITY_CATEGORIES = [
  { value: "1", text: "Studying abroad or in Hong Kong/Macau", label_zh: "赴国外或香港、澳门留学生" },
  { value: "2", text: "Obtained permanent residency abroad or in Hong Kong/Macau", label_zh: "旅居国外或香港、澳门取得当地永久居留权" },
  { value: "3", text: "Resided abroad or in Hong Kong/Macau 1+ year with valid work proof", label_zh: "旅居国外或香港、澳门1年以上且领有工作证明" },
  { value: "4", text: "Obtained dependent residency abroad or in Hong Kong/Macau with financial proof", label_zh: "旅居国外或香港、澳门取得当地依亲居留权且有财力证明" },
];

const OCCUPATIONS = [
  { value: "1", text: "Military", label_zh: "军人" }, { value: "2", text: "Civil servant", label_zh: "公务员" },
  { value: "3", text: "Public/school staff", label_zh: "公教职员" }, { value: "4", text: "Private school faculty", label_zh: "私校教职" },
  { value: "5", text: "Business", label_zh: "商" }, { value: "6", text: "Agriculture", label_zh: "农" },
  { value: "7", text: "Industry", label_zh: "工" }, { value: "8", text: "Medical personnel", label_zh: "医事人员" },
  { value: "9", text: "Religious worker", label_zh: "宗教人士" }, { value: "10", text: "Entertainer", label_zh: "演艺人员" },
  { value: "11", text: "Journalism", label_zh: "新闻事业" }, { value: "12", text: "Fishing vessel crew", label_zh: "渔船船员" },
  { value: "13", text: "Ship crew", label_zh: "轮船船员" }, { value: "14", text: "Student", label_zh: "学生" },
  { value: "15", text: "Freelance", label_zh: "自由业" }, { value: "16", text: "Other occupation", label_zh: "其他业" },
  { value: "17", text: "None", label_zh: "无" }, { value: "18", text: "Police", label_zh: "警" },
  { value: "19", text: "Seafarer", label_zh: "船员" }, { value: "20", text: "Homemaker", label_zh: "家庭主妇" },
  { value: "21", text: "Technician (trade)", label_zh: "技工" }, { value: "22", text: "Artist", label_zh: "艺术家" },
  { value: "23", text: "Nurse", label_zh: "护士" }, { value: "24", text: "Pilot", label_zh: "飞行员" },
  { value: "25", text: "Specialist", label_zh: "专家" }, { value: "27", text: "Salesperson", label_zh: "推销员" },
  { value: "28", text: "Scientist", label_zh: "科学家" }, { value: "29", text: "Secretary", label_zh: "秘书" },
  { value: "30", text: "Technician", label_zh: "技师" }, { value: "31", text: "Writer", label_zh: "作家" },
  { value: "32", text: "Consultant", label_zh: "顾问" }, { value: "33", text: "Professor", label_zh: "教授" },
  { value: "34", text: "Accountant", label_zh: "会计员" }, { value: "35", text: "Bank employee", label_zh: "银行员" },
  { value: "36", text: "Diver", label_zh: "潜水夫" }, { value: "37", text: "Lawyer", label_zh: "律师" },
  { value: "38", text: "Diplomat", label_zh: "外交人员" }, { value: "39", text: "Musician", label_zh: "音乐家" },
  { value: "40", text: "IT professional", label_zh: "信息人员" }, { value: "41", text: "Researcher", label_zh: "研究人员" },
  { value: "42", text: "Engineer", label_zh: "工程师" }, { value: "47", text: "White-collar seafarer", label_zh: "白领船员" },
  { value: "48", text: "Blue-collar seafarer", label_zh: "蓝领船员" }, { value: "49", text: "Caregiver", label_zh: "看护工" },
  { value: "50", text: "Institutional caregiver", label_zh: "养护机构看护工" }, { value: "51", text: "Unspecified", label_zh: "未注明" },
  { value: "52", text: "Staff/clerk", label_zh: "职员" }, { value: "53", text: "Teacher", label_zh: "教师" },
  { value: "54", text: "Doctor", label_zh: "医生" }, { value: "55", text: "Missionary", label_zh: "传教士" },
  { value: "56", text: "Journalist/reporter", label_zh: "记者" }, { value: "58", text: "Athlete", label_zh: "运动人员" },
  { value: "61", text: "Unemployed / job-seeking", label_zh: "待业" }, { value: "62", text: "Retired", label_zh: "退休" },
];

const TW_CITIES = [
  "臺北市", "基隆市", "新北市", "宜蘭縣", "新竹市", "新竹縣", "桃園市", "苗栗縣", "臺中市", "彰化縣",
  "南投縣", "嘉義市", "嘉義縣", "雲林縣", "臺南市", "高雄市", "澎湖縣", "屏東縣", "臺東縣", "花蓮縣",
  "金門縣", "連江縣",
].map((c, i) => ({ value: String(i + 1), text: c, label_zh: c, official_label: c }));

const BIRTH_PLACE_MAINLAND_OPTIONS = [
  "湖南", "湖北", "四川", "上海", "南京", "漢口", "重慶", "山東", "山西", "河南",
  "河北", "陝西", "甘肅", "青島", "天津", "北京", "西安", "遼寧", "遼北", "安東",
  "吉林", "松江", "合江", "嫩江", "黑龍江", "興安", "大連", "瀋陽", "哈爾濱", "熱河",
  "察哈爾", "綏遠", "寧夏回族自治區", "內蒙古自治區", "新疆維吾爾自治區", "青海", "西康", "西藏自治區", "福建", "廣東",
  "廣西壯族自治區", "雲南", "貴州", "海南", "廣州", "江蘇", "浙江", "安徽", "江西",
].map((label) => ({ value: label, text: label, label_zh: label, official_label: label }));

// Full "所具其他國籍為" nationality list — value = numeric code used by the
// portal's <select> (unchanged). The same official numeric-code list is also
// the "其他" branch source for 出生地(同所持旅遊證件) / traveller.birthPlace1.
// Most labels are still Simplified Chinese pending a full official-label sync;
// the 994/995/996/997/999 special identity rows below use Traditional labels
// confirmed from the user's official screenshot.
const NATIONALITY_OPTIONS: Array<{ value: string; text: string }> = [
  { value: "1", text: "阿富汗" }, { value: "2", text: "不丹" }, { value: "3", text: "文莱" }, { value: "4", text: "缅甸" },
  { value: "5", text: "柬埔寨" }, { value: "6", text: "斯里兰卡" }, { value: "7", text: "赛普勒斯" }, { value: "8", text: "印度" },
  { value: "9", text: "印尼" }, { value: "10", text: "伊朗" }, { value: "11", text: "伊拉克" }, { value: "12", text: "以色列" },
  { value: "13", text: "日本" }, { value: "14", text: "约旦" }, { value: "15", text: "南韩" }, { value: "16", text: "科威特" },
  { value: "17", text: "老挝" }, { value: "18", text: "黎巴嫩" }, { value: "19", text: "马来西亚" }, { value: "20", text: "马尔代夫" },
  { value: "21", text: "蒙古" }, { value: "22", text: "尼泊尔" }, { value: "23", text: "巴基斯坦" }, { value: "24", text: "菲律宾" },
  { value: "25", text: "卡塔尔" }, { value: "26", text: "沙特阿拉伯" }, { value: "27", text: "新加坡" }, { value: "28", text: "南也门" },
  { value: "29", text: "叙利亚" }, { value: "30", text: "泰国" }, { value: "31", text: "东帝汶" }, { value: "32", text: "土耳其" },
  { value: "33", text: "北也门" }, { value: "34", text: "越南" }, { value: "50", text: "孟加拉共和国" }, { value: "53", text: "阿曼" },
  { value: "54", text: "基里巴斯" }, { value: "55", text: "塞舌尔" }, { value: "56", text: "图瓦卢" }, { value: "59", text: "阿拉伯联合酋长国" },
  { value: "60", text: "索罗门群岛" }, { value: "62", text: "北韩" }, { value: "63", text: "也门" }, { value: "92", text: "巴勒斯坦" },
  { value: "101", text: "澳大利亚" }, { value: "102", text: "斐济" }, { value: "103", text: "瑙鲁" }, { value: "104", text: "新西兰" },
  { value: "106", text: "东加王国" }, { value: "107", text: "萨摩亚独立国" }, { value: "113", text: "瓦努阿图" }, { value: "114", text: "科克群岛" },
  { value: "115", text: "纽威岛" }, { value: "116", text: "百慕达" }, { value: "119", text: "澳属椰子群岛" }, { value: "120", text: "圣诞岛" },
  { value: "121", text: "北马利亚纳群岛" }, { value: "122", text: "新喀里多尼亚岛" }, { value: "123", text: "沃里斯与伏塔那岛" }, { value: "124", text: "诺福克群岛" },
  { value: "125", text: "托克劳群岛" }, { value: "126", text: "美国边疆群岛" }, { value: "127", text: "英属皮特康岛" }, { value: "128", text: "法属玻里尼西亚" },
  { value: "194", text: "密克罗尼西亚" }, { value: "196", text: "帕劳" }, { value: "201", text: "阿尔巴尼亚" }, { value: "202", text: "安道尔" },
  { value: "203", text: "奥地利" }, { value: "204", text: "比利时" }, { value: "205", text: "保加利亚" }, { value: "206", text: "白俄罗斯" },
  { value: "207", text: "捷克" }, { value: "208", text: "丹麦" }, { value: "209", text: "芬兰" }, { value: "210", text: "法国" },
  { value: "211", text: "德国" }, { value: "212", text: "希腊" }, { value: "213", text: "教廷" }, { value: "214", text: "匈牙利" },
  { value: "215", text: "冰岛" }, { value: "216", text: "爱尔兰" }, { value: "217", text: "意大利" }, { value: "218", text: "列支敦士登" },
  { value: "219", text: "卢森堡" }, { value: "220", text: "马尔他" }, { value: "221", text: "摩纳哥" }, { value: "222", text: "荷兰" },
  { value: "223", text: "挪威" }, { value: "224", text: "波兰" }, { value: "225", text: "葡萄牙" }, { value: "226", text: "罗马尼亚" },
  { value: "227", text: "圣马力诺" }, { value: "228", text: "西班牙" }, { value: "229", text: "瑞典" }, { value: "230", text: "瑞士" },
  { value: "231", text: "乌克兰" }, { value: "232", text: "英国" }, { value: "236", text: "巴布亚新几内亚" }, { value: "238", text: "拉脱维亚" },
  { value: "239", text: "爱沙尼亚" }, { value: "240", text: "亚美尼亚" }, { value: "241", text: "俄罗斯" }, { value: "242", text: "立陶宛" },
  { value: "243", text: "乌兹别克斯坦" }, { value: "244", text: "哈萨克斯坦" }, { value: "245", text: "摩尔多瓦" }, { value: "246", text: "吉尔吉斯" },
  { value: "247", text: "塔吉克斯坦" }, { value: "248", text: "土库曼斯坦" }, { value: "249", text: "阿塞拜疆" }, { value: "250", text: "格鲁吉亚" },
  { value: "251", text: "克罗地亚" }, { value: "252", text: "斯洛文尼亚" }, { value: "253", text: "北马其顿" }, { value: "254", text: "波士尼亚与赫塞哥维纳" },
  { value: "256", text: "斯洛伐克" }, { value: "257", text: "蒙特内哥罗" }, { value: "258", text: "塞尔维亚" }, { value: "259", text: "科索沃" },
  { value: "260", text: "丹麦属法罗群岛" }, { value: "261", text: "格林兰" }, { value: "262", text: "挪威属斯瓦尔巴特群岛" }, { value: "301", text: "巴哈马" },
  { value: "302", text: "巴巴多斯" }, { value: "303", text: "加拿大" }, { value: "304", text: "哥斯达黎加" }, { value: "305", text: "古巴" },
  { value: "306", text: "多米尼加" }, { value: "307", text: "萨尔瓦多" }, { value: "308", text: "危地马拉" }, { value: "309", text: "海地" },
  { value: "310", text: "洪都拉斯" }, { value: "311", text: "牙买加" }, { value: "312", text: "墨西哥" }, { value: "313", text: "尼加拉瓜" },
  { value: "314", text: "巴拿马" }, { value: "315", text: "美国" }, { value: "326", text: "格林纳达" }, { value: "327", text: "马绍尔群岛共和国" },
  { value: "395", text: "英属维尔京群岛" }, { value: "401", text: "阿根廷" }, { value: "402", text: "玻利维亚" }, { value: "403", text: "巴西" },
  { value: "404", text: "智利" }, { value: "405", text: "哥伦比亚" }, { value: "406", text: "厄瓜多尔" }, { value: "407", text: "圭亚那" },
  { value: "408", text: "乌拉圭" }, { value: "409", text: "巴拉圭" }, { value: "410", text: "秘鲁" }, { value: "411", text: "苏里南" },
  { value: "412", text: "特立尼达和多巴哥" }, { value: "413", text: "委内瑞拉" }, { value: "416", text: "安提瓜和巴布达" }, { value: "417", text: "多米尼克" },
  { value: "419", text: "法属圭亚那" }, { value: "420", text: "圣马丁(荷属)" }, { value: "470", text: "古拉索" }, { value: "471", text: "阿鲁巴" },
  { value: "472", text: "荷属安地列斯" }, { value: "473", text: "开曼群岛" }, { value: "474", text: "福克兰群岛" }, { value: "475", text: "法属瓜德鲁普岛" },
  { value: "476", text: "英属蒙瑟拉特岛" }, { value: "477", text: "法属马丁尼克" }, { value: "478", text: "南乔治亚与南桑威奇群岛" }, { value: "479", text: "法属圣皮埃尔和密克隆群岛" },
  { value: "480", text: "英属土克斯及开科斯群岛" }, { value: "481", text: "美属维尔京群岛" }, { value: "501", text: "阿尔及利亚" }, { value: "502", text: "博茨瓦纳" },
  { value: "503", text: "布隆迪" }, { value: "504", text: "中非共和国" }, { value: "505", text: "喀麦隆" }, { value: "506", text: "乍得" },
  { value: "507", text: "刚果共和国" }, { value: "509", text: "贝宁共和国" }, { value: "510", text: "赤道几内亚" }, { value: "511", text: "埃塞俄比亚" },
  { value: "512", text: "加蓬" }, { value: "513", text: "冈比亚" }, { value: "514", text: "加纳" }, { value: "515", text: "几内亚" },
  { value: "516", text: "科特迪瓦" }, { value: "517", text: "肯尼亚" }, { value: "518", text: "莱索托" }, { value: "519", text: "利比里亚" },
  { value: "520", text: "利比亚" }, { value: "521", text: "马达加斯加" }, { value: "522", text: "马拉威" }, { value: "523", text: "马利" },
  { value: "524", text: "毛里塔尼亚" }, { value: "525", text: "毛里求斯" }, { value: "526", text: "摩洛哥" }, { value: "527", text: "尼日尔" },
  { value: "528", text: "尼日利亚" }, { value: "529", text: "津巴布韦" }, { value: "530", text: "卢旺达" }, { value: "531", text: "塞内加尔" },
  { value: "532", text: "塞拉利昂" }, { value: "533", text: "索马里" }, { value: "534", text: "南非" }, { value: "535", text: "苏丹" },
  { value: "536", text: "史瓦帝尼" }, { value: "537", text: "坦桑尼亚" }, { value: "538", text: "多哥" }, { value: "539", text: "突尼斯" },
  { value: "540", text: "乌干达" }, { value: "541", text: "埃及" }, { value: "542", text: "布基纳法索" }, { value: "543", text: "赞比亚" },
  { value: "545", text: "巴林" }, { value: "546", text: "厄立特里亚" }, { value: "547", text: "莫桑比克" }, { value: "548", text: "安哥拉" },
  { value: "551", text: "佛得角共和国" }, { value: "552", text: "吉布堤" }, { value: "553", text: "科摩罗联邦" }, { value: "555", text: "西撒哈拉" },
  { value: "557", text: "几内亚比绍共和国" }, { value: "558", text: "圣多美普林西比" }, { value: "560", text: "纳米比亚" }, { value: "562", text: "刚果民主共和国" },
  { value: "563", text: "南苏丹" }, { value: "564", text: "英属印度洋地区" }, { value: "565", text: "美亚特" }, { value: "566", text: "英属圣赫勒拿岛" },
  { value: "567", text: "索马利兰" }, { value: "601", text: "圣文森特和格林纳丁斯" }, { value: "602", text: "圣卢西亚" }, { value: "603", text: "圣基茨和尼维斯" },
  { value: "604", text: "伯利兹" }, { value: "881", text: "法属南部属地" }, { value: "882", text: "波维特岛" }, { value: "883", text: "赫德及麦当劳群岛" },
  { value: "994", text: "無國籍-依1954年無國籍人士公約" }, { value: "995", text: "難民-依1954年難民公約所定義" }, { value: "996", text: "難民-非依1954年難民公約所定義" },
  { value: "997", text: "無國籍-不屬於代碼994、995及996者" }, { value: "999", text: "無國籍" },
];

const KINSHIP_STATUS = [
  { value: "1", text: "Living", label_zh: "存" },
  { value: "2", text: "Deceased", label_zh: "殁" },
  { value: "3", text: "Divorced", label_zh: "离婚" },
];

/** Builds the 8 repeated fields for one kinship group (父/母/配偶/子女×2). */
function kinshipFields(
  group: "father" | "mother" | "spouse" | "child1" | "child2",
  labelZh: string,
  stepNumber: number,
  requiredGroup: boolean,
  startOrder: number
): FieldDef[] {
  const stepName = "Kinship Information";
  const isParent = group === "father" || group === "mother";
  const statusRequired = isParent ? true : requiredGroup;
  const parentLivingCondition = `kin_${group}_status === 1`;
  const parentAddressCondition = `${parentLivingCondition} && kin_${group}_current_address_same_as_overseas === false`;
  const parentServiceUnitTitleCondition = `${parentLivingCondition} && kin_${group}_occupation not in [15,16,17]`;
  const parentRequiredRules = (field: string) => isParent
    ? {
        block_group: `kin_${group}`,
        required_when: parentLivingCondition,
        note: `Official screenshot evidence: ${labelZh} ${field} is required when existence/status is 存.`,
      }
    : { block_group: `kin_${group}` };
  const parentRequiredLogic = isParent ? { showIf: parentLivingCondition } : undefined;
  return [
    { field_name: `kin_${group}_status`, label: `${labelZh} — Living/deceased/divorced`, field_type: "select", required: statusRequired, step_number: stepNumber, step_name: stepName, display_order: startOrder, options: KINSHIP_STATUS, validation_rules: { block_group: `kin_${group}`, note: statusRequired ? "TW-A live DOM recheck found father/mother deadMark controls with aria-required and an asterisk; other kinship fields remain optional." : undefined } },
    { field_name: `kin_${group}_name`, label: `${labelZh} — Name`, field_type: "text", required: isParent, step_number: stepNumber, step_name: stepName, display_order: startOrder + 1, conditional_logic: parentRequiredLogic, validation_rules: parentRequiredRules("name") },
    { field_name: `kin_${group}_date_of_birth`, label: `${labelZh} — Date of birth`, field_type: "date", required: isParent, step_number: stepNumber, step_name: stepName, display_order: startOrder + 2, conditional_logic: parentRequiredLogic, validation_rules: parentRequiredRules("date of birth") },
    { field_name: `kin_${group}_phone`, label: `${labelZh} — Phone`, field_type: "text", required: isParent, step_number: stepNumber, step_name: stepName, display_order: startOrder + 3, conditional_logic: parentRequiredLogic, validation_rules: parentRequiredRules("phone") },
    { field_name: `kin_${group}_occupation`, label: `${labelZh} — Occupation`, field_type: "select", required: isParent, step_number: stepNumber, step_name: stepName, display_order: startOrder + 4, options: OCCUPATIONS, conditional_logic: parentRequiredLogic, validation_rules: parentRequiredRules("occupation") },
    { field_name: `kin_${group}_service_unit`, label: `${labelZh} — Employer / unit`, field_type: "text", required: isParent, step_number: stepNumber, step_name: stepName, display_order: startOrder + 5, placeholder: "Required for employed occupations and retired-before unit; not required for Freelance/Other/None", conditional_logic: isParent ? { showIf: parentServiceUnitTitleCondition } : undefined, validation_rules: isParent ? { block_group: `kin_${group}`, required_when: parentServiceUnitTitleCondition, occupation_codes_not_required: ["15", "16", "17"], retired_code_requires_prior_detail: "62", note: "For parents marked 存, official occupation codes 自由業(15)、其他業(16)、無(17) do not require unit/title detail; 退休(62) requires retired-before unit/title." } : { block_group: `kin_${group}` } },
    { field_name: `kin_${group}_job_title`, label: `${labelZh} — Job title`, field_type: "text", required: isParent, step_number: stepNumber, step_name: stepName, display_order: startOrder + 6, conditional_logic: isParent ? { showIf: parentServiceUnitTitleCondition } : undefined, validation_rules: isParent ? { block_group: `kin_${group}`, required_when: parentServiceUnitTitleCondition, occupation_codes_not_required: ["15", "16", "17"], retired_code_requires_prior_detail: "62", note: "For parents marked 存, official occupation codes 自由業(15)、其他業(16)、無(17) do not require unit/title detail; 退休(62) requires retired-before unit/title." } : { block_group: `kin_${group}` } },
    { field_name: `kin_${group}_current_address_same_as_overseas`, label: `${labelZh} — Current address same as applicant's overseas address`, field_type: "checkbox", required: false, step_number: stepNumber, step_name: stepName, display_order: startOrder + 7, conditional_logic: parentRequiredLogic, validation_rules: { block_group: `kin_${group}`, note: "Mirrors the portal's '同申請人海外地址' quick-fill button; src/tw/normalize.ts copies overseas_address into kin_*_current_address when true." } },
    { field_name: `kin_${group}_current_address`, label: `${labelZh} — Current address`, field_type: "textarea", required: isParent, step_number: stepNumber, step_name: stepName, display_order: startOrder + 8, conditional_logic: isParent ? { showIf: parentAddressCondition } : { showIf: `kin_${group}_current_address_same_as_overseas === false` }, validation_rules: isParent ? { block_group: `kin_${group}`, required_when: parentAddressCondition, note: "Official screenshot evidence: parent current address is required when existence/status is 存, unless the same-as-applicant address helper is used." } : { block_group: `kin_${group}` } },
  ];
}

const FIELDS: FieldDef[] = [
  // ═══════════════════════════════════════════════════════════════════════
  // STEP 0: Delivery Location (遞送地點) — first tab on the official portal
  // ═══════════════════════════════════════════════════════════════════════
  { field_name: "continent", label: "Continent", field_type: "select", required: true, step_number: 0, step_name: "Delivery Location", display_order: 1, options: CONTINENTS },
  { field_name: "embassy_office", label: "Receiving embassy/office", field_type: "select", required: true, step_number: 0, step_name: "Delivery Location", display_order: 2, options: EMBASSY_OFFICES, validation_rules: { dependent_on: "continent", dependent_options: EMBASSY_OFFICES_BY_CONTINENT, official_dom_name: "overseaOfficeId", note: "Official portal repopulates overseaOfficeId options when continent changes; values captured from the live dropdown on 2026-08-03." } },

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 1: Basic Status
  //
  // photo_upload and the 6 supporting-document fields (mainland_travel_
  // document, eligibility_supporting_document, hk_macau_id_scan,
  // other_nationality_passport_scan, mainland_id_card_scan,
  // other_supporting_document) are deliberately NOT modeled here as
  // field_type: "file" rows. Every country on this DynamicStepForm/long-form
  // system (UK, Indonesia, PH-eTravel, etc.) renders file uploads exclusively
  // via the separate Documents step (DocumentCenterClient), which reads its
  // checklist from the document_requirements table — dynamic-form-field.tsx's
  // "file" case only ever renders an inert "Upload: {label}" placeholder box
  // (no real <input type="file">), so including these here just produces a
  // dead, confusing control sitting next to real fields. Taiwan's matching
  // document_requirements rows for all 7 of these were already added in
  // drizzle/0122_tw_entry_permit_document_requirements.sql (requirement_keys:
  // photo, mainland_travel_document, eligibility_supporting_document,
  // hk_macau_id_scan, other_nationality_passport_scan, mainland_id_card_scan,
  // other_supporting_document) — the Documents step already shows them
  // automatically with no changes needed here.
  // ═══════════════════════════════════════════════════════════════════════
  { field_name: "first_time_applying", label: "First time applying to visit Taiwan from abroad/HK/Macau?", field_type: "radio", required: true, step_number: 1, step_name: "Photo & Basic Status", display_order: 1, options: YES_NO },
  { field_name: "permit_type", label: "Permit type applied for", field_type: "radio", required: true, step_number: 1, step_name: "Photo & Basic Status", display_order: 2, options: [
    { value: "1", text: "Single-entry permit", label_zh: "单次证" },
    { value: "2", text: "Multiple-entry permit", label_zh: "多次证" },
    { value: "H", text: "Main applicant already holds a multiple-entry permit", label_zh: "主要申请人已领多次证" },
  ] },
  { field_name: "permit_count", label: "Number of permits requested", field_type: "select", required: true, step_number: 1, step_name: "Photo & Basic Status", display_order: 3, options: [{ value: "1", text: "1 permit", label_zh: "1张" }, { value: "2", text: "2 permits (cruise second-leg only)", label_zh: "2张" }] },
  { field_name: "has_other_nationality_passport", label: "Do you hold a passport of another nationality?", field_type: "radio", required: true, step_number: 1, step_name: "Photo & Basic Status", display_order: 4, options: YES_NO, validation_rules: { note: "Must be answered truthfully; concealment can void the application per the portal's own warning." } },
  { field_name: "household_revoked", label: "Current mainland household registration status", field_type: "radio", required: false, step_number: 1, step_name: "Photo & Basic Status", display_order: 5, options: [
    { value: "no", text: "Not revoked, or revoked but have not yet obtained a Hong Kong/Macau passport", label_zh: "未注销户口登记，或已注销户口登记但尚未取得香港、澳门护照", official_label: "未註銷戶口登記/已註銷戶口登記，但尚未取得香港、澳門護照" },
    { value: "yes", text: "Revoked", label_zh: "已注销户口登记", official_label: "已註銷戶口登記" },
  ], validation_rules: { required_when: "eligibility_category === 2 && embassy_office in [50, 51]", official_dom_name: "householdRevoked", official_values: { no: "N", yes: "Y" }, note: "Official DOM hides #household-revoked-div unless applyQualification=5 (VIZA eligibility_category=2) and overseaOfficeId is 50/51 (HK/Macau office)." }, conditional_logic: { showIf: "eligibility_category === 2 && embassy_office in [50, 51]" } },
  { field_name: "eligibility_category", label: "Eligibility category", field_type: "radio", required: true, step_number: 1, step_name: "Photo & Basic Status", display_order: 6, options: ELIGIBILITY_CATEGORIES },

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 2: Applicant Identity
  // ═══════════════════════════════════════════════════════════════════════
  { field_name: "name_chinese", label: "Name in Chinese (traditional characters)", field_type: "text", required: true, step_number: 2, step_name: "Applicant Identity", display_order: 1, validation_rules: { official_dom_name: "traveller.chineseName", requires_traditional_chinese_name: true, disallow_latin_only: true, disallow_latin_replacement: true, note: "Official field requires the applicant's real Chinese name in Traditional Chinese characters; a non-empty Latin placeholder or passport English name is not acceptable." } },
  { field_name: "name_english", label: "Name in English (as shown in passport, uppercase)", field_type: "text", required: true, step_number: 2, step_name: "Applicant Identity", display_order: 2 },
  { field_name: "date_of_birth", label: "Date of birth", field_type: "date", required: true, step_number: 2, step_name: "Applicant Identity", display_order: 3 },
  { field_name: "passport_number", label: "Passport / HK visa identity document / Macau travel document / mainland travel document number", field_type: "text", required: true, step_number: 2, step_name: "Applicant Identity", display_order: 4 },
  { field_name: "passport_expiry_date", label: "Passport / travel document validity expiry date (Gregorian calendar)", field_type: "date", required: true, step_number: 2, step_name: "Applicant Identity", display_order: 5, validation_rules: { note: "Must have 6+ months validity remaining at entry." } },
  { field_name: "gender", label: "Gender", field_type: "select", required: true, step_number: 2, step_name: "Applicant Identity", display_order: 6, options: [{ value: "0", text: "Male", label_zh: "男" }, { value: "1", text: "Female", label_zh: "女" }] },
  { field_name: "overseas_residency_id_number", label: "Overseas Chinese residency identity number (e.g. permanent residence number, residence card number, or visa number)", field_type: "text", required: true, step_number: 2, step_name: "Applicant Identity", display_order: 7 },
  { field_name: "mainland_id_number_not_applicable", label: "No mainland ID number", field_type: "checkbox", required: false, step_number: 2, step_name: "Applicant Identity", display_order: 8 },
  { field_name: "mainland_id_number", label: "Mainland ID number", field_type: "text", required: true, step_number: 2, step_name: "Applicant Identity", display_order: 9, conditional_logic: { showIf: "mainland_id_number_not_applicable === false" }, validation_rules: { note: "Required when shown; exempt only when mainland_id_number_not_applicable is checked." } },
  { field_name: "birth_place_is_mainland", label: "Place of birth (same as travel document held)", field_type: "select", required: true, step_number: 2, step_name: "Applicant Identity", display_order: 10, options: [{ value: "mainland", text: "Mainland China", label_zh: "中國大陸" }, { value: "other", text: "Other", label_zh: "其他" }], validation_rules: { official_dom_name: "traveller.birthPlaceCode", official_values: { mainland: "1", other: "5" }, branches: { mainland: { source: "BIRTH_PLACE_MAINLAND_OPTIONS", official_dom_name: "traveller.birthPlace1" }, other: { source: "NATIONALITY_OPTIONS", official_dom_name: "traveller.birthPlace1" } } } },
  { field_name: "birth_place_mainland_region", label: "Mainland China birth province/city/region", field_type: "select", required: true, step_number: 2, step_name: "Applicant Identity", display_order: 11, options: BIRTH_PLACE_MAINLAND_OPTIONS, conditional_logic: { showIf: "birth_place_is_mainland === mainland" }, validation_rules: { required_when: "birth_place_is_mainland === mainland", official_dom_name: "traveller.birthPlace1", branch_for: "birth_place_is_mainland === mainland", source: "BIRTH_PLACE_MAINLAND_OPTIONS", note: "Required second-level province/city/region select when birth_place_is_mainland is 中國大陸." } },
  { field_name: "birth_place_other_country", label: "Country/region of birth", field_type: "select", required: true, step_number: 2, step_name: "Applicant Identity", display_order: 11, options: NATIONALITY_OPTIONS, conditional_logic: { showIf: "birth_place_is_mainland === other" }, validation_rules: { official_dom_name: "traveller.birthPlace1", branch_for: "birth_place_is_mainland === other", source: "NATIONALITY_OPTIONS", note: "Do not replace Taiwan official numeric values with ISO alpha codes; options include official special identity codes 994/995/996/997/999." } },
  { field_name: "local_mobile_phone", label: "Mobile phone at current residence (include country code)", field_type: "text", required: true, step_number: 2, step_name: "Applicant Identity", display_order: 12 },
  { field_name: "current_occupation", label: "Current occupation", field_type: "select", required: true, step_number: 2, step_name: "Applicant Identity", display_order: 13, options: OCCUPATIONS },
  { field_name: "occupation_experience", label: "Experience", field_type: "textarea", required: true, step_number: 2, step_name: "Applicant Identity", display_order: 14, conditional_logic: { showIf: "current_occupation === 62" }, validation_rules: { note: "TW-A live DOM/visible text recheck only supports the official retirement prompt: if current occupation is retired, fill prior service unit and job title. Freelance/other/none are no longer treated as triggers without submit-validation evidence." } },
  { field_name: "company_name", label: "Company name and full organization/unit name or school name", field_type: "text", required: true, step_number: 2, step_name: "Applicant Identity", display_order: 15, conditional_logic: { showIf: "current_occupation not in [61,62]" }, validation_rules: { required_when: "current_occupation not in [61,62]", student_school_name_required_when: "current_occupation === 14", accepted_scripts_when_student: ["traditional_chinese", "english"], note: "Confirmed from local official-page screenshot: hidden/not required when current_occupation is 待業(61) or 退休(62). When current_occupation is 學生(14), this field remains required and must be the official full school name in Traditional Chinese or English; do not use an informal abbreviation." } },
  { field_name: "job_title", label: "Job title", field_type: "text", required: true, step_number: 2, step_name: "Applicant Identity", display_order: 16, conditional_logic: { showIf: "current_occupation not in [14,61,62]" }, validation_rules: { required_when: "current_occupation not in [14,61,62]", note: "Confirmed from local official-page screenshot: hidden/not required for 學生(14), 待業(61), and 退休(62); visible/required for ordinary occupations." } },
  { field_name: "is_taiwanese_spouse", label: "Are you the spouse of a Taiwanese person?", field_type: "select", required: true, step_number: 2, step_name: "Applicant Identity", display_order: 17, options: YES_NO, validation_rules: { note: "This permit cannot be used to register a marriage in Taiwan. Confirmed live to carry a required asterisk, unlike traveling_with_parents below." } },
  { field_name: "traveling_with_parents", label: "Are your parents traveling with you?", field_type: "select", required: false, step_number: 2, step_name: "Applicant Identity", display_order: 18, options: YES_NO },
  { field_name: "overseas_address", label: "Hong Kong, Macau, or overseas address", field_type: "textarea", required: true, step_number: 2, step_name: "Applicant Identity", display_order: 19 },

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 3: Taiwan Contact Address (在台聯絡地址 — 8 sub-fields on the portal)
  // ═══════════════════════════════════════════════════════════════════════
  { field_name: "tw_contact_city", label: "City/County", field_type: "select", required: true, step_number: 3, step_name: "Taiwan Contact Address", display_order: 1, options: TW_CITIES },
  { field_name: "tw_contact_district", label: "District/township", field_type: "select", required: false, step_number: 3, step_name: "Taiwan Contact Address", display_order: 2, options: [], validation_rules: { dependent_on: "tw_contact_city", dependent_options_key: "taiwan_districts_by_city", source: "taiwan_official_address_districts", note: "District/township options are constrained by the selected Taiwan city/county. Prior TW-A evidence confirms the city/county, road, and building fields as required; district remains optional until official submit-validation evidence says otherwise." } },
  { field_name: "tw_contact_village", label: "Village (村/里, optional)", field_type: "text", required: false, step_number: 3, step_name: "Taiwan Contact Address", display_order: 3 },
  { field_name: "tw_contact_neighborhood", label: "Neighborhood (邻, number only)", field_type: "text", required: false, step_number: 3, step_name: "Taiwan Contact Address", display_order: 4 },
  { field_name: "tw_contact_road", label: "Street or road section", field_type: "text", required: true, step_number: 3, step_name: "Taiwan Contact Address", display_order: 5 },
  { field_name: "tw_contact_lane", label: "Lane (巷, number only)", field_type: "text", required: false, step_number: 3, step_name: "Taiwan Contact Address", display_order: 6 },
  { field_name: "tw_contact_alley", label: "Alley (弄, number only)", field_type: "text", required: false, step_number: 3, step_name: "Taiwan Contact Address", display_order: 7 },
  { field_name: "tw_contact_building_number", label: "House number / floor / room number (or hotel name if staying at a hotel)", field_type: "text", required: true, step_number: 3, step_name: "Taiwan Contact Address", display_order: 8 },
  { field_name: "tw_local_phone", label: "Taiwan landline number", field_type: "text", required: false, step_number: 3, step_name: "Taiwan Contact Address", display_order: 9, validation_rules: { required_when: "tw_contact_mobile_not_applicable === true", note: "Official screenshot confirms landline is required only after the applicant checks no Taiwan contact mobile number." } },
  { field_name: "tw_contact_mobile_not_applicable", label: "No Taiwan contact mobile number", field_type: "checkbox", required: false, step_number: 3, step_name: "Taiwan Contact Address", display_order: 10 },
  { field_name: "tw_contact_mobile", label: "Taiwan contact mobile number", field_type: "text", required: true, step_number: 3, step_name: "Taiwan Contact Address", display_order: 11, conditional_logic: { showIf: "tw_contact_mobile_not_applicable === false" }, validation_rules: { note: "Confirmed live to carry a required asterisk when shown (i.e. when tw_contact_mobile_not_applicable is unchecked)." } },

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 4: Other Nationality (conditional block, shown only if Q "has_other_nationality_passport" = yes)
  // ═══════════════════════════════════════════════════════════════════════
  { field_name: "other_nationality_country", label: "Other nationality held", field_type: "select", required: true, step_number: 4, step_name: "Other Nationality", display_order: 1, options: NATIONALITY_OPTIONS, conditional_logic: { showIf: "has_other_nationality_passport === yes" } },
  { field_name: "other_passport_number", label: "Other country's passport/document number", field_type: "text", required: true, step_number: 4, step_name: "Other Nationality", display_order: 2, conditional_logic: { showIf: "has_other_nationality_passport === yes" } },
  { field_name: "other_passport_expiry_date", label: "Other country's passport/document validity expiry date", field_type: "date", required: true, step_number: 4, step_name: "Other Nationality", display_order: 3, conditional_logic: { showIf: "has_other_nationality_passport === yes" } },

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 5: Kinship Information (親屬狀況 — 父/母/配偶/子女×2, 5 repeated blocks)
  // A prior pass assumed only the 父 (father) block was required. A fresh
  // live re-check (querying every kinship label's asterisk class directly)
  // found NONE of the 5 blocks' fields carry a required asterisk — the
  // whole kinship section is optional. `requiredGroup` kept as a parameter
  // for forward compat but all groups now pass `false`.
  // ═══════════════════════════════════════════════════════════════════════
  ...kinshipFields("father", "Father (父)", 5, false, 1),
  ...kinshipFields("mother", "Mother (母)", 5, false, 20),
  ...kinshipFields("spouse", "Spouse (配偶)", 5, false, 40),
  ...kinshipFields("child1", "Child 1 (子女)", 5, false, 60),
  ...kinshipFields("child2", "Child 2 (子女)", 5, false, 80),

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 6: Declaration (申報事項)
  // ═══════════════════════════════════════════════════════════════════════
  { field_name: "past_mainland_political_military_role", label: "Applicant previously held a position or membership in a mainland China party, administrative, military, or politically affiliated organ/organization/group", field_type: "checkbox", required: false, step_number: 6, step_name: "Declaration", display_order: 1 },
  { field_name: "past_role_detail", label: "Previously served at", field_type: "text", required: true, step_number: 6, step_name: "Declaration", display_order: 2, conditional_logic: { showIf: "past_mainland_political_military_role === true" } },
  { field_name: "current_mainland_political_military_role", label: "Applicant currently holds a position or membership in a mainland China party, administrative, military, or politically affiliated organ/organization/group", field_type: "checkbox", required: false, step_number: 6, step_name: "Declaration", display_order: 3 },
  { field_name: "current_role_detail", label: "Currently serving at", field_type: "text", required: true, step_number: 6, step_name: "Declaration", display_order: 4, conditional_logic: { showIf: "current_mainland_political_military_role === true" } },
  { field_name: "never_held_mainland_political_military_role", label: "Applicant has never held such a mainland China party, administrative, military, or politically affiliated role or membership", field_type: "checkbox", required: false, step_number: 6, step_name: "Declaration", display_order: 5 },
  { field_name: "accepted_terms", label: "I have read and accept the following terms and conditions", field_type: "checkbox", required: true, step_number: 6, step_name: "Declaration", display_order: 6, validation_rules: { mustBeTrue: true } },
];

// ─── Seed Runner ────────────────────────────────────────────────────────────

async function seed() {
  console.log(`Seeding ${FIELDS.length} fields for visa_type="${VISA_TYPE}"...\n`);

  const { error: delError } = await supabase
    .from("visa_form_fields")
    .delete()
    .eq("visa_type", VISA_TYPE);
  if (delError) {
    console.error(`Error deleting existing ${VISA_TYPE} fields:`, delError.message);
  } else {
    console.log(`Cleared existing ${VISA_TYPE} fields`);
  }

  const rows = FIELDS.map((f) => toBilingualSeedRow(VISA_TYPE, f));

  const BATCH = 20;
  let total = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { data, error } = await supabase
      .from("visa_form_fields")
      .insert(batch)
      .select("id");
    if (error) {
      console.error(`Batch ${Math.floor(i / BATCH) + 1} error:`, error.message);
    } else {
      total += data?.length ?? 0;
      process.stdout.write(`Batch ${Math.floor(i / BATCH) + 1}: ${data?.length ?? 0} inserted\n`);
    }
  }
  console.log(`\nDone: ${total} rows seeded (${FIELDS.length} defined)`);
}

seed().catch((err) => { console.error(err); process.exit(1); });
