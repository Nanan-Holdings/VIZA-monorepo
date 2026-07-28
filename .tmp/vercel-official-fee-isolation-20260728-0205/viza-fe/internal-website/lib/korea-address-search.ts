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

const KOREA_ADMIN_ZH: Record<string, string> = {
  "서울특별시": "首尔特别市",
  "부산광역시": "釜山广域市",
  "대구광역시": "大邱广域市",
  "인천광역시": "仁川广域市",
  "광주광역시": "光州广域市",
  "대전광역시": "大田广域市",
  "울산광역시": "蔚山广域市",
  "세종특별자치시": "世宗特别自治市",
  "경기도": "京畿道",
  "강원특별자치도": "江原特别自治道",
  "강원도": "江原道",
  "충청북도": "忠清北道",
  "충청남도": "忠清南道",
  "전북특별자치도": "全北特别自治道",
  "전라북도": "全罗北道",
  "전라남도": "全罗南道",
  "경상북도": "庆尚北道",
  "경상남도": "庆尚南道",
  "제주특별자치도": "济州特别自治道",
  "강남구": "江南区",
  "강동구": "江东区",
  "강북구": "江北区",
  "강서구": "江西区",
  "관악구": "冠岳区",
  "광진구": "广津区",
  "구로구": "九老区",
  "금천구": "衿川区",
  "노원구": "芦原区",
  "도봉구": "道峰区",
  "동대문구": "东大门区",
  "동작구": "铜雀区",
  "마포구": "麻浦区",
  "서대문구": "西大门区",
  "서초구": "瑞草区",
  "성동구": "城东区",
  "성북구": "城北区",
  "송파구": "松坡区",
  "양천구": "阳川区",
  "영등포구": "永登浦区",
  "용산구": "龙山区",
  "은평구": "恩平区",
  "종로구": "钟路区",
  "중구": "中区",
  "중랑구": "中浪区",
  "퇴계로": "退溪路",
  "세종대로": "世宗大路",
  "언주로": "彦州路",
};

const KOREA_EN_ADMIN_ZH: Record<string, string> = {
  Seoul: "首尔特别市",
  Busan: "釜山广域市",
  Daegu: "大邱广域市",
  Incheon: "仁川广域市",
  Gwangju: "光州广域市",
  Daejeon: "大田广域市",
  Ulsan: "蔚山广域市",
  "Sejong-si": "世宗特别自治市",
  "Gyeonggi-do": "京畿道",
  "Gangwon-do": "江原道",
  "Chungcheongbuk-do": "忠清北道",
  "Chungcheongnam-do": "忠清南道",
  "Jeollabuk-do": "全罗北道",
  "Jeollanam-do": "全罗南道",
  "Gyeongsangbuk-do": "庆尚北道",
  "Gyeongsangnam-do": "庆尚南道",
  "Jeju-do": "济州特别自治道",
  "Gangnam-gu": "江南区",
  "Gangdong-gu": "江东区",
  "Gangbuk-gu": "江北区",
  "Gangseo-gu": "江西区",
  "Gwanak-gu": "冠岳区",
  "Gwangjin-gu": "广津区",
  "Guro-gu": "九老区",
  "Geumcheon-gu": "衿川区",
  "Nowon-gu": "芦原区",
  "Dobong-gu": "道峰区",
  "Dongdaemun-gu": "东大门区",
  "Dongjak-gu": "铜雀区",
  "Mapo-gu": "麻浦区",
  "Seodaemun-gu": "西大门区",
  "Seocho-gu": "瑞草区",
  "Seongdong-gu": "城东区",
  "Seongbuk-gu": "城北区",
  "Songpa-gu": "松坡区",
  "Yangcheon-gu": "阳川区",
  "Yeongdeungpo-gu": "永登浦区",
  "Yongsan-gu": "龙山区",
  "Eunpyeong-gu": "恩平区",
  "Jongno-gu": "钟路区",
  "Jung-gu": "中区",
  "Jungnang-gu": "中浪区",
};

