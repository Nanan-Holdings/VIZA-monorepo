import type { FormAssistantSource } from "@/types/form-assistant";
import type { VisaFormFieldOption, VisaFormFieldRow } from "@/types/visa-form-fields";

type FieldExplanationTarget = Pick<
  VisaFormFieldRow,
  "fieldName" | "label" | "fieldType" | "required" | "placeholder" | "options"
> & Partial<Pick<VisaFormFieldRow, "validationRules">>;

export interface FieldExplanation {
  summary: string;
  sourceHint: string;
  example: string | null;
}

export function isFormAssistantConfirmationField(field: Pick<
  VisaFormFieldRow,
  "fieldName" | "label" | "fieldType" | "required" | "validationRules"
>): boolean {
  if (field.fieldType !== "checkbox") return false;
  if (field.validationRules?.mustBeTrue === true) return true;
  if (!field.required) return false;
  return /(?:acknowledg|certif|consent|declaration|privacy|signature|terms|undertaking)/i.test(field.fieldName) ||
    /^(?:I\s+(?:acknowledge|am aware|certify|confirm|consent|declare|have read|understand)|By clicking\b)/i.test(field.label.trim());
}

type LocalizedFieldExplanation = {
  en: FieldExplanation;
  zh: FieldExplanation;
};

