export interface TdacOption {
  value: string;
  text: string;
  label_zh: string;
  label_en: string;
  official_label: string;
}

const option = (value: string, labelZh: string, labelEn: string, official = labelEn): TdacOption => ({
  value,
  text: labelEn,
  label_zh: labelZh,
  label_en: labelEn,
  official_label: official,
});

export const TDAC_GENDER_OPTIONS = [
  option("female", "女", "FEMALE"),
  option("male", "男", "MALE"),
  option("undefined", "未定义", "UNDEFINED"),
];

export const TDAC_TRAVEL_MODE_OPTIONS = [
  option("air", "航空", "AIR"),
  option("land", "陆路", "LAND"),
  option("sea", "海路", "SEA"),
];

export const TDAC_AIR_TRANSPORT_OPTIONS = [
  option("commercial_flight", "商业航班", "COMMERCIAL FLIGHT"),
  option("private_cargo_airline", "私人/货运航空或其他航空", "PRIVATE/CARGO AIRLINE"),
  option("others", "其他（请说明）", "OTHERS (PLEASE SPECIFY)"),
];

export const TDAC_LAND_TRANSPORT_OPTIONS = [
  option("bus", "巴士", "BUS"),
  option("car", "汽车", "CAR"),
  option("lorry", "货车", "LORRY"),
  option("motorcycle", "摩托车", "MOTORCYCLE"),
  option("rail", "铁路", "RAIL"),
  option("van", "面包车", "VAN"),
  option("others", "其他（请说明）", "OTHERS (PLEASE SPECIFY)"),
];

export const TDAC_SEA_TRANSPORT_OPTIONS = [
  option("cruise", "邮轮", "CRUISE"),
  option("commercial_vessel", "商业船舶", "COMMERCIAL VESSEL"),
  option("others", "其他（请说明）", "OTHERS (PLEASE SPECIFY)"),
];

export const TDAC_PURPOSE_OPTIONS = [
  option("holiday", "度假", "HOLIDAY"),
  option("business", "商务", "BUSINESS"),
  option("education", "教育", "EDUCATION"),
  option("employment", "工作", "EMPLOYMENT"),
  option("meeting", "会议", "MEETING"),
  option("medical", "医疗", "MEDICAL"),
  option("return_resident", "返回居住地", "RETURN RESIDENT"),
  option("transit", "过境", "TRANSIT"),
  option("others", "其他（请说明）", "OTHERS (PLEASE SPECIFY)"),
];

export const TDAC_ACCOMMODATION_OPTIONS = [
  option("hotel", "酒店", "HOTEL"),
  option("youth_hostel", "青年旅舍", "YOUTH HOSTEL"),
  option("guest_house", "旅馆/民宿", "GUEST HOUSE"),
  option("friends_house", "朋友家", "FRIEND'S HOUSE"),
  option("apartment", "公寓", "APARTMENT"),
  option("others", "其他（请说明）", "OTHERS (PLEASE SPECIFY)"),
];

export const TDAC_COUNTRY_OPTIONS = [
  option("AFG", "阿富汗", "AFG : AFGHANISTAN", "AFG : AFGHANISTAN"),
  option("ALA", "奥兰群岛", "ALA : ALAND ISLANDS", "ALA : ALAND ISLANDS"),
  option("ALB", "阿尔巴尼亚", "ALB : ALBANIA", "ALB : ALBANIA"),
  option("DZA", "阿尔及利亚", "DZA : ALGERIA", "DZA : ALGERIA"),
  option("ASM", "美属萨摩亚", "ASM : AMERICAN SAMOA", "ASM : AMERICAN SAMOA"),
  option("AND", "安道尔", "AND : ANDORRA", "AND : ANDORRA"),
  option("AGO", "安哥拉", "AGO : ANGOLA", "AGO : ANGOLA"),
  option("AIA", "安圭拉", "AIA : ANGUILLA", "AIA : ANGUILLA"),
  option("ATA", "南极洲", "ATA : ANTARCTICA", "ATA : ANTARCTICA"),
  option("ATG", "安提瓜和巴布达", "ATG : ANTIGUA AND BARBUDA", "ATG : ANTIGUA AND BARBUDA"),
  option("ARG", "阿根廷", "ARG : ARGENTINE REPUBLIC", "ARG : ARGENTINE REPUBLIC"),
  option("ARM", "亚美尼亚", "ARM : ARMENIA", "ARM : ARMENIA"),
  option("ABW", "阿鲁巴", "ABW : ARUBA", "ABW : ARUBA"),
  option("AUS", "澳大利亚", "AUS : AUSTRALIA", "AUS : AUSTRALIA"),
  option("AUT", "奥地利", "AUT : AUSTRIA", "AUT : AUSTRIA"),
  option("AZE", "阿塞拜疆", "AZE : AZERBAIJAN", "AZE : AZERBAIJAN"),
  option("BHS", "巴哈马", "BHS : BAHAMAS", "BHS : BAHAMAS"),
  option("BHR", "巴林", "BHR : BAHRAIN", "BHR : BAHRAIN"),
  option("BGD", "孟加拉国", "BGD : BANGLADESH", "BGD : BANGLADESH"),
  option("BRB", "巴巴多斯", "BRB : BARBADOS", "BRB : BARBADOS"),
  option("BLR", "白俄罗斯", "BLR : BELARUS", "BLR : BELARUS"),
  option("BEL", "比利时", "BEL : BELGIUM", "BEL : BELGIUM"),
  option("BRA", "巴西", "BRA : BRAZIL", "BRA : BRAZIL"),
  option("KHM", "柬埔寨", "KHM : CAMBODIA", "KHM : CAMBODIA"),
  option("CAN", "加拿大", "CAN : CANADA", "CAN : CANADA"),
  option("CHN", "中国", "CHN : CHINA", "CHN : CHINA"),
  option("HKG", "中国香港", "HKG : HONG KONG", "HKG : HONG KONG"),
  option("MAC", "中国澳门", "MAC : MACAO", "MAC : MACAO"),
  option("TWN", "中国台湾", "TWN : TAIWAN", "TWN : TAIWAN"),
  option("FRA", "法国", "FRA : FRANCE", "FRA : FRANCE"),
  option("DEU", "德国", "DEU : GERMANY", "DEU : GERMANY"),
  option("IND", "印度", "IND : INDIA", "IND : INDIA"),
  option("IDN", "印度尼西亚", "IDN : INDONESIA", "IDN : INDONESIA"),
  option("ITA", "意大利", "ITA : ITALY", "ITA : ITALY"),
  option("JPN", "日本", "JPN : JAPAN", "JPN : JAPAN"),
  option("KOR", "韩国", "KOR : KOREA", "KOR : KOREA"),
  option("LAO", "老挝", "LAO : LAOS", "LAO : LAOS"),
  option("MYS", "马来西亚", "MYS : MALAYSIA", "MYS : MALAYSIA"),
  option("MMR", "缅甸", "MMR : MYANMAR", "MMR : MYANMAR"),
  option("NZL", "新西兰", "NZL : NEW ZEALAND", "NZL : NEW ZEALAND"),
  option("PHL", "菲律宾", "PHL : PHILIPPINES", "PHL : PHILIPPINES"),
  option("SGP", "新加坡", "SGP : SINGAPORE", "SGP : SINGAPORE"),
  option("ESP", "西班牙", "ESP : SPAIN", "ESP : SPAIN"),
  option("THA", "泰国", "THA : THAILAND", "THA : THAILAND"),
  option("TUR", "土耳其", "TUR : TURKIYE", "TUR : TURKIYE"),
  option("GBR", "英国", "GBR : UNITED KINGDOM", "GBR : UNITED KINGDOM"),
  option("USA", "美国", "USA : UNITED STATES OF AMERICA", "USA : UNITED STATES OF AMERICA"),
  option("VNM", "越南", "VNM : VIET NAM", "VNM : VIET NAM"),
];

