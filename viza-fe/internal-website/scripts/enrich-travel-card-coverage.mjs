import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptDir, "..");
const publicRoot = path.join(appRoot, "public");
const locationsPath = path.join(appRoot, "lib", "travel", "locations.ts");
const cardDataPath = path.join(
  appRoot,
  "components",
  "client",
  "travel",
  "travel-card-curated-data.json"
);

const USER_AGENT = "VIZA Travel AI card coverage updater/1.0";
const MIN_ATTRACTIONS_PER_CITY = 4;
const DEFAULT_DOWNLOAD_DELAY_MS = Number(
  process.env.TRAVEL_CARD_DOWNLOAD_DELAY_MS ?? 1200
);
const DEFAULT_QUERY_DELAY_MS = Number(
  process.env.TRAVEL_CARD_QUERY_DELAY_MS ?? 900
);
const DEFAULT_IMAGE_WIDTH = Number(process.env.TRAVEL_CARD_IMAGE_WIDTH ?? 640);

const args = process.argv.slice(2);
const shouldWrite = args.includes("--write");
const shouldDryRun = args.includes("--dry-run");
const shouldRefresh = args.includes("--refresh");
const cityFilters = args
  .flatMap((arg, index) =>
    arg === "--city" && args[index + 1] ? [args[index + 1]] : []
  )
  .map(normalizeKey);
let dropdownCities = [];

const CITY_TITLE_OVERRIDES = new Map(
  Object.entries({
    "newyork|unitedstates": "New York City",
    "losangeles|unitedstates": "Los Angeles",
    "lasvegas|unitedstates": "Las Vegas",
    "goldcoast|australia": "Gold Coast, Queensland",
    "quebeccity|canada": "Quebec City",
    "saopaulo|brazil": "Sao Paulo",
    "cordoba|argentina": "Córdoba, Argentina",
    "florianopolis|brazil": "Florianópolis",
    "faro|portugal": "Faro, Portugal",
    "fes|morocco": "Fez, Morocco",
    "malacca|malaysia": "Malacca City",
    "cappadocia|turkey": "Cappadocia",
    "madeira|portugal": "Madeira",
    "goa|india": "Goa",
    "bali|indonesia": "Bali",
    "hawaii|unitedstates": "Hawaii",
    "kohsamui|thailand": "Ko Samui",
  }).map(([key, value]) => [key, value])
);

const ATTRACTION_CLASS_IDS = [
  "Q570116", // tourist attraction
  "Q33506", // museum
  "Q22698", // park
  "Q4989906", // monument
  "Q839954", // archaeological site
  "Q23413", // castle
  "Q16560", // palace
  "Q11303", // skyscraper
  "Q16970", // church
  "Q44539", // temple
  "Q32815", // mosque
  "Q12280", // bridge
  "Q12518", // tower
  "Q1496967", // shopping mall
  "Q15243209", // historic district
  "Q194195", // amusement park
  "Q23442", // island
  "Q62832", // astronomical observatory
  "Q863404", // pier
  "Q207694", // art museum
  "Q24354", // theatre
  "Q811979", // architectural structure
  "Q174782", // lighthouse
  "Q483110", // stadium
];

const EXCLUDED_ATTRACTION_PATTERN =
  /\b(airport|air force|airbase|military base|railway station|metro station|subway station|bus station|police|hospital|university|college|school|studios?|headquarters|office|bank|power station|circuit|prison|cemetery|interchange|highway|stadium|arena)\b/i;
const PRIORITY_ATTRACTION_PATTERN =
  /\b(sign|walk of fame|hollywood|griffith|getty|santa monica|observatory|museum|gallery|park|garden|palace|castle|temple|church|mosque|cathedral|tower|bridge|historic|old town|square|plaza|waterfront|harbour|harbor|strip|bellagio|venetian|sphere|fremont|pier|fort|fortress|monument|theatre|theater|zoo|aquarium|island|beach|market|bazaar|mall|opera|national park|canyon|dam)\b/i;

