import "server-only";

import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

import { sendEmail } from "@/lib/email/resend";
import type { ClientSession } from "@/lib/client-session";
import {
  consumeResilienceCache,
  getResilienceCache,
  putResilienceCache,
} from "./gateway";

const IDENTITY_SCOPE = "continuity_identity";
const OTP_SCOPE = "continuity_otp";
const IDENTITY_TTL_SECONDS = 30 * 24 * 60 * 60;
const OTP_TTL_SECONDS = 10 * 60;

type ContinuityIdentity = {
  version: 1;
  applicantId: string;
  email: string;
  authUserId?: string;
  cachedAt: string;
};

type ContinuityOtp = {
  version: 1;
  identity: ContinuityIdentity;
  tokenMac: string;
};

function continuitySecret(): string {
  const secret = process.env.CLIENT_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("CLIENT_SESSION_SECRET must be set and at least 32 characters");
  }
  return secret;
}

function normalizedEmail(email: string): string {
  return email.trim().toLowerCase();
}

function keyedDigest(value: string): string {
  return createHmac("sha256", continuitySecret()).update(value).digest("hex");
}

function identityRef(email: string): string {
  return keyedDigest(`identity:${normalizedEmail(email)}`);
}

function otpMac(email: string, token: string): string {
  return keyedDigest(`otp-proof:${normalizedEmail(email)}:${token}`);
}

export async function cacheContinuityIdentity(session: ClientSession): Promise<void> {
  const email = normalizedEmail(session.email);
  const identity: ContinuityIdentity = {
    version: 1,
    applicantId: session.userId,
    email,
    authUserId: session.authUserId,
    cachedAt: new Date().toISOString(),
  };
  await putResilienceCache({
    userRef: identityRef(email),
    scope: IDENTITY_SCOPE,
    key: "current",
    value: identity,
    ttlSeconds: IDENTITY_TTL_SECONDS,
  });
}

export async function sendContinuityOtp(emailInput: string): Promise<boolean> {
  const email = normalizedEmail(emailInput);
  const userRef = identityRef(email);
  const identity = await getResilienceCache<ContinuityIdentity>({
    userRef,
    scope: IDENTITY_SCOPE,
    key: "current",
  });
  if (!identity || identity.version !== 1 || identity.email !== email) return false;

  const token = String(randomInt(0, 100_000_000)).padStart(8, "0");
  const proof: ContinuityOtp = {
    version: 1,
    identity,
    tokenMac: otpMac(email, token),
  };
  await putResilienceCache({
    userRef,
    scope: OTP_SCOPE,
    key: "current",
    value: proof,
    ttlSeconds: OTP_TTL_SECONDS,
    oneTime: true,
  });

  const from = process.env.NOTIFY_FROM_EMAIL?.trim() || "VIZA <welcome@viza.it.com>";
  await sendEmail({
    from,
    to: email,
    subject: "VIZA continuity sign-in code / VIZA 故障恢复登录验证码",
    text: [
      `Your VIZA continuity sign-in code is ${token}. It expires in 10 minutes.`,
      `您的 VIZA 故障恢复登录验证码是 ${token}，10 分钟内有效。`,
      "If you did not request this code, ignore this message.",
      "如果不是您本人操作，请忽略本邮件。",
    ].join("\n\n"),
  });
  return true;
}

export async function verifyContinuityOtp(
  emailInput: string,
  token: string,
): Promise<ClientSession | null> {
  const email = normalizedEmail(emailInput);
  const proof = await consumeResilienceCache<ContinuityOtp>({
    userRef: identityRef(email),
    scope: OTP_SCOPE,
    // Atomic consume makes every issued code single-attempt as well as
    // single-use, preventing online guessing during provider outages.
    key: "current",
  });
  if (!proof || proof.version !== 1 || proof.identity.email !== email) return null;

  const actual = Buffer.from(proof.tokenMac, "hex");
  const expected = Buffer.from(otpMac(email, token), "hex");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  return {
    userId: proof.identity.applicantId,
    email: proof.identity.email,
    authUserId: proof.identity.authUserId,
  };
}