const SEMANTIC_FIELD_EXPLANATIONS: Record<string, LocalizedFieldExplanation> = {
  origin_country: {
    en: {
      summary: "“Country of Origin” means the country where the journey segment you are reporting departs.",
      sourceHint: "Use the country shown with your Airport or Seaport of Origin on your itinerary or ticket. It is not your nationality, country of birth, or permanent residence.",
      example: "If this flight departs from Singapore, answer Singapore",
    },
    zh: {
      summary: "“出发国家 / 地区”是指你本次申报的行程航段从哪个国家或地区出发。",
      sourceHint: "请以机票或行程单上与出发机场 / 海港对应的国家为准；这不是国籍、出生国家/地区或永久居住国家。",
      example: "如果本次申报的航班从新加坡起飞，请回答“新加坡”",
    },
  },
  transit_country: {
    en: {
      summary: "“Country of Transit” means the country where you will make a connection before reaching the destination for this journey segment.",
      sourceHint: "Use the connection shown on your itinerary. Do not enter the departure or destination country unless it is genuinely the transit location.",
      example: "A Singapore–Bangkok–Tokyo itinerary has Thailand as the transit country",
    },
    zh: {
      summary: "“中转国家 / 地区”是指抵达本段行程目的地前换乘所在的国家或地区。",
      sourceHint: "请按行程单上的中转地点填写；除非确实在那里中转，否则不要填写出发国家或目的国家。",
      example: "新加坡—曼谷—东京的行程，中转国家是泰国",
    },
  },
  destination_country: {
    en: {
      summary: "“Country of Destination” means the onward or final country for the journey segment being reported.",
      sourceHint: "Use the final onward destination shown on the ticket for the transit itinerary, not your nationality or residence.",
      example: "For Singapore–Seoul–Japan with Seoul as transit, answer Japan",
    },
    zh: {
      summary: "“最终目的国家 / 地区”是指本次申报行程继续前往或最终抵达的国家或地区。",
      sourceHint: "请按中转行程的后续机票填写，不是你的国籍或居住国家。",
      example: "新加坡—首尔—日本且首尔为中转时，请回答“日本”",
    },
  },
  visited_country_30d: {
    en: {
      summary: "This asks for every country where you worked, visited, or transited during the 30 days before this trip.",
      sourceHint: "Check passport stamps and your recent itinerary. Include connection countries even when you did not leave the airport.",
      example: "Singapore, Thailand",
    },
    zh: {
      summary: "这是询问本次旅行前 30 天内你工作、访问或中转过的所有国家或地区。",
      sourceHint: "请核对护照盖章和近期行程；即使没有离开机场，也要包括中转国家。",
      example: "新加坡、泰国",
    },
  },
  nationality: {
    en: {
      summary: "“Citizenship” means the nationality shown on the passport you will use for this trip.",
      sourceHint: "Copy the nationality or citizenship from the passport biodata page; do not use your country of residence unless it is also your nationality.",
      example: "China",
    },
    zh: {
      summary: "“公民身份”是指本次旅行所用护照上显示的国籍。",
      sourceHint: "请按护照资料页的国籍 / 公民身份填写；除非两者相同，否则不要填写居住国家。",
      example: "中国",
    },
  },
  country_of_birth: {
    en: {
      summary: "“Country of Birth” means the country or territory where you were born.",
      sourceHint: "Use your passport or birth record. This is separate from your current citizenship and residence.",
      example: "China",
    },
    zh: {
      summary: "“出生国家 / 地区”是指你出生时所在的国家或地区。",
      sourceHint: "请以护照或出生记录为准；这与当前国籍和居住国家是不同信息。",
      example: "中国",
    },
  },
  country_of_residence: {
    en: {
      summary: "“Permanent Country of Residence” means the country where you normally live outside this trip.",
      sourceHint: "Use your usual home address or residence record, not your temporary accommodation at the destination.",
      example: "Singapore",
    },
    zh: {
      summary: "“永久居住国家 / 地区”是指你在本次行程之外通常生活的国家或地区。",
      sourceHint: "请按日常住址或居住记录填写，不要填写目的地的临时住宿地址。",
      example: "新加坡",
    },
  },
  occupation: {
    en: {
      summary: "“Occupation” means your current main job or employment status.",
      sourceHint: "Reply with what you currently do, such as student, software engineer, retired, or unemployed. It is not asking for your employer's name.",
      example: "Student",
    },
    zh: {
      summary: "“职业”是指你目前的主要工作或就业状态。",
      sourceHint: "请回答你现在从事什么，例如学生、软件工程师、退休或无业；这里不是询问雇主名称。",
      example: "学生",
    },
  },
  accompanied_under_18_count: {
    en: {
      summary: "This asks how many family members under age 18 are travelling with you.",
      sourceHint: "Count accompanying family members only, not yourself. Enter 0 if none are travelling with you.",
      example: "0",
    },
    zh: {
      summary: "这是询问有多少名 18 岁以下的家人与你同行。",
      sourceHint: "只计算同行家人，不包括你本人；如果没有，请填写 0。",
      example: "0",
    },
  },
  accompanied_18_plus_count: {
    en: {
      summary: "This asks how many family members aged 18 or older are travelling with you.",
      sourceHint: "Count accompanying family members only, not yourself. Enter 0 if none are travelling with you.",
      example: "0",
    },
    zh: {
      summary: "这是询问有多少名 18 岁及以上的家人与你同行。",
      sourceHint: "只计算同行家人，不包括你本人；如果没有，请填写 0。",
      example: "0",
    },
  },
  checked_baggage_count: {
    en: {
      summary: "This asks for the number of checked baggage pieces you are bringing.",
      sourceHint: "Count bags checked into the aircraft or vessel hold. Enter 0 if you have no checked baggage.",
      example: "1",
    },
    zh: {
      summary: "这是询问你携带的托运行李件数。",
      sourceHint: "请计算托运到飞机或船舶货舱的行李；如果没有托运行李，请填写 0。",
      example: "1",
    },
  },
  handcarry_baggage_count: {
    en: {
      summary: "This asks for the number of hand-carried baggage pieces you are bringing.",
      sourceHint: "Count cabin or carry-on bags that remain with you. Enter 0 if you have none.",
      example: "1",
    },
    zh: {
      summary: "这是询问你携带的手提行李件数。",
      sourceHint: "请计算随身携带进入客舱的行李；如果没有，请填写 0。",
      example: "1",
    },
  },
  has_baggage_or_currency_to_declare: {
    en: {
      summary: "This asks whether anything you are carrying requires a Philippine customs or currency declaration—not how many bags you have.",
      sourceHint: "Having checked or carry-on baggage alone does not make the answer Yes. Tell me whether you are carrying declarable goods, regulated items, or currency above the applicable declaration limits; if you are unsure, describe the contents or amount and I will help you determine the answer from the official rules.",
      example: null,
    },
    zh: {
      summary: "这是询问你携带的物品或货币是否需要向菲律宾海关申报，不是在询问行李件数。",
      sourceHint: "仅有托运行李或手提行李并不代表应回答“是”。请说明你是否携带需要申报的物品、受管制物品或超过申报限额的货币；如果不确定，可以告诉我物品内容或金额，我会依据官方规则协助判断。",
      example: null,
    },
  },
  purpose_of_travel: {
    en: {
      summary: "“Purpose of Travel” means the main real reason for this trip.",
      sourceHint: "Answer from your actual plans, such as holiday, work, business, study, transit, or visiting family.",
      example: "Holiday",
    },
    zh: {
      summary: "“旅行目的”是指本次行程最主要的真实原因。",
      sourceHint: "请按实际行程回答，例如度假、工作、商务、学习、过境或探亲访友。",
      example: "度假",
    },
  },
  traveller_type: {
    en: {
      summary: "“Traveller Type” asks whether you are travelling as an aircraft passenger or a vessel passenger.",
      sourceHint: "Reply with how you are entering the destination country. For a normal commercial flight, reply aircraft passenger or simply aircraft.",
      example: "Aircraft passenger",
    },
    zh: {
      summary: "“旅客类型”是询问你属于航空旅客还是船舶旅客。",
      sourceHint: "请按进入目的国家的交通方式回答；普通民航旅客可以回答“航空旅客”或“飞机”。",
      example: "航空旅客",
    },
  },
  passport_holder_type: {
    en: {
      summary: "This asks which passport type you will use to enter the Philippines: a Philippine passport or a foreign passport.",
      sourceHint: "Answer from the passport you will present for this trip, not from where you live.",
      example: "Foreign passport",
    },
    zh: {
      summary: "这是询问你将使用菲律宾护照还是外国护照入境菲律宾。",
      sourceHint: "请按本次旅行实际出示的护照回答，不要按居住国家判断。",
      example: "外国护照",
    },
  },
  destination_type: {
    en: {
      summary: "“Destination upon arrival” asks what kind of place or onward arrangement you have immediately after entering the Philippines.",
      sourceHint: "Reply with the real arrangement: a residence, hotel/resort, airport transit, or seaport connection, as applicable.",
      example: "Residence",
    },
    zh: {
      summary: "“抵达后的目的地类型”是询问入境菲律宾后立即前往哪一类地点或后续安排。",
      sourceHint: "请按实际情况回答：住所、酒店 / 度假村、机场中转或海港衔接。",
      example: "住所",
    },
  },
  airline_name: {
    en: {
      summary: "“Name of Airline” means the airline operating the flight that brings you to the Philippines.",
      sourceHint: "Use the operating carrier shown on the booking or boarding pass, especially if the ticket was sold by a different airline.",
      example: "Cebu Pacific",
    },
    zh: {
      summary: "“航空公司名称”是指实际承运你抵达菲律宾航班的航空公司。",
      sourceHint: "请以预订单或登机牌上的实际承运航空公司为准；代码共享时可能与售票公司不同。",
      example: "宿务太平洋航空",
    },
  },
  flight_number: {
    en: {
      summary: "“Flight Number” means the number of the flight arriving in the Philippines.",
      sourceHint: "Copy it from the itinerary or boarding pass, including the airline prefix.",
      example: "5J 806",
    },
    zh: {
      summary: "“航班号”是指抵达菲律宾的航班编号。",
      sourceHint: "请从行程单或登机牌照抄，并保留航空公司前缀。",
      example: "5J 806",
    },
  },
  port_of_entry: {
    en: {
      summary: "“Airport of Destination” or “Port of Entry” means the airport where the arriving flight lands in the destination country.",
      sourceHint: "Use the arrival airport on your itinerary, including the correct terminal when the official entry distinguishes terminals.",
      example: "Ninoy Aquino International Airport Terminal 3",
    },
    zh: {
      summary: "“目的机场 / 入境口岸”是指本次抵达航班在目的国家降落的机场。",
      sourceHint: "请按行程单填写；如果官方选项区分航站楼，还要对应正确航站楼。",
      example: "尼诺伊·阿基诺国际机场 3 号航站楼",
    },
  },
  sea_port_of_entry: {
    en: {
      summary: "“Seaport of Destination in the Philippines” means the Philippine port where your vessel arrives.",
      sourceHint: "Use the arrival port shown on the voyage booking or vessel itinerary.",
      example: "Manila South Harbor",
    },
    zh: {
      summary: "“菲律宾目的海港”是指船舶抵达菲律宾时停靠的港口。",
      sourceHint: "请按船票或航程单上的抵达港填写。",
      example: "马尼拉南港",
    },
  },
  airport_of_origin: {
    en: {
      summary: "“Airport of Origin” means the airport where the flight segment you are reporting to the Philippines departs.",
      sourceHint: "Copy the departure airport from the same itinerary segment used for Country of Origin.",
      example: "Singapore Changi Airport",
    },
    zh: {
      summary: "“出发机场”是指本次申报的赴菲律宾航段从哪个机场起飞。",
      sourceHint: "请按与出发国家对应的同一段行程填写出发机场。",
      example: "新加坡樟宜机场",
    },
  },
  seaport_of_origin: {
    en: {
      summary: "“Seaport of Origin” means the port where the vessel journey you are reporting to the Philippines departs.",
      sourceHint: "Copy the departure port from the voyage booking or vessel itinerary.",
      example: "Singapore",
    },
    zh: {
      summary: "“出发海港”是指本次申报的赴菲律宾船舶航程从哪个港口出发。",
      sourceHint: "请按船票或船舶航程单上的出发港填写。",
      example: "新加坡",
    },
  },
  transit_airport: {
    en: {
      summary: "“Airport of Transit” means the airport where you change flights before reaching the Philippines.",
      sourceHint: "Use the connecting airport shown between your origin and Philippine arrival flights.",
      example: "Suvarnabhumi Airport, Bangkok",
    },
    zh: {
      summary: "“中转机场”是指抵达菲律宾前换乘航班的机场。",
      sourceHint: "请填写行程单上位于出发航班和抵达菲律宾航班之间的衔接机场。",
      example: "曼谷素万那普机场",
    },
  },
  transit_seaport: {
    en: {
      summary: "“Seaport of Transit” means the port where you connect to another vessel before reaching the Philippines.",
      sourceHint: "Use the connecting port shown on the voyage itinerary.",
      example: "Port Klang",
    },
    zh: {
      summary: "“中转海港”是指抵达菲律宾前换乘另一艘船舶的港口。",
      sourceHint: "请按船舶航程单上的中转港填写。",
      example: "巴生港",
    },
  },
  destination_transit_airport: {
    en: {
      summary: "This asks which Philippine airport you will use for an onward transit connection.",
      sourceHint: "Use the Philippine connection airport shown on the onward ticket, including its terminal when listed separately.",
      example: "Ninoy Aquino International Airport Terminal 3",
    },
    zh: {
      summary: "这是询问你在菲律宾中转前往下一目的地时使用哪个机场。",
      sourceHint: "请按后续机票上的菲律宾中转机场填写；官方选项区分航站楼时也要对应正确航站楼。",
      example: "尼诺伊·阿基诺国际机场 3 号航站楼",
    },
  },
  disembarking_port_code: {
    en: {
      summary: "“Port of Disembarkation” means the Philippine port where you will actually leave the vessel.",
      sourceHint: "Use the disembarkation port on the vessel itinerary; it may differ from a port where the vessel only stops or connects.",
      example: "Manila South Harbor",
    },
    zh: {
      summary: "“下船港口”是指你实际离开船舶并上岸的菲律宾港口。",
      sourceHint: "请按航程单上的下船港填写；它可能不同于船舶仅停靠或中转的港口。",
      example: "马尼拉南港",
    },
  },
  currency_transport_method: {
    en: {
      summary: "“Currency Transport Method” asks whether the currency or monetary instruments are carried physically by a person or sent separately by courier/shipment.",
      sourceHint: "Answer according to how the declared funds are actually being transported.",
      example: "Physically carried",
    },
    zh: {
      summary: "“货币运输方式”是询问货币或金融票据由人员随身携带，还是通过快递 / 货运另行运输。",
      sourceHint: "请按申报资金的实际运输方式回答。",
      example: "人员随身携带",
    },
  },
};