const TRADITIONAL_TO_SIMPLIFIED = new Map(
  Object.entries({
    臺: "台",
    灣: "湾",
    廣: "广",
    東: "东",
    門: "门",
    園: "园",
    館: "馆",
    宮: "宫",
    樂: "乐",
    標: "标",
    誌: "志",
    賭: "赌",
    萊: "莱",
    塢: "坞",
    聖: "圣",
    羅: "罗",
    馬: "马",
    薩: "萨",
    維: "维",
    納: "纳",
    爾: "尔",
    蘭: "兰",
    亞: "亚",
    國: "国",
    際: "际",
    機: "机",
    場: "场",
    車: "车",
    鐵: "铁",
    橋: "桥",
    區: "区",
    歷: "历",
    術: "术",
    劇: "剧",
    觀: "观",
    廟: "庙",
    濱: "滨",
    島: "岛",
    廳: "厅",
    廈: "厦",
    樓: "楼",
    頭: "头",
    碼: "码",
    長: "长",
    舊: "旧",
    鎮: "镇",
    鄉: "乡",
    莊: "庄",
    牆: "墙",
    鐘: "钟",
    雲: "云",
    愛: "爱",
    麗: "丽",
    榮: "荣",
    華: "华",
    寶: "宝",
    貝: "贝",
    達: "达",
    內: "内",
    緬: "缅",
    靈: "灵",
    隱: "隐",
    濟: "济",
    寧: "宁",
    蘇: "苏",
    錫: "锡",
    鄭: "郑",
    陽: "阳",
    書: "书",
    畫: "画",
    勝: "胜",
    跡: "迹",
    遺: "遗",
    產: "产",
    風: "风",
  })
);

function toSimplifiedChinese(value) {
  return String(value ?? "")
    .split("")
    .map((char) => TRADITIONAL_TO_SIMPLIFIED.get(char) ?? char)
    .join("");
}

function normalizeKey(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]/g, "");
}

function slugify(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseDropdownCities(source) {
  const cities = [];
  let currentCountry = "";

  source.split(/\r?\n/).forEach((line) => {
    const countryMatch = line.match(/^\s{2}(?:"([^"]+)"|([A-Za-z ]+)):\s*\[/);
    if (countryMatch) {
      currentCountry = countryMatch[1] ?? countryMatch[2] ?? "";
      return;
    }

    const cityMatch = line.match(
      /\{\s*en:\s*"([^"]+)",\s*zh:\s*"([^"]+)"(?:,\s*aliases:\s*\[([^\]]+)])?/
    );
    if (!cityMatch || !currentCountry) return;

    cities.push({
      country: currentCountry,
      en: cityMatch[1],
      zh: cityMatch[2],
      aliases: Array.from(cityMatch[3]?.matchAll(/"([^"]+)"/g) ?? []).map(
        (match) => match[1]
      ),
    });
  });

  return cities;
}

function itemHasCityKey(item, city) {
  const cityKeys = [city.en, city.zh, ...city.aliases].map(normalizeKey);
  return (item.cityKeys ?? []).some((key) => cityKeys.includes(normalizeKey(key)));
}

function getExistingAttractions(data, city) {
  return data.attractions.filter((item) => itemHasCityKey(item, city));
}

function getExistingCityCard(data, city) {
  return data.cities.find((item) => itemHasCityKey(item, city));
}

async function fetchJson(url, attempts = 4) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": USER_AGENT,
      },
    });
    const text = await response.text();
    if (response.ok) return JSON.parse(text);

    if (response.status === 429 || response.status >= 500) {
      await delay(2000 * attempt);
      continue;
    }

    throw new Error(`${response.status} ${response.statusText}: ${text}`);
  }
  throw new Error(`Failed after ${attempts} attempts: ${url}`);
}

async function findWikipediaCityPage(city) {
  const override = CITY_TITLE_OVERRIDES.get(
    `${normalizeKey(city.en)}|${normalizeKey(city.country)}`
  );
  const titleCandidates = override ? [override, city.en] : [city.en];

  for (const title of titleCandidates) {
    const direct = await getWikipediaPages({
      titles: title,
      limit: 1,
    });
    const page = direct.find((candidate) => candidate.qid && candidate.coords);
    if (page) return page;
    await delay(DEFAULT_QUERY_DELAY_MS);
  }

  const searchQueries = [
    `${city.en} ${city.country}`,
    `${city.en} ${city.country} city`,
    city.en,
  ];

  for (const query of searchQueries) {
    const candidates = await getWikipediaPages({ search: query, limit: 5 });
    const page = candidates
      .filter((candidate) => candidate.qid && candidate.coords)
      .sort((first, second) => scoreCityPage(second, city) - scoreCityPage(first, city))[0];
    if (page) return page;
    await delay(DEFAULT_QUERY_DELAY_MS);
  }

  return null;
}

