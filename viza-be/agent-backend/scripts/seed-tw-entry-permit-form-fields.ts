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

const CONTINENTS = [
  { value: "A", text: "Asia", label_zh: "亞洲" },
  { value: "B", text: "Americas", label_zh: "美洲" },
  { value: "C", text: "Europe", label_zh: "歐洲" },
  { value: "D", text: "Africa", label_zh: "非洲" },
  { value: "E", text: "Oceania", label_zh: "大洋洲" },
];

const EMBASSY_OFFICES = [
  { value: "50", text: "Taipei Economic and Cultural Office / Hong Kong Office", label_zh: "台北經濟文化辦事處／香港辦事處" },
  { value: "51", text: "Taipei Economic and Cultural Office / Macau Office", label_zh: "台北經濟文化辦事處／澳門辦事處" },
  { value: "5A", text: "Taipei Economic and Cultural Representative Office (Tokyo)", label_zh: "台北駐日經濟文化代表處(東京)" },
  { value: "5C", text: "Taipei Economic and Cultural Office in Osaka", label_zh: "台北駐大阪經濟文化辦事處" },
  { value: "5F", text: "Taipei Mission in Korea", label_zh: "駐韓國台北代表處" },
  { value: "55", text: "Taipei Economic and Cultural Office in Malaysia", label_zh: "駐馬來西亞台北經濟文化辦事處" },
  { value: "56", text: "Taipei Economic and Cultural Office in the Philippines", label_zh: "駐菲律賓台北經濟文化辦事處" },
  { value: "53", text: "Taipei Representative Office in Singapore", label_zh: "駐新加坡台北代表處" },
  { value: "52", text: "Taipei Economic and Cultural Office in Thailand", label_zh: "駐泰國台北經濟文化辦事處" },
  { value: "67", text: "Taipei Economic and Cultural Office (Hanoi)", label_zh: "駐越南代表處(河內)" },
  { value: "57", text: "Taipei Economic and Cultural Office in Ho Chi Minh City", label_zh: "駐胡志明市台北經濟文化辦事處" },
  { value: "58", text: "Taipei Economic and Cultural Office in Myanmar", label_zh: "駐緬甸代表處" },
  { value: "66", text: "Taipei Economic and Cultural Center in India", label_zh: "駐印度代表處" },
  { value: "54", text: "Taipei Economic and Trade Office in Indonesia", label_zh: "駐印尼台北經濟貿易代表處" },
];

const ELIGIBILITY_CATEGORIES = [
  { value: "1", text: "Studying abroad or in Hong Kong/Macau", label_zh: "赴國外或香港、澳門留學生" },
  { value: "2", text: "Obtained permanent residency abroad or in Hong Kong/Macau", label_zh: "旅居國外或香港、澳門取得當地永久居留權" },
  { value: "3", text: "Resided abroad or in Hong Kong/Macau 1+ year with valid work proof", label_zh: "旅居國外或香港、澳門1年以上且領有工作證明" },
  { value: "4", text: "Obtained dependent residency abroad or in Hong Kong/Macau with financial proof", label_zh: "旅居國外或香港、澳門取得當地依親居留權且有財力證明" },
];

