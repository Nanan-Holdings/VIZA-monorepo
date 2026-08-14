import type { FormAssistantSource } from "@/types/form-assistant";
import type { VisaFormFieldOption, VisaFormFieldRow } from "@/types/visa-form-fields";

type FieldExplanationTarget = Pick<
  VisaFormFieldRow,
  "fieldName" | "label" | "fieldType" | "required" | "placeholder" | "options"
>;

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

export function isFieldClarificationRequest(text: string): boolean {
  const normalized = text.trim().toLocaleLowerCase();
  return /(?:什么意思|什么含义|什么叫|指的是什么|是指什么|怎么填|该填什么|要填什么|填什么|没看懂|看不懂|解释一下|能否解释|能解释)/.test(normalized) ||
    /\b(?:what does .{0,80} mean|what do you mean|what is this asking|how (?:do|should) i (?:answer|fill)|what should i (?:enter|write)|which .{0,40} address|please explain|can you explain)\b/.test(normalized);
}

export function fieldClarificationInstruction(locale: string): string {
  return locale.startsWith("zh")
    ? "如果用户询问当前字段是什么意思、应该填写什么或如何填写，不得把问题当作字段答案。必须直接解释该字段要收集什么、通常应从哪里获取，并给出一个明确标注为示例的格式示例；不得只是改写或重复当前问题，也不得使用固定套话。"
    : "If the user asks what the current field means, what belongs there, or how to answer it, never treat the question as a field answer. Directly explain what the field collects, where the applicant would normally find it, and give one clearly labeled format example. Do not merely paraphrase or repeat the current question, and do not use canned filler.";
}