const SEMANTIC_FIELD_ALIASES: Record<string, string> = {
  arrival_airport: "port_of_entry",
  airport_of_destination: "port_of_entry",
  birth_country: "country_of_birth",
  citizenship: "nationality",
  country_boarded: "origin_country",
  country_of_citizenship: "nationality",
  country_of_current_residence: "country_of_residence",
  country_of_nationality: "nationality",
  country_of_origin: "origin_country",
  current_nationality: "nationality",
  current_occupation: "occupation",
  departure_country: "origin_country",
  employment_status: "occupation",
  intended_port_of_entry: "port_of_entry",
  main_purpose_of_journey: "purpose_of_travel",
  nationality_country: "nationality",
  passport_nationality: "nationality",
  permanent_country_of_residence: "country_of_residence",
  place_of_birth_country: "country_of_birth",
  port_of_arrival: "port_of_entry",
  purpose_of_journey: "purpose_of_travel",
  purpose_of_visit: "purpose_of_travel",
  residence_country: "country_of_residence",
  travel_purpose: "purpose_of_travel",
  visit_purpose: "purpose_of_travel",
};

function semanticFieldExplanation(fieldName: string, locale: string): FieldExplanation | null {
  const canonicalName = SEMANTIC_FIELD_ALIASES[fieldName] ?? fieldName;
  const explanation = SEMANTIC_FIELD_EXPLANATIONS[canonicalName];
  return explanation ? (locale.startsWith("zh") ? explanation.zh : explanation.en) : null;
}