function scoreCityPage(page, city) {
  const title = normalizeKey(page.title);
  const cityKey = normalizeKey(city.en);
  const countryKey = normalizeKey(city.country);
  let score = 0;
  if (title === cityKey) score += 30;
  if (title.includes(cityKey)) score += 12;
  if (title.includes(countryKey)) score += 6;
  if (page.description && /city|town|capital|municipality|island/i.test(page.description)) {
    score += 6;
  }
  if (page.imageUrl) score += 4;
  return score;
}

async function getWikipediaPages({ titles, search, limit }) {
  const url = new URL("https://en.wikipedia.org/w/api.php");
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    prop: "pageprops|coordinates|pageimages|description",
    piprop: "original|thumbnail",
    pithumbsize: "960",
    origin: "*",
  });

  if (titles) {
    params.set("titles", titles);
  } else {
    params.set("generator", "search");
    params.set("gsrsearch", search);
    params.set("gsrlimit", String(limit));
  }

  url.search = params;
  const payload = await fetchJson(url);
  return Object.values(payload.query?.pages ?? {})
    .filter((page) => !page.missing)
    .map((page) => ({
      title: page.title,
      qid: page.pageprops?.wikibase_item,
      coords: page.coordinates?.[0],
      imageUrl: page.thumbnail?.source ?? page.original?.source ?? "",
      originalImageUrl: page.original?.source ?? page.thumbnail?.source ?? "",
      sourceUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(
        page.title.replaceAll(" ", "_")
      )}`,
      description: page.description ?? "",
    }));
}

function pointFromWikidata(value) {
  const match = String(value ?? "").match(/Point\(([-0-9.]+) ([-0-9.]+)\)/);
  if (!match) return null;
  return {
    lng: Number(match[1]),
    lat: Number(match[2]),
  };
}

function distanceKm(first, second) {
  const earthRadiusKm = 6371;
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const latDelta = toRadians(second.lat - first.lat);
  const lngDelta = toRadians(second.lng - first.lng);
  const firstLat = toRadians(first.lat);
  const secondLat = toRadians(second.lat);
  const a =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(firstLat) *
      Math.cos(secondLat) *
      Math.sin(lngDelta / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function safeDecodeUrlText(value) {
  try {
    return decodeURIComponent(String(value ?? "").replaceAll("_", " "));
  } catch {
    return String(value ?? "").replaceAll("_", " ");
  }
}

function isSubstantialCityKey(key) {
  if (!key) return false;
  return /^[a-z0-9]+$/.test(key) ? key.length >= 4 : key.length >= 2;
}

function hasOtherDropdownCityName(candidate, city, allCities) {
  const currentKeys = new Set(
    [city.en, city.zh, ...city.aliases].map(normalizeKey)
  );
  const haystack = normalizeKey(
    `${candidate.name} ${candidate.nameEn} ${safeDecodeUrlText(candidate.sourceUrl)}`
  );

  return (allCities ?? []).some((otherCity) => {
    const isCurrentCity = [otherCity.en, otherCity.zh, ...otherCity.aliases]
      .map(normalizeKey)
      .some((key) => currentKeys.has(key));
    if (isCurrentCity) return false;

    return [otherCity.en, otherCity.zh, ...otherCity.aliases]
      .map(normalizeKey)
      .some((key) => isSubstantialCityKey(key) && haystack.includes(key));
  });
}

async function fetchAttractionCandidates(cityPage, radius = 45, city, allCities) {
  const classes = ATTRACTION_CLASS_IDS.map((id) => `wd:${id}`).join(" ");
  const qid = cityPage.qid;
  const coords = cityPage.coords;
  const query = `SELECT DISTINCT ?item ?itemLabel ?labelZhCn ?labelZhHans ?labelZh ?labelEn ?descZhCn ?descZhHans ?descZh ?descEn ?coord ?image ?article ?sitelinks WHERE {
    SERVICE wikibase:around {
      ?item wdt:P625 ?coord.
      bd:serviceParam wikibase:center "Point(${coords.lon} ${coords.lat})"^^geo:wktLiteral.
      bd:serviceParam wikibase:radius "${radius}".
    }
    ?item wdt:P18 ?image.
    ?item wikibase:sitelinks ?sitelinks.
    ?item wdt:P31/wdt:P279* ?class.
    VALUES ?class { ${classes} }
    FILTER(?item != wd:${qid})
    OPTIONAL { ?article schema:about ?item; schema:isPartOf <https://en.wikipedia.org/>. }
    OPTIONAL { ?item rdfs:label ?labelZhCn FILTER(LANG(?labelZhCn) = "zh-cn") }
    OPTIONAL { ?item rdfs:label ?labelZhHans FILTER(LANG(?labelZhHans) = "zh-hans") }
    OPTIONAL { ?item rdfs:label ?labelZh FILTER(LANG(?labelZh) = "zh") }
    OPTIONAL { ?item rdfs:label ?labelEn FILTER(LANG(?labelEn) = "en") }
    OPTIONAL { ?item schema:description ?descZhCn FILTER(LANG(?descZhCn) = "zh-cn") }
    OPTIONAL { ?item schema:description ?descZhHans FILTER(LANG(?descZhHans) = "zh-hans") }
    OPTIONAL { ?item schema:description ?descZh FILTER(LANG(?descZh) = "zh") }
    OPTIONAL { ?item schema:description ?descEn FILTER(LANG(?descEn) = "en") }
    BIND(COALESCE(?labelZhCn, ?labelZhHans, ?labelZh, ?labelEn) AS ?itemLabel)
  } ORDER BY DESC(?sitelinks) LIMIT 35`;

  const url = new URL("https://query.wikidata.org/sparql");
  url.search = new URLSearchParams({ query, format: "json" });
  const payload = await fetchJson(url);
  return payload.results.bindings
    .map((binding) => {
      const coord = pointFromWikidata(binding.coord?.value);
      const name =
        binding.labelZhCn?.value ??
        binding.labelZhHans?.value ??
        binding.labelZh?.value ??
        binding.labelEn?.value ??
        binding.itemLabel?.value ??
        "";
      const nameEn = binding.labelEn?.value ?? name;
      const description =
        binding.descZhCn?.value ??
        binding.descZhHans?.value ??
        binding.descZh?.value ??
        binding.descEn?.value ??
        "";
      return {
        itemUrl: binding.item?.value ?? "",
        name: toSimplifiedChinese(name),
        nameEn,
        description: toSimplifiedChinese(description),
        coord,
        distanceKm: distanceKm(
          { lat: coords.lat, lng: coords.lon },
          { lat: coord.lat, lng: coord.lng }
        ),
        imageUrl: binding.image?.value ?? "",
        sourceUrl: binding.article?.value ?? binding.item?.value ?? "",
        sitelinks: Number(binding.sitelinks?.value ?? 0),
      };
    })
    .filter(
      (item) =>
        item.name &&
        item.coord &&
        item.imageUrl &&
        item.sourceUrl &&
        item.distanceKm <= radius + 2 &&
        !EXCLUDED_ATTRACTION_PATTERN.test(`${item.name} ${item.nameEn} ${item.description}`) &&
        !hasOtherDropdownCityName(item, city, allCities)
    )
    .sort((first, second) => attractionScore(second) - attractionScore(first));
}

function attractionScore(item) {
  let score = item.sitelinks;
  if (PRIORITY_ATTRACTION_PATTERN.test(`${item.name} ${item.nameEn} ${item.description}`)) {
    score += 40;
  }
  if (item.sourceUrl.includes("wikipedia.org/wiki/")) score += 10;
  if (item.description) score += 4;
  score -= Math.min(item.distanceKm ?? 0, 80) * 1.4;
  return score;
}

function uniqueAttractions(candidates) {
  const seen = new Set();
  return candidates.filter((candidate) => {
    const key = normalizeKey(candidate.nameEn || candidate.name);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function imageUrlForDownload(imageUrl) {
  if (!imageUrl) return "";
  if (imageUrl.includes("Special:FilePath/")) {
    return imageUrl.replace(/^http:/, "https:") + `?width=${DEFAULT_IMAGE_WIDTH}`;
  }
  return imageUrl.replace(/^http:/, "https:");
}

function extensionForContentType(contentType) {
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return ".jpg";
  if (contentType.includes("png")) return ".png";
  if (contentType.includes("webp")) return ".webp";
  return "";
}

async function downloadImage(url, baseRelativePath) {
  const targetBase = path.join(publicRoot, baseRelativePath);
  const existing = await findExistingImage(targetBase);
  if (existing) return existing;

  const response = await fetchWithRetry(imageUrlForDownload(url));
  const contentType = response.headers.get("content-type") ?? "";
  const ext = extensionForContentType(contentType);
  if (!ext) {
    throw new Error(`Unsupported image content type ${contentType} for ${url}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  const outputPath = `${targetBase}${ext}`;
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, bytes);
  await delay(DEFAULT_DOWNLOAD_DELAY_MS);
  return `/${path.relative(publicRoot, outputPath).replaceAll(path.sep, "/")}`;
}

async function findExistingImage(targetBase) {
  for (const ext of [".jpg", ".jpeg", ".png", ".webp"]) {
    const candidate = `${targetBase}${ext}`;
    try {
      await fs.access(candidate);
      return `/${path.relative(publicRoot, candidate).replaceAll(path.sep, "/")}`;
    } catch {
      // keep looking
    }
  }
  return null;
}

async function fetchWithRetry(url, attempts = 5) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const response = await fetch(url, {
      redirect: "follow",
      headers: { "User-Agent": USER_AGENT },
    });
    if (response.ok) return response;
    if (response.status === 429 || response.status >= 500) {
      await delay(2500 * attempt);
      continue;
    }
    throw new Error(`${response.status} ${response.statusText}: ${url}`);
  }
  throw new Error(`Failed image download after ${attempts} attempts: ${url}`);
}

