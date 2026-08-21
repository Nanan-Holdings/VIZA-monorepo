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
