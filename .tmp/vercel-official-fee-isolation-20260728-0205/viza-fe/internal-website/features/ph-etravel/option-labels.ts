import type { VisaFormFieldOption } from "@/types/visa-form-fields";

const CHINESE_REGION_NAMES = new Intl.DisplayNames(["zh-CN"], { type: "region" });

const COUNTRY_FIELDS = new Set([
  "nationality",
  "country_of_birth",
  "passport_issuing_authority",
  "country_of_residence",
  "origin_country",
  "transit_country",
  "destination_country",
  "visited_country_30d",
]);

export const PH_ETRAVEL_AIRLINE_LABELS_ZH: Record<string, string> = {
  TC0078: "先进喷气航空",
  TC0071: "韩国 Aero K 航空",
  MO: "蒙古航空",
  TC0031: "釜山航空",
  AC: "加拿大航空",
  TC0032: "中国国际航空",
  TC0076: "法国航空",
  AF: "法国航空",
  TC0059: "香港华民航空",
  AI: "印度航空",
  NX: "澳门航空",
  TC0033: "新几内亚航空",
  TC0034: "首尔航空",
  TC003: "亚洲航空",
  TC007: "菲律宾迅捷航空",
  TC0035: "全日空航空",
  TC0044: "美国航空",
  TC0015: "韩亚航空",
  "5Y": "亚特拉斯航空",
  QH: "越竹航空",
  PG: "曼谷航空",
  Bulldog: "斗牛犬航空",
  TC0036: "国泰航空",
  TC001: "宿务太平洋航空",
  TC0069: "中州航空",
  TC0029: "中华航空",
  TC0010: "中国东方航空",
  TC0016: "中国南方航空",
  TC0073: "达美航空",
  TC0037: "阿联酋航空",
  TC0024: "埃塞俄比亚航空",
  TC0038: "阿提哈德航空",
  TC0018: "长荣航空",
  TC0039: "联邦快递航空",
  FY: "飞萤航空",
  TC0040: "江原航空",
  TC0075: "印度尼西亚鹰航空",
  TC0068: "大湾区航空",
  TC0014: "海湾航空",
  TC0041: "香港航空",
  TC0067: "香港快运航空",
  TC0058: "匈奴航空",
  TC0062: "冰岛航空",
  ICE: "冰岛航空",
  "2-ALPS": "帝国私人俱乐部航空",
  TC041624: "俄罗斯伊尔航空",
  TC0012: "日本航空",
  TC0028: "济州航空",
  JST: "捷星航空",
  TC0013: "捷星亚洲航空",
  TC0054: "捷星日本航空",
  TC0042: "真航空",
  TC0043: "荷兰皇家航空",
  TC0017: "大韩航空",
  TC0052: "科威特航空",
  TC0064: "长龙航空",
  TC0020: "马来西亚航空",
  MEDIC89: "医疗救援 89 航空",
  TC0070: "印度尼西亚我的航空",
  MYW9072: "迈威航空",
  NA: "不适用",
  ON: "瑙鲁航空",
  TC0063: "奥凯航空",
  TC0074: "奥凯航空",
  TC0026: "阿曼航空",
  "PAF 215": "菲律宾空军 215",
  "PAF 5157": "菲律宾空军 5157",
  TC005: "菲律宾航空快运",
  TC006: "泛太平洋航空",
  TC002: "菲律宾航空",
  TC0051: "私人飞机",
  TC0027: "澳洲航空",
  TC0022: "卡塔尔航空",
  QQE: "卡塔尔公务航空",
  QW: "青岛航空",
  RAAF: "澳大利亚皇家空军",
  TC008: "皇家航空",
  TC0025: "文莱皇家航空",
  TC0021: "沙特阿拉伯航空",
  TC0011: "酷航",
  XO: "东南亚国际航空",
  TC0072: "深圳航空",
  TC0045: "新加坡航空",
  TC009: "天空捷运航空",
  XKY: "天路航空",
  TC0046: "星宇航空",
  RPC6388: "阳光快运航空",
  TVR: "特拉航空",
  FD: "泰国亚洲航空",
  TC0019: "泰国国际航空",
  SL: "泰国狮子航空",
  TC0060: "天津货运航空",
  TC0057: "台湾虎航",
  TC0047: "土耳其航空",
  TC0048: "德威航空",
  TC0049: "美国联合航空",
  TC0050: "联合包裹航空",
  TC0065: "越捷航空",
  VJ: "越捷航空",
  TC0079: "越南航空",
  TC0077: "沃莫斯航空",
  TC0053: "厦门航空",
  TC0066: "日本 ZIPAIR 航空",
};

