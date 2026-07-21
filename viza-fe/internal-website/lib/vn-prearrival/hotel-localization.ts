// Display-only names verified against hotel-owned or Chinese booking pages.
// Official option values remain untouched for portal submission.
const HOTEL_NAME_ZH: Record<string, string> = {
  "22land hotel cau giay": "纸桥22兰德酒店",
  "atc resort con dao": "ATC昆仑岛度假村",
  "grand k hotel suites hanoi": "河内格兰德凯套房酒店",
  "phi yen hotel con dao": "彼颜酒店",
  "poulo condor boutique resort": "普罗康朵精品水疗度假村",
  "reyna luxury hotel": "蕾娜豪华酒店",
  "roygent parks hanoi": "河内罗伊杰恩特公园酒店",
  "six senses con dao": "昆岛六善酒店",
  "the secret con dao": "昆仑岛秘密酒店",
  "western hanoi hotel": "河内西方酒店",
};

const PHRASE_ZH: Record<string, string> = {
  "ba dinh": "巴亭",
  "cau giay": "纸桥",
  "da nang": "岘港",
  "ha noi": "河内",
  hanoi: "河内",
  "ho chi minh": "胡志明",
  "hoi an": "会安",
  "nha trang": "芽庄",
  "nguyen van cu": "阮文渠",
  "phu quoc": "富国",
  "tran hung dao": "陈兴道",
  "tran nhan tong": "陈仁宗",
  "ly thuong kiet": "李常杰",
};

const WORD_ZH: Record<string, string> = {
  airport: "机场",
  apartment: "公寓",
  apartments: "公寓",
  beach: "海滩",
  boutique: "精品",
  central: "中心",
  city: "城市",
  garden: "花园",
  grand: "格兰德",
  guesthouse: "宾馆",
  guest: "宾客",
  home: "之家",
  homestay: "民宿",
  hostel: "青年旅舍",
  hotel: "酒店",
  house: "民宿",
  international: "国际",
  luxury: "豪华",
  park: "公园",
  parks: "公园",
  residence: "公馆",
  resort: "度假村",
  riverside: "河畔",
  royal: "皇家",
  spa: "水疗",
  suite: "套房",
  suites: "套房",
  villa: "别墅",
  villas: "别墅",
  western: "西方",
};

const TOKEN_ZH: Record<string, string> = {
  an: "安",
  anh: "英",
  ba: "巴",
  bac: "北",
  binh: "平",
  chau: "珠",
  cu: "渠",
  dai: "大",
  dinh: "亭",
  dong: "东",
  duc: "德",
  giang: "江",
  hai: "海",
  hoa: "和",
  hong: "红",
  hue: "顺化",
  khanh: "庆",
  lan: "兰",
  linh: "灵",
  long: "龙",
  minh: "明",
  nam: "南",
  ngoc: "玉",
  nguyen: "阮",
  phat: "发",
  phu: "富",
  quang: "广",
  son: "山",
  tan: "新",
  thanh: "清",
  thien: "天",
  thu: "秋",
  trang: "庄",
  trung: "忠",
  van: "文",
  viet: "越",
  vinh: "荣",
  xa: "舍",
};

const LETTER_ZH: Record<string, string> = {
  a: "阿",
  b: "布",
  c: "克",
  d: "德",
  e: "埃",
  f: "弗",
  g: "格",
  h: "赫",
  i: "伊",
  j: "杰",
  k: "凯",
  l: "勒",
  m: "姆",
  n: "恩",
  o: "奥",
  p: "普",
  q: "库",
  r: "尔",
  s: "斯",
  t: "特",
  u: "乌",
  v: "维",
  w: "沃",
  x: "西",
  y: "伊",
  z: "泽",
};

function normalizeLatin(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[Đđ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function transliterateUnknownToken(token: string): string {
  const normalized = normalizeLatin(token);
  if (!normalized) return token;
  if (/^\d+$/.test(normalized)) return normalized;
  return normalized
    .split("")
    .map((letter) => LETTER_ZH[letter] ?? "")
    .join("");
}

function translateLatinPhrase(text: string): string {
  const normalized = normalizeLatin(text);
  if (!normalized) return text;
  if (HOTEL_NAME_ZH[normalized]) return HOTEL_NAME_ZH[normalized];
  if (PHRASE_ZH[normalized]) return PHRASE_ZH[normalized];

  const tokens = normalized.split(/\s+/).filter(Boolean);
  const translated: string[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    let matched = false;
    for (const width of [4, 3, 2]) {
      const phrase = tokens.slice(index, index + width).join(" ");
      const phraseTranslation = HOTEL_NAME_ZH[phrase] ?? PHRASE_ZH[phrase];
      if (!phraseTranslation) continue;
      translated.push(phraseTranslation);
      index += width - 1;
      matched = true;
      break;
    }
    if (matched) continue;
    translated.push(
      WORD_ZH[tokens[index]]
      ?? TOKEN_ZH[tokens[index]]
      ?? transliterateUnknownToken(tokens[index]),
    );
  }
  return translated.join("");
}

function translateLatinFragments(text: string): string {
  return text.replace(
    /[A-Za-zÀ-ỹĐđ][A-Za-zÀ-ỹĐđ0-9'’&.-]*(?:\s+[A-Za-zÀ-ỹĐđ0-9'’&.-]+)*/g,
    (match) => translateLatinPhrase(match),
  );
}

function translateAdministrativeUnits(text: string): string {
  return text
    .replace(/\b(?:Thành phố|TP\.?)\s+([^,，]+)/gi, (_, place: string) => `${translateLatinPhrase(place)}市`)
    .replace(/\b(?:Tỉnh)\s+([^,，]+)/gi, (_, place: string) => `${translateLatinPhrase(place)}省`)
    .replace(/\b(?:Quận|District)\s+([^,，]+)/gi, (_, place: string) => `${translateLatinPhrase(place)}郡`)
    .replace(/\b(?:Huyện)\s+([^,，]+)/gi, (_, place: string) => `${translateLatinPhrase(place)}县`)
    .replace(/\b(?:Phường|Ward)\s+([^,，]+)/gi, (_, place: string) => `${translateLatinPhrase(place)}坊`)
    .replace(/\b(?:Xã|Commune)\s+([^,，]+)/gi, (_, place: string) => `${translateLatinPhrase(place)}社`)
    .replace(/\b(?:Thị trấn|Town)\s+([^,，]+)/gi, (_, place: string) => `${translateLatinPhrase(place)}市镇`);
}

export function localizeVnPrearrivalHotelLabel(
  vietnameseAddress: string,
  englishAddress: string,
): string {
  const source = vietnameseAddress.trim() || englishAddress.trim();
  if (!source) return "";

  const [propertyName, ...addressParts] = source.split(/\s*,\s*/);
  const localizedPropertyName = translateLatinPhrase(propertyName);
  const localizedAddress = translateLatinFragments(
    translateAdministrativeUnits(addressParts.join("，").replace(/Вьетнам/gi, "越南")),
  );
  const localized = [localizedPropertyName, localizedAddress]
    .filter(Boolean)
    .join("，")
    .replace(/\bĐường\b/gi, "路")
    .replace(/\bTổ\s*/gi, "第")
    .replace(/\bKhối\b/gi, "街区")
    .replace(/\bThôn\b/gi, "村")
    .replace(/\bẤp\b/gi, "邑")
    .replace(/\s*,\s*/g, "，")
    .replace(/\s+/g, "")
    .replace(/，{2,}/g, "，")
    .replace(/^，|，$/g, "");

  return localized;
}