const KOREA_ZH_SEARCH_REPLACEMENTS: Array<[string, string]> = [
  ["首尔特别市", "Seoul"],
  ["首尔", "Seoul"],
  ["釜山广域市", "Busan"],
  ["釜山", "Busan"],
  ["大邱广域市", "Daegu"],
  ["大邱", "Daegu"],
  ["仁川广域市", "Incheon"],
  ["仁川", "Incheon"],
  ["光州广域市", "Gwangju"],
  ["光州", "Gwangju"],
  ["大田广域市", "Daejeon"],
  ["大田", "Daejeon"],
  ["蔚山广域市", "Ulsan"],
  ["蔚山", "Ulsan"],
  ["世宗特别自治市", "Sejong-si"],
  ["世宗", "Sejong-si"],
  ["京畿道", "Gyeonggi-do"],
  ["江原特别自治道", "Gangwon-do"],
  ["江原道", "Gangwon-do"],
  ["忠清北道", "Chungcheongbuk-do"],
  ["忠清南道", "Chungcheongnam-do"],
  ["全北特别自治道", "Jeollabuk-do"],
  ["全罗北道", "Jeollabuk-do"],
  ["全罗南道", "Jeollanam-do"],
  ["庆尚北道", "Gyeongsangbuk-do"],
  ["庆尚南道", "Gyeongsangnam-do"],
  ["济州特别自治道", "Jeju-do"],
  ["济州", "Jeju-do"],
  ["江南区", "Gangnam-gu"],
  ["江南", "Gangnam-gu"],
  ["江东区", "Gangdong-gu"],
  ["江北区", "Gangbuk-gu"],
  ["江西区", "Gangseo-gu"],
  ["冠岳区", "Gwanak-gu"],
  ["广津区", "Gwangjin-gu"],
  ["九老区", "Guro-gu"],
  ["衿川区", "Geumcheon-gu"],
  ["芦原区", "Nowon-gu"],
  ["道峰区", "Dobong-gu"],
  ["东大门区", "Dongdaemun-gu"],
  ["铜雀区", "Dongjak-gu"],
  ["麻浦区", "Mapo-gu"],
  ["西大门区", "Seodaemun-gu"],
  ["瑞草区", "Seocho-gu"],
  ["城东区", "Seongdong-gu"],
  ["城北区", "Seongbuk-gu"],
  ["松坡区", "Songpa-gu"],
  ["阳川区", "Yangcheon-gu"],
  ["永登浦区", "Yeongdeungpo-gu"],
  ["龙山区", "Yongsan-gu"],
  ["恩平区", "Eunpyeong-gu"],
  ["钟路区", "Jongno-gu"],
  ["中浪区", "Jungnang-gu"],
  ["中区", "Jung-gu"],
  ["退溪路", "Toegye-ro"],
  ["世宗大路", "Sejong-daero"],
  ["彦州路", "Eonju-ro"],
  ["酒店", "Hotel"],
  ["宾馆", "Hotel"],
  ["旅馆", "Hotel"],
  ["民宿", "Guesthouse"],
  ["路", "-ro"],
  ["大路", "-daero"],
  ["街", "-gil"],
];

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

function hasCjkText(value: string): boolean {
  return /[\p{Script=Han}\u3040-\u30ff\uac00-\ud7af]/u.test(value);
}

