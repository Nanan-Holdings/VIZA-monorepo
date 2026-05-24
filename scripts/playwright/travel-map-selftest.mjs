import { chromium } from "playwright";

function overlapArea(a, b) {
  const left = Math.max(a.x, b.x);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const top = Math.max(a.y, b.y);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  if (right <= left || bottom <= top) return 0;
  return (right - left) * (bottom - top);
}

function averagePosition(items) {
  const count = Math.max(1, items.length);
  const sumX = items.reduce((sum, item) => sum + item.x, 0);
  const sumY = items.reduce((sum, item) => sum + item.y, 0);
  return { x: sumX / count, y: sumY / count };
}

function medianSize(items) {
  const widths = items.map((item) => item.width).sort((a, b) => a - b);
  return widths[Math.floor(widths.length / 2)] ?? 0;
}

function pointOverlapsRect(point, rect, margin = 28) {
  return (
    point.x >= rect.x - margin &&
    point.x <= rect.x + rect.width + margin &&
    point.y >= rect.y - margin &&
    point.y <= rect.y + rect.height + margin
  );
}

function visibleMarkerRects(items, mapBox) {
  return items.filter(
    (item) =>
      item.x + item.width > mapBox.x &&
      item.x < mapBox.x + mapBox.width &&
      item.y + item.height > mapBox.y &&
      item.y < mapBox.y + mapBox.height
  );
}

function pickDragStart(mapBox, markerRects) {
  const candidates = [
    { x: 0.64, y: 0.48 },
    { x: 0.72, y: 0.52 },
    { x: 0.5, y: 0.5 },
    { x: 0.35, y: 0.55 },
    { x: 0.82, y: 0.34 },
    { x: 0.18, y: 0.72 },
  ];

  const start = candidates
    .map((candidate) => ({
      x: mapBox.x + mapBox.width * candidate.x,
      y: mapBox.y + mapBox.height * candidate.y,
    }))
    .find((point) => !markerRects.some((rect) => pointOverlapsRect(point, rect)));

  return start ?? { x: mapBox.x + mapBox.width * 0.5, y: mapBox.y + mapBox.height * 0.5 };
}