export const TDAC_PROVINCE_OPTIONS = [
  option("amnat_charoen", "安纳乍能府", "AMNAT CHAROEN"),
  option("bangkok", "曼谷", "BANGKOK"),
  option("chiang_mai", "清迈府", "CHIANG MAI"),
  option("chon_buri", "春武里府", "CHON BURI"),
  option("krabi", "甲米府", "KRABI"),
  option("phuket", "普吉府", "PHUKET"),
  option("songkhla", "宋卡府", "SONGKHLA"),
  option("surat_thani", "素叻他尼府", "SURAT THANI"),
];

export const TDAC_DISTRICT_OPTIONS_BY_PROVINCE: Record<string, TdacOption[]> = {
  amnat_charoen: [option("mueang_amnat_charoen", "安纳乍能府直辖县", "MUEANG AMNAT CHAROEN")],
  bangkok: [
    option("pathum_wan", "巴吞旺区", "PATHUM WAN"),
    option("khlong_toei", "空堤区", "KHLONG TOEI"),
    option("bang_rak", "挽叻区", "BANG RAK"),
  ],
  chiang_mai: [option("mueang_chiang_mai", "清迈府直辖县", "MUEANG CHIANG MAI")],
  chon_buri: [option("bang_lamung", "邦拉蒙县", "BANG LAMUNG"), option("mueang_chon_buri", "春武里府直辖县", "MUEANG CHON BURI")],
  krabi: [option("mueang_krabi", "甲米府直辖县", "MUEANG KRABI")],
  phuket: [option("mueang_phuket", "普吉府直辖县", "MUEANG PHUKET"), option("kathu", "卡图区", "KATHU")],
  songkhla: [option("hat_yai", "合艾县", "HAT YAI"), option("mueang_songkhla", "宋卡府直辖县", "MUEANG SONGKHLA")],
  surat_thani: [option("ko_samui", "苏梅岛县", "KO SAMUI"), option("mueang_surat_thani", "素叻他尼府直辖县", "MUEANG SURAT THANI")],
};

export const TDAC_SUBDISTRICT_OPTIONS_BY_DISTRICT: Record<string, TdacOption[]> = {
  mueang_amnat_charoen: [option("non_pho", "农坡", "NON PHO")],
  pathum_wan: [option("lumphini", "伦披尼", "LUMPHINI"), option("rong_mueang", "荣孟", "RONG MUEANG")],
  khlong_toei: [option("khlong_toei", "空堤", "KHLONG TOEI")],
  bang_rak: [option("silom", "是隆", "SILOM")],
  mueang_chiang_mai: [option("si_phum", "西蒲", "SI PHUM")],
  bang_lamung: [option("nong_prue", "农普鲁", "NONG PRUE")],
  mueang_chon_buri: [option("ban_suan", "班算", "BAN SUAN")],
  mueang_krabi: [option("pak_nam", "巴南", "PAK NAM")],
  mueang_phuket: [option("talat_yai", "大市场", "TALAT YAI")],
  kathu: [option("patong", "芭东", "PATONG")],
  hat_yai: [option("hat_yai", "合艾", "HAT YAI")],
  mueang_songkhla: [option("bo_yang", "博央", "BO YANG")],
  ko_samui: [option("bo_phut", "波卜", "BO PHUT")],
  mueang_surat_thani: [option("talat", "达叻", "TALAT")],
};
