"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Languages,
  PencilLine,
  RefreshCw,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { CountryDropdown, type Country } from "@/components/ui/country-dropdown";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import countryRegionData from "country-region-data/data.json";

type FieldKind = "text" | "date" | "option" | "address";

interface OptionPair {
  zh: string;
  en: string;
  code?: string;
}

type CountryRegion = {
  countryName: string;
  countryShortCode: string;
  regions: Array<{ name: string; shortCode: string }>;
};

interface PreviewField {
  id: string;
  section: string;
  label: string;
  helper: string;
  kind: FieldKind;
  chineseValue: string;
  englishValue: string;
  warnings: string[];
  long?: boolean;
  englishEdited?: boolean;
}

const INITIAL_FIELDS: PreviewField[] = [
  {
    id: "surname",
    section: "个人信息",
    label: "姓",
    helper: "护照上的姓氏拼音，通常使用大写字母。",
    kind: "text",
    chineseValue: "王",
    englishValue: "WANG",
    warnings: ["请确认右侧拼写与护照个人资料页、机读区完全一致。"],
  },
  {
    id: "givenNames",
    section: "个人信息",
    label: "名",
    helper: "护照上的名字拼音；多个名字按护照顺序填写。",
    kind: "text",
    chineseValue: "小明",
    englishValue: "XIAOMING",
    warnings: ["拼音敏感字段必须以护照为准，不能按习惯自行加空格或改拼写。"],
  },
  {
    id: "fullNameNative",
    section: "个人信息",
    label: "中文姓名",
    helper: "用于核对中文原文与英文罗马化是否对应。",
    kind: "text",
    chineseValue: "王小明",
    englishValue: "WANG XIAOMING",
    warnings: ["如护照姓名顺序不同，请以护照英文姓名为准。"],
  },
  {
    id: "birthDate",
    section: "个人信息",
    label: "出生日期",
    helper: "使用日期选择器；右侧同步为官方 DD/MM/YYYY 格式。",
    kind: "date",
    chineseValue: "1996年3月9日",
    englishValue: "09/03/1996",
    warnings: ["右侧按官方格式 DD/MM/YYYY 显示，请特别检查日/月顺序。"],
  },
  {
    id: "maritalStatus",
    section: "个人信息",
    label: "婚姻状况",
    helper: "从官方选项中选择最接近的一项。",
    kind: "option",
    chineseValue: "未婚",
    englishValue: "Single",
    warnings: [],
  },
  {
    id: "gender",
    section: "个人信息",
    label: "性别",
    helper: "按证件信息填写。",
    kind: "option",
    chineseValue: "男",
    englishValue: "Male",
    warnings: [],
  },
  {
    id: "nationality",
    section: "个人信息",
    label: "国籍",
    helper: "国家名称会转成英文官方写法。",
    kind: "option",
    chineseValue: "中国",
    englishValue: "China",
    warnings: [],
  },
  {
    id: "countryOfBirth",
    section: "出生信息",
    label: "出生国家",
    helper: "先选择国家，省/州和城市会按国家缩小范围。",
    kind: "option",
    chineseValue: "中国",
    englishValue: "China",
    warnings: [],
  },
  {
    id: "stateOfBirth",
    section: "出生信息",
    label: "出生省 / 州",
    helper: "按所选国家显示对应省、州或地区。",
    kind: "option",
    chineseValue: "北京",
    englishValue: "Beijing",
    warnings: [],
  },
  {
    id: "cityOfBirth",
    section: "出生信息",
    label: "出生城市",
    helper: "按所选省/州继续缩小城市选项。",
    kind: "option",
    chineseValue: "北京",
    englishValue: "Beijing",
    warnings: ["出生地也属于拼写敏感信息，请与护照或出生证明保持一致。"],
  },
  {
    id: "passportNumber",
    section: "护照信息",
    label: "护照号码",
    helper: "号码、字母通常不翻译，只做格式核对。",
    kind: "text",
    chineseValue: "E12345678",
    englishValue: "E12345678",
    warnings: ["请逐位核对，护照号码错误会直接影响预约和递交。"],
  },
  {
    id: "passportIssueDate",
    section: "护照信息",
    label: "签发日期",
    helper: "使用日期选择器；右侧同步为官方 DD/MM/YYYY 格式。",
    kind: "date",
    chineseValue: "2024-03-09",
    englishValue: "09/03/2024",
    warnings: ["请确认这是签发日期，不是出生日期或有效期。"],
  },
  {
    id: "passportExpiryDate",
    section: "护照信息",
    label: "有效期至",
    helper: "使用日期选择器；右侧同步为官方 DD/MM/YYYY 格式。",
    kind: "date",
    chineseValue: "2034-03-08",
    englishValue: "08/03/2034",
    warnings: ["请确认入境时护照剩余有效期符合目的地要求。"],
  },
  {
    id: "religion",
    section: "背景信息",
    label: "宗教信仰",
    helper: "如果表格允许且本人无宗教信仰，可使用 None。",
    kind: "option",
    chineseValue: "无",
    englishValue: "None",
    warnings: ["不要为了看起来更合适而编造答案，应按真实情况填写。"],
  },
  {
    id: "portOfEntry",
    section: "旅行信息",
    label: "出入境口岸",
    helper: "机场、港口或陆路口岸会转成英文常用名称。",
    kind: "text",
    chineseValue: "纽约肯尼迪国际机场",
    englishValue: "John F. Kennedy International Airport, New York",
    warnings: ["如尚未出票，先按计划口岸填写，提交前再核对行程。"],
  },
  {
    id: "journeyPurpose",
    section: "旅行信息",
    label: "旅行目的",
    helper: "常见目的会映射到官方英文选项。",
    kind: "option",
    chineseValue: "旅游",
    englishValue: "Tourism",
    warnings: [],
  },
  {
    id: "accommodationAddress",
    section: "旅行信息",
    label: "住宿地址",
    helper: "地址较长时采用上下两排展示，便于完整核对。",
    kind: "address",
    chineseValue: "巴黎第一区里沃利街 10 号",
    englishValue: "10 Rue de Rivoli, 1st arrondissement, Paris",
    warnings: ["地址翻译建议保留门牌号、街道、城市和国家，不要省略关键信息。"],
    long: true,
  },
  {
    id: "travelHistory",
    section: "历史记录",
    label: "上一次签证记录",
    helper: "长文本会自动切到两排布局。",
    kind: "address",
    chineseValue: "2023年获得申根旅游签证，签证号 SCH-2023-8891，有效期 30 天。",
    englishValue:
      "Schengen tourist visa issued in 2023, visa number SCH-2023-8891, valid for 30 days.",
    warnings: ["签证号和年份不要翻译错；如系统有固定字段，应拆分填写。"],
    long: true,
  },
];

