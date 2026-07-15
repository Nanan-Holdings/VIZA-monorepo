export type BrowserbaseRegion =
  | "us-west-2"
  | "us-east-1"
  | "eu-central-1"
  | "ap-southeast-1";

export interface BrowserbaseCloudSession {
  id: string;
  connectUrl: string;
  replayUrl: string;
  proxiesEnabled: boolean;
}

export class BrowserbaseSessionError extends Error {
  readonly code = "browserbase_session_create_failed";

  constructor(message: string) {
    super(message);
    this.name = "BrowserbaseSessionError";
  }
}

interface BrowserbaseCreateResponse {
  id?: unknown;
  connectUrl?: unknown;
}

type FetchLike = (
  input: string | URL | globalThis.Request,
  init?: RequestInit,
) => Promise<Response>;

function readBoolean(name: string, fallback: boolean): boolean {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) return fallback;
  return value !== "false" && value !== "0" && value !== "no";
}

function readRegion(name: string): BrowserbaseRegion {
  const value = process.env[name]?.trim() || "ap-southeast-1";
  if (
    value === "us-west-2" ||
    value === "us-east-1" ||
    value === "eu-central-1" ||
    value === "ap-southeast-1"
  ) {
    return value;
  }
  throw new BrowserbaseSessionError(`${name} is not a supported Browserbase region.`);
}

function safeCreateFailure(status: number): string {
  if (status === 401 || status === 403) {
    return "Browserbase rejected the configured API key or account permissions.";
  }
  if (status === 402) {
    return "Browserbase proxies require a paid Developer plan or higher.";
  }
  if (status === 429) {
    return "Browserbase session concurrency or rate limit was reached.";
  }
  return `Browserbase session creation failed with HTTP ${status}.`;
}

export function browserbaseEnabled(prefix: string): boolean {
  return readBoolean(`${prefix}_BROWSERBASE_ENABLED`, false);
}

export async function createBrowserbaseCloudSession(options: {
  prefix: string;
  fetchImpl?: FetchLike;
}): Promise<BrowserbaseCloudSession> {
  const apiKey = process.env.BROWSERBASE_API_KEY?.trim();
  if (!apiKey) {
    throw new BrowserbaseSessionError(
      `${options.prefix}_BROWSERBASE_ENABLED is true but BROWSERBASE_API_KEY is missing.`,
    );
  }

  const proxiesEnabled = readBoolean(`${options.prefix}_BROWSERBASE_PROXIES`, true);
  const region = readRegion(`${options.prefix}_BROWSERBASE_REGION`);
  const country = process.env[`${options.prefix}_BROWSERBASE_COUNTRY`]?.trim().toUpperCase() || "MY";
  if (!/^[A-Z]{2}$/.test(country)) {
    throw new BrowserbaseSessionError(
      `${options.prefix}_BROWSERBASE_COUNTRY must be a two-letter country code.`,
    );
  }

  const body: Record<string, unknown> = {
    keepAlive: false,
    region,
    userMetadata: {
      service: "viza-submission-service",
      runner: options.prefix.toLowerCase(),
    },
  };
  if (proxiesEnabled) {
    body.proxies = [
      {
        type: "browserbase",
        geolocation: { country },
      },
    ];
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl("https://api.browserbase.com/v1/sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-BB-API-Key": apiKey,
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new BrowserbaseSessionError("Browserbase session API was not reachable.");
  }

  if (!response.ok) {
    throw new BrowserbaseSessionError(safeCreateFailure(response.status));
  }

  const payload = await response.json() as BrowserbaseCreateResponse;
  if (typeof payload.id !== "string" || typeof payload.connectUrl !== "string") {
    throw new BrowserbaseSessionError("Browserbase returned an invalid session response.");
  }

  return {
    id: payload.id,
    connectUrl: payload.connectUrl,
    replayUrl: `https://www.browserbase.com/sessions/${payload.id}`,
    proxiesEnabled,
  };
}
