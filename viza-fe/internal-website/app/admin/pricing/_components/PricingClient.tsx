"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setPricingOverride, type PricingRow } from "@/app/actions/package-pricing";

interface PricingClientProps {
  initialRows: PricingRow[];
}

interface DraftMap {
  governmentFeeCents: number;
  agencyFeeCents: number;
  overrideDays: number;
  reason: string;
}

export function PricingClient({ initialRows }: PricingClientProps) {
  const [rows, setRows] = useState(initialRows);
  const [drafts, setDrafts] = useState<Record<string, DraftMap>>(() => {
    const seed: Record<string, DraftMap> = {};
    for (const r of initialRows) {
      seed[r.id] = {
        governmentFeeCents: r.government_fee_cents,
        agencyFeeCents: r.agency_fee_cents,
        overrideDays: 14,
        reason: "",
      };
    }
    return seed;
  });
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const updateDraft = (id: string, patch: Partial<DraftMap>): void => {
    setDrafts((cur) => ({ ...cur, [id]: { ...cur[id], ...patch } }));
  };

  const submit = (row: PricingRow): void => {
    const draft = drafts[row.id];
    setPendingId(row.id);
    setError(null);
    startTransition(async () => {
      const res = await setPricingOverride({
        visaPackageId: row.visa_package_id,
        currency: row.currency,
        governmentFeeCents: draft.governmentFeeCents,
        agencyFeeCents: draft.agencyFeeCents,
        overrideDays: draft.overrideDays,
        reason: draft.reason,
      });
      if (!res.ok) {
        setError(res.reason ?? "Save failed");
      } else {
        setRows((cur) =>
          cur.map((r) =>
            r.id === row.id
              ? {
                  ...r,
                  government_fee_cents: draft.governmentFeeCents,
                  agency_fee_cents: draft.agencyFeeCents,
                  override_reason: draft.reason,
                  source: "staff_override",
                }
              : r,
          ),
        );
      }
      setPendingId(null);
    });
  };

  return (
    <div className="space-y-3">
      {error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>
      ) : null}
      <div className="overflow-hidden rounded-xl border border-input bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-[#fafafa] text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Package</th>
              <th className="px-3 py-2 text-left font-semibold">Currency</th>
              <th className="px-3 py-2 text-left font-semibold">Gov fee (cents)</th>
              <th className="px-3 py-2 text-left font-semibold">Agency fee (cents)</th>
              <th className="px-3 py-2 text-left font-semibold">Override (days)</th>
              <th className="px-3 py-2 text-left font-semibold">Reason</th>
              <th className="px-3 py-2 text-right font-semibold">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const draft = drafts[r.id];
              return (
                <tr key={r.id} className="border-t border-input/60">
                  <td className="px-3 py-2 align-top text-xs">
                    <p className="font-medium text-foreground">{r.package_label}</p>
                    <p className="text-muted-foreground">source: {r.source}</p>
                  </td>
                  <td className="px-3 py-2 align-top text-xs">{r.currency}</td>
                  <td className="px-3 py-2 align-top">
                    <Input
                      type="number"
                      value={draft.governmentFeeCents}
                      onChange={(e) => updateDraft(r.id, { governmentFeeCents: Number(e.target.value) })}
                    />
                  </td>
                  <td className="px-3 py-2 align-top">
                    <Input
                      type="number"
                      value={draft.agencyFeeCents}
                      onChange={(e) => updateDraft(r.id, { agencyFeeCents: Number(e.target.value) })}
                    />
                  </td>
                  <td className="px-3 py-2 align-top">
                    <Input
                      type="number"
                      min={1}
                      max={90}
                      value={draft.overrideDays}
                      onChange={(e) => updateDraft(r.id, { overrideDays: Number(e.target.value) })}
                    />
                  </td>
                  <td className="px-3 py-2 align-top">
                    <Input
                      value={draft.reason}
                      onChange={(e) => updateDraft(r.id, { reason: e.target.value })}
                      placeholder="Why?"
                    />
                  </td>
                  <td className="px-3 py-2 text-right align-top">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => submit(r)}
                      disabled={pendingId === r.id || draft.reason.trim().length < 5}
                      className="bg-brand-500 hover:bg-brand-400"
                    >
                      {pendingId === r.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Save override
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Label className="text-xs text-muted-foreground">
        Overrides expire 1–90 days from save. After expiry the next scraper run reasserts the gov-published number.
      </Label>
    </div>
  );
}
