"use client";

import { type ReactNode, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { CalendarDays, CheckIcon, ChevronDown, Globe, MapPin, User } from "lucide-react";
import { CircleFlag } from "react-circle-flags";
import { countries } from "country-data-list";
import countryRegionData from "country-region-data/data.json";
import { BrandActionButton } from "@/components/client/brand-action-button";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
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
import { cn } from "@/lib/utils";

export interface PersonalInfoData {
  surname: string;
  givenNames: string;
  fullNameNativeAlphabet: string;
  sex: string;
  maritalStatus: string;
  dateOfBirth: string;
  cityOfBirth: string;
  stateOfBirth: string;
  countryOfBirth: string;
  nationality: string;
}

interface PersonalInfoStepProps {
  applicationId?: string;
  prefill?: Partial<PersonalInfoData>;
  onComplete: (data: PersonalInfoData) => void;
}

type Side = "zh" | "en";
type TextFieldKey = "surname" | "givenNames" | "fullNameNativeAlphabet";

interface BilingualTextValue {
  zh: string;
  en: string;
}

type BilingualTextState = Record<TextFieldKey, BilingualTextValue>;

interface OptionPair {
  code: string;
  zh: string;
  en: string;
}

interface CountryRecord {
  alpha2: string;
  alpha3: string;
  emoji?: string;
  ioc: string;
  name: string;
  status: string;
}

interface CountryRegion {
  countryName: string;
  countryShortCode: string;
  regions: Array<{ name: string; shortCode: string }>;
}

const MARITAL_STATUS_OPTIONS: OptionPair[] = [
  { code: "SINGLE", zh: "未婚", en: "Single" },
  { code: "MARRIED", zh: "已婚", en: "Married" },
  { code: "DIVORCED", zh: "离异", en: "Divorced" },
  { code: "WIDOWED", zh: "丧偶", en: "Widowed" },
  { code: "SEPARATED", zh: "分居", en: "Separated" },
  { code: "OTHER", zh: "其他", en: "Other" },
];

const GENDER_OPTIONS: OptionPair[] = [
  { code: "M", zh: "男", en: "Male" },
  { code: "F", zh: "女", en: "Female" },
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
    { code: "Hefei", zh: "合肥", en: "Hefei" },
    { code: "Wuhu", zh: "芜湖", en: "Wuhu" },
    { code: "Bengbu", zh: "蚌埠", en: "Bengbu" },
  ],
  "CN-BJ": [{ code: "Beijing", zh: "北京", en: "Beijing" }],
  "CN-CQ": [{ code: "Chongqing", zh: "重庆", en: "Chongqing" }],
  "CN-FJ": [
    { code: "Fuzhou", zh: "福州", en: "Fuzhou" },
    { code: "Xiamen", zh: "厦门", en: "Xiamen" },
    { code: "Quanzhou", zh: "泉州", en: "Quanzhou" },
  ],
  "CN-GD": [
    { code: "Guangzhou", zh: "广州", en: "Guangzhou" },
    { code: "Shenzhen", zh: "深圳", en: "Shenzhen" },
    { code: "Zhuhai", zh: "珠海", en: "Zhuhai" },
    { code: "Foshan", zh: "佛山", en: "Foshan" },
    { code: "Dongguan", zh: "东莞", en: "Dongguan" },
  ],
  "CN-SC": [
    { code: "Chengdu", zh: "成都", en: "Chengdu" },
    { code: "Mianyang", zh: "绵阳", en: "Mianyang" },
    { code: "Leshan", zh: "乐山", en: "Leshan" },
  ],
  "CN-SH": [{ code: "Shanghai", zh: "上海", en: "Shanghai" }],
  "CN-ZJ": [
    { code: "Hangzhou", zh: "杭州", en: "Hangzhou" },
    { code: "Ningbo", zh: "宁波", en: "Ningbo" },
    { code: "Wenzhou", zh: "温州", en: "Wenzhou" },
  ],
  "CN-JS": [
    { code: "Nanjing", zh: "南京", en: "Nanjing" },
    { code: "Suzhou", zh: "苏州", en: "Suzhou" },
    { code: "Wuxi", zh: "无锡", en: "Wuxi" },
  ],
  "CN-SD": [
    { code: "Jinan", zh: "济南", en: "Jinan" },
    { code: "Qingdao", zh: "青岛", en: "Qingdao" },
    { code: "Yantai", zh: "烟台", en: "Yantai" },
  ],
  "US-CA": [
    { code: "Los Angeles", zh: "洛杉矶", en: "Los Angeles" },
    { code: "San Francisco", zh: "旧金山", en: "San Francisco" },
    { code: "San Diego", zh: "圣迭戈", en: "San Diego" },
  ],
  "US-NY": [
    { code: "New York", zh: "纽约", en: "New York" },
    { code: "Buffalo", zh: "布法罗", en: "Buffalo" },
    { code: "Albany", zh: "奥尔巴尼", en: "Albany" },
  ],
};

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
  王小明: "WANG XIAOMING",
  李小明: "LI XIAOMING",
  张三: "ZHANG SAN",
  北京: "Beijing",
  上海: "Shanghai",
  广州: "Guangzhou",
  深圳: "Shenzhen",
  成都: "Chengdu",
  杭州: "Hangzhou",
};

