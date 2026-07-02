import { describe, expect, it } from "vitest";

import { resolveKvacCenter } from "../kvac-routing";

describe("resolveKvacCenter", () => {
  it("uses current residence proof before hukou province", () => {
    const result = resolveKvacCenter({
      currentResidenceProvince: "上海市",
      hasResidenceProof: true,
      hukouProvince: "湖北省",
    });

    expect(result.recommended.code).toBe("shanghai");
    expect(result.basis).toBe("current_residence");
    expect(result.alternatives.map((center) => center.code)).toContain("wuhan");
  });

  it("falls back to hukou province when residence proof is unavailable", () => {
    const result = resolveKvacCenter({
      currentResidenceProvince: "上海市",
      hasResidenceProof: false,
      hukouProvince: "湖北省",
    });

    expect(result.recommended.code).toBe("wuhan");
    expect(result.basis).toBe("hukou");
  });

  it("returns an ambiguous result with alternatives when no province is usable", () => {
    const result = resolveKvacCenter({});

    expect(result.basis).toBe("ambiguous");
    expect(result.recommended.code).toBe("beijing");
    expect(result.alternatives.length).toBeGreaterThan(1);
  });

  it("covers every mainland China province-level region used for Korea visa routing", () => {
    const expected: Record<string, string> = {
      北京: "beijing",
      天津: "beijing",
      河北: "beijing",
      山西: "beijing",
      内蒙古: "beijing",
      新疆: "beijing",
      西藏: "beijing",
      青海: "beijing",
      上海: "shanghai",
      江苏: "shanghai",
      浙江: "shanghai",
      安徽: "shanghai",
      广东: "guangzhou",
      福建: "guangzhou",
      海南: "guangzhou",
      广西: "guangzhou",
      湖北: "wuhan",
      湖南: "wuhan",
      河南: "wuhan",
      江西: "wuhan",
      陕西: "xian",
      甘肃: "xian",
      宁夏: "xian",
      辽宁: "shenyang",
      吉林: "shenyang",
      黑龙江: "shenyang",
      四川: "chengdu",
      重庆: "chengdu",
      云南: "chengdu",
      贵州: "chengdu",
      山东: "qingdao",
    };

    for (const [province, centerCode] of Object.entries(expected)) {
      expect(resolveKvacCenter({ hukouProvince: province }).recommended.code).toBe(centerCode);
    }
  });

  it("exposes appointment and walk-in rules for user-facing slot guidance", () => {
    const shanghai = resolveKvacCenter({ hukouProvince: "上海市" }).recommended;
    const guangzhou = resolveKvacCenter({ hukouProvince: "广东省" }).recommended;
    const chengdu = resolveKvacCenter({ hukouProvince: "四川省" }).recommended;
    const qingdao = resolveKvacCenter({ hukouProvince: "山东省" }).recommended;

    expect(shanghai.serviceMode).toBe("appointment_required");
    expect(shanghai.acceptsWalkIn).toBe(false);
    expect(shanghai.importantNoticesZh.join(" ")).toContain("预约");
    expect(guangzhou.acceptsWalkIn).toBe(true);
    expect(guangzhou.importantNoticesZh.join(" ")).toContain("不能双面打印");
    expect(chengdu.appointmentRuleZh).toContain("7 个工作日");
    expect(qingdao.serviceMode).toBe("center_guidance_required");
    expect(qingdao.bookingUrl).toBeNull();
  });

  it("marks only validated visaforkorea centers as live SMS sync supported", () => {
    const supported = ["北京", "上海", "广东", "陕西"].map(
      (province) => resolveKvacCenter({ hukouProvince: province }).recommended,
    );
    const reconOnly = ["湖北", "辽宁", "四川"].map(
      (province) => resolveKvacCenter({ hukouProvince: province }).recommended,
    );
    const guidanceOnly = resolveKvacCenter({ hukouProvince: "山东" }).recommended;

    expect(supported.map((center) => center.liveBookingMode)).toEqual([
      "sms_sync_supported",
      "sms_sync_supported",
      "sms_sync_supported",
      "sms_sync_supported",
    ]);
    expect(reconOnly.map((center) => center.liveBookingMode)).toEqual([
      "site_recon_only",
      "site_recon_only",
      "site_recon_only",
    ]);
    expect(guidanceOnly.liveBookingMode).toBe("official_guidance_only");
    expect(guidanceOnly.liveBookingRuleZh).toContain("不承诺自动预约");
  });
});
