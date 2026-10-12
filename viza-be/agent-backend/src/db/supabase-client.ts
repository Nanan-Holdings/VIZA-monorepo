// Load environment variables first
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Get project root and load .env.local (with .env as fallback)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, "../../.env.local") });
dotenv.config({ path: join(__dirname, "../../.env") });

// Polyfill for Node < 18
import "../utils/node17-polyfills.js";

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Logger } from "../utils/logger.js";
import { SuccessfulProbeCache } from "./successful-probe-cache.js";

const logger = new Logger({ serviceName: "SupabaseClient" });

const DEFAULT_PROBE_TIMEOUT_MS = 3_000;
const MAX_PROBE_TIMEOUT_MS = 3_000;
const MIN_EXPLICIT_PROBE_TIMEOUT_MS = 100;
const SUCCESSFUL_PROBE_CACHE_TTL_MS = 5_000;
export const KNOWLEDGE_RELEASE_HEALTH_CACHE_MAX_AGE_MS = 30_000;

type SupabaseEnvironment = NodeJS.ProcessEnv;
type SupabaseUrlEnvName = "SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_URL";

export interface SupabaseRuntimeConfig {
	supabaseUrl: string;
	supabaseUrlEnvName: SupabaseUrlEnvName;
	serviceRoleKey: string;
}

export interface SupabaseConnectionCheck {
	success: boolean;
	message: string;
	latencyMs: number;
	error?: string;
}

export interface ActiveKnowledgeReleaseCheck {
	success: boolean;
	message: string;
	latencyMs: number;
	releaseId: string | null;
	releaseKey: string | null;
	error?: string;
}

const connectionProbeCache = new SuccessfulProbeCache<SupabaseConnectionCheck>(
	SUCCESSFUL_PROBE_CACHE_TTL_MS,
);
const knowledgeReleaseProbeCache =
	new SuccessfulProbeCache<ActiveKnowledgeReleaseCheck>(
		SUCCESSFUL_PROBE_CACHE_TTL_MS,
	);

function readFirstEnv(
	env: SupabaseEnvironment,
	names: readonly SupabaseUrlEnvName[],
): { name: SupabaseUrlEnvName; value: string } | null {
	for (const name of names) {
		const value = env[name]?.trim();
		if (value) return { name, value };
	}
	return null;
}

/**
 * Resolve the server-side URL first, while retaining the client-prefixed name
 * for local environments that have not migrated yet.
 */
export function readSupabaseRuntimeConfig(
	env: SupabaseEnvironment = process.env,
): SupabaseRuntimeConfig {
	const supabaseUrl = readFirstEnv(env, ["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"]);
	const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
	const missingVars: string[] = [];

	if (!supabaseUrl) missingVars.push("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL");
	if (!serviceRoleKey) missingVars.push("SUPABASE_SERVICE_ROLE_KEY");

	if (!supabaseUrl || !serviceRoleKey) {
		throw new Error(`Missing required environment variables: ${missingVars.join(", ")}`);
	}

	return {
		supabaseUrl: supabaseUrl.value,
		supabaseUrlEnvName: supabaseUrl.name,
		serviceRoleKey,
	};
}

function boundedProbeTimeoutMs(timeoutMs: number): number {
	if (!Number.isFinite(timeoutMs)) return DEFAULT_PROBE_TIMEOUT_MS;
	return Math.min(
		Math.max(Math.floor(timeoutMs), MIN_EXPLICIT_PROBE_TIMEOUT_MS),
		MAX_PROBE_TIMEOUT_MS,
	);
}

function createProbeSignal(timeoutMs: number): {
	controller: AbortController;
	timer: NodeJS.Timeout;
} {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), boundedProbeTimeoutMs(timeoutMs));
	return { controller, timer };
}

/**
 * Supabase client singleton for REST API access
 * This is a workaround for direct PostgreSQL connection issues
 */
let supabaseClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
	if (supabaseClient) {
		return supabaseClient;
	}

	let config: SupabaseRuntimeConfig;
	try {
		config = readSupabaseRuntimeConfig();
	} catch (error) {
		logger.error(
			"supabase_client_missing_env",
			error as Error,
		);
		throw error;
	}

	logger.info("supabase_client_initializing", {
		url: config.supabaseUrl,
		urlEnvName: config.supabaseUrlEnvName,
		keyType: "service_role",
	});

	supabaseClient = createClient(config.supabaseUrl, config.serviceRoleKey, {
		auth: {
			persistSession: false,
			autoRefreshToken: false,
		},
	});

	logger.info("supabase_client_initialized", { url: config.supabaseUrl });

	return supabaseClient;
}

