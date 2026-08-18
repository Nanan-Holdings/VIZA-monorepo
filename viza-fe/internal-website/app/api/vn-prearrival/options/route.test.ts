import { describe, expect, it } from "vitest";
import { __testables } from "./route-handler";

describe("Vietnam pre-arrival official option mapping", () => {
  it("uses the same leading-zero search normalization as the official autocomplete", () => {
    expect(__testables.normalizeOfficialFlightSearch("MH746")).toBe("MH0746");
    expect(__testables.normalizeOfficialFlightSearch("MH0746")).toBe("MH0746");
    expect(__testables.normalizeOfficialFlightSearch("3K557")).toBe("3K557");
  });

  it("uses the official flight search endpoint request contract", () => {
    expect(__testables.officialFlightSearchBody("MR681", 2, 10)).toEqual({
      keyword: "MR0681",
      filters: {},
      page: 2,
      size: 10,
      sorts: [{ key: "code", asc: true }],
    });
  });

  it("wakes a stopped shared-pool machine before an official catalog refresh", async () => {
    const calls: string[] = [];
    const ready = await __testables.ensureFlightCatalogServiceReady({
      baseUrl: "https://viza-runner-pool.fly.dev",
      url: "https://viza-runner-pool.fly.dev/internal/vn-prearrival/flight-catalog",
      headers: {},
      wakePool: true,
    }, true, {
      startPool: async (target) => {
        calls.push(`start:${target}`);
        return {
          ok: true,
          target: "pool",
          app: "viza-runner-pool",
          state: "start_requested",
        };
      },
      waitForReady: async (url) => {
        calls.push(`ready:${url}`);
        return { ok: true, attempts: 1 };
      },
    });

    expect(ready).toBe(true);
    expect(calls).toEqual([
      "start:pool",
      "ready:https://viza-runner-pool.fly.dev/health",
    ]);
  });

  it("does not wake Fly for local or cached catalog reads", async () => {
    const startPool = async () => {
      throw new Error("unexpected machine wake");
    };

    await expect(__testables.ensureFlightCatalogServiceReady({
      baseUrl: "http://127.0.0.1:8080",
      url: "http://127.0.0.1:8080/local/vn-prearrival/flight-catalog",
      headers: {},
      wakePool: false,
    }, true, { startPool })).resolves.toBe(true);
    await expect(__testables.ensureFlightCatalogServiceReady({
      baseUrl: "https://viza-runner-pool.fly.dev",
      url: "https://viza-runner-pool.fly.dev/internal/vn-prearrival/flight-catalog",
      headers: {},
      wakePool: true,
    }, false, { startPool })).resolves.toBe(true);
  });

  it("checks an already-running pool and starts one spare when it is unhealthy", async () => {
    const calls: string[] = [];
    const ready = await __testables.ensureFlightCatalogServiceReady({
      baseUrl: "https://viza-prod-runner-pool.fly.dev",
      url: "https://viza-prod-runner-pool.fly.dev/internal/vn-prearrival/flight-catalog",
      headers: {},
      wakePool: true,
    }, true, {
      startPool: async () => ({
        ok: true,
        target: "pool",
        app: "viza-prod-runner-pool",
        state: "already_running",
      }),
      increasePoolCapacity: async (target, desired) => {
        calls.push(`capacity:${target}:${desired}`);
        return {
          ok: true,
          target: "pool",
          app: "viza-prod-runner-pool",
          desired,
          active: desired,
          started: 1,
        };
      },
      waitForReady: async (url) => {
        calls.push(`ready:${url}`);
        return calls.filter((call) => call.startsWith("ready:")).length === 1
          ? { ok: false, attempts: 4, reason: "readiness_timeout" }
          : { ok: true, attempts: 2 };
      },
    });

    expect(ready).toBe(true);
    expect(calls).toEqual([
      "ready:https://viza-prod-runner-pool.fly.dev/health",
      "capacity:pool:2",
      "ready:https://viza-prod-runner-pool.fly.dev/health",
    ]);
  });

  it("polls the same runner cache after an asynchronous refresh is accepted", async () => {
    const requests: Array<{ body: string | null; url: string }> = [];
    const delays: number[] = [];
    let now = 1_000;
    const responses = [
      new Response(JSON.stringify({ status: "refresh_started" }), { status: 202 }),
      new Response(JSON.stringify({ error: "catalog_not_refreshed" }), { status: 503 }),
      new Response(JSON.stringify({ catalogSource: "official_live", items: [] }), { status: 200 }),
    ];
    const response = await __testables.fetchRunnerFlightCatalog({
      baseUrl: "https://viza-runner-pool.fly.dev",
      url: "https://viza-runner-pool.fly.dev/internal/vn-prearrival/flight-catalog",
      headers: { Authorization: "Bearer test-token" },
      wakePool: true,
    }, {
      keyword: "MR681",
      page: 0,
      size: 5,
      refresh: true,
      selectedValue: "MR0681_PQC",
    }, {
      fetchRunner: async (input, init) => {
        requests.push({ body: init?.body?.toString() ?? null, url: input.toString() });
        return responses.shift() ?? new Response(null, { status: 500 });
      },
      delay: async (milliseconds) => {
        delays.push(milliseconds);
        now += milliseconds;
      },
      now: () => now,
    });

    expect(response.status).toBe(200);
    expect(requests).toHaveLength(3);
    expect(requests[0]?.body).toContain('"refresh":true');
    expect(requests.slice(1).every((request) => request.body?.includes('"refresh":false'))).toBe(true);
    expect(delays).toEqual([3_000, 3_000]);
  });

  it("polls after a legacy runner proxy timeout while its refresh continues", async () => {
    const bodies: string[] = [];
    let now = 10_000;
    const responses = [
      new Response(null, { status: 503 }),
      new Response(JSON.stringify({ catalogSource: "official_live", items: [] }), { status: 200 }),
    ];
    const response = await __testables.fetchRunnerFlightCatalog({
      baseUrl: "https://viza-runner-pool.fly.dev",
      url: "https://viza-runner-pool.fly.dev/internal/vn-prearrival/flight-catalog",
      headers: {},
      wakePool: true,
    }, {
      keyword: "",
      page: 0,
      size: 5,
      refresh: true,
      selectedValue: "",
    }, {
      fetchRunner: async (_input, init) => {
        bodies.push(init?.body?.toString() ?? "");
        return responses.shift() ?? new Response(null, { status: 500 });
      },
      delay: async (milliseconds) => {
        now += milliseconds;
      },
      now: () => now,
    });

    expect(response.status).toBe(200);
    expect(bodies).toHaveLength(2);
    expect(bodies[0]).toContain('"refresh":true');
    expect(bodies[1]).toContain('"refresh":false');
  });

  it("does not retry a real official-catalog refresh failure", async () => {
    let attempts = 0;
    const response = await __testables.fetchRunnerFlightCatalog({
      baseUrl: "https://viza-runner-pool.fly.dev",
      url: "https://viza-runner-pool.fly.dev/internal/vn-prearrival/flight-catalog",
      headers: {},
      wakePool: true,
    }, {
      keyword: "",
      page: 0,
      size: 5,
      refresh: true,
      selectedValue: "",
    }, {
      fetchRunner: async () => {
        attempts += 1;
        return new Response(JSON.stringify({ error: "official_catalog_refresh_failed" }), { status: 502 });
      },
      delay: async () => {
        throw new Error("unexpected retry delay");
      },
    });

    expect(response.status).toBe(502);
    expect(attempts).toBe(1);
  });

  it("paginates the live flight catalog for incremental dropdown loading", () => {
    const result = __testables.paginateOptions(
      Array.from({ length: 25 }, (_, index) => `flight-${index}`),
      1,
      10,
    );

    expect(result).toEqual({
      items: Array.from({ length: 10 }, (_, index) => `flight-${index + 10}`),
      totalCount: 25,
      hasMore: true,
    });
  });

  it("maps visa issue place official english_value instead of showing the code", () => {
    expect(
      __testables.optionFromOfficial(
        {
          code: "AUS-1",
          english_value: "Australia",
          cn_value: "澳大利亚",
          visa_type: "ABTC",
        },
        "visa_issue_place",
      ),
    ).toMatchObject({
      value: "AUS-1",
      label_en: "Australia",
      label_zh: "澳大利亚",
      official_label: "Australia",
    });
  });

  it("maps official flight code and airport into the portal label and value", () => {
    expect(
      __testables.optionFromOfficial(
        {
          code: "UO0566_CXR",
          en_value: "UO0566",
          airport: "CXR",
          airline: "UO",
        },
        "flight",
      ),
    ).toMatchObject({
      value: "UO0566_CXR",
      official_value: "UO0566",
      label_en: "UO566 (UO0566) - CXR",
      official_label: "UO566 (UO0566) - CXR",
      portal_label: "UO566 (UO0566) - CXR",
      airport: "CXR",
      airline: "UO",
    });
  });

  it.each([
    ["##HMZ2083_PQC", "##HMZ2083", "HMZ2083 - PQC"],
    ["##HMZ2085_PQC", "##HMZ2085", "HMZ2085 - PQC"],
    ["##MR681_PQC", "##MR681", "MR681 (MR0681) - PQC"],
    ["##N77999_PQC", "##N77999", "N77999 - PQC"],
  ])(
    "hides the official feed marker from flight %s without changing its submission value",
    (code, flightNumber, expectedLabel) => {
      expect(
        __testables.optionFromOfficial(
          {
            code,
            en_value: flightNumber,
            vn_value: flightNumber,
            airport: "PQC",
            airline: "##",
          },
          "flight",
        ),
      ).toMatchObject({
        value: code,
        text: expectedLabel,
        label_en: expectedLabel,
        label_zh: expectedLabel,
        official_label: expectedLabel,
        official_value: flightNumber,
        portal_label: `${flightNumber} - PQC`,
        airport: "PQC",
      });
    },
  );

  it("preserves the official response order while keeping marker cleanup display-only", () => {
    const result = __testables.fallbackFlightSearch("", 0, 5);

    expect(result.catalogSource).toBe("bundled_snapshot");
    expect(result.items.map((option) => ({
      value: option.value,
      label: option.label_en,
      officialValue: option.official_value,
    }))).toEqual([
      { value: "B3239_SGN", label: "B3239 - SGN", officialValue: "B3239" },
      { value: "B605A_SGN", label: "B605A - SGN", officialValue: "B605A" },
      { value: "B652C_SGN", label: "B652C - SGN", officialValue: "B652C" },
      { value: "BSF968_SGN", label: "BSF968 - SGN", officialValue: "BSF968" },
      { value: "BSF999_SGN", label: "BSF999 - SGN", officialValue: "BSF999" },
    ]);
  });

  it("reports whether a saved flight still exists without trusting the bundled snapshot for invalidation", () => {
    const existing = __testables.fallbackFlightSearch("", 0, 5, "MR0681_PQC");
    const removed = __testables.fallbackFlightSearch("", 0, 5, "VN9999_SGN");

    expect(existing).toMatchObject({
      catalogSource: "bundled_snapshot",
      selectedExists: true,
      selectedOption: expect.objectContaining({ value: "MR0681_PQC" }),
    });
    expect(removed).toMatchObject({
      catalogSource: "bundled_snapshot",
      selectedExists: false,
      selectedOption: null,
    });
  });

  it("maps official paged search metadata without re-sorting the response", () => {
    const result = __testables.pageFromOfficialSearch({
      content: [
        { code: "VN0650_SGN", vn_value: "VN0650", airport: "SGN" },
        { code: "MH0746_DAD", vn_value: "MH0746", airport: "DAD" },
      ],
      total: 12,
      last: false,
    }, 0, 2);

    expect(result).toMatchObject({
      totalCount: 12,
      hasMore: true,
      catalogSource: "official_live",
    });
    expect(result.items.map((option) => option.value)).toEqual(["VN0650_SGN", "MH0746_DAD"]);
  });

  it("serves the official static Chinese issue-place translation instead of a machine-translated fragment", async () => {
    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/vn-prearrival/options?source=prearrival_category%3Avisa_issue_place&parent=EV"));
    const payload = await response.json() as { options: Array<{ label_zh: string; label_en: string }> };

    expect(payload.options).toEqual(expect.arrayContaining([
      expect.objectContaining({
        label_en: "Vietnam Immigration Department - Ministry of Public Security",
        label_zh: "越南出入境管理局 - 公安部",
      }),
    ]));
  });

  it("uses Chinese country code labels from the hardcoded translation helper", () => {
    expect(
      __testables.optionFromOfficial(
        {
          code: "CN",
          value: "+86",
          en_value: "China (+86)",
        },
        "country_code",
      ),
    ).toMatchObject({
      value: "+86",
      label_zh: "中国 (+86)",
      official_label: "China (+86)",
    });
  });

  it.each([
    ["CHN", "China", "中国"],
    ["DOM", "Dominican Republic", "多米尼加共和国"],
    ["LAO", "Lao People's Democratic Republic", "老挝"],
    ["MDA", "Republic of Moldova", "摩尔多瓦"],
    ["SJM", "Svalbard and Jan Mayen Islands", "斯瓦尔巴和扬马延"],
    ["VAT", "Holy See", "梵蒂冈"],
    ["COD", "Democratic Republic of the Congo", "刚果（金）"],
  ])("maps official nationality %s to a complete Chinese label", (code, english, chinese) => {
    expect(
      __testables.optionFromOfficial(
        {
          code,
          en_value: english,
          vn_value: english,
        },
        "nationality",
      ),
    ).toMatchObject({
      value: code,
      label_en: english,
      label_zh: chinese,
      official_label: english,
    });
  });

  it("maps every current official nationality code to a non-Latin Chinese region label", () => {
    const officialNationalityCodes = [
      "CHN", "DOM", "LAO", "MDA", "SJM", "VAT", "COD", "COG", "SGP", "MYS",
      "THA", "IDN", "VNM", "USA", "GBR", "AUS", "CAN", "NZL", "JPN", "KOR",
    ];

    for (const code of officialNationalityCodes) {
      const label = __testables.zhRegionNameFromOfficialCode(code);
      expect(label, code).not.toBe("");
      expect(label, code).not.toMatch(/[A-Za-z]/);
    }
  });

  it("filters official hotel options locally after loading findAllActive hotel", () => {
    const options = [
      { value: "KSHN_0001", text: "Sofitel Legend Metropole Hanoi", label_en: "Sofitel Legend Metropole Hanoi", label_zh: "Sofitel Legend Metropole Hanoi", official_label: "Sofitel Legend Metropole Hanoi" },
      { value: "KSDAD_SN01", text: "Samdi Da Nang Airport Hotel", label_en: "Samdi Da Nang Airport Hotel", label_zh: "Samdi Da Nang Airport Hotel", official_label: "Samdi Da Nang Airport Hotel" },
    ];

    expect(__testables.filterOptionsByKeyword(options, "hanoi")).toHaveLength(1);
    expect(__testables.filterOptionsByKeyword(options, "hanoi")[0]?.value).toBe("KSHN_0001");
  });

  it("preserves official hotel hierarchy metadata for dependent dropdowns", () => {
    expect(
      __testables.optionFromOfficial(
        {
          code: "KSDN_01",
          en_value: "Dan Nguyen Phat Hotel",
          province_city: "48",
          ward: "20194",
        },
        "hotel",
      ),
    ).toMatchObject({
      value: "KSDN_01",
      province_city: "48",
      ward: "20194",
    });
  });

  it("falls back to same-province hotels when the selected ward has no official hotel rows", () => {
    const options = [
      {
        value: "HANOI-1",
        text: "Hanoi Hotel",
        label_en: "Hanoi Hotel",
        label_zh: "河内酒店",
        official_label: "Hanoi Hotel",
        province_city: "01",
        ward: "00004",
      },
      {
        value: "DANANG-1",
        text: "Da Nang Hotel",
        label_en: "Da Nang Hotel",
        label_zh: "岘港酒店",
        official_label: "Da Nang Hotel",
        province_city: "48",
        ward: "20194",
      },
    ];

    expect(__testables.filterHotelOptionsByHierarchy(options, "20965", "48", "")).toEqual([
      expect.objectContaining({ value: "DANANG-1", province_city: "48", ward: "20194" }),
    ]);
  });

  it("searches the complete hotel catalog regardless of the currently selected ward", () => {
    const options = [
      {
        value: "HANOI-1",
        text: "Sofitel Legend Metropole Hanoi",
        label_en: "Sofitel Legend Metropole Hanoi",
        label_zh: "河内索菲特传奇大都会酒店",
        official_label: "Sofitel Legend Metropole Hanoi",
        province_city: "01",
        ward: "00004",
      },
      {
        value: "DANANG-1",
        text: "Da Nang Hotel",
        label_en: "Da Nang Hotel",
        label_zh: "岘港酒店",
        official_label: "Da Nang Hotel",
        province_city: "48",
        ward: "20194",
      },
    ];

    expect(__testables.filterHotelOptionsByHierarchy(options, "20194", "48", "Sofitel")).toEqual([
      expect.objectContaining({ value: "HANOI-1", province_city: "01", ward: "00004" }),
    ]);
  });

  it("prioritizes exact country-code matches before incidental text matches", () => {
    const options = [
      { value: "+850", text: "North Korea (+850)", label_en: "North Korea (+850)", label_zh: "CHDCND Triều Tiên (+850)", official_label: "North Korea (+850)", code: "KP" },
      { value: "+86", text: "China (+86)", label_en: "China (+86)", label_zh: "中国 (+86)", official_label: "China (+86)", code: "CN" },
    ];

    expect(__testables.filterOptionsByKeyword(options, "CN")[0]?.value).toBe("+86");
  });

  it("prioritizes exact dialing-code matches before substring matches", () => {
    const options = [
      { value: "+965", text: "Kuwait (+965)", label_en: "Kuwait (+965)", label_zh: "科威特 (+965)", official_label: "Kuwait (+965)", code: "KW" },
      { value: "+65", text: "Singapore (+65)", label_en: "Singapore (+65)", label_zh: "新加坡 (+65)", official_label: "Singapore (+65)", code: "SG" },
    ];

    expect(__testables.filterOptionsByKeyword(options, "65")[0]?.value).toBe("+65");
  });

  it("searches Vietnam wards by verified Chinese names and accentless Vietnamese aliases", async () => {
    const { GET } = await import("./route");
    const chineseResponse = await GET(
      new Request(
        "http://localhost/api/vn-prearrival/options?source=administrative_unit_level2&parent=48&keyword=%E5%92%8C&limit=100",
      ),
    );
    const chinesePayload = await chineseResponse.json() as {
      options: Array<{ value: string; label_zh: string }>;
    };

    expect(chinesePayload.options).toEqual(expect.arrayContaining([
      expect.objectContaining({ value: "20200", label_zh: "和庆坊" }),
      expect.objectContaining({ value: "20257", label_zh: "和强坊" }),
      expect.objectContaining({ value: "20314", label_zh: "和春坊" }),
      expect.objectContaining({ value: "20320", label_zh: "和荣社" }),
      expect.objectContaining({ value: "20332", label_zh: "和进社" }),
    ]));

    const accentlessResponse = await GET(
      new Request(
        "http://localhost/api/vn-prearrival/options?source=administrative_unit_level2&parent=48&keyword=ngu%20hanh%20son",
      ),
    );
    const accentlessPayload = await accentlessResponse.json() as {
      options: Array<{ value: string; label_zh: string }>;
    };
    expect(accentlessPayload.options).toEqual([
      expect.objectContaining({ value: "20285", label_zh: "五行山坊" }),
    ]);
  });
});
