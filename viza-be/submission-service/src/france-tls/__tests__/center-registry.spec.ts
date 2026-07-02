import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { FRANCE_TLS_CHINA_CENTERS, resolveFranceTlsCenter } from "../center-registry";

describe("France TLS China center registry", () => {
  it("covers the mainland China France TLS centers with stable codes", () => {
    const codes = FRANCE_TLS_CHINA_CENTERS.map((center) => center.code);

    assert.deepEqual(codes, [
      "beijing",
      "guangzhou",
      "chengdu",
      "shanghai",
      "shenyang",
      "wuhan",
      "chongqing",
      "changsha",
      "fuzhou",
      "hangzhou",
      "kunming",
      "nanjing",
      "shenzhen",
      "jinan",
      "xian",
    ]);
    assert.equal(new Set(codes).size, codes.length);
  });

  it("resolves aliases without changing the official center metadata", () => {
    const center = resolveFranceTlsCenter("广州");

    assert.equal(center?.code, "guangzhou");
    assert.equal(center?.provider, "TLSCONTACT_CN_FR");
    assert.match(center?.bookingUrl ?? "", /cnCAN2fr/);
    assert.ok(center?.sourceUrls.some((url) => url.includes("france-visas.gouv.fr")));
  });
});