const DIRECT_TRANSLATIONS: Record<string, string> = {
  王: "WANG",
  李: "LI",
  张: "ZHANG",
  刘: "LIU",
  陈: "CHEN",
  杨: "YANG",
  黄: "HUANG",
  赵: "ZHAO",
  周: "ZHOU",
  吴: "WU",
  小明: "XIAOMING",
  小红: "XIAOHONG",
  伟: "WEI",
  芳: "FANG",
  泓: "HONG",
  羽: "YU",
  王小明: "WANG XIAOMING",
  李小明: "LI XIAOMING",
  北京: "Beijing",
  上海: "Shanghai",
  广州: "Guangzhou",
  深圳: "Shenzhen",
  成都: "Chengdu",
  杭州: "Hangzhou",
  广东: "Guangdong",
  四川: "Sichuan",
  浙江: "Zhejiang",
  中国: "China",
  美国: "United States",
  法国: "France",
  英国: "United Kingdom",
  日本: "Japan",
  新加坡: "Singapore",
  加拿大: "Canada",
  澳大利亚: "Australia",
  德国: "Germany",
  男: "Male",
  女: "Female",
  其他: "Other",
  未婚: "Single",
  已婚: "Married",
  离异: "Divorced",
  丧偶: "Widowed",
  无: "None",
  佛教: "Buddhism",
  基督教: "Christianity",
  伊斯兰教: "Islam",
  旅游: "Tourism",
  商务: "Business",
  留学: "Study",
  探亲: "Visit family",
  过境: "Transit",
  纽约肯尼迪国际机场: "John F. Kennedy International Airport, New York",
  上海浦东国际机场: "Shanghai Pudong International Airport",
  北京首都国际机场: "Beijing Capital International Airport",
  "巴黎第一区里沃利街 10 号": "10 Rue de Rivoli, 1st arrondissement, Paris",
};

