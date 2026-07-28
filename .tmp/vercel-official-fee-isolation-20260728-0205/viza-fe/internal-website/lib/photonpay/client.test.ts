import { describe, it, expect, afterEach } from "vitest";
import { PhotonPayClient, verifyPhotonPayWebhook } from "./client";

// PhotonPay's official 签名文档 worked example. If sign()/verify() ever drift
// from this, every signed request / webhook verification breaks.
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

const BODY = '{"requestId": "1001"}';
const EXPECTED_SIGN =
  "nDDsSzQvv3+ZCYRollFshmsuhJ7ppw6ygbGyJgTJhSKxZXPLBfN64o1wt8qdql4p8YNijKBq9iYhPythelVZw4Qad2ntsm8Ix9XJPSBvHXnI0NrV7nZMpLEgmIjHcGH54epZXFwDTf1rbiQpCC8eSeH/1ZFvnJv21lFX44sUtGE=";

function client(platformPublicKeyPem?: string): PhotonPayClient {
  return new PhotonPayClient({
    baseUrl: "https://example.invalid",
    appId: "t",
    appSecret: "t",
    privateKeyPem: EXAMPLE_PRIVATE_KEY,
    platformPublicKeyPem,
  });
}

describe("PhotonPayClient signing", () => {
  it("reproduces PhotonPay's documented example signature", () => {
    expect(client().sign(BODY)).toBe(EXPECTED_SIGN);
  });

  it("verifies a matching webhook signature", () => {
    expect(client(EXAMPLE_PUBLIC_KEY).verifyWebhookSignature(BODY, EXPECTED_SIGN)).toBe(true);
  });

  it("rejects a tampered webhook body", () => {
    expect(client(EXAMPLE_PUBLIC_KEY).verifyWebhookSignature('{"requestId": "1002"}', EXPECTED_SIGN)).toBe(false);
  });

  it("rejects a garbage signature without throwing", () => {
    expect(client(EXAMPLE_PUBLIC_KEY).verifyWebhookSignature(BODY, "!!not-base64!!")).toBe(false);
  });
});

describe("verifyPhotonPayWebhook", () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it("verifies inbound callbacks even when PHOTONPAY_ENABLED is off", () => {
    // The flag governs whether we mint NEW cashier sessions. Sessions already
    // in flight must still settle after it is switched off, and the webhook
    // receiver need not be the host that mints sessions. Coupling the two would
    // 503 real callbacks and trip PhotonPay's 8-strike subscription kill switch.
    process.env.PHOTONPAY_ENABLED = "false";
    process.env.PHOTONPAY_PLATFORM_PUBLIC_KEY = EXAMPLE_PUBLIC_KEY;
    delete process.env.PHOTONPAY_APP_ID;
    delete process.env.PHOTONPAY_APP_SECRET;
    delete process.env.PHOTONPAY_BASE_URL;

    expect(verifyPhotonPayWebhook(BODY, EXPECTED_SIGN)).toBe("ok");
  });

  it("distinguishes a missing platform key from a bad signature", () => {
    process.env.PHOTONPAY_PLATFORM_PUBLIC_KEY = EXAMPLE_PUBLIC_KEY;
    expect(verifyPhotonPayWebhook('{"requestId": "1002"}', EXPECTED_SIGN)).toBe("bad-signature");
    expect(verifyPhotonPayWebhook(BODY, null)).toBe("bad-signature");
    expect(verifyPhotonPayWebhook(BODY, "!!not-base64!!")).toBe("bad-signature");

    delete process.env.PHOTONPAY_PLATFORM_PUBLIC_KEY;
    delete process.env.PHOTONPAY_PLATFORM_PUBLIC_KEY_PATH;
    expect(verifyPhotonPayWebhook(BODY, EXPECTED_SIGN)).toBe("not-configured");
  });
});
