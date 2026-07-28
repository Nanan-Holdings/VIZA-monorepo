#!/usr/bin/env node
/**
 * PhotonPay connectivity smoke test.
 *
 * Verifies, in order:
 *   1. appId/appSecret → access token (`/oauth2/token/accessToken`)
 *   2. Account list query (X-PD-TOKEN auth)
 *   3. RSA request signature (X-PD-SIGN, MD5withRSA over the request body)
 *      via a harmless FX rate quote POST
 *   4. Card BIN query (needed later for VCC openCard)
 *
 * Usage:
 *   PHOTONPAY_APP_ID=... PHOTONPAY_APP_SECRET=... \
 *   PHOTONPAY_PRIVATE_KEY_PATH=.secrets/photonpay/merchant_private_pkcs8.pem \
 *   node scripts/photonpay-smoke.mjs [--env sandbox|prod]
 *
 * Exits 0 when everything passes, 1 otherwise.
 */
import { readFileSync } from 'node:fs';
import { createSign } from 'node:crypto';

const ENVS = {
  // Test environment as of 2026-07-24: no merchant IP allowlist, accounts and
  // history carried over from the retired x-api1.uat.photontech.cc host.
  sandbox: 'https://x-api.sandbox.photontech.cc',
  prod: 'https://x-api.photonpay.com',
};

/** Hosts PhotonPay has decommissioned — fail loudly instead of hanging. */
const RETIRED = {
  uat: 'https://x-api1.uat.photontech.cc (retired 2026-07-24 — use --env sandbox)',
};

// Accept both `--env x` and `--env=x`. Matching only the spaced form would let
// `--env=uat` fall through to the default and quietly skip the RETIRED guard
// below — a silent wrong-environment run is exactly what that guard exists for.
// Default to sandbox: an accidental bare run must not talk to production.
const envArg = (() => {
  const args = process.argv.slice(2);
  const i = args.findIndex((a) => a === '--env' || a.startsWith('--env='));
  if (i === -1) return 'sandbox';
  const inline = args[i].startsWith('--env=') ? args[i].slice('--env='.length) : args[i + 1];
  return (inline ?? '').trim() || 'sandbox';
})();
if (RETIRED[envArg]) {
  console.error(`--env "${envArg}" points at a decommissioned host: ${RETIRED[envArg]}`);
  process.exit(1);
}
const BASE = ENVS[envArg];
if (!BASE) {
  console.error(`Unknown --env "${envArg}" (use ${Object.keys(ENVS).join('|')})`);
  process.exit(1);
}

const appId = process.env.PHOTONPAY_APP_ID;
const appSecret = process.env.PHOTONPAY_APP_SECRET;
if (!appId || !appSecret) {
  console.error('Set PHOTONPAY_APP_ID and PHOTONPAY_APP_SECRET');
  process.exit(1);
}

const keyPath = process.env.PHOTONPAY_PRIVATE_KEY_PATH;
let privateKey = null;
if (keyPath) {
  privateKey = readFileSync(keyPath, 'utf8');
}

function signBody(body) {
  // PhotonPay: MD5withRSA over the raw request body, base64-encoded → X-PD-SIGN
  const signer = createSign('RSA-MD5');
  signer.update(body, 'utf8');
  return signer.sign(privateKey, 'base64');
}