const OCCUPATIONS = [
  { value: "1", text: "Military", label_zh: "軍人" }, { value: "2", text: "Civil servant", label_zh: "公務員" },
  { value: "3", text: "Public/school staff", label_zh: "公教職員" }, { value: "4", text: "Private school faculty", label_zh: "私校教職" },
  { value: "5", text: "Business", label_zh: "商" }, { value: "6", text: "Agriculture", label_zh: "農" },
  { value: "7", text: "Industry", label_zh: "工" }, { value: "8", text: "Medical personnel", label_zh: "醫事人員" },
  { value: "9", text: "Religious worker", label_zh: "宗教人士" }, { value: "10", text: "Entertainer", label_zh: "演藝人員" },
  { value: "11", text: "Journalism", label_zh: "新聞事業" }, { value: "12", text: "Fishing vessel crew", label_zh: "漁船船員" },
  { value: "13", text: "Ship crew", label_zh: "輪船船員" }, { value: "14", text: "Student", label_zh: "學生" },
  { value: "15", text: "Freelance", label_zh: "自由業" }, { value: "16", text: "Other occupation", label_zh: "其他業" },
  { value: "17", text: "None", label_zh: "無" }, { value: "18", text: "Police", label_zh: "警" },
  { value: "19", text: "Seafarer", label_zh: "船員" }, { value: "20", text: "Homemaker", label_zh: "家庭主婦" },
  { value: "21", text: "Technician (trade)", label_zh: "技工" }, { value: "22", text: "Artist", label_zh: "藝術家" },
  { value: "23", text: "Nurse", label_zh: "護士" }, { value: "24", text: "Pilot", label_zh: "飛行員" },
  { value: "25", text: "Specialist", label_zh: "專家" }, { value: "27", text: "Salesperson", label_zh: "推銷員" },
  { value: "28", text: "Scientist", label_zh: "科學家" }, { value: "29", text: "Secretary", label_zh: "秘書" },
  { value: "30", text: "Technician", label_zh: "技師" }, { value: "31", text: "Writer", label_zh: "作家" },
  { value: "32", text: "Consultant", label_zh: "顧問" }, { value: "33", text: "Professor", label_zh: "教授" },
  { value: "34", text: "Accountant", label_zh: "會計員" }, { value: "35", text: "Bank employee", label_zh: "銀行員" },
  { value: "36", text: "Diver", label_zh: "潛水夫" }, { value: "37", text: "Lawyer", label_zh: "律師" },
  { value: "38", text: "Diplomat", label_zh: "外交人員" }, { value: "39", text: "Musician", label_zh: "音樂家" },
  { value: "40", text: "IT professional", label_zh: "資訊人員" }, { value: "41", text: "Researcher", label_zh: "研究人員" },
  { value: "42", text: "Engineer", label_zh: "工程師" }, { value: "47", text: "White-collar seafarer", label_zh: "白領船員" },
  { value: "48", text: "Blue-collar seafarer", label_zh: "藍領船員" }, { value: "49", text: "Caregiver", label_zh: "看護工" },
  { value: "50", text: "Institutional caregiver", label_zh: "養護機構看護工" }, { value: "51", text: "Unspecified", label_zh: "未註明" },
  { value: "52", text: "Staff/clerk", label_zh: "職員" }, { value: "53", text: "Teacher", label_zh: "教師" },
  { value: "54", text: "Doctor", label_zh: "醫生" }, { value: "55", text: "Missionary", label_zh: "傳教士" },
  { value: "56", text: "Journalist/reporter", label_zh: "記者" }, { value: "58", text: "Athlete", label_zh: "運動人員" },
  { value: "61", text: "Unemployed / job-seeking", label_zh: "待業" }, { value: "62", text: "Retired", label_zh: "退休" },
];

const TW_CITIES = [
  "臺北市", "基隆市", "新北市", "宜蘭縣", "新竹市", "新竹縣", "桃園市", "苗栗縣", "臺中市", "彰化縣",
  "南投縣", "嘉義市", "嘉義縣", "雲林縣", "臺南市", "高雄市", "澎湖縣", "屏東縣", "臺東縣", "花蓮縣",
  "金門縣", "連江縣",
].map((c, i) => ({ value: String(i + 1), text: c, label_zh: c }));

