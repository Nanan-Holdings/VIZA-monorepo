import { test } from "node:test";
import assert from "node:assert/strict";

import {
  PhotonPayClient,
  PhotonPayConfigError,
  createPhotonPayClient,
  resolveTokenExpiry,
} from "./photonpay.js";

/**
 * Signing must reproduce PhotonPay's official 签名文档 worked example exactly.
 * If this ever breaks, every signed request will be rejected with "invalid
 * sign" — so we pin the primitive to their published fixture.
 *
 * body {"requestId": "1001"} + the doc's example keypair → the doc's signature.
 */
const EXAMPLE_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIICdgIBADANBgkqhkiG9w0BAQEFAASCAmAwggJcAgEAAoGBAL27FyQ3lPqzJ6Xk
AoCPXEVMYZj1M15mvIgm+jjLe9r4C4Ebn7R1l0Nr8jpxmgqauDdJcyrnXLL2USXI
UkPDkoUjl7F0pgS6Cp3qcWmFndW2HvwivmstuHXII2VHQwdjteI0jZahXuD5HFFB
cDfWiqwLC6ng1oKGrla+v5FzjY6lAgMBAAECgYBlOuhq+3jylhomadRn8ZWip9E/
AjzpNlmLL3i8St2HhGbm+O0qJL+TSooQYsJ0u/5kCT14e787AS9kwFAcNcH7eMMS
T6ML5oKs11BRNKbu184foFAZAmjv/oVUaAFHtjUda7L3HhuY9+jKyw9JIfF/Ytfx
ZyhOpjxznZg5pUjIAQJBAPbiKoAIXSp3M5OkRdGApDgGRAgzDOz360eofElZivRk
eOWx4AOa3CUJPR3bc2ymThC3vtkS29F19FLXk3UKLgECQQDEvKZwU6BFrcqCodLR
vetIxs55WxcDmT7IZM7YbgurmhlNrx0vgrw6URHA3JRRrwAjwYlUDZx7yOfi7Y30
TeilAkB439y9GNs8imYnODuyylAc2fx/IzeF4hBA4l4Pr5aX94U1uLQcL7rvKynQ
L3zAyl/YUY5QS6pyUFUSJlgc6qIBAkBMOMbHOC8dL+MIz4dtSYaR0KyIKfl1pHbF
jwDwq1oMJwzsow7MrHseoPAe55bzOrj0IXSCQy/AaaslqWHZKCIdAkEAyzSajE0X
vpzU2yKLhO3gj6WEYw7RPemyCbjwgMCQTBeiUnwmni6AYGygsYv733pzst2KuaUw
PClEOQshK/jTUw==
-----END PRIVATE KEY-----`;

const EXAMPLE_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC9uxckN5T6syel5AKAj1xFTGGY
9TNeZryIJvo4y3va+AuBG5+0dZdDa/I6cZoKmrg3SXMq51yy9lElyFJDw5KFI5ex
dKYEugqd6nFphZ3Vth78Ir5rLbh1yCNlR0MHY7XiNI2WoV7g+RxRQXA31oqsCwup
4NaChq5Wvr+Rc42OpQIDAQAB
-----END PUBLIC KEY-----`;

const EXAMPLE_BODY = '{"requestId": "1001"}';
const EXPECTED_SIGN =
  "nDDsSzQvv3+ZCYRollFshmsuhJ7ppw6ygbGyJgTJhSKxZXPLBfN64o1wt8qdql4p8YNijKBq9iYhPythelVZw4Qad2ntsm8Ix9XJPSBvHXnI0NrV7nZMpLEgmIjHcGH54epZXFwDTf1rbiQpCC8eSeH/1ZFvnJv21lFX44sUtGE=";

function client(privateKeyPem: string, platformPublicKeyPem?: string): PhotonPayClient {
  return new PhotonPayClient({
    baseUrl: "https://example.invalid",
    appId: "test",
    appSecret: "test",
    privateKeyPem,
    platformPublicKeyPem,
  });
}

