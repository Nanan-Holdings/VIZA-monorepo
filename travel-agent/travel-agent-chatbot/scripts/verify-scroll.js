const { chromium } = require("@playwright/test");

async function clickFirst(page, selectors, timeout = 15000) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if (await locator.count()) {
      await locator.click({ timeout });
      return true;
    }
  }
  return false;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1512, height: 982 } });

  try {
    await page.goto("http://127.0.0.1:3010", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);

    const input = page.locator('textarea, input[placeholder*="Ask"], input[placeholder*="发送"]');
    if ((await input.count()) > 0) {
      await input.first().fill("你好");
      await input.first().press("Enter");
    }

    await page.waitForTimeout(2500);

    const openCountrySelect = await clickFirst(page, [
      'button:has-text("请选择国家（可多选）")',
      'button:has-text("选择国家")',
      'button:has-text("国家")',
    ]);

    if (!openCountrySelect) {
      throw new Error("无法打开国家选择器");
    }

    const otherCountry = page.locator('[cmdk-item]:has-text("其他（自定义国家）")').first();
    await otherCountry.waitFor({ state: "visible", timeout: 10000 });
    await otherCountry.click();

    const customCountryInput = page.locator('input[placeholder*="输入其他国家"]').first();
    await customCountryInput.waitFor({ state: "visible", timeout: 10000 });
    await customCountryInput.fill("自定义国A");

    await clickFirst(page, ['button:has-text("确认国家")']);
    await page.waitForTimeout(2500);

    const openCitySelect = await clickFirst(page, [
      'button:has-text("请选择城市（可多选）")',
      'button:has-text("选择城市")',
      'button:has-text("城市")',
    ]);

    if (!openCitySelect) {
      throw new Error("无法打开城市选择器");
    }

    const otherCity = page.locator('[cmdk-item]:has-text("其他（自定义城市）")').first();
    await otherCity.waitFor({ state: "visible", timeout: 10000 });
    await otherCity.click();

    const customCityInput = page.locator('input[placeholder*="输入其他城市"]').first();
    await customCityInput.waitFor({ state: "visible", timeout: 10000 });
    const manyCities = Array.from({ length: 35 }, (_, i) => `城市${i + 1}`).join(",");
    await customCityInput.fill(manyCities);

    await clickFirst(page, ['button:has-text("确认城市")']);
    await page.waitForTimeout(3000);

    const dayPrompt = page.locator('text=请为每个城市填写停留天数').first();
    await dayPrompt.waitFor({ state: "visible", timeout: 15000 });

    const scroller = page.locator("div.touch-pan-y.overflow-y-auto").first();
    await scroller.waitFor({ state: "visible", timeout: 15000 });

    const metricsBefore = await scroller.evaluate((el) => ({
      scrollTop: el.scrollTop,
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    }));

    const box = await scroller.boundingBox();
    if (!box) {
      throw new Error("滚动容器没有可用的尺寸");
    }

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, 1800);
    await page.waitForTimeout(800);

    const metricsAfter = await scroller.evaluate((el) => ({
      scrollTop: el.scrollTop,
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    }));

    console.log("SCROLL_BEFORE", JSON.stringify(metricsBefore));
    console.log("SCROLL_AFTER", JSON.stringify(metricsAfter));

    if (metricsAfter.scrollHeight <= metricsAfter.clientHeight) {
      throw new Error("内容未超过容器高度，无法验证滚动");
    }

    if (metricsAfter.scrollTop <= metricsBefore.scrollTop + 2) {
      throw new Error("滚轮后 scrollTop 未增长，滚动仍不可用");
    }

    console.log("SCROLL_TEST_PASS");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error("SCROLL_TEST_FAIL", error);
  process.exit(1);
});
