import { createElement } from "react";
import { StepGenericFields, type GenericField } from "../shell/shared-steps/step-generic-fields";
import { StepYesNoChecklist, type ChecklistItem } from "../shell/shared-steps/step-yesno-checklist";
import type { WizardConfig, WizardReviewSection, WizardReviewRow, WizardStep } from "../shell/types";
import { TW_CITY_OPTIONS, TW_DISTRICTS_BY_CITY } from "@/lib/taiwan-administrative-units";

/**
 * Taiwan Online Entry Permit (旅居海外大陸地區人民申請來臺觀光入境許可) wizard.
 *
 * Every field `key` below MUST exactly match a `field_name` in
 * `viza-be/agent-backend/scripts/seed-tw-entry-permit-form-fields.ts` — that
 * seed file is the ground-truth contract shared with the backend's
 * `src/tw/normalize.ts`. Option `value`s are copied verbatim from the same
 * seed (continents, embassy offices, eligibility categories, occupations,
 * the 22 Taiwan cities, the nationality list, kinship status).
 *
 * Scope notes (see docs/tw-entry-permit-auto-submit-plan.md):
 *  - No persistent portal account exists for Taiwan (unlike UK) — the
 *    backend does an inline email-OTP verification itself during
 *    automation. This wizard intentionally does not collect any
 *    account/credential fields.
 *  - `photo_upload` and the 6 supporting-document fields (`mainland_travel_
 *    document`, `eligibility_supporting_document`, `hk_macau_id_scan`,
 *    `other_nationality_passport_scan`, `mainland_id_card_scan`,
 *    `other_supporting_document`) are intentionally NOT collected here as
 *    `GenericField`s — `GenericField` has no "file" kind at all (checked;
 *    no country's wizard config has one). They're handled entirely by the
 *    wizard shell's existing universal Documents step (`DocumentCenterClient`,
 *    unconditionally appended after every country's steps in
 *    wizard-shell.tsx), which reads its required-document list from the
 *    `document_requirements` table. Taiwan's rows for all 7 of these were
 *    added in drizzle/0122_tw_entry_permit_document_requirements.sql — once
 *    that migration has run, the Documents step shows them automatically
 *    with no wizard-config changes needed. The 3 conditional ones (HK/Macau
 *    ID, other-nationality passport, mainland ID card) are stored as
 *    optional there (this table has no conditional-required column) with
 *    the condition spelled out in their description text; actual
 *    conditional-required enforcement happens in
 *    viza-be/submission-service/src/queue/halt-runners.ts at automation
 *    time, not in this wizard or the Documents step UI.
 *  - There is no repeatable-block UI primitive in `shell/shared-steps` yet
 *    (checked against UK/AU/ID/etc. — none of them have one), so the 5
 *    kinship blocks (father/mother/spouse/child1/child2) are produced by
 *    looping a single `kinshipFields()` builder over `KINSHIP_GROUPS` and
 *    mapping that into 5 wizard steps, mirroring the backend seed's own
 *    `kinshipFields()` helper rather than hand-copying 5 field blocks.
 *
 * Language: every user-facing string here is Simplified Chinese, hardcoded
 * via the shared-steps `literal:` prefix (see `tr()` in
 * step-generic-fields.tsx / step-yesno-checklist.tsx), which bypasses the
 * `messages/en.json` / `messages/zh.json` i18n lookup entirely. Taiwan's
 * applicants are mainland Chinese nationals residing abroad — there is no
 * need for an English variant of this form, so unlike UK/VN/ID (which use
 * real i18n keys with both an English and a Chinese translation), Taiwan
 * intentionally shows the same Simplified Chinese text regardless of the
 * site's active locale.
 */

export type TwForm = Record<string, string>;

const NAMESPACE = "simplifiedForm.tw";

function lit(s: string): string {
  return `literal:${s}`;
}

interface SeedOption {
  value: string;
  text: string;
}

