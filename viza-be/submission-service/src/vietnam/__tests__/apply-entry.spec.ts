import { test } from "node:test";
import assert from "node:assert/strict";
import { chooseVietnamApplyEntry } from "../apply-entry.js";

test("vn.apply-entry: prefers the visible Apply button over direct route navigation", () => {
  assert.deepEqual(
    chooseVietnamApplyEntry({
      buttons: [
        { index: 0, text: "Login", visible: true },
        { index: 1, text: "Apply now", visible: true },
      ],
      links: [{ href: "https://evisa.gov.vn/e-visa/foreigners" }],
    }),
    { kind: "button", index: 1 },
  );
});

test("vn.apply-entry: falls back to the official form link when no visible button exists", () => {
  assert.deepEqual(
    chooseVietnamApplyEntry({
      buttons: [{ index: 0, text: "Apply now", visible: false }],
      links: [{ href: "https://evisa.gov.vn/e-visa/foreigners" }],
    }),
    { kind: "link", href: "https://evisa.gov.vn/e-visa/foreigners" },
  );
});
