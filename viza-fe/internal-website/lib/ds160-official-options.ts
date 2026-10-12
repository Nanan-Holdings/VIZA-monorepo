import { countries } from "country-data-list";
import snapshot from "./ds160-official-options.snapshot.json";
import { translateUsRegionName } from "./ds160-translations";
import type { VisaFormFieldOption, VisaFormFieldRow } from "@/types/visa-form-fields";

type Pair = readonly [string, string];
export type Ds160OfficialOptionSource = "CEAC_GEOGRAPHY" | "CEAC_BIRTH_COUNTRIES" | "CEAC_NATIONALITIES" | "CEAC_OTHER_NATIONALITIES" | "CEAC_FAMILY_NATIONALITIES" | "CEAC_PASSPORT_ISSUERS" | "CEAC_US_STATES";

function pairs(rows: string[][]): Pair[] { return rows.map(([code, label]) => [code, label]); }
const geography = pairs(snapshot.geography);
const geographicLabels = new Map(geography);
function patched(base: Pair[], overrides: Pair[], remove: string[] = []): Pair[] {
  const result = new Map(base.filter(([code]) => !remove.includes(code)));
  for (const [code, label] of overrides) result.set(code, label);
  return [...result].sort((a, b) => a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0);
}
function selected(codes: string[], overrides: Pair[]): Pair[] {
  const labels = new Map([...geography, ...overrides]);
  return codes.map(code => {
    const label = labels.get(code);
    if (!label) throw new Error(`Missing observed CEAC label: ${code}`);
    return [code, label];
  });
}
const nationalities = selected(snapshot.nationalityCodes, pairs(snapshot.nationalityOverrides));
export const DS160_OFFICIAL_OPTION_PAIRS: Record<Ds160OfficialOptionSource, Pair[]> = {
  CEAC_GEOGRAPHY: geography,
  CEAC_BIRTH_COUNTRIES: patched(geography, pairs(snapshot.birthOverrides), snapshot.birthRemove),
  CEAC_NATIONALITIES: nationalities,
  CEAC_OTHER_NATIONALITIES: patched(nationalities, pairs(snapshot.otherNationalityAdd), snapshot.otherNationalityRemove),
  CEAC_FAMILY_NATIONALITIES: patched(nationalities, pairs(snapshot.familyNationalityAdd)),
  CEAC_PASSPORT_ISSUERS: selected(snapshot.issuerCodes, pairs(snapshot.issuerOverrides)),
  CEAC_US_STATES: pairs(snapshot.states),
};

const normalise = (value: string) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^\p{L}\p{N}]/gu, "");
const regionZh = new Intl.DisplayNames(["zh-CN"], { type: "region" });
const regionEn = new Intl.DisplayNames(["en"], { type: "region" });
const isoByName = new Map<string, string>();
for (const country of countries.all) {
  for (const name of [country.name, country.alpha2, country.alpha3, regionEn.of(country.alpha2), regionZh.of(country.alpha2)]) {
    if (name) isoByName.set(normalise(name), country.alpha2);
  }
}
const isoOverrides: Record<string, string> = {
  BIH: "BA", CAVI: "CV", COCI: "CC", COD: "CD", CONB: "CG", IVCO: "CI", CZEC: "CZ", SZLD: "SZ", FKLI: "FK", FSAT: "TF", GAM: "GM", GUIB: "GW", HMD: "HM", VAT: "VA", HNK: "HK", PRK: "KP", KOR: "KR", KSV: "XK", MAC: "MO", MKD: "MK", FSM: "FM", MNP: "MP", MLD: "MD", PITC: "PN", MAF: "MF", STM: "SX", SGS: "GS", SJM: "SJ", USA: "US", VI: "VI", BRVI: "VG", STBR: "BL", XEU: "EU", PAL: "PS", BURM: "MM", LAOS: "LA", TWAN: "TW", TAZN: "TZ", VTNM: "VN", VENZ: "VE", BOL: "BO", IRAN: "IR", SYR: "SY", BRNI: "BN", STPR: "ST", SABA: "BQ", STEU: "BQ", BON: "BQ",
};
const specialZh: Record<string, string> = {
  STCN: "圣基茨和尼维斯", SPMI: "圣皮埃尔和密克隆", STVN: "圣文森特和格林纳丁斯", WAFT: "瓦利斯和富图纳群岛",
  XAS: "海上", XIR: "空中", HOKO: "香港英国国民海外护照", XXX: "无国籍", XGZ: "加沙地带", XWB: "约旦河西岸", XHI: "豪兰岛", JRSM: "耶路撒冷", MLDI: "莫尔登岛", MDWI: "中途岛", NIRE: "北爱尔兰", PLMR: "巴尔米拉环礁", WKI: "威克岛", SABA: "萨巴岛", STEU: "圣尤斯特歇斯", BON: "博奈尔", SNTD: "中立地位旅行证件", UNLP: "联合国", PAL: "巴勒斯坦当局",
  AGS: "墨西哥阿瓜斯卡连特斯州", BC: "墨西哥下加利福尼亚州", BCSR: "墨西哥南下加利福尼亚州", CAMP: "墨西哥坎佩切州", CHIS: "墨西哥恰帕斯州", CHIH: "墨西哥奇瓦瓦州", COAH: "墨西哥科阿韦拉州", COLI: "墨西哥科利马州", DF: "墨西哥联邦区", DGO: "墨西哥杜兰戈州", GTO: "墨西哥瓜纳华托州", GRO: "墨西哥格雷罗州", HGO: "墨西哥伊达尔戈州", JAL: "墨西哥哈利斯科州", MCH: "墨西哥米却肯州", MOR: "墨西哥莫雷洛斯州", NAY: "墨西哥纳亚里特州", NL: "墨西哥新莱昂州", OAX: "墨西哥瓦哈卡州", PUE: "墨西哥普埃布拉州", QRO: "墨西哥克雷塔罗州", QROO: "墨西哥金塔纳罗奥州", SLP: "墨西哥圣路易斯波托西州", SIN: "墨西哥锡那罗亚州", SON: "墨西哥索诺拉州", MXCO: "墨西哥州", TAB: "墨西哥塔巴斯科州", TAMP: "墨西哥塔毛利帕斯州", TLAX: "墨西哥特拉斯卡拉州", VER: "墨西哥韦拉克鲁斯州", YUC: "墨西哥尤卡坦州", ZAC: "墨西哥萨卡特卡斯州",
};

