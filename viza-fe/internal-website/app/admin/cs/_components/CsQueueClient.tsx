"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AdminTicketRow, TicketTab } from "@/app/actions/admin-cs";

interface CsQueueClientProps {
  initialTab: TicketTab;
  initialRows: AdminTicketRow[];
}

const TABS: Array<{ key: TicketTab; label: string }> = [
  { key: "open", label: "Open" },
  { key: "mine", label: "Mine" },
  { key: "unassigned", label: "Unassigned" },
  { key: "breaching", label: "Breaching" },
];

export function CsQueueClient({ initialTab, initialRows }: CsQueueClientProps) {
  const router = useRouter();
  const [tab, setTab] = useState<TicketTab>(initialTab);

  const switchTab = (next: TicketTab): void => {
    setTab(next);
    router.replace(`/admin/cs?tab=${next}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Button
            key={t.key}
            type="button"
            variant={t.key === tab ? "default" : "outline"}
            size="sm"
            onClick={() => switchTab(t.key)}
            className={t.key === tab ? "bg-brand-500 hover:bg-brand-400" : ""}
          >
            {t.label}
          </Button>
        ))}
      </div>
      {initialRows.length === 0 ? (
        <div className="rounded-xl border border-input bg-white p-8 text-center text-sm text-muted-foreground shadow-sm">
          No tickets in this tab.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-input bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-[#fafafa] text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Subject</th>
                <th className="px-3 py-2 text-left font-semibold">Status</th>
                <th className="px-3 py-2 text-left font-semibold">SLA</th>
                <th className="px-3 py-2 text-left font-semibold">Updated</th>
                <th className="px-3 py-2 text-right font-semibold">Open</th>
              </tr>
            </thead>
            <tbody>
              {initialRows.map((row) => {
                const slaBreached =
                  !row.first_response_at && row.sla_due_at && Date.parse(row.sla_due_at) < Date.now();
                return (
                  <tr key={row.id} className="border-t border-input/60">
                    <td className="px-3 py-2 font-medium text-foreground">{row.subject}</td>
                    <td className="px-3 py-2 text-xs">{row.status}</td>
                    <td className="px-3 py-2 text-xs">
                      {slaBreached ? (
                        <span className="inline-flex items-center gap-1 text-destructive">
                          <AlertTriangle className="h-3.5 w-3.5" /> breached
                        </span>
                      ) : row.first_response_at ? (
                        "responded"
                      ) : row.sla_due_at ? (
                        `due ${new Date(row.sla_due_at).toLocaleString()}`
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {new Date(row.updated_at).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Link
                        href={`/admin/cs/${row.id}`}
                        className="inline-flex items-center text-sm font-medium text-brand-500 hover:underline"
                      >
                        Open <ChevronRight className="ml-1 h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