/**
 * Test the Supabase connection by querying a simple table
 */

async function runSupabaseConnectionProbe(
	timeoutMs = Number(process.env.READINESS_DB_TIMEOUT_MS ?? DEFAULT_PROBE_TIMEOUT_MS),
): Promise<SupabaseConnectionCheck> {
	const startedAt = Date.now();
	const { controller, timer } = createProbeSignal(timeoutMs);
	try {
		const client = getSupabaseClient();

		// Confirm the core relation is reachable without an exact table count or
		// returning applicant rows to the process.
		const { error } = await client
			.from("applicant_profiles")
			.select("id", { head: true })
			.limit(1)
			.abortSignal(controller.signal);

		if (error) {
			logger.error("supabase_connection_test_failed", error, {
				error: error.message,
			});
			return {
				success: false,
				message: `Supabase connection failed: ${error.message}`,
				latencyMs: Date.now() - startedAt,
				error: error.message,
			};
		}

		logger.info("supabase_connection_test_success");
		return {
			success: true,
			message: "Supabase connection successful.",
			latencyMs: Date.now() - startedAt,
		};
	} catch (error) {
		logger.error("supabase_connection_test_error", error as Error);
		return {
			success: false,
			message: `Supabase connection failed: ${(error as Error).message}`,
			latencyMs: Date.now() - startedAt,
			error: (error as Error).message,
		};
	} finally {
		clearTimeout(timer);
	}
}

export async function testSupabaseConnection(
	timeoutMs = Number(process.env.READINESS_DB_TIMEOUT_MS ?? DEFAULT_PROBE_TIMEOUT_MS),
): Promise<SupabaseConnectionCheck> {
	return connectionProbeCache.getOrCreate(() =>
		runSupabaseConnectionProbe(timeoutMs),
	);
}

/**
 * Probe the release metadata used by the legacy health response. The request
 * uses the same abort-bounded Supabase client as readiness checks so a stalled
 * REST connection cannot hold an HTTP health probe open indefinitely.
 */
async function runActiveKnowledgeReleaseProbe(
	timeoutMs = Number(process.env.READINESS_DB_TIMEOUT_MS ?? DEFAULT_PROBE_TIMEOUT_MS),
): Promise<ActiveKnowledgeReleaseCheck> {
	const startedAt = Date.now();
	const { controller, timer } = createProbeSignal(timeoutMs);
	try {
		const { data, error } = await getSupabaseClient()
			.from("visa_knowledge_releases")
			.select("id, release_key")
			.eq("status", "active")
			.order("activated_at", { ascending: false })
			.limit(1)
			.abortSignal(controller.signal)
			.maybeSingle();

		if (error) {
			return {
				success: false,
				message: `Supabase connection failed: ${error.message}`,
				latencyMs: Date.now() - startedAt,
				releaseId: null,
				releaseKey: null,
				error: error.message,
			};
		}

		return {
			success: true,
			message: "Supabase connection successful.",
			latencyMs: Date.now() - startedAt,
			releaseId: data?.id ?? null,
			releaseKey: data?.release_key ?? null,
		};
	} catch (error) {
		const message = (error as Error).message;
		return {
			success: false,
			message: `Supabase connection failed: ${message}`,
			latencyMs: Date.now() - startedAt,
			releaseId: null,
			releaseKey: null,
			error: message,
		};
	} finally {
		clearTimeout(timer);
	}
}

export async function testActiveKnowledgeRelease(
	timeoutMs = Number(process.env.READINESS_DB_TIMEOUT_MS ?? DEFAULT_PROBE_TIMEOUT_MS),
	maxAgeMs = SUCCESSFUL_PROBE_CACHE_TTL_MS,
): Promise<ActiveKnowledgeReleaseCheck> {
	return knowledgeReleaseProbeCache.getOrCreate(
		() => runActiveKnowledgeReleaseProbe(timeoutMs),
		maxAgeMs,
	);
}

export function clearSupabaseProbeCachesForTests(): void {
	connectionProbeCache.clear();
	knowledgeReleaseProbeCache.clear();
}
