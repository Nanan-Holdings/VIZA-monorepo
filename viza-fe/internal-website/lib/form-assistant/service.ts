import "server-only";

import { createHash, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { evaluateShowIf } from "@/lib/form-utils";
import { getMissingDynamicFormFields } from "@/lib/application-tab-completion";
import type { MissingApplicationField } from "@/lib/application-tab-completion";
import type { VisaFormFieldOption, VisaFormFieldRow, WizardStep } from "@/types/visa-form-fields";
import type {
  FormAssistantAppliedPatch,
  FormAssistantMessage,
  FormAssistantSource,
  FormAssistantState,
  FormAssistantTurnResponse,
} from "@/types/form-assistant";
import { SGAC_ICA_SOURCES } from "./constants";
import { getAssistantProgress } from "./validator";

const FORM_ASSISTANT_MODEL =
  process.env.OPENAI_FORM_ASSISTANT_MODEL ??
  process.env.OPENAI_CHAT_MODEL ??
  process.env.OPENAI_MODEL ??
  "gpt-5.5";
const MAX_MESSAGE_LENGTH = 4_000;

type SessionRow = {
  id: string;
  schema_fingerprint: string;
  knowledge_release_key: string | null;
  state_json: Record<string, unknown> | null;
};

type ProposedPatch = {
  fieldName: string;
  value: string;
  confidence: "high" | "medium" | "low";
  modelSource?: string;
};

const PRODUCT_TIME_ZONES: Record<string, string> = {
  SG_ARRIVAL_CARD: "Asia/Singapore",
};

export function parseDirectYesNoAnswer(
  text: string,
  field: VisaFormFieldRow | undefined,
): ProposedPatch | null {
  if (!field?.options?.length) return null;
  const optionByNormalizedValue = new Map(
    field.options.map((option) => [optionValue(option).trim().toLowerCase(), optionValue(option)]),
  );
  const yesValue = optionByNormalizedValue.get("yes");
  const noValue = optionByNormalizedValue.get("no");
  if (!yesValue || !noValue) return null;

  const normalized = text
    .trim()
    .toLowerCase()
    .replace(/[。！？!?，,；;：:\s]/g, "");
  const negativeAnswers = new Set([
    "没有",
    "都没有",
    "没",
    "无",
    "否",
    "不是",
    "不",
    "没有去过",
    "未去过",
    "从未",
    "no",
    "nope",
    "none",
    "never",
    "not",
  ]);
  const positiveAnswers = new Set([
    "有",
    "是",
    "是的",
    "有的",
    "去过",
    "到访过",
    "yes",
    "yep",
    "yeah",
    "对",
    "对的",
    "正确",
    "correct",
  ]);
  const exactValue = negativeAnswers.has(normalized)
    ? noValue
    : positiveAnswers.has(normalized)
      ? yesValue
      : null;
  if (exactValue) {
    return { fieldName: field.fieldName, value: exactValue, confidence: "high" };
  }

  const readable = text.trim().toLocaleLowerCase();
  if (
    /不确定|不清楚|不知道|记不清|可能|也许|说不准|not\s+sure|unsure|don['’]?t\s+know|maybe/.test(readable) ||
    /不是\s*(?:没有|没)|并非\s*(?:没有|没)|not\s+(?:never|no\b)/.test(readable)
  ) return null;

  const beginsWithDirectAnswer =
    /^(?:(?:嗯|好的|好)[,，\s]*)?(?:没有|没|无|否|不是|不|有|是|对)(?:的)?(?:[,，。；;\s]|$)/.test(readable) ||
    /^(?:yes|no|nope|yep|yeah|never|none|correct)(?:[,.;:\s]|$)/.test(readable);
  const isHealthField = field.fieldName === "has_health_symptoms";
  const isVisitField = field.fieldName.includes("visit_history");
  const isDifferentNameField = field.fieldName === "has_used_different_name_to_enter_singapore";
  const mentionsCurrentField =
    (isHealthField && /发热|咳嗽|呼吸|头痛|呕吐|头晕|皮疹|症状|不适|fever|cough|breath|headache|vomit|dizz|rash|symptom/.test(readable)) ||
    (isVisitField && /去过|到访|访问|国家|地区|黄热病|visit|been|country|place|region|yellow\s+fever/.test(readable)) ||
    (isDifferentNameField && /姓名|名字|护照|name|passport/.test(readable));
  if (!beginsWithDirectAnswer && !mentionsCurrentField) return null;

  const hasNegativeSignal =
    /没有|没(?!有)|未曾?|从未|不曾|并无|不是|并非|无(?:任何|这些|上述)?|(^|[\s，,。；;])否([\s，,。；;]|$)/.test(readable) ||
    /\b(?:no|nope|none|never|not|without)\b|(?:have|has|had|do|does|did|was|were|am|is|are)n['’]?t\b/.test(readable);
  const affirmativeRemainder = readable
    .replace(/没有去过|没去过|未曾?去过|从未去过|不曾去过|没有到访过|没到访过|未曾?到访过|从未到访过|不曾到访过/g, "")
    .replace(/没有|没(?!有)|未曾?|从未|不曾|并无|不是|并非|无(?:任何|这些|上述)?/g, "")
    .replace(/\b(?:have|has|had)\s+never\s+(?:visited|visit|been|gone|go)\b/g, "")
    .replace(/\b(?:have|has|had)\s+not\s+(?:visited|visit|been|gone|go|had|experienced)\b/g, "")
    .replace(/\b(?:do|does|did)\s+not\s+(?:have|visit|go|feel)\b/g, "")
    .replace(/\b(?:am|is|are|was|were)\s+not\s+\w+\b/g, "")
    .replace(/\b(?:no|nope|none|never|not|without)\b|(?:have|has|had|do|does|did|was|were|am|is|are)n['’]?t\b/g, "");
  const hasHealthPositiveSignal = isHealthField && (
    /有(?:一点|一些)?(?:这些|上述|发热|咳嗽|症状|不适)/.test(affirmativeRemainder) ||
    /\b(?:i|we)\s+(?:have|have\s+got|am\s+experiencing|are\s+experiencing)\s+(?:a\s+)?(?:fever|cough|rash|headache|symptoms?)\b/.test(affirmativeRemainder)
  );
  const hasPositiveSignal =
    /去过|到访过|有的|(^|[\s，,。；;])是([\s，,。；;]|$)/.test(affirmativeRemainder) ||
    /\b(?:yes|yep|yeah|correct)\b|\b(?:have|has|had|did)\s+(?:visited|visit|been|gone|go)\b/.test(affirmativeRemainder) ||
    hasHealthPositiveSignal;

  if (hasNegativeSignal === hasPositiveSignal) return null;
  return {
    fieldName: field.fieldName,
    value: hasNegativeSignal ? noValue : yesValue,
    confidence: "high",
  };
}

async function loadApplicationKnowledge(params: {
  admin: SupabaseClient;
  releaseKey: string | null;
  country: string;
  visaType: string;
}): Promise<{ context: string; sources: FormAssistantSource[] }> {
  if (!params.releaseKey) return { context: "", sources: SGAC_ICA_SOURCES };
  const { data: release } = await params.admin
    .from("visa_knowledge_releases")
    .select("id")
    .eq("release_key", params.releaseKey)
    .eq("status", "active")
    .maybeSingle();
  if (!release) return { context: "", sources: SGAC_ICA_SOURCES };
  const { data: documents } = await params.admin
    .from("visa_documents")
    .select("id, title, source_url")
    .eq("release_id", release.id)
    .ilike("country", params.country)
    .ilike("visa_type", params.visaType)
    .limit(5);
  const documentIds = (documents ?? []).map((document) => document.id);
  if (documentIds.length === 0) return { context: "", sources: SGAC_ICA_SOURCES };
  const { data: chunks } = await params.admin
    .from("visa_chunks")
    .select("content, document_type")
    .in("document_id", documentIds)
    .in("document_type", ["form_requirements", "requirements", "process", "faq"])
    .limit(8);
  const sources = (documents ?? [])
    .map((document) => ({ title: document.title || "Official source", url: document.source_url ?? null }))
    .filter((source, index, list) => list.findIndex((item) => item.url === source.url && item.title === source.title) === index);
  return {
    context: (chunks ?? []).map((chunk) => chunk.content.slice(0, 900)).join("\n\n"),
    sources: sources.length > 0 ? sources : SGAC_ICA_SOURCES,
  };
}

function optionValue(option: VisaFormFieldOption): string {
  return typeof option === "string" ? option : option.value;
}

const FIELD_OPTION_ALIASES: Record<string, Record<string, string[]>> = {
  mode_of_travel: {
    air: ["飞机", "航班", "坐飞机", "乘飞机", "搭飞机", "plane", "airplane", "flight", "fly", "flying"],
    land: ["巴士", "公交", "汽车", "开车", "火车", "铁路", "摩托车", "bus", "car", "train", "drive", "driving", "road"],
    sea: ["坐船", "乘船", "搭船", "船舶", "渡轮", "邮轮", "游轮", "boat", "ship", "ferry", "cruise", "sail"],
  },
  air_transport_type: {
    commercial: ["民航", "普通航班", "民用航班", "定期航班", "regular flight", "airline flight"],
    private: ["私人飞机", "包机", "货运航班", "private jet", "charter flight", "cargo flight"],
  },
  land_transport_type: {
    bus: ["公交车", "大巴", "巴士", "coach"],
    car: ["小汽车", "轿车", "自驾", "开车", "automobile", "drive", "driving"],
    lorry: ["卡车", "货车", "truck"],
    motorcycle: ["摩托", "摩托车", "motorbike", "motorcycle"],
    rail: ["火车", "铁路", "列车", "train", "railway"],
    van: ["面包车", "厢式车", "minivan"],
  },
  sea_transport_type: {
    cruise: ["游轮", "邮轮", "cruise ship"],
    commercial_vessel: ["商船", "货轮", "商业船舶", "cargo vessel", "merchant ship"],
    ferry: ["渡轮", "轮渡"],
    private_craft: ["私人游艇", "私人船只", "游艇", "yacht"],
  },
  accommodation_type: {
    hotel: ["酒店", "宾馆", "旅馆", "hotel", "hostel"],
    residential: ["住宅", "朋友家", "亲戚家", "自宅", "residence", "friend's home", "relative's home"],
  },
  purpose_of_travel: {
    "1-day transit/visa free transit facility (vftf)": ["一日过境", "免签过境", "transit"],
    "business/meeting/conference/convention/exhibition": ["商务", "出差", "开会", "参展", "business trip"],
    "education/training": ["留学", "学习", "培训", "study"],
    employment: ["工作", "就业", "上班", "work"],
    "holiday/sightseeing/leisure": ["旅游", "度假", "观光", "休闲", "holiday", "vacation", "tourism", "sightseeing"],
    "medical care": ["看病", "就医", "医疗", "medical treatment"],
    "official/government visit": ["公务访问", "政府访问", "official visit"],
    religion: ["宗教", "religious visit"],
    "sports event": ["体育赛事", "比赛", "sporting event"],
    "to take up residence": ["定居", "居住", "take up residence"],
    "visiting friends/relatives": ["探亲", "访友", "看望亲友", "visit family", "visiting family", "visit friends", "visiting friends"],
  },
};

const LOCATION_FIELD_NAMES = new Set([
  "place_of_residence",
  "last_city_or_port_before_singapore",
  "next_city_or_port_after_singapore",
]);

const LOCATION_OPTION_ALIASES: Record<string, string[]> = {
  "HONG KONG SAR, HONG KONG SAR, HONG KONG SAR": ["香港", "Hong Kong"],
};

function optionAliases(option: VisaFormFieldOption, fieldName?: string): string[] {
  const values = typeof option === "string"
    ? [option]
    : [
        option.value,
        option.text,
        option.label_zh,
        option.label_en,
        option.official_label,
        option.searchText,
        option.code,
        option.airport,
      ];
  const aliases = values.filter(
    (value): value is string => typeof value === "string" && value.trim().length > 0,
  );
  const segments = aliases.flatMap((value) => {
    const hierarchy = value.split(/[,，|]/).map((segment) => segment.trim()).filter(Boolean);
    return hierarchy.length > 1 ? [hierarchy.at(-1)!] : [];
  });
  const fieldAliases = fieldName
    ? FIELD_OPTION_ALIASES[fieldName]?.[optionValue(option).toLocaleLowerCase()] ?? []
    : [];
  const locationAliases = fieldName && LOCATION_FIELD_NAMES.has(fieldName)
    ? LOCATION_OPTION_ALIASES[optionValue(option).toLocaleUpperCase()] ?? []
    : [];
  return Array.from(new Set([...aliases, ...segments, ...fieldAliases, ...locationAliases]));
}

function normalizedNaturalLanguageValue(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase()
    .replace(/[。！？!?，,；;：:'"“”‘’()（）\s/_-]/g, "");
}

function naturalLanguageContainsAlias(text: string, alias: string): boolean {
  const normalizedAlias = normalizedNaturalLanguageValue(alias);
  if (!normalizedAlias) return false;
  if (/\p{Script=Han}/u.test(alias)) {
    return normalizedAlias.length >= 2 && normalizedNaturalLanguageValue(text).includes(normalizedAlias);
  }
  const words = (value: string) => value
    .toLocaleLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim();
  const textWords = words(text);
  const aliasWords = words(alias);
  return aliasWords.length >= 3 && ` ${textWords} `.includes(` ${aliasWords} `);
}

function matchingOptionsForAnswer(
  text: string,
  options: VisaFormFieldOption[],
  fieldName?: string,
): VisaFormFieldOption[] {
  const normalized = normalizedNaturalLanguageValue(text);
  const exactMatches = options.filter((option) =>
    optionAliases(option, fieldName).some((alias) => normalizedNaturalLanguageValue(alias) === normalized),
  );
  if (exactMatches.length > 0) return exactMatches;
  return options.filter((option) =>
    optionAliases(option, fieldName).some((alias) => naturalLanguageContainsAlias(text, alias)),
  );
}

function relevantOptionsForMessage(
  options: VisaFormFieldOption[],
  message: string,
  limit = 250,
  fieldName?: string,
): VisaFormFieldOption[] {
  const mentioned = matchingOptionsForAnswer(message, options, fieldName);
  if (mentioned.length === 0) return options.slice(0, limit);
  const mentionedValues = new Set(mentioned.map(optionValue));
  return [
    ...mentioned,
    ...options.filter((option) => !mentionedValues.has(optionValue(option))),
  ].slice(0, limit);
}

function isoDateInTimeZone(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function addIsoDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const shifted = new Date(Date.UTC(year!, month! - 1, day! + days));
  return shifted.toISOString().slice(0, 10);
}

function parseRelativeDateAnswer(text: string, now: Date, timeZone: string): string | null {
  const normalized = text.trim().toLocaleLowerCase();
  const offsets: number[] = [];
  const remaining = normalized
    .replace(/大后天/g, () => { offsets.push(3); return " "; })
    .replace(/后天|\bday\s+after\s+tomorrow\b/g, () => { offsets.push(2); return " "; })
    .replace(/明天|\btomorrow\b/g, () => { offsets.push(1); return " "; })
    .replace(/今天|\btoday\b/g, () => { offsets.push(0); return " "; })
    .replace(/(?:再\s*)?(?:过\s*)?(\d{1,3})\s*天后|(?:再\s*过\s*|再\s*|过\s*)(\d{1,3})\s*天|in\s+(\d{1,3})\s+days?/g, (_match, zhDaysAfter, zhDaysPrefix, enDays) => {
      offsets.push(Number(zhDaysAfter ?? zhDaysPrefix ?? enDays));
      return " ";
    });
  if (offsets.length > 0) {
    const uniqueOffsets = Array.from(new Set(offsets));
    if (
      uniqueOffsets.length !== 1 ||
      /不是|不要|不|\bnot\b|\bish\b|大概|左右|也许|可能|\bmaybe\b|\bapproximately\b|\baround\b/.test(remaining)
    ) return null;
    return addIsoDays(isoDateInTimeZone(now, timeZone), uniqueOffsets[0]!);
  }

  const referenceDate = isoDateInTimeZone(now, timeZone);
  const monthDay = normalized.match(/(?<![A-Za-z0-9])(\d{1,2})\s*月\s*(\d{1,2})\s*(?:日|号)(?![A-Za-z0-9])/);
  if (monthDay) {
    const year = Number(referenceDate.slice(0, 4));
    const month = Number(monthDay[1]);
    const day = Number(monthDay[2]);
    const candidate = new Date(Date.UTC(year, month - 1, day));
    if (
      candidate.getUTCFullYear() === year &&
      candidate.getUTCMonth() === month - 1 &&
      candidate.getUTCDate() === day
    ) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
    return null;
  }

  const explicit = normalized.match(/(?<![A-Za-z0-9])(\d{4})\s*(?:年|[-/.])\s*(\d{1,2})\s*(?:月|[-/.])\s*(\d{1,2})\s*(?:日|号)?(?![A-Za-z0-9])/);
  const englishMonths: Record<string, number> = {
    january: 1, jan: 1, february: 2, feb: 2, march: 3, mar: 3,
    april: 4, apr: 4, may: 5, june: 6, jun: 6, july: 7, jul: 7,
    august: 8, aug: 8, september: 9, sep: 9, sept: 9,
    october: 10, oct: 10, november: 11, nov: 11, december: 12, dec: 12,
  };
  const monthFirst = normalized.match(/\b([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,\s*|\s+)(\d{4})\b/);
  const dayFirst = normalized.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)(?:,\s*|\s+)(\d{4})\b/);
  const englishMonth = monthFirst ? englishMonths[monthFirst[1]!] : dayFirst ? englishMonths[dayFirst[2]!] : undefined;
  if (!explicit && !englishMonth) return null;
  const year = explicit ? Number(explicit[1]) : Number(monthFirst?.[3] ?? dayFirst?.[3]);
  const month = explicit ? Number(explicit[2]) : englishMonth!;
  const day = explicit ? Number(explicit[3]) : Number(monthFirst?.[2] ?? dayFirst?.[1]);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseDirectCurrentFieldAnswer(
  text: string,
  field: VisaFormFieldRow | undefined,
  options: { now?: Date; timeZone?: string } = {},
): ProposedPatch | null {
  if (!field) return null;
  const yesNo = parseDirectYesNoAnswer(text, field);
  if (yesNo) return { ...yesNo, modelSource: "deterministic" };

  if (field.fieldType === "date") {
    const value = parseRelativeDateAnswer(
      text,
      options.now ?? new Date(),
      options.timeZone ?? "UTC",
    );
    return value
      ? { fieldName: field.fieldName, value, confidence: "high", modelSource: "deterministic" }
      : null;
  }

  if (field.options?.length) {
    const matches = matchingOptionsForAnswer(text, field.options, field.fieldName);
    if (matches.length === 1) {
      return {
        fieldName: field.fieldName,
        value: optionValue(matches[0]!),
        confidence: "high",
        modelSource: "deterministic",
      };
    }
  }
  return null;
}

const FRIENDLY_FIELD_QUESTIONS: Record<string, { zh: string; en: string }> = {
  full_name: {
    zh: "先确认一下，你护照上的英文全名是什么？请按护照原样告诉我。",
    en: "First, what is your full name exactly as it appears in your passport?",
  },
  passport_number: {
    zh: "请告诉我你的护照号码。发送前可以再核对一下字母和数字。",
    en: "What is your passport number? Please double-check the letters and numbers before sending it.",
  },
  passport_expiry_date: {
    zh: "你的护照有效期到哪一天？可以直接按护照上的日期回答。",
    en: "When does your passport expire? You can give me the date shown in your passport.",
  },
  sex: {
    zh: "护照上登记的性别是什么？",
    en: "What sex is shown in your passport?",
  },
  date_of_birth: {
    zh: "你的出生日期是哪一天？请按护照上的日期回答。",
    en: "What is your date of birth as shown in your passport?",
  },
  nationality: {
    zh: "你的国籍或公民身份是什么？",
    en: "What is your nationality or citizenship?",
  },
  place_of_birth_country: {
    zh: "你出生在哪个国家或地区？",
    en: "Which country or region were you born in?",
  },
  place_of_residence: {
    zh: "你现在长期居住在哪个城市？直接告诉我城市名称就可以。",
    en: "Which city do you currently live in? Just tell me the city name.",
  },
  email_address: {
    zh: "你希望用哪个邮箱接收入境卡相关通知？",
    en: "Which email address would you like to use for arrival-card notifications?",
  },
  mobile_country_code: {
    zh: "你的手机国家或地区代码是多少？例如中国大陆是 86。",
    en: "What is your mobile country or region code? For example, China is 86.",
  },
  mobile_number: {
    zh: "你的手机号码是多少？这里不用重复填写国家或地区代码。",
    en: "What is your mobile number? You do not need to repeat the country or region code.",
  },
  has_used_different_name_to_enter_singapore: {
    zh: "想确认一下，你以前是否用过不同姓名的护照入境新加坡？回答“是”或“否”就可以。",
    en: "Have you ever entered Singapore with a passport under a different name? A simple yes or no is fine.",
  },
  has_health_symptoms: {
    zh: "为了完成健康申报，想确认你现在是否有发热、咳嗽、呼吸急促、头痛、呕吐、头晕或皮疹？如果都没有，直接说“都没有”就好。",
    en: "For the health declaration, do you currently have fever, cough, shortness of breath, headache, vomiting, dizziness, or a rash? If none apply, just say “none”.",
  },
  recent_country_visit_history: {
    zh: "抵达前 6 天内，你去过黄热病风险国家或地区吗？如果没有，直接说“没有”就可以。",
    en: "In the 6 days before arrival, did you visit a country or region with yellow-fever risk? If not, just say “no”.",
  },
  recent_high_risk_region_visit_history: {
    zh: "抵达新加坡前 21 天内，你去过孟加拉国、印度、非洲、中东或拉丁美洲吗？",
    en: "In the 21 days before arriving in Singapore, did you visit Bangladesh, India, Africa, the Middle East, or Latin America?",
  },
  arrival_date: {
    zh: "你计划哪一天抵达新加坡？可以回答具体日期，也可以说“明天”或“后天”。",
    en: "What day will you arrive in Singapore? You can give a date or say “tomorrow” or “the day after tomorrow”.",
  },
  departure_date: {
    zh: "你计划哪一天离开新加坡？",
    en: "What day will you leave Singapore?",
  },
  last_city_or_port_before_singapore: {
    zh: "你抵达新加坡前，最后从哪个城市或港口出发？直接告诉我名称就可以，比如“长沙”。",
    en: "Which city or port will you depart from immediately before arriving in Singapore? Just give me the name, for example “Changsha”.",
  },
  purpose_of_travel: {
    zh: "这次去新加坡主要是为了什么？比如旅游、商务或探亲。",
    en: "What is the main purpose of your trip to Singapore—for example, a holiday, business, or visiting family?",
  },
  mode_of_travel: {
    zh: "你准备通过什么交通方式前往新加坡？是航空、陆路还是海路？",
    en: "How will you travel to Singapore—by air, land, or sea?",
  },
  air_transport_type: {
    zh: "你乘坐的是商业航班，还是私人、货运或其他类型的飞机？",
    en: "Will you arrive on a commercial flight, or by private, cargo, or another type of aircraft?",
  },
  carrier_code: {
    zh: "你乘坐哪家航空公司的航班？告诉我航空公司名称或代码都可以。",
    en: "Which airline are you flying with? You can give me its name or code.",
  },
  transport_number: {
    zh: "你的航班号是多少？例如 CA975。",
    en: "What is your flight number? For example, CA975.",
  },
  carrier_name: {
    zh: "请告诉我承运人名称和航班号（如有）。",
    en: "Please tell me the carrier name and flight number, if available.",
  },
  land_transport_type: {
    zh: "你会乘坐哪种陆路交通工具？比如巴士、汽车、火车或摩托车。",
    en: "Which type of land transport will you use—for example, a bus, car, train, or motorcycle?",
  },
  vehicle_number: {
    zh: "这辆车的车牌号或车辆号码是什么？",
    en: "What is the vehicle or registration number?",
  },
  sea_transport_type: {
    zh: "你会乘坐哪种海上交通工具？比如邮轮、渡轮或其他船只。",
    en: "Which type of sea transport will you use—for example, a cruise, ferry, or another vessel?",
  },
  cruise_name: {
    zh: "你乘坐的邮轮叫什么名字？",
    en: "What is the name of your cruise ship?",
  },
  vessel_name: {
    zh: "你乘坐的船只叫什么名字？",
    en: "What is the name of the vessel you will travel on?",
  },
  accommodation_type: {
    zh: "你在新加坡会住在哪里？是酒店、住宅，还是其他安排？",
    en: "Where will you stay in Singapore—in a hotel, a residence, or somewhere else?",
  },
  accommodation_name: {
    zh: "你会入住哪家酒店？告诉我酒店名称就可以。",
    en: "Which hotel will you stay at? Just give me the hotel name.",
  },
  accommodation_other_type: {
    zh: "你的住宿安排属于一日游还是过境？",
    en: "Is your arrangement a day trip or transit?",
  },
  accommodation_postcode: {
    zh: "你在新加坡住址的 6 位邮政编码是多少？",
    en: "What is the 6-digit postal code for your address in Singapore?",
  },
  accommodation_block_number: {
    zh: "这个住址的楼号或门牌号是多少？",
    en: "What is the block or house number for this address?",
  },
  accommodation_street_name: {
    zh: "这个住址所在的街道叫什么名字？",
    en: "What is the street name for this address?",
  },
  accommodation_building_name: {
    zh: "这栋建筑有名称吗？如果没有，可以告诉我留空。",
    en: "Does the building have a name? If not, you can tell me to leave it blank.",
  },
  accommodation_floor_number: {
    zh: "你住在几楼？如果不适用，可以直接说“不适用”。",
    en: "Which floor will you stay on? If it does not apply, just say “not applicable”.",
  },
  accommodation_unit_number: {
    zh: "房间或单位号码是多少？如果不适用，可以直接说“不适用”。",
    en: "What is the room or unit number? If it does not apply, just say “not applicable”.",
  },
  next_city_or_port_after_singapore: {
    zh: "离开新加坡后，你下一站会去哪个城市或港口？直接告诉我名称就可以。",
    en: "Which city or port will you travel to after leaving Singapore? Just give me the name.",
  },
};

function friendlyQuestion(field: VisaFormFieldRow, locale: string): string {
  const copy = FRIENDLY_FIELD_QUESTIONS[field.fieldName];
  if (copy) return locale.startsWith("zh") ? copy.zh : copy.en;
  const label = localizedLabel(field, locale);
  return locale.startsWith("zh")
    ? `接下来想确认一下：${label}。你可以按自己的习惯回答，我会帮你整理成表单需要的格式。`
    : `Next, could you tell me about ${label}? Answer naturally and I’ll format it for the form.`;
}

function localizedLabel(field: VisaFormFieldRow, locale: string): string {
  if (locale.startsWith("zh")) {
    const label = field.validationRules?.label_zh;
    if (typeof label === "string" && label.trim()) return label.trim();
  }
  return field.label;
}

function localizeMissingFields(
  missing: MissingApplicationField[],
  fields: Map<string, VisaFormFieldRow>,
  locale: string,
): MissingApplicationField[] {
  return missing.map((item) => ({
    ...item,
    label: fields.has(item.fieldName) ? localizedLabel(fields.get(item.fieldName)!, locale) : item.label,
  }));
}

export function fingerprintSchema(steps: WizardStep[]): string {
  const manifest = steps.flatMap((step) => step.fields.map((field) => ({
    fieldName: field.fieldName,
    type: field.fieldType,
    required: field.required,
    options: field.options?.map(optionValue) ?? [],
    conditionalLogic: field.conditionalLogic,
    rules: field.validationRules,
  })));
  return createHash("sha256").update(JSON.stringify(manifest)).digest("hex");
}

async function activeKnowledgeRelease(admin: SupabaseClient, country: string, visaType: string) {
  const { data } = await admin
    .from("visa_knowledge_releases")
    .select("id, release_key")
    .eq("status", "active")
    .order("activated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const release = data as { id: string; release_key: string } | null;
  if (!release) return null;
  const { data: matchingDocument } = await admin
    .from("visa_documents")
    .select("id")
    .eq("release_id", release.id)
    .ilike("country", country)
    .ilike("visa_type", visaType)
    .limit(1)
    .maybeSingle();
  return matchingDocument ? release : null;
}

export async function getOrCreateAssistantSession(params: {
  admin: SupabaseClient;
  applicationId: string;
  applicantId: string;
  authUserId: string;
  country: string;
  visaType: string;
  steps: WizardStep[];
}): Promise<SessionRow> {
  const { data: existing, error: readError } = await params.admin
    .from("form_assistant_sessions")
    .select("id, schema_fingerprint, knowledge_release_key, state_json")
    .eq("application_id", params.applicationId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (readError) throw new Error(readError.message);

  const schemaFingerprint = fingerprintSchema(params.steps);
  if (existing) {
    if (existing.schema_fingerprint !== schemaFingerprint) {
      await params.admin
        .from("form_assistant_sessions")
        .update({ schema_fingerprint: schemaFingerprint, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
    }
    return { ...existing, schema_fingerprint: schemaFingerprint } as SessionRow;
  }

  const release = await activeKnowledgeRelease(params.admin, params.country, params.visaType);
  const { data: created, error } = await params.admin
    .from("form_assistant_sessions")
    .insert({
      application_id: params.applicationId,
      applicant_id: params.applicantId,
      auth_user_id: params.authUserId,
      schema_fingerprint: schemaFingerprint,
      knowledge_release_id: release?.id ?? null,
      knowledge_release_key: release?.release_key ?? null,
      state_json: { optionalFieldsAcknowledged: false },
    })
    .select("id, schema_fingerprint, knowledge_release_key, state_json")
    .single();
  if (error || !created) throw new Error(error?.message ?? "Failed to create assistant session");
  return created as SessionRow;
}

export async function loadAssistantMessages(
  admin: SupabaseClient,
  sessionId: string,
): Promise<FormAssistantMessage[]> {
  const { data, error } = await admin
    .from("form_assistant_messages")
    .select("id, role, content, created_at")
    .eq("session_id", sessionId)
    .in("role", ["user", "assistant"])
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id,
    role: row.role as "user" | "assistant",
    content: row.content,
    createdAt: row.created_at,
  }));
}

function buildQuestion(fields: VisaFormFieldRow[], locale: string): string {
  if (fields.length === 0) {
    return locale.startsWith("zh")
      ? "必填信息已经齐全。你可以补充仍为空的可选项，或运行最终检查。"
      : "All required information is complete. You can add optional details or run the final check.";
  }
  const field = fields[0];
  if (!field) return buildQuestion([], locale);
  return friendlyQuestion(field, locale);
}

function buildCompletionQuestion(
  optionalFields: VisaFormFieldRow[],
  locale: string,
): string {
  if (optionalFields.length === 0) return buildQuestion([], locale);
  const question = friendlyQuestion(optionalFields[0], locale);
  return locale.startsWith("zh")
    ? `必填信息已经齐全。如果你愿意，还可以补充一项选填内容：${question} 不想填写的话，直接运行最终检查就可以。`
    : `All required information is complete. If you’d like, there is one optional detail left: ${question} You can also run the final check and leave it blank.`;
}

function buildTurnAcknowledgement(appliedCount: number, locale: string): string {
  if (appliedCount === 0) return "";
  return locale.startsWith("zh")
    ? "好的，已记录你刚才确认的信息。"
    : "Got it. I recorded the information you just confirmed.";
}

export function buildAssistantState(params: {
  sessionId: string;
  steps: WizardStep[];
  answers: Record<string, { value: string; source: string | null }>;
  messages: FormAssistantMessage[];
  locale: string;
}): FormAssistantState {
  const values = Object.fromEntries(Object.entries(params.answers).map(([key, item]) => [key, item.value]));
  const rawMissingFields = getMissingDynamicFormFields(params.steps, values);
  const fieldByName = new Map(params.steps.flatMap((step) => step.fields).map((field) => [field.fieldName, field]));
  const missingFields = localizeMissingFields(rawMissingFields, fieldByName, params.locale);
  const nextFields = missingFields.slice(0, 1).map((item) => fieldByName.get(item.fieldName)).filter(Boolean) as VisaFormFieldRow[];
  const optionalFields = params.steps.flatMap((step) => step.fields.filter((field) =>
    !field.required && !values[field.fieldName]?.trim() && evaluateShowIf(field, values, step.fields),
  ));
  const assistantMessage = missingFields.length > 0
    ? buildQuestion(nextFields, params.locale)
    : buildCompletionQuestion(optionalFields, params.locale);
  return {
    enabled: true,
    sessionId: params.sessionId,
    assistantMessage,
    messages: params.messages,
    appliedPatches: [],
    skippedConflicts: [],
    missingFields,
    progress: getAssistantProgress(params.steps, values),
    sources: SGAC_ICA_SOURCES,
    canRunFinalCheck: missingFields.length === 0,
    aiFilledFieldNames: Object.entries(params.answers)
      .filter(([, item]) => item.source === "form_assistant")
      .map(([fieldName]) => fieldName),
  };
}

function parseOpenAiText(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const response = payload as { output_text?: unknown; output?: Array<{ content?: Array<{ text?: unknown }> }> };
  if (typeof response.output_text === "string") return response.output_text;
  return response.output?.flatMap((item) => item.content ?? [])
    .map((item) => item.text)
    .filter((value): value is string => typeof value === "string")
    .join("\n") ?? "";
}

async function proposeTurn(params: {
  text: string;
  locale: string;
  candidates: VisaFormFieldRow[];
  currentField: VisaFormFieldRow | undefined;
  answers: Record<string, string>;
  knowledgeContext: string;
  referenceDate: string;
  timeZone: string;
}): Promise<{ reply: string; patches: ProposedPatch[] }> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const fallback = "";
  if (!apiKey || apiKey === "your_openai_api_key_here" || params.candidates.length === 0) {
    return { reply: fallback, patches: [] };
  }

  const candidateManifest = params.candidates.map((field) => ({
    fieldName: field.fieldName,
    label: localizedLabel(field, params.locale),
    type: field.fieldType,
    exactOptions: relevantOptionsForMessage(
      field.options ?? [],
      params.text,
      250,
      field.fieldName,
    ).map((option) => ({
      value: optionValue(option),
      aliases: optionAliases(option),
    })),
    pattern: typeof field.validationRules?.pattern === "string" ? field.validationRules.pattern : null,
  }));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 18_000);
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: FORM_ASSISTANT_MODEL,
        max_output_tokens: 1_000,
        instructions: params.locale.startsWith("zh")
          ? "你是表单填写助手。专业、温和、简洁。SG Arrival Card 不是签证，不要冒充签证官。理解用户的自然语言并转换为表单的官方标准值，但不得猜测。相对日期必须以 referenceDate 和 timeZone 计算：例如“明天”是 referenceDate 加一天；这种唯一明确的相对日期应标为 high，并输出 YYYY-MM-DD。下拉值必须使用 exactOptions 中的 value，可用 aliases 理解中文、英文、简称或翻译。只能输出 manifest 中的字段。确有多种解释的姓名、日期、证件号或选项才标为 medium/low。reply 只简短确认本轮理解到的内容，不得询问后续字段；服务端会单独追加下一问题。返回严格 JSON。"
          : "You are a professional, warm and concise form-filling assistant. The SG Arrival Card is not a visa; never impersonate an officer. Understand natural-language answers and convert them to official form values without guessing. Resolve relative dates from referenceDate in timeZone: for example, tomorrow is referenceDate plus one day; an unambiguous relative date is high confidence and must be returned as YYYY-MM-DD. Dropdown values must use exactOptions[].value, matching Chinese, English, abbreviations, or translations through aliases. Return only manifest fields. Mark a name, date, document number, or option medium/low only when it genuinely has multiple interpretations. The reply only briefly acknowledges this turn and never asks later fields because the server appends the next question. Return strict JSON.",
        input: JSON.stringify({
          userMessage: params.text,
          referenceDate: params.referenceDate,
          timeZone: params.timeZone,
          currentQuestion: params.currentField
            ? {
                fieldName: params.currentField.fieldName,
                label: localizedLabel(params.currentField, params.locale),
              }
            : null,
          missingFieldManifest: candidateManifest,
          productKnowledge: params.knowledgeContext,
        }),
        text: {
          format: {
            type: "json_schema",
            name: "form_assistant_turn",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                reply: { type: "string" },
                patches: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      fieldName: { type: "string" },
                      value: { type: "string" },
                      confidence: { type: "string", enum: ["high", "medium", "low"] },
                    },
                    required: ["fieldName", "value", "confidence"],
                  },
                },
              },
              required: ["reply", "patches"],
            },
          },
        },
      }),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) return { reply: fallback, patches: [] };
    const raw = parseOpenAiText(await response.json());
    const parsed = JSON.parse(raw) as { reply?: unknown; patches?: unknown };
    return {
      reply: typeof parsed.reply === "string" && parsed.reply.trim() ? parsed.reply.trim() : fallback,
      patches: Array.isArray(parsed.patches) ? parsed.patches as ProposedPatch[] : [],
    };
  } catch {
    return { reply: fallback, patches: [] };
  } finally {
    clearTimeout(timeout);
  }
}