const COUNTRY_OPTIONS: OptionPair[] = [
  { zh: "中国", en: "China", code: "CN" },
  { zh: "美国", en: "United States", code: "US" },
  { zh: "英国", en: "United Kingdom", code: "GB" },
  { zh: "法国", en: "France", code: "FR" },
  { zh: "日本", en: "Japan", code: "JP" },
  { zh: "新加坡", en: "Singapore", code: "SG" },
  { zh: "加拿大", en: "Canada", code: "CA" },
  { zh: "澳大利亚", en: "Australia", code: "AU" },
  { zh: "德国", en: "Germany", code: "DE" },
];

const CHINA_REGION_ZH: Record<string, string> = {
  AH: "安徽",
  BJ: "北京",
  CQ: "重庆",
  FJ: "福建",
  GS: "甘肃",
  GD: "广东",
  GX: "广西",
  GZ: "贵州",
  HI: "海南",
  HE: "河北",
  HL: "黑龙江",
  HA: "河南",
  HK: "香港",
  HB: "湖北",
  HN: "湖南",
  JS: "江苏",
  JX: "江西",
  JL: "吉林",
  LN: "辽宁",
  MO: "澳门",
  NM: "内蒙古",
  NX: "宁夏",
  QH: "青海",
  SN: "陕西",
  SD: "山东",
  SH: "上海",
  SX: "山西",
  SC: "四川",
  TJ: "天津",
  XJ: "新疆",
  YN: "云南",
  ZJ: "浙江",
  TW: "台湾",
  XZ: "西藏",
};

const CITY_OPTIONS_BY_REGION: Record<string, OptionPair[]> = {
  "CN-AH": [
    { zh: "合肥", en: "Hefei" },
    { zh: "芜湖", en: "Wuhu" },
    { zh: "蚌埠", en: "Bengbu" },
  ],
  "CN-BJ": [{ zh: "北京", en: "Beijing" }],
  "CN-CQ": [{ zh: "重庆", en: "Chongqing" }],
  "CN-FJ": [
    { zh: "福州", en: "Fuzhou" },
    { zh: "厦门", en: "Xiamen" },
    { zh: "泉州", en: "Quanzhou" },
  ],
  "CN-GD": [
    { zh: "广州", en: "Guangzhou" },
    { zh: "深圳", en: "Shenzhen" },
    { zh: "珠海", en: "Zhuhai" },
    { zh: "佛山", en: "Foshan" },
    { zh: "东莞", en: "Dongguan" },
  ],
  "CN-SC": [
    { zh: "成都", en: "Chengdu" },
    { zh: "绵阳", en: "Mianyang" },
    { zh: "乐山", en: "Leshan" },
  ],
  "CN-SH": [{ zh: "上海", en: "Shanghai" }],
  "CN-ZJ": [
    { zh: "杭州", en: "Hangzhou" },
    { zh: "宁波", en: "Ningbo" },
    { zh: "温州", en: "Wenzhou" },
  ],
  "CN-JS": [
    { zh: "南京", en: "Nanjing" },
    { zh: "苏州", en: "Suzhou" },
    { zh: "无锡", en: "Wuxi" },
  ],
  "CN-SD": [
    { zh: "济南", en: "Jinan" },
    { zh: "青岛", en: "Qingdao" },
    { zh: "烟台", en: "Yantai" },
  ],
  "US-CA": [
    { zh: "洛杉矶", en: "Los Angeles" },
    { zh: "旧金山", en: "San Francisco" },
    { zh: "圣迭戈", en: "San Diego" },
  ],
  "US-NY": [
    { zh: "纽约", en: "New York" },
    { zh: "布法罗", en: "Buffalo" },
    { zh: "奥尔巴尼", en: "Albany" },
  ],
};

const OPTION_SETS: Record<string, OptionPair[]> = {
  maritalStatus: [
    { zh: "未婚", en: "Single" },
    { zh: "已婚", en: "Married" },
    { zh: "离异", en: "Divorced" },
    { zh: "丧偶", en: "Widowed" },
  ],
  gender: [
    { zh: "男", en: "Male" },
    { zh: "女", en: "Female" },
    { zh: "其他", en: "Other" },
  ],
  nationality: COUNTRY_OPTIONS,
  countryOfBirth: COUNTRY_OPTIONS,
  religion: [
    { zh: "无", en: "None" },
    { zh: "佛教", en: "Buddhism" },
    { zh: "基督教", en: "Christianity" },
    { zh: "伊斯兰教", en: "Islam" },
    { zh: "其他", en: "Other" },
  ],
  journeyPurpose: [
    { zh: "旅游", en: "Tourism" },
    { zh: "商务", en: "Business" },
    { zh: "留学", en: "Study" },
    { zh: "探亲", en: "Visit family" },
    { zh: "过境", en: "Transit" },
  ],
};

