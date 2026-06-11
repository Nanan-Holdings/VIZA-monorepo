import * as fs from "node:fs";
import * as path from "node:path";
import { chromium } from "playwright";
import { getDropdownDestinationContracts } from "../lib/travel/destination-contracts";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function pointStyle(
  latitude: number | null,
  longitude: number | null,
  cityLatitude: number | null,
  cityLongitude: number | null
): string {
  if (
    typeof latitude !== "number" ||
    typeof longitude !== "number" ||
    typeof cityLatitude !== "number" ||
    typeof cityLongitude !== "number"
  ) {
    return "left: 50%; top: 50%;";
  }

  const left = Math.max(
    8,
    Math.min(92, 50 + (longitude - cityLongitude) * 120)
  );
  const top = Math.max(8, Math.min(92, 50 - (latitude - cityLatitude) * 120));
  return `left: ${left.toFixed(1)}%; top: ${top.toFixed(1)}%;`;
}

function renderCityPage(
  destination: ReturnType<typeof getDropdownDestinationContracts>[number]
): string {
  const attractions = destination.attractions.slice(0, 10);
  const cardHtml = attractions
    .map(
      (attraction, index) => `
        <article class="card">
          <img src="${escapeHtml(attraction.image?.imageUrl ?? "")}" alt="${escapeHtml(
            attraction.nameEn
          )}" />
          <div class="cardBody">
            <span>${String(index + 1).padStart(2, "0")}</span>
            <strong>${escapeHtml(attraction.nameZh)}</strong>
            <small>${escapeHtml(attraction.nameEn)}</small>
          </div>
        </article>
      `
    )
    .join("");
  const pins = attractions
    .map(
      (attraction, index) => `
        <span class="pin" style="${pointStyle(
          attraction.latitude,
          attraction.longitude,
          destination.latitude,
          destination.longitude
        )}">${index + 1}</span>
      `
    )
    .join("");

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      * { box-sizing: border-box; }
      body {
        margin: 0;
        background: #f6f3ee;
        color: #241d31;
        font-family: Inter, "Segoe UI", Arial, sans-serif;
      }
      main {
        width: 1280px;
        min-height: 900px;
        padding: 36px;
        display: grid;
        grid-template-columns: 1fr 360px;
        gap: 28px;
      }
      header {
        grid-column: 1 / -1;
        display: flex;
        align-items: end;
        justify-content: space-between;
        border-bottom: 1px solid #d8d0c5;
        padding-bottom: 18px;
      }
      h1 {
        margin: 0 0 6px;
        font-size: 38px;
        line-height: 1.1;
        letter-spacing: 0;
      }
      .sub {
        color: #665d70;
        font-size: 18px;
      }
      .status {
        display: grid;
        grid-template-columns: repeat(3, auto);
        gap: 10px;
        align-items: center;
        font-size: 15px;
      }
      .status span {
        border: 1px solid #cfc7bd;
        border-radius: 8px;
        padding: 8px 10px;
        background: #fffaf4;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 14px;
      }
      .card {
        min-height: 118px;
        display: grid;
        grid-template-columns: 132px 1fr;
        background: #ffffff;
        border: 1px solid #ded7ce;
        border-radius: 8px;
        overflow: hidden;
      }
      .card img {
        width: 132px;
        height: 118px;
        object-fit: cover;
        background: #e8e1d8;
      }
      .cardBody {
        padding: 14px;
        display: grid;
        gap: 7px;
        align-content: center;
      }
      .cardBody span {
        color: #7a5c2e;
        font-weight: 700;
        font-size: 13px;
      }
      .cardBody strong {
        font-size: 20px;
        line-height: 1.2;
      }
      .cardBody small {
        color: #665d70;
        font-size: 14px;
      }
      aside {
        display: grid;
        gap: 18px;
        align-content: start;
      }
      .map {
        position: relative;
        height: 420px;
        overflow: hidden;
        border: 1px solid #cfc7bd;
        border-radius: 8px;
        background:
          linear-gradient(90deg, rgba(38, 95, 91, 0.12) 1px, transparent 1px),
          linear-gradient(rgba(38, 95, 91, 0.12) 1px, transparent 1px),
          #e5efe7;
        background-size: 44px 44px;
      }
      .map::after {
        content: "";
        position: absolute;
        inset: 36px;
        border: 2px solid rgba(74, 123, 98, 0.28);
        border-radius: 46% 54% 45% 55%;
      }
      .pin {
        position: absolute;
        width: 28px;
        height: 28px;
        transform: translate(-50%, -50%);
        display: grid;
        place-items: center;
        border-radius: 999px;
        background: #233a8b;
        color: white;
        font-weight: 800;
        font-size: 13px;
        box-shadow: 0 6px 16px rgba(20, 29, 63, 0.25);
        z-index: 2;
      }
      .meta {
        display: grid;
        gap: 10px;
        padding: 16px;
        background: #fff;
        border: 1px solid #ded7ce;
        border-radius: 8px;
        color: #403849;
        font-size: 15px;
      }
      .meta strong { color: #241d31; }
    </style>
  </head>
  <body>
    <main>
      <header>
        <div>
          <h1>${escapeHtml(destination.nameZh)} / ${escapeHtml(destination.nameEn)}</h1>
          <div class="sub">${escapeHtml(destination.countryNameZh)} · ${escapeHtml(
            destination.countryNameEn
          )} · ${escapeHtml(destination.key)}</div>
        </div>
        <div class="status">
          <span>${attractions.length} cards</span>
          <span>${destination.dataQuality}</span>
          <span>${destination.sourceStatus}</span>
        </div>
      </header>
      <section class="grid">${cardHtml}</section>
      <aside>
        <div class="map">${pins}</div>
        <div class="meta">
          <div><strong>Coordinates:</strong> ${destination.latitude}, ${destination.longitude}</div>
          <div><strong>Images:</strong> ${attractions.filter((item) => item.image).length}/${attractions.length}</div>
          <div><strong>Map pins:</strong> ${attractions.filter((item) => typeof item.latitude === "number" && typeof item.longitude === "number").length}/${attractions.length}</div>
          <div><strong>Database cache:</strong> skipped: travel_destinations table missing or unavailable</div>
        </div>
      </aside>
    </main>
  </body>
</html>`;
}

async function main() {
  const outputDir = path.resolve(
    process.cwd(),
    "screenshots",
    "travel-city-coverage"
  );
  fs.mkdirSync(outputDir, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.setDefaultTimeout(15_000);

  const contracts = getDropdownDestinationContracts();
  for (const destination of contracts) {
    await page.setContent(renderCityPage(destination), {
      waitUntil: "networkidle",
      timeout: 20_000,
    });
    await page.screenshot({
      path: path.join(outputDir, `${destination.key}.png`),
      fullPage: true,
    });
  }

  await browser.close();
  console.log(`Captured ${contracts.length} screenshots in ${outputDir}`);
}

void main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