function validateProposal(field: VisaFormFieldRow, patch: ProposedPatch): boolean {
  if (patch.confidence !== "high" || !patch.value?.trim()) return false;
  if (field.fieldType === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(patch.value)) return false;
  if (field.options?.length && !field.options.map(optionValue).includes(patch.value)) return false;
  const pattern = field.validationRules?.pattern;
  if (typeof pattern === "string") {
    try {
      if (!new RegExp(pattern).test(patch.value)) return false;
    } catch {
      return false;
    }
  }
  return true;
}

async function persistMessage(params: {
  admin: SupabaseClient;
  sessionId: string;
  applicationId: string;
  applicantId: string;
  authUserId: string;
  idempotencyKey: string;
  role: "user" | "assistant";
  content: string;
  inputMode: "text" | "voice" | "system";
  responseJson?: Record<string, unknown>;
}) {
  const { data, error } = await params.admin
    .from("form_assistant_messages")
    .upsert({
      session_id: params.sessionId,
      application_id: params.applicationId,
      applicant_id: params.applicantId,
      auth_user_id: params.authUserId,
      idempotency_key: params.idempotencyKey,
      role: params.role,
      content: params.content,
      input_mode: params.inputMode,
      response_json: params.responseJson ?? {},
    }, { onConflict: "session_id,idempotency_key,role", ignoreDuplicates: true })
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.id as string | undefined;
}

