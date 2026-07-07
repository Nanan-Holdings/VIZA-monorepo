import { type VisaFormFieldOption } from "@/types/visa-form-fields";

export interface KoreaAddressSearchRecord {
  roadAddress: string;
  englishAddress: string | null;
  koreanAddress: string | null;
  zipNo: string;
  buildingName: string | null;
}

export interface KoreaAddressSearchResult {
  totalCount: number;
  records: KoreaAddressSearchRecord[];
}

const JUSO_ENDPOINT = "https://www.juso.go.kr/addrlink/addrEngApiJsonp.do";
const JUSO_CONFM_KEY = "U01TX0FVVEgyMDIyMTExMDEzMTgwNTExMzIwOTI=";

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

function getTagNumber(xml: string, tag: string): number {
  const value = getTag(xml, tag);
  const parsed = value ? Number.parseInt(value, 10) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : 0;
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

export function parseKoreaAddressSearchResponse(payload: string): KoreaAddressSearchResult {
  const xml = unwrapJsonpResponse(payload);
  const records = Array.from(xml.matchAll(/<juso>([\s\S]*?)<\/juso>/gi), (match) => {
    const node = match[1] ?? "";
    const englishAddress = getTag(node, "engAddr");
    const roadAddress = getTag(node, "roadAddr") ?? englishAddress ?? "";
    return {
      roadAddress,
      englishAddress,
      koreanAddress: getTag(node, "korAddr") ?? getTag(node, "roadAddr"),
      zipNo: getTag(node, "zipNo") ?? "",
      buildingName: getTag(node, "bdNm"),
    };
  }).filter((record) => record.roadAddress && record.zipNo);

  return {
    totalCount: getTagNumber(xml, "totalCount"),
    records,
  };
}

export async function searchKoreaAddresses(keyword: string, options: { limit?: number; signal?: AbortSignal } = {}) {
  const trimmed = keyword.trim();
  if (trimmed.length < 2) return { totalCount: 0, options: [] as VisaFormFieldOption[] };

  const countPerPage = Math.min(Math.max(options.limit ?? 50, 1), 100);
  const response = await fetch(JUSO_ENDPOINT, {
    method: "POST",
    body: new URLSearchParams({
      confmKey: JUSO_CONFM_KEY,
      currentPage: "1",
      countPerPage: String(countPerPage),
      keyword: trimmed,
      resultType: "4",
    }),
    signal: options.signal,
    headers: {
      "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
      referer: "https://www.visa.go.kr/jusoPopupEn.jsp",
      "user-agent": "VIZA Korea e-Form address search",
    },
  });

  if (!response.ok) {
    throw new Error(`Korea address search failed: HTTP ${response.status}`);
  }

  const parsed = parseKoreaAddressSearchResponse(await response.text());
  return {
    totalCount: parsed.totalCount,
    options: parsed.records.map((record) => {
      const value = record.englishAddress ?? record.roadAddress;
      const suffix = record.zipNo ? ` (${record.zipNo})` : "";
      return {
        value,
        text: `${value}${suffix}`,
        label_en: `${value}${suffix}`,
        label_zh: `${value}${suffix}`,
        official_label: record.roadAddress,
      };
    }),
  };
}
