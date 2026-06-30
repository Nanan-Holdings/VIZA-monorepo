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
  option("car", "汽车", "CAR"),
  option("train", "火车", "TRAIN"),
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

const regionDisplayNames = {
  zh: new Intl.DisplayNames(["zh-CN"], { type: "region" }),
  en: new Intl.DisplayNames(["en"], { type: "region" }),
};

const countryLabel = (locale: "zh" | "en", alpha2: string): string => regionDisplayNames[locale].of(alpha2) ?? alpha2;

const countryOption = ([alpha3, alpha2]: readonly [string, string]): TdacOption => {
  const labelEn = `${alpha3} : ${countryLabel("en", alpha2).toUpperCase()}`;
  return option(alpha3, countryLabel("zh", alpha2), labelEn, labelEn);
};

const TDAC_COUNTRY_CODE_PAIRS = `
ABW:AW AFG:AF AGO:AO AIA:AI ALA:AX ALB:AL AND:AD ARE:AE ARG:AR ARM:AM ASM:AS ATA:AQ ATF:TF ATG:AG AUS:AU AUT:AT AZE:AZ
BDI:BI BEL:BE BEN:BJ BES:BQ BFA:BF BGD:BD BGR:BG BHR:BH BHS:BS BIH:BA BLM:BL BLR:BY BLZ:BZ BMU:BM BOL:BO BRA:BR BRB:BB BRN:BN BTN:BT BVT:BV BWA:BW
CAF:CF CAN:CA CCK:CC CHE:CH CHL:CL CHN:CN CIV:CI CMR:CM COD:CD COG:CG COK:CK COL:CO COM:KM CPV:CV CRI:CR CUB:CU CUW:CW CXR:CX CYM:KY CYP:CY CZE:CZ
DEU:DE DJI:DJ DMA:DM DNK:DK DOM:DO DZA:DZ ECU:EC EGY:EG ERI:ER ESH:EH ESP:ES EST:EE ETH:ET
FIN:FI FJI:FJ FLK:FK FRA:FR FRO:FO FSM:FM GAB:GA GBR:GB GEO:GE GGY:GG GHA:GH GIB:GI GIN:GN GLP:GP GMB:GM GNB:GW GNQ:GQ GRC:GR GRD:GD GRL:GL GTM:GT GUF:GF GUM:GU GUY:GY
HKG:HK HMD:HM HND:HN HRV:HR HTI:HT HUN:HU IDN:ID IMN:IM IND:IN IOT:IO IRL:IE IRN:IR IRQ:IQ ISL:IS ISR:IL ITA:IT
JAM:JM JEY:JE JOR:JO JPN:JP KAZ:KZ KEN:KE KGZ:KG KHM:KH KIR:KI KNA:KN KOR:KR KWT:KW LAO:LA LBN:LB LBR:LR LBY:LY LCA:LC LIE:LI LKA:LK LSO:LS LTU:LT LUX:LU LVA:LV
MAC:MO MAF:MF MAR:MA MCO:MC MDA:MD MDG:MG MDV:MV MEX:MX MHL:MH MKD:MK MLI:ML MLT:MT MMR:MM MNE:ME MNG:MN MNP:MP MOZ:MZ MRT:MR MSR:MS MTQ:MQ MUS:MU MWI:MW MYS:MY MYT:YT
NAM:NA NCL:NC NER:NE NFK:NF NGA:NG NIC:NI NIU:NU NLD:NL NOR:NO NPL:NP NRU:NR NZL:NZ OMN:OM PAK:PK PAN:PA PCN:PN PER:PE PHL:PH PLW:PW PNG:PG POL:PL PRI:PR PRK:KP PRT:PT PRY:PY PSE:PS PYF:PF
QAT:QA REU:RE ROU:RO RUS:RU RWA:RW SAU:SA SDN:SD SEN:SN SGP:SG SGS:GS SHN:SH SJM:SJ SLB:SB SLE:SL SLV:SV SMR:SM SOM:SO SPM:PM SRB:RS SSD:SS STP:ST SUR:SR SVK:SK SVN:SI SWE:SE SWZ:SZ SXM:SX SYC:SC SYR:SY
TCA:TC TCD:TD TGO:TG THA:TH TJK:TJ TKL:TK TKM:TM TLS:TL TON:TO TTO:TT TUN:TN TUR:TR TUV:TV TWN:TW TZA:TZ
UGA:UG UKR:UA UMI:UM URY:UY USA:US UZB:UZ VAT:VA VCT:VC VEN:VE VGB:VG VIR:VI VNM:VN VUT:VU WLF:WF WSM:WS YEM:YE ZAF:ZA ZMB:ZM ZWE:ZW
`
  .trim()
  .split(/\s+/)
  .map((pair): readonly [string, string] => {
    const [alpha3 = "", alpha2 = ""] = pair.split(":");
    return [alpha3, alpha2];
  });

