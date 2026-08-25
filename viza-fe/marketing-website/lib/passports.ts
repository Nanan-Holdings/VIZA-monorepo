"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Shared passport catalogue + selection persistence for the marketing site.
 *
 * Both the explore page and `SiteNav` render the passport pill, and the visitor
 * expects the passport they picked to survive navigating into a country page and
 * back (previously each mount reset to Singapore). The choice is mirrored into
 * `localStorage` and broadcast so every mounted pill stays in sync.
 *
 * Destination counts are indicative travel-document rankings, not a promise about
 * any individual traveller's eligibility — the UI footnote names the source.
 */

export interface PassportEntry {
  /** ISO 3166-1 alpha-2 (also the circle-flags asset code, lowercased). */
  code: string;
  /** Destinations reachable visa-free. */
  free: number;
  /** Destinations offering visa-on-arrival or an e-visa. */
  voa: number;
  /** Destinations requiring an embassy visa in advance. */
  req: number;
  /** Published global ranking, for display only. */
  rank: string;
}

export const PASSPORTS: PassportEntry[] = [
  { code: "SG", free: 157, voa: 29, req: 9, rank: "#1" },
  { code: "JP", free: 154, voa: 30, req: 11, rank: "#2" },
  { code: "KR", free: 152, voa: 31, req: 12, rank: "#3" },
  { code: "DE", free: 153, voa: 28, req: 14, rank: "#3" },
  { code: "FR", free: 151, voa: 29, req: 15, rank: "#4" },
  { code: "GB", free: 148, voa: 30, req: 17, rank: "#5" },
  { code: "US", free: 145, voa: 31, req: 19, rank: "#6" },
  { code: "AU", free: 144, voa: 32, req: 19, rank: "#6" },
  { code: "CA", free: 144, voa: 31, req: 20, rank: "#7" },
  { code: "AE", free: 132, voa: 38, req: 25, rank: "#11" },
  { code: "MY", free: 124, voa: 35, req: 36, rank: "#13" },
  { code: "HK", free: 141, voa: 30, req: 24, rank: "#17" },
  { code: "BR", free: 134, voa: 26, req: 35, rank: "#15" },
  { code: "MO", free: 115, voa: 29, req: 51, rank: "#33" },
  { code: "TW", free: 113, voa: 28, req: 54, rank: "#34" },
  { code: "CN", free: 85, voa: 32, req: 78, rank: "#60" },
  { code: "TH", free: 81, voa: 32, req: 82, rank: "#62" },
  { code: "ID", free: 76, voa: 30, req: 89, rank: "#67" },
  { code: "PH", free: 67, voa: 30, req: 98, rank: "#73" },
  { code: "IN", free: 58, voa: 28, req: 109, rank: "#80" },
];

export const DEFAULT_PASSPORT_CODE = "SG";

const STORAGE_KEY = "viza.passport";
/** Fired on the window so every mounted passport pill re-reads the selection. */
const SYNC_EVENT = "viza:passport-change";

export function passportByCode(code: string): PassportEntry {
  return PASSPORTS.find((p) => p.code === code) ?? PASSPORTS[0];
}

function readStored(): string | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw && PASSPORTS.some((p) => p.code === raw) ? raw : null;
  } catch {
    // Private mode / storage disabled — fall back to the in-memory default.
    return null;
  }
}

/**
 * Selected passport code, restored from `localStorage` after mount.
 *
 * The first render deliberately returns the default so the server and client
 * markup match; the stored value is applied in an effect.
 */
export function usePassportSelection(): [string, (code: string) => void] {
  const [code, setCode] = useState(DEFAULT_PASSPORT_CODE);

  useEffect(() => {
    const stored = readStored();
    if (stored) setCode(stored);

    const onSync = () => {
      const next = readStored();
      if (next) setCode(next);
    };
    window.addEventListener(SYNC_EVENT, onSync);
    window.addEventListener("storage", onSync);
    return () => {
      window.removeEventListener(SYNC_EVENT, onSync);
      window.removeEventListener("storage", onSync);
    };
  }, []);

  const select = useCallback((next: string) => {
    setCode(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Non-fatal: the selection still applies for this page view.
    }
    window.dispatchEvent(new Event(SYNC_EVENT));
  }, []);

  return [code, select];
}