async function collectMarkerRects(page, selector) {
  return page.$$eval(selector, (nodes) =>
    nodes
      .map((node) => {
        const image = /** @type {HTMLImageElement} */ (node);
        const rect = image.getBoundingClientRect();
        return {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          complete: image.complete,
          naturalWidth: image.naturalWidth,
          naturalHeight: image.naturalHeight,
          src: image.src || "",
        };
      })
      .filter((item) => item.width > 24 && item.height > 24)
      .filter((item) => item.width > 40 && item.height > item.width * 1.05)
  );
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1660, height: 980 } });

  const baseDir = "D:/NUS_Bachelor/Study/Y2S2/VIZA-monorepo/test-results";
  const markerSelector = "[data-testid='trip-route-map'] img[src^='data:image/png']";

  try {
    await page.goto("http://localhost:3000/travel-map-preview", {
      waitUntil: "networkidle",
      timeout: 60000,
    });

    await page.waitForSelector("[data-testid='trip-route-map']", { timeout: 30000 });
    await page.waitForFunction(
      (selector) => document.querySelectorAll(selector).length >= 1,
      markerSelector,
      { timeout: 30000 }
    );
    await page.waitForTimeout(1500);

    const mapBox = await page.locator("[data-testid='trip-route-map']").boundingBox();
    if (!mapBox) {
      throw new Error("Map bounding box not found.");
    }

    const first = visibleMarkerRects(
      await collectMarkerRects(page, markerSelector),
      mapBox
    );
    if (first.length < 1) {
      throw new Error(`Expected at least one visible marker, got ${first.length}`);
    }

    const broken = first.filter(
      (item) => !item.complete || item.naturalWidth <= 0 || item.naturalHeight <= 0
    );
    if (broken.length > 0) {
      throw new Error("Found markers with broken image payload.");
    }

    for (let i = 0; i < first.length; i += 1) {
      for (let j = i + 1; j < first.length; j += 1) {
        const area = overlapArea(first[i], first[j]);
        const minArea = Math.min(
          first[i].width * first[i].height,
          first[j].width * first[j].height
        );
        if (area > minArea * 0.22) {
          throw new Error("Marker overlap is too high in initial layout.");
        }
      }
    }

    await page.screenshot({ path: `${baseDir}/travel-map-selftest-initial.png` });

    const topMarker = first
      .map((item, index) => ({ ...item, index }))
      .sort((a, b) => a.y - b.y)[0];
    if (topMarker) {
      await page.mouse.click(topMarker.x + topMarker.width / 2, topMarker.y + topMarker.height / 2);
      await page.waitForTimeout(900);
      const mapRect = await page
        .locator("[data-testid='trip-route-map']")
        .boundingBox();
      const infoRect = await page.$eval(".gm-style-iw.gm-style-iw-c", (node) => {
        const rect = node.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      });
      if (!mapRect) {
        throw new Error("Map rect not found when validating hover card.");
      }
      const outsideTop = infoRect.y < mapRect.y - 2;
      const outsideLeft = infoRect.x < mapRect.x - 2;
      const outsideRight = infoRect.x + infoRect.width > mapRect.x + mapRect.width + 2;
      const outsideBottom = infoRect.y + infoRect.height > mapRect.y + mapRect.height + 2;
      if (outsideTop || outsideLeft || outsideRight || outsideBottom) {
        throw new Error("Hover card overflowed map viewport.");
      }

      await page.mouse.move(mapRect.x + mapRect.width - 24, mapRect.y + mapRect.height - 24);
      await page.waitForTimeout(500);
      const lingeringPreview = await page.$(".gm-style-iw.gm-style-iw-c");
      if (lingeringPreview) {
        await page.mouse.click(mapRect.x + 24, mapRect.y + 24);
        await page.waitForTimeout(300);
      }
    }

    const dragStart = pickDragStart(mapBox, first);
    const dragStartX = dragStart.x;
    const dragStartY = dragStart.y;
    await page.mouse.move(dragStartX, dragStartY);
    await page.mouse.down();
    await page.mouse.move(dragStartX - 320, dragStartY + 60, { steps: 20 });
    await page.mouse.up();
    await page.waitForTimeout(1200);

    const afterDrag = visibleMarkerRects(
      await collectMarkerRects(page, markerSelector),
      mapBox
    );
    const firstAvg = averagePosition(first);
    const dragAvg = averagePosition(afterDrag);
    const dragShift =
      Math.abs(dragAvg.x - firstAvg.x) + Math.abs(dragAvg.y - firstAvg.y);
    if (dragShift < 12) {
      throw new Error("Markers did not move with map drag.");
    }
    await page.screenshot({ path: `${baseDir}/travel-map-selftest-drag.png` });

    const centerX = mapBox.x + mapBox.width * 0.5;
    const centerY = mapBox.y + mapBox.height * 0.5;
    await page.mouse.move(centerX, centerY);
    await page.mouse.wheel(0, -1200);
    await page.waitForTimeout(1500);

    const afterZoom = visibleMarkerRects(
      await collectMarkerRects(page, markerSelector),
      mapBox
    );
    const markerSizeBefore = medianSize(first);
    const markerSizeAfter = medianSize(afterZoom);
    if (Math.abs(markerSizeAfter - markerSizeBefore) > 2.5) {
      throw new Error(
        `Marker size should stay stable when zooming. before=${markerSizeBefore}, after=${markerSizeAfter}, count=${afterZoom.length}`
      );
    }

    const zoomShift = Math.abs((afterZoom[0]?.x ?? 0) - (afterDrag[0]?.x ?? 0));
    if (zoomShift < 4) {
      throw new Error("Markers did not react to zoom movement.");
    }

    await page.screenshot({ path: `${baseDir}/travel-map-selftest-zoom.png` });
    console.log("PASS: Travel map marker self-test passed.");
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error("FAIL:", error instanceof Error ? error.message : error);
  process.exit(1);
});
