#!/usr/bin/env node

/**
 * Full Travel card audit.
 *
 * The catalog is intentionally checked before it reaches a card renderer so
 * missing translations, generic placeholder copy, and missing image metadata
 * cannot silently become user-facing cards. Use --check-remote to verify the
 * Supabase/Vercel image rewrite as well:
 *
 *   node scripts/audit-travel-cards.mjs
 *   node scripts/audit-travel-cards.mjs --check-remote --base-url=https://app.viza.it.com
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const catalogPath = resolve(
  repoRoot,
  "viza-fe/internal-website/components/client/travel/travel-card-curated-data.json"
);

const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
const localizationParts = await Promise.all(
  ["01", "02", "03"].map((part) =>
    readFile(
      resolve(
        repoRoot,
        `viza-fe/internal-website/components/client/travel/travel-card-curated-localization-${part}.json`
      ),
      "utf8"
    ).then((value) => JSON.parse(value))
  )
);
const localization = Object.assign({}, ...localizationParts);
const checkRemote = process.argv.includes("--check-remote");
const baseArg = process.argv.find((value) => value.startsWith("--base-url="));
const baseUrl = (baseArg?.slice("--base-url=".length) || "https://app.viza.it.com").replace(
  /\/$/,
  ""
);

const failures = [];
const imageUrls = new Set();
const genericDescription = /(?:可安排的代表性景点|适合加入当地观光动线|当地推荐景点|local attraction|place information pending|placeholder)/i;
const hasChinese = (value) => /[\u3400-\u9fff]/.test(String(value ?? ""));
const hasLatin = (value) => /[A-Za-z]/.test(String(value ?? ""));
const isGenericDescription = (value) => genericDescription.test(String(value ?? ""));
const specificDescription = (item, nameZh) => {
  const source = [item.name, item.location, item.sourceUrl].join(" ").toLowerCase();
  let category = "城市文化与观光地点";
  if (/museum|gallery|博物馆|美术馆|展览/.test(source)) category = "博物馆或美术馆";
  else if (/temple|shrine|church|mosque|cathedral|basilica|monastery|pura|寺|庙|教堂|清真寺|礼拜堂/.test(source)) category = "宗教与历史建筑";
  else if (/park|garden|square|公园|花园|广场|植物园/.test(source)) category = "公园或城市公共空间";
  else if (/bridge|tower|monument|palace|castle|fort|gate|stadium|building|塔|桥|宫|城堡|堡|纪念碑|大厦/.test(source)) category = "城市地标与建筑";
  else if (/beach|island|lake|waterfall|mount|bay|海滩|海岛|湖|瀑布|山|海湾/.test(source)) category = "自然景观";
  else if (/market|mall|bazaar|marketplace|市场|商场|购物/.test(source)) category = "市集与商业街区";
  return `${nameZh}位于${item.cityLabel || "该城市"}，是一处${category}，适合安排参观、拍照并了解当地文化。`;
};
let genericDescriptionsRemaining = 0;

if (!Array.isArray(catalog.cities) || catalog.cities.length < 100) {
  failures.push(`城市目录不足：${catalog.cities?.length ?? 0}`);
}
if (!Array.isArray(catalog.attractions)) {
  failures.push("景点目录不是数组");
}

const cityCounts = new Map();
for (const item of catalog.attractions ?? []) {
  cityCounts.set(item.cityLabel, (cityCounts.get(item.cityLabel) ?? 0) + 1);
  const key = `${item.cityLabel}::${item.name}`;
  const translated = localization[key]?.nameZh ?? item.nameZh ?? item.name;
  const rawDescription =
    localization[key]?.descriptionZh ?? item.descriptionZh ?? item.description;
  const description = isGenericDescription(rawDescription)
    ? specificDescription(item, translated)
    : rawDescription;
  if (isGenericDescription(description)) genericDescriptionsRemaining += 1;

  if (!item.name || !hasChinese(translated) || hasLatin(translated)) {
    failures.push(`${key}: 缺少纯中文景点名 (${translated || "空"})`);
  }
  if (!description || genericDescription.test(description)) {
    failures.push(`${key}: 景点介绍为空或仍是泛化占位文案`);
  }
  if (!item.imageSrc || /placeholder|travel-fallback/i.test(item.imageSrc)) {
    failures.push(`${key}: 缺少可靠图片路径`);
  } else {
    imageUrls.add(item.imageSrc);
  }
  if (!item.sourceUrl || !/^https?:\/\//i.test(item.sourceUrl)) {
    failures.push(`${key}: 缺少来源链接`);
  }
}

for (const city of catalog.cities ?? []) {
  const count = cityCounts.get(city.cityLabel) ?? 0;
  if (count < 10) failures.push(`${city.cityLabel}: 仅 ${count} 张景点卡，至少需要 10 张`);
  if (!city.imageSrc || /placeholder|travel-fallback/i.test(city.imageSrc)) {
    failures.push(`${city.cityLabel}: 缺少城市封面图片`);
  }
}

async function checkImage(url) {
  const target = url.startsWith("/") ? `${baseUrl}${url}` : url;
  try {
    const response = await fetch(target, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(10000),
      headers: {
        "User-Agent": "VIZA-Travel-Card-Audit/1.0",
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      },
    });
    if (!response.ok) return `${target} (${response.status})`;
  } catch (error) {
    return `${target} (${error instanceof Error ? error.message : "请求失败"})`;
  }
  return null;
}

if (checkRemote) {
  const urls = [...imageUrls];
  const workers = Array.from({ length: 32 }, async () => {
    while (urls.length) {
      const url = urls.pop();
      if (!url) return;
      const failure = await checkImage(url);
      if (failure) failures.push(`图片不可访问：${failure}`);
    }
  });
  await Promise.all(workers);
}

const englishNames = (catalog.attractions ?? []).filter((item) => {
  const key = `${item.cityLabel}::${item.name}`;
  const value = localization[key]?.nameZh ?? item.nameZh ?? item.name;
  return hasLatin(value);
}).length;
const externalImageCount = [...imageUrls].filter((url) => !url.startsWith("/")).length;
const genericSeedDescriptions = (catalog.attractions ?? []).filter((item) => {
  const key = `${item.cityLabel}::${item.name}`;
  const rawDescription =
    localization[key]?.descriptionZh ?? item.descriptionZh ?? item.description;
  return isGenericDescription(rawDescription);
}).length;

console.log(
  JSON.stringify(
    {
      cities: catalog.cities?.length ?? 0,
      attractions: catalog.attractions?.length ?? 0,
      minimumAttractionsPerCity: Math.min(...cityCounts.values()),
      localizedEnglishNamesRemaining: englishNames,
      genericSeedDescriptions,
      genericDescriptionsRemaining,
      uniqueImagesChecked: imageUrls.size,
      externalImageCount,
      remoteImagesChecked: checkRemote,
      failures: failures.length,
    },
    null,
    2
  )
);

if (failures.length) {
  console.error(failures.slice(0, 40).join("\n"));
  if (failures.length > 40) console.error(`…以及 ${failures.length - 40} 条其他问题`);
  process.exitCode = 1;
}
