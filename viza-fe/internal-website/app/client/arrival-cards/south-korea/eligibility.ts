export type KoreaArrivalEligibility = "needs_declaration" | "exempt" | "uncertain";

export const KOREA_ARRIVAL_PREFLIGHT_STORAGE_KEY = "viza:korea-e-arrival-card-preflight";

export type KoreaArrivalPreflightMarker = {
  version: 1;
  country: "south_korea";
  visaType: "KR_E_ARRIVAL_CARD";
  eligibility: "needs_declaration";
  adultRepresentative: boolean;
  completedAt: number;
};

function parseIsoDate(value: string | null | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? date
    : null;
}

function seoulToday(now: Date): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: "year" | "month" | "day") => Number(parts.find((part) => part.type === type)?.value ?? NaN);
  return new Date(Date.UTC(get("year"), get("month") - 1, get("day")));
}

export function ageAtSeoulDate(
  dateOfBirth: string | null | undefined,
  now: Date = new Date(),
): number | null {
  const birth = parseIsoDate(dateOfBirth);
  if (!birth) return null;
  const today = seoulToday(now);
  let age = today.getUTCFullYear() - birth.getUTCFullYear();
  const birthdayNotReached =
    today.getUTCMonth() < birth.getUTCMonth() ||
    (today.getUTCMonth() === birth.getUTCMonth() && today.getUTCDate() < birth.getUTCDate());
  if (birthdayNotReached) age -= 1;
  return age >= 0 ? age : null;
}

export function requiresAdultRepresentative(
  dateOfBirth: string | null | undefined,
  now: Date = new Date(),
): boolean {
  const age = ageAtSeoulDate(dateOfBirth, now);
  return age !== null && age < 14;
}

export function canContinueKoreaArrivalPreflight(input: {
  eligibility: KoreaArrivalEligibility | null;
  dateOfBirth: string | null | undefined;
  adultRepresentativeConfirmed: boolean;
  now?: Date;
}): boolean {
  if (input.eligibility !== "needs_declaration") return false;
  const age = ageAtSeoulDate(input.dateOfBirth, input.now);
  if (age === null) return false;
  return age >= 14 || input.adultRepresentativeConfirmed;
}

export function isKoreaArrivalPreflightMarker(value: unknown): value is KoreaArrivalPreflightMarker {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const marker = value as Partial<KoreaArrivalPreflightMarker>;
  return (
    marker.version === 1 &&
    marker.country === "south_korea" &&
    marker.visaType === "KR_E_ARRIVAL_CARD" &&
    marker.eligibility === "needs_declaration" &&
    typeof marker.adultRepresentative === "boolean" &&
    typeof marker.completedAt === "number" &&
    Number.isFinite(marker.completedAt)
  );
}