let failures = 0;
const ok = (label, detail = '') => console.log(`  ✅ ${label}${detail ? ` — ${detail}` : ''}`);
const bad = (label, detail = '') => {
  failures += 1;
  console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ''}`);
};

console.log(`PhotonPay smoke test → ${envArg} (${BASE})\n`);

// 1. Access token
let token = null;
{
  const basic = 'basic ' + Buffer.from(`${appId}/${appSecret}`).toString('base64');
  const res = await fetch(`${BASE}/oauth2/token/accessToken`, {
    method: 'POST',
    headers: { Authorization: basic, 'Content-Type': 'application/json' },
  });
  const data = await res.json().catch(() => ({}));
  token = data?.data?.token ?? data?.data?.accessToken ?? data?.accessToken ?? null;
  // `expiresIn` is misnamed: PhotonPay returns an ABSOLUTE epoch-ms timestamp,
  // not a duration. Render it as minutes remaining so the number is readable.
  const raw = Number(data?.data?.expiresIn ?? data?.expiresIn);
  const life = Number.isFinite(raw)
    ? raw > Date.now()
      ? `valid ${((raw - Date.now()) / 60_000).toFixed(0)} min (expires ${new Date(raw).toISOString()})`
      : `expiresIn=${raw} (relative form?)`
    : 'expiry unknown';
  if (res.ok && token) ok('access token', life);
  else bad('access token', `HTTP ${res.status} ${JSON.stringify(data).slice(0, 200)}`);
}

if (!token) {
  console.log(
    '\nToken generation failed — portal setup incomplete (developer app, IP allowlist) or wrong credentials.'
  );
  process.exit(1);
}

// 2. Account list (GET, no body → no signature needed)
{
  const res = await fetch(`${BASE}/wallet/openApi/v4/account/list`, {
    headers: { 'X-PD-TOKEN': token },
  });
  const data = await res.json().catch(() => ({}));
  if (res.ok && data?.data) {
    const accounts = Array.isArray(data.data) ? data.data : data.data.list ?? [];
    ok('account list', `${accounts.length ?? '?'} account(s)`);
    for (const a of accounts.slice(0, 10)) {
      // accountNo is the funding account id openCard/preRecharge take (FA-USD…).
      const id = a.accountNo ?? a.accountId ?? a.id ?? '?';
      const bal = a.realTimeBalance ?? a.amount ?? a.balance ?? '';
      console.log(`       • ${id} ${a.currency ?? ''} ${bal}`);
    }
  } else bad('account list', `HTTP ${res.status} ${JSON.stringify(data).slice(0, 200)}`);
}

// 3. Signed POST — FX quote (read-only pricing, creates nothing).
//
// We assert on the SIGNATURE verdict, not on the quote succeeding. PhotonPay
// answers a bad signature with code 1001 "invalid sign" and a well-signed but
// incomplete payload with code 1000 "<field> can not be blank" — so a 1000 is
// itself proof the signature was accepted, and chasing the endpoint's full
// parameter set (side, deliveryDate, amount…) would only make this brittle.
// The negative case runs too: without it, a server that stopped checking
// signatures entirely would pass this test.
const INVALID_SIGN_CODE = '1001';
if (privateKey) {
  const body = JSON.stringify({ sellCurrency: 'USD', buyCurrency: 'HKD', sellAmount: '100', side: 'sell' });
  const quote = (sign) =>
    fetch(`${BASE}/wallet/openApi/v4/exchange/quote`, {
      method: 'POST',
      headers: { 'X-PD-TOKEN': token, 'Content-Type': 'application/json', 'X-PD-SIGN': sign },
      body,
    }).then((r) => r.json().catch(() => ({})));

  const good = await quote(signBody(body));
  if (good?.code === INVALID_SIGN_CODE) {
    bad('RSA signature (X-PD-SIGN)', `our signature was rejected: ${good.msg}`);
  } else {
    const detail = good?.data ? 'quote returned' : `accepted (business reply: ${good?.msg ?? '—'})`;
    ok('RSA signature (X-PD-SIGN)', detail);

    const bogus = await quote('AAAA');
    if (bogus?.code === INVALID_SIGN_CODE) ok('signature is actually enforced', 'bad signature → invalid sign');
    else bad('signature is actually enforced', `bad signature was NOT rejected: ${JSON.stringify(bogus).slice(0, 160)}`);
  }
} else {
  console.log('  ⚠️  skipped signature check (set PHOTONPAY_PRIVATE_KEY_PATH)');
}

// 4. Card BINs (VCC prerequisite)
{
  const res = await fetch(`${BASE}/vcc/openApi/v4/getCardBin`, {
    headers: { 'X-PD-TOKEN': token },
  });
  const data = await res.json().catch(() => ({}));
  if (res.ok && data?.data) {
    const bins = Array.isArray(data.data) ? data.data : data.data.list ?? [];
    ok('card BINs', `${bins.length ?? '?'} bin(s) available`);
    for (const b of bins.slice(0, 10)) {
      console.log(`       • ${b.cardBin ?? b.bin ?? '?'} ${b.cardScheme ?? ''} ${b.cardCurrency ?? b.currency ?? ''} ${b.cardType ?? ''}`);
    }
  } else bad('card BINs', `HTTP ${res.status} ${JSON.stringify(data).slice(0, 200)}`);
}

console.log(failures === 0 ? '\nAll checks passed — PhotonPay is ready.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
