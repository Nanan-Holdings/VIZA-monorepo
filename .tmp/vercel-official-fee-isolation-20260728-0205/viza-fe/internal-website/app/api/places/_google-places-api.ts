import {
  isSupportedGoogleAttractionType,
  type SupportedGoogleAttractionType,
} from "@/lib/travel/google-places";

export const GOOGLE_PLACES_BASE_URL = "https://places.googleapis.com/v1";
export const GOOGLE_PLACES_MISSING_KEY_MESSAGE =
  "Missing GOOGLE_MAPS_API_KEY. Configure it on the server to use Google Places.";

export type GoogleApiErrorPayload = {
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
};

export class GooglePlacesApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly googleStatus?: string
  ) {
    super(message);
    this.name = "GooglePlacesApiError";
  }
}

const inFlightRequests = new Map<string, Promise<unknown>>();

export function getGooglePlacesApiKey(): string {
  return process.env.GOOGLE_MAPS_API_KEY?.trim() ?? "";
}

export function normalizePlacesLanguage(value: string | null): string {
  const normalized = value?.trim();
  if (!normalized) return "zh-CN";
  if (/^zh\b/i.test(normalized)) return "zh-CN";
  if (/^en\b/i.test(normalized)) return "en";
  return normalized;
}

export function parseBoundedInteger(
  value: string | null,
  options: { defaultValue: number; min: number; max: number }
): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) return options.defaultValue;
  return Math.min(Math.max(parsed, options.min), options.max);
}

export function parseFiniteNumber(value: string | null): number | null {
  if (!value?.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseAttractionTypes(value: string | null): {
  types: SupportedGoogleAttractionType[];
  invalidTypes: string[];
} {
  const rawTypes = (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const uniqueTypes = Array.from(new Set(rawTypes));
  const types: SupportedGoogleAttractionType[] = [];
  const invalidTypes: string[] = [];

  uniqueTypes.forEach((type) => {
    if (isSupportedGoogleAttractionType(type)) {
      types.push(type);
      return;
    }
    invalidTypes.push(type);
  });

  return { types, invalidTypes };
}

export function normalizeGooglePhotoName(name: string | null): string | null {
  const trimmed = name?.trim();
  if (!trimmed) return null;
  if (!trimmed.startsWith("places/") || !trimmed.includes("/photos/")) {
    return null;
  }
  return trimmed.replace(/\/media$/, "");
}

export function encodeGoogleResourcePath(resourceName: string): string {
  return resourceName.split("/").map(encodeURIComponent).join("/");
}

export async function parseGoogleError(
  response: Response
): Promise<GooglePlacesApiError> {
  const payload = (await response.json().catch(() => null)) as
    | GoogleApiErrorPayload
    | null;
  const googleMessage = payload?.error?.message;
  const googleStatus = payload?.error?.status;
  const safeMessage = googleMessage
    ? `Google Places API returned HTTP ${response.status}: ${googleMessage}`
    : `Google Places API returned HTTP ${response.status}.`;

  return new GooglePlacesApiError(safeMessage, response.status, googleStatus);
}

export async function runInFlightDeduped<T>(
  key: string,
  task: () => Promise<T>
): Promise<T> {
  const existing = inFlightRequests.get(key);
  if (existing) return existing as Promise<T>;

  const promise = task();
  inFlightRequests.set(key, promise);
  try {
    return await promise;
  } finally {
    inFlightRequests.delete(key);
  }
}
