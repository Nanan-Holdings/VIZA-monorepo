import { chromium } from "playwright-extra";
import stealthPlugin from "puppeteer-extra-plugin-stealth";
import type { Page } from "playwright";
import * as cheerio from "cheerio";
import * as fs from "fs";

chromium.use(stealthPlugin());

async function scrapeB211A_FastTrack() {
  console.log("🚀 启动隐身浏览器，准备执行【瞬移】抓取...");

  const browser = await chromium.launch({ headless: false }); // 测试时肉眼看
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    locale: "en-US",
  });

  const page = await context.newPage();

  try {
    console.log("\n[1/3] 🌐 访问大厅 (获取通行证 Cookie 和过防火墙)...");
    // 先访问一次主入口，不要做任何点击，只是为了让服务器给我们发 Cookie
    await page.goto("https://evisa.imigrasi.go.id/web/visa-selection", {
      waitUntil: "networkidle",
      timeout: 60000,
    });

    // 假装看两秒钟网页
    await page.waitForTimeout(2000);

    console.log("\n[2/3] ⚡ 发动瞬移！直接跳跃到 B211A 签证专属要求页...");
    // ！！这就是你刚才抓到的那个宝藏 URL ！！
    const targetUrl =
      "https://evisa.imigrasi.go.id/web/application_add/visa/4eb7326f-ddfb-4e61-a24a-fb02adceb67f/3dc4013d-e9af-44bf-89c0-82cba92563c3/f0c05fe2-f8d6-4bf1-904c-9fa5a694162f/step_1";

    await page.goto(targetUrl, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    // 等待页面里的 "Requirement" 或 "Document" 字眼加载出来
    await page.waitForTimeout(3000);

    // 拍一张截图留档，看看瞬移成功没
    await page.screenshot({ path: "teleport-success.png", fullPage: true });
    console.log("📸 已保存瞬移落地页截图：teleport-success.png");

    console.log("\n[3/3] 🧹 开始提取签证材料要求...");
    const html = await page.content();
    const $ = cheerio.load(html);

    // --- 核心清洗逻辑 ---
    $(
      "script, style, nav, footer, header, svg, img, button, form, input",
    ).remove();
    let mainText = $("main").text() || $("body").text();
    const cleanedText = mainText.replace(/\s+/g, " ").trim();

    const finalDocument = {
      visa_type: "B211A_Tourist_60Days",
      source_url: targetUrl,
      raw_content: cleanedText,
    };

    fs.writeFileSync(
      "b211a_requirements_fasttrack.json",
      JSON.stringify(finalDocument, null, 2),
    );
    console.log(
      `\n✅ 瞬移抓取成功！有效纯净文本长度: ${cleanedText.length} 字符`,
    );
  } catch (error) {
    console.error("\n❌ 抓取过程中发生致命错误:", error);
  } finally {
    await page.waitForTimeout(3000);
    await browser.close();
    console.log("🛑 浏览器已安全关闭。");
  }
}

scrapeB211A_FastTrack();