function opts(list: SeedOption[]): Array<{ value: string; labelKey: string }> {
  return list.map((o) => ({ value: o.value, labelKey: lit(o.text) }));
}

function seedOptionsFromVisaOptions(list: typeof TW_CITY_OPTIONS): SeedOption[] {
  return list.flatMap((option) => {
    if (typeof option === "string") return [{ value: option, text: option }];
    const text = option.label_zh ?? option.text ?? option.official_label ?? option.value;
    return [{ value: option.value, text }];
  });
}

// ─── Option lists — Simplified Chinese, matching label_zh in
// seed-tw-entry-permit-form-fields.ts ──────────────────────────────────────

const CONTINENTS: SeedOption[] = [
  { value: "A", text: "亚洲" },
  { value: "B", text: "美洲" },
  { value: "C", text: "欧洲" },
  { value: "D", text: "非洲" },
  { value: "E", text: "大洋洲" },
];

const EMBASSY_OFFICES: SeedOption[] = [
  { value: "50", text: "台北经济文化办事处／香港办事处" },
  { value: "51", text: "台北经济文化办事处／澳门办事处" },
  { value: "5A", text: "台北驻日经济文化代表处(东京)" },
  { value: "5C", text: "台北驻大阪经济文化办事处" },
  { value: "5F", text: "驻韩国台北代表处" },
  { value: "55", text: "驻马来西亚台北经济文化办事处" },
  { value: "56", text: "驻菲律宾台北经济文化办事处" },
  { value: "53", text: "驻新加坡台北代表处" },
  { value: "52", text: "驻泰国台北经济文化办事处" },
  { value: "67", text: "驻越南代表处(河内)" },
  { value: "57", text: "驻胡志明市台北经济文化办事处" },
  { value: "58", text: "驻缅甸代表处" },
  { value: "66", text: "驻印度代表处" },
  { value: "54", text: "驻印尼台北经济贸易代表处" },
  { value: "6A", text: "驻温哥华台北经济文化办事处" },
  { value: "6B", text: "驻多伦多台北经济文化办事处" },
  { value: "60", text: "驻纽约台北经济文化办事处" },
  { value: "61", text: "驻洛杉矶台北经济文化办事处" },
  { value: "62", text: "驻旧金山台北经济文化办事处" },
  { value: "64", text: "驻美国台北经济文化代表处(华盛顿特区)" },
  { value: "65", text: "驻迈阿密台北经济文化办事处" },
  { value: "70", text: "驻巴拉圭共和国大使馆" },
  { value: "GP", text: "驻欧盟兼驻比利时代表处" },
  { value: "72", text: "驻法国台北代表处" },
  { value: "63", text: "驻英国台北代表处" },
  { value: "71", text: "驻南非共和国台北联络代表处" },
  { value: "73", text: "驻雪梨台北经济文化办事处" },
  { value: "74", text: "驻奥克兰台北经济文化办事处" },
];

const EMBASSY_OFFICE_VALUES_BY_CONTINENT: Record<string, string[]> = {
  A: ["50", "51", "5A", "5C", "5F", "55", "56", "53", "52", "67", "57", "58", "66", "54"],
  B: ["6A", "6B", "60", "61", "62", "64", "65", "70"],
  C: ["GP", "72", "63"],
  D: ["71"],
  E: ["73", "74"],
};

function embassyOfficesForContinent(continent?: string): SeedOption[] {
  const allowedValues = EMBASSY_OFFICE_VALUES_BY_CONTINENT[continent ?? ""];
  if (!allowedValues) return [];
  const allowed = new Set(allowedValues);
  return EMBASSY_OFFICES.filter((office) => allowed.has(office.value));
}

const ELIGIBILITY_CATEGORIES: SeedOption[] = [
  { value: "1", text: "赴国外或香港、澳门留学生" },
  { value: "2", text: "旅居国外或香港、澳门取得当地永久居留权" },
  { value: "3", text: "旅居国外或香港、澳门1年以上且领有工作证明" },
  { value: "4", text: "旅居国外或香港、澳门取得当地依亲居留权且有财力证明" },
];

