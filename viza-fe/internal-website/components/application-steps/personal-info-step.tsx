"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
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
import { cn } from "@/lib/utils";
import {
  BilingualFieldCopilot,
  getBilingualRowLabels,
  toCopilotOptions,
  type BilingualFieldCopilotConfig,
} from "./bilingual-form-shared";

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
  country?: string | null;
  prefill?: Partial<PersonalInfoData>;
  visaType?: string;
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

const CUSTOM_CITY_CODE = "__CUSTOM_CITY__";
const CUSTOM_CITY_OPTION: OptionPair = {
  code: CUSTOM_CITY_CODE,
  zh: "其他（自定义城市）",
  en: "Other (custom city)",
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

const COMMON_NAME_PINYIN: Record<string, string> = {
  ...DIRECT_TRANSLATIONS,
  安: "AN",
  博: "BO",
  晨: "CHEN",
  成: "CHENG",
  诚: "CHENG",
  丹: "DAN",
  东: "DONG",
  飞: "FEI",
  峰: "FENG",
  刚: "GANG",
  国: "GUO",
  海: "HAI",
  浩: "HAO",
  红: "HONG",
  华: "HUA",
  慧: "HUI",
  佳: "JIA",
  建: "JIAN",
  杰: "JIE",
  静: "JING",
  军: "JUN",
  凯: "KAI",
  琳: "LIN",
  林: "LIN",
  磊: "LEI",
  丽: "LI",
  明: "MING",
  宁: "NING",
  平: "PING",
  强: "QIANG",
  青: "QING",
  庆: "QING",
  瑞: "RUI",
  思: "SI",
  涛: "TAO",
  天: "TIAN",
  文: "WEN",
  霞: "XIA",
  晓: "XIAO",
  小: "XIAO",
  欣: "XIN",
  新: "XIN",
  雪: "XUE",
  雅: "YA",
  阳: "YANG",
  洋: "YANG",
  颖: "YING",
  勇: "YONG",
  宇: "YU",
  雨: "YU",
  玉: "YU",
  月: "YUE",
  泽: "ZE",
  志: "ZHI",
  中: "ZHONG",
  子: "ZI",
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

function withCustomCityOption(options: OptionPair[]): OptionPair[] {
  return [...options, CUSTOM_CITY_OPTION];
}

function toInitialCityTextValue(value?: string): BilingualTextValue {
  const city = value?.trim() ?? "";
  if (!city) return { zh: "", en: "" };
  if (/[\u3400-\u9fff]/.test(city)) {
    return { zh: city, en: translateZhText(city) };
  }
  return { zh: translateEnText(city), en: city };
}

function transliterateChineseName(value: string, separator = "") {
  const normalized = value.trim().replace(/\s+/g, "");
  if (!normalized || !/[\u3400-\u9fff]/.test(normalized)) return null;

  const syllables = Array.from(normalized).map((character) => COMMON_NAME_PINYIN[character]);
  if (syllables.some((syllable) => !syllable)) return null;
  return syllables.join(separator);
}

function translateZhText(value: string, mode: "freeform" | "name" = "freeform") {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const direct = DIRECT_TRANSLATIONS[trimmed];
  if (direct) return direct;

  if (mode === "name") {
    const pinyin = transliterateChineseName(trimmed);
    if (pinyin) return pinyin;
  }

  const syllables = Array.from(trimmed.replace(/\s+/g, "")).map((character) => DIRECT_TRANSLATIONS[character]);
  if (syllables.length > 0 && syllables.every(Boolean)) {
    return syllables.join(mode === "name" ? "" : " ");
  }

  if (/^[\dA-Za-z\s,.'#/-]+$/.test(trimmed)) {
    return trimmed;
  }

  return mode === "name" ? trimmed : `Please confirm official English: ${trimmed}`;
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
      en: translateZhText(officialValue, "name"),
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

function resolveCityEnglishValue(cityCode: string, options: OptionPair[], customCity: BilingualTextValue) {
  if (cityCode === CUSTOM_CITY_CODE) {
    return (customCity.en || customCity.zh).trim();
  }
  return findOption(options, cityCode)?.en ?? "";
}

function BilingualRow({
  label,
  zhControl,
  enControl,
  copilot,
}: {
  label: string;
  helper?: string;
  badge?: string;
  zhControl: ReactNode;
  enControl: ReactNode;
  copilot?: BilingualFieldCopilotConfig;
}) {
  const scopedCopilot = copilot
    ? {
        ...copilot,
        country: copilot.country ?? copilot.allAnswers.destination_country ?? null,
        visaType: copilot.visaType ?? copilot.allAnswers.visa_type ?? "unknown",
      }
    : undefined;
  const labels = getBilingualRowLabels(label, scopedCopilot?.label);
  const requiredMark = scopedCopilot?.required ? <span className="ml-1 text-red-500">*</span> : null;

  return (
    <div className="grid min-w-0 gap-4 px-0 py-4 sm:px-2 md:grid-cols-2">
      <div className="min-w-0">
        <span className="mb-2 block text-[15px] font-medium leading-tight text-[#1f2f46]">
          {labels.zh}
          {requiredMark}
        </span>
        {zhControl}
      </div>
      <div className="min-w-0">
        <span className="mb-2 block text-[15px] font-medium leading-tight text-[#1f2f46]">
          {labels.en}
          {requiredMark}
        </span>
        {enControl}
      </div>
      {scopedCopilot && (
        <div className="min-w-0 md:col-span-2" data-copilot-panel-frame={scopedCopilot.fieldName}>
          <BilingualFieldCopilot config={scopedCopilot} />
        </div>
      )}
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
  searchPlaceholder,
  emptyText,
  icon,
  onChange,
}: {
  value: string;
  side: Side;
  options: OptionPair[];
  placeholder: string;
  searchPlaceholder?: string;
  emptyText?: string;
  icon?: ReactNode;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedOption = findOption(options, value);
  const resolvedSearchPlaceholder = searchPlaceholder ?? (side === "zh" ? "搜索选项..." : "Search options...");
  const resolvedEmptyText = emptyText ?? (side === "zh" ? "未找到选项" : "No option found.");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        type="button"
        className="flex h-12 w-full items-center justify-between rounded-lg border border-[#e8e8e8] bg-transparent px-3 text-left text-[15px] font-normal shadow-xs hover:bg-transparent focus:outline-none focus:ring-1 focus:ring-[#03346E] focus:border-[#03346E]"
      >
        <div
          className={cn(
            "flex min-w-0 items-center gap-2",
            selectedOption ? "text-[#1f2f46]" : "text-muted-foreground",
          )}
        >
          {icon ? <span className="shrink-0 text-gray-400">{icon}</span> : null}
          <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
            {selectedOption ? (side === "zh" ? selectedOption.zh : selectedOption.en) : placeholder}
          </span>
        </div>
        <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
      </PopoverTrigger>
      <PopoverContent
        collisionPadding={10}
        side="bottom"
        align="start"
        className="min-w-[--radix-popper-anchor-width] p-0"
      >
        <Command
          className="w-full"
          filter={(commandValue, search, keywords) => {
            const normalizedSearch = search.trim().toLowerCase();
            if (!normalizedSearch) return 1;
            const haystack = [commandValue, ...(keywords ?? [])].join(" ").toLowerCase();
            return haystack.includes(normalizedSearch) ? 1 : 0;
          }}
        >
          <CommandInput placeholder={resolvedSearchPlaceholder} />
          <CommandList className="max-h-[200px] sm:max-h-[260px]">
            <CommandEmpty>{resolvedEmptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
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
                  {icon ? <span className="shrink-0 text-gray-400">{icon}</span> : null}
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

export function PersonalInfoStep({ country, prefill, visaType, onComplete }: PersonalInfoStepProps) {
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
  const [birthCityCode, setBirthCityCode] = useState("");
  const [customBirthCity, setCustomBirthCity] = useState(() =>
    toInitialCityTextValue(prefill?.cityOfBirth),
  );
  const [fetchedCityOptions, setFetchedCityOptions] = useState<OptionPair[]>([]);
  const [cityOptionsLoading, setCityOptionsLoading] = useState(false);
  const [cityOptionsError, setCityOptionsError] = useState<string | null>(null);

  const regionOptions = useMemo(() => getRegionOptions(birthCountryCode), [birthCountryCode]);
  const cityOptions = useMemo(() => withCustomCityOption(fetchedCityOptions), [fetchedCityOptions]);
  const cityValue = resolveCityEnglishValue(birthCityCode, cityOptions, customBirthCity);
  const cityOptionsForCopilot = useMemo(
    () => toCopilotOptions(cityOptions.slice(0, 80)),
    [cityOptions],
  );

  useEffect(() => {
    if (!birthCountryCode) {
      setFetchedCityOptions([]);
      setCityOptionsError(null);
      setCityOptionsLoading(false);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    const params = new URLSearchParams({ countryCode: birthCountryCode });
    if (birthRegionCode) params.set("regionCode", birthRegionCode);

    setCityOptionsLoading(true);
    setCityOptionsError(null);

    async function loadCityOptions() {
      try {
        const response = await fetch(`/api/application/locations/cities?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = (await response.json()) as {
          options?: OptionPair[];
          error?: string;
        };

        if (cancelled) return;
        if (!response.ok) {
          setFetchedCityOptions([]);
          setCityOptionsError(payload.error ?? "Unable to load cities.");
          return;
        }

        setFetchedCityOptions(payload.options ?? []);
      } catch (error: unknown) {
        if (cancelled) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        setFetchedCityOptions([]);
        setCityOptionsError(error instanceof Error ? error.message : "Unable to load cities.");
      } finally {
        if (!cancelled) setCityOptionsLoading(false);
      }
    }

    void loadCityOptions();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [birthCountryCode, birthRegionCode]);

  useEffect(() => {
    if (!prefill?.cityOfBirth || birthCityCode || cityOptionsLoading) return;

    const matchedPrefill = findOption(fetchedCityOptions, prefill.cityOfBirth);
    if (matchedPrefill) {
      setBirthCityCode(matchedPrefill.code);
      setCustomBirthCity({ zh: "", en: "" });
      return;
    }

    if (fetchedCityOptions.length > 0 || cityOptionsError) {
      setBirthCityCode(CUSTOM_CITY_CODE);
      setCustomBirthCity(toInitialCityTextValue(prefill.cityOfBirth));
    }
  }, [birthCityCode, cityOptionsError, cityOptionsLoading, fetchedCityOptions, prefill?.cityOfBirth]);

  const copilotAnswers = {
    destination_country: country ?? "",
    visa_type: visaType ?? "",
    surname: textValues.surname.en,
    given_names: textValues.givenNames.en,
    full_name_native_alphabet: textValues.fullNameNativeAlphabet.zh,
    date_of_birth: dateOfBirth,
    marital_status: maritalStatus,
    sex,
    nationality: findOption(COUNTRY_OPTIONS, nationalityCode)?.en ?? "",
    current_nationality: findOption(COUNTRY_OPTIONS, nationalityCode)?.en ?? "",
    country_of_birth: findOption(COUNTRY_OPTIONS, birthCountryCode)?.en ?? "",
    state_of_birth: findOption(regionOptions, birthRegionCode)?.en ?? "",
    city_of_birth: cityValue,
  };

  const updateText = (field: TextFieldKey, side: Side, value: string) => {
    setTextValues((current) => ({
      ...current,
      [field]:
        side === "zh"
          ? { zh: value, en: translateZhText(value, "name") }
          : { zh: translateEnText(value), en: value },
    }));
  };

  const handleBirthCountryChange = (countryCode: string) => {
    const nextRegions = getRegionOptions(countryCode);
    const nextRegion = nextRegions[0];
    setBirthCountryCode(countryCode);
    setBirthRegionCode(nextRegion?.code ?? "");
    setBirthCityCode("");
    setCustomBirthCity({ zh: "", en: "" });
  };

  const handleBirthRegionChange = (regionCode: string) => {
    setBirthRegionCode(regionCode);
    setBirthCityCode("");
    setCustomBirthCity({ zh: "", en: "" });
  };

  const updateCustomBirthCity = (side: Side, value: string) => {
    setBirthCityCode(CUSTOM_CITY_CODE);
    setCustomBirthCity(
      side === "zh"
        ? { zh: value, en: translateZhText(value) }
        : { zh: translateEnText(value), en: value },
    );
  };

  const handleBirthCityChange = (cityCode: string) => {
    setBirthCityCode(cityCode);
    if (cityCode !== CUSTOM_CITY_CODE) {
      setCustomBirthCity({ zh: "", en: "" });
    }
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
      cityOfBirth: cityValue,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="divide-y divide-[#eef1f5]">
          <BilingualRow
            label={t("personalInfo.surname")}
            helper="左侧可填中文姓氏；右侧自动生成护照英文拼写。"
            badge="自动生成英文"
            copilot={{
              fieldName: "surname",
              label: "Surname",
              fieldType: "text",
              value: textValues.surname.en,
              allAnswers: copilotAnswers,
              required: true,
              placeholder: "e.g. LI",
              validationRules: { maxLength: 50 },
            }}
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
            copilot={{
              fieldName: "given_names",
              label: "Given names",
              fieldType: "text",
              value: textValues.givenNames.en,
              allAnswers: copilotAnswers,
              required: true,
              placeholder: "e.g. XIAOMING",
              validationRules: { maxLength: 80 },
            }}
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
            copilot={{
              fieldName: "full_name_native_alphabet",
              label: "Full name in native alphabet",
              fieldType: "text",
              value: textValues.fullNameNativeAlphabet.zh,
              allAnswers: copilotAnswers,
              placeholder: "e.g. 李小明",
              validationRules: { maxLength: 120 },
            }}
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
            copilot={{
              fieldName: "date_of_birth",
              label: "Date of birth",
              fieldType: "date",
              value: dateOfBirth,
              allAnswers: copilotAnswers,
              required: true,
              validationRules: { format: "DD/MM/YYYY" },
            }}
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
            copilot={{
              fieldName: "marital_status",
              label: "Marital status",
              fieldType: "select",
              value: maritalStatus,
              allAnswers: copilotAnswers,
              required: true,
              options: toCopilotOptions(MARITAL_STATUS_OPTIONS),
              placeholder: "Select marital status",
            }}
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
            copilot={{
              fieldName: "sex",
              label: "Sex",
              fieldType: "select",
              value: sex,
              allAnswers: copilotAnswers,
              required: true,
              options: toCopilotOptions(GENDER_OPTIONS),
              placeholder: "Select sex",
            }}
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
            copilot={{
              fieldName: "nationality",
              label: "Nationality",
              fieldType: "country",
              value: findOption(COUNTRY_OPTIONS, nationalityCode)?.en ?? "",
              allAnswers: copilotAnswers,
              required: true,
              placeholder: "Select country",
            }}
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
          <BilingualRow
            label={t("personalInfo.countryOfBirth")}
            helper="先选国家，再逐步缩小省 / 州和城市。"
            badge="级联下拉"
            copilot={{
              fieldName: "country_of_birth",
              label: "Country of birth",
              fieldType: "country",
              value: findOption(COUNTRY_OPTIONS, birthCountryCode)?.en ?? "",
              allAnswers: copilotAnswers,
              required: true,
              placeholder: "Select country of birth",
            }}
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
            copilot={{
              fieldName: "state_of_birth",
              label: "State or province of birth",
              fieldType: "select",
              value: findOption(regionOptions, birthRegionCode)?.en ?? "",
              allAnswers: copilotAnswers,
              required: true,
              options: toCopilotOptions(regionOptions),
              placeholder: "Select state / province",
            }}
            zhControl={
              <OptionControl
                side="zh"
                value={birthRegionCode}
                options={regionOptions}
                placeholder="选择省 / 州..."
                searchPlaceholder="搜索省 / 州..."
                emptyText="未找到省 / 州"
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
                searchPlaceholder="Search state / province..."
                emptyText="No state or province found."
                icon={<MapPin className="h-4 w-4" />}
                onChange={handleBirthRegionChange}
              />
            }
          />
          <BilingualRow
            label={t("personalInfo.cityOfBirth")}
            helper="城市选项会根据国家和省 / 州继续缩小。"
            badge="级联下拉"
            copilot={{
              fieldName: "city_of_birth",
              label: "City of birth",
              fieldType: "select",
              value: cityValue,
              allAnswers: copilotAnswers,
              required: true,
              options: cityOptionsForCopilot,
              placeholder: "Select city of birth",
            }}
            zhControl={
              <div className="flex flex-col gap-2">
                <OptionControl
                  side="zh"
                  value={birthCityCode}
                  options={cityOptions}
                  placeholder={cityOptionsLoading ? "正在加载城市..." : "选择出生城市..."}
                  searchPlaceholder={cityOptionsLoading ? "城市正在加载..." : "搜索城市..."}
                  emptyText={cityOptionsLoading ? "城市正在加载..." : "未找到城市，可选择其他并手动填写"}
                  icon={<MapPin className="h-4 w-4" />}
                  onChange={handleBirthCityChange}
                />
                {birthCityCode === CUSTOM_CITY_CODE && (
                  <TextControl
                    side="zh"
                    value={customBirthCity.zh}
                    placeholder="如：衡阳"
                    onChange={(value) => updateCustomBirthCity("zh", value)}
                  />
                )}
                {cityOptionsError && (
                  <p className="text-[12px] leading-5 text-[#9a6b12]">
                    城市列表暂时加载失败，可选择其他并手动填写。
                  </p>
                )}
              </div>
            }
            enControl={
              <div className="flex flex-col gap-2">
                <OptionControl
                  side="en"
                  value={birthCityCode}
                  options={cityOptions}
                  placeholder={cityOptionsLoading ? "Loading cities..." : "Select city of birth..."}
                  searchPlaceholder={cityOptionsLoading ? "Loading cities..." : "Search city..."}
                  emptyText={cityOptionsLoading ? "Loading cities..." : "No city found. Choose Other and enter it manually."}
                  icon={<MapPin className="h-4 w-4" />}
                  onChange={handleBirthCityChange}
                />
                {birthCityCode === CUSTOM_CITY_CODE && (
                  <TextControl
                    side="en"
                    value={customBirthCity.en}
                    placeholder="e.g. Hengyang"
                    onChange={(value) => updateCustomBirthCity("en", value)}
                  />
                )}
                {cityOptionsError && (
                  <p className="text-[12px] leading-5 text-[#9a6b12]">
                    City list could not load. Choose Other and enter it manually.
                  </p>
                )}
              </div>
            }
          />
      </div>

      <BrandActionButton type="submit" className="mt-2">
        {t("continue")}
      </BrandActionButton>
    </form>
  );
}
