import { test } from "node:test";
import assert from "node:assert/strict";
import { shouldProxyVietnamPublicRequest } from "../public-api-proxy.js";

test("vn.public-api-proxy: allows only official public GET resources", () => {
  assert.equal(
    shouldProxyVietnamPublicRequest(
      "GET",
      "https://api.evisa.gov.vn/client-service/public/dm-qt/get-all?type=",
    ),
    true,
  );
  assert.equal(
    shouldProxyVietnamPublicRequest(
      "GET",
      "https://api.thithucdientu.gov.vn/static/20250217/file-ngon-ngu/en.json",
    ),
    true,
  );
});

test("vn.public-api-proxy: rejects auth, submit, payment, and non-GET requests", () => {
  assert.equal(
    shouldProxyVietnamPublicRequest(
      "POST",
      "https://api.evisa.gov.vn/client-service/public/application/submit",
    ),
    false,
  );
  assert.equal(
    shouldProxyVietnamPublicRequest(
      "GET",
      "https://api.evisa.gov.vn/user-service/user/get-user-info",
    ),
    false,
  );
  assert.equal(
    shouldProxyVietnamPublicRequest(
      "GET",
      "https://example.com/client-service/public/dm-qt/get-all",
    ),
    false,
  );
});
