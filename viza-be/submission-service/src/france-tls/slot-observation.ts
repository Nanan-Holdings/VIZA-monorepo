import type { Page } from "@playwright/test";
import { resolveFranceTlsCenter } from "./center-registry";
import { FRANCE_TLS_SELECTORS } from "./selectors";

export type FranceTlsSlotObservationStatus =
  | "slots_observed"
  | "no_slots_available"
  | "selector_drift";

export interface FranceTlsSlotDomRecord {
  /** Text from one official slot container only; never the whole page. */
  text: string;
  date?: string | null;
  time?: string | null;
  /** Provider-issued identifier from data-slot-id/data-appointment-id. */
  providerSlotId?: string | null;
  location?: string | null;
  appointmentType?: string | null;
}

export interface FranceTlsObservedSlot {
  appointmentDate: string;
  appointmentTime: string;
  appointmentLocation: string;
  appointmentType: string;
  source: string;
  metadataRedactedJson: Record<string, unknown>;
}

export interface FranceTlsSlotObservation {
  status: FranceTlsSlotObservationStatus;
  slots: FranceTlsObservedSlot[];
  invalidRecordCount: number;
}

const NO_SLOTS_MARKER = /no\s+(?:appointments?|slots?|times?)\s+(?:are\s+)?available|no\s+availability|aucun(?:e)?\s+cr[ée]neau|aucun\s+rendez-vous|indisponible|pas\s+de\s+créneau/iu;
// Provider ids are opaque (some deployments use UUIDs, others use URL-safe
// or base64-like values). Preserve them exactly while rejecting whitespace and
// unbounded DOM text that could leak unrelated page content.
const SAFE_PROVIDER_SLOT_ID = /^\S{1,256}$/u;

function normalizeDate(value: string | null | undefined): string | null {
  const candidate = value?.replace(/\s+/gu, " ").trim() ?? "";
  if (!candidate) return null;

  const iso = candidate.match(/\b(20\d{2})[-/.](0?[1-9]|1[0-2])[-/.](0?[1-9]|[12]\d|3[01])\b/u);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;

  const dmy = candidate.match(/\b(0?[1-9]|[12]\d|3[01])[-/.](0?[1-9]|1[0-2])[-/.](20\d{2})\b/u);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;

  const monthNames: Record<string, string> = {
    jan: "01", january: "01", janvier: "01",
    feb: "02", february: "02", février: "02", fevrier: "02",
    mar: "03", march: "03", mars: "03",
    apr: "04", april: "04", avril: "04",
    may: "05", mai: "05",
    jun: "06", june: "06", juin: "06",
    jul: "07", july: "07", juillet: "07",
    aug: "08", august: "08", août: "08", aout: "08",
    sep: "09", sept: "09", september: "09", septembre: "09",
    oct: "10", october: "10", octobre: "10",
    nov: "11", november: "11", novembre: "11",
    dec: "12", december: "12", décembre: "12", decembre: "12",
  };
  const monthFirst = candidate.match(/\b([A-Za-zÀ-ÿ]+)\s+(0?[1-9]|[12]\d|3[01]),?\s+(20\d{2})\b/u);
  if (monthFirst) {
    const month = monthNames[monthFirst[1].toLowerCase()];
    if (month) return `${monthFirst[3]}-${month}-${monthFirst[2].padStart(2, "0")}`;
  }
  const dayFirst = candidate.match(/\b(0?[1-9]|[12]\d|3[01])\s+([A-Za-zÀ-ÿ]+)\s+(20\d{2})\b/u);
  if (dayFirst) {
    const month = monthNames[dayFirst[2].toLowerCase()];
    if (month) return `${dayFirst[3]}-${month}-${dayFirst[1].padStart(2, "0")}`;
  }
  return null;
}

function normalizeTime(value: string | null | undefined): string | null {
  const candidate = value?.replace(/\s+/gu, " ").trim() ?? "";
  if (!candidate) return null;
  const match = candidate.match(/\b([01]?\d|2[0-3])\s*[:hH]\s*([0-5]\d)\b/u);
  if (!match) return null;
  const normalized = `${match[1].padStart(2, "0")}:${match[2]}`;
  // 00:00 was historically a synthetic fallback. Do not persist it even if
  // an unrelated page text happens to contain that value.
  return normalized === "00:00" ? null : normalized;
}

