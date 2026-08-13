import { isAbsolute } from "node:path";
import type { Page } from "@playwright/test";
import { supabase } from "../supabase";
import {
  assertInboxAliasDomainRoutable,
  type InboundMessage,
} from "../inbox/wait-for-message";
import {
  extractTwVerificationCode,
  isTwVerificationEmail,
  waitForTwVerificationCode,
} from "./inbox";
import { TwOfficialLoginConfigurationError } from "./errors";

export interface TwOfficialLoginInput {
  applicantId: string;
  runId?: string;
  otpProvider: TwOfficialLoginOtpProvider;
}

export interface TwOfficialLoginResult {
  status: "authenticated";
  method: string;
}

/**
 * Replaceable official-account login hook. Implementations must source
 * credentials and OTPs from a secret manager or injected callback, never from
 * code, fixtures, worklogs, or logs.
 */
export interface TwOfficialLoginProvider {
  completeLogin(page: Page, input: TwOfficialLoginInput): Promise<TwOfficialLoginResult>;
}

export interface TwOfficialLoginOtpRequest {
  applicantId: string;
  runId?: string;
  timeoutMs: number;
}

export interface TwOfficialLoginOtpProvider {
  waitForOfficialLoginOtp(input: TwOfficialLoginOtpRequest): Promise<{ code: string }>;
}

export interface TwOfficialLoginBootstrapProviders {
  officialLoginProvider: TwOfficialLoginProvider;
  officialLoginOtpProvider: TwOfficialLoginOtpProvider;
}

export type TwOfficialLoginBootstrapAdapter = (
  input: { adapterName: string; env: NodeJS.ProcessEnv },
) => TwOfficialLoginBootstrapProviders | Promise<TwOfficialLoginBootstrapProviders>;

export interface TwOfficialLoginBootstrapResult {
  status: "configured" | "fail_closed";
  adapterName: string | null;
  reason?: "missing_adapter" | "adapter_not_approved" | "adapter_not_available" | "provider_incomplete";
}

let runtimeOfficialLoginProvider: TwOfficialLoginProvider | null = null;
let runtimeOfficialLoginOtpProvider: TwOfficialLoginOtpProvider | null = null;

/**
 * Controlled-runtime bootstrap hook. Deployment code may register a provider
 * backed by a secret manager and OTP callback; the runner itself never reads
 * or stores official credentials, cookies, OTPs, or storage state.
 */
export function setTwOfficialLoginProviderForRuntime(provider: TwOfficialLoginProvider | null): void {
  runtimeOfficialLoginProvider = provider;
}

export function setTwOfficialLoginOtpProviderForRuntime(provider: TwOfficialLoginOtpProvider | null): void {
  runtimeOfficialLoginOtpProvider = provider;
}

export async function bootstrapTwOfficialLoginProvidersFromEnvironment(input: {
  env?: NodeJS.ProcessEnv;
  adapters?: Record<string, TwOfficialLoginBootstrapAdapter>;
  approvedAdapterNames?: readonly string[];
  importAdapter?: (moduleRef: string) => Promise<TwOfficialLoginBootstrapAdapter | null>;
} = {}): Promise<TwOfficialLoginBootstrapResult> {
  const env = input.env ?? process.env;
  const adapterName = env.TW_OFFICIAL_LOGIN_ADAPTER?.trim() ?? "";
  if (!adapterName) {
    clearTwOfficialLoginRuntimeProviders();
    return { status: "fail_closed", adapterName: null, reason: "missing_adapter" };
  }

  const approvedAdapterNames = input.approvedAdapterNames ?? readApprovedTwOfficialLoginAdapterNames(env);
  if (!approvedAdapterNames.includes(adapterName)) {
    clearTwOfficialLoginRuntimeProviders();
    return { status: "fail_closed", adapterName, reason: "adapter_not_approved" };
  }

  const adapter =
    input.adapters?.[adapterName] ??
    await loadTwOfficialLoginAdapterFromEnvironment(env, input.importAdapter);
  if (!adapter) {
    clearTwOfficialLoginRuntimeProviders();
    return { status: "fail_closed", adapterName, reason: "adapter_not_available" };
  }

  const providers = await adapter({ adapterName, env });
  if (!providers.officialLoginProvider || !providers.officialLoginOtpProvider) {
    clearTwOfficialLoginRuntimeProviders();
    return { status: "fail_closed", adapterName, reason: "provider_incomplete" };
  }

  runtimeOfficialLoginProvider = providers.officialLoginProvider;
  runtimeOfficialLoginOtpProvider = providers.officialLoginOtpProvider;
  return { status: "configured", adapterName };
}