const OCCUPATIONS: SeedOption[] = [
  { value: "1", text: "军人" }, { value: "2", text: "公务员" },
  { value: "3", text: "公教职员" }, { value: "4", text: "私校教职" },
  { value: "5", text: "商" }, { value: "6", text: "农" },
  { value: "7", text: "工" }, { value: "8", text: "医事人员" },
  { value: "9", text: "宗教人士" }, { value: "10", text: "演艺人员" },
  { value: "11", text: "新闻事业" }, { value: "12", text: "渔船船员" },
  { value: "13", text: "轮船船员" }, { value: "14", text: "学生" },
  { value: "15", text: "自由业" }, { value: "16", text: "其他业" },
  { value: "17", text: "无" }, { value: "18", text: "警" },
  { value: "19", text: "船员" }, { value: "20", text: "家庭主妇" },
  { value: "21", text: "技工" }, { value: "22", text: "艺术家" },
  { value: "23", text: "护士" }, { value: "24", text: "飞行员" },
  { value: "25", text: "专家" }, { value: "27", text: "推销员" },
  { value: "28", text: "科学家" }, { value: "29", text: "秘书" },
  { value: "30", text: "技师" }, { value: "31", text: "作家" },
  { value: "32", text: "顾问" }, { value: "33", text: "教授" },
  { value: "34", text: "会计员" }, { value: "35", text: "银行员" },
  { value: "36", text: "潜水夫" }, { value: "37", text: "律师" },
  { value: "38", text: "外交人员" }, { value: "39", text: "音乐家" },
  { value: "40", text: "信息人员" }, { value: "41", text: "研究人员" },
  { value: "42", text: "工程师" }, { value: "47", text: "白领船员" },
  { value: "48", text: "蓝领船员" }, { value: "49", text: "看护工" },
  { value: "50", text: "养护机构看护工" }, { value: "51", text: "未注明" },
  { value: "52", text: "职员" }, { value: "53", text: "教师" },
  { value: "54", text: "医生" }, { value: "55", text: "传教士" },
  { value: "56", text: "记者" }, { value: "58", text: "运动人员" },
  { value: "61", text: "待业" }, { value: "62", text: "退休" },
];

const TW_CITIES: SeedOption[] = seedOptionsFromVisaOptions(TW_CITY_OPTIONS);
const TW_DISTRICTS: Record<string, SeedOption[]> = Object.fromEntries(
  Object.entries(TW_DISTRICTS_BY_CITY).map(([cityValue, districts]) => [
    cityValue,
    seedOptionsFromVisaOptions(districts),
  ]),
);

// Full nationality list (所具其他國籍為) — value = the portal's numeric code
// (unchanged); text is Simplified Chinese (matching the seed) for display
// on our site (the official portal itself is Chinese-only, Traditional).
const NATIONALITY_OPTIONS: SeedOption[] = [
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
  { value: "994", text: "无国籍-依1954年无国籍人士公约" }, { value: "995", text: "难民-依1954年难民公约所定义" }, { value: "996", text: "难民-非依1954年难民公约所定义" },
  { value: "997", text: "无国籍-不属于代码994、995及996者" }, { value: "999", text: "无国籍" },
];

const KINSHIP_STATUS: SeedOption[] = [
  { value: "1", text: "存" },
  { value: "2", text: "殁" },
  { value: "3", text: "离婚" },
];

// ─── Step 0: Delivery Location ─────────────────────────────────────────────

function deliveryFields(form: TwForm): GenericField[] {
  return [
    { kind: "select", key: "continent", labelKey: lit("所在洲别"), options: opts(CONTINENTS) },
    {
      kind: "select",
      key: "embassy_office",
      labelKey: lit("受理使领馆/代表处"),
      placeholderKey: form.continent ? lit("请选择该洲的驻外馆处据点") : lit("请先选择洲别"),
      options: opts(embassyOfficesForContinent(form.continent)),
    },
  ];
}