// Full "所具其他國籍為" nationality list, verbatim (value = numeric code used by the portal's <select>).
const NATIONALITY_OPTIONS: Array<{ value: string; text: string }> = [
  { value: "1", text: "阿富汗" }, { value: "2", text: "不丹" }, { value: "3", text: "汶萊" }, { value: "4", text: "緬甸" },
  { value: "5", text: "柬埔寨" }, { value: "6", text: "斯里蘭卡" }, { value: "7", text: "賽普勒斯" }, { value: "8", text: "印度" },
  { value: "9", text: "印尼" }, { value: "10", text: "伊朗" }, { value: "11", text: "伊拉克" }, { value: "12", text: "以色列" },
  { value: "13", text: "日本" }, { value: "14", text: "約旦" }, { value: "15", text: "南韓" }, { value: "16", text: "科威特" },
  { value: "17", text: "寮國" }, { value: "18", text: "黎巴嫩" }, { value: "19", text: "馬來西亞" }, { value: "20", text: "馬爾地夫" },
  { value: "21", text: "蒙古" }, { value: "22", text: "尼泊爾" }, { value: "23", text: "巴基斯坦" }, { value: "24", text: "菲律賓" },
  { value: "25", text: "卡達" }, { value: "26", text: "沙烏地阿拉伯" }, { value: "27", text: "新加坡" }, { value: "28", text: "南葉門" },
  { value: "29", text: "敘利亞" }, { value: "30", text: "泰國" }, { value: "31", text: "東帝汶" }, { value: "32", text: "土耳其" },
  { value: "33", text: "北葉門" }, { value: "34", text: "越南" }, { value: "50", text: "孟加拉共和國" }, { value: "53", text: "阿曼" },
  { value: "54", text: "吉里巴斯" }, { value: "55", text: "塞席爾" }, { value: "56", text: "吐瓦魯" }, { value: "59", text: "阿拉伯聯合大公國" },
  { value: "60", text: "索羅門群島" }, { value: "62", text: "北韓" }, { value: "63", text: "葉門" }, { value: "92", text: "巴勒斯坦" },
  { value: "101", text: "澳大利亞" }, { value: "102", text: "斐濟" }, { value: "103", text: "諾魯" }, { value: "104", text: "紐西蘭" },
  { value: "106", text: "東加王國" }, { value: "107", text: "薩摩亞獨立國" }, { value: "113", text: "萬那杜" }, { value: "114", text: "科克群島" },
  { value: "115", text: "紐威島" }, { value: "116", text: "百慕達" }, { value: "119", text: "澳屬椰子群島" }, { value: "120", text: "聖誕島" },
  { value: "121", text: "北馬利亞納群島" }, { value: "122", text: "新喀里多尼亞島" }, { value: "123", text: "沃里斯與伏塔那島" }, { value: "124", text: "諾福克群島" },
  { value: "125", text: "托克勞群島" }, { value: "126", text: "美國邊疆群島" }, { value: "127", text: "英屬皮特康島" }, { value: "128", text: "法屬玻里尼西亞" },
  { value: "194", text: "密克羅尼西亞" }, { value: "196", text: "帛琉" }, { value: "201", text: "阿爾巴尼亞" }, { value: "202", text: "安道爾" },
  { value: "203", text: "奧地利" }, { value: "204", text: "比利時" }, { value: "205", text: "保加利亞" }, { value: "206", text: "白俄羅斯" },
  { value: "207", text: "捷克" }, { value: "208", text: "丹麥" }, { value: "209", text: "芬蘭" }, { value: "210", text: "法國" },
  { value: "211", text: "德國" }, { value: "212", text: "希臘" }, { value: "213", text: "教廷" }, { value: "214", text: "匈牙利" },
  { value: "215", text: "冰島" }, { value: "216", text: "愛爾蘭" }, { value: "217", text: "義大利" }, { value: "218", text: "列支敦斯登" },
  { value: "219", text: "盧森堡" }, { value: "220", text: "馬爾他" }, { value: "221", text: "摩納哥" }, { value: "222", text: "荷蘭" },
  { value: "223", text: "挪威" }, { value: "224", text: "波蘭" }, { value: "225", text: "葡萄牙" }, { value: "226", text: "羅馬尼亞" },
  { value: "227", text: "聖馬利諾" }, { value: "228", text: "西班牙" }, { value: "229", text: "瑞典" }, { value: "230", text: "瑞士" },
  { value: "231", text: "烏克蘭" }, { value: "232", text: "英國" }, { value: "236", text: "巴布亞紐幾內亞" }, { value: "238", text: "拉脫維亞" },
  { value: "239", text: "愛沙尼亞" }, { value: "240", text: "亞美尼亞" }, { value: "241", text: "俄羅斯" }, { value: "242", text: "立陶宛" },
  { value: "243", text: "烏茲別克" }, { value: "244", text: "哈薩克" }, { value: "245", text: "摩爾多瓦" }, { value: "246", text: "吉爾吉斯" },
  { value: "247", text: "塔吉克" }, { value: "248", text: "土庫曼" }, { value: "249", text: "亞塞拜然" }, { value: "250", text: "喬治亞" },
  { value: "251", text: "克羅埃西亞" }, { value: "252", text: "斯洛維尼亞" }, { value: "253", text: "北馬其頓" }, { value: "254", text: "波士尼亞與赫塞哥維納" },
  { value: "256", text: "斯洛伐克" }, { value: "257", text: "蒙特內哥羅" }, { value: "258", text: "塞爾維亞" }, { value: "259", text: "科索沃" },
  { value: "260", text: "丹麥屬法羅群島" }, { value: "261", text: "格林蘭" }, { value: "262", text: "挪威屬斯瓦爾巴特群島" }, { value: "301", text: "巴哈馬" },
  { value: "302", text: "巴貝多" }, { value: "303", text: "加拿大" }, { value: "304", text: "哥斯大黎加" }, { value: "305", text: "古巴" },
  { value: "306", text: "多明尼加" }, { value: "307", text: "薩爾瓦多" }, { value: "308", text: "瓜地馬拉" }, { value: "309", text: "海地" },
  { value: "310", text: "宏都拉斯" }, { value: "311", text: "牙買加" }, { value: "312", text: "墨西哥" }, { value: "313", text: "尼加拉瓜" },
  { value: "314", text: "巴拿馬" }, { value: "315", text: "美國" }, { value: "326", text: "格瑞那達" }, { value: "327", text: "馬紹爾群島共和國" },
  { value: "395", text: "英屬維爾京群島" }, { value: "401", text: "阿根廷" }, { value: "402", text: "玻利維亞" }, { value: "403", text: "巴西" },
  { value: "404", text: "智利" }, { value: "405", text: "哥倫比亞" }, { value: "406", text: "厄瓜多" }, { value: "407", text: "蓋亞那" },
  { value: "408", text: "烏拉圭" }, { value: "409", text: "巴拉圭" }, { value: "410", text: "秘魯" }, { value: "411", text: "蘇利南" },
  { value: "412", text: "千里達及托巴哥" }, { value: "413", text: "委內瑞拉" }, { value: "416", text: "安地卡及巴布達" }, { value: "417", text: "多米尼克" },
  { value: "419", text: "法屬圭亞那" }, { value: "420", text: "聖馬丁(荷屬)" }, { value: "470", text: "古拉索" }, { value: "471", text: "阿魯巴" },
  { value: "472", text: "荷屬安地列斯" }, { value: "473", text: "開曼群島" }, { value: "474", text: "福克蘭群島" }, { value: "475", text: "法屬瓜德魯普島" },
  { value: "476", text: "英屬蒙瑟拉特島" }, { value: "477", text: "法屬馬丁尼克" }, { value: "478", text: "南喬治亞與南桑威奇群島" }, { value: "479", text: "法屬聖皮埃爾和密克隆群島" },
  { value: "480", text: "英屬土克斯及開科斯群島" }, { value: "481", text: "美屬維爾京群島" }, { value: "501", text: "阿爾及利亞" }, { value: "502", text: "波札那" },
  { value: "503", text: "蒲隆地" }, { value: "504", text: "中非共和國" }, { value: "505", text: "喀麥隆" }, { value: "506", text: "查德" },
  { value: "507", text: "剛果共和國" }, { value: "509", text: "貝南共和國" }, { value: "510", text: "赤道幾內亞" }, { value: "511", text: "衣索比亞" },
  { value: "512", text: "加彭" }, { value: "513", text: "甘比亞" }, { value: "514", text: "迦納" }, { value: "515", text: "幾內亞" },
  { value: "516", text: "象牙海岸" }, { value: "517", text: "肯亞" }, { value: "518", text: "賴索托" }, { value: "519", text: "賴比瑞亞" },
  { value: "520", text: "利比亞" }, { value: "521", text: "馬達加斯加" }, { value: "522", text: "馬拉威" }, { value: "523", text: "馬利" },
  { value: "524", text: "茅利塔尼亞" }, { value: "525", text: "模里西斯" }, { value: "526", text: "摩洛哥" }, { value: "527", text: "尼日" },
  { value: "528", text: "奈及利亞" }, { value: "529", text: "辛巴威" }, { value: "530", text: "盧安達" }, { value: "531", text: "塞內加爾" },
  { value: "532", text: "獅子山" }, { value: "533", text: "索馬利亞" }, { value: "534", text: "南非" }, { value: "535", text: "蘇丹" },
  { value: "536", text: "史瓦帝尼" }, { value: "537", text: "坦尚尼亞" }, { value: "538", text: "多哥" }, { value: "539", text: "突尼西亞" },
  { value: "540", text: "烏干達" }, { value: "541", text: "埃及" }, { value: "542", text: "布吉納法索" }, { value: "543", text: "尚比亞" },
  { value: "545", text: "巴林" }, { value: "546", text: "厄利垂亞" }, { value: "547", text: "莫三比克" }, { value: "548", text: "安哥拉" },
  { value: "551", text: "維德角共和國" }, { value: "552", text: "吉布地" }, { value: "553", text: "葛摩聯邦" }, { value: "555", text: "西撒哈拉" },
  { value: "557", text: "幾內亞比索共和國" }, { value: "558", text: "聖多美普林西比" }, { value: "560", text: "納米比亞" }, { value: "562", text: "剛果民主共和國" },
  { value: "563", text: "南蘇丹" }, { value: "564", text: "英屬印度洋地區" }, { value: "565", text: "美亞特" }, { value: "566", text: "英屬聖赫勒拿島" },
  { value: "567", text: "索馬利蘭" }, { value: "601", text: "聖文森及格瑞那丁" }, { value: "602", text: "聖露西亞" }, { value: "603", text: "聖克里斯多福及尼維斯" },
  { value: "604", text: "貝里斯" }, { value: "881", text: "法屬南部屬地" }, { value: "882", text: "波維特島" }, { value: "883", text: "赫德及麥當勞群島" },
  { value: "994", text: "無國籍-依1954年無國籍人士公約" }, { value: "995", text: "難民-依1954年難民公約所定義" }, { value: "996", text: "難民-非依1954年難民公約所定義" },
  { value: "997", text: "無國籍-不屬於代碼994、995及996者" }, { value: "999", text: "無國籍" },
];

