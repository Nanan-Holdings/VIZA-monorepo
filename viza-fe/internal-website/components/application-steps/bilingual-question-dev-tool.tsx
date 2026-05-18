"use client";

import { type ChangeEvent, useMemo, useState } from "react";
import { ArrowRightLeft, Languages } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type SourceLanguage = "idle" | "zh" | "en";

interface TranslationPair {
  zh: string;
  en: string;
}

const FIELD_PAIRS: TranslationPair[] = [
  { zh: "姓", en: "Surname" },
  { zh: "名", en: "Given name(s)" },
  { zh: "中文姓名", en: "Full name in native alphabet" },
  { zh: "出生日期", en: "Date of birth" },
  { zh: "婚姻状况", en: "Marital status" },
  { zh: "性别", en: "Gender" },
  { zh: "国籍", en: "Nationality" },
  { zh: "出生国家", en: "Country of birth" },
  { zh: "出生省 / 州", en: "State / province of birth" },
  { zh: "出生省/州", en: "State / province of birth" },
  { zh: "出生城市", en: "City of birth" },
  { zh: "护照号码", en: "Passport number" },
  { zh: "签发日期", en: "Issue date" },
  { zh: "有效期至", en: "Expiry date" },
  { zh: "入境口岸", en: "Port of entry" },
  { zh: "旅行目的", en: "Purpose of travel" },
  { zh: "住宿地址", en: "Accommodation address" },
  { zh: "宗教信仰", en: "Religion" },
  { zh: "联系电话", en: "Phone number" },
  { zh: "电子邮箱", en: "Email address" },
];

const ZH_TO_EN_REPLACEMENTS: TranslationPair[] = [
  { zh: "您是否曾经", en: "Have you ever" },
  { zh: "您是否有", en: "Do you have" },
  { zh: "您是否为", en: "Are you" },
  { zh: "您是否", en: "Do you" },
  { zh: "是否", en: "whether" },
  { zh: "请输入", en: "Please enter" },
  { zh: "请选择", en: "Please select" },
  { zh: "选择", en: "Select" },
  { zh: "护照上的", en: "as shown on your passport" },
  { zh: "与护照一致", en: "matching your passport" },
  { zh: "出生", en: "birth" },
  { zh: "国家", en: "country" },
  { zh: "省", en: "province" },
  { zh: "州", en: "state" },
  { zh: "城市", en: "city" },
  { zh: "日期", en: "date" },
  { zh: "姓名", en: "name" },
  { zh: "地址", en: "address" },
  { zh: "号码", en: "number" },
];

const EN_TO_ZH_REPLACEMENTS: TranslationPair[] = [
  { zh: "您是否曾经", en: "Have you ever" },
  { zh: "您是否有", en: "Do you have" },
  { zh: "您是否为", en: "Are you" },
  { zh: "您是否", en: "Do you" },
  { zh: "请输入", en: "Please enter" },
  { zh: "请选择", en: "Please select" },
  { zh: "选择", en: "Select" },
  { zh: "护照上的", en: "as shown on your passport" },
  { zh: "与护照一致", en: "matching your passport" },
  { zh: "出生", en: "birth" },
  { zh: "国家", en: "country" },
  { zh: "省 / 州", en: "state / province" },
  { zh: "省 / 州", en: "province / state" },
  { zh: "城市", en: "city" },
  { zh: "日期", en: "date" },
  { zh: "姓名", en: "name" },
  { zh: "地址", en: "address" },
  { zh: "号码", en: "number" },
];

function normalizeKey(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function containsChinese(value: string) {
  return /[\u3400-\u9fff]/.test(value);
}

function replaceAllInsensitive(value: string, search: string, replacement: string) {
  return value.replace(new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), replacement);
}

function translateZhToEn(value: string, exactMap: Map<string, string>) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const exact = exactMap.get(normalizeKey(trimmed));
  if (exact) return exact;

  let translated = trimmed;
  let changed = false;

  for (const pair of FIELD_PAIRS) {
    if (translated.includes(pair.zh)) {
      translated = translated.replaceAll(pair.zh, pair.en);
      changed = true;
    }
  }

  for (const pair of ZH_TO_EN_REPLACEMENTS) {
    if (translated.includes(pair.zh)) {
      translated = translated.replaceAll(pair.zh, pair.en);
      changed = true;
    }
  }

  if (!changed || containsChinese(translated)) {
    return `Please confirm official English: ${trimmed}`;
  }

  return translated;
}