// ─── Step 1: Basic Status (photo upload handled by the universal Documents step) ──

function shouldShowHouseholdRevoked(form: TwForm): boolean {
  return form.eligibility_category === "2" && ["50", "51"].includes(form.embassy_office ?? "");
}

const BASIC_STATUS_FIELDS: GenericField[] = [
  { kind: "yesno", key: "first_time_applying", labelKey: lit("是否为首次由境外/港澳申请来台观光") },
  {
    kind: "select",
    key: "permit_type",
    labelKey: lit("申请证别"),
    options: [
      { value: "1", labelKey: lit("单次证") },
      { value: "2", labelKey: lit("多次证") },
      { value: "H", labelKey: lit("主要申请人已领多次证") },
    ],
  },
  {
    kind: "select",
    key: "permit_count",
    labelKey: lit("申请证数"),
    options: [
      { value: "1", labelKey: lit("1张") },
      { value: "2", labelKey: lit("2张(仅限邮轮二次入境适用)") },
    ],
  },
  { kind: "yesno", key: "has_other_nationality_passport", labelKey: lit("是否持有其他国籍护照?") },
  {
    kind: "select",
    key: "household_revoked",
    labelKey: lit("目前户口登记状态"),
    options: [
      { value: "no", labelKey: lit("未注销户口登记，或已注销户口登记但尚未取得香港、澳门护照") },
      { value: "yes", labelKey: lit("已注销户口登记") },
    ],
  },
  { kind: "select", key: "eligibility_category", labelKey: lit("申请资格类别"), options: opts(ELIGIBILITY_CATEGORIES) },
];

function basicStatusFields(form: TwForm): GenericField[] {
  return shouldShowHouseholdRevoked(form)
    ? BASIC_STATUS_FIELDS
    : BASIC_STATUS_FIELDS.filter((field) => field.key !== "household_revoked");
}

// ─── Step 2: Applicant Identity (some fields are conditional on prior answers) ──

function identityFields(form: TwForm): GenericField[] {
  const fields: GenericField[] = [
    { kind: "text", key: "name_chinese", labelKey: lit("中文姓名(繁体字)"), required: true },
    { kind: "text", key: "name_english", labelKey: lit("英文姓名(依护照大写拼写)"), required: true },
    { kind: "date", key: "date_of_birth", labelKey: lit("出生日期") },
    { kind: "text", key: "passport_number", labelKey: lit("护照号码/香港签证身份证明书号码/澳门旅行证/大陆旅行证号码"), required: true },
    { kind: "date", key: "passport_expiry_date", labelKey: lit("护照效期/旅行证效期（西元）") },
    {
      kind: "select",
      key: "gender",
      labelKey: lit("性别"),
      options: [
        { value: "0", labelKey: lit("男") },
        { value: "1", labelKey: lit("女") },
      ],
    },
    { kind: "text", key: "overseas_residency_id_number", labelKey: lit("侨居身份证号码（如永久居留证号码、居留证号码或签证号码）"), required: true },
    { kind: "yesno", key: "mainland_id_number_not_applicable", labelKey: lit("无大陆身份证号码") },
  ];

  if (form.mainland_id_number_not_applicable !== "yes") {
    fields.push({ kind: "text", key: "mainland_id_number", labelKey: lit("大陆身份证号码"), required: true });
  }

  fields.push({
    kind: "select",
    key: "birth_place_is_mainland",
    labelKey: lit("出生地（同所持旅游证件）"),
    options: [
      { value: "mainland", labelKey: lit("中国大陆") },
      { value: "other", labelKey: lit("其他") },
    ],
  });

  if (form.birth_place_is_mainland === "other") {
    fields.push({ kind: "select", key: "birth_place_other_country", labelKey: lit("出生国家/地区"), options: opts(NATIONALITY_OPTIONS) });
  }

  fields.push(
    { kind: "text", key: "local_mobile_phone", labelKey: lit("居住地手机号码（需填写国码）") },
    { kind: "select", key: "current_occupation", labelKey: lit("现职"), options: opts(OCCUPATIONS) },
  );

  // Matches the seed's `showIf: current_occupation === 62` (Retired).
  if (form.current_occupation === "62") {
    fields.push({ kind: "textarea", key: "occupation_experience", labelKey: lit("经历") });
  }

  fields.push(
    { kind: "text", key: "company_name", labelKey: lit("公司名称及单位全衔或学校名称"), required: true },
    { kind: "text", key: "job_title", labelKey: lit("职称"), required: true },
    { kind: "yesno", key: "is_taiwanese_spouse", labelKey: lit("是否为台湾人民配偶?") },
    { kind: "yesno", key: "traveling_with_parents", labelKey: lit("父母是否同行?") },
    { kind: "textarea", key: "overseas_address", labelKey: lit("港、澳或海外地址") },
  );

  return fields;
}

