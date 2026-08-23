import assert from "node:assert/strict";
import test from "node:test";
import { hasOfficialJpVjwQrEvidence, isJpVjwCloudfrontAccessGate, isOfficialJpVjwUrl, resolveJpVjwUserAgent } from "../selectors";

test("Visit Japan Web QR gate requires official host, visible QR and artifact", () => {
  assert.equal(isOfficialJpVjwUrl("https://www.vjw.digital.go.jp/"), true);
  assert.equal(isOfficialJpVjwUrl("https://example.com/vjw"), false);
  assert.equal(hasOfficialJpVjwQrEvidence({
    portalUrl: "https://www.vjw.digital.go.jp/qr",
    bodyText: "Visit Japan Web QR Code",
    qrElementVisible: true,
    qrArtifactPath: "/tmp/official-qr.png",
  }), true);
  assert.equal(hasOfficialJpVjwQrEvidence({
    portalUrl: "https://www.vjw.digital.go.jp/qr",
    bodyText: "Visit Japan Web QR Code",
    qrElementVisible: true,
    qrArtifactPath: null,
  }), false);
  assert.equal(isJpVjwCloudfrontAccessGate(404, "The request could not be satisfied. CloudFront"), true);
  assert.equal(isJpVjwCloudfrontAccessGate(200, "Visit Japan Web QR Code"), false);
  assert.match(resolveJpVjwUserAgent({}), /Windows NT 10\.0/);
});

test("Visit Japan Web QR gate accepts the official simplified-Chinese QR heading", () => {
  assert.equal(hasOfficialJpVjwQrEvidence({
    portalUrl: "https://www.vjw.digital.go.jp/main/#/vjwpic026",
    bodyText: "入境审查及海关申报的QR码",
    qrElementVisible: true,
    qrArtifactPath: "C:/evidence/official-qr.png",
  }), true);
});