function translateEnToZh(value: string, exactMap: Map<string, string>) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const exact = exactMap.get(normalizeKey(trimmed));
  if (exact) return exact;

  let translated = trimmed;
  let changed = false;

  for (const pair of FIELD_PAIRS) {
    if (normalizeKey(translated).includes(normalizeKey(pair.en))) {
      translated = replaceAllInsensitive(translated, pair.en, pair.zh);
      changed = true;
    }
  }

  for (const pair of EN_TO_ZH_REPLACEMENTS) {
    if (normalizeKey(translated).includes(normalizeKey(pair.en))) {
      translated = replaceAllInsensitive(translated, pair.en, pair.zh);
      changed = true;
    }
  }

  if (!changed || !containsChinese(translated)) {
    return `请确认中文问题：${trimmed}`;
  }

  return translated;
}

export function BilingualQuestionDevTool() {
  const [zhQuestion, setZhQuestion] = useState("出生国家");
  const [enQuestion, setEnQuestion] = useState("Country of birth");
  const [sourceLanguage, setSourceLanguage] = useState<SourceLanguage>("idle");

  const { zhToEnMap, enToZhMap } = useMemo(() => {
    return {
      zhToEnMap: new Map(FIELD_PAIRS.map((pair) => [normalizeKey(pair.zh), pair.en])),
      enToZhMap: new Map(FIELD_PAIRS.map((pair) => [normalizeKey(pair.en), pair.zh])),
    };
  }, []);

  const handleZhChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const nextValue = event.target.value;
    setZhQuestion(nextValue);
    setEnQuestion(translateZhToEn(nextValue, zhToEnMap));
    setSourceLanguage("zh");
  };

  const handleEnChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const nextValue = event.target.value;
    setEnQuestion(nextValue);
    setZhQuestion(translateEnToZh(nextValue, enToZhMap));
    setSourceLanguage("en");
  };

  return (
    <section className="mb-6 rounded-xl border border-[#efefef] bg-white p-4 shadow-[0_2px_12px_rgba(3,52,110,0.04)] sm:p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#eef5ff] text-[#03346E]">
            <Languages className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-[15px] font-semibold leading-6 text-[#03346E]">开发：双语问题生成器</h3>
            <p className="mt-0.5 text-[13px] leading-5 text-gray-500">
              输入中文或英文问题，另一侧会自动生成，方便快速确认字段文案。
            </p>
          </div>
        </div>
        <Badge
          variant="static"
          className={cn(
            "w-fit rounded-full px-3 py-1 text-[12px] font-medium",
            sourceLanguage === "en" ? "bg-[#f1f8f4] text-[#166534]" : "bg-[#eef5ff] text-[#03346E]",
          )}
        >
          {sourceLanguage === "en" ? "由英文生成中文" : sourceLanguage === "zh" ? "由中文生成英文" : "本地开发辅助"}
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-start">
        <label className="flex flex-col gap-2">
          <span className="text-[13px] font-medium text-gray-700">中文问题</span>
          <Textarea
            aria-label="中文问题"
            value={zhQuestion}
            onChange={handleZhChange}
            placeholder="例如：出生国家"
            className="min-h-[84px] resize-none rounded-lg border-[#e8e8e8] bg-white text-[15px] leading-6 shadow-none focus-visible:border-[#03346E] focus-visible:ring-[#03346E]"
          />
        </label>

        <div className="hidden pt-9 text-gray-300 lg:block">
          <ArrowRightLeft className="h-5 w-5" />
        </div>

        <label className="flex flex-col gap-2">
          <span className="text-[13px] font-medium text-gray-700">English question</span>
          <Textarea
            aria-label="英文问题"
            value={enQuestion}
            onChange={handleEnChange}
            placeholder="e.g. Country of birth"
            className="min-h-[84px] resize-none rounded-lg border-[#e8e8e8] bg-white text-[15px] leading-6 shadow-none focus-visible:border-[#03346E] focus-visible:ring-[#03346E]"
          />
        </label>
      </div>
    </section>
  );
}