// ─── Step 3: Taiwan Contact Address (8 sub-fields on the portal) ──────────

function contactFields(form: TwForm): GenericField[] {
  const districtOptions = TW_DISTRICTS[form.tw_contact_city] ?? [];
  const noTaiwanMobile = form.tw_contact_mobile_not_applicable === "yes" || form.tw_contact_mobile_not_applicable === "true";
  const fields: GenericField[] = [
    { kind: "select", key: "tw_contact_city", labelKey: lit("县市"), options: opts(TW_CITIES) },
    { kind: "select", key: "tw_contact_district", labelKey: lit("乡镇市区"), options: opts(districtOptions) },
    { kind: "text", key: "tw_contact_village", labelKey: lit("村/里（非必填）") },
    { kind: "text", key: "tw_contact_neighborhood", labelKey: lit("邻(仅填数字)") },
    { kind: "text", key: "tw_contact_road", labelKey: lit("街、路段"), required: true },
    { kind: "text", key: "tw_contact_lane", labelKey: lit("巷(仅填数字)") },
    { kind: "text", key: "tw_contact_alley", labelKey: lit("弄(仅填数字)") },
    { kind: "text", key: "tw_contact_building_number", labelKey: lit("门牌号/楼/室（住饭店请填饭店名称）"), required: true },
    { kind: "text", key: "tw_local_phone", labelKey: lit("在台联络电话"), required: noTaiwanMobile },
    { kind: "yesno", key: "tw_contact_mobile_not_applicable", labelKey: lit("无在台联络手机号码") },
  ];

  if (!noTaiwanMobile) {
    fields.push({ kind: "text", key: "tw_contact_mobile", labelKey: lit("在台联络手机号码"), required: true });
  }

  return fields;
}

// ─── Step 4: Other Nationality (only shown if has_other_nationality_passport === yes) ──

const OTHER_NATIONALITY_FIELDS: GenericField[] = [
  { kind: "select", key: "other_nationality_country", labelKey: lit("所具其他国籍为"), options: opts(NATIONALITY_OPTIONS) },
  { kind: "text", key: "other_passport_number", labelKey: lit("他国护（证）照号码"), required: true },
  { kind: "date", key: "other_passport_expiry_date", labelKey: lit("他国护（证）照有效期限") },
];

// ─── Step 5: Kinship Information — 5 repeated blocks (父/母/配偶/子女×2) ────
//
// No repeatable-block shared-step component exists yet in shell/shared-steps
// (checked UK/AU/ID/US/AE/CA/TR/IN/JP/schengen — none have one), so this
// mirrors the backend seed's own `kinshipFields()` helper: one builder
// function looped over the 5 named groups, producing 5 wizard steps instead
// of hand-copying the same 9-field block five times.

type KinshipGroup = "father" | "mother" | "spouse" | "child1" | "child2";

const KINSHIP_GROUPS: Array<{ group: KinshipGroup; label: string }> = [
  { group: "father", label: "父亲" },
  { group: "mother", label: "母亲" },
  { group: "spouse", label: "配偶" },
  { group: "child1", label: "子女一" },
  { group: "child2", label: "子女二" },
];

