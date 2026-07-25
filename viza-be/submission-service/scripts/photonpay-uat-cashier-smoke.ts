/**
 * Live PhotonPay UAT cashier smoke test — creates a v5 hosted-cashier session
 * (the checkout that replaces Stripe) and prints the authCode + hosted payment
 * URL. Creates a session only; no funds move unless a buyer completes payment.
 *
 * Usage:
 *   set -a; . .secrets/photonpay/uat.env; set +a
 *   PHOTONPAY_ENABLED=1 PHOTONPAY_UAT_SITE_ID=<siteId> \
 *     npx tsx scripts/photonpay-uat-cashier-smoke.ts
 */
import { createPhotonPayClient } from "../src/clients/photonpay.js";

async function main(): Promise<void> {
  const client = createPhotonPayClient();
  if (!client) throw new Error("PHOTONPAY_ENABLED is off — source .secrets/photonpay/uat.env");

  const siteId = process.env.PHOTONPAY_UAT_SITE_ID;
  if (!siteId) throw new Error("Set PHOTONPAY_UAT_SITE_ID");

  const reqId = `viza-cashier-${Date.now()}`;
  console.log(`createCashierSession reqId=${reqId} site=${siteId} $99.00 USD`);

  const session = await client.createCashierSession({
    reqId,
    amountMinor: 9900, // $99.00 in cents
    currency: "USD",
    siteId,
    goods: [{ name: "VIZA Visa Application", virtual: true, price: "99.00", quantity: "1" }],
    shopper: {
      id: "viza-uat-shopper-1",
      nickName: "UAT Tester",
      platform: "pc",
      shopperIp: "203.0.113.10",
      email: "uat@haggstorm.com",
    },
    risk: { fingerprintId: "uat-fingerprint-001", platform: "pc", retryTimes: "1" },
    notifyUrl: "https://app.haggstorm.com/api/webhooks/photonpay",
    redirectUrl: "https://app.haggstorm.com/checkout/card/check-your-email?locale=en",
    autoRedirect: true,
  });

  console.log("authCode:", session.authCode ?? "(none)");
  console.log("payRedirectUrl:", session.payRedirectUrl ?? "(none)");
  console.log("raw:", JSON.stringify(session.raw));

  if (session.authCode || session.payRedirectUrl) {
    console.log("\n✅ Cashier session created — hosted checkout is live on UAT.");
  } else {
    console.log("\n⚠️ No authCode/redirect returned — inspect raw above.");
  }
}

main().catch((e) => {
  console.error("\n❌", e instanceof Error ? e.message : e);
  process.exit(1);
});