function buildCityKeys(city) {
  return Array.from(new Set([city.en, city.zh, ...city.aliases, normalizeKey(city.en)]))
    .map((value) => String(value).trim())
    .filter(Boolean);
}

function buildDescription(candidate, city) {
  if (/[\u3400-\u9fff]/.test(candidate.description)) return candidate.description;
  return `${city.zh}可安排的代表性景点，适合加入当地观光动线。`;
}

async function enrichCity(data, city) {
  if (shouldRefresh) {
    data.cities = data.cities.filter((item) => !itemHasCityKey(item, city));
    data.attractions = data.attractions.filter(
      (item) => !itemHasCityKey(item, city)
    );
  }

  const existingCityCard = getExistingCityCard(data, city);
  const existingAttractions = getExistingAttractions(data, city);
  if (
    existingCityCard &&
    existingAttractions.length >= MIN_ATTRACTIONS_PER_CITY
  ) {
    return { city, status: "skipped", reason: "already-covered" };
  }

  const cityPage = await findWikipediaCityPage(city);
  if (!cityPage) {
    return { city, status: "failed", reason: "city-page-not-found" };
  }

  let cityImageSrc = existingCityCard?.imageSrc;
  if (!cityImageSrc && cityPage.imageUrl) {
    cityImageSrc = await downloadImage(
      cityPage.imageUrl,
      `travel/cities/${slugify(city.en)}`
    );
  }

  if (!existingCityCard && cityImageSrc) {
    data.cities.push({
      cityKeys: buildCityKeys(city),
      cityLabel: city.zh,
      imageSrc: cityImageSrc,
      sourceUrl: cityPage.sourceUrl,
    });
  }

  const needed = Math.max(0, MIN_ATTRACTIONS_PER_CITY - existingAttractions.length);
  if (needed === 0) {
    return { city, status: "updated", addedAttractions: 0 };
  }

  let candidates = uniqueAttractions(
    await fetchAttractionCandidates(cityPage, 24, city, dropdownCities)
  );
  if (candidates.length < needed) {
    await delay(DEFAULT_QUERY_DELAY_MS);
    candidates = uniqueAttractions([
      ...candidates,
      ...(await fetchAttractionCandidates(cityPage, 45, city, dropdownCities)),
    ]);
  }
  if (candidates.length < needed) {
    await delay(DEFAULT_QUERY_DELAY_MS);
    candidates = uniqueAttractions([
      ...candidates,
      ...(await fetchAttractionCandidates(cityPage, 80, city, dropdownCities)),
    ]);
  }

  const existingNames = new Set(
    existingAttractions.map((item) => normalizeKey(item.name))
  );
  let added = 0;
  const errors = [];

  for (let index = 0; index < candidates.length && added < needed; index += 6) {
    const batch = candidates
      .slice(index, index + 6)
      .filter((candidate) => !existingNames.has(normalizeKey(candidate.name)));

    const downloaded = await Promise.allSettled(
      batch.map(async (candidate) => {
        const imageSrc = await downloadImage(
          candidate.imageUrl,
          `travel/attractions/${slugify(city.en)}-${slugify(candidate.nameEn || candidate.name)}`
        );
        return { candidate, imageSrc };
      })
    );

    for (const result of downloaded) {
      if (added >= needed) break;
      if (result.status === "rejected") {
        errors.push(result.reason instanceof Error ? result.reason.message : String(result.reason));
        continue;
      }

      const { candidate, imageSrc } = result.value;
      const candidateKey = normalizeKey(candidate.name);
      if (existingNames.has(candidateKey)) continue;

      data.attractions.push({
        cityKeys: buildCityKeys(city),
        cityLabel: city.zh,
        name: candidate.name,
        location: candidate.nameEn || candidate.name,
        imageSrc,
        sourceUrl: candidate.sourceUrl,
        description: buildDescription(candidate, city),
        aliases: Array.from(new Set([candidate.nameEn, candidate.name].filter(Boolean))),
        lat: Number(candidate.coord.lat.toFixed(6)),
        lng: Number(candidate.coord.lng.toFixed(6)),
      });
      existingNames.add(candidateKey);
      added += 1;
    }
  }

  return {
    city,
    status: added >= needed ? "updated" : "partial",
    addedAttractions: added,
    needed,
    errors,
  };
}