export const TDAC_COUNTRY_OPTIONS = TDAC_COUNTRY_CODE_PAIRS.map(countryOption);

export const TDAC_PROVINCE_OPTIONS = [
  option("amnat_charoen", "安纳乍能府", "AMNAT CHAROEN"),
  option("ang_thong", "红统府", "ANG THONG"),
  option("bangkok", "曼谷", "BANGKOK"),
  option("bueng_kan", "汶干府", "BUENG KAN"),
  option("buri_ram", "武里南府", "BURI RAM"),
  option("chachoengsao", "北柳府", "CHACHOENGSAO"),
  option("chai_nat", "猜纳府", "CHAI NAT"),
  option("chaiyaphum", "猜也蓬府", "CHAIYAPHUM"),
  option("chanthaburi", "尖竹汶府", "CHANTHABURI"),
  option("chiang_mai", "清迈府", "CHIANG MAI"),
  option("chiang_rai", "清莱府", "CHIANG RAI"),
  option("chon_buri", "春武里府", "CHON BURI"),
  option("chumphon", "春蓬府", "CHUMPHON"),
  option("kalasin", "加拉信府", "KALASIN"),
  option("kamphaeng_phet", "甘烹碧府", "KAMPHAENG PHET"),
  option("kanchanaburi", "北碧府", "KANCHANABURI"),
  option("khon_kaen", "孔敬府", "KHON KAEN"),
  option("krabi", "甲米府", "KRABI"),
  option("lampang", "南邦府", "LAMPANG"),
  option("lamphun", "南奔府", "LAMPHUN"),
  option("loei", "黎府", "LOEI"),
  option("lop_buri", "华富里府", "LOP BURI"),
  option("mae_hong_son", "夜丰颂府", "MAE HONG SON"),
  option("maha_sarakham", "玛哈沙拉堪府", "MAHA SARAKHAM"),
  option("mukdahan", "穆达汉府", "MUKDAHAN"),
  option("nakhon_nayok", "那空那育府", "NAKHON NAYOK"),
  option("nakhon_pathom", "佛统府", "NAKHON PATHOM"),
  option("nakhon_phanom", "那空拍侬府", "NAKHON PHANOM"),
  option("nakhon_ratchasima", "呵叻府", "NAKHON RATCHASIMA"),
  option("nakhon_sawan", "那空沙旺府", "NAKHON SAWAN"),
  option("nakhon_si_thammarat", "洛坤府", "NAKHON SI THAMMARAT"),
  option("nan", "难府", "NAN"),
  option("narathiwat", "陶公府", "NARATHIWAT"),
  option("nong_bua_lam_phu", "廊磨喃蒲府", "NONG BUA LAM PHU"),
  option("nong_khai", "廊开府", "NONG KHAI"),
  option("nonthaburi", "暖武里府", "NONTHABURI"),
  option("pathum_thani", "巴吞他尼府", "PATHUM THANI"),
  option("pattani", "北大年府", "PATTANI"),
  option("phangnga", "攀牙府", "PHANGNGA"),
  option("phatthalung", "博他仑府", "PHATTHALUNG"),
  option("phayao", "帕尧府", "PHAYAO"),
  option("phetchabun", "碧差汶府", "PHETCHABUN"),
  option("phetchaburi", "佛丕府", "PHETCHABURI"),
  option("phichit", "披集府", "PHICHIT"),
  option("phitsanulok", "彭世洛府", "PHITSANULOK"),
  option("phra_nakhon_si_ayutthaya", "大城府", "PHRA NAKHON SI AYUTTHAYA"),
  option("phrae", "帕府", "PHRAE"),
  option("phuket", "普吉府", "PHUKET"),
  option("prachin_buri", "巴真府", "PRACHIN BURI"),
  option("prachuap_khiri_khan", "巴蜀府", "PRACHUAP KHIRI KHAN"),
  option("ranong", "拉廊府", "RANONG"),
  option("ratchaburi", "叻丕府", "RATCHABURI"),
  option("rayong", "罗勇府", "RAYONG"),
  option("roi_et", "黎逸府", "ROI ET"),
  option("sa_kaeo", "沙缴府", "SA KAEO"),
  option("sakon_nakhon", "色军府", "SAKON NAKHON"),
  option("samut_prakan", "北榄府", "SAMUT PRAKAN"),
  option("samut_sakhon", "龙仔厝府", "SAMUT SAKHON"),
  option("samut_songkhram", "夜功府", "SAMUT SONGKHRAM"),
  option("saraburi", "北标府", "SARABURI"),
  option("satun", "沙敦府", "SATUN"),
  option("sing_buri", "信武里府", "SING BURI"),
  option("sisaket", "四色菊府", "SI SA KET"),
  option("songkhla", "宋卡府", "SONGKHLA"),
  option("sukhothai", "素可泰府", "SUKHOTHAI"),
  option("suphan_buri", "素攀武里府", "SUPHAN BURI"),
  option("surat_thani", "素叻他尼府", "SURAT THANI"),
  option("surin", "素林府", "SURIN"),
  option("tak", "达府", "TAK"),
  option("trang", "董里府", "TRANG"),
  option("trat", "达叻府", "TRAT"),
  option("ubon_ratchathani", "乌汶府", "UBON RATCHATHANI"),
  option("udon_thani", "乌隆府", "UDON THANI"),
  option("uthai_thani", "乌泰他尼府", "UTHAI THANI"),
  option("uttaradit", "程逸府", "UTTARADIT"),
  option("yala", "也拉府", "YALA"),
  option("yasothon", "益梭通府", "YASOTHON"),
];

