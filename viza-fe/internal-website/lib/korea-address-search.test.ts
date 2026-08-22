import { afterEach, describe, expect, it, vi } from "vitest";
import { searchKoreaAddresses } from "@/lib/korea-address-search";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("searchKoreaAddresses", () => {
  it("uses a Chinese-only display label while preserving official submission values", async () => {
    const responseXml = `
      <results>
        <common><totalCount>1</totalCount></common>
        <juso>
          <roadAddr>서울특별시 강남구 가로수길 15</roadAddr>
          <engAddr>15 Garosu-gil, Gangnam-gu, Seoul</engAddr>
          <korAddr>서울특별시 강남구 가로수길 15</korAddr>
          <zipNo>06035</zipNo>
          <bdNm></bdNm>
        </juso>
      </results>`;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(responseXml, { status: 200 })));

    const result = await searchKoreaAddresses("首尔", { limit: 1 });

    expect(result.options).toHaveLength(1);
    const option = result.options[0];
    expect(typeof option).not.toBe("string");
    if (typeof option === "string" || !option) throw new Error("Expected a structured address option");
    expect(option).toMatchObject({
      value: "15 Garosu-gil, Gangnam-gu, Seoul",
      label_zh: "首尔特别市 江南区 林荫路 15 (06035)",
      koreanAddress: "서울특별시 강남구 가로수길 15",
      englishAddress: "15 Garosu-gil, Gangnam-gu, Seoul",
      postalCode: "06035",
    });
    expect(String(option.label_zh)).not.toMatch(/[A-Za-z가-힣]/);
  });
});
