import assert from "node:assert/strict";
import { test } from "node:test";
import { buildCanadaPortalUserAgent } from "../browser.js";

test("CA browser uses a platform-matching regular Chrome user agent", () => {
  const mac = buildCanadaPortalUserAgent("151.0.1.2", "darwin");
  const linux = buildCanadaPortalUserAgent("151.0.1.2", "linux");

  assert.match(mac, /Macintosh/);
  assert.match(linux, /X11; Linux x86_64/);
  assert.match(mac, /Chrome\/151\.0\.1\.2/);
  assert.doesNotMatch(mac, /HeadlessChrome/);
});