const optionsCache = new Map<string, VisaFormFieldOption[]>();
export function getDs160OfficialOptions(source: string | undefined): VisaFormFieldOption[] | undefined {
  if (!source || !(source in DS160_OFFICIAL_OPTION_PAIRS)) return undefined;
  const cached = optionsCache.get(source);
  if (cached) return cached;
  const options = DS160_OFFICIAL_OPTION_PAIRS[source as Ds160OfficialOptionSource].map(([code, label]) => {
    const iso = source === "CEAC_US_STATES" ? undefined : isoOverrides[code] ?? isoByName.get(normalise(geographicLabels.get(code) ?? label));
    const chinese = source === "CEAC_US_STATES" ? translateUsRegionName(label, code)
      : source === "CEAC_PASSPORT_ISSUERS" && code === "HOKO" ? "英国驻香港总领事馆"
      : specialZh[code] ?? (iso ? regionZh.of(iso) : undefined) ?? label;
    return { value: source === "CEAC_US_STATES" ? code : label, label_en: label, label_zh: chinese, official_label: label, official_value: code, ...(iso ? { code: iso, flagCountryCode: iso.toLowerCase() } : {}) };
  });
  optionsCache.set(source, options);
  return options;
}

const optionIndexCache = new Map<string, { exact: Map<string, Set<string>>; iso: Map<string, Set<string>> }>();

function officialOptionIndex(source: string, options: VisaFormFieldOption[]) {
  const cached = optionIndexCache.get(source);
  if (cached) return cached;
  const index = { exact: new Map<string, Set<string>>(), iso: new Map<string, Set<string>>() };
  const add = (map: Map<string, Set<string>>, key: string, value: string) => {
    const values = map.get(key) ?? new Set<string>();
    values.add(value);
    map.set(key, values);
  };
  for (const option of options) {
    if (typeof option === "string") continue;
    for (const label of [option.value, option.label_en, option.label_zh, option.official_value]) {
      if (label) add(index.exact, normalise(label), option.value);
    }
    if (option.flagCountryCode && option.official_value !== "HOKO") {
      add(index.iso, option.flagCountryCode, option.value);
    }
  }
  optionIndexCache.set(source, index);
  return index;
}

/** Preserve saved country names without rescanning every option on each keystroke. */
export function resolveDs160OfficialOptionValue(source: string | undefined, value: string): string {
  const options = getDs160OfficialOptions(source);
  if (!source || !options || !value) return value;
  const index = officialOptionIndex(source, options);
  const input = normalise(value);
  const exact = index.exact.get(input);
  if (exact?.size === 1) return exact.values().next().value ?? value;
  const iso = isoByName.get(input)?.toLowerCase();
  const aliases = iso ? index.iso.get(iso) : undefined;
  return aliases?.size === 1 ? aliases.values().next().value ?? value : value;
}

export function getDs160OfficialOptionSource(field: Pick<VisaFormFieldRow, "visaType" | "fieldName" | "validationRules">): Ds160OfficialOptionSource | undefined {
  if (field.visaType.toUpperCase() !== "DS160") return undefined;
  const configured = field.validationRules?.source;
  if (typeof configured === "string" && configured in DS160_OFFICIAL_OPTION_PAIRS) return configured as Ds160OfficialOptionSource;
  const name = field.fieldName.replace(/-(zh|en)$/, "").replace(/__\d+$/, "");
  if (configured === "US_STATES") return "CEAC_US_STATES";
  if (configured !== "ISO3166-1") return undefined;
  if (name === "nationality" || name === "nationality_country") return "CEAC_NATIONALITIES";
  if (name === "other_nationality_country") return "CEAC_OTHER_NATIONALITIES";
  if (name === "country_of_birth" || name.endsWith("_country_of_birth") || name.endsWith("_birth_country")) return "CEAC_BIRTH_COUNTRIES";
  if (name.endsWith("_nationality") || name === "military_country") return "CEAC_FAMILY_NATIONALITIES";
  if (name === "passport_issuing_country" || name === "lost_passport_country") return "CEAC_PASSPORT_ISSUERS";
  // Address lists, including the separately audited preparer list, match geography.
  return "CEAC_GEOGRAPHY";
}
