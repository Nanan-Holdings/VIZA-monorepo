export interface VnPrearrivalOption {
  value: string;
  text: string;
  label_en: string;
  label_zh: string;
  official_label: string;
}

export function vnPrearrivalOption(value: string, labelZh: string, officialLabel: string): VnPrearrivalOption {
  return {
    value,
    text: officialLabel,
    label_en: officialLabel,
    label_zh: labelZh,
    official_label: officialLabel,
  };
}

export const VN_PREARRIVAL_YES_NO_OPTIONS = [
  vnPrearrivalOption("yes", "是", "Yes"),
  vnPrearrivalOption("no", "否", "No"),
];

export const VN_PREARRIVAL_SEX_OPTIONS = [
  vnPrearrivalOption("male", "男", "Male"),
  vnPrearrivalOption("female", "女", "Female"),
  vnPrearrivalOption("other", "其他", "Other"),
];

export const VN_PREARRIVAL_ENTRY_PORT_OPTIONS = [
  vnPrearrivalOption("tan_son_nhat_int_airport", "新山一国际机场（胡志明市）", "Tan Son Nhat International Airport"),
  vnPrearrivalOption("noi_bai_int_airport", "内排国际机场（河内）", "Noi Bai International Airport"),
  vnPrearrivalOption("da_nang_int_airport", "岘港国际机场", "Da Nang International Airport"),
  vnPrearrivalOption("other", "其他官方口岸", "Other official border gate"),
];

export const VN_PREARRIVAL_TRANSPORT_MODE_OPTIONS = [
  vnPrearrivalOption("air", "航空", "Air"),
  vnPrearrivalOption("land", "陆路", "Land"),
  vnPrearrivalOption("sea", "海路", "Sea"),
];

export const VN_PREARRIVAL_ENTRY_PERMISSION_OPTIONS = [
  vnPrearrivalOption("evisa", "电子签证", "E-visa"),
  vnPrearrivalOption("visa_exemption", "免签", "Visa exemption"),
  vnPrearrivalOption("visa_exemption_certificate", "五年免签证书 / 免签证明", "Visa exemption certificate"),
  vnPrearrivalOption("visa_on_arrival", "落地签批文", "Visa on arrival approval"),
  vnPrearrivalOption("other", "其他", "Other"),
];

export const VN_PREARRIVAL_PURPOSE_OPTIONS = [
  vnPrearrivalOption("tourism", "旅游", "Tourism"),
  vnPrearrivalOption("business", "商务", "Business"),
  vnPrearrivalOption("visiting_relatives", "探亲访友", "Visiting relatives"),
  vnPrearrivalOption("work", "工作", "Work"),
  vnPrearrivalOption("study", "学习", "Study"),
  vnPrearrivalOption("transit", "过境", "Transit"),
  vnPrearrivalOption("other", "其他", "Other"),
];
