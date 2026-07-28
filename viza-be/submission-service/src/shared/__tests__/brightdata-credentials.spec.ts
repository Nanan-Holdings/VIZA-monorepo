import { test } from "node:test";
import assert from "node:assert/strict";
import {
  resolveBrightDataBaseUsername,
  resolveBrightDataCredentials,
} from "../brightdata-credentials.js";

test("brightdata: explicit username + password", () => {
  process.env.BRIGHTDATA_USERNAME = "brd-customer-hl_abc-zone-viza_prod";
  process.env.BRIGHTDATA_PASSWORD = "secret";
  delete process.env.BRIGHTDATA_CUSTOMER_ID;
  delete process.env.BRIGHTDATA_ZONE;
  delete process.env.BRIGHTDATA_ZONE_PASSWORD;

  const creds = resolveBrightDataCredentials();
  assert.equal(creds?.username, "brd-customer-hl_abc-zone-viza_prod");
  assert.equal(creds?.password, "secret");
  assert.equal(resolveBrightDataBaseUsername(), creds?.username);
});

test("brightdata: customer id + zone builds username", () => {
  delete process.env.BRIGHTDATA_USERNAME;
  delete process.env.BRIGHTDATA_USER;
  process.env.BRIGHTDATA_CUSTOMER_ID = "hl_abc123";
  process.env.BRIGHTDATA_ZONE = "viza_qa_local";
  process.env.BRIGHTDATA_ZONE_PASSWORD = "zone-secret";

  const creds = resolveBrightDataCredentials();
  assert.equal(creds?.username, "brd-customer-hl_abc123-zone-viza_qa_local");
  assert.equal(creds?.password, "zone-secret");
});

test("brightdata: missing password returns null", () => {
  process.env.BRIGHTDATA_USERNAME = "brd-customer-hl_abc-zone-viza_prod";
  delete process.env.BRIGHTDATA_PASSWORD;
  delete process.env.BRIGHTDATA_ZONE_PASSWORD;
  assert.equal(resolveBrightDataCredentials(), null);
});