async function main() {
  const source = await fs.readFile(locationsPath, "utf8");
  const allCities = parseDropdownCities(source);
  dropdownCities = allCities;
  const data = JSON.parse(await fs.readFile(cardDataPath, "utf8"));
  const targetCities = cityFilters.length
    ? allCities.filter((city) =>
        [city.en, city.zh, city.country, ...city.aliases]
          .map(normalizeKey)
          .some((key) => cityFilters.includes(key))
      )
    : allCities;

  const report = [];
  for (const city of targetCities) {
    let result;
    try {
      result = await enrichCity(data, city);
    } catch (error) {
      result = {
        city,
        status: "failed",
        reason: error instanceof Error ? error.message : String(error),
      };
    }
    report.push(result);
    console.log(
      `${result.status.toUpperCase()} ${city.en} (${city.country}) ${
        result.addedAttractions !== undefined
          ? `+${result.addedAttractions} attractions`
          : result.reason ?? ""
      }`
    );
    if (result.errors?.length) {
      console.log(`  ${result.errors.slice(0, 2).join(" | ")}`);
    }
    if (shouldWrite && !shouldDryRun) {
      await fs.writeFile(cardDataPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
    }
    await delay(DEFAULT_QUERY_DELAY_MS);
  }

  const summary = {
    write: shouldWrite && !shouldDryRun,
    requestedCities: targetCities.length,
    updated: report.filter((item) => item.status === "updated").length,
    partial: report.filter((item) => item.status === "partial").length,
    failed: report.filter((item) => item.status === "failed").length,
    skipped: report.filter((item) => item.status === "skipped").length,
    partialCities: report
      .filter((item) => item.status === "partial" || item.status === "failed")
      .map((item) => ({
        city: item.city.en,
        country: item.city.country,
        status: item.status,
        reason: item.reason,
        errors: item.errors?.slice(0, 3) ?? [],
      })),
  };

  console.log(JSON.stringify(summary, null, 2));
  if (summary.partial || summary.failed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