test("sign() reproduces PhotonPay's documented example signature", () => {
  assert.equal(client(EXAMPLE_PRIVATE_KEY).sign(EXAMPLE_BODY), EXPECTED_SIGN);
});

test("verifyWebhookSignature() accepts a matching signature", () => {
  assert.equal(
    client(EXAMPLE_PRIVATE_KEY, EXAMPLE_PUBLIC_KEY).verifyWebhookSignature(EXAMPLE_BODY, EXPECTED_SIGN),
    true,
  );
});

test("verifyWebhookSignature() rejects a tampered body", () => {
  assert.equal(
    client(EXAMPLE_PRIVATE_KEY, EXAMPLE_PUBLIC_KEY).verifyWebhookSignature(
      '{"requestId": "1002"}',
      EXPECTED_SIGN,
    ),
    false,
  );
});

test("verifyWebhookSignature() rejects a garbage signature without throwing", () => {
  assert.equal(
    client(EXAMPLE_PRIVATE_KEY, EXAMPLE_PUBLIC_KEY).verifyWebhookSignature(EXAMPLE_BODY, "not-base64!!"),
    false,
  );
});

// --- token expiry ---------------------------------------------------------

const NOW = 1_784_993_000_000;

test("resolveTokenExpiry() reads an absolute epoch-ms expiry as-is", () => {
  // What the UAT tenant actually returns: a future timestamp, not a duration.
  const twoHoursOut = NOW + 2 * 60 * 60_000;
  assert.equal(resolveTokenExpiry(twoHoursOut, NOW), twoHoursOut);
});

test("resolveTokenExpiry() reads a relative seconds expiry as a duration", () => {
  assert.equal(resolveTokenExpiry(7200, NOW), NOW + 7200 * 1000);
});

test("resolveTokenExpiry() clamps an implausibly long lifetime", () => {
  // Whether a huge value is a misread unit or a bad response, never cache a
  // token past the ceiling — a stale token fails every request until restart.
  const ceiling = NOW + 24 * 60 * 60_000;
  assert.equal(resolveTokenExpiry(7_200_000, NOW), ceiling); // seconds → 83 days
  assert.equal(resolveTokenExpiry(NOW + 400 * 24 * 60 * 60_000, NOW), ceiling); // epoch a year out
});

test("resolveTokenExpiry() falls back to 2h when the value is unusable", () => {
  const fallback = NOW + 2 * 60 * 60_000;
  for (const bad of [undefined, null, "", "abc", 0, -1, NaN]) {
    assert.equal(resolveTokenExpiry(bad, NOW), fallback, `expiresIn=${String(bad)}`);
  }
});

// --- token fetch de-duplication -------------------------------------------