const REVERSE_TRANSLATIONS = Object.entries(DIRECT_TRANSLATIONS).reduce<Record<string, string>>(
  (translations, [zh, en]) => {
    translations[normalizeLookup(en)] = zh;
    return translations;
  },
  {},
);

const COUNTRY_OPTIONS = buildCountryOptions();

function normalizeLookup(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function getLocalizedRegionName(alpha2: string) {
  try {
    const displayNames = new Intl.DisplayNames(["zh"], { type: "region" });
    return displayNames.of(alpha2.toUpperCase()) ?? "";
  } catch {
    return "";
  }
}

function buildCountryOptions(): OptionPair[] {
  const priorityCodes = ["CN", "US", "GB", "SG", "JP", "CA", "AU", "FR", "DE"];
  const priorityIndex = new Map(priorityCodes.map((code, index) => [code, index]));

  return (countries.all as CountryRecord[])
    .filter((country) => country.emoji && country.status !== "deleted" && country.ioc !== "PRK")
    .map((country) => ({
      code: country.alpha2,
      zh: getLocalizedRegionName(country.alpha2) || country.name,
      en: country.name,
    }))
    .sort((a, b) => {
      const aPriority = priorityIndex.get(a.code) ?? Number.MAX_SAFE_INTEGER;
      const bPriority = priorityIndex.get(b.code) ?? Number.MAX_SAFE_INTEGER;
      if (aPriority !== bPriority) return aPriority - bPriority;
      return a.en.localeCompare(b.en);
    });
}

function findOption(options: OptionPair[], value?: string) {
  if (!value) return undefined;
  const lookup = normalizeLookup(value);
  return options.find(
    (option) =>
      normalizeLookup(option.code) === lookup ||
      normalizeLookup(option.zh) === lookup ||
      normalizeLookup(option.en) === lookup,
  );
}

function getRegionOptions(countryCode: string): OptionPair[] {
  const country = (countryRegionData as CountryRegion[]).find(
    (entry) => entry.countryShortCode === countryCode,
  );
  if (!country) return [];

  return country.regions.map((region) => ({
    code: region.shortCode,
    zh: countryCode === "CN" ? CHINA_REGION_ZH[region.shortCode] ?? region.name : region.name,
    en: region.name,
  }));
}

function getCityOptions(countryCode: string, regionCode: string): OptionPair[] {
  const knownCities = CITY_OPTIONS_BY_REGION[`${countryCode}-${regionCode}`];
  if (knownCities) return knownCities;

  const region = findOption(getRegionOptions(countryCode), regionCode);
  if (!region) return [];
  return [{ code: region.en, zh: region.zh, en: region.en }];
}

function translateZhText(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const direct = DIRECT_TRANSLATIONS[trimmed];
  if (direct) return direct;

  const syllables = Array.from(trimmed.replace(/\s+/g, "")).map((character) => DIRECT_TRANSLATIONS[character]);
  if (syllables.length > 0 && syllables.every(Boolean)) {
    return syllables.join(" ");
  }

  if (/^[\dA-Za-z\s,.'#/-]+$/.test(trimmed)) {
    return trimmed;
  }

  return `Please confirm official English: ${trimmed}`;
}

function translateEnText(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return REVERSE_TRANSLATIONS[normalizeLookup(trimmed)] ?? trimmed;
}

function formatChineseDate(isoValue: string) {
  if (!isoValue) return "";
  const [year, month, day] = isoValue.split("-");
  return `${year}年${Number(month)}月${Number(day)}日`;
}

function formatOfficialDate(isoValue: string) {
  if (!isoValue) return "";
  const [year, month, day] = isoValue.split("-");
  return `${day}/${month}/${year}`;
}

function toInitialTextValue(field: TextFieldKey, value?: string): BilingualTextValue {
  const officialValue = value ?? "";
  if (!officialValue) return { zh: "", en: "" };

  if (field === "fullNameNativeAlphabet") {
    return {
      zh: officialValue,
      en: translateZhText(officialValue),
    };
  }

  return {
    zh: translateEnText(officialValue),
    en: officialValue,
  };
}

function getInitialRegionCode(countryCode: string, value?: string) {
  return findOption(getRegionOptions(countryCode), value)?.code ?? "";
}

function getInitialCityCode(countryCode: string, regionCode: string, value?: string) {
  return findOption(getCityOptions(countryCode, regionCode), value)?.code ?? "";
}

function SectionHeader({ children }: { children: ReactNode }) {
  return (
    <div className="bg-[#f7fafe] px-4 py-3 text-sm font-semibold text-[#03346E]">
      {children}
    </div>
  );
}

function BilingualRow({
  label,
  zhControl,
  enControl,
}: {
  label: string;
  helper?: string;
  badge?: string;
  zhControl: ReactNode;
  enControl: ReactNode;
}) {
  return (
    <div className="grid min-w-0 gap-3 px-4 py-4 md:grid-cols-[180px_minmax(0,1fr)_minmax(0,1fr)]">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[#24272f]">{label}</p>
      </div>
      <label className="min-w-0">
        <span className="mb-1 block text-xs font-semibold text-[#667085] md:hidden">中文</span>
        {zhControl}
      </label>
      <label className="min-w-0">
        <span className="mb-1 block text-xs font-semibold text-[#667085] md:hidden">English / Official</span>
        {enControl}
      </label>
    </div>
  );
}

function TextControl({
  value,
  side,
  placeholder,
  required,
  onChange,
}: {
  value: string;
  side: Side;
  placeholder: string;
  required?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <InputGroup className="h-12 rounded-lg border-[#e8e8e8] focus-within:ring-1 focus-within:ring-[#03346E] focus-within:border-[#03346E]">
      <InputGroupAddon align="inline-start">
        <User className="h-4 w-4 text-gray-400" />
      </InputGroupAddon>
      <InputGroupInput
        aria-label={side === "zh" ? "中文" : "English"}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        className="h-12 text-[15px]"
      />
    </InputGroup>
  );
}

function OptionControl({
  value,
  side,
  options,
  placeholder,
  icon,
  onChange,
}: {
  value: string;
  side: Side;
  options: OptionPair[];
  placeholder: string;
  icon?: ReactNode;
  onChange: (value: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-12 rounded-lg border-[#e8e8e8] text-[15px] focus:ring-1 focus:ring-[#03346E] focus:border-[#03346E] data-[placeholder]:text-muted-foreground">
        <div className="flex min-w-0 items-center gap-2">
          {icon ? <span className="shrink-0 text-gray-400">{icon}</span> : null}
          <SelectValue placeholder={placeholder} />
        </div>
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={`${side}-${option.code}`} value={option.code}>
            {side === "zh" ? option.zh : option.en}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function CountryOptionControl({
  value,
  side,
  placeholder,
  onChange,
}: {
  value: string;
  side: Side;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedOption = findOption(COUNTRY_OPTIONS, value);
  const emptyText = side === "zh" ? "未找到国家" : "No country found.";
  const searchPlaceholder = side === "zh" ? "搜索国家..." : "Search country...";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className="flex h-12 w-full items-center justify-between rounded-lg border border-[#e8e8e8] bg-transparent px-3 text-[15px] font-normal shadow-xs hover:bg-transparent focus:outline-none focus:ring-1 focus:ring-[#03346E] focus:border-[#03346E]"
      >
        {selectedOption ? (
          <div className="flex min-w-0 items-center gap-2 overflow-hidden">
            <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-full">
              <CircleFlag countryCode={selectedOption.code.toLowerCase()} height={20} />
            </span>
            <span className="overflow-hidden text-ellipsis whitespace-nowrap">
              {side === "zh" ? selectedOption.zh : selectedOption.en}
            </span>
          </div>
        ) : (
          <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
            <Globe className="h-4 w-4 shrink-0 text-gray-400" />
            <span className="overflow-hidden text-ellipsis whitespace-nowrap">{placeholder}</span>
          </div>
        )}
        <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
      </PopoverTrigger>
      <PopoverContent collisionPadding={10} side="bottom" className="min-w-[--radix-popper-anchor-width] p-0">
        <Command
          className="w-full"
          filter={(commandValue, search, keywords) => {
            const haystack = [commandValue, ...(keywords ?? [])].join(" ").toLowerCase();
            return haystack.includes(search.toLowerCase()) ? 1 : 0;
          }}
        >
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList className="max-h-[200px] sm:max-h-[270px]">
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {COUNTRY_OPTIONS.map((option) => (
                <CommandItem
                  className="flex w-full items-center gap-2 [&_svg]:size-auto"
                  key={`${side}-${option.code}`}
                  value={option.code}
                  keywords={[option.zh, option.en, option.code]}
                  onSelect={() => {
                    onChange(option.code);
                    setOpen(false);
                  }}
                >
                  <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-full">
                    <CircleFlag countryCode={option.code.toLowerCase()} height={20} />
                  </span>
                  <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                    {side === "zh" ? option.zh : option.en}
                  </span>
                  <span className="hidden shrink-0 text-xs text-gray-400 sm:inline">
                    {side === "zh" ? option.en : option.zh}
                  </span>
                  <CheckIcon
                    className={cn(
                      "ml-auto !h-4 !w-4 shrink-0",
                      selectedOption?.code === option.code ? "opacity-100" : "opacity-0",
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function BilingualDateControl({
  value,
  side,
  placeholder,
  onChange,
}: {
  value: string;
  side: Side;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedDate = value ? new Date(`${value}T00:00:00`) : undefined;
  const displayValue = side === "zh" ? formatChineseDate(value) : formatOfficialDate(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-12 w-full justify-start rounded-lg border-[#e8e8e8] bg-transparent text-left text-[15px] font-normal shadow-xs hover:bg-transparent focus:ring-1 focus:ring-[#03346E] focus:border-[#03346E]"
        >
          <CalendarDays className="mr-2 h-4 w-4 shrink-0 text-gray-400" />
          {displayValue || <span className="text-muted-foreground">{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          defaultMonth={selectedDate}
          onSelect={(date) => {
            if (!date) return;
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, "0");
            const day = String(date.getDate()).padStart(2, "0");
            onChange(`${year}-${month}-${day}`);
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

export function PersonalInfoStep({ prefill, onComplete }: PersonalInfoStepProps) {
  const t = useTranslations("applicationSteps");
  const [textValues, setTextValues] = useState<BilingualTextState>({
    surname: toInitialTextValue("surname", prefill?.surname),
    givenNames: toInitialTextValue("givenNames", prefill?.givenNames),
    fullNameNativeAlphabet: toInitialTextValue(
      "fullNameNativeAlphabet",
      prefill?.fullNameNativeAlphabet,
    ),
  });
  const [dateOfBirth, setDateOfBirth] = useState(prefill?.dateOfBirth ?? "");
  const [maritalStatus, setMaritalStatus] = useState(prefill?.maritalStatus ?? "");
  const [sex, setSex] = useState(prefill?.sex ?? "");
  const [nationalityCode, setNationalityCode] = useState(
    findOption(COUNTRY_OPTIONS, prefill?.nationality)?.code ?? "",
  );
  const [birthCountryCode, setBirthCountryCode] = useState(
    findOption(COUNTRY_OPTIONS, prefill?.countryOfBirth)?.code ?? "",
  );
  const [birthRegionCode, setBirthRegionCode] = useState(() =>
    getInitialRegionCode(
      findOption(COUNTRY_OPTIONS, prefill?.countryOfBirth)?.code ?? "",
      prefill?.stateOfBirth,
    ),
  );
  const [birthCityCode, setBirthCityCode] = useState(() =>
    getInitialCityCode(
      findOption(COUNTRY_OPTIONS, prefill?.countryOfBirth)?.code ?? "",
      getInitialRegionCode(
        findOption(COUNTRY_OPTIONS, prefill?.countryOfBirth)?.code ?? "",
        prefill?.stateOfBirth,
      ),
      prefill?.cityOfBirth,
    ),
  );

  const regionOptions = useMemo(() => getRegionOptions(birthCountryCode), [birthCountryCode]);
  const cityOptions = useMemo(
    () => getCityOptions(birthCountryCode, birthRegionCode),
    [birthCountryCode, birthRegionCode],
  );

  const updateText = (field: TextFieldKey, side: Side, value: string) => {
    setTextValues((current) => ({
      ...current,
      [field]:
        side === "zh"
          ? { zh: value, en: translateZhText(value) }
          : { zh: translateEnText(value), en: value },
    }));
  };

  const handleBirthCountryChange = (countryCode: string) => {
    const nextRegions = getRegionOptions(countryCode);
    const nextRegion = nextRegions[0];
    const nextCities = nextRegion ? getCityOptions(countryCode, nextRegion.code) : [];
    setBirthCountryCode(countryCode);
    setBirthRegionCode(nextRegion?.code ?? "");
    setBirthCityCode(nextCities[0]?.code ?? "");
  };

  const handleBirthRegionChange = (regionCode: string) => {
    const nextCities = getCityOptions(birthCountryCode, regionCode);
    setBirthRegionCode(regionCode);
    setBirthCityCode(nextCities[0]?.code ?? "");
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onComplete({
      surname: textValues.surname.en,
      givenNames: textValues.givenNames.en,
      fullNameNativeAlphabet: textValues.fullNameNativeAlphabet.zh,
      sex,
      maritalStatus,
      dateOfBirth,
      nationality: findOption(COUNTRY_OPTIONS, nationalityCode)?.en ?? "",
      countryOfBirth: findOption(COUNTRY_OPTIONS, birthCountryCode)?.en ?? "",
      stateOfBirth: findOption(regionOptions, birthRegionCode)?.en ?? "",
      cityOfBirth: findOption(cityOptions, birthCityCode)?.en ?? "",
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="overflow-hidden rounded-lg border border-[#dfe5ee] bg-white">
        <SectionHeader>个人信息</SectionHeader>
        <div className="divide-y divide-[#eef1f5]">
          <BilingualRow
            label={t("personalInfo.surname")}
            helper="左侧可填中文姓氏；右侧自动生成护照英文拼写。"
            badge="自动生成英文"
            zhControl={
              <TextControl
                side="zh"
                value={textValues.surname.zh}
                placeholder="如：李"
                required
                onChange={(value) => updateText("surname", "zh", value)}
              />
            }
            enControl={
              <TextControl
                side="en"
                value={textValues.surname.en}
                placeholder="e.g. LI"
                required
                onChange={(value) => updateText("surname", "en", value)}
              />
            }
          />
          <BilingualRow
            label={t("personalInfo.givenNames")}
            helper="多个名字请按护照顺序核对。"
            badge="自动生成英文"
            zhControl={
              <TextControl
                side="zh"
                value={textValues.givenNames.zh}
                placeholder="如：小明"
                required
                onChange={(value) => updateText("givenNames", "zh", value)}
              />
            }
            enControl={
              <TextControl
                side="en"
                value={textValues.givenNames.en}
                placeholder="e.g. XIAOMING"
                required
                onChange={(value) => updateText("givenNames", "en", value)}
              />
            }
          />
          <BilingualRow
            label={t("personalInfo.fullNameNative")}
            helper="中文姓名保留原文，英文侧用于核对罗马化。"
            badge="双向同步"
            zhControl={
              <TextControl
                side="zh"
                value={textValues.fullNameNativeAlphabet.zh}
                placeholder="如：李小明"
                onChange={(value) => updateText("fullNameNativeAlphabet", "zh", value)}
              />
            }
            enControl={
              <TextControl
                side="en"
                value={textValues.fullNameNativeAlphabet.en}
                placeholder="e.g. LI XIAOMING"
                onChange={(value) => updateText("fullNameNativeAlphabet", "en", value)}
              />
            }
          />
          <BilingualRow
            label={t("personalInfo.dateOfBirth")}
            helper="任意一侧选择日期，另一侧会同步显示中文日期或 DD/MM/YYYY。"
            badge="官方日期格式"
            zhControl={
              <BilingualDateControl
                side="zh"
                value={dateOfBirth}
                placeholder={t("personalInfo.dateOfBirthPlaceholder")}
                onChange={setDateOfBirth}
              />
            }
            enControl={
              <BilingualDateControl
                side="en"
                value={dateOfBirth}
                placeholder="Select date of birth"
                onChange={setDateOfBirth}
              />
            }
          />
          <BilingualRow
            label={t("personalInfo.maritalStatus")}
            helper="中英文都从同一组官方选项里选择。"
            badge="官方选项映射"
            zhControl={
              <OptionControl
                side="zh"
                value={maritalStatus}
                options={MARITAL_STATUS_OPTIONS}
                placeholder={t("select")}
                onChange={setMaritalStatus}
              />
            }
            enControl={
              <OptionControl
                side="en"
                value={maritalStatus}
                options={MARITAL_STATUS_OPTIONS}
                placeholder="Select..."
                onChange={setMaritalStatus}
              />
            }
          />
          <BilingualRow
            label={t("personalInfo.gender")}
            helper="按证件信息选择，左右两侧自动保持一致。"
            badge="官方选项映射"
            zhControl={
              <OptionControl
                side="zh"
                value={sex}
                options={GENDER_OPTIONS}
                placeholder={t("select")}
                onChange={setSex}
              />
            }
            enControl={
              <OptionControl
                side="en"
                value={sex}
                options={GENDER_OPTIONS}
                placeholder="Select..."
                onChange={setSex}
              />
            }
          />
          <BilingualRow
            label={t("personalInfo.nationality")}
            helper="国家名称左侧显示中文，右侧显示英文官方写法。"
            badge="国家选项映射"
            zhControl={
              <CountryOptionControl
                side="zh"
                value={nationalityCode}
                placeholder="选择国家..."
                onChange={setNationalityCode}
              />
            }
            enControl={
              <CountryOptionControl
                side="en"
                value={nationalityCode}
                placeholder="Select country..."
                onChange={setNationalityCode}
              />
            }
          />
        </div>

        <SectionHeader>出生信息</SectionHeader>
        <div className="divide-y divide-[#eef1f5]">
          <BilingualRow
            label={t("personalInfo.countryOfBirth")}
            helper="先选国家，再逐步缩小省 / 州和城市。"
            badge="级联下拉"
            zhControl={
              <CountryOptionControl
                side="zh"
                value={birthCountryCode}
                placeholder="选择出生国家..."
                onChange={handleBirthCountryChange}
              />
            }
            enControl={
              <CountryOptionControl
                side="en"
                value={birthCountryCode}
                placeholder="Select country of birth..."
                onChange={handleBirthCountryChange}
              />
            }
          />
          <BilingualRow
            label={t("personalInfo.stateOfBirth")}
            helper="根据所选国家显示对应省、州或地区。"
            badge="级联下拉"
            zhControl={
              <OptionControl
                side="zh"
                value={birthRegionCode}
                options={regionOptions}
                placeholder="选择省 / 州..."
                icon={<MapPin className="h-4 w-4" />}
                onChange={handleBirthRegionChange}
              />
            }
            enControl={
              <OptionControl
                side="en"
                value={birthRegionCode}
                options={regionOptions}
                placeholder="Select state / province..."
                icon={<MapPin className="h-4 w-4" />}
                onChange={handleBirthRegionChange}
              />
            }
          />
          <BilingualRow
            label={t("personalInfo.cityOfBirth")}
            helper="城市选项会根据国家和省 / 州继续缩小。"
            badge="级联下拉"
            zhControl={
              <OptionControl
                side="zh"
                value={birthCityCode}
                options={cityOptions}
                placeholder="选择出生城市..."
                icon={<MapPin className="h-4 w-4" />}
                onChange={setBirthCityCode}
              />
            }
            enControl={
              <OptionControl
                side="en"
                value={birthCityCode}
                options={cityOptions}
                placeholder="Select city of birth..."
                icon={<MapPin className="h-4 w-4" />}
                onChange={setBirthCityCode}
              />
            }
          />
        </div>
      </div>

      <BrandActionButton type="submit" className="mt-2">
        {t("continue")}
      </BrandActionButton>
    </form>
  );
}
