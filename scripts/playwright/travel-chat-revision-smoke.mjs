import { chromium } from "playwright";

const baseUrl = process.env.TRAVEL_CHAT_BASE_URL ?? "http://localhost:3000";
const archiveKey = "viza:travel-chat:1:standalone";

const travelState = {
  country: "Japan",
  countries: ["Japan"],
  cities: ["东京"],
  seed_country: null,
  seed_city: null,
  city_days: { "东京": 2 },
  departure_date: "2026-07-01",
  date_flexibility: "fixed",
  travel_days: 2,
  travelers: 2,
  budget: 5000,
  origin_country: "Singapore",
  origin_city: "Singapore",
  return_country: "Singapore",
  return_city: "Singapore",
  travel_order: ["东京"],
  selected_flights: [],
  selected_hotels: [],
  final_note: "",
  attached_files: [],
};

const initialItinerary = [
  {
    day: 1,
    city: "东京",
    activities: ["浅草寺与仲见世商店街", "东京塔与芝公园"],
    food: ["筑地场外市场寿司"],
    cost: "¥800",
  },
  {
    day: 2,
    city: "东京",
    activities: ["上野公园与东京国立博物馆", "秋叶原电器街"],
    food: ["新宿思出横丁拉面"],
    cost: "¥800",
  },
];

const archive = {
  version: 1,
  updatedAt: "2026-05-16T00:00:00.000Z",
  sessions: [
    {
      id: "travel-smoke-session",
      title: "东京 revision smoke",
      customTitle: true,
      activeVersionId: "travel-smoke-version-1",
      updatedAt: "2026-05-16T00:00:00.000Z",
      messages: [
        {
          id: "travel-smoke-user-1",
          role: "user",
          parts: [
            {
              type: "text",
              text: `东京 2 天游玩计划\n\n<!--__TRAVEL_FORM__:${JSON.stringify({
                country: "Japan",
                countries: ["Japan"],
                cities: ["东京"],
                city_days: { "东京": 2 },
                departure_date: "2026-07-01",
                date_flexibility: "fixed",
                travel_days: 2,
                travelers: 2,
                budget: 5000,
                origin_country: "Singapore",
                origin_city: "Singapore",
                return_country: "Singapore",
                return_city: "Singapore",
                travel_order: ["东京"],
                selected_flights: [],
                selected_hotels: [],
                final_note: "",
                attached_files: [],
              })}-->`,
            },
          ],
        },
        {
          id: "travel-smoke-assistant-1",
          role: "assistant",
          parts: [
            { type: "text", text: "行程已经生成，我已经把每天安排整理到行程卡片里。" },
            { type: "tool-itinerary", output: initialItinerary },
          ],
        },
      ],
      versions: [
        {
          id: "travel-smoke-version-1",
          versionNumber: 1,
          title: "2天东京行程",
          createdAt: "2026-05-16T00:00:00.000Z",
          editSummary: "生成初始行程",
          travelState,
          itinerary: initialItinerary,
          selectedFlights: [],
          selectedHotels: [],
        },
      ],
    },
  ],
};

function revisedItinerary() {
  return [
    initialItinerary[0],
    {
      day: 2,
      city: "东京",
      activities: ["银座百货与设计店巡游", "涩谷 Parco 与本地潮流街区", "东京站伴手礼街"],
      food: ["银座甜品咖啡", "新宿思出横丁拉面"],
      cost: "¥700",
    },
  ];
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.addInitScript(
    ({ key, value }) => {
      if (!window.localStorage.getItem(key)) {
        window.localStorage.setItem(key, JSON.stringify(value));
      }
    },
    { key: archiveKey, value: archive }
  );

  await page.route("**/api/travel/itinerary/revise", async (route) => {
    const postData = route.request().postData();
    const payload = postData ? JSON.parse(postData) : {};
    const prompt = String(payload.user_prompt ?? "");
    const isRestart = /重来|重新|restart|start over/i.test(prompt);
    const body = isRestart
      ? {
          action: "restart",
          reply: "可以，我们保留旧版本，先回到地图重新规划。",
          itinerary: payload.current_itinerary ?? initialItinerary,
          state_patch: { reset: true },
          module_patch: {},
          edit_summary: "用户要求重新规划",
          quick_replies: [{ label: "想去日本", value: "想去日本" }],
        }
      : {
          action: "revise",
          reply: "已把第二天改成购物路线。",
          itinerary: revisedItinerary(),
          state_patch: {},
          module_patch: {},
          edit_summary: "第二天改为购物和街区探索",
          quick_replies: [{ label: "便宜一点", value: "把这次旅行便宜一点" }],
        };

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });

  try {
    await page.goto(`${baseUrl}/travel-chat-preview`, {
      waitUntil: "networkidle",
      timeout: 60000,
    });

    await page.waitForSelector("[data-testid='travel-itinerary-experience']", {
      timeout: 30000,
    });
    await page.waitForSelector("[data-testid='travel-itinerary-version-bar']", {
      timeout: 30000,
    });

    const input = page.getByPlaceholder("问问旅行计划...");
    await input.fill("我不喜欢第二天，改成购物");
    await input.press("Enter");
    await page.waitForSelector("text=版本 2", { timeout: 30000 });
    await page.waitForSelector("text=第二天改为购物和街区探索", { timeout: 30000 });

    await page.reload({ waitUntil: "networkidle", timeout: 60000 });
    await page.waitForSelector("text=版本 2", { timeout: 30000 });
    await page.waitForSelector("text=第二天改为购物和街区探索", { timeout: 30000 });

    await page.getByPlaceholder("问问旅行计划...").fill("我不喜欢这个，请重来");
    await page.getByPlaceholder("问问旅行计划...").press("Enter");
    await page.waitForSelector("[data-testid='trip-route-map']", { timeout: 30000 });

    console.log("PASS: Travel chat revision smoke passed.");
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error("FAIL:", error instanceof Error ? error.message : error);
  process.exit(1);
});