export function hasFieldSpecificExplanation(field: FieldExplanationTarget): boolean {
  if (semanticFieldExplanation(field.fieldName, "en")) return true;
  const searchText = `${field.fieldName} ${field.label}`.toLocaleLowerCase();
  return /address|street|issuing.?authority|place.?of.?issue|passport.*number|document.*number|surname|family.?name|given.?name|first.?name|full.?name|date|地址|签发机关|签发地点|护照号码|证件号码|姓氏|名字|姓名|日期/.test(searchText);
}

function explanationOptionLabel(option: VisaFormFieldOption, locale: string): string {
  if (typeof option === "string") return option;
  return locale.startsWith("zh")
    ? option.label_zh?.trim() || option.label_en?.trim() || option.text?.trim() || option.value
    : option.label_en?.trim() || option.text?.trim() || option.official_label?.trim() || option.value;
}

const INLINE_REVIEWED_CHOICE_LIMIT = 5;

/**
 * Small reviewed choice sets belong in the conversation itself. Large
 * searchable lists (countries, airports, occupations, and similar controls)
 * stay conversational so the assistant does not dump an unusable catalogue.
 */
export function getReviewedChoiceAnswerLabels(
  field: Pick<FieldExplanationTarget, "fieldType" | "options">,
  locale: string,
): string[] | null {
  if (!isFieldChoiceControl(field) || !field.options) return null;
  if (field.options.length < 2 || field.options.length > INLINE_REVIEWED_CHOICE_LIMIT) return null;
  const labels = Array.from(new Set(
    field.options.map((option) => explanationOptionLabel(option, locale)).filter(Boolean),
  ));
  if (labels.length < 2) return null;
  const normalized = labels.map((label) => label.trim().toLocaleLowerCase());
  const isYesNo = labels.length === 2 &&
    normalized.some((label) => /^(?:yes|true|是|有)$/.test(label)) &&
    normalized.some((label) => /^(?:no|false|否|无|沒有|没有)$/.test(label));
  if (isYesNo) return null;

  return labels;
}

export function buildReviewedChoiceAnswerHint(
  field: Pick<FieldExplanationTarget, "fieldType" | "options">,
  locale: string,
): string | null {
  const labels = getReviewedChoiceAnswerLabels(field, locale);
  if (!labels) return null;

  if (locale.startsWith("zh")) {
    const choices = labels.length === 2
      ? `${labels[0]} 或 ${labels[1]}`
      : `${labels.slice(0, -1).join("、")}，或 ${labels.at(-1)}`;
    return `可回答：${choices}。请直接用自己的话回复。`;
  }
  const choices = labels.length === 2
    ? `${labels[0]} or ${labels[1]}`
    : `${labels.slice(0, -1).join(", ")}, or ${labels.at(-1)}`;
  return `Available answers: ${choices}. Reply in your own words.`;
}

const DATE_FORMAT_EXAMPLES: Readonly<Record<string, string>> = {
  "YYYY-MM-DD": "2026-09-15",
  "DD/MM/YYYY": "15/09/2026",
  "YYYY/MM/DD": "2026/09/15",
  "DD-MMM-YYYY": "15-SEP-2026",
  YYYYMMDD: "20260915",
  "MM-YYYY": "09-2026",
  "MM/YYYY": "09/2026",
  YYYY: "2026",
};

