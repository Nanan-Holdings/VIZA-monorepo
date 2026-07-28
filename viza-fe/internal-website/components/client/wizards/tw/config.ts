import { createElement } from "react";
import { StepGenericFields, type GenericField } from "../shell/shared-steps/step-generic-fields";
import { StepYesNoChecklist, type ChecklistItem } from "../shell/shared-steps/step-yesno-checklist";
import type { WizardConfig, WizardReviewSection, WizardReviewRow, WizardStep } from "../shell/types";

/**
 * Taiwan Online Entry Permit (旅居海外大陸地區人民申請來臺觀光入境許可) wizard.
 *
 * Every field `key` below MUST exactly match a `field_name` in
 * `viza-be/agent-backend/scripts/seed-tw-entry-permit-form-fields.ts` — that
 * seed file is the ground-truth contract shared with the backend's
 * `src/tw/normalize.ts`. Option `value`s/`text` are copied verbatim from the
 * same seed (continents, embassy offices, eligibility categories,
 * occupations, the 22 Taiwan cities, the nationality list, kinship status).
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
 *    added in drizzle/0105_tw_entry_permit_document_requirements.sql — once
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
 * Field/option label strings all use the shared-steps `literal:` prefix
 * (see `tr()` in step-generic-fields.tsx / step-yesno-checklist.tsx) instead
 * of new i18n keys, and are copied verbatim from the seed's own `label`/
 * `text` values — nothing is invented, and nothing is auto-translated.
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

// ─── Option lists — copied verbatim from seed-tw-entry-permit-form-fields.ts ──

const CONTINENTS: SeedOption[] = [
  { value: "A", text: "Asia" },
  { value: "B", text: "Americas" },
  { value: "C", text: "Europe" },
  { value: "D", text: "Africa" },
  { value: "E", text: "Oceania" },
];

const EMBASSY_OFFICES: SeedOption[] = [
  { value: "50", text: "Taipei Economic and Cultural Office / Hong Kong Office" },
  { value: "51", text: "Taipei Economic and Cultural Office / Macau Office" },
  { value: "5A", text: "Taipei Economic and Cultural Representative Office (Tokyo)" },
  { value: "5C", text: "Taipei Economic and Cultural Office in Osaka" },
  { value: "5F", text: "Taipei Mission in Korea" },
  { value: "55", text: "Taipei Economic and Cultural Office in Malaysia" },
  { value: "56", text: "Taipei Economic and Cultural Office in the Philippines" },
  { value: "53", text: "Taipei Representative Office in Singapore" },
  { value: "52", text: "Taipei Economic and Cultural Office in Thailand" },
  { value: "67", text: "Taipei Economic and Cultural Office (Hanoi)" },
  { value: "57", text: "Taipei Economic and Cultural Office in Ho Chi Minh City" },
  { value: "58", text: "Taipei Economic and Cultural Office in Myanmar" },
  { value: "66", text: "Taipei Economic and Cultural Center in India" },
  { value: "54", text: "Taipei Economic and Trade Office in Indonesia" },
];

const ELIGIBILITY_CATEGORIES: SeedOption[] = [
  { value: "1", text: "Studying abroad or in Hong Kong/Macau" },
  { value: "2", text: "Obtained permanent residency abroad or in Hong Kong/Macau" },
  { value: "3", text: "Resided abroad or in Hong Kong/Macau 1+ year with valid work proof" },
  { value: "4", text: "Obtained dependent residency abroad or in Hong Kong/Macau with financial proof" },
];

const OCCUPATIONS: SeedOption[] = [
  { value: "1", text: "Military" }, { value: "2", text: "Civil servant" },
  { value: "3", text: "Public/school staff" }, { value: "4", text: "Private school faculty" },
  { value: "5", text: "Business" }, { value: "6", text: "Agriculture" },
  { value: "7", text: "Industry" }, { value: "8", text: "Medical personnel" },
  { value: "9", text: "Religious worker" }, { value: "10", text: "Entertainer" },
  { value: "11", text: "Journalism" }, { value: "12", text: "Fishing vessel crew" },
  { value: "13", text: "Ship crew" }, { value: "14", text: "Student" },
  { value: "15", text: "Freelance" }, { value: "16", text: "Other occupation" },
  { value: "17", text: "None" }, { value: "18", text: "Police" },
  { value: "19", text: "Seafarer" }, { value: "20", text: "Homemaker" },
  { value: "21", text: "Technician (trade)" }, { value: "22", text: "Artist" },
  { value: "23", text: "Nurse" }, { value: "24", text: "Pilot" },
  { value: "25", text: "Specialist" }, { value: "27", text: "Salesperson" },
  { value: "28", text: "Scientist" }, { value: "29", text: "Secretary" },
  { value: "30", text: "Technician" }, { value: "31", text: "Writer" },
  { value: "32", text: "Consultant" }, { value: "33", text: "Professor" },
  { value: "34", text: "Accountant" }, { value: "35", text: "Bank employee" },
  { value: "36", text: "Diver" }, { value: "37", text: "Lawyer" },
  { value: "38", text: "Diplomat" }, { value: "39", text: "Musician" },
  { value: "40", text: "IT professional" }, { value: "41", text: "Researcher" },
  { value: "42", text: "Engineer" }, { value: "47", text: "White-collar seafarer" },
  { value: "48", text: "Blue-collar seafarer" }, { value: "49", text: "Caregiver" },
  { value: "50", text: "Institutional caregiver" }, { value: "51", text: "Unspecified" },
  { value: "52", text: "Staff/clerk" }, { value: "53", text: "Teacher" },
  { value: "54", text: "Doctor" }, { value: "55", text: "Missionary" },
  { value: "56", text: "Journalist/reporter" }, { value: "58", text: "Athlete" },
  { value: "61", text: "Unemployed / job-seeking" }, { value: "62", text: "Retired" },
];

// 22 Taiwan cities/counties — the seed only carries the Chinese city name
// (no English form exists on the official portal), so the option text
// below is intentionally Chinese-only, copied verbatim from the seed.
const TW_CITIES: SeedOption[] = [
  "臺北市", "基隆市", "新北市", "宜蘭縣", "新竹市", "新竹縣", "桃園市", "苗栗縣", "臺中市", "彰化縣",
  "南投縣", "嘉義市", "嘉義縣", "雲林縣", "臺南市", "高雄市", "澎湖縣", "屏東縣", "臺東縣", "花蓮縣",
  "金門縣", "連江縣",
].map((c, i) => ({ value: String(i + 1), text: c }));

// Full nationality list (所具其他國籍為) — copied verbatim from the seed
// (Chinese-only on the official portal; value = the portal's numeric code).
const NATIONALITY_OPTIONS: SeedOption[] = [
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

const KINSHIP_STATUS: SeedOption[] = [
  { value: "1", text: "Living" },
  { value: "2", text: "Deceased" },
  { value: "3", text: "Divorced" },
];

// ─── Step 0: Delivery Location ─────────────────────────────────────────────

const DELIVERY_FIELDS: GenericField[] = [
  { kind: "select", key: "continent", labelKey: lit("Continent"), options: opts(CONTINENTS) },
  { kind: "select", key: "embassy_office", labelKey: lit("Receiving embassy/office"), options: opts(EMBASSY_OFFICES) },
];

// ─── Step 1: Basic Status (photo upload handled by the universal Documents step) ──

const BASIC_STATUS_FIELDS: GenericField[] = [
  { kind: "yesno", key: "first_time_applying", labelKey: lit("First time applying to visit Taiwan from abroad/HK/Macau?") },
  {
    kind: "select",
    key: "permit_type",
    labelKey: lit("Permit type applied for"),
    options: [
      { value: "1", labelKey: lit("Single-entry permit") },
      { value: "2", labelKey: lit("Multiple-entry permit") },
      { value: "H", labelKey: lit("Main applicant already holds a multiple-entry permit") },
    ],
  },
  {
    kind: "select",
    key: "permit_count",
    labelKey: lit("Number of permits requested"),
    options: [
      { value: "1", labelKey: lit("1 permit") },
      { value: "2", labelKey: lit("2 permits (cruise second-leg only)") },
    ],
  },
  { kind: "yesno", key: "has_other_nationality_passport", labelKey: lit("Do you hold a passport of another nationality?") },
  { kind: "select", key: "eligibility_category", labelKey: lit("Eligibility category"), options: opts(ELIGIBILITY_CATEGORIES) },
];

// ─── Step 2: Applicant Identity (some fields are conditional on prior answers) ──

function identityFields(form: TwForm): GenericField[] {
  const fields: GenericField[] = [
    { kind: "text", key: "name_chinese", labelKey: lit("Name in Chinese (traditional characters)"), required: true },
    { kind: "text", key: "name_english", labelKey: lit("Name in English (as shown in passport, uppercase)"), required: true },
    { kind: "date", key: "date_of_birth", labelKey: lit("Date of birth") },
    { kind: "text", key: "passport_number", labelKey: lit("Passport / HK-Macau travel document / mainland travel document number"), required: true },
    { kind: "date", key: "passport_expiry_date", labelKey: lit("Passport / travel document expiry date") },
    {
      kind: "select",
      key: "gender",
      labelKey: lit("Gender"),
      options: [
        { value: "0", labelKey: lit("Male") },
        { value: "1", labelKey: lit("Female") },
      ],
    },
    { kind: "text", key: "overseas_residency_id_number", labelKey: lit("Overseas residency ID number (e.g. permanent residency / work permit number)"), required: true },
    { kind: "yesno", key: "mainland_id_number_not_applicable", labelKey: lit("No mainland ID number") },
  ];

  if (form.mainland_id_number_not_applicable !== "yes") {
    fields.push({ kind: "text", key: "mainland_id_number", labelKey: lit("Mainland ID number") });
  }

  fields.push({
    kind: "select",
    key: "birth_place_is_mainland",
    labelKey: lit("Place of birth"),
    options: [
      { value: "mainland", labelKey: lit("Mainland China") },
      { value: "other", labelKey: lit("Other") },
    ],
  });

  if (form.birth_place_is_mainland === "other") {
    fields.push({ kind: "select", key: "birth_place_other_country", labelKey: lit("Country/region of birth"), options: opts(NATIONALITY_OPTIONS) });
  }

  fields.push(
    { kind: "text", key: "local_mobile_phone", labelKey: lit("Mobile phone at current residence (include country code)") },
    { kind: "select", key: "current_occupation", labelKey: lit("Current occupation"), options: opts(OCCUPATIONS) },
  );

  // Matches the seed's `showIf: current_occupation in [15,16,17,62]`
  // (Freelance / Other occupation / None / Retired).
  if (["15", "16", "17", "62"].includes(form.current_occupation ?? "")) {
    fields.push({ kind: "textarea", key: "occupation_experience", labelKey: lit("Experience (required detail if occupation is Freelance/Other/None/Retired)") });
  }

  fields.push(
    { kind: "text", key: "company_name", labelKey: lit("Company / organization / school full name"), required: true },
    { kind: "text", key: "job_title", labelKey: lit("Job title"), required: true },
    { kind: "yesno", key: "is_taiwanese_spouse", labelKey: lit("Are you the spouse of a Taiwanese national?") },
    { kind: "yesno", key: "traveling_with_parents", labelKey: lit("Are your parents traveling with you?") },
    { kind: "textarea", key: "overseas_address", labelKey: lit("Hong Kong/Macau or overseas residential address") },
  );

  return fields;
}

// ─── Step 3: Taiwan Contact Address (8 sub-fields on the portal) ──────────

function contactFields(form: TwForm): GenericField[] {
  const fields: GenericField[] = [
    { kind: "select", key: "tw_contact_city", labelKey: lit("City/County"), options: opts(TW_CITIES) },
    { kind: "text", key: "tw_contact_district", labelKey: lit("District/township") },
    { kind: "text", key: "tw_contact_village", labelKey: lit("Village (村/里)") },
    { kind: "text", key: "tw_contact_neighborhood", labelKey: lit("Neighborhood (鄰, number only)") },
    { kind: "text", key: "tw_contact_road", labelKey: lit("Road/street (路/街)"), required: true },
    { kind: "text", key: "tw_contact_lane", labelKey: lit("Lane (巷, number only)") },
    { kind: "text", key: "tw_contact_alley", labelKey: lit("Alley (弄, number only)") },
    { kind: "text", key: "tw_contact_building_number", labelKey: lit("Building/floor/unit number (or hotel name if staying at a hotel)"), required: true },
    { kind: "text", key: "tw_local_phone", labelKey: lit("Taiwan landline number") },
    { kind: "yesno", key: "tw_contact_mobile_not_applicable", labelKey: lit("No Taiwan contact mobile number") },
  ];

  if (form.tw_contact_mobile_not_applicable !== "yes") {
    fields.push({ kind: "text", key: "tw_contact_mobile", labelKey: lit("Taiwan contact mobile number") });
  }

  return fields;
}

// ─── Step 4: Other Nationality (only shown if has_other_nationality_passport === yes) ──

const OTHER_NATIONALITY_FIELDS: GenericField[] = [
  { kind: "select", key: "other_nationality_country", labelKey: lit("Other nationality held"), options: opts(NATIONALITY_OPTIONS) },
  { kind: "text", key: "other_passport_number", labelKey: lit("Other nationality passport/document number"), required: true },
  { kind: "date", key: "other_passport_expiry_date", labelKey: lit("Other nationality passport/document expiry date") },
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
  { group: "father", label: "Father (父)" },
  { group: "mother", label: "Mother (母)" },
  { group: "spouse", label: "Spouse (配偶)" },
  { group: "child1", label: "Child 1 (子女)" },
  { group: "child2", label: "Child 2 (子女)" },
];

function kinshipFields(group: KinshipGroup, label: string, form: TwForm): GenericField[] {
  const sameAsOverseasKey = `kin_${group}_current_address_same_as_overseas`;

  const fields: GenericField[] = [
    { kind: "select", key: `kin_${group}_status`, labelKey: lit(`${label} — Living/deceased/divorced`), options: opts(KINSHIP_STATUS) },
    { kind: "text", key: `kin_${group}_name`, labelKey: lit(`${label} — Name`) },
    { kind: "date", key: `kin_${group}_date_of_birth`, labelKey: lit(`${label} — Date of birth`) },
    { kind: "phone", key: `kin_${group}_phone`, labelKey: lit(`${label} — Phone`) },
    { kind: "select", key: `kin_${group}_occupation`, labelKey: lit(`${label} — Occupation`), options: opts(OCCUPATIONS) },
    { kind: "text", key: `kin_${group}_service_unit`, labelKey: lit(`${label} — Employer / unit`) },
    { kind: "text", key: `kin_${group}_job_title`, labelKey: lit(`${label} — Job title`) },
    { kind: "yesno", key: sameAsOverseasKey, labelKey: lit(`${label} — Current address same as applicant's overseas address`) },
  ];

  if (form[sameAsOverseasKey] !== "yes") {
    fields.push({ kind: "textarea", key: `kin_${group}_current_address`, labelKey: lit(`${label} — Current address`) });
  }

  return fields;
}

// ─── Step 6: Declaration ───────────────────────────────────────────────────

const DECLARATION_ITEMS: ChecklistItem[] = [
  {
    key: "past_mainland_political_military_role",
    labelKey: lit("Have previously held a mainland party/administrative/military/political-organ role or membership"),
    explainOnYes: true,
    explainKey: "past_role_detail",
  },
  {
    key: "current_mainland_political_military_role",
    labelKey: lit("Currently hold a mainland party/administrative/military/political-organ role or membership"),
    explainOnYes: true,
    explainKey: "current_role_detail",
  },
  {
    key: "never_held_mainland_political_military_role",
    labelKey: lit("Have never held any mainland party/administrative/military/political-organ role or membership"),
  },
  {
    key: "accepted_terms",
    labelKey: lit("I have read and accept the terms and conditions"),
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
    { titleKey: lit("Delivery location"), editStepKey: "delivery_location", rows: rowsFromFields(DELIVERY_FIELDS, form) },
    { titleKey: lit("Basic status"), editStepKey: "basic_status", rows: rowsFromFields(BASIC_STATUS_FIELDS, form) },
    { titleKey: lit("Applicant identity"), editStepKey: "identity", rows: rowsFromFields(identityFields(form), form) },
    { titleKey: lit("Taiwan contact address"), editStepKey: "tw_contact", rows: rowsFromFields(contactFields(form), form) },
  ];

  if (form.has_other_nationality_passport === "yes") {
    sections.push({
      titleKey: lit("Other nationality"),
      editStepKey: "other_nationality",
      rows: rowsFromFields(OTHER_NATIONALITY_FIELDS, form),
    });
  }

  for (const { group, label } of KINSHIP_GROUPS) {
    sections.push({
      titleKey: lit(`Kinship information — ${label}`),
      editStepKey: `kinship_${group}`,
      rows: rowsFromFields(kinshipFields(group, label, form), form),
    });
  }

  const declarationRows: WizardReviewRow[] = DECLARATION_ITEMS.map((item) => ({
    labelKey: item.labelKey,
    value: form[item.key] ?? "",
  }));
  declarationRows.push(
    { labelKey: lit("Previously held role/position at"), value: form.past_role_detail ?? "" },
    { labelKey: lit("Currently holds role/position at"), value: form.current_role_detail ?? "" },
  );
  sections.push({ titleKey: lit("Declaration"), editStepKey: "declaration", rows: declarationRows });

  return sections;
}

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
    genericStep("delivery_location", "Delivery location", () => DELIVERY_FIELDS),
    genericStep("basic_status", "Photo & basic status", () => BASIC_STATUS_FIELDS),
    genericStep("identity", "Applicant identity", identityFields),
    genericStep("tw_contact", "Taiwan contact address", contactFields),
    {
      key: "other_nationality",
      titleKey: lit("Other nationality"),
      showIf: (form) => form.has_other_nationality_passport === "yes",
      render: ({ form, setForm, onContinue }) =>
        createElement(StepGenericFields, {
          i18nNamespace: NAMESPACE,
          titleKey: lit("Other nationality"),
          fields: OTHER_NATIONALITY_FIELDS,
          values: form,
          onChange: (next) => setForm(() => next),
          onContinue,
        }),
    },
    ...KINSHIP_GROUPS.map(({ group, label }) =>
      genericStep(`kinship_${group}`, `Kinship information — ${label}`, (form) => kinshipFields(group, label, form)),
    ),
    {
      key: "declaration",
      titleKey: lit("Declaration"),
      render: ({ form, setForm, onContinue }) =>
        createElement(StepYesNoChecklist, {
          i18nNamespace: NAMESPACE,
          titleKey: lit("Declaration"),
          items: DECLARATION_ITEMS,
          values: form,
          onChange: (next) => setForm(() => next),
          onContinue,
        }),
    },
  ],
};