const REVERSE_TRANSLATIONS = Object.entries(DIRECT_TRANSLATIONS).reduce<Record<string, string>>(
  (translations, [chinese, english]) => {
    translations[normaliseLookup(english)] = chinese;
    return translations;
  },
  {},
);

const TEXT_REPLACEMENTS = [
  ["2023年", "issued in 2023"],
  ["获得", ""],
  ["申根", "Schengen"],
  ["旅游签证", "tourist visa"],
  ["签证号", "visa number"],
  ["有效期", "valid for"],
  ["30 天", "30 days"],
  ["，", ", "],
  ["。", "."],
] as const;

function normaliseLookup(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function formatOfficialDate(value: string): string | null {
  const trimmed = value.trim();
  const isoMatch = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  const chineseMatch = trimmed.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日$/);
  const match = isoMatch ?? chineseMatch;

  if (!match) {
    return null;
  }

  const [, year, month, day] = match;
  return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
}

function parseDateToIso(value: string): string | null {
  const trimmed = value.trim();
  const isoMatch = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  const chineseMatch = trimmed.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日$/);
  const officialMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  if (chineseMatch) {
    const [, year, month, day] = chineseMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  if (officialMatch) {
    const [, day, month, year] = officialMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  return null;
}

function formatChineseDateFromIso(value: string): string {
  const parsed = parseDateToIso(value);
  if (!parsed) return value;
  const [year, month, day] = parsed.split("-");
  return `${year}年${Number(month)}月${Number(day)}日`;
}

function formatOfficialDateFromIso(value: string): string {
  const parsed = parseDateToIso(value);
  if (!parsed) return value;
  const [year, month, day] = parsed.split("-");
  return `${day}/${month}/${year}`;
}

function formatChineseDate(value: string): string | null {
  const trimmed = value.trim();
  const officialMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const isoMatch = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);

  if (officialMatch) {
    const [, day, month, year] = officialMatch;
    return `${year}年${Number(month)}月${Number(day)}日`;
  }

  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${year}年${Number(month)}月${Number(day)}日`;
  }

  return null;
}

function looksLikeMostlyLatin(value: string): boolean {
  return /^[\dA-Za-z\s,.'#/-]+$/.test(value.trim());
}

function hasChineseCharacters(value: string): boolean {
  return /[\u3400-\u9FFF]/.test(value);
}

function transliterateChineseName(value: string): string | null {
  const normalized = value.replace(/\s+/g, "");
  if (!normalized || !hasChineseCharacters(normalized)) return null;

  const syllables = Array.from(normalized).map((character) => DIRECT_TRANSLATIONS[character]);
  if (syllables.some((syllable) => !syllable)) {
    return null;
  }

  return syllables.join(" ");
}

function getChineseCountryName(country: Country): string {
  try {
    const displayNames = new Intl.DisplayNames(["zh"], { type: "region" });
    return displayNames.of(country.alpha2.toUpperCase()) ?? country.name;
  } catch {
    return country.name;
  }
}

function getCountryCodeFromValue(value: string): string {
  const lookup = normaliseLookup(value);
  const direct = COUNTRY_OPTIONS.find(
    (option) => normaliseLookup(option.zh) === lookup || normaliseLookup(option.en) === lookup,
  );

  return direct?.code ?? "CN";
}

function getCountryRegion(countryCode: string): CountryRegion | undefined {
  return (countryRegionData as CountryRegion[]).find(
    (entry) => entry.countryShortCode === countryCode,
  );
}

function getRegionOptions(countryCode: string): OptionPair[] {
  const country = getCountryRegion(countryCode);
  if (!country) return [];

  return country.regions.map((region) => ({
    zh: countryCode === "CN" ? CHINA_REGION_ZH[region.shortCode] ?? region.name : region.name,
    en: region.name,
    code: region.shortCode,
  }));
}

function getRegionCodeFromValue(countryCode: string, value: string): string {
  const lookup = normaliseLookup(value);
  const match = getRegionOptions(countryCode).find(
    (option) =>
      option.code?.toLowerCase() === lookup
      || normaliseLookup(option.zh) === lookup
      || normaliseLookup(option.en) === lookup,
  );

  return match?.code ?? getRegionOptions(countryCode)[0]?.code ?? "";
}

function getFieldValue(fields: PreviewField[], fieldId: string, side: "chinese" | "english"): string {
  const field = fields.find((item) => item.id === fieldId);
  if (!field) return "";
  return side === "chinese" ? field.chineseValue : field.englishValue;
}

function getCityOptions(countryCode: string, regionCode: string): OptionPair[] {
  const knownCities = CITY_OPTIONS_BY_REGION[`${countryCode}-${regionCode}`];
  if (knownCities) return knownCities;

  const region = getRegionOptions(countryCode).find((option) => option.code === regionCode);
  if (!region) return [];

  return [{ zh: region.zh, en: region.en, code: region.code }];
}

function getOptions(fieldId: string, fields?: PreviewField[]): OptionPair[] {
  if (fieldId === "stateOfBirth") {
    const countryCode = getCountryCodeFromValue(getFieldValue(fields ?? [], "countryOfBirth", "english"));
    return getRegionOptions(countryCode);
  }

  if (fieldId === "cityOfBirth") {
    const countryCode = getCountryCodeFromValue(getFieldValue(fields ?? [], "countryOfBirth", "english"));
    const regionCode = getRegionCodeFromValue(
      countryCode,
      getFieldValue(fields ?? [], "stateOfBirth", "english"),
    );
    return getCityOptions(countryCode, regionCode);
  }

  return OPTION_SETS[fieldId] ?? [];
}

function findOptionByChinese(fieldId: string, value: string, fields?: PreviewField[]): OptionPair | undefined {
  const lookup = normaliseLookup(value);
  return getOptions(fieldId, fields).find((option) => normaliseLookup(option.zh) === lookup);
}

function findOptionByEnglish(fieldId: string, value: string, fields?: PreviewField[]): OptionPair | undefined {
  const lookup = normaliseLookup(value);
  return getOptions(fieldId, fields).find((option) => normaliseLookup(option.en) === lookup);
}

function translateText(value: string, kind: FieldKind, fieldId?: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  if (kind === "date") {
    return formatOfficialDate(trimmed) ?? "日期格式无法识别，请手动确认";
  }

  const direct = DIRECT_TRANSLATIONS[trimmed];
  if (direct) {
    return direct;
  }

  if (fieldId === "surname" || fieldId === "givenNames" || fieldId === "fullNameNative") {
    const transliteration = transliterateChineseName(trimmed);
    if (transliteration) {
      return transliteration;
    }
  }

  if (looksLikeMostlyLatin(trimmed)) {
    return trimmed;
  }

  let translated = trimmed;
  for (const [source, target] of TEXT_REPLACEMENTS) {
    translated = translated.replaceAll(source, target);
  }

  if (translated !== trimmed) {
    return translated.replace(/\s+/g, " ").replace(/,\s*\./g, ".").trim();
  }

  if (kind === "address") {
    return `Please confirm English address: ${trimmed}`;
  }

  return `Please confirm official English: ${trimmed}`;
}

function reverseTranslateText(value: string, kind: FieldKind): string {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  if (kind === "date") {
    return formatChineseDate(trimmed) ?? "日期格式无法识别，请手动确认";
  }

  const direct = REVERSE_TRANSLATIONS[normaliseLookup(trimmed)];
  if (direct) {
    return direct;
  }

  if (normaliseLookup(trimmed) === normaliseLookup("Schengen tourist visa issued in 2023, visa number SCH-2023-8891, valid for 30 days.")) {
    return "2023年获得申根旅游签证，签证号 SCH-2023-8891，有效期 30 天。";
  }

  return trimmed;
}

function getFieldBadge(field: PreviewField): string {
  if (field.englishEdited) {
    return "英文侧已同步";
  }

  if (field.kind === "date") {
    return "官方日期格式";
  }

  if (field.kind === "option") {
    return "官方选项映射";
  }

  return "自动生成英文";
}

function ReviewDatePicker({
  value,
  side,
  label,
  onChange,
}: {
  value: string;
  side: "chinese" | "english";
  label: string;
  onChange: (value: string, pairedValue: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const isoValue = parseDateToIso(value) ?? "";
  const date = isoValue ? new Date(`${isoValue}T00:00:00`) : undefined;
  const placeholder = side === "chinese" ? "选择日期" : "Select date";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          aria-label={label}
          className="h-12 w-full justify-start rounded-lg border-[#e8e8e8] bg-transparent text-left text-[15px] font-normal shadow-xs hover:bg-transparent focus:ring-1 focus:ring-[#03346E] focus:border-[#03346E]"
        >
          <CalendarDays className="mr-2 h-4 w-4 shrink-0 text-gray-400" />
          {value || <span className="text-muted-foreground">{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          defaultMonth={date}
          onSelect={(selectedDate) => {
            if (!selectedDate) return;
            const year = selectedDate.getFullYear();
            const month = String(selectedDate.getMonth() + 1).padStart(2, "0");
            const day = String(selectedDate.getDate()).padStart(2, "0");
            const nextIsoValue = `${year}-${month}-${day}`;
            onChange(
              side === "chinese" ? formatChineseDateFromIso(nextIsoValue) : formatOfficialDateFromIso(nextIsoValue),
              side === "chinese" ? formatOfficialDateFromIso(nextIsoValue) : formatChineseDateFromIso(nextIsoValue),
            );
            setOpen(false);
          }}
          captionLayout="dropdown"
          startMonth={new Date(1920, 0)}
          endMonth={new Date(2036, 11)}
        />
      </PopoverContent>
    </Popover>
  );
}

function ReviewValueControl({
  field,
  fields,
  side,
  onChange,
}: {
  field: PreviewField;
  fields: PreviewField[];
  side: "chinese" | "english";
  onChange: (value: string, pairedValue?: string) => void;
}) {
  const options = getOptions(field.id, fields);
  const isChinese = side === "chinese";
  const label = isChinese ? `${field.label}中文原文` : `${field.label}英文翻译`;
  const value = isChinese ? field.chineseValue : field.englishValue;
  const controlClass =
    "h-12 rounded-lg border-[#e8e8e8] text-[15px] focus:ring-1 focus:ring-[#03346E] focus:border-[#03346E] data-[placeholder]:text-muted-foreground";
  const inputClass =
    "h-12 w-full rounded-lg border border-[#e8e8e8] bg-transparent px-3 text-[15px] outline-none shadow-xs transition focus:border-[#03346E] focus:ring-1 focus:ring-[#03346E]";
  const textareaClass =
    "min-h-[96px] w-full resize-y rounded-lg border border-[#e8e8e8] bg-transparent px-3 py-2 text-[15px] leading-6 outline-none shadow-xs transition focus:border-[#03346E] focus:ring-1 focus:ring-[#03346E]";

  if (field.kind === "date") {
    return <ReviewDatePicker value={value} side={side} label={label} onChange={onChange} />;
  }

  if (field.id === "nationality" || field.id === "countryOfBirth") {
    return (
      <CountryDropdown
        defaultValue={value}
        placeholder={isChinese ? "搜索国家..." : "Search country..."}
        className="bg-transparent"
        onChange={(country) => {
          const chineseName = getChineseCountryName(country);
          onChange(isChinese ? chineseName : country.name, isChinese ? country.name : chineseName);
        }}
      />
    );
  }

  if (options.length > 0) {
    return (
      <Select
        value={value}
        onValueChange={(nextValue) => {
          const selectedOption = isChinese
            ? findOptionByChinese(field.id, nextValue, fields)
            : findOptionByEnglish(field.id, nextValue, fields);
          onChange(nextValue, isChinese ? selectedOption?.en : selectedOption?.zh);
        }}
      >
        <SelectTrigger aria-label={label} className={controlClass}>
          <SelectValue placeholder={isChinese ? "请选择" : "Select"} />
        </SelectTrigger>
        <SelectContent>
        {options.map((option) => {
          const optionValue = isChinese ? option.zh : option.en;
          return (
            <SelectItem key={`${field.id}-${optionValue}`} value={optionValue}>
              {optionValue}
            </SelectItem>
          );
        })}
        </SelectContent>
      </Select>
    );
  }

  if (!field.long) {
    return (
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={inputClass}
        aria-label={label}
      />
    );
  }

  return (
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      rows={field.long ? 4 : 2}
      className={
        isChinese ? `${textareaClass} text-[#252a33]` : `${textareaClass} font-medium text-[#172033]`
      }
      aria-label={label}
    />
  );
}