function localizedRuleText(
  field: FieldExplanationTarget,
  locale: string,
  baseName: string,
): string | null {
  const rules = field.validationRules;
  if (!rules) return null;
  const localeKey = locale.startsWith("zh") ? `${baseName}_zh` : `${baseName}_en`;
  const localized = rules[localeKey];
  if (typeof localized === "string" && localized.trim()) return localized.trim();
  const fallback = rules[baseName];
  return typeof fallback === "string" && fallback.trim() ? fallback.trim() : null;
}

export function isFieldChoiceControl(field: Pick<VisaFormFieldRow, "fieldType">): boolean {
  return ["select", "multi_select", "country", "radio", "checkbox", "address_lookup"].includes(field.fieldType);
}

export function isFieldMetadataUnverified(field: FieldExplanationTarget): boolean {
  return field.validationRules?.official === false ||
    JSON.stringify(field.validationRules ?? {}).toLocaleLowerCase().includes("needs_review");
}

export function getFieldDateFormat(field: FieldExplanationTarget): string | null {
  const fieldName = field.fieldName.toLocaleLowerCase();
  const label = field.label.toLocaleLowerCase();
  if (/(?:^|_)year$/.test(fieldName) || /\(year\)|年份|仅年份/.test(label)) return "YYYY";
  const format = field.validationRules?.format ?? field.validationRules?.canonical_format;
  if (typeof format !== "string") return null;
  const normalized = format.trim().toUpperCase();
  return DATE_FORMAT_EXAMPLES[normalized] ? normalized : null;
}

function getFieldDateExample(field: FieldExplanationTarget): string | null {
  const format = getFieldDateFormat(field);
  return format ? DATE_FORMAT_EXAMPLES[format] : null;
}

export function isFieldClarificationRequest(text: string): boolean {
  const normalized = text.trim().toLocaleLowerCase();
  return /(?:什么意思|什么含义|什么叫|指的是什么|是指什么|怎么填|该填什么|要填什么|填什么|没看懂|看不懂|解释一下|能否解释|能解释)/.test(normalized) ||
    /\b(?:what does .{0,80} mean|what do you mean|what is this asking|how (?:do|should) i (?:answer|fill)|what should i (?:enter|write)|which .{0,40} address|please explain|can you explain)\b/.test(normalized);
}

export function fieldClarificationInstruction(locale: string): string {
  return locale.startsWith("zh")
    ? "如果用户询问当前字段是什么意思、应该填写什么或如何填写，不得把问题当作字段答案。必须直接解释该字段要收集什么以及通常应从哪里获取。只有字段元数据明确支持时才给格式示例；选择、勾选、声明、同意项不得给文字填写示例，不确定时不得猜测。这是聊天界面：请让用户直接回复答案，不得要求用户选择、点击或查找页面选项。不得只是改写或重复当前问题，也不得使用固定套话。"
    : "If the user asks what the current field means, what belongs there, or how to answer it, never treat the question as a field answer. Directly explain what the field collects and where the applicant would normally find it. Give a format example only when the field metadata supports it; never give text-entry examples for choices, acknowledgements, declarations, or consents, and never guess when uncertain. This is a chat interface: ask the user to reply directly, never to select, click, or find a page option. Do not merely paraphrase or repeat the current question, and do not use canned filler.";
}

