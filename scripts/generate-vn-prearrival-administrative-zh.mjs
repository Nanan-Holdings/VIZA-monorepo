import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const OFFICIAL_DATA_PATH = path.join(
  ROOT,
  "viza-fe",
  "internal-website",
  "lib",
  "vn-prearrival",
  "administrative-units-legacy.json",
);
const OUTPUT_PATH = path.join(
  ROOT,
  "viza-fe",
  "internal-website",
  "lib",
  "vn-prearrival",
  "official-administrative-names.zh-CN.json",
);

const PROVINCE_PAGE_BY_CODE = {
  "01": "河內市",
  "04": "高平省",
  "08": "宣光省",
  "11": "奠邊省",
  "12": "萊州省",
  "14": "山羅省",
  "15": "老街省",
  "19": "太原省",
  "20": "諒山省",
  "22": "廣寧省",
  "24": "北寧省",
  "25": "富壽省",
  "31": "海防市",
  "33": "興安省",
  "37": "寧平省",
  "38": "清化省",
  "40": "乂安省",
  "42": "河靜省",
  "44": "廣治省",
  "46": "順化市",
  "48": "峴港市",
  "51": "廣義省",
  "52": "嘉萊省",
  "56": "慶和省",
  "66": "多樂省",
  "68": "林同省",
  "75": "同奈省",
  "79": "胡志明市",
  "80": "西寧省",
  "82": "同塔省",
  "86": "永隆省",
  "91": "安江省",
  "92": "芹苴市",
  "96": "金甌省",
};

const PROVINCE_ZH_BY_CODE = {
  "01": "河内市",
  "04": "高平省",
  "08": "宣光省",
  "11": "奠边省",
  "12": "莱州省",
  "14": "山罗省",
  "15": "老街省",
  "19": "太原省",
  "20": "谅山省",
  "22": "广宁省",
  "24": "北宁省",
  "25": "富寿省",
  "31": "海防市",
  "33": "兴安省",
  "37": "宁平省",
  "38": "清化省",
  "40": "乂安省",
  "42": "河静省",
  "44": "广治省",
  "46": "顺化市",
  "48": "岘港市",
  "51": "广义省",
  "52": "嘉莱省",
  "56": "庆和省",
  "66": "多乐省",
  "68": "林同省",
  "75": "同奈省",
  "79": "胡志明市",
  "80": "西宁省",
  "82": "同塔省",
  "86": "永隆省",
  "91": "安江省",
  "92": "芹苴市",
  "96": "金瓯省",
};

const CHINESE_NAME_OVERRIDE_BY_CODE = {
  "10546": "至灵坊",
  "24412": "姆德拉社",
  "24580": "连山勒社",
  "24778": "林园大叻坊",
  "24781": "春香大叻坊",
  "24787": "甘漓大叻坊",
  "24805": "春长大叻坊",
  "24820": "保禄2坊",
  "24823": "保禄1坊",
  "24841": "保禄3坊",
  "24846": "朗边大叻坊",
  "24868": "南班林河社",
  "24871": "丁文林河社",
  "24883": "南河林河社",
  "24895": "富山林河社",
  "24907": "福寿林河社",
  "24916": "新河林河社",
};

function normalizeVietnamese(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/Đ/g, "D")
    .replace(/đ/g, "d")
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("vi");
}

function normalizeUnitBase(value) {
  return normalizeVietnamese(value)
    .replace(/^(?:phuong|xa|dac khu)\s+/u, "")
    .replace(/[^a-z0-9]+/g, "");
}

function stripChineseUnitType(value) {
  return value.replace(/(?:特区|坊|社)$/u, "");
}

function applyOfficialUnitType(chinese, officialVietnamese) {
  const suffix = officialVietnamese.startsWith("Phường ")
    ? "坊"
    : officialVietnamese.startsWith("Xã ")
      ? "社"
      : officialVietnamese.startsWith("Đặc khu ")
        ? "特区"
        : "";
  return suffix ? `${stripChineseUnitType(chinese)}${suffix}` : chinese;
}

function decodeHtmlEntities(value) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    );
}

function stripHtml(value) {
  return decodeHtmlEntities(
    value
      .replace(/<sup\b[^>]*>[\s\S]*?<\/sup>/gi, "")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/\s+/g, " ")
    .trim();
}

function extractAdministrativeNames(html) {
  const names = new Map();
  for (const match of html.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)) {
    const text = stripHtml(match[1]);
    const unitMatch = text.match(
      /^(.+?)[（(]((?:Phường|Xã|Đặc khu)\s+.+?)[）)]\s*$/u,
    );
    if (!unitMatch) continue;
    const chinese = unitMatch[1].trim();
    const vietnamese = unitMatch[2].trim();
    if (!/[坊社区]$/u.test(chinese)) continue;
    names.set(normalizeVietnamese(vietnamese), chinese);
  }
  return names;
}