const residenceRegion = (labelEn: string, labelZh = labelEn): TdacOption => option(labelEn, labelZh, labelEn, labelEn);

export const TDAC_RESIDENCE_REGION_OPTIONS_BY_COUNTRY: Record<string, TdacOption[]> = {
  CHN: [
    residenceRegion("ANHUI", "安徽"),
    residenceRegion("BEIJING", "北京"),
    residenceRegion("CHONGQING", "重庆"),
    residenceRegion("FUJIAN", "福建"),
    residenceRegion("GANSU", "甘肃"),
    residenceRegion("GUANGDONG", "广东"),
    residenceRegion("GUANGXI", "广西"),
    residenceRegion("GUIZHOU", "贵州"),
    residenceRegion("HAINAN", "海南"),
    residenceRegion("HEBEI", "河北"),
    residenceRegion("HEILONGJIANG", "黑龙江"),
    residenceRegion("HENAN", "河南"),
    residenceRegion("HONG KONG", "香港"),
    residenceRegion("HUBEI", "湖北"),
    residenceRegion("HUNAN", "湖南"),
    residenceRegion("INNER MONGOLIA", "内蒙古"),
    residenceRegion("JIANGSU", "江苏"),
    residenceRegion("JIANGXI", "江西"),
    residenceRegion("JILIN", "吉林"),
    residenceRegion("LIAONING", "辽宁"),
    residenceRegion("MACAO", "澳门"),
    residenceRegion("NINGXIA", "宁夏"),
    residenceRegion("QINGHAI", "青海"),
    residenceRegion("SHAANXI", "陕西"),
    residenceRegion("SHANDONG", "山东"),
    residenceRegion("SHANGHAI", "上海"),
    residenceRegion("SHANXI", "山西"),
    residenceRegion("SICHUAN", "四川"),
    residenceRegion("TAIWAN", "台湾"),
    residenceRegion("TIANJIN", "天津"),
    residenceRegion("TIBET", "西藏"),
    residenceRegion("XINJIANG", "新疆"),
    residenceRegion("YUNNAN", "云南"),
    residenceRegion("ZHEJIANG", "浙江"),
  ],
  MYS: [
    residenceRegion("JOHOR", "柔佛"),
    residenceRegion("KEDAH", "吉打"),
    residenceRegion("KELANTAN", "吉兰丹"),
    residenceRegion("MELAKA", "马六甲"),
    residenceRegion("NEGERI SEMBILAN", "森美兰"),
    residenceRegion("PAHANG", "彭亨"),
    residenceRegion("PULAU PINANG", "槟城"),
    residenceRegion("PERAK", "霹雳"),
    residenceRegion("PERLIS", "玻璃市"),
    residenceRegion("SABAH", "沙巴"),
    residenceRegion("SARAWAK", "砂拉越"),
    residenceRegion("SELANGOR", "雪兰莪"),
    residenceRegion("TERENGGANU", "登嘉楼"),
    residenceRegion("WP KUALA LUMPUR", "吉隆坡联邦直辖区"),
    residenceRegion("WP LABUAN", "纳闽联邦直辖区"),
    residenceRegion("WP PUTRAJAYA", "布城联邦直辖区"),
  ],
  SGP: [residenceRegion("SINGAPORE", "新加坡")],
  THA: TDAC_PROVINCE_OPTIONS,
  USA: [
    residenceRegion("ALABAMA", "阿拉巴马州"),
    residenceRegion("ALASKA", "阿拉斯加州"),
    residenceRegion("AMERICAN SAMOA", "美属萨摩亚"),
    residenceRegion("ARIZONA", "亚利桑那州"),
    residenceRegion("ARKANSAS", "阿肯色州"),
    residenceRegion("CALIFORNIA", "加利福尼亚州"),
    residenceRegion("COLORADO", "科罗拉多州"),
    residenceRegion("CONNECTICUT", "康涅狄格州"),
    residenceRegion("DELAWARE", "特拉华州"),
    residenceRegion("DISTRICT OF COLUMBIA", "哥伦比亚特区"),
    residenceRegion("FLORIDA", "佛罗里达州"),
    residenceRegion("GEORGIA", "佐治亚州"),
    residenceRegion("GUAM", "关岛"),
    residenceRegion("HAWAII", "夏威夷州"),
    residenceRegion("IDAHO", "爱达荷州"),
    residenceRegion("ILLINOIS", "伊利诺伊州"),
    residenceRegion("INDIANA", "印第安纳州"),
    residenceRegion("IOWA", "艾奥瓦州"),
    residenceRegion("KANSAS", "堪萨斯州"),
    residenceRegion("KENTUCKY", "肯塔基州"),
    residenceRegion("LOUISIANA", "路易斯安那州"),
    residenceRegion("MAINE", "缅因州"),
    residenceRegion("MARYLAND", "马里兰州"),
    residenceRegion("MASSACHUSETTS", "马萨诸塞州"),
    residenceRegion("MICHIGAN", "密歇根州"),
    residenceRegion("MINNESOTA", "明尼苏达州"),
    residenceRegion("MISSISSIPPI", "密西西比州"),
    residenceRegion("MISSOURI", "密苏里州"),
    residenceRegion("MONTANA", "蒙大拿州"),
    residenceRegion("NAVASSA ISLAND", "纳弗沙岛"),
    residenceRegion("NEBRASKA", "内布拉斯加州"),
    residenceRegion("NEVADA", "内华达州"),
    residenceRegion("NEW HAMPSHIRE", "新罕布什尔州"),
    residenceRegion("NEW JERSEY", "新泽西州"),
    residenceRegion("NEW MEXICO", "新墨西哥州"),
    residenceRegion("NEW YORK", "纽约州"),
    residenceRegion("NORTH CAROLINA", "北卡罗来纳州"),
    residenceRegion("NORTH DAKOTA", "北达科他州"),
    residenceRegion("NORTHERN MARIANA ISLANDS", "北马里亚纳群岛"),
    residenceRegion("OHIO", "俄亥俄州"),
    residenceRegion("OKLAHOMA", "俄克拉荷马州"),
    residenceRegion("OREGON", "俄勒冈州"),
    residenceRegion("PENNSYLVANIA", "宾夕法尼亚州"),
    residenceRegion("PUERTO RICO", "波多黎各"),
    residenceRegion("RHODE ISLAND", "罗得岛州"),
    residenceRegion("SOUTH CAROLINA", "南卡罗来纳州"),
    residenceRegion("SOUTH DAKOTA", "南达科他州"),
    residenceRegion("TENNESSEE", "田纳西州"),
    residenceRegion("TEXAS", "得克萨斯州"),
    residenceRegion("UNITED STATES MINOR OUTLYING ISLANDS", "美国本土外小岛屿"),
    residenceRegion("UTAH", "犹他州"),
    residenceRegion("VERMONT", "佛蒙特州"),
    residenceRegion("VIRGIN ISLANDS", "美属维尔京群岛"),
    residenceRegion("VIRGINIA", "弗吉尼亚州"),
    residenceRegion("WASHINGTON", "华盛顿州"),
    residenceRegion("WEST VIRGINIA", "西弗吉尼亚州"),
    residenceRegion("WISCONSIN", "威斯康星州"),
    residenceRegion("WYOMING", "怀俄明州"),
  ],
};

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