export function buildFieldExplanation(
  field: FieldExplanationTarget,
  locale: string,
): FieldExplanation {
  const zh = locale.startsWith("zh");
  const label = field.label.trim() || (zh ? "当前字段" : "this field");
  const searchText = `${field.fieldName} ${field.label}`.toLocaleLowerCase();
  const configuredHelper = localizedRuleText(field, locale, "helper");
  const semanticExplanation = semanticFieldExplanation(field.fieldName, locale);
  if (semanticExplanation) {
    return configuredHelper
      ? { ...semanticExplanation, sourceHint: `${semanticExplanation.sourceHint} ${configuredHelper}` }
      : semanticExplanation;
  }
  const isAddressLineOne = /address.*(?:line_?1|street1)|(?:line_?1|street1).*address/.test(searchText) ||
    /地址.*(?:第?一行|第1行)/.test(searchText);
  const isAccommodationAddress = /accommodation|hotel|host|住宿|酒店|接待方/.test(searchText);

  // Choice controls describe a decision, acknowledgement, or declaration.
  // Classify them before label-keyword rules so a checkbox mentioning a
  // passport, address, or date never receives a text-entry example.
  if (isFieldChoiceControl(field)) {
    const isAcknowledgement = /acknowledg|read and (?:understood|accept)|read.*understand|已阅读|已閱覽|理解.*信息|知悉/.test(searchText);
    const isDeclaration = /declar|undertak|commit|consent|agree|accept|confirm.*(?:true|accurate|correct|complete)|声明|申明|承诺|承諾|同意|接受|确认.*(?:真实|准确|完整|無誤)/.test(searchText);

    if (field.fieldType === "checkbox" && isAcknowledgement) {
      return {
        summary: zh
          ? `“${label}”是阅读确认项：请先读完相关说明，仅在确实理解后勾选。`
          : `“${label}” is a reading acknowledgement: review the related notice and select it only after you understand it.`,
        sourceHint: configuredHelper ?? (zh
          ? "请根据页面紧邻的说明作出确认；这里不需要填写护照或其他文字内容。"
          : "Base the acknowledgement on the adjacent notice; this control does not ask for passport text or another written value."),
        example: null,
      };
    }

    if (field.fieldType === "checkbox" && isDeclaration) {
      return {
        summary: zh
          ? `“${label}”是声明或同意项：请核对陈述真实且你愿意承担相应责任后再勾选。`
          : `“${label}” is a declaration or consent: select it only after confirming the statement is true and you accept the stated responsibility.`,
        sourceHint: configuredHelper ?? (zh
          ? "请先复核本申请的答案和材料；勾选本身就是你的确认，不需要另填示例文字。"
          : "Review the application's answers and evidence first; selecting the box is the confirmation, so no sample text is needed."),
        example: null,
      };
    }

    if (field.fieldType === "checkbox") {
      return {
        summary: zh
          ? `“${label}”是勾选项：只有题目描述确实适用于你时才勾选。`
          : `“${label}” is a checkbox: select it only when the statement actually applies to you.`,
        sourceHint: configuredHelper ?? (zh
          ? "请根据当前题目、实际情况和相关材料判断；不适用时保持未勾选。"
          : "Decide from the current question, your actual circumstances, and relevant records; leave it clear when it does not apply."),
        example: null,
      };
    }

    if (field.fieldType === "multi_select") {
      return {
        summary: zh
          ? `“${label}”要求从给出的选项中选出所有符合实际情况的项目。`
          : `“${label}” asks you to select every listed option that truthfully applies.`,
        sourceHint: configuredHelper ?? (zh
          ? "请逐项核对题目范围和时间范围，不要漏选，也不要选择不适用项。"
          : "Check each option against the question and its time period; include all that apply and no others."),
        example: null,
      };
    }

    if (/passport_holder_type|travel_document_holder|护照持有人|旅行证件持有人/.test(searchText)) {
      return {
        summary: zh
          ? `“${label}”问的是你持有的护照/旅行证件类别，不是另一个国籍填写框。`
          : `“${label}” asks which passport or travel-document holder category applies, not for a second nationality entry.`,
        sourceHint: configuredHelper ?? (zh
          ? "请按你此次旅行实际使用的证件，在页面提供的持有人类别中选择。"
          : "Choose the holder category that matches the travel document used for this trip."),
        example: null,
      };
    }

    const isCountrySelector = field.fieldType === "country" || (
      field.fieldType === "select" && (
        /country|nationality|citizenship|国家|国籍|公民身份/.test(searchText) ||
        field.validationRules?.source === "ISO3166-1" ||
        field.validationRules?.canonical_source === "official_country_code"
      )
    );
    if (isCountrySelector) {
      return {
        summary: zh
          ? `“${label}”要求选择题目所指的国家或地区。`
          : `“${label}” asks for the country or region described by the question.`,
        sourceHint: configuredHelper ?? (zh
          ? "请先分清题目问的是国籍、出生地、居住地、出发地还是目的地，再从官方列表选择。"
          : "First distinguish whether the question means nationality, birthplace, residence, departure point, or destination, then choose from the official list."),
        example: null,
      };
    }

    const options = field.options?.slice(0, 5).map((option) => explanationOptionLabel(option, locale)) ?? [];
    const isYesNo = options.length === 2 && options.some((option) => /^(?:yes|是|有)$/i.test(option)) &&
      options.some((option) => /^(?:no|否|无|沒有|没有)$/i.test(option));
    return {
      summary: isYesNo
        ? zh
          ? `“${label}”是事实判断题：题目描述符合实际选“是”，不符合选“否”。`
          : `“${label}” is a factual yes/no question: choose Yes only when the statement is true, otherwise choose No.`
        : zh
          ? `“${label}”要求从官方选项中选择最符合你实际情况的一项。`
          : `“${label}” asks you to choose the official option that best matches your actual situation.`,
      sourceHint: configuredHelper ?? (zh
        ? "请用自己的话直接回答真实情况；我会将答案对应到官方选项。不确定时不要猜。"
        : "Reply in your own words with the facts that apply; I will map the answer to the official options. Do not guess when unsure."),
      example: null,
    };
  }

  if (isAddressLineOne) {
    return {
      summary: zh
        ? `“${label}”是地址的主要一行，通常填写门牌号、街道名，以及需要时的楼栋或公寓号。`
        : `“${label}” is the main street-address line: usually the building or house number, street, and apartment or unit when needed.`,
      sourceHint: configuredHelper ?? (isAccommodationAddress
        ? zh
          ? "一般可从酒店预订单、租赁确认单或邀请人提供的住址中找到。城市、省份和邮编如有单独栏目，不要重复填写。"
          : "Find it on the hotel booking, rental confirmation, or host address. Leave the city, state, and postal code for separate fields when shown."
        : zh
          ? "请以住址证明、账单或其他正式地址记录为准。城市、省份和邮编如有单独栏目，不要重复填写。"
          : "Use an address document, bill, or other formal address record. Leave the city, state, and postal code for separate fields when shown."),
      example: null,
    };
  }

  if (!/email|e-mail|邮箱|電子郵件/.test(searchText) && /address|street|地址/.test(searchText)) {
    return {
      summary: zh
        ? `“${label}”要求填写完整、可识别的地址，并与相关证明材料一致。`
        : `“${label}” asks for a complete, identifiable address that matches the relevant supporting record.`,
      sourceHint: configuredHelper ?? (isAccommodationAddress
        ? zh ? "请查看酒店预订单、租赁确认单或邀请人提供的地址。" : "Use the hotel booking, rental confirmation, or address supplied by the host."
        : zh ? "请以住址证明、账单或正式地址记录为准。" : "Use an address document, bill, or formal address record."),
      example: null,
    };
  }

  if ((/issuing.?authority|签发机关/.test(searchText) && /place.?of.?issue|签发地点/.test(searchText)) ||
    /place.?of.?issue.*(?:city|authority)|city.*authority/.test(searchText)) {
    return {
      summary: zh
        ? `“${label}”合并询问护照签发机关或签发地点，请按当前护照资料页对应栏位的原文填写。`
        : `“${label}” combines issuing authority or place of issue; copy the corresponding wording from the current passport biodata page.`,
      sourceHint: configuredHelper ?? (zh
        ? "不要根据办理城市、领取城市、国籍或目的地推断；以护照实际印字为准。"
        : "Do not infer it from the application city, pickup city, nationality, or destination; use what the passport actually prints."),
      example: null,
    };
  }

  if (/issuing.?authority|签发机关/.test(searchText)) {
    return {
      summary: zh
        ? `“${label}”是证件上的签发机关名称，不是签发地点。`
        : `“${label}” is the issuing authority printed on the document, not the place of issue.`,
      sourceHint: configuredHelper ?? (zh ? "请照抄护照资料页的 Authority/签发机关原文。" : "Copy the Authority or Issuing authority exactly from the passport biodata page."),
      example: null,
    };
  }

  if (/place.?of.?issue|签发地点/.test(searchText)) {
    return {
      summary: zh
        ? `“${label}”是证件显示的签发地点，不是签发机关名称。`
        : `“${label}” is the place where the document was issued, not the issuing authority.`,
      sourceHint: configuredHelper ?? (zh ? "请照抄护照资料页的 Place of issue/签发地点原文。" : "Copy the Place of issue exactly from the passport biodata page."),
      example: null,
    };
  }

  if (/passport.*number|document.*number|护照号码|证件号码/.test(searchText)) {
    return {
      summary: zh ? `“${label}”是护照或旅行证件上的唯一号码。` : `“${label}” is the unique number printed on the passport or travel document.`,
      sourceHint: configuredHelper ?? (zh ? "请从护照资料页照抄，并核对字母和数字。" : "Copy it from the passport biodata page and double-check every letter and digit."),
      example: null,
    };
  }

  if (/name_chinese|chinese.?name|中文姓名|中文名字/.test(searchText)) {
    return {
      summary: zh ? `“${label}”要求填写证件或官方记录使用的中文姓名。` : `“${label}” asks for the Chinese-script name used by the identity document or official record.`,
      sourceHint: configuredHelper ?? (zh ? "请按页面要求使用繁体或简体中文，不要填写拼音或自行翻译的姓名。" : "Follow the form's required Traditional or Simplified Chinese script; do not enter romanization or invent a translation."),
      example: null,
    };
  }

  if (/surname|family.?name|given.?name|first.?name|full.?name|姓氏|名字|姓名/.test(searchText)) {
    return {
      summary: zh ? `“${label}”要求填写证件上对应的姓名部分。` : `“${label}” asks for the corresponding part of the name on the identity document.`,
      sourceHint: configuredHelper ?? (zh ? "请按护照资料页的英文或罗马字拼写原样填写，不要自行翻译。" : "Copy the English or romanized spelling exactly from the passport biodata page."),
      example: null,
    };
  }

  if (field.fieldType === "date" || /date|日期/.test(searchText)) {
    return {
      summary: zh ? `“${label}”要求填写该事件的准确日期。` : `“${label}” asks for the exact date of that event.`,
      sourceHint: configuredHelper ?? (zh ? "请以护照、预订单、行程或相关官方记录上的日期为准。" : "Use the date shown in the relevant passport, booking, itinerary, or official record."),
      example: getFieldDateExample(field),
    };
  }

  if (/email|e-mail|邮箱|電子郵件/.test(searchText) || field.fieldType === "email") {
    return {
      summary: zh ? `“${label}”要求填写能正常收信的电子邮箱地址。` : `“${label}” asks for an email address that can reliably receive messages.`,
      sourceHint: configuredHelper ?? (zh ? "请使用你可访问的邮箱，并在提交前核对拼写。" : "Use an inbox you can access and double-check the spelling before submission."),
      example: field.validationRules?.use_viza_alias_email === true ? null : "name@example.com",
    };
  }

  if (/phone|telephone|mobile|电话|手機|手机/.test(searchText) || field.fieldType === "tel") {
    const isCountryCode = /country.?code|calling.?code|国家.*代码|地区.*代码/.test(searchText);
    return {
      summary: isCountryCode
        ? zh ? `“${label}”只填写该联系电话对应的国家/地区国际区号。` : `“${label}” asks only for the country or region calling code of that contact number.`
        : zh ? `“${label}”要求填写可联系到你的电话号码。` : `“${label}” asks for a telephone number where you can be reached.`,
      sourceHint: configuredHelper ?? (isCountryCode
        ? zh ? "请使用这部电话实际所属的国际区号；是否保留“+”请严格按页面格式。" : "Use the calling code that actually belongs to this phone; include or omit “+” exactly as the form requires."
        : zh ? "请分清国家/地区代码和本地号码；如页面分栏，请不要重复区号。" : "Keep the country/region code separate from the local number when the form provides separate fields."),
      example: null,
    };
  }

  if (field.fieldType === "file") {
    return {
      summary: zh ? `“${label}”要求上传与该材料名称相符的清晰、完整文件。` : `“${label}” asks for a clear, complete file matching this document requirement.`,
      sourceHint: configuredHelper ?? (zh ? "请使用真实证件或支持材料，并以页面显示的文件格式和大小限制为准。" : "Use the real document or supporting material and follow the displayed file-type and size limits."),
      example: null,
    };
  }

  if (field.fieldType === "textarea") {
    return {
      summary: zh ? `“${label}”要求用简洁文字说明与本次申请相关的事实。` : `“${label}” asks for a concise factual explanation relevant to this application.`,
      sourceHint: configuredHelper ?? (zh ? "请根据行程、支持材料或真实经历作答，不要添加无关信息。" : "Answer from the itinerary, supporting documents, or actual events without unrelated detail."),
      example: null,
    };
  }

  return {
    summary: zh ? `“${label}”要求填写与你本人或本次行程对应的准确内容。` : `“${label}” asks for the exact information that applies to you or this trip.`,
    sourceHint: configuredHelper ?? (zh ? "请以相关证件、预订单、行程或官方记录为准，不确定时不要猜。" : "Use the relevant document, booking, itinerary, or official record rather than guessing."),
    example: null,
  };
}