function editDistance(left, right) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] +
          (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[right.length];
}

function nearestNames(target, names) {
  return [...names.entries()]
    .map(([vietnamese, chinese]) => ({
      vietnamese,
      chinese,
      distance: editDistance(target, vietnamese),
    }))
    .sort((left, right) => left.distance - right.distance)
    .slice(0, 3);
}

async function fetchProvincePage(page) {
  const response = await fetch(
    `https://zh.wikipedia.org/wiki/${encodeURIComponent(page)}?variant=zh-cn`,
    {
      headers: {
        "User-Agent":
          "VIZA-Vietnam-administrative-localizer/1.0 (development data audit)",
      },
    },
  );
  if (!response.ok) {
    throw new Error(`Failed to fetch ${page}: HTTP ${response.status}`);
  }
  return {
    html: await response.text(),
    page,
    url: response.url.replace(/\?variant=zh-cn$/, ""),
  };
}

async function main() {
  const officialData = JSON.parse(
    await fs.readFile(OFFICIAL_DATA_PATH, "utf8"),
  );
  const wardsByCode = {};
  const missing = [];
  const duplicates = [];
  const sourcePages = {};

  for (const province of officialData.provinces) {
    const page = PROVINCE_PAGE_BY_CODE[province.value];
    if (!page) {
      throw new Error(`No Chinese source page for province ${province.value}`);
    }
    const fetchedPage = await fetchProvincePage(page);
    const pageNames = extractAdministrativeNames(fetchedPage.html);
    const pageNamesByBase = new Map();
    for (const [vietnamese, chinese] of pageNames) {
      const base = normalizeUnitBase(vietnamese);
      const current = pageNamesByBase.get(base) ?? [];
      current.push({ vietnamese, chinese });
      pageNamesByBase.set(base, current);
    }
    const officialKeys = new Set(
      (officialData.wards_by_province[province.value] ?? []).map((unit) =>
        normalizeVietnamese(unit.label_vi),
      ),
    );
    sourcePages[province.value] = {
      page: fetchedPage.page,
      url: fetchedPage.url,
      extracted: pageNames.size,
      unmatched: [...pageNames.entries()]
        .filter(([vietnamese]) => !officialKeys.has(vietnamese))
        .map(([vietnamese, chinese]) => ({ vietnamese, chinese })),
    };

    for (const unit of officialData.wards_by_province[province.value] ?? []) {
      const key = normalizeVietnamese(unit.label_vi);
      const baseMatches = pageNamesByBase.get(normalizeUnitBase(unit.label_vi));
      const sourcedChinese =
        pageNames.get(key) ??
        (baseMatches?.length === 1 ? baseMatches[0].chinese : undefined);
      const chinese =
        CHINESE_NAME_OVERRIDE_BY_CODE[unit.value] ??
        (sourcedChinese
          ? applyOfficialUnitType(sourcedChinese, unit.label_vi)
          : undefined);
      if (!chinese) {
        missing.push({
          province: province.value,
          code: unit.value,
          label_vi: unit.label_vi,
          source_page: fetchedPage.page,
          nearest: nearestNames(key, pageNames),
        });
        continue;
      }
      if (wardsByCode[unit.value] && wardsByCode[unit.value] !== chinese) {
        duplicates.push({
          code: unit.value,
          first: wardsByCode[unit.value],
          second: chinese,
        });
      }
      wardsByCode[unit.value] = chinese;
    }
  }

  const officialTotal = Object.values(
    officialData.wards_by_province,
  ).flat().length;
  if (
    missing.length > 0 ||
    duplicates.length > 0 ||
    Object.keys(wardsByCode).length !== officialTotal
  ) {
    console.error(
      JSON.stringify(
        {
          officialTotal,
          translated: Object.keys(wardsByCode).length,
          missing,
          duplicates,
          sourcePages,
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
    return;
  }

  const invalidChineseUnitTypes = Object.entries(wardsByCode).filter(
    ([, chinese]) => /(?:坊坊|社社|特特区|特区特区)$/u.test(chinese),
  );
  if (invalidChineseUnitTypes.length > 0) {
    throw new Error(
      `Repeated Chinese administrative type suffixes: ${JSON.stringify(
        invalidChineseUnitTypes,
      )}`,
    );
  }

  const output = {
    meta: {
      generated_at: new Date().toISOString(),
      official_unit_count: officialTotal,
      official_code_source:
        "Vietnam Decision 19/2025/QD-TTg (34 provincial and 3321 commune-level units)",
      chinese_name_source:
        "Chinese Wikipedia province/city 2025 administrative-division lists, zh-cn variant",
      source_pages: sourcePages,
    },
    provinces: PROVINCE_ZH_BY_CODE,
    wards: wardsByCode,
  };
  await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`);
  console.log(
    `Wrote ${officialTotal} code-keyed Chinese administrative names to ${OUTPUT_PATH}`,
  );
}

await main();
