/**
 * Payment provider config validation (PAYP-002).
 *
 * Asserts the required env vars exist per ENABLED provider and surfaces
 * non-prod misconfigurations (e.g. AIRWALLEX_ENV=demo). Returns a structured
 * report rather than throwing, so a caller (startup check / health route)
 * decides severity. Documented in docs/payments/provider-config.md.
 */

export type Provider = "stripe" | "airwallex" | "alipay" | "wechat";

const REQUIRED_ENV: Record<Provider, string[]> = {
  stripe: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"],
  airwallex: ["AIRWALLEX_CLIENT_ID", "AIRWALLEX_API_KEY", "AIRWALLEX_WEBHOOK_SECRET", "AIRWALLEX_ENV"],
  alipay: ["ALIPAY_APP_ID", "ALIPAY_PRIVATE_KEY", "ALIPAY_PUBLIC_KEY", "ALIPAY_GATEWAY_URL"],
  wechat: [
    "WECHAT_PAY_MCH_ID",
    "WECHAT_PAY_APP_ID",
    "WECHAT_PAY_API_V3_KEY",
    "WECHAT_PAY_MERCHANT_SERIAL_NO",
    "WECHAT_PAY_PRIVATE_KEY",
    "WECHAT_PAY_NOTIFY_URL",
  ],
};

export interface ProviderConfigIssue {
  provider: Provider;
  severity: "error" | "warn";
  message: string;
}

export function validateProviderConfig(
  enabled: Provider[],
  env: NodeJS.ProcessEnv = process.env,
): ProviderConfigIssue[] {
  const issues: ProviderConfigIssue[] = [];
  for (const provider of enabled) {
    const missing = REQUIRED_ENV[provider].filter((k) => !env[k] || env[k]?.trim() === "");
    if (missing.length > 0) {
      issues.push({ provider, severity: "error", message: `Missing env: ${missing.join(", ")}` });
    }
  }
  // Non-prod Airwallex flagged clearly.
  if (enabled.includes("airwallex") && env.AIRWALLEX_ENV && env.AIRWALLEX_ENV !== "prod") {
    issues.push({
      provider: "airwallex",
      severity: "warn",
      message: `AIRWALLEX_ENV=${env.AIRWALLEX_ENV} is NON-PROD — payments will not settle for real.`,
    });
  }
  return issues;
}

export interface PaymentProviderConfigReport {
  ready: boolean;
  environment: string;
  selectionExplicit: boolean;
  enabledProviders: Provider[];
  providers: Array<{
    provider: Provider;
    configured: boolean;
    ready: boolean;
    issues: ProviderConfigIssue[];
  }>;
  issues: ProviderConfigIssue[];
}

/**
 * Build a secret-free payment readiness response for internal health checks.
 * Explicit selection is required in production so unused credentials cannot
 * silently activate a payment rail.
 */
export function getPaymentProviderConfigReport(
  env: NodeJS.ProcessEnv = process.env,
): PaymentProviderConfigReport {
  const raw = env.VIZA_ENABLED_PAYMENT_PROVIDERS;
  const known = new Set<Provider>(["stripe", "airwallex", "alipay", "wechat"]);
  const requested = raw?.split(",").map((value) => value.trim().toLowerCase()).filter(Boolean) ?? ["stripe"];
  const enabledProviders = [...new Set(requested.filter((value): value is Provider => known.has(value as Provider)))];
  const issues: ProviderConfigIssue[] = validateProviderConfig(enabledProviders, env);

  for (const provider of [...new Set(requested.filter((value) => !known.has(value as Provider)))]) {
    issues.push({ provider: "stripe", severity: "error", message: `Unknown payment provider: ${provider}` });
  }

  const providers = enabledProviders.map((provider) => {
    const providerIssues = issues.filter((issue) => issue.provider === provider);
    const configured = !providerIssues.some((issue) => issue.message.startsWith("Missing env:"));
    return {
      provider,
      configured,
      ready: configured && !providerIssues.some((issue) => issue.severity === "error"),
      issues: providerIssues,
    };
  });

  return {
    ready: !issues.some((issue) => issue.severity === "error") && enabledProviders.length > 0,
    environment: env.NODE_ENV ?? "development",
    selectionExplicit: raw !== undefined,
    enabledProviders,
    providers,
    issues,
  };
}
