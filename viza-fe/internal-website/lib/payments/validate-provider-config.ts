/**
 * Secret-free payment-provider readiness checks.
 *
 * The card checkout has one authoritative runtime switch: PhotonPay is active
 * when PHOTONPAY_ENABLED is truthy, otherwise Stripe is the fallback. Optional
 * payment rails do not have equivalent switches, so production must name them
 * explicitly in VIZA_ENABLED_PAYMENT_PROVIDERS rather than inferring intent
 * from the presence of credentials.
 */

export const PAYMENT_PROVIDERS = ["stripe", "photonpay", "airwallex", "alipay", "wechat"] as const;

export type Provider = (typeof PAYMENT_PROVIDERS)[number];
export type ProviderMode = "live" | "test" | "unknown";

const REQUIRED_ENV: Record<Provider, string[]> = {
  stripe: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"],
  photonpay: ["PHOTONPAY_BASE_URL", "PHOTONPAY_APP_ID", "PHOTONPAY_APP_SECRET", "PHOTONPAY_SITE_ID"],
  airwallex: ["AIRWALLEX_CLIENT_ID", "AIRWALLEX_API_KEY", "AIRWALLEX_WEBHOOK_SECRET", "AIRWALLEX_ENV"],
  alipay: ["ALIPAY_APP_ID", "ALIPAY_PRIVATE_KEY", "ALIPAY_PUBLIC_KEY", "ALIPAY_GATEWAY_URL"],
  wechat: [
    "WECHAT_PAY_MCH_ID",
    "WECHAT_PAY_APP_ID",
    "WECHAT_PAY_API_V3_KEY",
    "WECHAT_PAY_MERCHANT_SERIAL_NO",
    "WECHAT_PAY_PRIVATE_KEY",
    "WECHAT_PAY_NOTIFY_URL",
    "WECHAT_PAY_REFUND_NOTIFY_URL",
  ],
};

export interface ProviderConfigIssue {
  provider: Provider | "configuration";
  severity: "error" | "warn";
  message: string;
}

export interface ProviderReadiness {
  provider: Provider;
  configured: boolean;
  mode: ProviderMode;
  ready: boolean;
  issues: ProviderConfigIssue[];
}

export interface PaymentProviderConfigReport {
  ready: boolean;
  environment: string;
  selectionExplicit: boolean;
  enabledProviders: Provider[];
  providers: ProviderReadiness[];
  issues: ProviderConfigIssue[];
}

function hasValue(env: NodeJS.ProcessEnv, key: string): boolean {
  return Boolean(env[key]?.trim());
}

function photonPayEnabled(env: NodeJS.ProcessEnv): boolean {
  return /^(1|true|yes|on)$/i.test((env.PHOTONPAY_ENABLED ?? "").trim());
}

function activeCardProvider(env: NodeJS.ProcessEnv): Provider {
  return photonPayEnabled(env) ? "photonpay" : "stripe";
}

function severityForUnsafeMode(env: NodeJS.ProcessEnv): "error" | "warn" {
  return env.NODE_ENV === "production" ? "error" : "warn";
}

function isNonPublicIpv4(hostname: string): boolean {
  const octets = hostname.split(".").map(Number);
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b, c] = octets;
  return a === 0
    || a === 10
    || a === 127
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && ((b === 0 && c === 0) || b === 168))
    || (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100)))
    || (a === 203 && b === 0 && c === 113)
    || a >= 224;
}

function isNonPublicIpv6(hostname: string): boolean {
  const normalized = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!normalized.includes(":")) return false;
  if (normalized === "::" || normalized === "::1" || normalized.startsWith("::ffff:")) return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("2001:db8:")) return true;
  const first = Number.parseInt(normalized.split(":", 1)[0], 16);
  return Number.isFinite(first) && first >= 0xfe80 && first <= 0xfebf;
}

export function isPublicHttpsCallbackUrl(value: string, suffix: string): boolean {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    const reservedName = hostname === "localhost"
      || !hostname.includes(".")
      || [".localhost", ".local", ".internal", ".test", ".invalid", ".example", ".onion", ".lan", ".home", ".corp"]
        .some((ending) => hostname.endsWith(ending));
    return url.protocol === "https:"
      && url.username === ""
      && url.password === ""
      && url.port === ""
      && url.search === ""
      && url.hash === ""
      && url.pathname.endsWith(suffix)
      && !reservedName
      && !isNonPublicIpv4(hostname)
      && !isNonPublicIpv6(hostname);
  } catch {
    return false;
  }
}

function modeFor(provider: Provider, env: NodeJS.ProcessEnv): ProviderMode {
  if (provider === "stripe") {
    const secret = env.STRIPE_SECRET_KEY?.trim() ?? "";
    const publishable = env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() ?? "";
    if (secret.startsWith("sk_live_") && publishable.startsWith("pk_live_")) return "live";
    if (secret.startsWith("sk_test_") || publishable.startsWith("pk_test_")) return "test";
    return "unknown";
  }
  if (provider === "photonpay") {
    const baseUrl = (env.PHOTONPAY_BASE_URL ?? "").toLowerCase();
    if (/sandbox|\btest\b/.test(baseUrl)) return "test";
    if (baseUrl === "https://x-api.photonpay.com" || baseUrl === "https://x-api.photonpay.com/") return "live";
    return "unknown";
  }
  if (provider === "airwallex") {
    if ((env.AIRWALLEX_ENV ?? "").trim().toLowerCase() === "prod") return "live";
    if (hasValue(env, "AIRWALLEX_ENV")) return "test";
    return "unknown";
  }
  if (provider === "alipay") {
    const gateway = (env.ALIPAY_GATEWAY_URL ?? "").toLowerCase();
    if (gateway.includes("sandbox") || gateway.includes("alipaydev.com")) return "test";
    if (gateway === "https://openapi.alipay.com/gateway.do") return "live";
    return "unknown";
  }
  // WeChat Pay does not expose a reliable sandbox/live discriminator in the
  // environment contract. Do not guess from credential shapes.
  return "unknown";
}

