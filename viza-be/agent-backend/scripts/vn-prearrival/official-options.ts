export interface VnPrearrivalOption {
  value: string;
  text: string;
  label_en: string;
  label_zh: string;
  official_label: string;
  code?: string;
  airport?: string;
  airline?: string;
}

export function vnPrearrivalOption(
  value: string,
  labelZh: string,
  officialLabel: string,
  extra: Partial<Pick<VnPrearrivalOption, "code" | "airport" | "airline">> = {},
): VnPrearrivalOption {
  return {
    value,
    text: officialLabel,
    label_en: officialLabel,
    label_zh: labelZh,
    official_label: officialLabel,
    ...extra,
  };
}

export const VN_PREARRIVAL_GENDER_OPTIONS = [
  vnPrearrivalOption("male", "男", "Male"),
  vnPrearrivalOption("female", "女", "Female"),
  vnPrearrivalOption("other", "其他", "Other"),
];

export const VN_PREARRIVAL_PASSPORT_TYPE_OPTIONS = [
  vnPrearrivalOption("P", "普通护照", "P - Popular Passport"),
  vnPrearrivalOption("PO", "公务 / 因公护照", "PO - Official/Public Service"),
  vnPrearrivalOption("PD", "外交护照", "PD - Diplomatic Passport"),
];

export const VN_PREARRIVAL_PURPOSE_OPTIONS = [
  vnPrearrivalOption("business_trip", "商务出行", "Business trip"),
  vnPrearrivalOption("travel", "旅行", "Travel"),
  vnPrearrivalOption("study_abroad", "留学", "Study abroad"),
  vnPrearrivalOption("work", "工作", "Work"),
  vnPrearrivalOption("transit", "过境", "Transit"),
  vnPrearrivalOption("other", "其他", "Other"),
];

export const VN_PREARRIVAL_TRAVEL_MODE_OPTIONS = [
  vnPrearrivalOption("air", "航空", "Air"),
  vnPrearrivalOption("land", "陆路", "Land"),
  vnPrearrivalOption("sea", "海路", "Sea"),
];

export const VN_PREARRIVAL_ACCOMMODATION_OPTIONS = [
  vnPrearrivalOption("hotel", "酒店", "Hotel"),
  vnPrearrivalOption("residential", "住宅", "Residential"),
  vnPrearrivalOption("others", "其他", "Others"),
];

export const VN_PREARRIVAL_AIRPORT_OPTIONS = [
  vnPrearrivalOption("SGN", "新山一国际机场", "Tan Son Nhat International Airport", { code: "SGN" }),
  vnPrearrivalOption("HAN", "内排国际机场", "Noi Bai International Airport", { code: "HAN" }),
  vnPrearrivalOption("DAD", "岘港国际机场", "Da Nang International Airport", { code: "DAD" }),
  vnPrearrivalOption("CXR", "金兰国际机场", "Cam Ranh International Airport", { code: "CXR" }),
  vnPrearrivalOption("PQC", "富国国际机场", "Phu Quoc International Airport", { code: "PQC" }),
];

export const VN_PREARRIVAL_FLIGHT_OPTIONS = [
  vnPrearrivalOption("UO0566_CXR", "UO0566 - CXR", "UO0566 - CXR", { airport: "CXR", airline: "UO" }),
  vnPrearrivalOption("VJ5439_CXR", "VJ5439 - CXR", "VJ5439 - CXR", { airport: "CXR", airline: "VJ" }),
  vnPrearrivalOption("VJ0824_DAD", "VJ0824 - DAD", "VJ0824 - DAD", { airport: "DAD", airline: "VJ" }),
  vnPrearrivalOption("Z20822_DAD", "Z20822 - DAD", "Z20822 - DAD", { airport: "DAD", airline: "Z2" }),
  vnPrearrivalOption("TR0510_DAD", "TR0510 - DAD", "TR0510 - DAD", { airport: "DAD", airline: "TR" }),
  vnPrearrivalOption("VZ0964_DAD", "VZ0964 - DAD", "VZ0964 - DAD", { airport: "DAD", airline: "VZ" }),
  vnPrearrivalOption("DV5342_DAD", "DV5342 - DAD", "DV5342 - DAD", { airport: "DAD", airline: "DV" }),
  vnPrearrivalOption("VJ0970_DAD", "VJ0970 - DAD", "VJ0970 - DAD", { airport: "DAD", airline: "VJ" }),
];

export const VN_PREARRIVAL_BORDER_GATE_OPTIONS = [
  vnPrearrivalOption("HQDONGDANG", "同登口岸", "Dong Dang Border Gate"),
];

export const VN_PREARRIVAL_PORT_OPTIONS = [
  vnPrearrivalOption("HPG", "海防港", "Hai Phong Port"),
  vnPrearrivalOption("CPH", "锦普港", "Cam Pha Port"),
  vnPrearrivalOption("NSN", "宜山港", "Nghi Son Port"),
  vnPrearrivalOption("CLN", "盖麟港", "Cai Lan Port"),
  vnPrearrivalOption("DAD", "岘港港", "Da Nang Port"),
  vnPrearrivalOption("CMY", "真美港", "Chan May Port"),
  vnPrearrivalOption("QNH", "归仁港", "Quy Nhon Port"),
  vnPrearrivalOption("VAG", "永昂港", "Vung Ang Port"),
  vnPrearrivalOption("NTR", "芽庄港", "Nha Trang Port"),
  vnPrearrivalOption("SGP", "西贡港", "Saigon Port"),
  vnPrearrivalOption("VDT", "头顿港", "Vung Tau Port"),
  vnPrearrivalOption("DGN", "杨东港", "Duong Dong Port"),
  vnPrearrivalOption("HON", "鸿盖港", "Hon Gai Port"),
  vnPrearrivalOption("PQC", "富国港", "Phu Quoc Port"),
];

export const VN_PREARRIVAL_VISA_TYPE_OPTIONS = [
  vnPrearrivalOption("GMTT", "免签证书", "Visa Exemption Certificate"),
  vnPrearrivalOption("EV", "电子签证", "Electronic Visa (E-Visa)"),
  vnPrearrivalOption("MMT", "按国籍默认免签", "Default visa exemption by country"),
  vnPrearrivalOption("MTTQ", "富国免签", "Phu Quoc Visa Exemption"),
  vnPrearrivalOption("TDL", "旅行卡", "Travel Card"),
  vnPrearrivalOption("ABTC", "APEC 商务旅行卡", "ABTC Card"),
  vnPrearrivalOption("TTR", "永久居留卡", "Permanent Residence Card"),
  vnPrearrivalOption("TTA", "临时居留卡", "Temporary Residence Card"),
];