export function buildFieldClarificationFallback(
  field: FieldExplanationTarget,
  locale: string,
): string {
  const explanation = buildFieldExplanation(field, locale);
  const example = explanation.example
    ? locale.startsWith("zh") ? `格式示例：${explanation.example}。` : `Format example: ${explanation.example}.`
    : "";
  const reviewedChoices = buildReviewedChoiceAnswerHint(field, locale);
  return [explanation.summary, explanation.sourceHint, reviewedChoices, example].filter(Boolean).join(" ");
}

function normalizeClarificationText(value: string): string {
  return value.toLocaleLowerCase().replace(/[\s.!?。！？，,；;:：“”"'‘’—_-]/g, "");
}

export function isUsefulFieldClarificationReply(
  reply: string | null | undefined,
  question: string,
  field: FieldExplanationTarget,
): boolean {
  if (!reply?.trim()) return false;
  if (/\b(?:choose|select|click|find)\b.{0,50}\b(?:option|dropdown|button|control)\b/i.test(reply)) return false;
  if (/identifies which official category matches your situation/i.test(reply)) return false;
  const normalizedReply = normalizeClarificationText(reply);
  const normalizedQuestion = normalizeClarificationText(question);
  const normalizedLabel = normalizeClarificationText(field.label);
  if (!normalizedReply || normalizedReply === normalizedQuestion) return false;
  if (new Set([
    `请告诉我${normalizedLabel}`,
    `请填写${normalizedLabel}`,
    `请确认${normalizedLabel}`,
    `whatshouldienterfor${normalizedLabel}`,
    `pleasetellme${normalizedLabel}`,
  ]).has(normalizedReply)) return false;
  const includesExample = /例如|示例|比如|选项包括|for example|format example|such as|available (?:choices|options)/i.test(reply);
  const includesSource = /护照|证件|预订单|确认单|行程|记录|材料|选项|官方|passport|document|booking|confirmation|itinerary|record|official option/i.test(reply);
  return includesExample && includesSource;
}

export const SGAC_ICA_SOURCES: FormAssistantSource[] = [
  {
    title: "ICA | SG Arrival Card (SGAC) with Electronic Health Declaration",
    url: "https://www.ica.gov.sg/enter-transit-depart/entering-singapore/sg-arrival-card",
  },
];

export const KOREA_E_ARRIVAL_SOURCES: FormAssistantSource[] = [
  {
    title: "Korea e-Arrival Card | Official immigration portal",
    url: "https://www.e-arrivalcard.go.kr/portal/",
  },
];

export function isFormAssistantEnabled(visaType: string | null | undefined): boolean {
  const normalized = (visaType ?? "").trim().toUpperCase();
  return /^[A-Z0-9][A-Z0-9_-]{0,127}$/.test(normalized);
}

export function canUseFormAssistant(params: {
  applicationId: string | null | undefined;
  visaType: string | null | undefined;
  schemaFieldCount: number;
}): boolean {
  return Boolean(
    params.applicationId &&
    params.schemaFieldCount > 0 &&
    isFormAssistantEnabled(params.visaType),
  );
}

export function getFormAssistantFallbackSources(
  country: string | null | undefined,
  visaType: string | null | undefined,
): FormAssistantSource[] {
  const normalizedCountry = (country ?? "").trim().toLowerCase();
  const normalizedVisaType = (visaType ?? "").trim().toUpperCase();
  if (["singapore", "sg", "新加坡"].includes(normalizedCountry) && normalizedVisaType === "SG_ARRIVAL_CARD") {
    return SGAC_ICA_SOURCES;
  }
  if (["south_korea", "south-korea", "korea", "kr", "韩国"].includes(normalizedCountry) &&
    normalizedVisaType === "KR_E_ARRIVAL_CARD") {
    return KOREA_E_ARRIVAL_SOURCES;
  }
  return [];
}