function normalizeSearchKeyword(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[，。；：、]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildKoreaAddressSearchKeywords(keyword: string): string[] {
  const normalized = normalizeSearchKeyword(keyword);
  if (!normalized) return [];

  const candidates = new Set<string>([normalized]);
  if (hasCjkText(normalized)) {
    let translated = normalized;
    for (const [source, target] of KOREA_ZH_SEARCH_REPLACEMENTS.sort((a, b) => b[0].length - a[0].length)) {
      translated = translated.replaceAll(source, ` ${target} `);
    }
    translated = normalizeSearchKeyword(translated)
      .replace(/\s+(-(?:ro|daero|gil))/gi, "$1")
      .replace(/([A-Za-z-]+)\s+(\d)/g, "$1 $2")
      .replace(/\s+/g, " ")
      .trim();
    if (translated) candidates.add(translated);
    const compact = translated.replace(/\s+/g, " ").trim();
    if (compact && compact !== translated) candidates.add(compact);
  }

  return Array.from(candidates).filter((candidate) => candidate.length >= 2).slice(0, 4);
}

function localizeKoreanAddressForChineseDisplay(address: string | null, englishAddress: string): string {
  if (!address?.trim()) return englishAddress;
  let localized = address.trim();
  const tokens = Object.keys(KOREA_ADMIN_ZH).sort((a, b) => b.length - a.length);
  for (const token of tokens) {
    localized = localized.replaceAll(token, KOREA_ADMIN_ZH[token] ?? token);
  }
  localized = localized
    .replace(/([가-힣]+)특별자치시/g, "$1特别自治市")
    .replace(/([가-힣]+)광역시/g, "$1广域市")
    .replace(/([가-힣]+)특별시/g, "$1特别市")
    .replace(/([가-힣]+)특별자치도/g, "$1特别自治道")
    .replace(/([가-힣]+)도/g, "$1道")
    .replace(/([가-힣]+)시/g, "$1市")
    .replace(/([가-힣]+)군/g, "$1郡")
    .replace(/([가-힣]+)구/g, "$1区")
    .replace(/([가-힣]+)읍/g, "$1邑")
    .replace(/([가-힣]+)면/g, "$1面")
    .replace(/([가-힣]+)동/g, "$1洞")
    .replace(/([가-힣]+)리/g, "$1里")
    .replace(/([가-힣]+)대로/g, "$1大路")
    .replace(/([가-힣]+)로/g, "$1路")
    .replace(/([가-힣]+)길/g, "$1街");
  return localized;
}

function localizeEnglishAddressForChineseDisplay(englishAddress: string): string {
  const parts = englishAddress.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) return englishAddress;

  const [streetPart, ...adminParts] = parts;
  const adminZh = adminParts
    .reverse()
    .map((part) => {
      if (KOREA_EN_ADMIN_ZH[part]) return KOREA_EN_ADMIN_ZH[part];
      return part
        .replace(/-do$/i, "道")
        .replace(/-si$/i, "市")
        .replace(/-gun$/i, "郡")
        .replace(/-gu$/i, "区")
        .replace(/-eup$/i, "邑")
        .replace(/-myeon$/i, "面")
        .replace(/-dong$/i, "洞")
        .replace(/-ri$/i, "里");
    });

  const streetMatch = streetPart.match(/^(\d+[A-Za-z]?)\s+(.+)$/);
  const buildingNo = streetMatch?.[1] ?? "";
  const streetName = streetMatch?.[2] ?? streetPart;
  const streetZh = streetName
    .replace(/-daero/gi, "大路")
    .replace(/-ro/gi, "路")
    .replace(/-gil/gi, "街")
    .replace(/-/g, "");
  return [...adminZh, streetZh, buildingNo].filter(Boolean).join(" ");
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
  const searchKeywords = buildKoreaAddressSearchKeywords(trimmed);
  const recordsByKey = new Map<string, KoreaAddressSearchRecord>();
  let totalCount = 0;

  for (const searchKeyword of searchKeywords) {
    const response = await fetch(JUSO_ENDPOINT, {
      method: "POST",
      body: new URLSearchParams({
        confmKey: JUSO_CONFM_KEY,
        currentPage: "1",
        countPerPage: String(countPerPage),
        keyword: searchKeyword,
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
    if (totalCount === 0 || parsed.totalCount > totalCount) {
      totalCount = parsed.totalCount;
    }
    for (const record of parsed.records) {
      const key = `${record.englishAddress ?? record.roadAddress}|${record.zipNo}`;
      recordsByKey.set(key, record);
      if (recordsByKey.size >= countPerPage) break;
    }
    if (recordsByKey.size >= countPerPage) break;
  }

  const records = Array.from(recordsByKey.values()).slice(0, countPerPage);
  return {
    totalCount,
    options: records.map((record) => {
      const value = record.englishAddress ?? record.roadAddress;
      const suffix = record.zipNo ? ` (${record.zipNo})` : "";
      const koreanLocalized = localizeKoreanAddressForChineseDisplay(record.koreanAddress, value);
      const labelZhBase = /[가-힣]/.test(koreanLocalized)
        ? localizeEnglishAddressForChineseDisplay(value)
        : koreanLocalized;
      const labelZh = `${labelZhBase}${suffix}`;
      return {
        value,
        text: `${value}${suffix}`,
        label_en: `${value}${suffix}`,
        label_zh: labelZh,
        official_label: record.koreanAddress ?? record.roadAddress,
      };
    }),
  };
}