const KINSHIP_STATUS = [
  { value: "1", text: "Living", label_zh: "存" },
  { value: "2", text: "Deceased", label_zh: "歿" },
  { value: "3", text: "Divorced", label_zh: "離婚" },
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
  return [
    { field_name: `kin_${group}_status`, label: `${labelZh} — Living/deceased/divorced`, field_type: "select", required: requiredGroup, step_number: stepNumber, step_name: stepName, display_order: startOrder, options: KINSHIP_STATUS, validation_rules: { block_group: `kin_${group}` } },
    { field_name: `kin_${group}_name`, label: `${labelZh} — Name`, field_type: "text", required: false, step_number: stepNumber, step_name: stepName, display_order: startOrder + 1, validation_rules: { block_group: `kin_${group}` } },
    { field_name: `kin_${group}_date_of_birth`, label: `${labelZh} — Date of birth`, field_type: "date", required: false, step_number: stepNumber, step_name: stepName, display_order: startOrder + 2, validation_rules: { block_group: `kin_${group}` } },
    { field_name: `kin_${group}_phone`, label: `${labelZh} — Phone`, field_type: "text", required: false, step_number: stepNumber, step_name: stepName, display_order: startOrder + 3, validation_rules: { block_group: `kin_${group}` } },
    { field_name: `kin_${group}_occupation`, label: `${labelZh} — Occupation`, field_type: "select", required: false, step_number: stepNumber, step_name: stepName, display_order: startOrder + 4, options: OCCUPATIONS, validation_rules: { block_group: `kin_${group}` } },
    { field_name: `kin_${group}_service_unit`, label: `${labelZh} — Employer / unit`, field_type: "text", required: false, step_number: stepNumber, step_name: stepName, display_order: startOrder + 5, placeholder: "Required detail if occupation is Freelance/Other/None/Retired", validation_rules: { block_group: `kin_${group}` } },
    { field_name: `kin_${group}_job_title`, label: `${labelZh} — Job title`, field_type: "text", required: false, step_number: stepNumber, step_name: stepName, display_order: startOrder + 6, validation_rules: { block_group: `kin_${group}` } },
    { field_name: `kin_${group}_current_address_same_as_overseas`, label: `${labelZh} — Current address same as applicant's overseas address`, field_type: "checkbox", required: false, step_number: stepNumber, step_name: stepName, display_order: startOrder + 7, validation_rules: { block_group: `kin_${group}`, note: "Mirrors the portal's '同申請人海外地址' quick-fill button; src/tw/normalize.ts copies overseas_address into kin_*_current_address when true." } },
    { field_name: `kin_${group}_current_address`, label: `${labelZh} — Current address`, field_type: "textarea", required: false, step_number: stepNumber, step_name: stepName, display_order: startOrder + 8, conditional_logic: { showIf: `kin_${group}_current_address_same_as_overseas === false` }, validation_rules: { block_group: `kin_${group}` } },
  ];
}

