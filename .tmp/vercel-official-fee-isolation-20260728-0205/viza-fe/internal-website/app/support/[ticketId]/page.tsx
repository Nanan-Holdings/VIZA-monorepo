import { redirect } from "next/navigation";
import { loadTicketThread } from "@/app/actions/support";
import { SupportThread } from "./_components/SupportThread";

interface SupportThreadPageProps {
  params: Promise<{ ticketId: string }>;
}

export const dynamic = "force-dynamic";

function formatStatus(status: string) {
  if (status === "resolved" || status === "closed") return "已解决";
  if (status === "in_progress" || status === "staff_replied") return "正在解决";
  return "未解决";
}

export default async function SupportThreadPage({ params }: SupportThreadPageProps) {
  const { ticketId } = await params;
  const { ticket, messages, error } = await loadTicketThread(ticketId);
  if (error === "Not authenticated") redirect("/client/login");
  if (error || !ticket) {
    return (
      <main className="min-h-screen bg-[#fafafa] px-6 py-10">
        <div className="mx-auto max-w-2xl rounded-xl border border-input bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-foreground">Ticket unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">{error ?? "Not found"}</p>
        </div>
      </main>
    );
  }
  return (
    <main className="min-h-screen bg-[#fafafa] px-6 py-10">
      <div className="mx-auto max-w-2xl space-y-4">
        <header>
          <h1 className="text-2xl font-semibold text-foreground">{ticket.subject}</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            状态: {formatStatus(ticket.status)} · opened {new Date(ticket.created_at).toLocaleString()}
          </p>
        </header>
        <SupportThread ticketId={ticket.id} initialMessages={messages ?? []} initialBody={ticket.body} initialBodyAt={ticket.created_at} />
      </div>
    </main>
  );
}