function selectionFromEnv(env: NodeJS.ProcessEnv): {
  providers: Provider[];
  explicit: boolean;
  issues: ProviderConfigIssue[];
} {
  const raw = env.VIZA_ENABLED_PAYMENT_PROVIDERS;
  const cardProvider = activeCardProvider(env);
  if (raw === undefined) {
    return {
      providers: [cardProvider],
      explicit: false,
      issues: [{
        provider: "configuration",
        severity: severityForUnsafeMode(env),
        message: "VIZA_ENABLED_PAYMENT_PROVIDERS is not set; only the active card provider can be inferred.",
      }],
    };
  }

  const tokens = raw.split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
  const known = new Set<string>(PAYMENT_PROVIDERS);
  const providers = [...new Set(tokens.filter((value): value is Provider => known.has(value)))];
  const unknown = [...new Set(tokens.filter((value) => !known.has(value)))];
  const issues: ProviderConfigIssue[] = [];

  if (unknown.length > 0) {
    issues.push({
      provider: "configuration",
      severity: "error",
      message: `Unknown payment providers: ${unknown.join(", ")}`,
    });
  }
  if (!providers.includes(cardProvider)) {
    providers.unshift(cardProvider);
    issues.push({
      provider: "configuration",
      severity: "error",
      message: `VIZA_ENABLED_PAYMENT_PROVIDERS must include the active card provider: ${cardProvider}.`,
    });
  }
  if (providers.includes("photonpay") && !photonPayEnabled(env)) {
    issues.push({
      provider: "photonpay",
      severity: "error",
      message: "PhotonPay is listed but PHOTONPAY_ENABLED is not enabled.",
    });
  }

  return { providers, explicit: true, issues };
}

/** Validate required configuration for a caller-supplied provider set. */
export function validateProviderConfig(
  enabled: Provider[],
  env: NodeJS.ProcessEnv = process.env,
): ProviderConfigIssue[] {
  const issues: ProviderConfigIssue[] = [];
  for (const provider of enabled) {
    const missing = REQUIRED_ENV[provider].filter((key) => !hasValue(env, key));
    if (provider === "photonpay") {
      if (!hasValue(env, "PHOTONPAY_PRIVATE_KEY") && !hasValue(env, "PHOTONPAY_PRIVATE_KEY_PATH")) {
        missing.push("PHOTONPAY_PRIVATE_KEY(_PATH)");
      }
      if (!hasValue(env, "PHOTONPAY_PLATFORM_PUBLIC_KEY") && !hasValue(env, "PHOTONPAY_PLATFORM_PUBLIC_KEY_PATH")) {
        missing.push("PHOTONPAY_PLATFORM_PUBLIC_KEY(_PATH)");
      }
    }
    if (missing.length > 0) {
      issues.push({ provider, severity: "error", message: `Missing env: ${missing.join(", ")}` });
    }
    if (provider === "wechat" && missing.length === 0) {
      for (const [key, suffix] of [
        ["WECHAT_PAY_NOTIFY_URL", "/api/wechat-pay/notify"],
        ["WECHAT_PAY_REFUND_NOTIFY_URL", "/api/wechat-pay/refund/notify"],
      ] as const) {
        if (!isPublicHttpsCallbackUrl(env[key] as string, suffix)) {
          issues.push({
            provider,
            severity: "error",
            message: `${key} must be a public HTTPS URL ending in ${suffix}.`,
          });
        }
      }
    }

    const mode = modeFor(provider, env);
    if (mode === "test") {
      issues.push({
        provider,
        severity: severityForUnsafeMode(env),
        message: `${provider} is configured for a known NON-PROD test or sandbox environment.`,
      });
    }
  }
  return issues;
}

/** Build the payload used by the internal readiness endpoint. Never includes env values. */
export function getPaymentProviderConfigReport(
  env: NodeJS.ProcessEnv = process.env,
): PaymentProviderConfigReport {
  const selection = selectionFromEnv(env);
  const providerIssues = validateProviderConfig(selection.providers, env);
  const issues = [...selection.issues, ...providerIssues];
  const providers = selection.providers.map((provider): ProviderReadiness => {
    const ownIssues = issues.filter((issue) => issue.provider === provider);
    const configured = !ownIssues.some((issue) => issue.severity === "error" && issue.message.startsWith("Missing env:"));
    return {
      provider,
      configured,
      mode: modeFor(provider, env),
      ready: configured && !ownIssues.some((issue) => issue.severity === "error"),
      issues: ownIssues,
    };
  });

  return {
    ready: !issues.some((issue) => issue.severity === "error"),
    environment: env.NODE_ENV ?? "development",
    selectionExplicit: selection.explicit,
    enabledProviders: selection.providers,
    providers,
    issues,
  };
}
