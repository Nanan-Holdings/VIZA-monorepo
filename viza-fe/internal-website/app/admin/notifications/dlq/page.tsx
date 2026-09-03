import { listDlq } from "@/app/actions/notification-dlq";
import { DlqClient } from "./_components/DlqClient";
import { Alert, AlertDescription, AlertIcon } from "@/components/ui/alert";

export const dynamic = "force-dynamic";

export default async function NotificationDlqPage() {
  const { rows, error } = await listDlq();
  return (
    <main className="min-h-screen bg-[#fafafa] px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold text-foreground">Notification DLQ</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Events that exhausted 5 retries. Review the error, fix the upstream issue, then replay.
          </p>
        </header>
        {error ? (
          <Alert variant="destructive"><AlertIcon variant="destructive" /><AlertDescription>{error}</AlertDescription></Alert>
        ) : (
          <DlqClient initialRows={rows ?? []} />
        )}
      </div>
    </main>
  );
}
