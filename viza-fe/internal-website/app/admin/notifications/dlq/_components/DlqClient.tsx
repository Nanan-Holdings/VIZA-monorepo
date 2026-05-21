"use client";

import { useState, useTransition } from "react";
import { Loader2, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { replayDlqRow, type DlqRow } from "@/app/actions/notification-dlq";

interface DlqClientProps {
  initialRows: DlqRow[];
}

export function DlqClient({ initialRows }: DlqClientProps) {
  const [rows, setRows] = useState(initialRows);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const replay = (id: string): void => {
    setPendingId(id);
    setError(null);
    startTransition(async () => {
      const res = await replayDlqRow(id);
      if (res.ok) {
        setRows((cur) => cur.filter((r) => r.id !== id));
      } else {
        setError(res.reason ?? "Replay failed");
      }
      setPendingId(null);
    });
  };

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-input bg-white p-8 text-center text-sm text-muted-foreground shadow-sm">
        No events in DLQ. 🎉
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>
      ) : null}
      <div className="overflow-hidden rounded-xl border border-input bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-[#fafafa] text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Created</th>
              <th className="px-3 py-2 text-left font-semibold">Template</th>
              <th className="px-3 py-2 text-left font-semibold">Channel</th>
              <th className="px-3 py-2 text-left font-semibold">Recipient</th>
              <th className="px-3 py-2 text-left font-semibold">Error</th>
              <th className="px-3 py-2 text-right font-semibold">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-input/60">
                <td className="px-3 py-2 text-xs text-muted-foreground">{new Date(row.created_at).toLocaleString()}</td>
                <td className="px-3 py-2 font-mono text-xs">{row.template_key}</td>
                <td className="px-3 py-2 text-xs">{row.channel}</td>
                <td className="px-3 py-2 text-xs">{row.recipient ?? "—"}</td>
                <td className="px-3 py-2 text-xs text-destructive">{row.error.slice(0, 80)}</td>
                <td className="px-3 py-2 text-right">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => replay(row.id)}
                    disabled={pendingId === row.id}
                  >
                    {pendingId === row.id ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCcw className="mr-2 h-4 w-4" />
                    )}
                    Replay
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
