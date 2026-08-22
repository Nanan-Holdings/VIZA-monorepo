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

function explanationOptionLabel(option: VisaFormFieldOption, locale: string): string {
  if (typeof option === "string") return option;
  return locale.startsWith("zh")
    ? option.label_zh?.trim() || option.label_en?.trim() || option.text?.trim() || option.value
    : option.label_en?.trim() || option.text?.trim() || option.official_label?.trim() || option.value;
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
    ? "如果用户询问当前字段是什么意思、应该填写什么或如何填写，不得把问题当作字段答案。必须直接解释该字段要收集什么以及通常应从哪里获取。只有字段元数据明确支持时才给格式示例；选择、勾选、声明、同意项不得给文字填写示例，不确定时不得猜测。不得只是改写或重复当前问题，也不得使用固定套话。"
    : "If the user asks what the current field means, what belongs there, or how to answer it, never treat the question as a field answer. Directly explain what the field collects and where the applicant would normally find it. Give a format example only when the field metadata supports it; never give text-entry examples for choices, acknowledgements, declarations, or consents, and never guess when uncertain. Do not merely paraphrase or repeat the current question, and do not use canned filler.";
}

export function buildFieldExplanation(
  field: FieldExplanationTarget,
  locale: string,
): FieldExplanation {
  const zh = locale.startsWith("zh");
  const label = field.label.trim() || (zh ? "当前字段" : "this field");
  const searchText = `${field.fieldName} ${field.label}`.toLocaleLowerCase();
  const configuredHelper = localizedRuleText(field, locale, "helper");
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
        ? "请根据题目语义、真实情况和相关材料选择，不确定时不要随便选默认项。"
        : "Choose from the question's meaning, your actual circumstances, and relevant records; do not pick a default when unsure."),
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
  return [explanation.summary, explanation.sourceHint, example].filter(Boolean).join(" ");
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
