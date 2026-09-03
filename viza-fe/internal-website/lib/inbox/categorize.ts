/**
 * Heuristic categorisation for inbound applicant mail.
 *
 * The folder tabs on /client/settings/inbox group mail into the fixed
 * categories below. Classification is deterministic and runs at read time so
 * historical rows never need a backfill; when the AI reading pass stores a
 * better judgment on the row (`ai_meta.category`), that value wins over the
 * heuristic in the server action.
 */

export const INBOX_CATEGORIES = [
  "embassy",
  "appointment",
  "documents",
  "payment",
  "approved",
  "rejected",
  "travel",
  "viza",
  "other",
] as const;

export type InboxCategory = (typeof INBOX_CATEGORIES)[number];

export function isInboxCategory(value: unknown): value is InboxCategory {
  return (
    typeof value === "string" &&
    (INBOX_CATEGORIES as readonly string[]).includes(value)
  );
}

const OFFICIAL_SENDER =
  /(\.gov(\.|$)|\.go\.[a-z]{2}|\.gob(\.|$)|embassy|consulate|consular|immigration|mofa|kemlu|ukvi|uscis|vfsglobal|vfshelpline|tlscontact|blsinternational|cgifederal|evisa)/i;

const APPOINTMENT_TEXT =
  /(appointment|biometric|interview|time slot|reschedul|预约|面签|面试|生物识别|采集指纹|cita|lịch hẹn|phỏng vấn)/i;

const PAYMENT_TEXT =
  /(receipt|invoice|payment|refund|charge|billing|\bfee\b|付款|支付|收据|发票|费用|退款|recibo|factura|pago|hóa đơn|thanh toán|biên lai)/i;

const APPROVED_TEXT =
  /(visa (is |has been |was )?(issued|approved|granted)|approved\b.*\bvisa|passport ready|collection|获批|签发|已批准|护照领取|aprobad|visado emitido|đã được cấp|đã duyệt)/i;

const REJECTED_TEXT =
  /(refus|reject|denied|cannot be processed|unsuccessful|further evidence|insufficient|拒签|被拒|退回|不予|rechazad|denegad|từ chối|bị bác)/i;

const DOCUMENTS_TEXT =
  /(document(s)? (is |are )?(required|missing|outstanding|needed)|additional document|supporting document|incomplete|declaration|bank statement|please (submit|provide|upload)|补充材料|所需文件|缺少|请提交|请提供|documentaci[oó]n|falta|bổ sung|giấy tờ|tài liệu)/i;

const TRAVEL_SENDER =
  /(airline|airways|airasia|singaporeair|emirates|qatarairways|cathaypacific|jetstar|scoot|booking\.com|agoda|expedia|trip\.com|airbnb|klook|hotels?\.)/i;

const TRAVEL_TEXT =
  /(booking (is )?confirmed|itinerary|e-?ticket|flight [A-Z]{2}\s?\d|check-in opens|boarding|行程|航班|机票|订单确认|itinerario|vuelo|chuyến bay|vé máy bay)/i;

const NEEDS_ACTION_TEXT =
  /(action (is )?required|required|needed|deadline|within \d+ (calendar |working |business )?days|before \d|by \d|expires?|请于|之前|天内|逾期|尽快|requerid|antes del|trong vòng|trước ngày|hạn chót)/i;

export interface CategorizeInput {
  fromAddr: string;
  subject: string | null;
  snippet?: string | null;
}

export interface CategorizeResult {
  category: InboxCategory;
  needsAction: boolean;
}

export function categorizeInboundEmail({
  fromAddr,
  subject,
  snippet,
}: CategorizeInput): CategorizeResult {
  const from = (fromAddr ?? "").toLowerCase();
  const fromDomain = from.split("@")[1] ?? from;
  const text = `${subject ?? ""} ${snippet ?? ""}`;

  const officialSender = OFFICIAL_SENDER.test(from);

  let category: InboxCategory;
  if (/(^|[.@])viza\.[a-z.]+$/.test(fromDomain) || fromDomain === "viza.sg") {
    category = "viza";
  } else if (REJECTED_TEXT.test(text)) {
    category = "rejected";
  } else if (APPROVED_TEXT.test(text)) {
    category = "approved";
  } else if (DOCUMENTS_TEXT.test(text)) {
    category = "documents";
  } else if (APPOINTMENT_TEXT.test(text)) {
    category = "appointment";
  } else if (PAYMENT_TEXT.test(text)) {
    category = "payment";
  } else if (TRAVEL_SENDER.test(from) || TRAVEL_TEXT.test(text)) {
    category = "travel";
  } else if (officialSender) {
    category = "embassy";
  } else {
    category = "other";
  }

  const needsAction =
    category === "documents" ||
    category === "rejected" ||
    ((category === "embassy" ||
      category === "appointment" ||
      category === "approved") &&
      NEEDS_ACTION_TEXT.test(text));

  return { category, needsAction };
}

/**
 * The "Embassies" folder groups every official-outcome category, mirroring the
 * approved design: raw embassy mail plus approvals and refusals.
 */
export const EMBASSY_FOLDER_CATEGORIES: readonly InboxCategory[] = [
  "embassy",
  "approved",
  "rejected",
];
