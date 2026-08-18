import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeVnPrearrivalFlightSearch,
  pageVnPrearrivalFlightCatalog,
  type VnPrearrivalFlightCatalogSnapshot,
} from "../flight-catalog";

const snapshot: VnPrearrivalFlightCatalogSnapshot = {
  fetchedAt: "2026-08-18T05:40:00.709Z",
  items: [
    { code: "B3239_SGN", vn_value: "B3239", en_value: "B3239", airport: "SGN" },
    { code: "MR0681_PQC", vn_value: "MR0681", en_value: "MR0681", airport: "PQC" },
    { code: "N77999_SGN", vn_value: "N77999", en_value: "N77999", airport: "SGN" },
    { code: "N77999_PQC", vn_value: "N77999", en_value: "N77999", airport: "PQC" },
  ],
};

test("normalizes three-digit official flight searches exactly like the portal", () => {
  assert.equal(normalizeVnPrearrivalFlightSearch("MR681"), "MR0681");
  assert.equal(normalizeVnPrearrivalFlightSearch("MR0681"), "MR0681");
  assert.equal(normalizeVnPrearrivalFlightSearch("B605A"), "B605A");
});
test("pages the live catalog and checks saved selections by unique official code", () => {
  const page = pageVnPrearrivalFlightCatalog(snapshot, {
    keyword: "N77999",
    page: 0,
    size: 10,
    selectedValue: "N77999_PQC",
  });

  assert.deepEqual(page.items.map((item) => item.code), ["N77999_SGN", "N77999_PQC"]);
  assert.equal(page.selectedExists, true);
  assert.equal(page.selectedItem?.airport, "PQC");
});

test("reports a removed saved flight while preserving the client-side Other option", () => {
  assert.equal(pageVnPrearrivalFlightCatalog(snapshot, {
    keyword: "",
    page: 0,
    size: 10,
    selectedValue: "REMOVED_PQC",
  }).selectedExists, false);
  assert.equal(pageVnPrearrivalFlightCatalog(snapshot, {
    keyword: "",
    page: 0,
    size: 10,
    selectedValue: "other",
  }).selectedExists, true);
});