function kinshipFields(group: KinshipGroup, label: string, form: TwForm): GenericField[] {
  const sameAsOverseasKey = `kin_${group}_current_address_same_as_overseas`;

  const fields: GenericField[] = [
    { kind: "select", key: `kin_${group}_status`, labelKey: lit(`${label} — 生存/已故/离婚状态`), options: opts(KINSHIP_STATUS) },
    { kind: "text", key: `kin_${group}_name`, labelKey: lit(`${label} — 姓名`) },
    { kind: "date", key: `kin_${group}_date_of_birth`, labelKey: lit(`${label} — 出生日期`) },
    { kind: "phone", key: `kin_${group}_phone`, labelKey: lit(`${label} — 电话`) },
    { kind: "select", key: `kin_${group}_occupation`, labelKey: lit(`${label} — 职业`), options: opts(OCCUPATIONS) },
    { kind: "text", key: `kin_${group}_service_unit`, labelKey: lit(`${label} — 服务单位`) },
    { kind: "text", key: `kin_${group}_job_title`, labelKey: lit(`${label} — 职称`) },
    { kind: "yesno", key: sameAsOverseasKey, labelKey: lit(`${label} — 现住址是否与申请人海外地址相同`) },
  ];

  if (form[sameAsOverseasKey] !== "yes") {
    fields.push({ kind: "textarea", key: `kin_${group}_current_address`, labelKey: lit(`${label} — 现住址`) });
  }

  return fields;
}

// ─── Step 6: Declaration ───────────────────────────────────────────────────

const DECLARATION_ITEMS: ChecklistItem[] = [
  {
    key: "past_mainland_political_military_role",
    labelKey: lit("申请人曾任大陆地区党务、行政、军事或具政治性机关（构）、团体之职务或为其成员者"),
    explainOnYes: true,
    explainKey: "past_role_detail",
  },
  {
    key: "current_mainland_political_military_role",
    labelKey: lit("申请人现任大陆地区党务、行政、军事或具政治性机关（构）、团体之职务或为其成员者"),
    explainOnYes: true,
    explainKey: "current_role_detail",
  },
  {
    key: "never_held_mainland_political_military_role",
    labelKey: lit("申请人未曾担任大陆地区党务、行政、军事或具政治性机关（构）、团体之职务或为其成员"),
  },
  {
    key: "accepted_terms",
    labelKey: lit("我已阅读并接受下列条款与条件"),
  },
];

// ─── Shared step/review plumbing ───────────────────────────────────────────

function genericStep(key: string, title: string, fieldsFn: (form: TwForm) => GenericField[]): WizardStep<TwForm> {
  return {
    key,
    titleKey: lit(title),
    render: ({ form, setForm, onContinue }) =>
      createElement(StepGenericFields, {
        i18nNamespace: NAMESPACE,
        titleKey: lit(title),
        fields: fieldsFn(form),
        values: form,
        onChange: (next) => setForm(() => next),
        onContinue,
      }),
  };
}

function rowsFromFields(fields: GenericField[], form: TwForm): WizardReviewRow[] {
  return fields.map((f) => ({ labelKey: f.labelKey, value: form[f.key] ?? "" }));
}

function buildPayload(form: TwForm): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(form)) {
    if (typeof v === "string" && v.trim() !== "") out[k] = v.trim();
  }
  return out;
}

