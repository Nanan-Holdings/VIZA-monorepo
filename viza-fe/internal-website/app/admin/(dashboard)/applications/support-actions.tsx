"use client";

import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { Check, Clipboard, Mail, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { queueStatusNotification } from "./actions";

function QueueButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant="outline"
      className="border-[#d7d7d7] text-[#45556c]"
      disabled={disabled || pending}
    >
      <Send className="h-4 w-4" />
      {pending ? "Queueing..." : "Queue status email"}
    </Button>
  );
}

export function SupportActions({
  applicationId,
  applicantEmail,
  summaryText,
  returnTo,
}: {
  applicationId: string;
  applicantEmail: string | null;
  summaryText: string;
  returnTo: string;
}) {
  const [copied, setCopied] = useState(false);
  const mailHref = useMemo(() => {
    if (!applicantEmail) return null;
    const subject = encodeURIComponent("VIZA application status update");
    const body = encodeURIComponent(summaryText);
    return `mailto:${applicantEmail}?subject=${subject}&body=${body}`;
  }, [applicantEmail, summaryText]);

  async function copySummary() {
    await navigator.clipboard.writeText(summaryText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        variant="outline"
        className="border-[#d7d7d7] text-[#45556c]"
        onClick={copySummary}
      >
        {copied ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}
        {copied ? "Copied" : "Copy status summary"}
      </Button>

      {mailHref && (
        <Button asChild variant="outline" className="border-[#d7d7d7] text-[#45556c]">
          <a href={mailHref}>
            <Mail className="h-4 w-4" />
            Draft support email
          </a>
        </Button>
      )}

      <form action={queueStatusNotification}>
        <input type="hidden" name="applicationId" value={applicationId} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <QueueButton disabled={!applicantEmail} />
      </form>
    </div>
  );
}