function groupFields(fields: PreviewField[]): Array<{ section: string; fields: PreviewField[] }> {
  const grouped = new Map<string, PreviewField[]>();

  for (const field of fields) {
    const sectionFields = grouped.get(field.section) ?? [];
    sectionFields.push(field);
    grouped.set(field.section, sectionFields);
  }

  return Array.from(grouped.entries()).map(([section, sectionFields]) => ({
    section,
    fields: sectionFields,
  }));
}

function syncBirthLocationCascade(fields: PreviewField[], changedFieldId: string): PreviewField[] {
  if (changedFieldId !== "countryOfBirth" && changedFieldId !== "stateOfBirth") {
    return fields;
  }

  const countryCode = getCountryCodeFromValue(getFieldValue(fields, "countryOfBirth", "english"));
  const currentRegionCode = getRegionCodeFromValue(
    countryCode,
    getFieldValue(fields, "stateOfBirth", "english"),
  );
  const regionOptions = getRegionOptions(countryCode);
  const nextRegion =
    changedFieldId === "countryOfBirth"
      ? regionOptions[0]
      : regionOptions.find((option) => option.code === currentRegionCode) ?? regionOptions[0];

  if (!nextRegion?.code) return fields;

  const nextCity = getCityOptions(countryCode, nextRegion.code)[0];

  return fields.map((field) => {
    if (field.id === "stateOfBirth") {
      return {
        ...field,
        chineseValue: nextRegion.zh,
        englishValue: nextRegion.en,
        englishEdited: false,
      };
    }

    if (field.id === "cityOfBirth" && nextCity) {
      return {
        ...field,
        chineseValue: nextCity.zh,
        englishValue: nextCity.en,
        englishEdited: false,
      };
    }

    return field;
  });
}