function reviewSections(form: TwForm): WizardReviewSection[] {
  const sections: WizardReviewSection[] = [
    { titleKey: lit("递送地点"), editStepKey: "delivery_location", rows: rowsFromFields(deliveryFields(form), form) },
    { titleKey: lit("基本资料"), editStepKey: "basic_status", rows: rowsFromFields(basicStatusFields(form), form) },
    { titleKey: lit("申请人身份信息"), editStepKey: "identity", rows: rowsFromFields(identityFields(form), form) },
    { titleKey: lit("在台联络地址"), editStepKey: "tw_contact", rows: rowsFromFields(contactFields(form), form) },
  ];

  if (form.has_other_nationality_passport === "yes") {
    sections.push({
      titleKey: lit("其他国籍信息"),
      editStepKey: "other_nationality",
      rows: rowsFromFields(OTHER_NATIONALITY_FIELDS, form),
    });
  }

  for (const { group, label } of KINSHIP_GROUPS) {
    sections.push({
      titleKey: lit(`亲属状况 — ${label}`),
      editStepKey: `kinship_${group}`,
      rows: rowsFromFields(kinshipFields(group, label, form), form),
    });
  }

  const declarationRows: WizardReviewRow[] = DECLARATION_ITEMS.map((item) => ({
    labelKey: item.labelKey,
    value: form[item.key] ?? "",
  }));
  declarationRows.push(
    { labelKey: lit("曾任职于"), value: form.past_role_detail ?? "" },
    { labelKey: lit("现任职于"), value: form.current_role_detail ?? "" },
  );
  sections.push({ titleKey: lit("声明事项"), editStepKey: "declaration", rows: declarationRows });

  return sections;
}

function normalizeDeliveryLocationChange(prev: TwForm, next: TwForm): TwForm {
  const continentChanged = next.continent !== prev.continent;
  const allowedOfficeValues = new Set(embassyOfficesForContinent(next.continent).map((office) => office.value));
  return {
    ...next,
    embassy_office: continentChanged || !allowedOfficeValues.has(next.embassy_office ?? "")
      ? ""
      : next.embassy_office,
  };
}

export const twDeliveryLocationTestHooks = {
  deliveryFields,
  normalizeDeliveryLocationChange,
};

// ─── Wizard config ──────────────────────────────────────────────────────────

export const twConfig: WizardConfig<TwForm> = {
  visaType: "TW_ENTRY_PERMIT",
  defaultCountry: "taiwan",
  defaultVisaType: "TW_ENTRY_PERMIT",
  emptyForm: () => ({}),
  buildAnswerPayload: buildPayload,
  i18nNamespace: NAMESPACE,
  reviewSections,
  steps: [
    {
      key: "delivery_location",
      titleKey: lit("递送地点"),
      render: ({ form, setForm, onContinue }) =>
        createElement(StepGenericFields, {
          i18nNamespace: NAMESPACE,
          titleKey: lit("递送地点"),
          fields: deliveryFields(form),
          values: form,
          onChange: (next) =>
            setForm((prev) => normalizeDeliveryLocationChange(prev, next)),
          onContinue,
        }),
    },
    genericStep("basic_status", "照片与基本资料", basicStatusFields),
    genericStep("identity", "申请人身份信息", identityFields),
    genericStep("tw_contact", "在台联络地址", contactFields),
    {
      key: "other_nationality",
      titleKey: lit("其他国籍信息"),
      showIf: (form) => form.has_other_nationality_passport === "yes",
      render: ({ form, setForm, onContinue }) =>
        createElement(StepGenericFields, {
          i18nNamespace: NAMESPACE,
          titleKey: lit("其他国籍信息"),
          fields: OTHER_NATIONALITY_FIELDS,
          values: form,
          onChange: (next) => setForm(() => next),
          onContinue,
        }),
    },
    ...KINSHIP_GROUPS.map(({ group, label }) =>
      genericStep(`kinship_${group}`, `亲属状况 — ${label}`, (form) => kinshipFields(group, label, form)),
    ),
    {
      key: "declaration",
      titleKey: lit("声明事项"),
      render: ({ form, setForm, onContinue }) =>
        createElement(StepYesNoChecklist, {
          i18nNamespace: NAMESPACE,
          titleKey: lit("声明事项"),
          items: DECLARATION_ITEMS,
          values: form,
          onChange: (next) => setForm(() => next),
          onContinue,
        }),
    },
  ],
};
