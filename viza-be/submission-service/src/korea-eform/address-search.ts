export type KoreaAddressLanguage = "ko" | "en";

export interface KoreaAddressSearchOptions {
  keyword: string;
  language?: KoreaAddressLanguage;
  page?: number;
  countPerPage?: number;
  signal?: AbortSignal;
}

export interface KoreaAddressRecord {
  roadAddress: string;
  roadAddressPart1: string | null;
  roadAddressPart2: string | null;
  englishAddress: string | null;
  koreanAddress: string | null;
  jibunAddress: string | null;
  zipNo: string;
  adminCode: string | null;
  roadNameManagementNo: string | null;
  buildingManagementNo: string | null;
  buildingName: string | null;
  city: string | null;
  district: string | null;
  township: string | null;
  roadName: string | null;
  undergroundYn: string | null;
  buildingMainNo: string | null;
  buildingSubNo: string | null;
  mountainYn: string | null;
  landMainNo: string | null;
  landSubNo: string | null;
}

export interface KoreaAddressSearchResult {
  source: "juso.go.kr";
  language: KoreaAddressLanguage;
  keyword: string;
  page: number;
  countPerPage: number;
  totalCount: number;
  errorCode: string;
  errorMessage: string;
  records: KoreaAddressRecord[];
}

export const KOREA_JUSO_KO_CONFM_KEY = "U01TX0FVVEgyMDIyMTExMDEzMTcxOTExMzIwOTE=";
export const KOREA_JUSO_EN_CONFM_KEY = "U01TX0FVVEgyMDIyMTExMDEzMTgwNTExMzIwOTI=";

const JUSO_ENDPOINTS: Record<KoreaAddressLanguage, string> = {
  ko: "https://www.juso.go.kr/addrlink/addrLinkApiJsonp.do",
  en: "https://www.juso.go.kr/addrlink/addrEngApiJsonp.do",
};

const JUSO_KEYS: Record<KoreaAddressLanguage, string> = {
  ko: KOREA_JUSO_KO_CONFM_KEY,
  en: KOREA_JUSO_EN_CONFM_KEY,
};

const XML_ENTITY_MAP: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: "\"",
  apos: "'",
};

function decodeXml(value: string): string {
  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, token: string) => {
    if (token.startsWith("#x")) return String.fromCodePoint(Number.parseInt(token.slice(2), 16));
    if (token.startsWith("#")) return String.fromCodePoint(Number.parseInt(token.slice(1), 10));
    return XML_ENTITY_MAP[token] ?? match;
  });
}

function getTag(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i"));
  return match ? decodeXml(match[1] ?? "").trim() : null;
}

function getTagNumber(xml: string, tag: string, fallback: number): number {
  const value = getTag(xml, tag);
  const parsed = value ? Number.parseInt(value, 10) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

function unwrapJsonpResponse(payload: string): string {
  const match = payload.match(/returnXml'\s*:\s*'([\s\S]*)'\s*}\s*\)?\s*$/);
  if (!match) return payload;
  return (match[1] ?? "")
    .replace(/\\'/g, "'")
    .replace(/\\"/g, "\"")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\\\/g, "\\");
}

function parseJusoRecords(xml: string): KoreaAddressRecord[] {
  const matches = xml.matchAll(/<juso>([\s\S]*?)<\/juso>/gi);
  return Array.from(matches, (match) => {
    const node = match[1] ?? "";
    return {
      roadAddress: getTag(node, "roadAddr") ?? "",
      roadAddressPart1: getTag(node, "roadAddrPart1"),
      roadAddressPart2: getTag(node, "roadAddrPart2"),
      englishAddress: getTag(node, "engAddr"),
      koreanAddress: getTag(node, "korAddr"),
      jibunAddress: getTag(node, "jibunAddr"),
      zipNo: getTag(node, "zipNo") ?? "",
      adminCode: getTag(node, "admCd"),
      roadNameManagementNo: getTag(node, "rnMgtSn"),
      buildingManagementNo: getTag(node, "bdMgtSn"),
      buildingName: getTag(node, "bdNm"),
      city: getTag(node, "siNm"),
      district: getTag(node, "sggNm"),
      township: getTag(node, "emdNm"),
      roadName: getTag(node, "rn"),
      undergroundYn: getTag(node, "udrtYn"),
      buildingMainNo: getTag(node, "buldMnnm"),
      buildingSubNo: getTag(node, "buldSlno"),
      mountainYn: getTag(node, "mtYn"),
      landMainNo: getTag(node, "lnbrMnnm"),
      landSubNo: getTag(node, "lnbrSlno"),
    };
  }).filter((record) => record.roadAddress && record.zipNo);
}

export function parseKoreaAddressSearchResponse(
  payload: string,
  options: { language: KoreaAddressLanguage; keyword: string; page: number; countPerPage: number },
): KoreaAddressSearchResult {
  const xml = unwrapJsonpResponse(payload);
  return {
    source: "juso.go.kr",
    language: options.language,
    keyword: options.keyword,
    page: getTagNumber(xml, "currentPage", options.page),
    countPerPage: getTagNumber(xml, "countPerPage", options.countPerPage),
    totalCount: getTagNumber(xml, "totalCount", 0),
    errorCode: getTag(xml, "errorCode") ?? "",
    errorMessage: getTag(xml, "errorMessage") ?? "",
    records: parseJusoRecords(xml),
  };
}

export async function searchKoreaAddresses(options: KoreaAddressSearchOptions): Promise<KoreaAddressSearchResult> {
  const language = options.language ?? "en";
  const page = options.page ?? 1;
  const countPerPage = options.countPerPage ?? 100;
  const keyword = options.keyword.trim();
  if (!keyword) throw new Error("Korea address search keyword is required.");
  if (countPerPage < 1 || countPerPage > 100) throw new Error("Korea address countPerPage must be 1-100.");

  const body = new URLSearchParams({
    confmKey: JUSO_KEYS[language],
    currentPage: String(page),
    countPerPage: String(countPerPage),
    keyword,
    resultType: "4",
  });

  const response = await fetch(JUSO_ENDPOINTS[language], {
    method: "POST",
    body,
    signal: options.signal,
    headers: {
      "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
      referer: language === "en" ? "https://www.visa.go.kr/jusoPopupEn.jsp" : "https://www.visa.go.kr/jusoPopup.jsp",
      "user-agent": "VIZA Korea e-Form address crawler; official juso.go.kr address API parity",
    },
  });
  if (!response.ok) throw new Error(`Korea address search failed: HTTP ${response.status}`);

  return parseKoreaAddressSearchResponse(await response.text(), {
    language,
    keyword,
    page,
    countPerPage,
  });
}
