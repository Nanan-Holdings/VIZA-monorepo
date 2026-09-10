import { NextResponse } from "next/server";
import {
  CHECKOUT_HANDOFF_COOKIE,
  CHECKOUT_HANDOFF_TTL_SECONDS,
  sealCheckoutHandoff,
  type CheckoutHandoff,
} from "@/lib/checkout/handoff";

export const runtime = "nodejs";

function field(form: FormData, name: string, maxLength: number): string {
  const value = form.get(name);
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function originAllowed(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const configured = process.env.VIZA_MARKETING_PUBLIC_BASE_URL?.trim().replace(/\/$/, "");
  if ([configured, "https://viza.it.com", "https://www.viza.it.com"].filter(Boolean).includes(origin)) {
    return true;
  }
  if (process.env.NODE_ENV !== "production") {
    try {
      const url = new URL(origin);
      return ["localhost", "127.0.0.1"].includes(url.hostname) && ["http:", "https:"].includes(url.protocol);
    } catch {
      return false;
    }
  }
  return false;
}

export async function POST(request: Request) {
  if (!originAllowed(request)) {
    return NextResponse.json({ error: "Untrusted checkout handoff origin" }, { status: 403 });
  }

  const form = await request.formData();
  const paymentMethod = field(form, "paymentMethod", 12) as CheckoutHandoff["paymentMethod"];
  const country = field(form, "country", 80);
  const visaType = field(form, "visaType", 80);
  const locale = field(form, "locale", 12) === "zh-CN" ? "zh-CN" : "en";
  if (!(["card", "wechat"] as const).includes(paymentMethod) || !country || !visaType) {
    return NextResponse.json({ error: "Invalid checkout handoff" }, { status: 400 });
  }

  let sealed: string;
  try {
    sealed = sealCheckoutHandoff({
      paymentMethod,
      country,
      visaType,
      locale,
      email: field(form, "email", 320),
      fullName: field(form, "fullName", 200),
      prefill: field(form, "prefill", 2_600),
      betaToken: field(form, "betaToken", 128),
    });
  } catch (error) {
    console.error("[checkout-handoff] Encryption is unavailable", error);
    return NextResponse.json({ error: "Checkout handoff is unavailable" }, { status: 503 });
  }

  const response = NextResponse.redirect(new URL(`/checkout/${paymentMethod}`, request.url), 303);
  response.cookies.set(CHECKOUT_HANDOFF_COOKIE, sealed, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: CHECKOUT_HANDOFF_TTL_SECONDS,
    path: "/checkout",
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
