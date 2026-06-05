"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ChevronRight,
  CreditCard,
  Search,
} from "lucide-react";
import type { PayPerItem, PayPerRegion } from "./pay-per-types";

interface PayPerApplicationBrowserProps {
  isZh: boolean;
  regions: PayPerRegion[];
  labels: {
    searchPlaceholder: string;
    searchResults: string;
    noResults: string;
    chooseRegion: string;
    itemSuffix: string;
  };
}

function OnlinePayLink({ productId }: { productId: string }) {
  return (
    <Link
      href={`/payments/checkout?productId=${encodeURIComponent(productId)}&billing=one_time`}
      className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-brand-500 bg-white px-4 py-2 text-sm font-semibold text-brand-500 transition hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    >
      <CreditCard className="h-4 w-4" />
      在线付
    </Link>
  );
}

export function PayPerRow({
  item,
  isZh,
}: {
  item: PayPerItem;
  isZh: boolean;
}) {
  return (
    <div className="grid gap-3 rounded-lg border bg-background px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">
          {isZh ? item.nameZh : item.name}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {isZh ? item.visaNameZh : item.visaName} · {item.amountLabel}
        </p>
      </div>
      <div className="min-w-[140px]">
        <OnlinePayLink productId={item.productId} />
      </div>
    </div>
  );
}

export function PayPerApplicationBrowser({
  isZh,
  regions,
  labels,
}: PayPerApplicationBrowserProps) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();

  const allItems = useMemo(() => regions.flatMap((region) => region.items), [regions]);
  const searchResults = useMemo(() => {
    if (!normalizedQuery) return [];
    return allItems.filter((item) => item.searchText.includes(normalizedQuery));
  }, [allItems, normalizedQuery]);

  const showingSearch = normalizedQuery.length > 0;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={labels.searchPlaceholder}
            className="h-12 w-full rounded-full border bg-background pl-11 pr-4 text-base outline-none transition focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          />
        </label>
      </div>

      {showingSearch ? (
        <section className="rounded-xl border bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-foreground">{labels.searchResults}</h3>
            <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-500">
              {searchResults.length} {labels.itemSuffix}
            </span>
          </div>
          <div className="mt-4 grid gap-3">
            {searchResults.map((item) => (
              <PayPerRow key={item.id} item={item} isZh={isZh} />
            ))}
          </div>
          {searchResults.length === 0 ? (
            <p className="mt-4 rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
              {labels.noResults}
            </p>
          ) : null}
        </section>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {regions.map((region) => {
              return (
                <Link
                  key={region.id}
                  href={region.href}
                  className="min-h-32 rounded-xl border bg-white p-5 text-left shadow-sm transition hover:border-brand-300 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-2xl" aria-hidden>
                      {region.flag}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-500">
                      {region.items.length} {labels.itemSuffix}
                      <ChevronRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-foreground">
                    {isZh ? region.nameZh : region.name}
                  </h3>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
                    {isZh ? region.descriptionZh : region.description}
                  </p>
                </Link>
              );
            })}
          </div>

          <p className="rounded-lg border bg-brand-50 p-4 text-sm leading-6 text-brand-900">
            {labels.chooseRegion}
          </p>
        </>
      )}
    </div>
  );
}
