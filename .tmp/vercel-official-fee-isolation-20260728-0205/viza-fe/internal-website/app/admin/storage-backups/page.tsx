import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

interface BackupRow {
  id: string;
  bucket: string;
  target: string;
  status: string;
  bytes: number | null;
  object_count: number | null;
  started_at: string;
  completed_at: string | null;
  error: string | null;
  is_drill: boolean;
}

async function loadRows(): Promise<BackupRow[]> {
  const adminClient = createAdminClient();
  const { data } = await adminClient
    .from("storage_backup_log")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(40);
  return (data ?? []) as BackupRow[];
}

function humanBytes(b: number | null): string {
  if (!b) return "—";
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export default async function AdminStorageBackupsPage() {
  const rows = await loadRows();
  const latest = rows.find((r) => r.bucket === "application-documents" && r.status === "succeeded" && !r.is_drill);
  const ageHours = latest ? (Date.now() - Date.parse(latest.completed_at ?? latest.started_at)) / 3_600_000 : null;
  const alert = ageHours !== null && ageHours > 36;

  return (
    <main className="min-h-screen bg-[#fafafa] px-6 py-10">
      <div className="mx-auto max-w-5xl space-y-4">
        <header>
          <h1 className="text-2xl font-semibold text-foreground">Storage backups</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Off-site copy of <code>application-documents</code> + quarterly restore drills.
          </p>
        </header>

        {alert ? (
          <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            Last successful backup &gt; 36h ago. Investigate before tonight.
          </p>
        ) : null}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-input bg-white p-4 shadow-sm">
            <p className="text-xs uppercase text-muted-foreground">Last successful</p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {latest ? new Date(latest.completed_at ?? latest.started_at).toLocaleString() : "—"}
            </p>
          </div>
          <div className="rounded-xl border border-input bg-white p-4 shadow-sm">
            <p className="text-xs uppercase text-muted-foreground">Size</p>
            <p className="mt-1 text-sm font-semibold text-foreground">{humanBytes(latest?.bytes ?? null)}</p>
          </div>
          <div className="rounded-xl border border-input bg-white p-4 shadow-sm">
            <p className="text-xs uppercase text-muted-foreground">Last drill</p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {rows.find((r) => r.is_drill)?.completed_at
                ? new Date(rows.find((r) => r.is_drill)!.completed_at!).toLocaleDateString()
                : "—"}
            </p>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-input bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-[#fafafa] text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Started</th>
                <th className="px-3 py-2 text-left font-semibold">Bucket</th>
                <th className="px-3 py-2 text-left font-semibold">Target</th>
                <th className="px-3 py-2 text-left font-semibold">Status</th>
                <th className="px-3 py-2 text-left font-semibold">Size</th>
                <th className="px-3 py-2 text-left font-semibold">Drill?</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-input/60">
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {new Date(r.started_at).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{r.bucket}</td>
                  <td className="px-3 py-2 font-mono text-xs">{r.target}</td>
                  <td className="px-3 py-2 text-xs">
                    <span
                      className={
                        r.status === "succeeded"
                          ? "inline-block rounded-full bg-brand-50 px-2 py-0.5 text-brand-500"
                          : "inline-block rounded-full bg-destructive/10 px-2 py-0.5 text-destructive"
                      }
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs">{humanBytes(r.bytes)}</td>
                  <td className="px-3 py-2 text-xs">{r.is_drill ? "yes" : "—"}</td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-center text-xs text-muted-foreground">
                    No backup runs yet. Schedule the cron and the table will fill itself.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