function readApprovedTwOfficialLoginAdapterNames(env: NodeJS.ProcessEnv): string[] {
  return (env.TW_OFFICIAL_LOGIN_APPROVED_ADAPTERS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

async function loadTwOfficialLoginAdapterFromEnvironment(
  env: NodeJS.ProcessEnv,
  importAdapter?: (moduleRef: string) => Promise<TwOfficialLoginBootstrapAdapter | null>,
): Promise<TwOfficialLoginBootstrapAdapter | null> {
  const moduleRef = env.TW_OFFICIAL_LOGIN_ADAPTER_MODULE?.trim();
  if (!moduleRef) return null;
  const loader = importAdapter ?? importTwOfficialLoginAdapterModule;
  return loader(moduleRef);
}

async function importTwOfficialLoginAdapterModule(moduleRef: string): Promise<TwOfficialLoginBootstrapAdapter | null> {
  const loaded = await import(toImportSpecifier(moduleRef)) as {
    default?: unknown;
    twOfficialLoginBootstrapAdapter?: unknown;
    createTwOfficialLoginBootstrapAdapter?: unknown;
  };
  const candidate =
    loaded.twOfficialLoginBootstrapAdapter ??
    loaded.createTwOfficialLoginBootstrapAdapter ??
    loaded.default;
  return typeof candidate === "function" ? candidate as TwOfficialLoginBootstrapAdapter : null;
}

function toImportSpecifier(moduleRef: string): string {
  if (moduleRef.startsWith("file:") || moduleRef.startsWith(".") || moduleRef.startsWith("@") || isAbsolute(moduleRef)) {
    return moduleRef;
  }
  return moduleRef;
}

function clearTwOfficialLoginRuntimeProviders(): void {
  runtimeOfficialLoginProvider = null;
  runtimeOfficialLoginOtpProvider = null;
}

export function createTwOfficialLoginProvider(input: {
  provider?: TwOfficialLoginProvider | null;
} = {}): TwOfficialLoginProvider {
  return input.provider ?? twFailClosedOfficialLoginProvider;
}

export function createTwOfficialLoginProviderFromEnvironment(): TwOfficialLoginProvider {
  return createTwOfficialLoginProvider({ provider: runtimeOfficialLoginProvider });
}

export function createTwOfficialLoginOtpProvider(input: {
  provider?: TwOfficialLoginOtpProvider | null;
} = {}): TwOfficialLoginOtpProvider {
  return input.provider ?? twFailClosedOfficialLoginOtpProvider;
}

export function createTwOfficialLoginOtpProviderFromEnvironment(): TwOfficialLoginOtpProvider {
  return createTwOfficialLoginOtpProvider({ provider: runtimeOfficialLoginOtpProvider });
}

export interface TwEmailOtpRequest {
  applicantId: string;
  email?: string;
  sentAfter?: Date;
  timeoutMs: number;
}

export interface TwEmailOtpProvider {
  waitForEmailOtp(input: TwEmailOtpRequest): Promise<{ code: string; messageId?: string }>;
}

export class TwInboxEmailOtpProvider implements TwEmailOtpProvider {
  constructor(private readonly options: { markProcessed?: boolean } = {}) {}

  async waitForEmailOtp(input: TwEmailOtpRequest): Promise<{ code: string; messageId?: string }> {
    if (input.email?.trim()) {
      const { code, message } = await waitForTwVerificationCodeToAlias(
        input.email,
        input.timeoutMs,
        input.sentAfter,
        this.options.markProcessed ?? true,
      );
      return { code, messageId: message.id };
    }
    const { code, message } = await waitForTwVerificationCode(input.applicantId, input.timeoutMs);
    return { code, messageId: message.id };
  }
}

async function waitForTwVerificationCodeToAlias(
  alias: string,
  timeoutMs: number,
  sentAfter?: Date,
  markProcessed = true,
): Promise<{ code: string; message: InboundMessage }> {
  const normalizedAlias = alias.trim().toLowerCase();
  await assertInboxAliasDomainRoutable(normalizedAlias);
  const since = (sentAfter ?? new Date(Date.now() - 30 * 60 * 1000)).toISOString();
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { data, error } = await supabase
      .from("inbound_email")
      .select(
        "id, to_addr, from_addr, subject, message_id, text, html, headers, raw_size, r2_key, spam_score, received_at, processed",
      )
      .eq("to_addr", normalizedAlias)
      .eq("processed", false)
      .gte("received_at", since)
      .order("received_at", { ascending: true })
      .limit(20);
    if (error) {
      throw new Error(`tw application inbox poll failed: ${error.message}`);
    }
    for (const message of (data ?? []) as InboundMessage[]) {
      if (!isTwVerificationEmail(message)) continue;
      const code = extractTwVerificationCode(message);
      if (!code) continue;
      if (markProcessed) await markInboundEmailProcessed(message.id);
      return { code, message };
    }
    await sleep(5_000);
  }
  throw new Error(`tw application inbox timeout after ${timeoutMs}ms`);
}

async function markInboundEmailProcessed(messageId: string): Promise<void> {
  const { error } = await supabase
    .from("inbound_email")
    .update({ processed: true, processed_at: new Date().toISOString() })
    .eq("id", messageId);
  if (error) {
    throw new Error(`tw application inbox mark processed failed: ${error.message}`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const twFailClosedOfficialLoginProvider: TwOfficialLoginProvider = {
  async completeLogin(): Promise<TwOfficialLoginResult> {
    throw new TwOfficialLoginConfigurationError(
      "taiwan: official login provider is not configured; refusing to continue before the official portal login",
    );
  },
};

export const twFailClosedOfficialLoginOtpProvider: TwOfficialLoginOtpProvider = {
  async waitForOfficialLoginOtp(): Promise<{ code: string }> {
    throw new TwOfficialLoginConfigurationError(
      "taiwan: official login OTP provider is not configured; refusing to continue official portal login",
    );
  },
};
