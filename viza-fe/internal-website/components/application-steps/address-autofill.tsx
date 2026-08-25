"use client";

import { useState } from "react";
import { MagicWand, CircleNotch } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

/**
 * "Work out the state and city from this address" helper.
 *
 * Hotel confirmations and booking sites routinely give a street and a postcode and
 * nothing else, while the official form insists on a state and a city — so
 * applicants were guessing, or filling the state with the city name. This resolves
 * the address (or a postal code, or a hotel name) through Google Places and hands
 * the administrative parts back to the caller to apply.
 *
 * It never writes anything itself, and it never overwrites silently: the caller
 * decides which fields to fill, and the applicant can always edit afterwards.
 */

export interface ResolvedAddressParts {
  formattedAddress: string;
  state: string;
  city: string;
  postalCode: string;
  country: string;
  countryCode: string;
}

interface Props {
  /** Current address text, a postal code, or a hotel/property name. */
  query: string;
  /** Country name to bias the search, e.g. "Malaysia". */
  countryHint?: string | null;
  locale: string;
  isChineseInterface: boolean;
  disabled?: boolean;
  onResolved: (parts: ResolvedAddressParts) => void;
}

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "applied"; summary: string }
  | { kind: "error"; message: string };

const MIN_QUERY_LENGTH = 3;

export function AddressAutofill({
  query,
  countryHint,
  locale,
  isChineseInterface,
  disabled,
  onResolved,
}: Props) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const trimmed = query.trim();
  const canLookup = trimmed.length >= MIN_QUERY_LENGTH && !disabled;

  const label = isChineseInterface ? "自动填写州/城市" : "Fill state & city";
  const busyLabel = isChineseInterface ? "正在查询…" : "Looking up…";

  async function lookup() {
    if (!canLookup || status.kind === "loading") return;
    setStatus({ kind: "loading" });
    try {
      const response = await fetch("/api/places/resolve-address", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmed, countryHint, locale }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        result?: ResolvedAddressParts | null;
        error?: string;
      };

      if (!payload.ok || !payload.result) {
        setStatus({
          kind: "error",
          message: isChineseInterface
            ? "没有找到匹配的地址，请手动填写。"
            : "No matching address found — please fill these in manually.",
        });
        return;
      }

      const parts = payload.result;
      if (!parts.state && !parts.city && !parts.postalCode) {
        setStatus({
          kind: "error",
          message: isChineseInterface
            ? "找到了这个地点，但没有返回州/城市信息。"
            : "Found the place, but it returned no state or city.",
        });
        return;
      }

      onResolved(parts);
      const summary = [parts.state, parts.city, parts.postalCode].filter(Boolean).join(" · ");
      setStatus({ kind: "applied", summary });
    } catch {
      setStatus({
        kind: "error",
        message: isChineseInterface ? "查询失败，请稍后再试。" : "Lookup failed — try again shortly.",
      });
    }
  }

  return (
    <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
      {status.kind === "applied" && (
        <span className="text-[13px] font-medium text-emerald-700">
          {isChineseInterface ? `已填入：${status.summary}` : `Filled in: ${status.summary}`}
        </span>
      )}
      {status.kind === "error" && (
        <span className="text-[13px] font-medium text-amber-700">{status.message}</span>
      )}
      <button
        type="button"
        onClick={lookup}
        disabled={!canLookup || status.kind === "loading"}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border border-border-hairline bg-white px-3 py-1.5",
          "text-[13px] font-medium text-brand-500 transition-colors",
          "hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50",
        )}
      >
        {status.kind === "loading" ? (
          <CircleNotch className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <MagicWand className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        {status.kind === "loading" ? busyLabel : label}
      </button>
    </div>
  );
}
