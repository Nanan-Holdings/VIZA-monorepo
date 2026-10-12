"use client";

import { useState, useTransition } from "react";
import { CircleNotch as Loader2, Lifebuoy as LifeBuoy, PaperPlaneTilt as Send } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupportTicket } from "@/app/actions/support";
import { useLocale } from "next-intl";

interface SupportButtonProps {
  applicationId?: string;
}

export function SupportButton({ applicationId }: SupportButtonProps) {
  const locale = useLocale();
  const copy = locale.toLowerCase().startsWith("zh")
    ? {
        open: "获取帮助",
        title: "提交客服工单",
        close: "关闭",
        success: (id: string) => `已收到 — 工单编号 #${id}。我们会在一个工作日内通过邮件回复。`,
        subject: "主题",
        details: "请描述遇到的问题",
        linked: (id: string) => `关联申请 #${id}`,
        failed: "发送失败，请稍后重试。",
        send: "发送",
      }
    : {
        open: "Get help",
        title: "Open a support ticket",
        close: "Close",
        success: (id: string) => `Got it — ticket #${id}. We'll reply by email within one business day.`,
        subject: "Subject",
        details: "What's going on?",
        linked: (id: string) => `Linked to application #${id}`,
        failed: "Failed to send. Please try again.",
        send: "Send",
      };
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createSupportTicket({ subject, body, applicationId });
      if (res.error || !res.ticketId) {
        setError(copy.failed);
        return;
      }
      setSubmitted(res.ticketId);
      setSubject("");
      setBody("");
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2 rounded-full bg-brand-500 px-4 py-3 text-sm font-medium text-white shadow-lg transition hover:bg-brand-400"
      >
        <LifeBuoy className="h-4 w-4" />
        {copy.open}
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-end bg-black/30 p-6 sm:items-center sm:justify-center">
          <div className="w-full max-w-md rounded-xl border border-input bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">{copy.title}</h2>
              <button
                type="button"
                className="text-sm text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setOpen(false);
                  setSubmitted(null);
                  setError(null);
                }}
              >
                {copy.close}
              </button>
            </div>
            {submitted ? (
              <p className="mt-3 rounded-md border border-brand-100 bg-brand-50 px-3 py-2 text-sm text-foreground">
                {copy.success(submitted.slice(0, 8))}
              </p>
            ) : (
              <form onSubmit={handleSubmit} className="mt-4 space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="ticket-subject">{copy.subject}</Label>
                  <Input
                    id="ticket-subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ticket-body">{copy.details}</Label>
                  <textarea
                    id="ticket-body"
                    rows={5}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    className="block w-full rounded-md border border-input bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    required
                    minLength={10}
                  />
                </div>
                {applicationId ? (
                  <p className="text-xs text-muted-foreground">
                    {copy.linked(applicationId.slice(0, 8))}
                  </p>
                ) : null}
                {error ? <p className="text-sm text-destructive">{error}</p> : null}
                <div className="flex justify-end">
                  <Button type="submit" disabled={pending} className="bg-brand-500 hover:bg-brand-400">
                    {pending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="mr-2 h-4 w-4" />
                    )}
                    {copy.send}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