function firstDate(record: FranceTlsSlotDomRecord): string | null {
  return normalizeDate(record.date) ?? normalizeDate(record.text);
}

function firstTime(record: FranceTlsSlotDomRecord): string | null {
  return normalizeTime(record.time) ?? normalizeTime(record.text);
}

/**
 * Convert one-record-per-slot DOM data into safe observations. Date and time
 * are intentionally resolved within the same record; this function never
 * combines page-level date and time lists.
 */
export function extractFranceTlsSlotsFromDom(
  records: readonly FranceTlsSlotDomRecord[],
  centerCode: string,
  options: { noSlotsText?: string; observedAt?: Date; ttlMs?: number } = {},
): FranceTlsSlotObservation {
  const center = resolveFranceTlsCenter(centerCode);
  if (!center) return { status: "selector_drift", slots: [], invalidRecordCount: records.length };

  const observedAt = options.observedAt ?? new Date();
  const ttlMs = options.ttlMs ?? 10 * 60 * 1000;
  const expiresAt = new Date(observedAt.getTime() + Math.max(1, ttlMs));
  const slots: FranceTlsObservedSlot[] = [];
  const seen = new Set<string>();
  let invalidRecordCount = 0;

  for (const record of records) {
    const providerSlotId = record.providerSlotId?.trim() ?? "";
    const date = firstDate(record);
    const time = firstTime(record);
    if (!SAFE_PROVIDER_SLOT_ID.test(providerSlotId) || !date || !time) {
      invalidRecordCount += 1;
      continue;
    }
    const key = `${providerSlotId}|${date}|${time}`;
    if (seen.has(key)) continue;
    seen.add(key);
    slots.push({
      appointmentDate: date,
      appointmentTime: time,
      appointmentLocation: record.location?.trim() || `TLScontact ${center.cityEn}`,
      appointmentType: record.appointmentType?.trim() || "France Schengen visa application submission",
      source: "france_tls_live",
      metadataRedactedJson: {
        centerCode: center.code,
        provider: center.provider,
        providerSlotId,
        observedAt: observedAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
        observedFromOfficialPage: true,
      },
    });
  }

  if (slots.length > 0) {
    return { status: "slots_observed", slots, invalidRecordCount };
  }
  if (invalidRecordCount === 0 && NO_SLOTS_MARKER.test(options.noSlotsText ?? "")) {
    return { status: "no_slots_available", slots: [], invalidRecordCount };
  }
  return { status: "selector_drift", slots: [], invalidRecordCount };
}

/**
 * Read only supported slot containers. The locator is deliberately narrow:
 * generic buttons, calendar headers, and page-level date/time text are not
 * candidates and therefore cannot create synthetic combinations.
 */
export async function readFranceTlsSlotDomRecords(page: Page): Promise<FranceTlsSlotDomRecord[]> {
  const locator = page.locator(FRANCE_TLS_SELECTORS.slotContainers);
  return locator.evaluateAll((elements) => elements.map((element) => {
    const source = element as HTMLElement;
    const descendants = [source, ...Array.from(source.querySelectorAll<HTMLElement>("[data-date], [data-slot-date], [data-time], [data-slot-time], [data-slot-id], [data-provider-slot-id], [data-appointment-id]"))];
    const firstAttribute = (names: string[]): string | null => {
      for (const candidate of descendants) {
        for (const name of names) {
          const value = candidate.getAttribute(name)?.trim();
          if (value) return value;
        }
      }
      return null;
    };
    return {
      text: (source.innerText || source.textContent || "").replace(/\s+/gu, " ").trim(),
      date: firstAttribute(["data-date", "data-slot-date", "data-appointment-date"]),
      time: firstAttribute(["data-time", "data-slot-time", "data-appointment-time"]),
      providerSlotId: firstAttribute(["data-slot-id", "data-provider-slot-id", "data-appointment-id"]),
      location: firstAttribute(["data-location", "data-center", "data-vac"]),
      appointmentType: firstAttribute(["data-appointment-type", "data-service"]),
    } satisfies FranceTlsSlotDomRecord;
  }));
}

export function franceTlsNoSlotsMarker(text: string): boolean {
  return NO_SLOTS_MARKER.test(text);
}