export function buildFieldExplanation(
  field: FieldExplanationTarget,
  locale: string,
): FieldExplanation {
  const zh = locale.startsWith("zh");
  const label = field.label.trim() || (zh ? "当前字段" : "this field");
  const searchText = `${field.fieldName} ${field.label}`.toLocaleLowerCase();
  const isAddressLineOne = /address.*(?:line_?1|street1)|(?:line_?1|street1).*address/.test(searchText) ||
    /地址.*(?:第?一行|第1行)/.test(searchText);
  const isAccommodationAddress = /accommodation|hotel|host|住宿|酒店|接待方/.test(searchText);

  if (isAddressLineOne) {
    return {
      summary: zh
        ? `“${label}”是地址的主要一行，通常填写门牌号、街道名，以及需要时的楼栋或公寓号。`
        : `“${label}” is the main street-address line: usually the building or house number, street, and apartment or unit when needed.`,
      sourceHint: isAccommodationAddress
        ? zh
          ? "一般可从酒店预订单、租赁确认单或邀请人提供的住址中找到。城市、省份和邮编如有单独栏目，不要重复填写。"
          : "Find it on the hotel booking, rental confirmation, or host address. Leave the city, state, and postal code for separate fields when shown."
        : zh
          ? "请以住址证明、账单或其他正式地址记录为准。城市、省份和邮编如有单独栏目，不要重复填写。"
          : "Use an address document, bill, or other formal address record. Leave the city, state, and postal code for separate fields when shown.",
      example: isAccommodationAddress ? "15 Rue de Rivoli, Appartement 3B" : "88 Nanjing West Road, Building 3, Unit 501",
    };
  }

  if (/address|street|地址/.test(searchText)) {
    return {
      summary: zh
        ? `“${label}”要求填写完整、可识别的地址，并与相关证明材料一致。`
        : `“${label}” asks for a complete, identifiable address that matches the relevant supporting record.`,
      sourceHint: isAccommodationAddress
        ? zh ? "请查看酒店预订单、租赁确认单或邀请人提供的地址。" : "Use the hotel booking, rental confirmation, or address supplied by the host."
        : zh ? "请以住址证明、账单或正式地址记录为准。" : "Use an address document, bill, or formal address record.",
      example: "10 Example Street, Example City",
    };
  }

  if (/issuing.?authority|签发机关/.test(searchText)) {
    return {
      summary: zh
        ? `“${label}”是证件上的签发机关名称，不是签发地点。`
        : `“${label}” is the issuing authority printed on the document, not the place of issue.`,
      sourceHint: zh ? "请照抄护照资料页的 Authority/签发机关原文。" : "Copy the Authority or Issuing authority exactly from the passport biodata page.",
      example: "National Immigration Administration, PRC",
    };
  }

  if (/place.?of.?issue|签发地点/.test(searchText)) {
    return {
      summary: zh
        ? `“${label}”是证件显示的签发地点，不是签发机关名称。`
        : `“${label}” is the place where the document was issued, not the issuing authority.`,
      sourceHint: zh ? "请照抄护照资料页的 Place of issue/签发地点原文。" : "Copy the Place of issue exactly from the passport biodata page.",
      example: "SHANGHAI",
    };
  }

  if (/passport.*number|document.*number|护照号码|证件号码/.test(searchText)) {
    return {
      summary: zh ? `“${label}”是护照或旅行证件上的唯一号码。` : `“${label}” is the unique number printed on the passport or travel document.`,
      sourceHint: zh ? "请从护照资料页照抄，并核对字母和数字。" : "Copy it from the passport biodata page and double-check every letter and digit.",
      example: "E12345678",
    };
  }

  if (/surname|family.?name|given.?name|first.?name|full.?name|姓氏|名字|姓名/.test(searchText)) {
    return {
      summary: zh ? `“${label}”要求填写证件上对应的姓名部分。` : `“${label}” asks for the corresponding part of the name on the identity document.`,
      sourceHint: zh ? "请按护照资料页的英文或罗马字拼写原样填写，不要自行翻译。" : "Copy the English or romanized spelling exactly from the passport biodata page.",
      example: /surname|family.?name|姓氏/.test(searchText) ? "ZHANG" : "XIAOMING",
    };
  }

  if (field.fieldType === "date" || /date|日期/.test(searchText)) {
    return {
      summary: zh ? `“${label}”要求填写该事件的准确日期。` : `“${label}” asks for the exact date of that event.`,
      sourceHint: zh ? "请以护照、预订单、行程或相关官方记录上的日期为准。" : "Use the date shown in the relevant passport, booking, itinerary, or official record.",
      example: "2026-09-15",
    };
  }

  if (field.options?.length) {
    const options = field.options.slice(0, 5).map((option) => explanationOptionLabel(option, locale));
    return {
      summary: zh ? `“${label}”要求从官方选项中选择最符合你实际情况的一项。` : `“${label}” asks you to choose the official option that best matches your situation.`,
      sourceHint: zh ? "请根据证件、行程或事实选择，不确定时不要随便选默认项。" : "Choose from your documents, travel plans, or facts; do not pick a default when unsure.",
      example: options.length <= 5 ? options.join(zh ? "、" : ", ") : null,
    };
  }

  if (field.fieldType === "file") {
    return {
      summary: zh ? `“${label}”要求上传与该材料名称相符的清晰、完整文件。` : `“${label}” asks for a clear, complete file matching this document requirement.`,
      sourceHint: zh ? "请使用真实证件或支持材料，并以页面显示的文件格式和大小限制为准。" : "Use the real document or supporting material and follow the displayed file-type and size limits.",
      example: null,
    };
  }

  if (field.fieldType === "textarea") {
    return {
      summary: zh ? `“${label}”要求用简洁文字说明与本次申请相关的事实。` : `“${label}” asks for a concise factual explanation relevant to this application.`,
      sourceHint: zh ? "请根据行程、支持材料或真实经历作答，不要添加无关信息。" : "Answer from the itinerary, supporting documents, or actual events without unrelated detail.",
      example: zh ? "说明相关日期、地点、人员和原因" : "State the relevant dates, places, people, and reason",
    };
  }

  return {
    summary: zh ? `“${label}”要求填写与你本人或本次行程对应的准确内容。` : `“${label}” asks for the exact information that applies to you or this trip.`,
    sourceHint: zh ? "请以相关证件、预订单、行程或官方记录为准，不确定时不要猜。" : "Use the relevant document, booking, itinerary, or official record rather than guessing.",
    example: field.placeholder?.trim() || null,
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
  return ["singapore", "sg", "新加坡"].includes(normalizedCountry) &&
    normalizedVisaType === "SG_ARRIVAL_CARD"
    ? SGAC_ICA_SOURCES
    : [];
}
