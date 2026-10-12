"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { postTicketMessage, type SupportMessageRow } from "@/app/actions/support";

interface SupportThreadProps {
  ticketId: string;
  initialMessages: SupportMessageRow[];
  initialBody: string;
  initialBodyAt: string;
}

export function SupportThread({ ticketId, initialMessages, initialBody, initialBodyAt }: SupportThreadProps) {
  const [messages, setMessages] = useState<SupportMessageRow[]>(initialMessages);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`support_message:${ticketId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_message", filter: `ticket_id=eq.${ticketId}` },
        (payload) => {
          const row = payload.new as SupportMessageRow;
          setMessages((cur) => (cur.some((m) => m.id === row.id) ? cur : [...cur, row]));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [ticketId]);

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    if (!body.trim()) return;
    setError(null);
    startTransition(async () => {
      const res = await postTicketMessage({ ticketId, body });
      if (res.error) {
        setError(res.error);
        return;
      }
      setBody("");
    });
  };

  return (
    <div className="rounded-xl border border-input bg-white shadow-sm">
      <div className="space-y-3 p-4">
        <ThreadEntry kind="applicant" body={initialBody} createdAt={initialBodyAt} />
        {messages.map((m) => (
          <ThreadEntry key={m.id} kind={m.author_kind} body={m.body} createdAt={m.created_at} />
        ))}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-input p-3">
        <Input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Reply…"
          disabled={pending}
        />
        <Button type="submit" disabled={pending || !body.trim()} className="bg-brand-500 hover:bg-brand-400">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
      {error ? <p className="px-4 pb-3 text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

interface ThreadEntryProps {
  kind: string;
  body: string;
  createdAt: string;
}

function ThreadEntry({ kind, body, createdAt }: ThreadEntryProps) {
  const isStaff = kind === "staff";
  return (
    <div className={`flex ${isStaff ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-[75%] rounded-xl px-3 py-2 text-sm shadow-sm ${
          isStaff ? "bg-brand-50 text-foreground" : "bg-brand-500 text-white"
        }`}
      >
        <p className="whitespace-pre-wrap">{body}</p>
        <p className={`mt-1 text-xs ${isStaff ? "text-muted-foreground" : "text-white/80"}`}>
          {kind} · {new Date(createdAt).toLocaleString()}
        </p>
      </div>
    </div>
  );
}