test("concurrent calls share a single token fetch", async () => {
  // A second token fetch invalidates the first token server-side, so a burst of
  // concurrent requests must not each mint one.
  const originalFetch = globalThis.fetch;
  let tokenFetches = 0;
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0]) => {
    if (String(input).includes("/oauth2/token/accessToken")) {
      tokenFetches += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return new Response(JSON.stringify({ code: "0000", data: { token: "tok", expiresIn: 7200 } }));
    }
    return new Response(JSON.stringify({ code: "0000", data: [] }));
  }) as typeof fetch;

  try {
    const c = client(EXAMPLE_PRIVATE_KEY);
    await Promise.all([c.getCardBins(), c.getCardBins(), c.getCardBins()]);
    assert.equal(tokenFetches, 1);
    // The cached token then serves later calls without another fetch.
    await c.getCardBins();
    assert.equal(tokenFetches, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("a failed token fetch is not cached — the next call retries", async () => {
  const originalFetch = globalThis.fetch;
  let tokenFetches = 0;
  globalThis.fetch = (async () => {
    tokenFetches += 1;
    return new Response(JSON.stringify({ code: "403", msg: "forbidden" }), { status: 200 });
  }) as typeof fetch;

  try {
    const c = client(EXAMPLE_PRIVATE_KEY);
    await assert.rejects(() => c.getCardBins());
    await assert.rejects(() => c.getCardBins());
    assert.equal(tokenFetches, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("openCard sends arrivalAmount for exact cross-currency card funding", async () => {
  const originalFetch = globalThis.fetch;
  let requestBody: Record<string, unknown> | undefined;
  globalThis.fetch = (async (
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1],
  ) => {
    if (String(input).includes("/oauth2/token/accessToken")) {
      return new Response(
        JSON.stringify({ code: "0000", data: { token: "tok", expiresIn: 7200 } }),
      );
    }
    if (String(input).includes("/vcc/openApi/v4/openCard")) {
      requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(
        JSON.stringify({
          code: "0000",
          data: { status: "succeed", cardDetail: { cardId: "card-test" } },
        }),
      );
    }
    throw new Error(`Unexpected PhotonPay test request: ${String(input)}`);
  }) as typeof fetch;

  try {
    const result = await client(EXAMPLE_PRIVATE_KEY).openCard({
      requestId: "cross-currency-test",
      cardBin: "52298927",
      cardCurrency: "USD",
      cardType: "recharge",
      accountId: "FA-SGD-test",
      arrivalAmount: 1,
      transactionLimitType: "unlimited",
    });
    assert.equal(result.card?.cardId, "card-test");
    assert.equal(requestBody?.arrivalAmount, 1);
    assert.equal("rechargeAmount" in (requestBody ?? {}), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("openCard sends a limited shared-card request without a recharge amount", async () => {
  const originalFetch = globalThis.fetch;
  let requestBody: Record<string, unknown> | undefined;
  globalThis.fetch = (async (
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1],
  ) => {
    if (String(input).includes("/oauth2/token/accessToken")) {
      return new Response(
        JSON.stringify({ code: "0000", data: { token: "tok", expiresIn: 7200 } }),
      );
    }
    if (String(input).includes("/vcc/openApi/v4/openCard")) {
      requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(
        JSON.stringify({
          code: "0000",
          data: { status: "succeed", cardDetail: { cardId: "shared-card-test" } },
        }),
      );
    }
    throw new Error(`Unexpected PhotonPay test request: ${String(input)}`);
  }) as typeof fetch;

  try {
    await client(EXAMPLE_PRIVATE_KEY).openCard({
      requestId: "shared-card-test",
      cardBin: "52298927",
      cardCurrency: "USD",
      cardType: "share",
      accountId: "FA-USD-test",
      transactionLimitType: "limited",
      transactionLimit: 20.01,
    });
    assert.equal(requestBody?.cardType, "share");
    assert.equal(requestBody?.transactionLimitType, "limited");
    assert.equal(requestBody?.transactionLimit, 20.01);
    assert.equal("rechargeAmount" in (requestBody ?? {}), false);
    assert.equal("arrivalAmount" in (requestBody ?? {}), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// --- factory config guards -------------------------------------------------

test("createPhotonPayClient() returns null while disabled", () => {
  const prev = process.env.PHOTONPAY_ENABLED;
  process.env.PHOTONPAY_ENABLED = "false";
  try {
    assert.equal(createPhotonPayClient(), null);
  } finally {
    if (prev === undefined) delete process.env.PHOTONPAY_ENABLED;
    else process.env.PHOTONPAY_ENABLED = prev;
  }
});

test("createPhotonPayClient() refuses to default to production", () => {
  // An unset base URL used to silently mean "production" — real cards, real
  // money — for every UAT script. It must fail instead.
  const prev = { ...process.env };
  process.env.PHOTONPAY_ENABLED = "true";
  delete process.env.PHOTONPAY_BASE_URL;
  process.env.PHOTONPAY_APP_ID = "id";
  process.env.PHOTONPAY_APP_SECRET = "secret";
  process.env.PHOTONPAY_PRIVATE_KEY = EXAMPLE_PRIVATE_KEY;
  try {
    assert.throws(() => createPhotonPayClient(), PhotonPayConfigError);
  } finally {
    process.env = prev;
  }
});