export const PH_ETRAVEL_AIRPORT_LABELS_ZH: Record<string, string> = {
  TP0115: "巴科洛德机场",
  DRP: "比科尔国际机场",
  TP0020: "保和—邦劳国际机场（新保和国际机场）",
  TP127: "卡加延北部国际机场",
  TP007: "卡提克兰机场（MPH）",
  TP001: "克拉克国际机场（CRK）",
  TP002: "达沃国际机场（DVO）",
  TP0112: "桑托斯将军城机场",
  TP003: "伊洛伊洛国际机场（ILO）",
  TP004: "卡利博国际机场（KLO）",
  TP0010: "拉金丁根机场—卡加延德奥罗",
  TP005: "拉瓦格国际机场（LAO）",
  TP006: "麦克坦—宿务国际机场（CEB）",
  TP1000: "尼诺伊·阿基诺国际机场 1 号航站楼（MNL）",
  TP2000: "尼诺伊·阿基诺国际机场 2 号航站楼（MNL）",
  TP3000: "尼诺伊·阿基诺国际机场 3 号航站楼（MNL）",
  NAIA4: "尼诺伊·阿基诺国际机场 4 号航站楼（MNL）",
  TP008: "公主港国际机场（PPS）",
  SFS: "苏比克湾国际机场（SFS）",
  TP0014: "三宝颜国际机场",
};

function optionValue(option: VisaFormFieldOption): string {
  return typeof option === "string" ? option : option.value;
}

function withChineseLabel(option: VisaFormFieldOption, labelZh: string): VisaFormFieldOption {
  if (typeof option === "string") {
    return {
      value: option,
      text: option,
      label_en: option,
      official_label: option,
      label_zh: labelZh,
    };
  }
  return { ...option, label_zh: labelZh };
}

function localizeCountry(option: VisaFormFieldOption): VisaFormFieldOption {
  const value = optionValue(option).toUpperCase();
  const labelZh = CHINESE_REGION_NAMES.of(value);
  return labelZh ? withChineseLabel(option, labelZh) : option;
}

function localizeMappedOptions(
  options: VisaFormFieldOption[],
  labels: Record<string, string>,
): VisaFormFieldOption[] {
  const localized = options.map((option) => {
    const value = optionValue(option);
    return withChineseLabel(option, labels[value] ?? `${value}（官网选项）`);
  });
  const counts = new Map<string, number>();
  for (const option of localized) {
    const label = typeof option === "string" ? option : option.label_zh ?? option.value;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return localized.map((option) => {
    if (typeof option === "string") return option;
    const label = option.label_zh ?? option.value;
    return (counts.get(label) ?? 0) > 1
      ? { ...option, label_zh: `${label}（${option.value}）` }
      : option;
  });
}

export function localizePhEtravelOptions(
  fieldName: string,
  options: VisaFormFieldOption[] | null,
): VisaFormFieldOption[] | null {
  if (!options) return null;
  if (COUNTRY_FIELDS.has(fieldName)) return options.map(localizeCountry);
  if (fieldName === "airline_name") {
    return localizeMappedOptions(options, PH_ETRAVEL_AIRLINE_LABELS_ZH);
  }
  if (fieldName === "port_of_entry" || fieldName === "destination_transit_airport") {
    return localizeMappedOptions(options, PH_ETRAVEL_AIRPORT_LABELS_ZH);
  }
  return options;
}