export default function BilingualReviewPreviewPage() {
  const [fields, setFields] = useState<PreviewField[]>(INITIAL_FIELDS);
  const sections = useMemo(() => groupFields(fields), [fields]);
  const editedCount = fields.filter((field) => field.englishEdited).length;

  function updateChineseValue(fieldId: string, chineseValue: string, pairedEnglishValue?: string) {
    setFields((current) =>
      syncBirthLocationCascade(
        current.map((field) =>
          field.id === fieldId
            ? (() => {
              const selectedOption = findOptionByChinese(field.id, chineseValue, current);
              const datePair =
                field.kind === "date" && !pairedEnglishValue
                  ? formatOfficialDate(chineseValue)
                  : null;
              return {
                ...field,
                chineseValue: selectedOption?.zh ?? chineseValue,
                englishValue:
                  pairedEnglishValue
                  ?? selectedOption?.en
                  ?? datePair
                  ?? translateText(chineseValue, field.kind, field.id),
                englishEdited: false,
              };
            })()
            : field,
        ),
        fieldId,
      ),
    );
  }

  function updateEnglishValue(fieldId: string, englishValue: string, pairedChineseValue?: string) {
    setFields((current) =>
      syncBirthLocationCascade(
        current.map((field) =>
          field.id === fieldId
            ? (() => {
              const selectedOption = findOptionByEnglish(field.id, englishValue, current);
              const datePair =
                field.kind === "date" && !pairedChineseValue
                  ? formatChineseDate(englishValue)
                  : null;
              return {
                ...field,
                chineseValue:
                  pairedChineseValue
                  ?? selectedOption?.zh
                  ?? datePair
                  ?? reverseTranslateText(englishValue, field.kind),
                englishValue: selectedOption?.en ?? englishValue,
                englishEdited: true,
              };
            })()
            : field,
        ),
        fieldId,
      ),
    );
  }

  function refreshAllTranslations() {
    setFields((current) =>
      current.map((field) => {
        const selectedOption = findOptionByChinese(field.id, field.chineseValue, current);
        return {
          ...field,
          englishValue: selectedOption?.en ?? translateText(field.chineseValue, field.kind, field.id),
          englishEdited: false,
        };
      }),
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f8fa] px-4 py-6 text-[#23262d] sm:px-6 lg:px-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <header className="flex flex-col gap-4 border-b border-[#dfe5ee] pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#03346E]">
              <Languages className="h-4 w-4" />
              独立验证页
            </div>
            <h1 className="font-heading text-3xl font-medium text-[#24272f]">
              双语核对页验证
            </h1>
            <p className="mt-2 text-sm leading-6 text-[#5e6673]">
              这个页面不接入真实申请流程。左侧输入中文，右侧会自动生成英文或官方格式；两边都可以直接编辑，用来验证提交前核对体验。
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={refreshAllTranslations}
              className="inline-flex h-10 items-center gap-2 rounded-md border border-[#cbd8ea] bg-white px-3 text-sm font-medium text-[#03346E] transition-colors hover:bg-[#eef5ff]"
            >
              <RefreshCw className="h-4 w-4" />
              重新生成英文
            </button>
            <button
              type="button"
              onClick={() => setFields(INITIAL_FIELDS)}
              className="inline-flex h-10 items-center gap-2 rounded-md border border-[#d8dce3] bg-white px-3 text-sm font-medium text-[#424955] transition-colors hover:bg-[#f0f2f5]"
            >
              <RotateCcw className="h-4 w-4" />
              重置示例
            </button>
          </div>
        </header>

        <section className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-[#dfe5ee] bg-white p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#03346E]">
              <Sparkles className="h-4 w-4" />
              下拉选项映射
            </div>
            <p className="mt-2 text-sm leading-6 text-[#5e6673]">
              婚姻状况、性别、国籍、宗教信仰、旅行目的等字段改为下拉选择。
            </p>
          </div>
          <div className="rounded-lg border border-[#dfe5ee] bg-white p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#03346E]">
              <PencilLine className="h-4 w-4" />
              双向同步
            </div>
            <p className="mt-2 text-sm leading-6 text-[#5e6673]">
              中文侧变化会刷新英文；英文侧变化也会反向同步中文，日期会自动在两种格式间转换。
            </p>
          </div>
          <div className="rounded-lg border border-[#dfe5ee] bg-white p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#03346E]">
              <CheckCircle2 className="h-4 w-4" />
              当前状态
            </div>
            <p className="mt-2 text-sm leading-6 text-[#5e6673]">
              共 {fields.length} 个核对字段，{editedCount} 个字段刚从英文侧同步。
            </p>
          </div>
        </section>

        <section className="overflow-hidden rounded-lg border border-[#dfe5ee] bg-white">
          <div className="hidden grid-cols-[180px_minmax(0,1fr)_minmax(0,1fr)] gap-4 border-b border-[#dfe5ee] bg-[#edf3fb] px-4 py-3 text-xs font-semibold text-[#42506a] md:grid">
            <span>字段</span>
            <span>中文原文</span>
            <span>英文翻译 / 官方格式</span>
          </div>

          {sections.map((section) => (
            <div key={section.section} className="border-b border-[#e6ebf2] last:border-b-0">
              <div className="bg-[#f7fafe] px-4 py-3 text-sm font-semibold text-[#03346E]">
                {section.section}
              </div>

              <div className="divide-y divide-[#eef1f5]">
                {section.fields.map((field) => (
                  <div
                    key={field.id}
                    className={
                      field.long
                        ? "grid min-w-0 gap-3 px-4 py-4 md:grid-cols-[180px_minmax(0,1fr)]"
                        : "grid min-w-0 gap-3 px-4 py-4 md:grid-cols-[180px_minmax(0,1fr)_minmax(0,1fr)]"
                    }
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#24272f]">{field.label}</p>
                      <p className="mt-1 text-xs leading-5 text-[#697386]">{field.helper}</p>
                      <span className="mt-2 inline-flex rounded-full bg-[#eaf2ff] px-2 py-1 text-[11px] font-medium text-[#03346E]">
                        {getFieldBadge(field)}
                      </span>
                    </div>

                    <label className={field.long ? "min-w-0 md:col-start-2" : "min-w-0"}>
                      <span className="mb-1 block text-xs font-semibold text-[#667085] md:hidden">
                        中文原文
                      </span>
                      <ReviewValueControl
                        field={field}
                        fields={fields}
                        side="chinese"
                        onChange={(value, pairedValue) => updateChineseValue(field.id, value, pairedValue)}
                      />
                    </label>

                    <label className={field.long ? "min-w-0 md:col-start-2" : "min-w-0"}>
                      <span className="mb-1 block text-xs font-semibold text-[#667085] md:hidden">
                        英文翻译 / 官方格式
                      </span>
                      <ReviewValueControl
                        field={field}
                        fields={fields}
                        side="english"
                        onChange={(value, pairedValue) => updateEnglishValue(field.id, value, pairedValue)}
                      />
                    </label>

                    {field.warnings.length > 0 && (
                      <div className={field.long ? "md:col-start-2" : "md:col-start-2 md:col-span-2"}>
                        <div className="flex gap-2 rounded-md border border-[#f0d8a5] bg-[#fff8e8] px-3 py-2 text-xs leading-5 text-[#815b16]">
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                          <div>
                            {field.warnings.map((warning) => (
                              <p key={warning}>{warning}</p>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