export async function runAssistantTurn(params: {
  admin: SupabaseClient;
  session: SessionRow;
  applicationId: string;
  applicantId: string;
  authUserId: string;
  steps: WizardStep[];
  answers: Record<string, { value: string; source: string | null }>;
  text: string;
  locale: string;
  inputMode: "text" | "voice";
  idempotencyKey: string;
  country: string;
  visaType: string;
}): Promise<FormAssistantTurnResponse> {
  const message = params.text.trim().slice(0, MAX_MESSAGE_LENGTH);
  if (!message) throw new Error("Message is required");
  const { data: priorResponse } = await params.admin
    .from("form_assistant_messages")
    .select("response_json")
    .eq("session_id", params.session.id)
    .eq("idempotency_key", params.idempotencyKey)
    .eq("role", "assistant")
    .maybeSingle();
  if (priorResponse?.response_json) {
    return priorResponse.response_json as FormAssistantTurnResponse;
  }
  const existingValues = Object.fromEntries(Object.entries(params.answers).map(([key, item]) => [key, item.value]));
  const missing = getMissingDynamicFormFields(params.steps, existingValues);
  const allFields = params.steps.flatMap((step) => step.fields);
  const fieldByName = new Map(allFields.map((field) => [field.fieldName, field]));
  const missingNames = new Set(missing.map((item) => item.fieldName));
  const optionalNames = new Set(allFields.filter((field) => {
    const stepFields = params.steps.find((step) => step.fields.includes(field))?.fields ?? allFields;
    return !field.required && !existingValues[field.fieldName]?.trim() && evaluateShowIf(field, existingValues, stepFields);
  }).map((field) => field.fieldName));
  const currentField = missing.length > 0
    ? fieldByName.get(missing[0]?.fieldName ?? "")
    : allFields.find((field) => optionalNames.has(field.fieldName));
  const visibleCandidatePool = allFields.filter((field) => {
    const stepFields = params.steps.find((step) => step.fields.includes(field))?.fields ?? allFields;
    if (!evaluateShowIf(field, existingValues, stepFields)) return false;
    // The model sees only currently missing fields plus fields that the
    // assistant previously filled and the user may now explicitly correct.
    return missingNames.has(field.fieldName) ||
      (missingNames.size === 0 && optionalNames.has(field.fieldName)) ||
      params.answers[field.fieldName]?.source === "form_assistant";
  });
  const visibleCandidates = [
    ...(currentField && visibleCandidatePool.includes(currentField) ? [currentField] : []),
    ...visibleCandidatePool.filter((field) => field !== currentField),
  ].slice(0, 5);

  const userMessageId = await persistMessage({
    ...params,
    sessionId: params.session.id,
    role: "user",
    content: message,
  });
  if (!userMessageId) {
    const { data: completedTurn } = await params.admin
      .from("form_assistant_messages")
      .select("response_json")
      .eq("session_id", params.session.id)
      .eq("idempotency_key", params.idempotencyKey)
      .eq("role", "assistant")
      .maybeSingle();
    if (completedTurn?.response_json) {
      return completedTurn.response_json as FormAssistantTurnResponse;
    }
    throw new Error("FORM_ASSISTANT_TURN_IN_PROGRESS");
  }
  const knowledge = await loadApplicationKnowledge({
    admin: params.admin,
    releaseKey: params.session.knowledge_release_key,
    country: params.country,
    visaType: params.visaType,
  });
  const timeZone = PRODUCT_TIME_ZONES[params.visaType] ?? "UTC";
  const referenceDate = isoDateInTimeZone(new Date(), timeZone);
  const directChoice = parseDirectCurrentFieldAnswer(message, currentField, { timeZone });
  const proposed = directChoice
    ? { reply: "", patches: [directChoice] }
    : await proposeTurn({
        text: message,
        locale: params.locale,
        candidates: visibleCandidates,
        currentField,
        answers: existingValues,
        knowledgeContext: knowledge.context,
        referenceDate,
        timeZone,
      });

  const appliedPatches: FormAssistantAppliedPatch[] = [];
  const skippedConflicts: string[] = [];
  const assistantMessageId = randomUUID();
  for (const patch of proposed.patches) {
    const field = fieldByName.get(patch.fieldName);
    if (!field || !validateProposal(field, patch)) continue;
    const current = params.answers[patch.fieldName];
    if (current?.value && current.source !== "form_assistant") {
      skippedConflicts.push(patch.fieldName);
      continue;
    }
    const provenance = {
      assistantSessionId: params.session.id,
      assistantMessageId,
      sourceKind: "user_chat",
      confidence: "high",
      model: patch.modelSource ?? FORM_ASSISTANT_MODEL,
      previousValue: current?.source === "form_assistant" ? current.value : null,
    };
    if (current?.source === "form_assistant") {
      const { data, error } = await params.admin
        .from("visa_application_answers")
        .update({ value_text: patch.value, source_metadata: provenance, updated_at: new Date().toISOString() })
        .eq("application_id", params.applicationId)
        .eq("field_name", patch.fieldName)
        .eq("source", "form_assistant")
        .select("field_name")
        .maybeSingle();
      if (error || !data) {
        skippedConflicts.push(patch.fieldName);
        continue;
      }
    } else {
      const { error } = await params.admin.from("visa_application_answers").insert({
        application_id: params.applicationId,
        field_name: patch.fieldName,
        value_text: patch.value,
        source: "form_assistant",
        source_metadata: provenance,
        updated_at: new Date().toISOString(),
      });
      if (error) {
        skippedConflicts.push(patch.fieldName);
        continue;
      }
    }
    params.answers[patch.fieldName] = { value: patch.value, source: "form_assistant" };
    appliedPatches.push({
      fieldName: patch.fieldName,
      value: patch.value,
      sourceKind: "user_chat",
      confidence: "high",
    });
  }

  const nextValues = Object.fromEntries(Object.entries(params.answers).map(([key, item]) => [key, item.value]));
  const nextMissing = localizeMissingFields(
    getMissingDynamicFormFields(params.steps, nextValues),
    fieldByName,
    params.locale,
  );
  const nextFields = nextMissing.slice(0, 1).map((item) => fieldByName.get(item.fieldName)).filter(Boolean) as VisaFormFieldRow[];
  const optionalFields = params.steps.flatMap((step) => step.fields.filter((field) =>
    !field.required && !nextValues[field.fieldName]?.trim() && evaluateShowIf(field, nextValues, step.fields),
  ));
  const nextQuestion = nextMissing.length > 0
    ? buildQuestion(nextFields, params.locale)
    : buildCompletionQuestion(optionalFields, params.locale);
  const assistantMessage = [
    buildTurnAcknowledgement(appliedPatches.length, params.locale),
    nextQuestion,
  ].filter(Boolean).join("\n\n");
  const response: FormAssistantTurnResponse = {
    sessionId: params.session.id,
    assistantMessage,
    appliedPatches,
    skippedConflicts,
    missingFields: nextMissing,
    progress: getAssistantProgress(params.steps, nextValues),
    sources: knowledge.sources,
    canRunFinalCheck: nextMissing.length === 0,
  };
  await persistMessage({
    ...params,
    sessionId: params.session.id,
    idempotencyKey: params.idempotencyKey,
    role: "assistant",
    content: assistantMessage,
    inputMode: "system",
    responseJson: response as unknown as Record<string, unknown>,
  });
  await params.admin
    .from("form_assistant_sessions")
    .update({
      state_json: { missingFields: nextMissing, progress: response.progress },
      state_version: Date.now(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.session.id);
  return response;
}
