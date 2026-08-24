import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const footerSource = readFileSync(new URL("../components/SiteFooter.tsx", import.meta.url), "utf8");
const enMessages = JSON.parse(readFileSync(new URL("../messages/en.json", import.meta.url), "utf8"));
const zhMessages = JSON.parse(readFileSync(new URL("../messages/zh-CN.json", import.meta.url), "utf8"));

test("footer product links only target real marketing routes", () => {
  assert.match(footerSource, /prodMockInterview", href: "\/visa\/united-states"/);
  assert.match(footerSource, /prodVisaReq", href: "\/"/);
  assert.match(footerSource, /prodSchengen", href: "\/visa\/france"/);
  assert.match(footerSource, /prodHelpline", href: "\/contact"/);
  assert.doesNotMatch(footerSource, /prodMockInterview", href: "\/apply"/);
  assert.doesNotMatch(footerSource, /prodPhoto", href:/);
  assert.doesNotMatch(footerSource, /prodStudent", href:/);
});

test("unavailable footer products and native apps are non-clickable", () => {
  assert.match(footerSource, /prodPhoto", comingSoon: true/);
  assert.match(footerSource, /prodStudent", comingSoon: true/);
  assert.doesNotMatch(footerSource, /className="app-badge" href=/);
  assert.doesNotMatch(footerSource, /app-store-badge\.png/);
  assert.doesNotMatch(footerSource, /google-play-badge\.png/);
});

test("footer pending copy exists in supported locales", () => {
  for (const messages of [enMessages, zhMessages]) {
    assert.equal(typeof messages.footer.comingSoon, "string");
    assert.ok(messages.footer.comingSoon.length > 0);
    assert.equal(typeof messages.footer.appsComingSoon, "string");
    assert.ok(messages.footer.appsComingSoon.length > 0);
  }
});