const FIELDS: FieldDef[] = [
  // ═══════════════════════════════════════════════════════════════════════
  // STEP 0: Delivery Location (遞送地點) — first tab on the official portal
  // ═══════════════════════════════════════════════════════════════════════
  { field_name: "continent", label: "Continent", field_type: "select", required: true, step_number: 0, step_name: "Delivery Location", display_order: 1, options: CONTINENTS },
  { field_name: "embassy_office", label: "Receiving embassy/office", field_type: "select", required: true, step_number: 0, step_name: "Delivery Location", display_order: 2, options: EMBASSY_OFFICES },

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 1: Photo & Basic Status
  // ═══════════════════════════════════════════════════════════════════════
  { field_name: "photo_upload", label: "Photo upload (2-inch color, white background)", field_type: "file", required: true, step_number: 1, step_name: "Photo & Basic Status", display_order: 1, validation_rules: { accept: "image/jpeg", maxSizeKB: 512 } },
  { field_name: "first_time_applying", label: "First time applying to visit Taiwan from abroad/HK/Macau?", field_type: "radio", required: true, step_number: 1, step_name: "Photo & Basic Status", display_order: 2, options: YES_NO },
  { field_name: "permit_type", label: "Permit type applied for", field_type: "radio", required: true, step_number: 1, step_name: "Photo & Basic Status", display_order: 3, options: [
    { value: "1", text: "Single-entry permit", label_zh: "單次證" },
    { value: "2", text: "Multiple-entry permit", label_zh: "多次證" },
    { value: "H", text: "Main applicant already holds a multiple-entry permit", label_zh: "主要申請人已領多次證" },
  ] },
  { field_name: "permit_count", label: "Number of permits requested", field_type: "select", required: true, step_number: 1, step_name: "Photo & Basic Status", display_order: 4, options: [{ value: "1", text: "1 permit", label_zh: "1張" }, { value: "2", text: "2 permits (cruise second-leg only)", label_zh: "2張" }] },
  { field_name: "has_other_nationality_passport", label: "Do you hold a passport of another nationality?", field_type: "radio", required: true, step_number: 1, step_name: "Photo & Basic Status", display_order: 5, options: YES_NO, validation_rules: { note: "Must be answered truthfully; concealment can void the application per the portal's own warning." } },
  { field_name: "eligibility_category", label: "Eligibility category", field_type: "radio", required: true, step_number: 1, step_name: "Photo & Basic Status", display_order: 6, options: ELIGIBILITY_CATEGORIES },

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 1.5: Supporting Documents (應檢附文件) — confirmed live to be a real,
  // required upload block. Each row's exact requirement was read directly
  // off the portal for all four eligibility categories; general upload
  // rules (JPG/JPEG/PNG/BMP/PDF, <1024K, non-CN/EN docs need a translation,
  // rename to match content, scan both sides if double-sided) apply to all
  // of them per the portal's own instructions banner.
  // NOT modeled here (needs a human decision, not a guess): a "未成年且無
  // 法定代理人或監護人陪同來臺者" (minor without accompanying guardian)
  // document appeared for categories 1-2 during live testing but its
  // presence across all 4 categories wasn't fully confirmed.
  // ═══════════════════════════════════════════════════════════════════════
  { field_name: "mainland_travel_document", label: "Mainland-issued travel document (6+ months validity) or Hong Kong/Macau non-permanent-resident travel document", field_type: "file", required: true, step_number: 1, step_name: "Photo & Basic Status", display_order: 7, validation_rules: { accept: "image/jpeg,image/png,image/bmp,application/pdf", maxSizeKB: 1024 } },
  { field_name: "eligibility_supporting_document", label: "Supporting document for your eligibility category (student visa + enrollment certificate / permanent residency proof / work visa + employment certificate / dependent residency + financial proof — content depends on eligibility_category)", field_type: "file", required: true, step_number: 1, step_name: "Photo & Basic Status", display_order: 8, validation_rules: { accept: "image/jpeg,image/png,image/bmp,application/pdf", maxSizeKB: 1024, note: "Which exact document is required depends on eligibility_category; see docs/tw-entry-permit-auto-submit-plan.md for the per-category text." } },
  { field_name: "hk_macau_id_scan", label: "Hong Kong/Macau resident ID (front + back) and valid Hong Kong/Macau visa (not required if under 11)", field_type: "file", required: true, step_number: 1, step_name: "Photo & Basic Status", display_order: 9, conditional_logic: { showIf: "embassy_office in [50,51]" }, validation_rules: { accept: "image/jpeg,image/png,image/bmp,application/pdf", maxSizeKB: 1024 } },
  { field_name: "other_nationality_passport_scan", label: "Scan of your other-nationality passport/document", field_type: "file", required: true, step_number: 1, step_name: "Photo & Basic Status", display_order: 10, conditional_logic: { showIf: "has_other_nationality_passport === yes" }, validation_rules: { accept: "image/jpeg,image/png,image/bmp,application/pdf", maxSizeKB: 1024 } },
  { field_name: "mainland_id_card_scan", label: "Mainland ID card (front + back)", field_type: "file", required: true, step_number: 1, step_name: "Photo & Basic Status", display_order: 11, conditional_logic: { showIf: "mainland_id_number_not_applicable === false" }, validation_rules: { accept: "image/jpeg,image/png,image/bmp,application/pdf", maxSizeKB: 1024 } },
  { field_name: "other_supporting_document", label: "Other supporting document (optional unless applicable — e.g. a 3-month Japanese juminhyo if residing in Japan)", field_type: "file", required: false, step_number: 1, step_name: "Photo & Basic Status", display_order: 12, validation_rules: { accept: "image/jpeg,image/png,image/bmp,application/pdf", maxSizeKB: 1024 } },

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 2: Applicant Identity
  // ═══════════════════════════════════════════════════════════════════════
  { field_name: "name_chinese", label: "Name in Chinese (traditional characters)", field_type: "text", required: true, step_number: 2, step_name: "Applicant Identity", display_order: 1 },
  { field_name: "name_english", label: "Name in English (as shown in passport, uppercase)", field_type: "text", required: true, step_number: 2, step_name: "Applicant Identity", display_order: 2 },
  { field_name: "date_of_birth", label: "Date of birth", field_type: "date", required: true, step_number: 2, step_name: "Applicant Identity", display_order: 3 },
  { field_name: "passport_number", label: "Passport / HK-Macau travel document / mainland travel document number", field_type: "text", required: true, step_number: 2, step_name: "Applicant Identity", display_order: 4 },
  { field_name: "passport_expiry_date", label: "Passport / travel document expiry date", field_type: "date", required: true, step_number: 2, step_name: "Applicant Identity", display_order: 5, validation_rules: { note: "Must have 6+ months validity remaining at entry." } },
  { field_name: "gender", label: "Gender", field_type: "select", required: true, step_number: 2, step_name: "Applicant Identity", display_order: 6, options: [{ value: "0", text: "Male", label_zh: "男" }, { value: "1", text: "Female", label_zh: "女" }] },
  { field_name: "overseas_residency_id_number", label: "Overseas residency ID number (e.g. permanent residency / work permit number)", field_type: "text", required: true, step_number: 2, step_name: "Applicant Identity", display_order: 7 },
  { field_name: "mainland_id_number_not_applicable", label: "No mainland ID number", field_type: "checkbox", required: false, step_number: 2, step_name: "Applicant Identity", display_order: 8 },
  { field_name: "mainland_id_number", label: "Mainland ID number", field_type: "text", required: false, step_number: 2, step_name: "Applicant Identity", display_order: 9, conditional_logic: { showIf: "mainland_id_number_not_applicable === false" } },
  { field_name: "birth_place_is_mainland", label: "Place of birth", field_type: "radio", required: true, step_number: 2, step_name: "Applicant Identity", display_order: 10, options: [{ value: "mainland", text: "Mainland China", label_zh: "中國大陸" }, { value: "other", text: "Other", label_zh: "其他" }] },
  { field_name: "birth_place_other_country", label: "Country/region of birth", field_type: "select", required: true, step_number: 2, step_name: "Applicant Identity", display_order: 11, options: NATIONALITY_OPTIONS, conditional_logic: { showIf: "birth_place_is_mainland === other" } },
  { field_name: "local_mobile_phone", label: "Mobile phone at current residence (include country code)", field_type: "text", required: true, step_number: 2, step_name: "Applicant Identity", display_order: 12, placeholder: "e.g. +65..." },
  { field_name: "current_occupation", label: "Current occupation", field_type: "select", required: true, step_number: 2, step_name: "Applicant Identity", display_order: 13, options: OCCUPATIONS },
  { field_name: "occupation_experience", label: "Experience (required detail if occupation is Freelance/Other/None/Retired)", field_type: "textarea", required: false, step_number: 2, step_name: "Applicant Identity", display_order: 14, conditional_logic: { showIf: "current_occupation in [15,16,17,62]" } },
  { field_name: "company_name", label: "Company / organization / school full name", field_type: "text", required: false, step_number: 2, step_name: "Applicant Identity", display_order: 15 },
  { field_name: "job_title", label: "Job title", field_type: "text", required: false, step_number: 2, step_name: "Applicant Identity", display_order: 16 },
  { field_name: "is_taiwanese_spouse", label: "Are you the spouse of a Taiwanese national?", field_type: "select", required: true, step_number: 2, step_name: "Applicant Identity", display_order: 17, options: YES_NO, validation_rules: { note: "This permit cannot be used to register a marriage in Taiwan. Confirmed live to carry a required asterisk, unlike traveling_with_parents below." } },
  { field_name: "traveling_with_parents", label: "Are your parents traveling with you?", field_type: "select", required: false, step_number: 2, step_name: "Applicant Identity", display_order: 18, options: YES_NO },
  { field_name: "overseas_address", label: "Hong Kong/Macau or overseas residential address", field_type: "textarea", required: true, step_number: 2, step_name: "Applicant Identity", display_order: 19 },

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 3: Taiwan Contact Address (在台聯絡地址 — 8 sub-fields on the portal)
  // ═══════════════════════════════════════════════════════════════════════
  { field_name: "tw_contact_city", label: "City/County", field_type: "select", required: true, step_number: 3, step_name: "Taiwan Contact Address", display_order: 1, options: TW_CITIES },
  { field_name: "tw_contact_district", label: "District/township", field_type: "text", required: false, step_number: 3, step_name: "Taiwan Contact Address", display_order: 2 },
  { field_name: "tw_contact_village", label: "Village (村/里)", field_type: "text", required: false, step_number: 3, step_name: "Taiwan Contact Address", display_order: 3 },
  { field_name: "tw_contact_neighborhood", label: "Neighborhood (鄰, number only)", field_type: "text", required: false, step_number: 3, step_name: "Taiwan Contact Address", display_order: 4 },
  { field_name: "tw_contact_road", label: "Road/street (路/街)", field_type: "text", required: true, step_number: 3, step_name: "Taiwan Contact Address", display_order: 5 },
  { field_name: "tw_contact_lane", label: "Lane (巷, number only)", field_type: "text", required: false, step_number: 3, step_name: "Taiwan Contact Address", display_order: 6 },
  { field_name: "tw_contact_alley", label: "Alley (弄, number only)", field_type: "text", required: false, step_number: 3, step_name: "Taiwan Contact Address", display_order: 7 },
  { field_name: "tw_contact_building_number", label: "Building/floor/unit number (or hotel name if staying at a hotel)", field_type: "text", required: true, step_number: 3, step_name: "Taiwan Contact Address", display_order: 8 },
  { field_name: "tw_local_phone", label: "Taiwan landline number", field_type: "text", required: false, step_number: 3, step_name: "Taiwan Contact Address", display_order: 9 },
  { field_name: "tw_contact_mobile_not_applicable", label: "No Taiwan contact mobile number", field_type: "checkbox", required: false, step_number: 3, step_name: "Taiwan Contact Address", display_order: 10 },
  { field_name: "tw_contact_mobile", label: "Taiwan contact mobile number", field_type: "text", required: true, step_number: 3, step_name: "Taiwan Contact Address", display_order: 11, conditional_logic: { showIf: "tw_contact_mobile_not_applicable === false" }, validation_rules: { note: "Confirmed live to carry a required asterisk when shown (i.e. when tw_contact_mobile_not_applicable is unchecked)." } },

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 4: Other Nationality (conditional block, shown only if Q "has_other_nationality_passport" = yes)
  // ═══════════════════════════════════════════════════════════════════════
  { field_name: "other_nationality_country", label: "Other nationality held", field_type: "select", required: true, step_number: 4, step_name: "Other Nationality", display_order: 1, options: NATIONALITY_OPTIONS, conditional_logic: { showIf: "has_other_nationality_passport === yes" } },
  { field_name: "other_passport_number", label: "Other nationality passport/document number", field_type: "text", required: true, step_number: 4, step_name: "Other Nationality", display_order: 2, conditional_logic: { showIf: "has_other_nationality_passport === yes" } },
  { field_name: "other_passport_expiry_date", label: "Other nationality passport/document expiry date", field_type: "date", required: true, step_number: 4, step_name: "Other Nationality", display_order: 3, conditional_logic: { showIf: "has_other_nationality_passport === yes" } },

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
  { field_name: "past_mainland_political_military_role", label: "Have previously held a mainland party/administrative/military/political-organ role or membership", field_type: "checkbox", required: false, step_number: 6, step_name: "Declaration", display_order: 1 },
  { field_name: "past_role_detail", label: "Previously held role/position at", field_type: "text", required: true, step_number: 6, step_name: "Declaration", display_order: 2, conditional_logic: { showIf: "past_mainland_political_military_role === true" } },
  { field_name: "current_mainland_political_military_role", label: "Currently hold a mainland party/administrative/military/political-organ role or membership", field_type: "checkbox", required: false, step_number: 6, step_name: "Declaration", display_order: 3 },
  { field_name: "current_role_detail", label: "Currently holds role/position at", field_type: "text", required: true, step_number: 6, step_name: "Declaration", display_order: 4, conditional_logic: { showIf: "current_mainland_political_military_role === true" } },
  { field_name: "never_held_mainland_political_military_role", label: "Have never held any mainland party/administrative/military/political-organ role or membership", field_type: "checkbox", required: false, step_number: 6, step_name: "Declaration", display_order: 5 },
  { field_name: "accepted_terms", label: "I have read and accept the terms and conditions", field_type: "checkbox", required: true, step_number: 6, step_name: "Declaration", display_order: 6, validation_rules: { mustBeTrue: true } },
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
